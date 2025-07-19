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
// Ini adalah satu-satunya cara yang diizinkan untuk memodifikasi objek 'state'.
// Menggunakan pola immutable untuk keamanan dan prediktabilitas.
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
        };
    },

    // --- Actions untuk Data Pengguna ---
    saveCardToDeck(cardData) {
        const topicKey = state.quiz.topic || "Tanpa Topik";
        const oldDeck = state.userData.savedDecks[topicKey] || [];
        
        // Mencegah duplikasi kartu di dalam deck
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
        this.saveUserDataToStorage(); // Simpan ke localStorage
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
// Fungsi ini dipanggil sekali saat aplikasi pertama kali dimuat.
// =====================================================================
export function init() {
    // Muat pengaturan yang tersimpan
    const savedSettings = localStorage.getItem('senkuAppSettings');
    if (savedSettings) {
        Object.assign(state.settings, JSON.parse(savedSettings));
    }

    // Muat data pengguna yang tersimpan
    const savedUserData = localStorage.getItem('senkuAppUserData');
    if (savedUserData) {
        Object.assign(state.userData, JSON.parse(savedUserData));
    }

    // Terapkan tema yang tersimpan (atau default) ke DOM
    if (state.settings.theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
        document.body.dataset.theme = state.settings.theme;
    }

    console.log("State berhasil diinisialisasi.", state);
}
