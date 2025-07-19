/**
 * =====================================================================
 * File: js/api.js (VERSI AMAN)
 * =====================================================================
 *
 * api.js: Lapisan Interaksi AI
 * * Sekarang berkomunikasi dengan backend proxy, BUKAN langsung ke Google.
 * * TIDAK ADA LAGI API KEY DI SINI.
 */

// =====================================================================
// KONFIGURASI & KONSTANTA
// =====================================================================

// URL sekarang menunjuk ke backend proxy kita.
// Netlify secara otomatis akan membuat endpoint ini tersedia.
const PROXY_URL = '/.netlify/functions/gemini-proxy';

// Cache sederhana untuk menyimpan respons API selama sesi berjalan (menggunakan Map).
const apiCache = new Map();

// =====================================================================
// FUNGSI INTI PEMANGGILAN API (INTERNAL)
// =====================================================================

/**
 * Fungsi internal yang tangguh untuk melakukan panggilan fetch ke backend proxy kita.
 * @param {object} payload - Objek payload lengkap yang akan dikirim ke proxy.
 * @returns {Promise<object>} Objek JSON yang sudah diparsing dari respons AI.
 * @throws {Error} Melemparkan error jika panggilan gagal atau respons tidak valid.
 */
async function safeFetch(payload) {
    try {
        // Panggilan sekarang ditujukan ke PROXY_URL
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => null);
            const errorMessage = errorBody?.error || `HTTP error! Status: ${response.status}`;
            throw new Error(errorMessage);
        }
        
        const result = await response.json();

        if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content) {
            throw new Error("Proxy tidak memberikan respons kandidat yang valid.");
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

    console.log(`Cache miss untuk kunci: "${cacheKey}". Melakukan panggilan API baru via proxy.`);
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

/**
 * (Fitur Baru) Meminta AI untuk mengevaluasi jawaban pengguna secara cerdas.
 * @param {string} question - Pertanyaan yang diberikan.
 * @param {string} correctAnswer - Jawaban yang benar.
 * @param {string} userAnswer - Jawaban yang diberikan oleh pengguna.
 * @returns {Promise<object>} Objek dengan properti 'isCorrect' (boolean) dan 'feedback' (string).
 */
export async function evaluateAnswer(question, correctAnswer, userAnswer) {
    const prompt = `Seorang siswa diberi pertanyaan: "${question}". Jawaban yang benar adalah: "${correctAnswer}". Siswa tersebut menjawab: "${userAnswer}". Analisis jawaban siswa. Anggap benar jika jawaban sangat mirip, mengandung kata kunci utama, atau hanya typo ringan. Berikan evaluasi dalam format JSON. 'isCorrect' harus boolean. 'feedback' harus berupa string penjelasan singkat yang ramah (puji jika benar, koreksi dengan lembut jika salah).`;
    const schema = {
        type: "OBJECT",
        properties: { "isCorrect": { type: "BOOLEAN" }, "feedback": { type: "STRING" } },
        required: ["isCorrect", "feedback"]
    };
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema }
    };
    return safeFetch(payload);
}
// FIX: Menghapus kurung kurawal tutup '}' yang berlebih di akhir file.
