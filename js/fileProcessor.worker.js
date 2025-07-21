/**
 * =====================================================================
 * File: js/fileProcessor.worker.js (VERSI DIPERBAIKI TOTAL)
 * =====================================================================
 *
 * * PERBAIKAN: Mengatasi error "Cannot set properties of undefined (setting 'workerSrc')"
 * dengan mengubah cara konfigurasi worker untuk PDF.js agar sesuai dengan standar
 * modul JavaScript modern (ESM).
 */

// =====================================================================
// IMPOR LIBRARY MODERN (ESM) DARI CDN
// =====================================================================

import mammoth from 'https://cdn.jsdelivr.net/npm/mammoth@1.9.1/+esm';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/+esm';
import { createWorker } from 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/+esm';

// HAPUS BARIS INI KARENA MENYEBABKAN ERROR
// pdfjsLib.GlobalWorkerOptions.workerSrc = ...;


// =====================================================================
// MESSAGE HANDLER UTAMA
// =====================================================================
self.onmessage = async (event) => {
    const file = event.data;
    if (!file || !(file instanceof File)) return;

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
        
        // Tambahkan penghitungan kata
        content.metadata.wordCount = content.text.split(/\s+/).filter(Boolean).length;
        
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
    
    // PERBAIKAN: Konfigurasi workerSrc dilakukan di sini, BUKAN di luar.
    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        workerSrc: `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`
    });

    const pdf = await loadingTask.promise;
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
    let cleaned = text.replace(/(\r\n|\n|\r){2,}/gm, '\n\n'); // Gabungkan baris baru berlebih
    cleaned = cleaned.replace(/\s+/g, ' '); // Ganti spasi berlebih dengan satu spasi
    return cleaned.trim();
}
