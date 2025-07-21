/**
 * =====================================================================
 * File: js/fileProcessor.worker.js (FINAL VERSION WITH HYBRID OCR)
 * =====================================================================
 * Deskripsi: Worker ini sekarang memiliki kemampuan "Hybrid PDF Processing".
 * Ia akan mencoba ekstraksi teks cepat, dan jika gagal (misal, PDF hasil scan),
 * ia akan secara otomatis beralih ke mode OCR per halaman.
 *
 * FITUR BARU:
 * 1.  Hybrid PDF Processing: Fungsi `extractTextFromPdf` kini cerdas. Jika
 * sebuah halaman tidak memiliki teks yang bisa diekstrak, worker akan
 * merender halaman itu menjadi gambar dan menjalankannya melalui Tesseract.js.
 * 2.  Deteksi Teks Kosong: Ada ambang batas (`MIN_TEXT_LENGTH_PER_PAGE`) untuk
 * menentukan apakah ekstraksi teks standar dianggap berhasil atau perlu OCR.
 * 3.  Feedback Progres Detail: Pesan yang dikirim ke UI sekarang lebih spesifik,
 * memberi tahu pengguna apakah sedang "Membaca Teks" atau "Menjalankan OCR".
 */

// =====================================================================
// IMPOR LIBRARY MODERN (ESM) DARI CDN
// =====================================================================
import mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/+esm';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/+esm';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/+esm';

// Konfigurasi path untuk worker PDF.js (wajib untuk lingkungan ESM)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs`;

// Buat satu instance Tesseract worker untuk digunakan kembali agar lebih cepat
let ocrWorker = null;
const initializeOcrWorker = async () => {
    if (!ocrWorker) {
        self.postMessage({ status: 'progress', details: `Mempersiapkan engine OCR...` });
        ocrWorker = await createWorker('ind', 1, {
             logger: m => {
                if (m.status === 'recognizing text') {
                    // Kirim progres OCR yang detail ke UI
                    self.postMessage({ status: 'progress', details: `Mengenali teks (${Math.round(m.progress * 100)}%)` });
                }
            }
        });
    }
    return ocrWorker;
};


// =====================================================================
// MESSAGE HANDLER UTAMA
// =====================================================================
self.onmessage = async (event) => {
    const file = event.data;
    if (!file || !(file instanceof File)) {
        self.postMessage({ status: 'error', message: 'Data yang diterima bukan file yang valid.' });
        return;
    }

    try {
        const content = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            text: '',
            metadata: { fileName: file.name, fileSize: file.size, fileType: file.type }
        };
        let rawText = '';

        if (file.type === 'application/pdf') {
            rawText = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            rawText = await extractTextFromDocx(file);
        } else if (file.type.startsWith('image/')) {
             // Pastikan worker OCR siap sebelum memproses gambar
            await initializeOcrWorker();
            rawText = await extractTextFromImage(file);
        } else if (file.type.startsWith('text/')) {
            rawText = await extractTextFromTextFile(file);
        } else {
            throw new Error(`Format file "${file.type || file.name}" tidak didukung.`);
        }

        content.text = cleanText(rawText);
        content.metadata.wordCount = content.text.split(/\s+/).filter(Boolean).length;
        self.postMessage({ status: 'ready', content });

    } catch (error) {
        console.error("Error di dalam fileProcessor.worker.js:", error);
        self.postMessage({ status: 'error', message: `Gagal memproses file: ${error.message}` });
    } finally {
        // Hentikan worker OCR setelah semua tugas selesai untuk membebaskan memori
        if (ocrWorker) {
            await ocrWorker.terminate();
            ocrWorker = null;
        }
    }
};


// =====================================================================
// FUNGSI-FUNGSI EKSTRAKSI TEKS (DENGAN LOGIKA HYBRID)
// =====================================================================

/**
 * Mengekstrak teks dari PDF menggunakan metode hybrid (Teks + OCR).
 */
async function extractTextFromPdf(file) {
    const MIN_TEXT_LENGTH_PER_PAGE = 20; // Jika teks < 20 char, anggap halaman butuh OCR
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        self.postMessage({ status: 'progress', details: `Membaca halaman ${i}/${pdf.numPages}...` });
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ').trim();

        // Jika teks normal ada dan cukup, gunakan itu.
        if (pageText.length > MIN_TEXT_LENGTH_PER_PAGE) {
            fullText += pageText + '\n';
        } else {
            // Jika tidak ada teks, jalankan OCR.
            self.postMessage({ status: 'progress', details: `Menjalankan OCR pada halaman ${i}...` });
             try {
                // Pastikan worker OCR siap
                await initializeOcrWorker();
                const ocrText = await ocrPage(page);
                fullText += ocrText + '\n';
            } catch (ocrError) {
                console.warn(`OCR gagal untuk halaman ${i}:`, ocrError);
                // Lanjutkan ke halaman berikutnya meskipun OCR gagal
            }
        }
    }
    return fullText;
}

/**
 * Helper function untuk merender halaman PDF ke gambar dan menjalankan OCR.
 */
async function ocrPage(page) {
    const viewport = page.getViewport({ scale: 2.0 }); // Skala 2x untuk kualitas OCR lebih baik
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    
    if (!ocrWorker) throw new Error("OCR worker belum siap.");
    
    const { data: { text } } = await ocrWorker.recognize(blob);
    return text;
}


async function extractTextFromImage(file) {
    if (!ocrWorker) throw new Error("OCR worker belum siap.");
    const { data: { text } } = await ocrWorker.recognize(file);
    return text;
}

async function extractTextFromDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

async function extractTextFromTextFile(file) {
    return file.text();
}


// =====================================================================
// FUNGSI UTILITAS PEMBERSIH TEKS
// =====================================================================
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/(\r\n|\n|\r){3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}
