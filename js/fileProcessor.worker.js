/**
 * =====================================================================
 * File: js/fileProcessor.worker.js (FINAL ROBUST VERSION)
 * =====================================================================
 * Deskripsi: Worker ini berjalan di latar belakang untuk mengekstrak teks
 * dari berbagai jenis file (PDF, DOCX, Gambar, Teks) tanpa memblokir
 * antarmuka pengguna (UI).
 *
 * PERBAIKAN KRUSIAL (ESM PDF.js FIX):
 * 1.  Global Worker Configuration: Menggunakan 'pdfjsLib.GlobalWorkerOptions.workerSrc'
 * untuk secara eksplisit dan global mendefinisikan path ke file worker
 * PDF.js versi modul (.mjs). Ini adalah metode yang paling stabil dan
 * direkomendasikan untuk lingkungan ESM, menghindari error "worker not found"
 * atau masalah cross-origin.
 * 2.  Reliable CDN: Menggunakan CDN jsDelivr yang dikenal memiliki dukungan
 * kuat untuk paket ESM.
 * 3.  Error Handling: Penanganan error di setiap fungsi ekstraksi diperkuat
 * untuk memberikan pesan yang lebih spesifik jika terjadi kegagalan.
 */

// =====================================================================
// IMPOR LIBRARY MODERN (ESM) DARI CDN
// =====================================================================
import mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/+esm';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/+esm';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/+esm';

// --- KUNCI PERBAIKAN ---
// Secara eksplisit memberitahu pdf.js di mana harus menemukan file worker-nya.
// Ini harus dilakukan sekali di level global worker kita.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs`;


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

        // Delegasikan ke fungsi yang sesuai berdasarkan tipe file
        if (file.type === 'application/pdf') {
            rawText = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            rawText = await extractTextFromDocx(file);
        } else if (file.type.startsWith('image/')) {
            rawText = await extractTextFromImage(file);
        } else if (file.type.startsWith('text/')) {
            rawText = await extractTextFromTextFile(file);
        } else {
            throw new Error(`Format file "${file.type || file.name}" tidak didukung.`);
        }

        content.text = cleanText(rawText);
        content.metadata.wordCount = content.text.split(/\s+/).filter(Boolean).length;

        // Kirim hasil akhir kembali ke thread utama
        self.postMessage({ status: 'ready', content });

    } catch (error) {
        console.error("Error di dalam fileProcessor.worker.js:", error);
        self.postMessage({ status: 'error', message: `Gagal memproses file: ${error.message}` });
    }
};


// =====================================================================
// FUNGSI-FUNGSI EKSTRAKSI TEKS
// =====================================================================

async function extractTextFromPdf(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        // Karena workerSrc sudah diatur secara global, kita tidak perlu menentukannya lagi di sini.
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        let fullText = '';
        self.postMessage({ status: 'progress', details: `Membaca ${pdf.numPages} halaman PDF...` });

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        return fullText;
    } catch (error) {
        throw new Error(`Gagal membaca file PDF. Error: ${error.message}`);
    }
}

async function extractTextFromDocx(file) {
    try {
        self.postMessage({ status: 'progress', details: 'Mengekstrak teks dari DOCX...' });
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        throw new Error(`Gagal membaca file DOCX. Error: ${error.message}`);
    }
}

async function extractTextFromImage(file) {
    try {
        self.postMessage({ status: 'progress', details: `Mempersiapkan pengenalan teks (OCR)...` });
        const worker = await createWorker('ind', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    self.postMessage({
                        status: 'progress',
                        details: `Mengenali teks (${Math.round(m.progress * 100)}%)`
                    });
                }
            }
        });
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        return text;
    } catch (error) {
        throw new Error(`Gagal mengenali teks dari gambar. Error: ${error.message}`);
    }
}

async function extractTextFromTextFile(file) {
    try {
        self.postMessage({ status: 'progress', details: 'Membaca file teks...' });
        return await file.text();
    } catch (error) {
        throw new Error(`Gagal membaca file teks. Error: ${error.message}`);
    }
}

// =====================================================================
// FUNGSI UTILITAS PEMBERSIH TEKS
// =====================================================================
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/(\r\n|\n|\r){3,}/g, '\n\n') // Gabungkan jeda baris berlebih
        .replace(/[ \t]+/g, ' ')             // Ganti spasi/tab ganda dengan satu spasi
        .trim();                             // Hapus spasi di awal dan akhir
}
