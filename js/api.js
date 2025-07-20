/**
 * =====================================================================
 * File: js/api.js (VERSI LOKAL - DIPERBAIKI)
 * =====================================================================
 *
 * api.js: Lapisan Interaksi AI
 * * PERBAIKAN: Penanganan error yang lebih spesifik dan informatif.
 * * Tetap berjalan 100% lokal dan wajib menggunakan API Key dari pengguna.
 */

import { state } from './state.js';

// =====================================================================
// KONFIGURASI & KONSTANTA
// =====================================================================

const GOOGLE_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// =====================================================================
// FUNGSI INTI PEMANGGILAN API (INTERNAL)
// =====================================================================

/**
 * Fungsi internal yang tangguh untuk melakukan panggilan fetch.
 * @param {object} payload - Objek payload lengkap yang akan dikirim.
 * @returns {Promise<object>} Objek JSON yang sudah diparsing dari respons AI.
 * @throws {Error} Melemparkan error yang sudah diformat untuk ditampilkan di UI.
 */
async function safeFetch(payload) {
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

        // PERBAIKAN: Penanganan error yang lebih detail berdasarkan status HTTP
        if (!response.ok) {
            let errorMessage = `Terjadi kesalahan jaringan (Status: ${response.status}).`;
            try {
                const errorBody = await response.json();
                if (errorBody.error && errorBody.error.message) {
                    // Ambil pesan error dari Google jika ada
                    errorMessage = errorBody.error.message;
                    if (response.status === 400) {
                       errorMessage += " Pastikan API Key Anda valid dan aktif.";
                    }
                }
            } catch (e) {
                // Biarkan pesan error default jika respons tidak bisa di-parse
                console.error("Could not parse error response:", e);
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();

        if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content?.parts) {
            throw new Error("AI tidak memberikan respons yang valid. Coba lagi.");
        }

        // Mengambil teks dari AI dan mengubahnya menjadi objek JSON
        return JSON.parse(result.candidates[0].content.parts[0].text);

    } catch (error) {
        console.error("Kesalahan pada Panggilan API Inti:", error.message);
        // Teruskan error yang sudah diformat agar bisa ditampilkan di UI
        throw error; 
    }
}

// =====================================================================
// FUNGSI PUBLIK YANG DI-EKSPOR
// =====================================================================

/**
 * Meminta 2 pilihan arah topik dari AI.
 * @param {string} topic - Topik dari pengguna.
 * @returns {Promise<object>} Objek dengan properti 'choices'.
 */
export async function getChoices(topic) {
    const prompt = `Analisis topik "${topic}". Berikan 2 pilihan arah pembahasan yang menarik untuk dijadikan materi belajar. Satu untuk pemula, satu untuk tingkat lanjut.`;
    const schema = {
        type: "OBJECT",
        properties: { "choices": { type: "ARRAY", items: { type: "OBJECT", properties: { "title": { type: "STRING" }, "description": { type: "STRING" } }, required: ["title", "description"] } } },
        required: ["choices"]
    };
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    };
    return safeFetch(payload);
}

/**
 * Meminta AI membuat ringkasan dan flashcards.
 * @param {string} sourceMaterial - Topik atau teks dari file.
 * @param {'Mudah'|'Menengah'|'Sulit'} difficulty - Tingkat kesulitan.
 * @param {'topic'|'file'} mode - Mode input.
 * @returns {Promise<object>} Objek dengan 'summary' dan 'flashcards'.
 */
export async function getDeck(sourceMaterial, difficulty, mode) {
    const sourceInstruction = mode === 'topic' ? `topik "${sourceMaterial}"` : `teks berikut: "${sourceMaterial.substring(0, 500)}..."`;
    const prompt = `Kamu adalah asisten belajar ahli. Buatkan paket materi dari ${sourceInstruction} dengan tingkat kesulitan "${difficulty}". Paket harus berisi: 1. Ringkasan (summary) dalam 3-5 kalimat. 2. Lima buah flashcard (flashcards). Setiap flashcard berisi istilah (term), definisi lengkap (definition), dan pertanyaan isian (question) di mana istilah diganti dengan '____'.`;
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
                        "definition": { type: "STRING" }, 
                        "question": { type: "STRING" } 
                    }, 
                    required: ["term", "definition", "question"] 
                } 
            } 
        },
        required: ["summary", "flashcards"]
    };
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    };
    return safeFetch(payload);
}
