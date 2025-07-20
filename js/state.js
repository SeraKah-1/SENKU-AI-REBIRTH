/**
 * =====================================================================
 * File: js/state.js (VERSI FINAL - DIPERBAIKI & TERINTEGRASI)
 * =====================================================================
 *
 * state.js: Sumber Kebenaran Tunggal (Single Source of Truth)
 * * PERBAIKAN: Menambahkan actions untuk CRUD (Create, Read, Update, Delete)
 * pada dek dan kartu agar terintegrasi penuh dengan deck.js.
 * * PERBAIKAN: Menyesuaikan cara tema diterapkan agar cocok dengan file style.css.
 */

// =====================================================================
// OBJEK STATE UTAMA
// =====================================================================
export const state = {
    session: {
        currentMode: 'topic',
        isLoading: false,
    },
    quiz: {
        topic: '',
        difficulty: 'Mudah',
        generatedData: null,
        currentCardIndex: 0,
        score: 0,
        sourceText: '',
    },
    // Properti ini akan menampung semua dek kartu yang disimpan pengguna
    userData: {
        savedDecks: {}, // Contoh: { "Sejarah Majapahit": [ {card1}, {card2} ] }
    },
    settings: {
        theme: 'system',
        apiKey: '',
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
    goToNextCard() {
        state.quiz.currentCardIndex++;
    },
    resetQuiz() {
        state.quiz.topic = '';
        state.quiz.difficulty = document.querySelector('.difficulty-btn.selected')?.dataset.difficulty || 'Mudah';
        state.quiz.generatedData = null;
        state.quiz.currentCardIndex = 0;
        state.quiz.score = 0;
        state.quiz.sourceText = '';
    },

    // --- Actions untuk Pengaturan ---
    setTheme(newTheme) {
        state.settings.theme = newTheme;
        if (newTheme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.dataset.theme = prefersDark ? 'dark' : 'light';
        } else {
            document.body.dataset.theme = newTheme;
        }
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

    // --- ACTIONS BARU UNTUK MANAJEMEN DECK & KARTU (INTEGRASI DENGAN deck.js) ---

    /**
     * Menyimpan kartu baru ke dek. Jika dek belum ada, dek akan dibuat.
     * @param {object} card - Objek kartu lengkap dengan metadata SRS.
     * @param {string} deckName - Nama dek tujuan.
     */
    saveCardToDeck(card, deckName) {
        if (!state.userData.savedDecks[deckName]) {
            state.userData.savedDecks[deckName] = [];
        }
        state.userData.savedDecks[deckName].push(card);
        this.saveUserDataToStorage();
    },

    /**
     * Memperbarui satu kartu spesifik di dalam dek.
     * @param {string} deckName - Nama dek.
     * @param {number} cardIndex - Indeks kartu yang akan diperbarui.
     * @param {object} updatedCard - Objek kartu yang baru.
     */
    updateCardInDeck(deckName, cardIndex, updatedCard) {
        if (state.userData.savedDecks[deckName] && state.userData.savedDecks[deckName][cardIndex]) {
            state.userData.savedDecks[deckName][cardIndex] = updatedCard;
            this.saveUserDataToStorage();
        }
    },
    
    /**
     * Mengedit konten dari sebuah kartu di dalam dek.
     * @param {string} deckName - Nama dek.
     * @param {string} cardId - ID dari kartu yang akan diedit.
     * @param {object} newContent - Konten baru, cth: { newTerm, newDefinition }.
     */
    editCardInDeck(deckName, cardId, newContent) {
        if (state.userData.savedDecks[deckName]) {
            const cardIndex = state.userData.savedDecks[deckName].findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
                state.userData.savedDecks[deckName][cardIndex].term = newContent.newTerm;
                state.userData.savedDecks[deckName][cardIndex].definition = newContent.newDefinition;
                this.saveUserDataToStorage();
            }
        }
    },

    /**
     * Menghapus kartu dari dek berdasarkan ID-nya.
     * @param {string} deckName - Nama dek.
     * @param {string} cardId - ID kartu yang akan dihapus.
     */
    removeCardFromDeck(deckName, cardId) {
        if (state.userData.savedDecks[deckName]) {
            state.userData.savedDecks[deckName] = state.userData.savedDecks[deckName].filter(c => c.id !== cardId);
            this.saveUserDataToStorage();
        }
    },

    /**
     * Mengubah nama dek.
     * @param {string} oldName - Nama lama dek.
     * @param {string} newName - Nama baru dek.
     */
    renameDeckInState(oldName, newName) {
        if (state.userData.savedDecks[oldName] && !state.userData.savedDecks[newName]) {
            state.userData.savedDecks[newName] = state.userData.savedDecks[oldName];
            delete state.userData.savedDecks[oldName];
            this.saveUserDataToStorage();
        }
    },
    
    /**
     * Menghapus seluruh dek.
     * @param {string} deckName - Nama dek yang akan dihapus.
     */
    removeDeckFromState(deckName) {
        if (state.userData.savedDecks[deckName]) {
            delete state.userData.savedDecks[deckName];
            this.saveUserDataToStorage();
        }
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
    
    // Terapkan tema yang benar saat aplikasi pertama kali dimuat
    actions.setTheme(state.settings.theme);

    console.log("State berhasil diinisialisasi.", state);
}
