/**
 * =====================================================================
 * File: js/fileProcessor.worker.js (VERSI DIPERBAIKI)
 * =====================================================================
 *
 * fileProcessor.worker.js: Pekerja Latar Belakang (Analis Konten)
 * * FIX: Menonaktifkan sementara Tesseract.js (OCR) untuk mengatasi error 'importScripts'.
 * * Fokus pada fungsionalitas inti: PDF, DOCX, dan Teks.
 */

// =====================================================================
// IMPOR LIBRARY PIHAK KETIGA
// =====================================================================
self.importScripts('https://unpkg.com/mammoth@1.5.1/mammoth.browser.min.js');
self.importScripts('https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.min.js');
// self.importScripts('https://unpkg.com/tesseract.js@2.1.0/dist/tesseract.min.js'); // <-- DINONAKTIFKAN SEMENTARA
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;


// =====================================================================
// STATE & KONTROL WORKER
// =====================================================================
let isCancelled = false;


// =====================================================================
// MESSAGE HANDLER UTAMA
// =====================================================================
self.onmessage = async (event) => {
    if (event.data && event.data.type === 'cancel') {
        isCancelled = true;
        return;
    }

    const file = event.data;
    isCancelled = false;

    try {
        let content = {
            title: file.name.replace(/\.[^/.]+$/, ""),
            text: '',
            structured: [],
            metadata: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                charCount: 0,
                wordCount: 0,
            }
        };

        let rawText = '';

        // Pilih metode ekstraksi berdasarkan tipe file
        if (file.type === 'application/pdf') {
            rawText = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx')) {
            rawText = await extractTextFromDocx(file);
        } else if (file.type.startsWith('image/')) {
            // FIX: Beri pesan error yang jelas karena OCR dinonaktifkan
            throw new Error('Pemrosesan gambar (OCR) saat ini sedang dalam perbaikan.');
        } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
            rawText = await extractTextFromTextFile(file);
        } else {
            throw new Error(`Format file "${file.type}" tidak didukung.`);
        }

        if (isCancelled) {
            self.postMessage({ status: 'cancelled' });
            return;
        }

        content.text = cleanText(rawText);
        content.structured = parseTextStructure(content.text);
        content.metadata.charCount = content.text.length;
        content.metadata.wordCount = content.text.trim().split(/\s+/).length;
        const previewText = content.text.substring(0, 250) + (content.text.length > 250 ? '...' : '');

        self.postMessage({ status: 'ready', content, preview: previewText });

    } catch (error) {
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
        if (isCancelled) return null;
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
        self.postMessage({
            status: 'progress',
            progress: Math.round((i / pdf.numPages) * 100),
            details: `Memproses halaman ${i} dari ${pdf.numPages}`
        });
    }
    return fullText;
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
// FUNGSI-FUNGSI PEMROSESAN TEKS
// =====================================================================

function cleanText(text) {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/Page \d+\s*of\s*\d+/gi, '');
    cleaned = cleaned.replace(/(\r\n|\n|\r){2,}/gm, '\n\n');
    cleaned = cleaned.replace(/(\r\n|\n|\r)(?!\n)/gm, ' ');
    cleaned = cleaned.replace(/\s\s+/g, ' ');
    return cleaned.trim();
}

function parseTextStructure(cleanedText) {
    if (!cleanedText) return [];
    const blocks = cleanedText.split('\n\n');
    const structuredContent = [];
    blocks.forEach(block => {
        const lines = block.split('\n').filter(line => line.trim() !== '');
        lines.forEach(line => {
            if (line.length < 80 && line.length > 2 && !line.endsWith('.')) {
                structuredContent.push({ type: 'heading', content: line.trim() });
            } else if (line.trim().match(/^(\*|-|\d+\.)\s/)) {
                structuredContent.push({ type: 'list_item', content: line.trim() });
            } else {
                structuredContent.push({ type: 'paragraph', content: line.trim() });
            }
        });
    });
    return structuredContent;
}
