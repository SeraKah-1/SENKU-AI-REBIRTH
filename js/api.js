/**
 * =====================================================================
 * File: js/api.js (VERSI DUAL-MODE)
 * =====================================================================
 *
 * api.js: Lapisan Interaksi AI
 * * Bisa berkomunikasi via proxy Netlify (default, aman).
 * * ATAU langsung ke Google jika pengguna menyediakan API Key di pengaturan.
 * * Ini memungkinkan debugging yang mudah jika proxy bermasalah.
 */

// Impor 'state' untuk bisa mengakses API Key yang disimpan pengguna.
import { state } from './state.js';

// =====================================================================
// KONFIGURASI & KONSTANTA
// =====================================================================

const PROXY_URL = '/.netlify/functions/gemini-proxy';
const GOOGLE_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Cache sederhana untuk menyimpan respons API selama sesi berjalan.
const apiCache = new Map();

// =====================================================================
// FUNGSI INTI PEMANGGILAN API (INTERNAL)
// =====================================================================

/**
 * Fungsi internal yang tangguh untuk melakukan panggilan fetch.
 * Secara dinamis memilih antara proxy atau panggilan langsung berdasarkan state.
 * @param {object} payload - Objek payload lengkap yang akan dikirim.
 * @returns {Promise<object>} Objek JSON yang sudah diparsing dari respons AI.
 * @throws {Error} Melemparkan error jika panggilan gagal atau respons tidak valid.
 */
async function safeFetch(payload) {
    let targetUrl;
    let options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    // Cek apakah pengguna memasukkan API Key di pengaturan.
    if (state.settings.apiKey && state.settings.apiKey.trim() !== '') {
        // Jika ADA, gunakan mode panggilan langsung ke Google.
        console.warn("MODE DEBUG: Menggunakan API Key dari pengguna (Panggilan Langsung).");
        targetUrl = `${GOOGLE_API_URL_BASE}?key=${state.settings.apiKey}`;
    } else {
        // Jika TIDAK ADA, gunakan mode standar yang aman via proxy.
        console.log("MODE STANDAR: Menggunakan proxy Netlify.");
        targetUrl = PROXY_URL;
    }

    try {
        const response = await fetch(targetUrl, options);

        if (!response.ok) {
            const errorBody = await response.json().catch(() => null);
            const errorMessage = errorBody?.error?.message || `HTTP error! Status: ${response.status}`;
            throw new Error(errorMessage);
        }
        
        const result = await response.json();

        if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content) {
            throw new Error("API tidak memberikan respons kandidat yang valid.");
        }

        return JSON.parse(result.candidates[0].content.parts[0].text);

    } catch (error) {
        console.error("Kesalahan pada Panggilan API Inti:", error);
        throw error; 
    }
}

/**
 * Membungkus panggilan API dengan lapisan caching.
 * @param {string} cacheKey - Kunci unik untuk menyimpan/mengambil hasil dari cache.
 * @param {object} payload - Payload untuk dikirim jika data tidak ada di cache.
 * @returns {Promise<object>} Hasil dari cache atau dari panggilan API baru.
 */
async function callApiWithCache(cacheKey, payload) {
    if (apiCache.has(cacheKey)) {
        console.log(`Mengambil hasil dari cache untuk kunci: "${cacheKey}"`);
        return apiCache.get(cacheKey);
    }

    console.log(`Cache miss untuk kunci: "${cacheKey}". Melakukan panggilan API baru.`);
    const result = await safeFetch(payload);

    apiCache.set(cacheKey, result);
    return result;
}


// =====================================================================
// FUNGSI PUBLIK YANG DI-EKSPOR (TIDAK ADA PERUBAHAN DI SINI)
// Semua fungsi di bawah ini akan secara otomatis menggunakan safeFetch yang baru.
// =====================================================================

/**
 * Meminta 2 pilihan arah topik dari AI berdasarkan topik yang diberikan pengguna.
 * @param {string} topic - Topik yang dimasukkan oleh pengguna.
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
 * Meminta AI untuk membuat paket materi belajar (ringkasan dan flashcards).
 * @param {string} sourceMaterial - Bisa berupa topik atau teks panjang dari file.
 * @param {'Mudah'|'Menengah'|'Sulit'} difficulty - Tingkat kesulitan materi.
 * @param {'topic'|'file'} mode - Mode input.
 * @returns {Promise<object>} Objek dengan properti 'summary' dan 'flashcards'.
 */
export async function getDeck(sourceMaterial, difficulty, mode) {
    const cacheKey = `deck-${difficulty}-${mode}-${sourceMaterial.substring(0, 100)}`;
    const sourceInstruction = mode === 'topic' ? `topik "${sourceMaterial}"` : `teks berikut: "${sourceMaterial.substring(0, 500)}..."`;
    const prompt = `Kamu adalah asisten belajar ahli. Buatkan paket materi dari ${sourceInstruction} dengan tingkat kesulitan "${difficulty}". Paket harus berisi ringkasan (summary) dan 5 buah flashcard. Setiap flashcard berisi istilah (term), definisi lengkap (definition), dan pertanyaan isian (question) di mana istilah diganti dengan '____'.`;
    const schema = {
        type: "OBJECT",
        properties: { "summary": { type: "STRING" }, "flashcards": { type: "ARRAY", items: { type: "OBJECT", properties: { "term": { type: "STRING" }, "definition": { type: "STRING" }, "question": { type: "STRING" } }, required: ["term", "definition", "question"] } } },
        required: ["summary", "flashcards"]
    };
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    };
    return callApiWithCache(cacheKey, payload);
}
