/**
 * =======================================================================================
 * File: js/api.js (VERSI SUPERCHARGED - DENGAN PSIKOLOGI BELAJAR)
 * =======================================================================================
 *
 * api.js: Lapisan Interaksi AI yang Ditingkatkan Secara Pedagogis
 *
 * FITUR UTAMA VERSI INI:
 * 1.  **Prompt Engineering Lanjutan**: Setiap prompt dirancang dengan peran, konteks, dan tujuan
 * yang jelas, berdasarkan teknik-teknik psikologi kognitif untuk memaksimalkan retensi.
 * 2.  **Struktur Output yang Diperkaya**: Flashcard tidak lagi hanya "istilah" dan "definisi",
 * tetapi mencakup analogi, contoh nyata, dan pertanyaan pemicu pemikiran kritis.
 * 3.  **Tingkat Kesulitan Bermakna**: Tingkat kesulitan kini memengaruhi *jenis* pertanyaan
 * (dari faktual hingga analitis), bukan hanya kedalaman materi.
 * 4.  **Penanganan Error Detail**: Fungsi `safeFetch` ditingkatkan untuk memberikan feedback
 * error yang lebih spesifik dan membantu kepada pengguna.
 * 5.  **Ekstensibilitas**: Kode ini dirancang agar mudah diperluas dengan fungsi-fungsi baru
 * di masa depan.
 *
 * =======================================================================================
 */

import { state } from './state.js';

// =====================================================================
// KONFIGURASI & KONSTANTA
// =====================================================================

const GOOGLE_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// =====================================================================
// FUNGSI INTI PEMANGGILAN API (INTERNAL) - LEBIH TANGGUH
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

        // Pengecekan respons yang lebih mendalam
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

        // Parsing JSON dari respons AI dengan penanganan error sendiri
        try {
            return JSON.parse(result.candidates[0].content.parts[0].text);
        } catch (e) {
            console.error(`[${functionName}] Failed to parse JSON from AI response:`, result.candidates[0].content.parts[0].text);
            throw new Error(`Error pada [${functionName}]: AI memberikan format data yang tidak terduga. Gagal mem-parsing respons JSON.`);
        }

    } catch (error) {
        // Teruskan error yang sudah diformat atau error jaringan lainnya
        console.error(`Kesalahan fundamental pada Panggilan API di [${functionName}]:`, error);
        throw error;
    }
}

// =====================================================================
// FUNGSI PUBLIK YANG DI-EKSPOR (DENGAN PROMPT YANG DISEMPURNAKAN)
// =====================================================================

/**
 * (IMPROVED) Meminta 2 pilihan arah topik dari AI, fokus pada tujuan belajar yang jelas.
 * @param {string} topic - Topik dari pengguna.
 * @returns {Promise<object>} Objek dengan properti 'choices'.
 */
export async function getChoices(topic) {
    const prompt = `Anda adalah seorang Desainer Pembelajaran (Instructional Designer).
    Untuk topik utama: "${topic}", rancanglah 2 jalur belajar yang jelas dan menarik.
    Tujuan Anda adalah membantu pengguna memilih FOKUS belajar mereka.

    1.  **Jalur 1 (Konsep Fundamental)**: Rancang judul dan deskripsi untuk pemula. Fokus pada "APA" dan "MENGAPA" konsep itu penting. Gunakan bahasa yang sangat sederhana dan memotivasi.
    2.  **Jalur 2 (Aplikasi & Analisis)**: Rancang judul dan deskripsi untuk pelajar tingkat lanjut. Fokus pada "BAGAIMANA" konsep ini diterapkan atau dianalisis dalam sebuah skenario nyata. Tunjukkan manfaat praktisnya.

    Hindari jargon. Buat deskripsi singkat (1-2 kalimat) namun menggugah rasa ingin tahu.`;

    const schema = {
        type: "OBJECT",
        properties: {
            "choices": {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "title": { type: "STRING", description: "Judul jalur belajar yang menarik." },
                        "description": { type: "STRING", description: "Deskripsi singkat (1-2 kalimat) yang menjelaskan fokus jalur belajar." }
                    },
                    required: ["title", "description"]
                }
            }
        },
        required: ["choices"]
    };

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.7 }
    };
    return safeFetch(payload, 'getChoices');
}

/**
 * (UPGRADED) Meminta AI membuat ringkasan dan flashcards berdasarkan prinsip psikologi belajar.
 * Fungsi ini mengimplementasikan Elaborasi, Contoh Konkret, dan Active Recall.
 * @param {string} sourceMaterial - Topik atau teks dari file.
 * @param {'Mudah'|'Menengah'|'Sulit'} difficulty - Tingkat kesulitan yang memengaruhi jenis pertanyaan.
 * @param {'topic'|'file'} mode - Mode input.
 * @returns {Promise<object>} Objek dengan 'summary' dan 'flashcards' yang diperkaya.
 */
export async function getDeck(sourceMaterial, difficulty, mode) {
    const sourceInstruction = mode === 'topic' ? `topik "${sourceMaterial}"` : `teks berikut: "${sourceMaterial.substring(0, 3000)}"`;

    const difficultyInstruction = {
        'Mudah': 'Pertanyaan harus fokus pada definisi dan identifikasi (APA itu X?). Ini untuk menguji ingatan faktual.',
        'Menengah': 'Pertanyaan harus meminta penjelasan atau perbandingan (JELASKAN mengapa X terjadi? APA bedanya X dan Y?). Ini untuk menguji pemahaman konsep.',
        'Sulit': 'Pertanyaan harus berbasis skenario atau analisis (BAGAIMANA Anda akan menggunakan X untuk menyelesaikan masalah Y? APAKAH kelemahan dari X?). Ini untuk menguji kemampuan analisis dan aplikasi.'
    };

    const prompt = `Anda adalah seorang Tutor AI yang menerapkan **The Feynman Technique**.
    Tugas Anda adalah membuat paket belajar dari ${sourceInstruction}.
    Jelaskan semuanya dengan bahasa yang **sangat sederhana**, seolah-olah Anda sedang mengajar seorang siswa SMA yang cerdas namun belum tahu apa-apa tentang topik ini.

    Ikuti instruksi ini dengan SANGAT TELITI:

    1.  **Ringkasan (summary)**: Buat ringkasan (3-4 kalimat) menggunakan teknik **Elaborasi**. Hubungkan konsep utama dengan sebuah **analogi atau contoh di dunia nyata** yang mudah dipahami. Tujuannya adalah memberikan "cantolan" memori.

    2.  **Flashcards (flashcards)**: Buat TEPAT 5 flashcard. Setiap flashcard adalah sebuah "objek belajar" yang kaya dan HARUS berisi:
        * **term**: Satu istilah kunci atau konsep penting (maksimal 4 kata).
        * **simple_definition**: Definisi yang LUGAS, PADAT, dan **100% BEBAS JARGON**.
        * **analogy_or_example**: Sebuah analogi yang mudah diingat ATAU contoh penerapan nyata dari istilah tersebut. Ini WAJIB ada.
        * **active_recall_question**: Sebuah **pertanyaan terbuka** yang memaksa otak untuk berpikir, BUKAN pertanyaan isian '____'. Jenis pertanyaan harus sesuai dengan tingkat kesulitan "${difficulty}": ${difficultyInstruction[difficulty]}.
        * **question_clue**: Petunjuk satu kata untuk membantu jika pengguna kesulitan menjawab 'active_recall_question'.

    Pastikan hasil akhir adalah ringkasan dan 5 flashcard yang saling mendukung dan fokus pada informasi paling krusial.`;

    const schema = {
        type: "OBJECT",
        properties: {
            "summary": { type: "STRING" },
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
                },
                minItems: 5,
                maxItems: 5
            }
        },
        required: ["summary", "flashcards"]
    };

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.6 }
    };
    return safeFetch(payload, 'getDeck');
}
