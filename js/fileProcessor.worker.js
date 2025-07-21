/**
 * =====================================================================
 * File: js/fileProcessor.worker.js (VERSI MODERN - FINAL FIX)
 * =====================================================================
 *
 * Menggunakan metode import modul JavaScript modern (ESM).
 * FIX: Memperbaiki cara pemanggilan library PDF.js yang benar untuk modul ESM.
 */

// =====================================================================
// IMPOR LIBRARY MODERN (ESM) DARI CDN
// =====================================================================

// Untuk memproses file .docx
import mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/+esm';

// Untuk memproses file .pdf (CARA IMPOR DIPERBAIKI)
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/+esm';

// Untuk membaca teks dari gambar (OCR)
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/+esm';

// Konfigurasi path untuk sub-worker yang dibutuhkan oleh PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;


// =====================================================================
// MESSAGE HANDLER UTAMA
// =====================================================================
self.onmessage = async (event) => {
    const file = event.data;

    if (!file || !(file instanceof File)) {
        return;
    }

    try {
        let content = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            text: '',
            metadata: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
            }
        };
        let rawText = '';

        if (file.type === 'application/pdf') {
            rawText = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            rawText = await extractTextFromDocx(file);
        } else if (file.type.startsWith('image/')) {
            rawText = await extractTextFromImage(file);
        } else if (file.type.startsWith('text/')) {
            rawText = await extractTextFromTextFile(file);
        } else {
            throw new Error(`Format file "${file.type}" tidak didukung.`);
        }

        content.text = cleanText(rawText);
        self.postMessage({ status: 'ready', content });

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
    // Panggil getDocument melalui objek pdfjsLib
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
        self.postMessage({
            status: 'progress',
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
    self.postMessage({ status: 'progress', details: `Mempersiapkan OCR untuk gambar...` });
    const worker = await createWorker('ind', 1, {
        logger: m => {
            if (m.status === 'recognizing text') {
                self.postMessage({ status: 'progress', details: `Mengenali teks (${Math.round(m.progress * 100)}%)` });
            }
        }
    });
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
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
    let cleaned = text.replace(/(\r\n|\n|\r){2,}/gm, '\n\n');
    cleaned = cleaned.replace(/\s\s+/g, ' ');
    return cleaned.trim();
}
