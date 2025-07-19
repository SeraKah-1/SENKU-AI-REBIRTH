/**
 * main.js: Otak & Sutradara Aplikasi (Controller)
 * * Mengatur alur aplikasi, menghubungkan semua modul, dan menangani logika utama.
 * * Bertanggung jawab atas 'kapan' sesuatu terjadi, sementara modul lain
 * bertanggung jawab atas 'bagaimana' sesuatu dilakukan.
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
// STATE MACHINE UNTUK ALUR BELAJAR
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
                    await this.transition('SUCCESS');
                    ui.showScreen('choice', choiceData.choices);
                    setupChoiceScreenListeners();
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
                console.log("Memulai fase hafalan...", state.quiz.generatedData);
                // Di sini kamu akan menambahkan logika untuk menampilkan layar hafalan
                // ui.showScreen('memorize', state.quiz.generatedData);
                // setupMemorizeScreenListeners();
                break;
            case 'RESULTS':
                ui.showScreen('results', state.quiz.score, state.quiz.generatedData.flashcards.length);
                ui.triggerConfetti();
                addListener(document.getElementById('restart-btn'), 'click', () => this.transition('RESTART'));
                break;
        }
    }
};

// =====================================================================
// PENGELOLA EVENT LISTENERS
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
        element.removeEventListener(event, handler);
    });
    activeListeners = [];
}

function setupStartScreenListeners() {
    cleanupListeners();
    addListener(document.getElementById('start-form'), 'submit', handleStart);
    addListener(document.getElementById('mode-topic-btn'), 'click', () => switchMode('topic'));
    addListener(document.getElementById('mode-file-btn'), 'click', () => switchMode('file'));
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        addListener(btn, 'click', () => {
            const difficulty = btn.dataset.difficulty;
            actions.setQuizDetails(state.quiz.topic, difficulty); // Update difficulty in state
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
    setupFileHandling(handleFileProcessed);
}

function setupChoiceScreenListeners() {
    cleanupListeners();
    let selectedChoice = null;
    document.querySelectorAll('.choice-btn').forEach(btn => {
        addListener(btn, 'click', () => {
            selectedChoice = btn.dataset.choiceTitle;
            actions.setQuizDetails(selectedChoice, state.quiz.difficulty); // Update topic in state
            document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('confirm-choice-btn').disabled = false;
        });
    });
    addListener(document.getElementById('confirm-choice-btn'), 'click', () => {
        if (selectedChoice) {
            learningFlow.transition('CONFIRM');
        }
    });
}


// =====================================================================
// HANDLER & ACTIONS
// =====================================================================
async function handleStart(event) {
    event.preventDefault();
    if (state.session.currentMode === 'topic') {
        const topic = document.getElementById('topic-input').value;
        if (!topic) {
            ui.showNotification('Mohon masukkan topik terlebih dahulu.', 'error');
            return;
        }
        actions.setQuizDetails(topic, state.quiz.difficulty);
        await learningFlow.transition('SUBMIT_TOPIC');
    } else { // mode 'file'
        if (!state.quiz.sourceText) { // Cek dari state
            ui.showNotification('Mohon pilih dan tunggu file selesai diproses.', 'error');
            return;
        }
        await learningFlow.transition('SUBMIT_FILE');
    }
}

function switchMode(mode) {
    actions.setMode(mode); // Gunakan action untuk mengubah state
    document.getElementById('mode-topic-btn').classList.toggle('selected', mode === 'topic');
    document.getElementById('mode-file-btn').classList.toggle('selected', mode === 'file');
    document.getElementById('topic-input-container').classList.toggle('hidden', mode !== 'topic');
    document.getElementById('file-input-container').classList.toggle('hidden', mode !== 'file');
}

/**
 * FIX: Callback untuk modul fileHandler, sekarang menggunakan objek 'content'
 */
function handleFileProcessed(result) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (!fileNameDisplay) return;

    if (result.status === 'processing') {
        fileNameDisplay.textContent = `Memproses: ${result.name}...`;
        actions.setLoading(true);
    } else if (result.status === 'ready') {
        // Menggunakan actions dari state.js untuk menyimpan data
        actions.setSourceText(result.content.text); // Action baru yang perlu ditambahkan di state.js
        actions.setQuizDetails(result.content.title, state.quiz.difficulty);
        
        fileNameDisplay.textContent = `Siap: ${result.content.metadata.fileName} (${result.content.metadata.wordCount} kata)`;
        actions.setLoading(false);
        ui.showNotification('File berhasil dibaca!', 'success');
    } else if (result.status === 'error') {
        actions.setLoading(false);
        ui.showNotification(`Gagal memproses file: ${result.message}`, 'error');
        fileNameDisplay.textContent = '';
    }
}

async function handleAsync(asyncOperation, options = {}) {
    try {
        await asyncOperation();
    } catch (error) {
        console.error("Terjadi error:", error);
        ui.showNotification(options.errorMessage || 'Terjadi kesalahan. Silakan coba lagi.', 'error');
        if (options.fallbackState) {
            learningFlow.currentState = options.fallbackState;
            await learningFlow.runStateLogic();
        }
    }
}

// =====================================================================
// PENGATURAN & ROUTER
// =====================================================================
function setupGlobalListeners() {
    // addListener(document.getElementById('settings-btn'), 'click', () => ui.showModal('settings'));
    // addListener(document.getElementById('view-deck-btn'), 'click', () => window.location.hash = '/deck');
}

function handleRouteChange() {
    const hash = window.location.hash || '#/';
    cleanupListeners();
    // ... logika router ...
}

// =====================================================================
// INISIALISASI APLIKASI
// =====================================================================
function init() {
    initState(); // Inisialisasi state dari localStorage
    window.addEventListener('hashchange', handleRouteChange);
    learningFlow.runStateLogic(); // Mulai aplikasi
    setupGlobalListeners();
    console.log("Aplikasi Berotak Senku berhasil dimuat!");
}

document.addEventListener('DOMContentLoaded', init);
