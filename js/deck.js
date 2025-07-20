/**
 * =====================================================================
 * File: js/deck.js (Versi Final - SUDAH DIPERBAIKI)
 * =====================================================================
 *
 * deck.js: Modul Manajemen Pengetahuan Pribadi
 * * Mengelola semua logika yang berhubungan dengan kartu belajar yang disimpan pengguna.
 * * Menerapkan Spaced Repetition System (SRS) untuk sesi belajar yang efisien.
 * * Menyediakan fungsi untuk CRUD (Create, Read, Update, Delete) pada kartu dan deck.
 * * Modul ini sangat bergantung pada 'state' dan 'actions' dari state.js.
 */

// Impor state dan actions dari pusat data aplikasi.
import { state, actions } from './state.js';

// =====================================================================
// KONFIGURASI & KONSTANTA
// =====================================================================

const SRS_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

// =====================================================================
// FUNGSI UTAMA: MANAJEMEN KARTU
// =====================================================================

/**
 * Menyimpan sebuah kartu baru ke dalam deck yang sesuai.
 * @param {object} cardData - Objek kartu dasar, harus berisi { term, definition }.
 * @param {string} deckName - Nama dek tujuan kartu.
 */
export function saveNewCard(cardData, deckName) {
    const newCard = {
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        term: cardData.term,
        definition: cardData.definition,
        dateSaved: new Date().toISOString(),
        masteryLevel: 0,
        nextReviewDate: new Date().toISOString(),
    };
    // Panggil action dari state.js untuk menyimpan kartu ini, pastikan deckName disertakan.
    actions.saveCardToDeck(newCard, deckName);
}

/**
 * Memperbarui tingkat penguasaan (mastery) dan jadwal review kartu.
 * @param {string} deckName - Nama deck tempat kartu berada.
 * @param {string} cardId - ID unik dari kartu yang di-review.
 * @param {boolean} wasCorrect - Apakah jawaban pengguna untuk kartu ini benar.
 */
export function updateCardMastery(deckName, cardId, wasCorrect) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck) return;

    const cardIndex = deck.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    let updatedCard = { ...deck[cardIndex] };
    
    if (wasCorrect) {
        updatedCard.masteryLevel = Math.min(updatedCard.masteryLevel + 1, SRS_INTERVALS.length - 1);
    } else {
        updatedCard.masteryLevel = Math.max(updatedCard.masteryLevel - 1, 0);
    }

    const intervalDays = SRS_INTERVALS[updatedCard.masteryLevel];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);
    updatedCard.nextReviewDate = nextReview.toISOString();

    actions.updateCardInDeck(deckName, cardIndex, updatedCard);
}

// =====================================================================
// FITUR BELAJAR & SESI
// =====================================================================

/**
 * Menyiapkan daftar kartu untuk sesi belajar dari sebuah deck.
 * @param {string} deckName - Nama deck yang akan dipelajari.
 * @returns {Array<object>} Daftar kartu yang sudah diurutkan.
 */
export function startDeckStudySession(deckName) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck || deck.length === 0) return [];

    const now = new Date();

    return [...deck].sort((a, b) => {
        const aIsDue = new Date(a.nextReviewDate) <= now;
        const bIsDue = new Date(b.nextReviewDate) <= now;

        if (aIsDue && !bIsDue) return -1;
        if (!aIsDue && bIsDue) return 1;

        return a.masteryLevel - b.masteryLevel;
    });
}

// =====================================================================
// FITUR MANAJEMEN DECK & KARTU
// =====================================================================

export function deleteCard(deckName, cardId) {
    actions.removeCardFromDeck(deckName, cardId);
}

export function updateCardContent(deckName, cardId, newContent) {
    actions.editCardInDeck(deckName, cardId, newContent);
}

export function renameDeck(oldName, newName) {
    if (!newName || oldName === newName || state.userData.savedDecks[newName]) {
        console.error("Gagal mengubah nama: Nama baru tidak valid atau sudah ada.");
        return false;
    }
    actions.renameDeckInState(oldName, newName);
    return true;
}

export function deleteDeck(deckName) {
    actions.removeDeckFromState(deckName);
}

// =====================================================================
// FITUR LANJUTAN: IMPORT & EXPORT
// =====================================================================

export function exportDeckAsJson(deckName) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck) {
        console.error(`Deck dengan nama "${deckName}" tidak ditemukan.`);
        return;
    }
    const jsonString = JSON.stringify(deck, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckName.replace(/\s+/g, '_')}_deck.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importDeckFromJson(file, deckName) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedCards = JSON.parse(event.target.result);
                if (!Array.isArray(importedCards)) {
                    throw new Error("Format JSON tidak valid, harus berupa array kartu.");
                }
                
                let importedCount = 0;
                importedCards.forEach(card => {
                    if (card.term && card.definition) {
                        saveNewCard({ term: card.term, definition: card.definition }, deckName);
                        importedCount++;
                    }
                });
                resolve(importedCount);

            } catch (error) {
                reject(new Error(`Gagal membaca file JSON: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error("Tidak bisa membaca file."));
        reader.readAsText(file);
    });
}
