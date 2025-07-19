// deck.js: Mengelola fitur simpan kartu (Deck) dan LocalStorage

import { state } from './state.js';

export function saveCard(cardData) {
    const topicKey = state.topic || "Tanpa Topik";
    if (!state.savedDecks[topicKey]) {
        state.savedDecks[topicKey] = [];
    }
    // Hindari duplikat
    if (!state.savedDecks[topicKey].some(c => c.term === cardData.term)) {
        state.savedDecks[topicKey].push(cardData);
        localStorage.setItem('savedDecks', JSON.stringify(state.savedDecks));
    }
}

export function displayDeck() {
    const contentEl = document.getElementById('deck-content');
    if (!contentEl) return;

    if (Object.keys(state.savedDecks).length === 0) {
        contentEl.innerHTML = `<p class="text-center text-gray-500">Kamu belum menyimpan kartu apa pun.</p>`;
        return;
    }

    let html = '';
    for (const topicKey in state.savedDecks) {
        let cardsHtml = state.savedDecks[topicKey].map(card => `
            <div class="deck-card p-4 rounded-lg shadow-sm mt-3">
                <p class="font-bold text-indigo-700">${card.term}</p>
                <p class="text-gray-600 mt-1">${card.definition}</p>
            </div>
        `).join('');

        html += `
            <div>
                <h3 class="text-xl font-bold text-gray-800">${topicKey}</h3>
                <div class="space-y-2">${cardsHtml}</div>
            </div>
        `;
    }
    contentEl.innerHTML = html;
}
