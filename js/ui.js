/**
 * =====================================================================
 * File: js/ui.js (VERSI FINAL UPGRADE - 21 Juli 2025)
 * =====================================================================
 *
 * ui.js: Modul Pengelola Tampilan (User Interface)
 * * PERBAIKAN KUNCI: Memodifikasi `switchModeView` untuk secara dinamis
 * mengubah atribut `required` pada input topik. Ini memperbaiki bug di
 * mana form tidak bisa disubmit saat mode "Dari File" aktif.
 * * PENAMBAHAN: Menambahkan dropdown untuk memilih jumlah kartu.
 * * UPGRADE: Komponen flashcard menampilkan definisi dan analogi.
 * * UPGRADE: Alur tes dirombak untuk mendukung Active Recall.
 */

// =====================================================================
// ELEMEN UTAMA & CACHE
// =====================================================================
let appContainer;

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
        <div class="p-4 border border-border-color rounded-lg bg-tertiary space-y-2">
            <p class="font-bold text-lg">${card.term || 'Istilah tidak ada'}</p>
            <p class="text-primary">${card.simple_definition || 'Definisi tidak tersedia.'}</p>
            ${card.analogy_or_example ? `
            <div class="text-sm italic text-secondary p-2 bg-primary rounded-md border-l-4 border-accent-primary">
                <span class="font-semibold">Analogi/Contoh: </span>
                <span>${card.analogy_or_example}</span>
            </div>
            ` : ''}
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
                    <div id="file-input-container" class="hidden">
                        <div id="file-upload-area" class="w-full p-8 rounded-xl text-center cursor-pointer border-2 border-dashed border-border-color">
                            <i data-lucide="upload-cloud" class="w-12 h-12 mx-auto text-secondary mb-2"></i>
                            <p class="font-semibold">Seret & lepas file</p>
                            <p class="text-sm text-secondary">atau klik (PDF, DOCX, Teks, JPG)</p>
                            <input type="file" id="file-input" class="hidden" accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png">
                            <p id="file-name-display" class="mt-4 font-semibold text-accent-primary"></p>
                        </div>
                    </div>
                    
                    <div class="my-6">
                        <label class="font-semibold text-secondary mb-3 block">Pilih Tingkat Kesulitan:</label>
                        <div id="difficulty-selector" class="grid grid-cols-3 gap-3">
                            <button type="button" data-difficulty="Mudah" class="difficulty-btn selected">Mudah</button>
                            <button type="button" data-difficulty="Menengah" class="difficulty-btn">Menengah</button>
                            <button type="button" data-difficulty="Sulit" class="difficulty-btn">Sulit</button>
                        </div>
                    </div>

                    <div class="my-6">
                        <label for="card-count-selector" class="font-semibold text-secondary mb-3 block">Jumlah Kartu:</label>
                        <select id="card-count-selector" class="w-full p-3 text-base border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent-primary bg-secondary">
                            <option value="5">5 Kartu (Sesi Cepat)</option>
                            <option value="10" selected>10 Kartu (Sesi Standar)</option>
                            <option value="15">15 Kartu (Sesi Mendalam)</option>
                        </select>
                    </div>

                    <button type="submit" class="btn btn-primary w-full mt-4 py-4 text-lg">Lanjutkan</button>
                </form>
            </div>
        </div>`,
    
    loading: (text = 'Mohon tunggu sebentar...') => `<div id="loading-screen" class="screen max-w-lg"><div class="card text-center"><i data-lucide="loader-2" class="w-16 h-16 mx-auto text-accent-primary mb-4 animate-spin"></i><h2 class="text-2xl font-bold">AI sedang bekerja...</h2><p class="text-secondary mt-2">${text}</p></div></div>`,
    
    choice: (choices) => {
        const choiceButtons = choices && Array.isArray(choices) ? choices.map(choice => `
            <button class="choice-btn w-full p-4 rounded-lg text-left" data-choice-title="${choice.title}">
                <p class="font-semibold text-lg">${choice.title}</p>
                <p class="text-secondary">${choice.description}</p>
            </button>
        `).join('') : '<p class="text-secondary">Tidak ada pilihan topik yang bisa dibuat.</p>';
        return `<div id="choice-screen" class="screen max-w-2xl w-full"><div class="card text-center"><i data-lucide="git-branch-plus" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i><h2 class="text-3xl font-bold">Pilih Fokus Materi</h2><p class="text-secondary mb-6">AI telah memecah topik utamamu. Pilih salah satu untuk dipelajari.</p><div id="choices-container" class="space-y-4">${choiceButtons}</div><button id="confirm-choice-btn" class="btn btn-primary w-full mt-6 py-4" disabled>Buatkan Materi</button></div></div>`;
    },

    memorize: (data) => `
        <div id="memorize-screen" class="screen max-w-3xl w-full">
            <div class="card">
                <i data-lucide="book-open-check" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i>
                <h2 class="text-3xl font-bold text-center">Tahap Hafalan</h2>
                <p class="text-center text-secondary mb-8">Pelajari ringkasan dan kartu di bawah ini sebelum memulai tes.</p>
                <div class="mb-8 p-6 bg-accent-secondary rounded-xl">
                    <h3 class="font-bold text-xl mb-2">Ringkasan Materi</h3>
                    <p class="text-secondary">${data.summary || 'Ringkasan tidak tersedia.'}</p>
                </div>
                <h3 class="font-bold text-xl mb-4 text-center">Kartu Belajar (${data.flashcards?.length || 0})</h3>
                <div class="space-y-4 mb-8">
                    ${data.flashcards && data.flashcards.length > 0 ? data.flashcards.map(card => components.flashcard(card)).join('') : '<p class="text-center text-secondary">Tidak ada kartu belajar yang dibuat.</p>'}
                </div>
                <button id="start-test-btn" class="btn btn-primary w-full py-4 text-lg" ${!data.flashcards || data.flashcards.length === 0 ? 'disabled' : ''}>Mulai Tes!</button>
            </div>
        </div>`,
    
    test: ({ card, index, total }) => `
        <div id="test-screen" class="screen max-w-2xl w-full">
            <div class="card">
                ${components.progressBar(((index) / total) * 100, index, total)}
                <div id="question-area" class="my-8 text-center">
                    <p class="text-secondary text-sm font-semibold">Pertanyaan untuk diingat:</p>
                    <p class="text-2xl leading-relaxed mt-2">${card.active_recall_question || 'Pertanyaan tidak tersedia.'}</p>
                    <p class="text-xs text-secondary mt-2">(${card.question_clue ? `Petunjuk: ${card.question_clue}` : 'Tidak ada petunjuk'})</p>
                </div>
                <div id="answer-reveal-area" class="text-center">
                     <button id="reveal-answer-btn" class="btn btn-secondary w-full mt-4 py-3">Tampilkan Jawaban</button>
                </div>
                <div id="feedback-area" class="mt-6 text-center hidden p-4 rounded-lg bg-tertiary">
                     <p class="font-bold">${card.term}</p>
                     <p class="mt-1">${card.simple_definition}</p>
                     ${card.analogy_or_example ? `<p class="text-sm italic mt-3">${card.analogy_or_example}</p>` : ''}
                     <p class="mt-4 font-semibold">Apakah kamu berhasil mengingatnya?</p>
                     <div class="flex gap-4 mt-2">
                        <button id="correct-btn" class="btn btn-primary w-full flex items-center justify-center gap-2"><i data-lucide="check" class="w-5 h-5"></i> Benar</button>
                        <button id="incorrect-btn" class="btn btn-secondary w-full flex items-center justify-center gap-2"><i data-lucide="x" class="w-5 h-5"></i> Salah</button>
                     </div>
                </div>
            </div>
        </div>`,

    results: ({ score, total }) => `
        <div id="results-screen" class="screen max-w-lg w-full">
            <div class="card text-center">
                <i data-lucide="party-popper" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i>
                <h2 class="text-3xl font-bold">Sesi Selesai!</h2>
                <div class="bg-accent-secondary p-6 rounded-xl my-6">
                    <p class="text-lg text-secondary">Skor Akhir</p>
                    <p id="final-score" class="text-6xl font-bold text-accent-primary my-2">${score}/${total}</p>
                </div>
                <div class="mt-6 w-full space-y-3">
                    <button id="save-deck-btn" class="btn btn-secondary w-full py-4 text-lg">Simpan Kartu ke Deck</button>
                    <button id="restart-btn" class="btn btn-primary w-full py-4 text-lg">Belajar Topik Baru</button>
                </div>
            </div>
        </div>`,
    
    deck: ({ decks }) => {
        const hasDecks = Object.keys(decks).length > 0;
        const deckList = hasDecks ? Object.entries(decks).map(([name, cards]) => `
            <div class="p-4 bg-tertiary rounded-lg flex justify-between items-center gap-2">
                <div class="flex-grow">
                    <p class="font-bold truncate">${name}</p>
                    <p class="text-sm text-secondary">${cards.length} kartu</p>
                </div>
                <div class="flex-shrink-0 flex gap-2">
                    <button class="rename-deck-btn p-2 hover:bg-primary rounded-md" data-deck-name="${name}" title="Ganti Nama">
                        <i data-lucide="file-edit" class="w-5 h-5"></i>
                    </button>
                    <button class="delete-deck-btn p-2 hover:bg-primary rounded-md" data-deck-name="${name}" title="Hapus">
                        <i data-lucide="trash-2" class="w-5 h-5 text-error-color"></i>
                    </button>
                    <button class="btn btn-primary text-sm py-2 px-4 study-deck-btn" data-deck-name="${name}">Pelajari</button>
                </div>
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
    
    appContainer.innerHTML = screenTemplates[screenId] ? screenTemplates[screenId](data) : `<p class="error-message">Terjadi kesalahan: Layar "${screenId}" tidak ditemukan.</p>`;
    
    const screenElement = appContainer.querySelector('.screen');
    if (screenElement) {
        screenElement.classList.add('active');
        const firstFocusable = screenElement.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * --- PERBAIKAN KUNCI ADA DI SINI ---
 * Mengalihkan tampilan dan status `required` pada input.
 * @param {'topic' | 'file'} mode - Mode yang akan diaktifkan.
 */
export function switchModeView(mode) {
    const topicContainer = document.getElementById('topic-input-container');
    const fileContainer = document.getElementById('file-input-container');
    const topicInput = document.getElementById('topic-input');

    document.getElementById('mode-topic-btn').classList.toggle('selected', mode === 'topic');
    document.getElementById('mode-file-btn').classList.toggle('selected', mode === 'file');

    if (topicContainer && fileContainer && topicInput) {
        topicContainer.classList.toggle('hidden', mode !== 'topic');
        fileContainer.classList.toggle('hidden', mode !== 'file');
        
        // Jika mode 'file', hapus 'required' dari input topik agar form bisa submit.
        // Jika mode 'topic', tambahkan kembali 'required'.
        topicInput.required = (mode === 'topic');
    }
}

export function updateFileProcessingView(result) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (!fileNameDisplay) return;

    if (result.status === 'processing') {
        fileNameDisplay.textContent = `Memproses: ${result.name}...`;
        fileNameDisplay.className = 'mt-4 font-semibold text-secondary';
    } else if (result.status === 'progress') {
        fileNameDisplay.textContent = result.details || `Memproses...`;
        fileNameDisplay.className = 'mt-4 font-semibold text-secondary';
    } else if (result.status === 'ready' && result.content) {
        const metadata = result.content.metadata;
        fileNameDisplay.textContent = `Siap: ${metadata.fileName} (${metadata.wordCount} kata)`;
        fileNameDisplay.className = 'mt-4 font-semibold text-accent-primary';
    } else if (result.status === 'error') {
        fileNameDisplay.textContent = result.message || 'Gagal memproses file.';
        fileNameDisplay.className = 'mt-4 font-semibold text-red-500';
    }
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
    // Pastikan library confetti sudah dimuat di HTML jika ingin digunakan
    if (typeof confetti === 'function') {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, zIndex: 10000 });
    }
}
