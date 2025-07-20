/**
 * =====================================================================
 * File: js/state.js (VERSI DIPERBAIKI)
 * =====================================================================
 *
 * state.js: Sumber Kebenaran Tunggal (Single Source of Truth)
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
    userData: {
        savedDecks: {},
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
        
        // PERBAIKAN KRUSIAL: Mengubah tema pada 'document.body' agar sesuai dengan style.css
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
```

**Langkah Selanjutnya:**

1.  Ganti isi file `js/state.js` di proyekmu dengan kode di atas.
2.  Tidak perlu mengubah file `index.html` atau `main.js` lagi, karena keduanya sudah benar.
3.  Sekarang, coba jalankan kembali aplikasinya. Pilih tema "Gelap" dan tekan "Apply". Halaman web-mu seharusnya akan langsung berubah menjadi gelap, dan notifikasi sukses akan munc
