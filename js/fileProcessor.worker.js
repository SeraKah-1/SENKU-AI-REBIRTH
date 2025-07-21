/**
 * =====================================================================
 * File: js/fileProcessor.worker.js (VERSI DIPERBAIKI TOTAL)
 * =====================================================================
 * Deskripsi: Worker ini berjalan di latar belakang untuk mengekstrak teks
 * dari berbagai jenis file (PDF, DOCX, Gambar, Teks) tanpa memblokir
 * antarmuka pengguna (UI).
 *
 * PERBAIKAN KUNCI:
 * 1.  PDF.js Initialization Fix: Mengatasi error umum "Cannot set properties
 * of undefined (setting 'workerSrc')" dengan mengonfigurasi worker PDF.js
 * secara lokal saat fungsi dipanggil, bukan secara global. Ini adalah
 * metode yang paling stabil dan modern.
 * 2.  Library Modern (ESM): Menggunakan impor modul ES langsung dari CDN yang
 * andal, memastikan kompatibilitas dan kemudahan pemeliharaan.
 * 3.  Error Handling Robust: Memastikan setiap kegagalan dalam pemrosesan
 * file akan ditangkap dan dilaporkan kembali ke thread utama dengan pesan
 * yang jelas.
 */

// =====================================================================
// IMPOR LIBRARY MODERN (ESM) DARI CDN
// =====================================================================
import mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/+esm';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/+esm';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/+esm';

// =====================================================================
// MESSAGE HANDLER UTAMA (Titik Masuk Worker)
// =====================================================================
self.onmessage = async (event) => {
    const file = event.data;
    if (!file || !(file instanceof File)) {
        self.postMessage({ status: 'error', message: 'Data yang diterima worker bukan file yang valid.' });
        return;
    }

    try {
        // Objek untuk menampung hasil ekstraksi
        const content = {
            title: file.name.replace(/\.[^/.]+$/, ""), // Ambil nama file tanpa ekstensi
            text: '',
            metadata: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
            }
        };
        let rawText = '';

        // Tentukan metode ekstraksi berdasarkan tipe file
        if (file.type === 'application/pdf') {
            rawText = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            self.postMessage({ status: 'progress', details: 'Membaca file DOCX...' });
            rawText = await extractTextFromDocx(file);
        } else if (file.type.startsWith('image/')) {
            rawText = await extractTextFromImage(file);
        } else if (file.type.startsWith('text/')) {
            self.postMessage({ status: 'progress', details: 'Membaca file teks...' });
            rawText = await extractTextFromTextFile(file);
        } else {
            throw new Error(`Format file "${file.type || file.name}" tidak didukung.`);
        }

        // Bersihkan teks yang diekstrak dan hitung jumlah kata
        content.text = cleanText(rawText);
        content.metadata.wordCount = content.text.split(/\s+/).filter(Boolean).length;

        // Kirim hasil akhir kembali ke thread utama
        self.postMessage({ status: 'ready', content });

    } catch (error) {
        console.error("Terjadi error di dalam fileProcessor.worker.js:", error);
        self.postMessage({ status: 'error', message: error.message });
    }
};


// =====================================================================
// FUNGSI-FUNGSI EKSTRAKSI TEKS
// =====================================================================

/**
 * Mengekstrak teks dari file PDF.
 * @param {File} file - File PDF yang akan diproses.
 * @returns {Promise<string>} Teks yang diekstrak.
 */
async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    // PERBAIKAN KRUSIAL: Konfigurasi workerSrc dilakukan di sini, saat getDocument dipanggil.
    // Ini adalah cara modern dan anti-bug untuk menggunakan pdf.js sebagai modul.
    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        // Gunakan file worker .mjs untuk kompatibilitas modul
        workerSrc: `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`
    });

    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        // Kirim update progres ke UI
        self.postMessage({
            status: 'progress',
            details: `Membaca halaman PDF ${i} dari ${pdf.numPages}`
        });
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
}

/**
 * Mengekstrak teks mentah dari file DOCX.
 * @param {File} file - File DOCX.
 * @returns {Promise<string>} Teks yang diekstrak.
 */
async function extractTextFromDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

/**
 * Mengekstrak teks dari gambar menggunakan Tesseract.js (OCR).
 * @param {File} file - File gambar (JPEG, PNG, dll).
 * @returns {Promise<string>} Teks yang diekstrak.
 */
async function extractTextFromImage(file) {
    self.postMessage({ status: 'progress', details: `Mempersiapkan OCR (pengenalan teks)...` });
    // Membuat worker Tesseract. 'ind' untuk Bahasa Indonesia.
    const worker = await createWorker('ind', 1, {
        logger: m => {
            // Memberikan feedback progres yang detail dari proses OCR
            if (m.status === 'recognizing text') {
                self.postMessage({
                    status: 'progress',
                    details: `Mengenali teks (${Math.round(m.progress * 100)}%)`
                });
            }
        }
    });
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate(); // Penting: Hentikan worker setelah selesai
    return text;
}

/**
 * Membaca konten dari file teks biasa.
 * @param {File} file - File .txt, .md, dll.
 * @returns {Promise<string>} Konten teks.
 */
async function extractTextFromTextFile(file) {
    return file.text();
}


// =====================================================================
// FUNGSI UTILITAS PEMBERSIH TEKS
// =====================================================================
function cleanText(text) {
    if (!text) return '';
    let cleaned = text;
    // Ganti beberapa jeda baris (enter) dengan satu jeda baris saja.
    cleaned = cleaned.replace(/(\r\n|\n|\r){2,}/g, '\n\n');
    // Ganti beberapa spasi/tab dengan satu spasi.
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // Hapus spasi di awal dan akhir teks.
    return cleaned.trim();
}
