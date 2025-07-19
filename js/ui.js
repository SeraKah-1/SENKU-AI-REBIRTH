/**
 * ui.js: Modul Pengelola Tampilan (User Interface)
 * * Bertanggung jawab untuk semua hal yang berhubungan dengan render HTML,
 * memperbarui DOM, dan menampilkan feedback visual kepada pengguna.
 * Modul ini tidak tahu menahu tentang logika bisnis, ia hanya menerima data dan menampilkannya.
 */

// =====================================================================
// ELEMEN UTAMA & KONSTANTA
// =====================================================================
const appContainer = document.getElementById('app-container');

// =====================================================================
// PUSTAKA KOMPONEN KECIL (Reusable Components)
// =====================================================================
const components = {
    /**
     * Membuat komponen skeleton loader untuk menandakan konten sedang dimuat.
     * @param {string} width - Lebar skeleton.
     * @param {string} height - Tinggi skeleton.
     * @returns {string} HTML string untuk skeleton.
     */
    skeleton: (width = '100%', height = '1rem') => `
        <div class="bg-gray-300 rounded animate-pulse" style="width:${width}; height:${height};"></div>
    `,

    /**
     * Membuat komponen progress bar.
     * @param {number} percentage - Persentase progress (0-100).
     * @returns {string} HTML string untuk progress bar.
     */
    progressBar: (percentage) => `
        <div class="w-full bg-tertiary rounded-full h-2.5">
            <div class="bg-success-color h-2.5 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
        </div>
    `,

    /**
     * Membuat komponen timer.
     * @param {number} time - Waktu tersisa dalam detik.
     * @param {string} barId - ID untuk elemen bar timer.
     * @param {string} displayId - ID untuk elemen teks timer.
     * @returns {string} HTML string untuk timer.
     */
    timer: (time, barId, displayId) => `
        <div class="flex justify-between items-center text-sm text-secondary mb-2">
            <span>Waktu Tersisa</span>
            <span id="${displayId}" class="font-semibold text-lg text-accent-primary">${time}s</span>
        </div>
        <div class="w-full bg-tertiary rounded-full h-2.5">
            <div id="${barId}" class="bg-accent-primary h-2.5 rounded-full" style="width: 100%"></div>
        </div>
    `,
};

// =====================================================================
// TEMPLATE LAYAR (Menggunakan Komponen)
// =====================================================================
const screenTemplates = {
    start: () => `
        <div id="start-screen" class="screen max-w-2xl">
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
                    <div id="file-input-container" class="hidden"><div id="file-upload-area" class="w-full p-8 rounded-xl text-center cursor-pointer border-2 border-dashed border-border-color"><i data-lucide="upload-cloud" class="w-12 h-12 mx-auto text-secondary mb-2"></i><p class="font-semibold">Seret & lepas file</p><p class="text-sm text-secondary">atau klik untuk memilih (PDF, DOCX)</p><input type="file" id="file-input" class="hidden" accept=".pdf,.docx"><p id="file-name-display" class="mt-4 font-semibold text-accent-primary"></p></div></div>
                    <div class="my-6"><label class="font-semibold text-secondary mb-3 block">Pilih Tingkat Kesulitan:</label><div id="difficulty-selector" class="grid grid-cols-3 gap-3"><button type="button" data-difficulty="Mudah" class="difficulty-btn selected">Mudah</button><button type="button" data-difficulty="Menengah" class="difficulty-btn">Menengah</button><button type="button" data-difficulty="Sulit" class="difficulty-btn">Sulit</button></div></div>
                    <button type="submit" class="btn btn-primary w-full mt-4 py-4 text-lg">Lanjutkan</button>
                </form>
            </div>
        </div>`,
    
    loading: (text = 'Mohon tunggu sebentar...') => `
        <div id="loading-screen" class="screen max-w-lg"><div class="card text-center"><i data-lucide="loader-2" class="w-16 h-16 mx-auto text-accent-primary mb-4 animate-spin"></i><h2 class="text-2xl font-bold">AI sedang bekerja...</h2><p class="text-secondary mt-2">${text}</p></div></div>`,
    
    choice: (choices) => {
        const choiceButtons = choices.map(choice => `
            <button class="choice-btn w-full p-4 rounded-lg text-left" data-choice-title="${choice.title}">
                <p class="font-semibold text-lg">${choice.title}</p>
                <p class="text-secondary">${choice.description}</p>
            </button>
        `).join('');

        return `
        <div id="choice-screen" class="screen max-w-2xl"><div class="card text-center"><i data-lucide="git-branch-plus" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i><h2 class="text-3xl font-bold">Pilih Arah Topik</h2><p class="text-secondary mb-6">Pilih salah satu fokus untuk materi belajarmu.</p><div id="choices-container" class="space-y-4">${choiceButtons}</div><button id="confirm-choice-btn" class="btn btn-primary w-full mt-6 py-4" disabled>Buatkan Materi</button></div></div>`;
    },

    results: (score, total) => `
        <div id="results-screen" class="screen max-w-lg">
            <div class="card text-center">
                <i data-lucide="party-popper" class="w-16 h-16 mx-auto text-accent-primary mb-4"></i>
                <h2 class="text-3xl font-bold">Sesi Selesai!</h2>
                <div class="bg-accent-secondary p-6 rounded-xl my-6">
                    <p class="text-lg text-secondary">Skor Akhir</p>
                    <p id="final-score" class="text-6xl font-bold text-accent-primary my-2">${score}/${total}</p>
                </div>
                <button id="restart-btn" class="btn btn-primary w-full mt-6 py-4">Belajar Topik Baru</button>
            </div>
        </div>`,
};

// =====================================================================
// FUNGSI UTAMA RENDER & UPDATE UI
// =====================================================================

/**
 * Fungsi utama untuk menampilkan sebuah layar.
 * @param {string} screenId - Kunci dari layar yang ingin ditampilkan (e.g., 'start', 'loading').
 * @param {object} [data] - Data opsional untuk me-render layar (e.g., teks untuk loading).
 */
export function showScreen(screenId, data) {
    if (screenTemplates[screenId]) {
        appContainer.innerHTML = screenTemplates[screenId](data);
        const screenElement = appContainer.querySelector('.screen');
        if (screenElement) {
            screenElement.classList.add('active');
            focusOnFirstElement(screenElement);
        }
    } else {
        console.error(`Layar dengan ID "${screenId}" tidak ditemukan.`);
        appContainer.innerHTML = `<p class="error-message">Terjadi kesalahan: Layar tidak ditemukan.</p>`;
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Menampilkan notifikasi global di pojok layar.
 * @param {string} message - Pesan yang ingin ditampilkan.
 * @param {'success'|'error'|'info'} [type='info'] - Tipe notifikasi.
 * @param {number} [duration=3000] - Durasi notifikasi dalam milidetik.
 */
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

/**
 * Memicu efek confetti. Pastikan library canvas-confetti sudah dimuat.
 */
export function triggerConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            zIndex: 10000
        });
    } else {
        console.warn('Library canvas-confetti belum dimuat.');
    }
}

/**
 * Memperbarui tampilan skor secara real-time dengan animasi.
 * @param {number} newScore - Skor baru untuk ditampilkan.
 */
export function updateScore(newScore) {
    const scoreElement = document.getElementById('score-display');
    if (scoreElement) {
        scoreElement.textContent = `Skor: ${newScore}`;
        // Tambahkan class untuk animasi 'pop'
        // CSS untuk .score-pop perlu ditambahkan di style.css
        scoreElement.classList.add('score-pop'); 
        scoreElement.addEventListener('animationend', () => {
            scoreElement.classList.remove('score-pop');
        });
    }
}

/**
 * Memperbarui UI timer (bar dan teks).
 * @param {number} timeLeft - Waktu tersisa.
 * @param {number} totalTime - Waktu total untuk menghitung persentase.
 * @param {string} barId - ID elemen bar.
 * @param {string} displayId - ID elemen teks.
 */
export function updateTimerUI(timeLeft, totalTime, barId, displayId) {
    const bar = document.getElementById(barId);
    const display = document.getElementById(displayId);
    if (bar) {
        bar.style.width = `${(timeLeft / totalTime) * 100}%`;
    }
    if (display) {
        display.textContent = `${timeLeft}s`;
    }
}

// =====================================================================
// FUNGSI AKSESIBILITAS (A11y)
// =====================================================================

/**
 * Memindahkan fokus keyboard ke elemen interaktif pertama di dalam sebuah kontainer.
 * @param {HTMLElement} container - Elemen kontainer (e.g., modal atau layar baru).
 */
export function focusOnFirstElement(container) {
    if (!container) return;
    const focusableElements = container.querySelectorAll(
        'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
    );
    const firstVisibleElement = Array.from(focusableElements).find(el => !el.disabled && el.offsetParent !== null);
    
    if (firstVisibleElement) {
        firstVisibleElement.focus();
    }
}
