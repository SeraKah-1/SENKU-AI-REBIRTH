/**
 * =====================================================================
 * File: js/fileProcessor.worker.js
 * =====================================================================
 *
 * fileProcessor.worker.js: Pekerja Latar Belakang (Analis Konten)
 * * File ini berjalan di thread terpisah dari UI utama.
 * * Tugasnya adalah melakukan pekerjaan berat: membaca, membersihkan, dan menganalisis
 * konten dari berbagai format file (PDF, DOCX, Teks, Gambar/OCR).
 */

// =====================================================================
// IMPOR LIBRARY PIHAK KETIGA
// Worker mengimpor skripnya sendiri.
// =====================================================================
self.importScripts('https://unpkg.com/mammoth@1.5.1/mammoth.browser.min.js');
self.importScripts('https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.min.js');
self.importScripts('https://unpkg.com/tesseract.js@2.1.0/dist/tesseract.min.js');
// Inisialisasi worker untuk pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;


// =====================================================================
// STATE & KONTROL WORKER
// =====================================================================
let isCancelled = false;


// =====================================================================
// MESSAGE HANDLER UTAMA
// Titik masuk untuk semua perintah yang dikirim dari main thread.
// =====================================================================
self.onmessage = async (event) => {
    // Cek apakah ini perintah untuk membatalkan proses
    if (event.data && event.data.type === 'cancel') {
        isCancelled = true;
        console.log("Proses pembacaan file dibatalkan oleh pengguna.");
        return;
    }

    const file = event.data;
    isCancelled = false; // Reset status pembatalan untuk setiap file baru

    try {
        // Inisialisasi objek konten yang akan kita isi
        let content = {
            title: file.name.replace(/\.[^/.]+$/, ""), // Judul dari nama file
            text: '', // Teks mentah yang sudah dibersihkan
            structured: [], // Teks yang sudah dianalisis strukturnya
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
            rawText = await extractTextFromImage(file);
        } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
            rawText = await extractTextFromTextFile(file);
        } else {
            throw new Error(`Format file "${file.type}" tidak didukung.`);
        }

        // Jika proses dibatalkan saat ekstraksi, hentikan eksekusi
        if (isCancelled) {
            self.postMessage({ status: 'cancelled' });
            return;
        }

        // 2. Bersihkan dan proses teks yang sudah diekstrak
        content.text = cleanText(rawText);
        content.structured = parseTextStructure(content.text);
        
        // 3. Hitung metadata tambahan
        content.metadata.charCount = content.text.length;
        content.metadata.wordCount = content.text.trim().split(/\s+/).length;

        // 4. Buat cuplikan pratinjau
        const previewText = content.text.substring(0, 250) + (content.text.length > 250 ? '...' : '');

        // 5. Kirim kembali hasil akhir yang sudah lengkap ke main thread
        self.postMessage({ status: 'ready', content, preview: previewText });

    } catch (error) {
        // Jika terjadi error di mana pun, kirim pesan error kembali
        let errorMessage = error.message;
        if (error.message.includes('password')) {
            errorMessage = 'File PDF terkunci dengan password dan tidak bisa dibaca.';
        }
        self.postMessage({ status: 'error', message: errorMessage });
    }
};


// =====================================================================
// FUNGSI-FUNGSI EKSTRAKSI TEKS
// =====================================================================

/**
 * Mengekstrak teks dari file PDF, halaman per halaman, dengan laporan progres.
 */
async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        // Cek apakah ada perintah pembatalan sebelum memproses halaman berikutnya
        if (isCancelled) return null;

        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';

        // Kirim pesan progres setelah setiap halaman diproses
        self.postMessage({
            status: 'progress',
            progress: Math.round((i / pdf.numPages) * 100),
            details: `Memproses halaman ${i} dari ${pdf.numPages}`
        });
    }
    return fullText;
}

/**
 * Mengekstrak teks dari file DOCX.
 */
async function extractTextFromDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

/**
 * Mengekstrak teks dari file gambar menggunakan Tesseract.js (OCR).
 */
async function extractTextFromImage(file) {
    // Kirim progres awal untuk OCR
    self.postMessage({ status: 'progress', progress: 0, details: 'Mempersiapkan mesin OCR...' });

    const recognizer = await Tesseract.createScheduler();
    const worker = await Tesseract.createWorker({
        logger: m => {
            // Kirim progres OCR ke main thread
            if (m.status === 'recognizing text') {
                self.postMessage({
                    status: 'progress',
                    progress: Math.round(m.progress * 100),
                    details: 'Mengenali teks pada gambar...'
                });
            }
        }
    });
    
    await worker.load();
    await worker.loadLanguage('ind+eng'); // Muat bahasa Indonesia dan Inggris
    await worker.initialize('ind+eng');
    recognizer.addWorker(worker);

    const { data: { text } } = await recognizer.addJob('recognize', file);
    await recognizer.terminate(); // Hentikan scheduler setelah selesai
    return text;
}

/**
 * Mengekstrak teks dari file teks biasa (.txt, .md).
 */
async function extractTextFromTextFile(file) {
    return file.text();
}


// =====================================================================
// FUNGSI-FUNGSI PEMROSESAN TEKS
// =====================================================================

/**
 * Membersihkan teks mentah dari karakter dan spasi yang tidak perlu.
 */
function cleanText(text) {
    let cleaned = text;
    // Hapus header/footer umum (contoh: "Page 1 of 10")
    cleaned = cleaned.replace(/Page \d+\s*of\s*\d+/gi, '');
    // Ganti beberapa baris baru dengan satu paragraf
    cleaned = cleaned.replace(/(\r\n|\n|\r){2,}/gm, '\n\n');
    // Ganti baris baru tunggal dengan spasi (menyambung kalimat yang terpotong)
    cleaned = cleaned.replace(/(\r\n|\n|\r)(?!\n)/gm, ' ');
    // Hapus spasi berlebih
    cleaned = cleaned.replace(/\s\s+/g, ' ');
    return cleaned.trim();
}

/**
 * Menganalisis teks yang sudah bersih dan memecahnya menjadi struktur logis.
 */
function parseTextStructure(cleanedText) {
    const blocks = cleanedText.split('\n\n'); // Pecah berdasarkan paragraf
    const structuredContent = [];

    blocks.forEach(block => {
        const lines = block.split('\n').filter(line => line.trim() !== '');
        lines.forEach(line => {
            // Logika sederhana untuk identifikasi (bisa dibuat lebih canggih)
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
