// api.js: Mengurus komunikasi dengan AI (Gemini)

// PENTING: Untuk penggunaan nyata, jangan tampilkan API Key di kode frontend.
// Gunakan backend (server) untuk menyimpan dan menggunakan API Key dengan aman.
const API_KEY = "YOUR_GEMINI_API_KEY"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// Mock data jika tidak menggunakan API asli
const mockData = {
    choices: [
        { title: "Dasar-dasar Topik", description: "Fokus pada konsep fundamental dan definisi kunci." },
        { title: "Analisis Mendalam Topik", description: "Membahas dampak, hubungan sebab-akibat, dan relevansi." }
    ],
    deck: {
        summary: "Ini adalah ringkasan singkat yang dibuat oleh AI.",
        flashcards: [
            { term: "Istilah 1", definition: "Definisi untuk istilah pertama.", question: "Apa definisi untuk ____?" },
            { term: "Istilah 2", definition: "Definisi untuk istilah kedua.", question: "Apa definisi untuk ____?" }
        ]
    }
};

async function callApi(payload) {
    // Untuk mode demo, gunakan mock data
    console.warn("Menggunakan MOCK DATA. Ganti dengan panggilan API asli di api.js");
    if (payload.contents[0].parts[0].text.includes("Pilih Arah Topik")) {
        await new Promise(res => setTimeout(res, 1000));
        return { candidates: [{ content: { parts: [{ text: JSON.stringify({ choices: mockData.choices }) }] } }] };
    } else {
        await new Promise(res => setTimeout(res, 1500));
        return { candidates: [{ content: { parts: [{ text: JSON.stringify(mockData.deck) }] } }] };
    }
    
    /*
    // Kode untuk API sungguhan (gunakan jika sudah ada API Key)
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
    }
    return response.json();
    */
}

export async function getChoices(topic) {
    const prompt = `Berikan 2 pilihan arah topik untuk "${topic}": 1. Dasar-dasar dan 2. Analisis Mendalam. Format dalam JSON: {"choices": [{"title": "...", "description": "..."}]}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] }; // Sederhanakan payload
    const result = await callApi(payload);
    return JSON.parse(result.candidates[0].content.parts[0].text);
}

export async function getDeck(sourceMaterial, difficulty, mode) {
    const sourceInstruction = mode === 'topic' ? `topik "${sourceMaterial}"` : `teks berikut: "${sourceMaterial.substring(0, 200)}..."`;
    const prompt = `Buatkan materi belajar dari ${sourceInstruction} tingkat ${difficulty} dalam JSON (summary dan 5 flashcards).`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] }; // Sederhanakan payload
    const result = await callApi(payload);
    return JSON.parse(result.candidates[0].content.parts[0].text);
}
