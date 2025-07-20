/**
 * main.js: Otak & Sutradara Aplikasi (Controller)
 * * VERSI DIPERBAIKI: Mengaktifkan semua fitur, melengkapi alur kuis,
 * dan menambahkan navigasi.
 * * Mengatur alur aplikasi, menghubungkan semua modul, dan menangani logika utama.
 */

// =====================================================================
// IMPOR SEMUA MODUL YANG DIBUTUHKAN
// =====================================================================
import { state, actions, init as initState } from './state.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as deck from './deck.js';
import { setupFileHandling } from './fileHandler.js';

// =====================================================================
// STATE MACHINE UNTUK ALUR BELAJAR (DILENGKAPI)
// =====================================================================
const learningFlow = {
    currentState: 'IDLE',
    transitions: {
        IDLE: { SUBMIT_TOPIC: 'LOADING_CHOICES', SUBMIT_FILE: 'LOADING_DECK' },
        LOADING_CHOICES: { SUCCESS: 'CHOOSING', FAIL: 'IDLE' },
        CHOOSING: { CONFIRM: 'LOADING_DECK' },
        LOADING_DECK: { SUCCESS: 'MEMORIZING', FAIL: 'IDLE' },
        MEMORIZING: { START_TEST: 'TESTING' },
        TESTING: { COMPLETE: 'RESULTS' },
        RESULTS: { RESTART: 'IDLE' }
    },
    
    async transition(action) {
        const nextState = this.transitions[this.currentState]?.[action];
        if (nextState) {
            console.log(`State Transition: ${this.currentState} -> ${nextState}`);
            this.currentState = nextState;
            // Setiap transisi state akan membersihkan listener lama sebelum menjalankan logika baru
            cleanupListeners();
            await this.runStateLogic();
        } else {
            console.error(`Transisi tidak valid dari ${this.currentState} dengan aksi ${action}`);
        }
    },
    
    async runStateLogic() {
        switch(this.currentState) {
            case 'IDLE':
                actions.resetQuiz();
                ui.showScreen('start');
                setupStartScreenListeners();
                break;
            case 'LOADING_CHOICES':
                ui.showScreen('loading', 'Mencari pilihan topik...');
                await handleAsync(async () => {
                    const choiceData = await api.getChoices(state.quiz.topic);
                    ui.showScreen('choice', choiceData.choices);
                    setupChoiceScreenListeners();
                    await this.transition('SUCCESS'); // Transisi setelah UI siap
                }, { fallbackState: 'IDLE' });
                break;
            case 'LOADING_DECK':
                ui.showScreen('loading', 'Membuat materi belajar...');
                 await handleAsync(async () => {
                    const source = state.session.currentMode === 'topic' ? state.quiz.topic : state.quiz.sourceText;
                    const generatedData = await api.getDeck(source, state.quiz.difficulty, state.session.currentMode);
                    actions.setGeneratedData(generatedData);
                    await this.transition('SUCCESS');
                }, { fallbackState: 'IDLE' });
                break;
            case 'MEMORIZING':
                // PERBAIKAN: Menampilkan layar hafalan yang sesungguhnya
                ui.showScreen('memorize', state.quiz.generatedData);
                setupMemorizeScreenListeners();
                break;
            case 'TESTING':
                // PERBAIKAN: Menampilkan layar tes/kuis
                ui.showScreen('test', { 
                    card: state.quiz.generatedData.flashcards[state.quiz.currentCardIndex],
                    index: state.quiz.currentCardIndex,
                    total: state.quiz.generatedData.flashcards.length
                });
                setupTestScreenListeners();
                break;
            case 'RESULTS':
                ui.showScreen('results', {
                    score: state.quiz.score, 
                    total: state.quiz.generatedData.flashcards.length
                });
                ui.triggerConfetti();
                addListener(document.getElementById('restart-btn'), 'click', () => this.transition('RESTART'));
                break;
        }
    }
};

// =====================================================================
// PENGELOLA EVENT LISTENERS (TIDAK BERUBAH)
// =====================================================================
let activeListeners = [];

function addListener(element, event, handler) {
    if (element) {
        element.addEventListener(event, handler);
        activeListeners.push({ element, event, handler });
    }
}

function cleanupListeners() {
    activeListeners.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
    });
    activeListeners = [];
}

// =====================================================================
// KUMPULAN FUNGSI SETUP LISTENER UNTUK SETIAP LAYAR
// =====================================================================

function setupStartScreenListeners() {
    addListener(document.getElementById('start-form'), 'submit', handleStart);
    addListener(document.getElementById('mode-topic-btn'), 'click', () => switchMode('topic'));
    addListener(document.getElementById('mode-file-btn'), 'click', () => switchMode('file'));
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        addListener(btn, 'click', () => {
            const difficulty = btn.dataset.difficulty;
            actions.setQuizDetails(state.quiz.topic, difficulty);
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
    setupFileHandling(handleFileProcessed);
}

function setupChoiceScreenListeners() {
    let selectedChoice = null;
    const confirmBtn = document.getElementById('confirm-choice-btn');
    document.querySelectorAll('.choice-btn').forEach(btn => {
        addListener(btn, 'click', () => {
            selectedChoice = btn.dataset.choiceTitle;
            actions.setQuizDetails(selectedChoice, state.quiz.difficulty);
            document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (confirmBtn) confirmBtn.disabled = false;
        });
    });
    addListener(confirmBtn, 'click', () => {
        if (selectedChoice) {
            learningFlow.transition('CONFIRM');
        }
    });
}

// PERBAIKAN: Listener untuk layar hafalan
function setupMemorizeScreenListeners() {
    addListener(document.getElementById('start-test-btn'), 'click', () => {
        learningFlow.transition('START_TEST');
    });
}

// PERBAIKAN: Listener untuk layar tes/kuis
function setupTestScreenListeners() {
    const form = document.getElementById('test-form');
    const answerInput = document.getElementById('answer-input');
    const currentCard = state.quiz.generatedData.flashcards[state.quiz.currentCardIndex];

    addListener(form, 'submit', (e) => {
        e.preventDefault();
        const userAnswer = answerInput.value.trim();
        const isCorrect = userAnswer.toLowerCase() === currentCard.term.toLowerCase();
        
        if (isCorrect) {
            actions.incrementScore();
        }
        
        ui.showTestResult(isCorrect, currentCard.term);

        // Siapkan untuk pertanyaan berikutnya atau selesai
        const nextButton = document.getElementById('next-question-btn');
        if (nextButton) {
            nextButton.focus();
            addListener(nextButton, 'click', () => {
                actions.goToNextCard(); // Fungsi baru di state.js
                if (state.quiz.currentCardIndex >= state.quiz.generatedData.flashcards.length) {
                    learningFlow.transition('COMPLETE');
                } else {
                    learningFlow.transition('START_TEST'); // Kembali ke state 'TESTING' untuk render kartu baru
                }
            });
        }
    });
}

// =====================================================================
// HANDLER & ACTIONS
// =====================================================================
async function handleStart(event) {
    event.preventDefault();
    const difficulty = document.querySelector('.difficulty-btn.selected')?.dataset.difficulty || 'Mudah';

    if (state.session.currentMode === 'topic') {
        const topic = document.getElementById('topic-input').value;
        if (!topic) {
            ui.showNotification('Mohon masukkan topik terlebih dahulu.', 'error');
            return;
        }
        actions.setQuizDetails(topic, difficulty);
        await learningFlow.transition('SUBMIT_TOPIC');
    } else {
        if (!state.quiz.sourceText) {
            ui.showNotification('Mohon pilih dan tunggu file selesai diproses.', 'error');
            return;
        }
        actions.setQuizDetails(state.quiz.topic, difficulty);
        await learningFlow.transition('SUBMIT_FILE');
    }
}

function switchMode(mode) {
    actions.setMode(mode);
    ui.switchModeView(mode);
}

function handleFileProcessed(result) {
    if (result.status === 'processing') {
        actions.setLoading(true);
        ui.updateFileProcessingView(result);
    } else if (result.status === 'ready') {
        actions.setLoading(false);
        actions.setSourceText(result.content.text);
        actions.setQuizDetails(result.content.title, state.quiz.difficulty);
        ui.updateFileProcessingView(result); // Memperbarui UI dengan info file yang siap
        ui.showNotification('File berhasil dibaca!', 'success');
    } else if (result.status === 'error') {
        actions.setLoading(false);
        ui.updateFileProcessingView(result);
        ui.showNotification(`Gagal memproses file: ${result.message}`, 'error');
    }
}

async function handleAsync(asyncOperation, options = {}) {
    try {
        await asyncOperation();
    } catch (error) {
        console.error("Terjadi error:", error);
        ui.showNotification(options.errorMessage || `Terjadi kesalahan: ${error.message}`, 'error');
        if (options.fallbackState) {
            await learningFlow.transition('FAIL');
        }
    }
}

// =====================================================================
// PENGATURAN & ROUTER (NAVIGASI)
// =====================================================================
function setupGlobalListeners() {
    // PERBAIKAN: Mengaktifkan kembali listener untuk tombol pengaturan dan deck
    addListener(document.getElementById('settings-btn'), 'click', () => ui.toggleModal('settings-modal'));
    addListener(document.getElementById('view-deck-btn'), 'click', () => window.location.hash = 'deck');
}

// PERBAIKAN: Menambahkan router sederhana untuk navigasi halaman
function handleRouteChange() {
    cleanupListeners(); // Selalu bersihkan listener saat halaman berganti
    const hash = window.location.hash.substring(1); // Hapus tanda #

    switch(hash) {
        case 'deck':
            ui.showScreen('deck', { decks: state.userData.savedDecks });
            // Di sini kamu bisa menambahkan listener untuk halaman deck
            break;
        case '':
        case 'home':
        default:
            // Jika state bukan IDLE, jangan reset. Jika ya, mulai dari awal.
            if (learningFlow.currentState !== 'IDLE') {
                 learningFlow.currentState = 'IDLE'; // Paksa kembali ke IDLE
            }
            learningFlow.runStateLogic();
            break;
    }
}

// =====================================================================
// INISIALISASI APLIKASI
// =====================================================================
function init() {
    initState(); // Inisialisasi state dari localStorage
    ui.initUI(); // Inisialisasi elemen UI
    
    // PERBAIKAN: Menggunakan router untuk menentukan halaman awal
    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Panggil sekali saat load untuk menangani URL awal
    
    setupGlobalListeners(); // Siapkan listener global seperti header
    console.log("Aplikasi Berotak Senku berhasil dimuat!");
}

document.addEventListener('DOMContentLoaded', init);
