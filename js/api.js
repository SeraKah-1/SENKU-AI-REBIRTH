/**
 * =======================================================================================
 * File: js/api.js (VERSI FINAL & DIPERBAIKI)
 * =======================================================================================
 *
 * api.js: Lapisan Interaksi AI yang Ditingkatkan Secara Pedagogis
 * * PERBAIKAN: Menghapus batasan `minItems` dan `maxItems` dari schema `getDeck`
 * untuk mengatasi error "too many states for serving" dari Google AI API.
 *
 * =======================================================================================
 */

import { state } from './state.js';

const GOOGLE_API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

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
                }
            } catch (e) {
                // Biarkan pesan error default jika body tidak bisa diparsing
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
            const finishReason = result.candidates?.[0]?.finishReason || 'Tidak diketahui';
            let reasonText = `AI tidak memberikan respons karena alasan: ${finishReason}.`;
            if (finishReason === 'SAFETY') {
                reasonText = "Respons diblokir karena kebijakan keamanan. Coba topik yang lebih umum.";
            }
            throw new Error(`Error pada [${functionName}]: ${reasonText}`);
        }

        try {
            const cleanedText = result.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanedText);
        } catch (e) {
            console.error(`[${functionName}] Gagal mem-parsing JSON dari AI:`, result.candidates[0].content.parts[0].text);
            throw new Error(`Error pada [${functionName}]: AI memberikan format data yang tidak valid.`);
        }

    } catch (error) {
        console.error(`Kesalahan fundamental pada API di [${functionName}]:`, error);
        throw error;
    }
}

export async function getChoices(topic) {
    const prompt = `Anda adalah Pakar Kurikulum. Pecah topik utama "${topic}" menjadi 4-5 sub-topik inti yang konkret. Untuk setiap sub-topik, berikan judul dan deskripsi 1 kalimat.`;

    const schema = {
        type: "OBJECT",
        properties: { "choices": { type: "ARRAY", items: { type: "OBJECT", properties: { "title": { type: "STRING" }, "description": { type: "STRING" } }, required: ["title", "description"] } } },
        required: ["choices"]
    };

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.5 }
    };
    return safeFetch(payload, 'getChoices');
}

export async function getDeck(sourceMaterial, difficulty, mode, cardCount = 10) {
    const sourceInstruction = mode === 'topic' ? `topik "${sourceMaterial}"` : `teks berikut: "${sourceMaterial.substring(0, 4000)}"`;
    const difficultyInstruction = { 'Mudah': 'Fokus pada definisi dasar.', 'Menengah': 'Fokus pada proses dan hubungan sebab-akibat.', 'Sulit': 'Fokus pada analisis komparatif dan aplikasi.' };

    const prompt = `Anda adalah Pakar Materi. Buat paket belajar dari ${sourceInstruction} dengan target ${cardCount} kartu belajar.
PROSES: Identifikasi ${cardCount} konsep penting, lalu buat satu flashcard untuk setiap konsep sesuai tingkat kesulitan "${difficulty}": ${difficultyInstruction[difficulty]}. Pastikan pertanyaan bervariasi.
STRUKTUR JSON: Harus berisi 'summary' (string) dan 'flashcards' (array of objects). Setiap flashcard harus memiliki: term, simple_definition, analogy_or_example, active_recall_question, dan question_clue.`;

    const schema = {
        type: "OBJECT",
        properties: {
            "summary": { type: "STRING" },
            "flashcards": {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: { "term": { type: "STRING" }, "simple_definition": { type: "STRING" }, "analogy_or_example": { type: "STRING" }, "active_recall_question": { type: "STRING" }, "question_clue": { type: "STRING" } },
                    required: ["term", "simple_definition", "analogy_or_example", "active_recall_question", "question_clue"]
                }
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
