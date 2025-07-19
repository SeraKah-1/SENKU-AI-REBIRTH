/**
 * main.js: Otak & Sutradara Aplikasi (Controller)
 * * Mengatur alur aplikasi, menghubungkan semua modul, dan menangani logika utama.
 * * Bertanggung jawab atas 'kapan' sesuatu terjadi, sementara modul lain
 * bertanggung jawab atas 'bagaimana' sesuatu dilakukan.
 */

// =====================================================================
// IMPOR SEMUA MODUL YANG DIBUTUHKAN
// =====================================================================
// Ganti path ini dengan path file modulmu yang sebenarnya jika berbeda
// Di awal main.js
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
        IDLE: { SUBMIT: 'LOADING_CHOICES' },
        LOADING_CHOICES: { SUCCESS: 'CHOOSING', FAIL: 'IDLE' },
        CHOOSING: { CONFIRM: 'LOADING_DECK' },
        LOADING_DECK: { SUCCESS: 'MEMORIZING', FAIL: 'IDLE' }, // Kembali ke IDLE jika gagal
        MEMORIZING: { START_TEST: 'TESTING' },
        TESTING: { COMPLETE: 'RESULTS' },
        RESULTS: { RESTART: 'IDLE' }
    },
    
    /**
     * Pindah ke status berikutnya.
     * @param {string} action - Aksi yang memicu transisi (e.g., 'SUBMIT', 'SUCCESS').
     */
    async transition(action) {
        const nextState = this.transitions[this.currentState]?.[action];
        if (nextState) {
            console.log(`State Transition: ${this.currentState} -> ${nextState}`);
            this.currentState = nextState;
            await this.runStateLogic(); // Jalankan logika untuk state baru
        } else {
            console.error(`Transisi tidak valid dari ${this.currentState} dengan aksi ${action}`);
        }
    },
    
    // Menjalankan logika berdasarkan state saat ini
    async runStateLogic() {
        switch(this.currentState) {
            case 'IDLE':
                ui.showScreen('start');
                setupStartScreenListeners();
                break;
            case 'LOADING_CHOICES':
                ui.showScreen('loading', 'Mencari pilihan topik...');
                await handleAsync(async () => {
                    const choiceData = await api.getChoices(state.topic);
                    await this.transition('SUCCESS');
                    ui.showScreen('choice', choiceData.choices);
                    setupChoiceScreenListeners();
                }, { fallbackState: 'IDLE' });
                break;
            case 'LOADING_DECK':
                ui.showScreen('loading', 'Membuat materi belajar...');
                 await handleAsync(async () => {
                    const source = state.currentMode === 'topic' ? state.topic : state.sourceText;
                    state.generatedData = await api.getDeck(source, state.difficulty, state.currentMode);
                    await this.transition('SUCCESS');
                }, { fallbackState: 'IDLE' });
                break;
            case 'MEMORIZING':
                // Logika untuk memulai fase hafalan akan ada di sini
                console.log("Memulai fase hafalan...");
                // ui.showScreen('memorize', state.generatedData);
                // setupMemorizeScreenListeners();
                break;
            case 'RESULTS':
                ui.showScreen('results', state.score, state.generatedData.flashcards.length);
                ui.triggerConfetti();
                document.getElementById('restart-btn').onclick = () => this.transition('RESTART');
                break;
        }
    }
};

// =====================================================================
// PENGELOLA EVENT LISTENERS
// =====================================================================

// Objek untuk menyimpan referensi listener agar bisa dihapus
let activeListeners = [];

/**
 * Fungsi utilitas untuk menambah event listener dan menyimpannya.
 * @param {HTMLElement} element - Elemen target.
 * @param {string} event - Nama event (e.g., 'click').
 * @param {Function} handler - Fungsi handler.
 */
function addListener(element, event, handler) {
    if (element) {
        element.addEventListener(event, handler);
        activeListeners.push({ element, event, handler });
    }
}

/**
 * Menghapus semua event listener yang aktif.
 */
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
            state.difficulty = btn.dataset.difficulty;
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
            state.topic = selectedChoice;
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

/**
 * Menangani submit dari form awal.
 * @param {Event} event - Event submit.
 */
async function handleStart(event) {
    event.preventDefault();
    if (state.currentMode === 'topic') {
        state.topic = document.getElementById('topic-input').value;
        await learningFlow.transition('SUBMIT');
    } else { // mode 'file'
        if (!state.sourceText) {
            ui.showNotification('Mohon pilih dan tunggu file selesai diproses.', 'error');
            return;
        }
        await learningFlow.transition('CONFIRM'); // Langsung ke loading deck
    }
}

/**
 * Mengganti mode aplikasi antara 'topic' dan 'file'.
 * @param {'topic'|'file'} mode - Mode yang dipilih.
 */
function switchMode(mode) {
    state.currentMode = mode;
    document.getElementById('mode-topic-btn').classList.toggle('selected', mode === 'topic');
    document.getElementById('mode-file-btn').classList.toggle('selected', mode === 'file');
    document.getElementById('topic-input-container').classList.toggle('hidden', mode !== 'topic');
    document.getElementById('file-input-container').classList.toggle('hidden', mode !== 'file');
}

/**
 * Callback untuk modul fileHandler.
 * @param {object} result - Hasil dari pemrosesan file.
 */
function handleFileProcessed(result) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (!fileNameDisplay) return;

    if (result.status === 'processing') {
        fileNameDisplay.textContent = `Memproses: ${result.name}...`;
    } else if (result.status === 'ready') {
        state.sourceText = result.text;
        state.topic = result.name; // Gunakan nama file sebagai topik sementara
        fileNameDisplay.textContent = `Siap: ${result.name}`;
        ui.showNotification('File berhasil dibaca!', 'success');
    } else if (result.status === 'error') {
        ui.showNotification(`Gagal memproses file: ${result.message}`, 'error');
        fileNameDisplay.textContent = '';
    }
}

/**
 * Fungsi pembungkus untuk menangani operasi async dengan error handling terpusat.
 * @param {Function} asyncOperation - Fungsi async yang ingin dijalankan.
 * @param {object} [options] - Opsi, termasuk state fallback jika gagal.
 */
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
    addListener(document.getElementById('settings-btn'), 'click', () => ui.showModal('settings'));
    addListener(document.getElementById('view-deck-btn'), 'click', () => window.location.hash = '/deck');
}

function handleRouteChange() {
    const hash = window.location.hash || '#/';
    cleanupListeners();

    switch(hash) {
        case '#/deck':
            // ui.showScreen('deck');
            // deck.displayDeck();
            // addListener(document.getElementById('close-deck-btn'), 'click', () => window.history.back());
            break;
        // Rute lain bisa ditambahkan di sini
        default:
            if (learningFlow.currentState === 'IDLE') {
                ui.showScreen('start');
                setupStartScreenListeners();
            }
            break;
    }
}

// =====================================================================
// INISIALISASI APLIKASI
// =====================================================================
function init() {
    // Dengarkan perubahan hash untuk router
    window.addEventListener('hashchange', handleRouteChange);
    
    // Tampilkan layar awal berdasarkan state machine
    learningFlow.runStateLogic();

    // Siapkan listener global yang selalu ada
    // setupGlobalListeners(); // Aktifkan jika sudah ada modal dan deck screen di ui.js

    console.log("Aplikasi Berotak Senku berhasil dimuat!");
}

// Jalankan aplikasi setelah semua konten HTML dimuat
document.addEventListener('DOMContentLoaded', init);
