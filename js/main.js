// main.js: File utama, sebagai "otak" yang mengatur semua modul

import { state } from './state.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as deck from './deck.js';
import { setupFileHandling } from './fileHandler.js';

function addGlobalListeners() {
    document.getElementById('view-deck-btn').addEventListener('click', () => {
        ui.showScreen('deck', state);
        deck.displayDeck();
        document.getElementById('close-deck-btn').addEventListener('click', () => {
            ui.showScreen(state.lastActiveScreenId.replace('-screen', ''), state);
            // Re-setup listeners for the screen we returned to
            setupScreenListeners(state.lastActiveScreenId.replace('-screen', ''));
        });
    });
}

function setupScreenListeners(screenId) {
    switch (screenId) {
        case 'start':
            document.getElementById('start-form').addEventListener('submit', handleStart);
            document.getElementById('mode-topic-btn').onclick = () => switchMode('topic');
            document.getElementById('mode-file-btn').onclick = () => switchMode('file');
            document.querySelectorAll('.difficulty-btn').forEach(btn => {
                btn.onclick = () => {
                    state.difficulty = btn.dataset.difficulty;
                    document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                };
            });
            setupFileHandling(handleFileProcessed);
            break;
        case 'choice':
            // Listeners for this screen are set up dynamically by ui.displayChoices
            break;
        // ... add cases for other screens if they have specific listeners ...
    }
}

function switchMode(mode) {
    state.currentMode = mode;
    document.getElementById('mode-topic-btn').classList.toggle('selected', mode === 'topic');
    document.getElementById('mode-file-btn').classList.toggle('selected', mode === 'file');
    document.getElementById('topic-input-container').classList.toggle('hidden', mode !== 'topic');
    document.getElementById('file-input-container').classList.toggle('hidden', mode !== 'file');
    document.getElementById('topic-input').required = (mode === 'topic');
}

function handleFileProcessed(result) {
    if (result.status === 'processing') {
        ui.updateFileName(`Memproses: ${result.name}...`);
    } else if (result.status === 'ready') {
        state.sourceText = result.text;
        state.topic = result.name;
        ui.updateFileName(`Siap: ${result.name}`);
    } else if (result.status === 'error') {
        alert(`Gagal memproses file: ${result.message}`);
        ui.updateFileName('');
    }
}

async function handleStart(event) {
    event.preventDefault();
    state.difficulty = document.querySelector('.difficulty-btn.selected').dataset.difficulty;

    if (state.currentMode === 'topic') {
        state.topic = document.getElementById('topic-input').value;
        ui.showScreen('loading', state);
        const choiceData = await api.getChoices(state.topic);
        ui.showScreen('choice', state);
        ui.displayChoices(choiceData.choices, 
            (selected) => { state.topic = selected; },
            () => generateMaterial(state.topic, 'topic')
        );
        setupScreenListeners('choice');
    } else { // file mode
        if (!state.sourceText) {
            alert('Mohon pilih dan tunggu file selesai diproses.');
            return;
        }
        generateMaterial(state.sourceText, 'file');
    }
}

async function generateMaterial(source, mode) {
    ui.showScreen('loading', state);
    state.generatedData = await api.getDeck(source, state.difficulty, mode);
    // Lanjutkan ke tahap hafalan/materi
    startMemorization();
}

function startMemorization() {
    ui.showScreen('memorize', state);
    // ... Implementasikan logika untuk menampilkan kartu hafalan dan timer di sini ...
    // Ini akan memanggil fungsi-fungsi dari ui.js dan state.js
    console.log("Mulai tahap hafalan dengan data:", state.generatedData);
}


// Inisialisasi Aplikasi
function init() {
    ui.showScreen('start', state);
    addGlobalListeners();
    setupScreenListeners('start');
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    console.log("Aplikasi Berotak Senku berhasil dimuat!");
}

document.addEventListener('DOMContentLoaded', init);
