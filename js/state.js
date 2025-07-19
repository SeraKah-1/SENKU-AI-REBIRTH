// state.js: Pusat data dan status aplikasi

export const state = {
    currentMode: 'topic', // 'topic' or 'file'
    topic: '',
    difficulty: 'Mudah',
    generatedData: null,
    sourceText: '', // Untuk menyimpan teks dari file
    savedDecks: JSON.parse(localStorage.getItem('savedDecks')) || {},
    timers: {
        test: null,
        memorize: null,
    },
    currentCardIndex: 0,
    score: 0,
    lastActiveScreenId: 'start-screen',
};
