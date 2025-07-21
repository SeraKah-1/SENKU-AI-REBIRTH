/**
 * =======================================================================================
 * File: js/api.js (VERSI FINAL & DIPERBAIKI)
 * =======================================================================================
 *
 * api.js: Lapisan Interaksi AI yang Ditingkatkan Secara Pedagogis
 *
 * * PERBAIKAN FINAL: Menghapus batasan `minItems` dan `maxItems` dari schema `getDeck`
 * untuk mengatasi error "too many states for serving" dari Google AI API. Tindakan ini
 * TIDAK menghilangkan fitur, hanya memperbaiki cara kita berkomunikasi dengan AI.
 *
 * =======================================================================================
 */

import { state } from './state.js';

// =====================================================================
// KONFIGURASI & KONSTANTA
// =====================================================================

const GOOGLE_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// =====================================================================
// FUNGSI INTI PEMANGGILAN API (INTERNAL) - TANGGUH & INFORMATIF
// =====================================================================

/**
 * Fungsi internal yang tangguh untuk melakukan panggilan fetch ke Google AI.
 * @param {object} payload - Objek payload lengkap yang akan dikirim.
 * @param {string} functionName - Nama fungsi pemanggil untuk logging error.
 * @returns {Promise<object>} Objek JSON yang sudah diparsing dari respons AI.
 * @throws {Error} Melemparkan error yang sudah diformat untuk ditampilkan di UI.
 */
async function safeFetch(payload, functionName = 'unknown') {
    if (!state.settings.apiKey || state.settings.apiKey.trim() === '') {
        throw new Error("API Key belum dimasukkan. Silakan isi di pojok kiri bawah.");
    }

    const targetUrl = `${GOOGLE_API_URL_BASE}?key=${state.settings.apiKey}`;
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    try {
        const response = await fetch(targetUrl, options);

        if (!response.ok) {
            let errorMessage = `Error pada [${functionName}]: Terjadi kesalahan jaringan (Status: ${response.status}).`;
            try {
                const errorBody = await response.json();
                if (errorBody.error && errorBody.error.message) {
                    errorMessage = `Error pada [${functionName}]: ${errorBody.error.message}`;
                    if (response.status === 400) {
                       errorMessage += " Periksa kembali apakah API Key Anda valid dan aktif.";
                    } else if (response.status === 429) {
                        errorMessage = "Batas permintaan API tercapai. Anda terlalu sering mengirim permintaan. Coba lagi beberapa saat.";
                    } else if (response.status === 500) {
                        errorMessage = "Terjadi masalah pada server Google AI. Coba lagi nanti.";
                    }
                }
            } catch (e) {
                console.error(`[${functionName}] Could not parse error response body for status ${response.status}:`, e);
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
            const finishReason = result.candidates?.[0]?.finishReason;
            let reasonText = "Alasan tidak diketahui.";
            switch(finishReason) {
                case 'SAFETY':
                    reasonText = "Respons diblokir karena kebijakan keamanan Google. Coba gunakan topik atau teks yang lebih umum.";
                    break;
                case 'RECITATION':
                     reasonText = "Respons diblokir karena mengutip sumber lain terlalu panjang. Coba topik yang berbeda.";
                     break;
                case 'MAX_TOKENS':
                    reasonText = "Input yang Anda berikan terlalu panjang untuk diproses model AI.";
                    break;
                default:
                    reasonText = `AI tidak memberikan respons teks karena alasan: ${finishReason || 'Tidak Diketahui'}.`;
            }
            throw new Error(`Error pada [${functionName}]: ${reasonText}`);
        }

        try {
            // Membersihkan JSON string dari karakter non-standar sebelum parsing
            const cleanedText = result.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanedText);
        } catch (e) {
            console.error(`[${functionName}] Failed to parse JSON from AI response:`, result.candidates[0].content.parts[0].text);
            throw new Error(`Error pada [${functionName}]: AI memberikan format data yang tidak terduga. Gagal mem-parsing respons JSON.`);
        }

    } catch (error) {
        console.error(`Kesalahan fundamental pada Panggilan API di [${functionName}]:`, error);
        throw error;
    }
}

// =====================================================================
// FUNGSI PUBLIK YANG DI-EKSPOR
// =====================================================================

/**
 * (UPGRADED) Meminta AI untuk memecah topik utama menjadi sub-topik konkret.
 * @param {string} topic - Topik utama dari pengguna.
 * @returns {Promise<object>} Objek dengan properti 'choices' yang berisi daftar sub-topik.
 */
export async function getChoices(topic) {
    const prompt = `Anda adalah seorang Pakar Kurikulum.
    Tugas Anda adalah memecah topik utama yang kompleks menjadi beberapa SUB-TOPIK INTI yang konkret dan dapat dipelajari.

    Topik Utama: "${topic}"

    Instruksi:
    1.  Identifikasi 4 hingga 5 sub-topik paling fundamental dan penting dari topik utama tersebut.
    2.  Pilihan yang Anda berikan HARUS berupa topik spesifik, BUKAN jalur belajar abstrak seperti "level pemula" atau "analisis mendalam".
    3.  Untuk setiap sub-topik, berikan judul (nama sub-topik itu sendiri) dan deskripsi singkat (1 kalimat) yang menjelaskan fokusnya.

    Contoh:
    - Jika Topik Utama adalah "Sejarah Indonesia", maka hasilnya bisa: "Masa Kerajaan Hindu-Buddha", "Masa Kesultanan Islam", "Era Kolonialisme", "Orde Lama & Orde Baru".
    - Jika Topik Utama adalah "Pemrograman Web", maka hasilnya bisa: "HTML: Struktur Dasar", "CSS: Styling & Layout", "JavaScript: Interaktivitas", "Backend & Database".`;

    const schema = {
        type: "OBJECT",
        properties: {
            "choices": {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "title": { type: "STRING", description: "Nama sub-topik yang spesifik dan jelas." },
                        "description": { type: "STRING", description: "Deskripsi 1 kalimat yang ringkas tentang sub-topik." }
                    },
                    required: ["title", "description"]
                }
            }
        },
        required: ["choices"]
    };

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.5 }
    };
    return safeFetch(payload, 'getChoices');
}

/**
 * (SUPERCHARGED) Meminta AI membuat ringkasan dan flashcards yang mendalam.
 * Fungsi ini memaksa AI untuk mengidentifikasi sub-topik sebelum membuat kartu.
 * @param {string} sourceMaterial - Topik atau teks dari file.
 * @param {'Mudah'|'Menengah'|'Sulit'} difficulty - Tingkat kesulitan.
 * @param {'topic'|'file'} mode - Mode input.
 * @param {number} cardCount - Jumlah kartu yang diinginkan pengguna.
 * @returns {Promise<object>} Objek dengan 'summary' dan 'flashcards' yang diperkaya.
 */
export async function getDeck(sourceMaterial, difficulty, mode, cardCount = 10) {
    const sourceInstruction = mode === 'topic' ? `topik "${sourceMaterial}"` : `teks berikut: "${sourceMaterial.substring(0, 4000)}"`;

    const difficultyInstruction = {
        'Mudah': 'Fokus pada definisi dasar (APA itu X?), identifikasi komponen utama, dan fakta-fakta kunci.',
        'Menengah': 'Fokus pada proses (BAGAIMANA X bekerja?), fungsi (UNTUK APA X?), dan hubungan sebab-akibat (MENGAPA X menyebabkan Y?).',
        'Sulit': 'Fokus pada analisis komparatif (APA perbedaan X dan Y?), aplikasi dalam skenario, dan implikasi atau konsekuensi (APA dampaknya jika X tidak ada?).'
    };

    const prompt = `Anda adalah seorang Pakar Materi Pelajaran yang bertugas memecah topik kompleks menjadi bagian-bagian yang mudah dipelajari.

    TUGAS ANDA:
    Buat paket belajar dari ${sourceInstruction} dengan target ${cardCount} kartu belajar.

    PROSES BERPIKIR ANDA (WAJIB DIIKUTI):
    1.  **Analisis Topik**: Pertama, identifikasi ${cardCount} sub-topik atau konsep paling PENTING dan SPESIFIK dari materi sumber. Jangan hanya mengambil judul umum. Contoh: Jika topik utama "Sistem Pernapasan", sub-topik bisa "Alveolus", "Proses Pertukaran Gas", "Diafragma", bukan hanya "Paru-paru".
    2.  **Pembuatan Kartu**: Untuk setiap sub-topik yang telah Anda identifikasi, buat satu flashcard.
    3.  **Penyesuaian Kedalaman**: Isi setiap flashcard sesuai dengan tingkat kesulitan "${difficulty}": ${difficultyInstruction[difficulty]}.
    4.  **Variasi Pertanyaan**: Pastikan setiap \`active_recall_question\` yang Anda buat menguji konsep dari sudut pandang yang berbeda. Hindari membuat pertanyaan dengan pola yang monoton. Gunakan kata tanya yang beragam (Contoh: Mengapa X terjadi?, Bagaimana Y bekerja?, Apa dampak dari Z?, Bandingkan A dan B?).

    STRUKTUR OUTPUT JSON:
    Sediakan ringkasan singkat terlebih dahulu, lalu buat flashcards. Setiap flashcard HARUS berisi:
    - **term**: Nama sub-topik atau konsep spesifik yang Anda identifikasi.
    - **simple_definition**: Penjelasan yang LUGAS, PADAT, dan 100% BEBAS JARGON tentang 'term' tersebut.
    - **analogy_or_example**: Analogi yang relevan atau contoh nyata untuk membuat konsep mudah diingat.
    - **active_recall_question**: Pertanyaan terbuka yang memicu pemikiran kritis sesuai tingkat kesulitan yang diminta.
    - **question_clue**: Petunjuk satu kata untuk pertanyaan tersebut.`;

    const schema = {
        type: "OBJECT",
        properties: {
            "summary": { type: "STRING", description: "Ringkasan singkat dan menarik tentang topik utama." },
            "flashcards": {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "term": { type: "STRING" },
                        "simple_definition": { type: "STRING" },
                        "analogy_or_example": { type: "STRING" },
                        "active_recall_question": { type: "STRING" },
                        "question_clue": { type: "STRING" }
                    },
                    required: ["term", "simple_definition", "analogy_or_example", "active_recall_question", "question_clue"]
                }
                // PERBAIKAN FINAL: Menghapus baris 'minItems' dan 'maxItems' dari sini.
                // Kedua baris ini adalah PENYEBAB error
