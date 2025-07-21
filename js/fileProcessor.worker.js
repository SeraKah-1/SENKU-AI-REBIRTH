/**
 * =====================================================================
 * File: js/fileProcessor.worker.js (VERSI MODERN - ESM)
 * =====================================================================
 *
 * Menggunakan metode import modul JavaScript modern, bukan importScripts.
 * Ini membuat kode lebih bersih dan sesuai dengan praktik pengembangan web saat ini.
 */

// =====================================================================
// IMPOR LIBRARY MODERN (ESM) DARI CDN
// =====================================================================
import mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/+esm';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/+esm';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/+esm';

// Konfigurasi path untuk sub-worker yang dibutuhkan oleh PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;


// =====================================================================
// MESSAGE HANDLER UTAMA
// =====================================================================
self.onmessage = async (event) => {
    const file = event.data;

    // Abaikan jika data tidak valid atau ada perintah pembatalan
    if (!file || event.data.type === 'cancel') {
        return;
    }

    try {
        let content = {
            title: file.name.replace(/\.[^/.]+$/, ""), // Ambil nama file tanpa ekstensi
            text: '',
            metadata: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                charCount: 0,
                wordCount: 0,
            }
        };
        let rawText = '';

        // Pilih metode ekstraksi teks berdasarkan tipe file
        if (file.type === 'application/pdf') {
            rawText = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx')) {
            rawText = await extractTextFromDocx(file);
        } else if (file.type.startsWith('image/')) {
            rawText = await extractTextFromImage(file);
        } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
            rawText = await extractTextFromTextFile(file);
        } else {
            throw new Error(`Format file "${file.type}" tidak didukung.`);
        }

        // Bersihkan dan proses teks yang sudah diekstrak
        content.text = cleanText(rawText);
        content.metadata.charCount = content.text.length;
        content.metadata.wordCount = content.text.trim().split(/\s+/).length;
        const previewText = content.text.substring(0, 250) + (content.text.length > 250 ? '...' : '');

        // Kirim hasil akhir kembali ke thread utama
        self.postMessage({ status: 'ready', content, preview: previewText });

    } catch (error) {
        console.error("Terjadi error di dalam worker:", error);
        self.postMessage({ status: 'error', message: error.message });
    }
};


// =====================================================================
// FUNGSI-FUNGSI EKSTRAKSI TEKS
// =====================================================================

async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
        // Kirim progress update
        self.postMessage({
            status: 'progress',
            progress: Math.round((i / pdf.numPages) * 100),
            details: `Memproses halaman PDF ${i} dari ${pdf.numPages}`
        });
    }
    return fullText;
}

async function extractTextFromDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

async function extractTextFromImage(file) {
    self.postMessage({ status: 'progress', progress: 0, details: `Mempersiapkan OCR untuk gambar...` });
    
    // Buat worker Tesseract untuk bahasa Indonesia
    const worker = await createWorker('ind', 1, {
        logger: m => {
            // Kirim progress update saat Tesseract sedang mengenali teks
            if (m.status === 'recognizing text') {
                const progress = Math.round(m.progress * 100);
                self.postMessage({ status: 'progress', progress: progress, details: `Mengenali teks (${progress}%)` });
            }
        }
    });

    const { data: { text } } = await worker.recognize(file);
    await worker.terminate(); // Matikan worker setelah selesai untuk hemat memori
    return text;
}

async function extractTextFromTextFile(file) {
    return file.text();
}


// =====================================================================
// FUNGSI UTILITAS PEMBERSIH TEKS
// =====================================================================

function cleanText(text) {
    if (!text) return '';
    // Ganti baris baru yang berlebihan (lebih dari 2) menjadi satu baris kosong
    let cleaned = text.replace(/(\r\n|\n|\r){2,}/gm, '\n\n'); 
    // Ganti spasi ganda dengan spasi tunggal
    cleaned = cleaned.replace(/\s\s+/g, ' '); 
    return cleaned.trim();
}
