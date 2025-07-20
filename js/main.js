/**
 * main.js: Otak & Sutradara Aplikasi (Controller)
 * * VERSI FINAL - DIPERBAIKI: Memperbaiki bug tombol deck yang tidak merespons.
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
            cleanupListeners();
            // PERBAIKAN DI SINI: Pasang kembali listener global setelah bersih-bersih.
            setupGlobalListeners(); 
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
                    this.currentState = 'CHOOSING'; 
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
                ui.showScreen('memorize', state.quiz.generatedData);
                setupMemorizeScreenListeners();
                break;
            case 'TESTING':
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
                    total: state.quiz.generatedData.flashcards.length,
                });
                ui.triggerConfetti();
                setupResultsScreenListeners();
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
        if (element) element.removeEventListener(event, handler);
    });
    activeListeners = [];
}

// =====================================================================
// KUMPULAN FUNGSI SETUP LISTENER
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

function setupMemorizeScreenListeners() {
    addListener(document.getElementById('start-test-btn'), 'click', () => {
        learningFlow.transition('START_TEST');
    });
}

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

        const nextButton = document.getElementById('next-question-btn');
        if (nextButton) {
            nextButton.focus();
            addListener(nextButton, 'click', () => {
                actions.goToNextCard();
                if (state.quiz.currentCardIndex >= state.quiz.generatedData.flashcards.length) {
                    learningFlow.transition('COMPLETE');
                } else {
                    learningFlow.runStateLogic();
                }
            });
        }
    });
}

function setupResultsScreenListeners() {
    addListener(document.getElementById('restart-btn'), 'click', () => learningFlow.transition('RESTART'));
    addListener(document.getElementById('save-deck-btn'), 'click', handleSaveDeck);
}

function setupGlobalListeners() {
    addListener(document.getElementById('view-deck-btn'), 'click', () => window.location.hash = 'deck');
    const apiKeyInput = document.getElementById('api-key-input');
    const themeSelector = document.getElementById('theme-selector');

    if (apiKeyInput) {
        apiKeyInput.value = state.settings.apiKey;
        addListener(apiKeyInput, 'change', (e) => actions.setApiKey(e.target.value));
    }
    if (themeSelector) {
        themeSelector.value = state.settings.theme;
        addListener(themeSelector, 'change', (e) => actions.setTheme(e.target.value));
    }
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

function handleSaveDeck() {
    const defaultDeckName = state.quiz.topic || "Dek Baru";
    const deckName = prompt("Masukkan nama untuk dek ini:", defaultDeckName);

    if (deckName && deckName.trim() !== "") {
        const flashcards = state.quiz.generatedData.flashcards;
        flashcards.forEach(card => {
            deck.saveNewCard({
                term: card.term,
                definition: card.definition
            }, deckName);
        });
        ui.showNotification(`Berhasil menyimpan ${flashcards.length} kartu ke dek "${deckName}"!`, 'success');
        document.getElementById('save-deck-btn').disabled = true;
    } else {
        ui.showNotification('Penyimpanan dibatalkan.', 'error');
    }
}

function switchMode(mode) {
    actions.setMode(mode);
    ui.switchModeView(mode);
}

function handleFileProcessed(result) {
    ui.updateFileProcessingView(result);
    if (result.status === 'ready') {
        actions.setSourceText(result.content.text);
        actions.setQuizDetails(result.content.title, state.quiz.difficulty);
        ui.showNotification('File berhasil dibaca!', 'success');
    } else if (result.status === 'error') {
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
// ROUTER (NAVIGASI) & INISIALISASI
// =====================================================================
function handleRouteChange() {
    cleanupListeners();
    setupGlobalListeners(); 

    const hash = window.location.hash.substring(1);

    switch(hash) {
        case 'deck':
            ui.showScreen('deck', { decks: state.userData.savedDecks });
            break;
        case '':
        case 'home':
        default:
            learningFlow.currentState = 'IDLE';
            learningFlow.runStateLogic();
            break;
    }
}

function init() {
    initState();
    ui.initUI();
    
    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); 
    
    console.log("Aplikasi Berotak Senku berhasil dimuat!");
}

document.addEventListener('DOMContentLoaded', init);
