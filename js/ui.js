/**
 * ui.js: Modul Pengelola Tampilan (User Interface)
 * * VERSI DIPERBAIKI: Menambahkan template untuk semua layar baru (hafalan, tes, deck),
 * fungsi untuk modal, dan menyempurnakan update UI.
 * * Bertanggung jawab untuk semua hal yang berhubungan dengan render HTML dan
 * memperbarui DOM.
 */

// =====================================================================
// ELEMEN UTAMA & CACHE
// =====================================================================
let appContainer;
// Cache untuk elemen modal agar tidak perlu query berulang kali
const modalCache = {}; 

// =====================================================================
// FUNGSI INISIALISASI UI
// =====================================================================
export function initUI() {
    appContainer = document.getElementById('app-container');
    if (!appContainer) {
        console.error("Fatal Error: #app-container tidak ditemukan di dalam DOM.");
    }
}

// =====================================================================
// PUSTAKA KOMPONEN KECIL (Reusable Components)
// =====================================================================
const components = {
    progressBar: (percentage, index, total) => `
        <div class="mb-4">
            <div class="flex justify-between items-center text-sm text-secondary mb-1">
                <span>Progress</span>
                <span class="font-semibold">${index + 1} / ${total}</span>
            </div>
            <div class="w-full bg-tertiary rounded-full h-2.5">
                <div class="bg-accent-primary h-2.5 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
            </div>
        </div>
    `,
    flashcard: (card) => `
        <div class="p-4 border border-border-color rounded-lg bg-tertiary">
            <p class="font-bold text-lg">${card.term}</p>
            <p class="text-secondary mt-1">${card.definition}</p>
        </div>
    `,
};

// =====================================================================
// TEMPLATE LAYAR (Menggunakan Komponen)
// =====================================================================
const screenTemplates = {
    start: () => `
        <div id="start-screen" class="screen max-w-2xl w-full">
            <div class="card text-center">
                <i data-lucide="brain-circuit" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i>
                <h1 class="text-4xl font-bold mb-2">Berotak Senku</h1>
                <p class="text-secondary mb-6">Ubah materi apa pun menjadi sesi belajar interaktif.</p>
                <div class="grid grid-cols-2 gap-2 bg-tertiary p-1 rounded-xl mb-6">
                    <button id="mode-topic-btn" class="mode-btn selected">Dari Topik</button>
                    <button id="mode-file-btn" class="mode-btn">Dari File</button>
                </div>
                <form id="start-form">
                    <div id="topic-input-container"><input type="text" id="topic-input" placeholder="Contoh: Sejarah Kerajaan Majapahit" required></div>
                    <div id="file-input-container" class="hidden"><div id="file-upload-area" class="w-full p-8 rounded-xl text-center cursor-pointer border-2 border-dashed border-border-color"><i data-lucide="upload-cloud" class="w-12 h-12 mx-auto text-secondary mb-2"></i><p class="font-semibold">Seret & lepas file</p><p class="text-sm text-secondary">atau klik (PDF, DOCX, Teks)</p><input type="file" id="file-input" class="hidden" accept=".pdf,.docx,.txt,.md"><p id="file-name-display" class="mt-4 font-semibold text-accent-primary"></p></div></div>
                    <div class="my-6"><label class="font-semibold text-secondary mb-3 block">Pilih Tingkat Kesulitan:</label><div id="difficulty-selector" class="grid grid-cols-3 gap-3"><button type="button" data-difficulty="Mudah" class="difficulty-btn selected">Mudah</button><button type="button" data-difficulty="Menengah" class="difficulty-btn">Menengah</button><button type="button" data-difficulty="Sulit" class="difficulty-btn">Sulit</button></div></div>
                    <button type="submit" class="btn btn-primary w-full mt-4 py-4 text-lg">Lanjutkan</button>
                </form>
            </div>
        </div>`,
    
    loading: (text = 'Mohon tunggu sebentar...') => `<div id="loading-screen" class="screen max-w-lg"><div class="card text-center"><i data-lucide="loader-2" class="w-16 h-16 mx-auto text-accent-primary mb-4 animate-spin"></i><h2 class="text-2xl font-bold">AI sedang bekerja...</h2><p class="text-secondary mt-2">${text}</p></div></div>`,
    
    choice: (choices) => {
        const choiceButtons = choices.map(choice => `
            <button class="choice-btn w-full p-4 rounded-lg text-left" data-choice-title="${choice.title}">
                <p class="font-semibold text-lg">${choice.title}</p>
                <p class="text-secondary">${choice.description}</p>
            </button>
        `).join('');
        return `<div id="choice-screen" class="screen max-w-2xl w-full"><div class="card text-center"><i data-lucide="git-branch-plus" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i><h2 class="text-3xl font-bold">Pilih Arah Topik</h2><p class="text-secondary mb-6">AI telah menyiapkan beberapa fokus materi. Pilih salah satu.</p><div id="choices-container" class="space-y-4">${choiceButtons}</div><button id="confirm-choice-btn" class="btn btn-primary w-full mt-6 py-4" disabled>Buatkan Materi</button></div></div>`;
    },

    // PERBAIKAN: Template baru untuk layar hafalan
    memorize: (data) => `
        <div id="memorize-screen" class="screen max-w-3xl w-full">
            <div class="card">
                <i data-lucide="book-open-check" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i>
                <h2 class="text-3xl font-bold text-center">Tahap Hafalan</h2>
                <p class="text-center text-secondary mb-8">Pelajari ringkasan dan kartu di bawah ini sebelum memulai tes.</p>
                <div class="mb-8 p-6 bg-accent-secondary rounded-xl">
                    <h3 class="font-bold text-xl mb-2">Ringkasan Materi</h3>
                    <p class="text-secondary">${data.summary}</p>
                </div>
                <h3 class="font-bold text-xl mb-4 text-center">Kartu Belajar</h3>
                <div class="space-y-4 mb-8">
                    ${data.flashcards.map(card => components.flashcard(card)).join('')}
                </div>
                <button id="start-test-btn" class="btn btn-primary w-full py-4 text-lg">Mulai Tes!</button>
            </div>
        </div>`,
    
    // PERBAIKAN: Template baru untuk layar tes
    test: ({ card, index, total }) => `
        <div id="test-screen" class="screen max-w-2xl w-full">
            <div class="card">
                ${components.progressBar(((index) / total) * 100, index, total)}
                <div id="question-area" class="my-8">
                    <p class="text-center text-2xl leading-relaxed">${card.question.replace('____', '<span class="font-bold text-accent-primary">____</span>')}</p>
                </div>
                <form id="test-form">
                    <input type="text" id="answer-input" placeholder="Ketik jawabanmu di sini..." required autocomplete="off">
                    <button type="submit" id="submit-answer-btn" class="btn btn-primary w-full mt-4 py-3">Periksa Jawaban</button>
                </form>
                <div id="feedback-area" class="mt-6 text-center"></div>
            </div>
        </div>`,

    results: ({ score, total }) => `<div id="results-screen" class="screen max-w-lg w-full"><div class="card text-center"><i data-lucide="party-popper" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i><h2 class="text-3xl font-bold">Sesi Selesai!</h2><div class="bg-accent-secondary p-6 rounded-xl my-6"><p class="text-lg text-secondary">Skor Akhir</p><p id="final-score" class="text-6xl font-bold text-accent-primary my-2">${score}/${total}</p></div><button id="restart-btn" class="btn btn-primary w-full mt-6 py-4">Belajar Topik Baru</button></div></div>`,
    
    // PERBAIKAN: Template baru untuk halaman deck
    deck: ({ decks }) => {
        const hasDecks = Object.keys(decks).length > 0;
        const deckList = hasDecks ? Object.entries(decks).map(([name, cards]) => `
            <div class="p-4 bg-tertiary rounded-lg flex justify-between items-center">
                <div>
                    <p class="font-bold">${name}</p>
                    <p class="text-sm text-secondary">${cards.length} kartu</p>
                </div>
                <button class="btn btn-primary text-sm py-2 px-4">Pelajari</button>
            </div>
        `).join('') : '<p class="text-center text-secondary">Kamu belum punya deck tersimpan.</p>';

        return `<div id="deck-screen" class="screen max-w-2xl w-full"><div class="card">
            <h2 class="text-3xl font-bold text-center mb-6">Deck Kartu Saya</h2>
            <div class="space-y-4">${deckList}</div>
        </div></div>`;
    }
};

// =====================================================================
// FUNGSI UTAMA RENDER & UPDATE UI
// =====================================================================
export function showScreen(screenId, data) {
    if (!appContainer) initUI();
    if (screenTemplates[screenId]) {
        appContainer.innerHTML = screenTemplates[screenId](data);
        const screenElement = appContainer.querySelector('.screen');
        if (screenElement) {
            screenElement.classList.add('active');
            focusOnFirstElement(screenElement);
        }
        // Pastikan ikon Lucide di-render ulang setiap ganti layar
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } else {
        console.error(`Layar dengan ID "${screenId}" tidak ditemukan.`);
        appContainer.innerHTML = `<p class="error-message">Terjadi kesalahan: Layar tidak ditemukan.</p>`;
    }
}

export function switchModeView(mode) {
    document.getElementById('mode-topic-btn').classList.toggle('selected', mode === 'topic');
    document.getElementById('mode-file-btn').classList.toggle('selected', mode === 'file');
    document.getElementById('topic-input-container').classList.toggle('hidden', mode !== 'topic');
    document.getElementById('file-input-container').classList.toggle('hidden', mode !== 'file');
}

// PERBAIKAN: Disesuaikan dengan struktur data dari `main.js`
export function updateFileProcessingView(result) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (!fileNameDisplay) return;

    if (result.status === 'processing') {
        fileNameDisplay.textContent = `Memproses: ${result.name}...`;
    } else if (result.status === 'ready') {
        fileNameDisplay.textContent = `Siap: ${result.content.metadata.fileName} (${result.content.metadata.wordCount} kata)`;
    } else if (result.status === 'error') {
        fileNameDisplay.textContent = 'Gagal memproses file.';
    }
}

// PERBAIKAN: Fungsi baru untuk menampilkan hasil tes di layar kuis
export function showTestResult(isCorrect, correctAnswer) {
    const feedbackArea = document.getElementById('feedback-area');
    const answerInput = document.getElementById('answer-input');
    const submitBtn = document.getElementById('submit-answer-btn');
    
    if (!feedbackArea || !answerInput || !submitBtn) return;

    answerInput.disabled = true;
    submitBtn.style.display = 'none';

    let feedbackHTML = '';
    if (isCorrect) {
        feedbackHTML = `<div class="p-4 rounded-lg bg-green-100 text-green-800"><p class="font-bold">Benar!</p></div>`;
    } else {
        feedbackHTML = `<div class="p-4 rounded-lg bg-red-100 text-red-800"><p class="font-bold">Kurang Tepat</p><p>Jawaban yang benar adalah: <strong class="font-bold">${correctAnswer}</strong></p></div>`;
    }

    feedbackArea.innerHTML = `${feedbackHTML}<button id="next-question-btn" class="btn btn-primary w-full mt-4 py-3">Lanjut</button>`;
}

export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(() => {
        notif.classList.add('fading-out');
        notif.addEventListener('animationend', () => notif.remove());
    }, duration);
}

export function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, zIndex: 10000 });
    }
}

// PERBAIKAN: Fungsi baru untuk membuka/menutup modal
export function toggleModal(modalId) {
    let modal = modalCache[modalId];
    if (!modal) {
        modal = document.getElementById(modalId);
        if (!modal) return;
        modalCache[modalId] = modal;
        
        // Tambahkan listener untuk menutup modal
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => toggleModal(modalId));
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { // Hanya jika klik di area background gelap
                toggleModal(modalId);
            }
        });
    }
    modal.classList.toggle('hidden');
    modal.classList.toggle('flex'); // Gunakan flex untuk centering
}

function focusOnFirstElement(container) {
    if (!container) return;
    const focusable = 'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])';
    const firstVisibleElement = Array.from(container.querySelectorAll(focusable))
        .find(el => !el.disabled && el.offsetParent !== null);
    if (firstVisibleElement) {
        firstVisibleElement.focus();
    }
}
