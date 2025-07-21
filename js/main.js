/**
 * =====================================================================
 * File: main.js (VERSI FINAL & DIPERBAIKI TOTAL)
 * =====================================================================
 *
 * main.js: Otak & Sutradara Aplikasi (Controller)
 * * PERBAIKAN: Memperbaiki logika `handleRouteChange` untuk mengatasi bug layar kosong.
 * * PERBAIKAN: Memastikan `cardCount` selalu diteruskan saat memilih sub-topik.
 * * PERBAIKAN: Membuat fungsi `handleStudyDeck` lebih kuat untuk menangani data
 * dek lama yang mungkin rusak untuk mencegah 'undefined' secara total.
 */
import { state, actions, init as initState } from './state.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as deck from './deck.js';
import { setupFileHandling } from './fileHandler.js';

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
            cleanupScreenListeners();
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
                    actions.setGeneratedData(choiceData);
                    await this.transition('SUCCESS');
                }, { fallbackState: 'IDLE' });
                break;
            case 'CHOOSING':
                 // Pastikan data ada sebelum render
                 if (state.quiz.generatedData && state.quiz.generatedData.choices) {
                    ui.showScreen('choice', state.quiz.generatedData.choices);
                    setupChoiceScreenListeners();
                 } else {
                    console.error("Data pilihan tidak ditemukan, kembali ke IDLE");
                    await this.transition('FAIL');
                 }
                 break;
            case 'LOADING_DECK':
                ui.showScreen('loading', 'Membuat materi belajar...');
                 await handleAsync(async () => {
                    const source = state.session.currentMode === 'topic' ? state.quiz.topic : state.quiz.sourceText;
                    const cardCount = state.quiz.cardCount;
                    const generatedData = await api.getDeck(source, state.quiz.difficulty, state.session.currentMode, cardCount);
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

let activeScreenListeners = [];

function addScreenListener(element, event, handler) {
    if (element) {
        element.addEventListener(event, handler);
        activeScreenListeners.push({ element, event, handler });
    }
}

function cleanupScreenListeners() {
    activeScreenListeners.forEach(({ element, event, handler }) => {
        if (element) element.removeEventListener(event, handler);
    });
    activeScreenListeners = [];
}

function setupGlobalListeners() {
    document.getElementById('view-deck-btn').addEventListener('click', () => { window.location.hash = 'deck'; });
    const apiKeyInput = document.getElementById('api-key-input');
    const themeSelector = document.getElementById('theme-selector');
    if (apiKeyInput) {
        apiKeyInput.value = state.settings.apiKey;
        apiKeyInput.addEventListener('change', (e) => actions.setApiKey(e.target.value));
    }
    if (themeSelector) {
        themeSelector.value = state.settings.theme;
        themeSelector.addEventListener('change', (e) => actions.setTheme(e.target.value));
    }
}

function setupStartScreenListeners() {
    addScreenListener(document.getElementById('start-form'), 'submit', handleStart);
    addScreenListener(document.getElementById('mode-topic-btn'), 'click', () => switchMode('topic'));
    addScreenListener(document.getElementById('mode-file-btn'), 'click', () => switchMode('file'));
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        addScreenListener(btn, 'click', () => {
            const difficulty = btn.dataset.difficulty;
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            actions.setQuizDetails(state.quiz.topic, difficulty, state.quiz.cardCount);
        });
    });
    setupFileHandling(handleFileProcessed);
}

function setupChoiceScreenListeners() {
    let selectedChoice = null;
    const confirmBtn = document.getElementById('confirm-choice-btn');
    document.querySelectorAll('.choice-btn').forEach(btn => {
        addScreenListener(btn, 'click', () => {
            selectedChoice = btn.dataset.choiceTitle;
            // PERBAIKAN KRITIS: Selalu teruskan 'cardCount' yang sudah ada di state
            actions.setQuizDetails(selectedChoice, state.quiz.difficulty, state.quiz.cardCount);
            document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (confirmBtn) confirmBtn.disabled = false;
        });
    });
    addScreenListener(confirmBtn, 'click', () => {
        if (selectedChoice) {
            learningFlow.transition('CONFIRM');
        }
    });
}

function setupMemorizeScreenListeners() {
    addScreenListener(document.getElementById('start-test-btn'), 'click', () => {
        learningFlow.transition('START_TEST');
    });
}

function setupTestScreenListeners() {
    const revealBtn = document.getElementById('reveal-answer-btn');
    const feedbackArea = document.getElementById('feedback-area');
    const correctBtn = document.getElementById('correct-btn');
    const incorrectBtn = document.getElementById('incorrect-btn');

    addScreenListener(revealBtn, 'click', () => {
        revealBtn.parentElement.classList.add('hidden');
        feedbackArea.classList.remove('hidden');
        if (correctBtn) correctBtn.focus();
    });

    const handleAnswer = (isCorrect) => {
        const currentCard = state.quiz.generatedData.flashcards[state.quiz.currentCardIndex];
        const deckName = state.quiz.currentDeckName;
        if (deckName && currentCard.id) {
            deck.updateCardMastery(deckName, currentCard.id, isCorrect);
        }
        if (isCorrect) {
            actions.incrementScore();
        }
        actions.goToNextCard();
        if (state.quiz.currentCardIndex >= state.quiz.generatedData.flashcards.length) {
            learningFlow.transition('COMPLETE');
        } else {
            learningFlow.runStateLogic();
        }
    };

    addScreenListener(correctBtn, 'click', () => handleAnswer(true));
    addScreenListener(incorrectBtn, 'click', () => handleAnswer(false));
}

function setupResultsScreenListeners() {
    addScreenListener(document.getElementById('restart-btn'), 'click', () => learningFlow.transition('RESTART'));
    addScreenListener(document.getElementById('save-deck-btn'), 'click', handleSaveDeck);
}

function setupDeckScreenListeners() {
    document.querySelectorAll('.study-deck-btn').forEach(btn => {
        addScreenListener(btn, 'click', (e) => handleStudyDeck(e.currentTarget.dataset.deckName));
    });
    document.querySelectorAll('.rename-deck-btn').forEach(btn => {
        addScreenListener(btn, 'click', (e) => handleRenameDeck(e.currentTarget.dataset.deckName));
    });
    document.querySelectorAll('.delete-deck-btn').forEach(btn => {
        addScreenListener(btn, 'click', (e) => handleDeleteDeck(e.currentTarget.dataset.deckName));
    });
}

async function handleStart(event) {
    event.preventDefault();
    const difficulty = document.querySelector('.difficulty-btn.selected')?.dataset.difficulty || 'Mudah';
    const cardCount = parseInt(document.getElementById('card-count-selector').value, 10);

    if (state.session.currentMode === 'topic') {
        const topic = document.getElementById('topic-input').value;
        if (!topic) {
            ui.showNotification('Mohon masukkan topik terlebih dahulu.', 'error');
            return;
        }
        actions.setQuizDetails(topic, difficulty, cardCount);
        await learningFlow.transition('SUBMIT_TOPIC');
    } else {
        if (!state.quiz.sourceText) {
            ui.showNotification('Mohon pilih dan tunggu file selesai diproses.', 'error');
            return;
        }
        actions.setQuizDetails(state.quiz.topic, difficulty, cardCount);
        await learningFlow.transition('SUBMIT_FILE');
    }
}

function handleSaveDeck() {
    const defaultDeckName = state.quiz.topic || "Dek Baru";
    const deckName = prompt("Masukkan nama untuk dek ini:", defaultDeckName);
    if (deckName && deckName.trim() !== "") {
        const flashcards = state.quiz.generatedData.flashcards;
        flashcards.forEach(card => {
            deck.saveNewCard(card, deckName);
        });
        ui.showNotification(`Berhasil menyimpan ${flashcards.length} kartu ke dek "${deckName}"!`, 'success');
        document.getElementById('save-deck-btn').disabled = true;
    } else if (deckName !== null) {
        ui.showNotification('Nama dek tidak boleh kosong.', 'error');
    }
}

function handleStudyDeck(deckName) {
    const cards = deck.startDeckStudySession(deckName);
    if (cards && cards.length > 0) {
        actions.resetQuiz();
        actions.setCurrentDeckName(deckName);

        const deckData = {
            summary: `Mempelajari kembali dek "${deckName}". Kartu diurutkan berdasarkan yang paling perlu diulang.`,
            flashcards: cards.map(c => ({
                id: c.id,
                term: c.term || 'Istilah tidak tersedia',
                simple_definition: c.simple_definition || c.definition || 'Definisi tidak tersedia.',
                analogy_or_example: c.analogy_or_example || '',
                active_recall_question: c.active_recall_question || `Apa yang kamu ketahui tentang "${c.term || 'ini'}"?`,
                question_clue: c.question_clue || ''
            }))
        };

        actions.setGeneratedData(deckData);
        learningFlow.currentState = 'MEMORIZING';
        learningFlow.runStateLogic();
    } else {
        ui.showNotification("Selamat! Tidak ada kartu yang perlu ditinjau di dek ini hari ini.", "success");
    }
}

function handleRenameDeck(oldName) {
    const newName = prompt(`Masukkan nama baru untuk dek "${oldName}":`, oldName);
    if (newName && newName.trim() !== "" && newName.trim() !== oldName) {
        if (deck.renameDeck(oldName, newName)) {
            ui.showNotification(`Nama dek diubah menjadi "${newName}"`, 'success');
            handleRouteChange();
        } else {
            ui.showNotification("Nama dek sudah ada atau tidak valid.", "error");
        }
    }
}

function handleDeleteDeck(deckName) {
    if (confirm(`Apakah kamu yakin ingin menghapus dek "${deckName}"? Aksi ini tidak bisa dibatalkan.`)) {
        deck.deleteDeck(deckName);
        ui.showNotification(`Deck "${deckName}" telah dihapus.`, 'success');
        handleRouteChange();
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
        actions.setQuizDetails(result.content.title, state.quiz.difficulty, state.quiz.cardCount);
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

function handleRouteChange() {
    cleanupScreenListeners();
    const hash = window.location.hash.substring(1);
    switch(hash) {
        case 'deck':
            ui.showScreen('deck', { decks: state.userData.savedDecks });
            setupDeckScreenListeners();
            break;
        case '':
        case 'home':
        default:
            // PERBAIKAN KRITIS: Hapus kondisi 'if' yang salah.
            // Selalu set state ke IDLE dan jalankan logikanya untuk memastikan
            // layar awal selalu ditampilkan dengan benar.
            learningFlow.currentState = 'IDLE';
            learningFlow.runStateLogic();
            break;
    }
}

function init() {
    initState();
    ui.initUI();
    setupGlobalListeners();
    window.addEventListener('hashchange', handleRouteChange);
    handleRouteChange(); // Panggil sekali saat load untuk menentukan halaman awal
    console.log("Aplikasi Berotak Senku berhasil dimuat!");
}

document.addEventListener('DOMContentLoaded', init);
