// ui.js: Mengelola semua interaksi dengan User Interface (tampilan)

const appContainer = document.getElementById('app-container');

// Template HTML untuk setiap layar
const screenTemplates = {
    start: `
        <div id="start-screen" class="screen max-w-2xl">
            <div class="card text-center">
                <i data-lucide="brain-circuit" class="w-16 h-16 mx-auto text-indigo-500 mb-4"></i>
                <h1 class="text-4xl font-bold mb-2">Berotak Senku</h1>
                <p class="text-gray-500 mb-6">Ubah materi apa pun menjadi sesi belajar interaktif.</p>
                <div class="grid grid-cols-2 gap-2 bg-gray-200 p-1 rounded-xl mb-6">
                    <button id="mode-topic-btn" class="mode-btn selected w-full p-2 rounded-lg font-semibold transition">Dari Topik</button>
                    <button id="mode-file-btn" class="mode-btn w-full p-2 rounded-lg font-semibold transition">Dari File</button>
                </div>
                <form id="start-form">
                    <div id="topic-input-container"><input type="text" id="topic-input" class="w-full border-2 border-gray-200 p-4 rounded-xl text-lg text-center" placeholder="Contoh: Sejarah Kerajaan Majapahit" required></div>
                    <div id="file-input-container" class="hidden"><div id="file-upload-area" class="w-full p-8 rounded-xl text-center cursor-pointer"><i data-lucide="upload-cloud" class="w-12 h-12 mx-auto text-gray-400 mb-2"></i><p class="font-semibold">Seret & lepas file</p><p class="text-sm text-gray-500">atau klik untuk memilih (PDF, DOCX)</p><input type="file" id="file-input" class="hidden" accept=".pdf,.docx"><p id="file-name-display" class="mt-4 font-semibold text-indigo-600"></p></div></div>
                    <div class="my-6"><label class="font-semibold text-gray-600 mb-3 block">Pilih Tingkat Kesulitan:</label><div id="difficulty-selector" class="grid grid-cols-3 gap-3"><button type="button" data-difficulty="Mudah" class="difficulty-btn selected">Mudah</button><button type="button" data-difficulty="Menengah" class="difficulty-btn">Menengah</button><button type="button" data-difficulty="Sulit" class="difficulty-btn">Sulit</button></div></div>
                    <button type="submit" class="w-full mt-4 bg-indigo-600 text-white font-bold py-4 rounded-xl text-lg">Lanjutkan</button>
                </form>
            </div>
        </div>`,
    choice: `
        <div id="choice-screen" class="screen max-w-2xl"><div class="card text-center"><i data-lucide="git-branch-plus" class="w-16 h-16 mx-auto text-indigo-500 mb-4"></i><h2 class="text-3xl font-bold">Pilih Arah Topik</h2><p class="text-gray-500 mb-6">Pilih salah satu fokus untuk materi belajarmu.</p><div id="choices-container" class="space-y-4 text-left"></div><button id="confirm-choice-btn" class="w-full mt-6 bg-indigo-600 text-white font-bold py-4 rounded-xl" disabled>Buatkan Materi</button></div></div>`,
    loading: `
        <div id="loading-screen" class="screen max-w-lg"><div class="card text-center"><i data-lucide="loader-2" class="w-16 h-16 mx-auto text-indigo-500 mb-4 animate-spin"></i><h2 class="text-2xl font-bold text-gray-700">AI sedang bekerja...</h2><p id="loading-text" class="text-gray-500 mt-2">Mohon tunggu sebentar.</p></div></div>`,
    memorize: `
        <div id="memorize-screen" class="screen max-w-3xl"><div class="card"><div class="mb-4"><div class="flex justify-between items-center text-sm text-gray-500 mb-2"><span>Materi <span id="current-memorize-number">1</span> dari <span id="total-memorize-number">1</span></span><span id="memorize-timer-display" class="font-semibold text-lg text-indigo-600">30s</span></div><div class="w-full bg-gray-200 rounded-full h-2.5"><div id="memorize-timer-bar-inner" class="bg-indigo-600 h-2.5 rounded-full" style="width: 100%"></div></div></div><div id="memorize-card-area" class="py-8 min-h-[300px] flex flex-col justify-center relative"></div><div class="flex justify-center mt-4"><button id="start-test-btn" class="bg-green-500 text-white font-bold py-3 px-8 rounded-xl text-lg">Mulai Ujian</button></div></div></div>`,
    test: `
        <div id="test-screen" class="screen max-w-2xl"><div class="card">...</div></div>`, // Tambahkan template lain jika perlu
    results: `
        <div id="results-screen" class="screen max-w-lg"><div class="card text-center">...</div></div>`,
    deck: `
        <div id="deck-screen" class="screen max-w-4xl"><div class="card"><div class="flex justify-between items-center mb-6"><h2 class="text-3xl font-bold">Deck Kartu Belajar</h2><button id="close-deck-btn" class="bg-gray-200 p-2 rounded-full"><i data-lucide="x" class="w-6 h-6"></i></button></div><div id="deck-content" class="space-y-6 max-h-[70vh] overflow-y-auto pr-2"></div></div></div>`
};

export function showScreen(screenId, state) {
    const activeScreen = appContainer.querySelector('.screen.active');
    if (activeScreen && activeScreen.id !== 'deck-screen') {
        state.lastActiveScreenId = activeScreen.id;
    }

    appContainer.innerHTML = screenTemplates[screenId];
    appContainer.querySelector('.screen').classList.add('active');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

export function updateFileName(fileName) {
    const el = document.getElementById('file-name-display');
    if (el) el.textContent = fileName;
}

export function displayChoices(choices, onSelect, onConfirm) {
    const container = document.getElementById('choices-container');
    const confirmBtn = document.getElementById('confirm-choice-btn');
    if (!container || !confirmBtn) return;

    container.innerHTML = '';
    let selectedChoice = null;

    choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn w-full p-4 rounded-lg text-left';
        btn.innerHTML = `<p class="font-semibold text-lg">${choice.title}</p><p class="text-gray-500">${choice.description}</p>`;
        btn.onclick = () => {
            selectedChoice = choice.title;
            document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            confirmBtn.disabled = false;
            onSelect(selectedChoice);
        };
        container.appendChild(btn);
    });

    confirmBtn.onclick = onConfirm;
}

// ... Tambahkan fungsi UI lainnya seperti updateTimer, displayCard, dll ...
