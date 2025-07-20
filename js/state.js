/**
 * state.js: Sumber Kebenaran Tunggal (Single Source of Truth)
 * * VERSI DIPERBAIKI: Menambahkan action baru untuk alur kuis dan memastikan
 * semua state di-reset dengan benar.
 * * Menyimpan semua data dan status aplikasi di satu tempat yang terorganisir.
 */

// =====================================================================
// OBJEK STATE UTAMA
// =====================================================================
export const state = {
    // State yang berhubungan dengan sesi dan UI saat ini
    session: {
        currentMode: 'topic',
        isLoading: false,
    },
    // State yang berhubungan dengan proses belajar/kuis
    quiz: {
        topic: '',
        difficulty: 'Mudah',
        generatedData: null,
        currentCardIndex: 0,
        score: 0,
        sourceText: '', // Menyimpan teks dari file
    },
    // State yang berhubungan dengan data pengguna yang disimpan
    userData: {
        savedDecks: {},
    },
    // State untuk pengaturan aplikasi
    settings: {
        theme: 'system', // 'light', 'dark', atau 'system'
        apiKey: '',      // Menyimpan API Key pengguna untuk debugging
    }
};

// =====================================================================
// ACTIONS: KUMPULAN FUNGSI UNTUK MENGUBAH STATE
// =====================================================================
export const actions = {
    // --- Actions untuk Sesi ---
    setLoading(isLoading) {
        state.session.isLoading = isLoading;
    },
    setMode(mode) {
        state.session.currentMode = mode;
    },

    // --- Actions untuk Kuis ---
    setQuizDetails(topic, difficulty) {
        state.quiz.topic = topic;
        state.quiz.difficulty = difficulty;
    },
    setSourceText(text) {
        state.quiz.sourceText = text;
    },
    setGeneratedData(data) {
        state.quiz.generatedData = data;
    },
    incrementScore() {
        state.quiz.score++;
    },
    // PERBAIKAN: Action baru untuk pindah ke kartu berikutnya
    goToNextCard() {
        state.quiz.currentCardIndex++;
    },
    resetQuiz() {
        // PERBAIKAN: Memastikan semua state kuis kembali ke nilai awal
        state.quiz.topic = '';
        state.quiz.difficulty = document.querySelector('.difficulty-btn.selected')?.dataset.difficulty || 'Mudah';
        state.quiz.generatedData = null;
        state.quiz.currentCardIndex = 0;
        state.quiz.score = 0;
        state.quiz.sourceText = '';
    },

    // --- Actions untuk Data Pengguna ---
    saveCardToDeck(cardData) {
        const topicKey = state.quiz.topic || "Tanpa Topik";
        const oldDeck = state.userData.savedDecks[topicKey] || [];
        
        if (oldDeck.some(card => card.term === cardData.term)) {
            console.log("Kartu sudah ada di deck.");
            return;
        }

        state.userData.savedDecks = {
            ...state.userData.savedDecks,
            [topicKey]: [...oldDeck, cardData]
        };
        this.saveUserDataToStorage();
    },
    clearAllDecks() {
        state.userData.savedDecks = {};
        this.saveUserDataToStorage();
    },

    // --- Actions untuk Pengaturan ---
    setTheme(newTheme) {
        state.settings.theme = newTheme;
        document.documentElement.dataset.theme = newTheme; // Mengubah tema di elemen html
        this.saveSettingsToStorage();
    },
    setApiKey(key) {
        state.settings.apiKey = key;
        this.saveSettingsToStorage();
    },

    // --- Actions untuk Interaksi dengan LocalStorage ---
    saveSettingsToStorage() {
        localStorage.setItem('senkuAppSettings', JSON.stringify(state.settings));
    },
    saveUserDataToStorage() {
        localStorage.setItem('senkuAppUserData', JSON.stringify(state.userData));
    },
};

// =====================================================================
// INISIALISASI STATE
// =====================================================================
export function init() {
    const savedSettings = localStorage.getItem('senkuAppSettings');
    if (savedSettings) {
        Object.assign(state.settings, JSON.parse(savedSettings));
    }

    const savedUserData = localStorage.getItem('senkuAppUserData');
    if (savedUserData) {
        Object.assign(state.userData, JSON.parse(savedUserData));
    }
    
    // Terapkan tema saat aplikasi dimuat
    if (state.settings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
        document.documentElement.dataset.theme = state.settings.theme;
    }

    console.log("State berhasil diinisialisasi.", state);
}
