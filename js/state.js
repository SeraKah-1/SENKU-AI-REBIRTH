/**
 * state.js: Sumber Kebenaran Tunggal (Single Source of Truth)
 * * Menyimpan semua data dan status aplikasi di satu tempat yang terorganisir.
 * * Menyediakan 'actions' sebagai satu-satunya cara yang sah untuk mengubah state,
 * membuat alur data menjadi lebih terkontrol dan mudah di-debug.
 */

// =====================================================================
// OBJEK STATE UTAMA
// Dikelompokkan menjadi beberapa "slice" atau bagian yang logis.
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
        sourceText: '', // Menambahkan properti untuk menyimpan teks dari file
    },
    // State yang berhubungan dengan data pengguna yang disimpan
    userData: {
        savedDecks: {},
    },
    // State untuk pengaturan aplikasi
    settings: {
        theme: 'system', // 'light', 'dark', atau 'system'
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
        state.quiz = {
            ...state.quiz,
            topic: topic,
            difficulty: difficulty,
        };
    },
    
    /**
     * FIX: Menambahkan action yang hilang untuk menyimpan teks dari file.
     * Ini dipanggil oleh main.js setelah file berhasil diproses.
     */
    setSourceText(text) {
        state.quiz.sourceText = text;
    },

    setGeneratedData(data) {
        state.quiz.generatedData = data;
    },
    incrementScore() {
        state.quiz = {
            ...state.quiz,
            score: state.quiz.score + 1,
        };
    },
    resetQuiz() {
        state.quiz = {
            ...state.quiz,
            topic: '',
            generatedData: null,
            currentCardIndex: 0,
            score: 0,
            sourceText: '',
        };
    },

    // --- Actions untuk Data Pengguna ---
    saveCardToDeck(cardData) {
        const topicKey = state.quiz.topic || "Tanpa Topik";
        const oldDeck = state.userData.savedDecks[topicKey] || [];
        
        if (oldDeck.some(card => card.term === cardData.term)) {
            console.log("Kartu sudah ada di deck.");
            return;
        }

        state.userData = {
            ...state.userData,
            savedDecks: {
                ...state.userData.savedDecks,
                [topicKey]: [...oldDeck, cardData]
            }
        };
        this.saveUserDataToStorage();
    },
    clearAllDecks() {
        state.userData = {
            ...state.userData,
            savedDecks: {}
        };
        this.saveUserDataToStorage();
    },

    // --- Actions untuk Pengaturan ---
    setTheme(newTheme) {
        state.settings.theme = newTheme;
        document.body.dataset.theme = newTheme;
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

    if (state.settings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
        document.body.dataset.theme = state.settings.theme;
    }

    console.log("State berhasil diinisialisasi.", state);
}
