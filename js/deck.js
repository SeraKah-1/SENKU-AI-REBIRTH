/**
 * =====================================================================
 * File: js/deck.js (Versi Final - Diperbaiki)
 * =====================================================================
 * FIX: Memperbaiki fungsi saveNewCard agar menyimpan semua data penting
 * dari AI (simple_definition, analogy_or_example, dll.) untuk mencegah
 * bug 'undefined' saat dek dipelajari kembali.
 */
import { state, actions } from './state.js';

// Interval hari untuk Spaced Repetition System (SRS)
const SRS_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

/**
 * Menyimpan kartu baru yang dibuat AI ke dalam dek.
 * @param {object} cardData - Objek kartu lengkap dari AI.
 * @param {string} deckName - Nama dek tujuan.
 */
export function saveNewCard(cardData, deckName) {
    // FIX: Memastikan semua data dari AI tersimpan dengan benar.
    const newCard = {
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        term: cardData.term,
        simple_definition: cardData.simple_definition, // Data penting
        analogy_or_example: cardData.analogy_or_example, // Data penting
        active_recall_question: cardData.active_recall_question, // Data penting
        question_clue: cardData.question_clue, // Data penting
        
        // Properti untuk sistem SRS (tidak berubah)
        dateSaved: new Date().toISOString(),
        masteryLevel: 0,
        nextReviewDate: new Date().toISOString(),
    };
    actions.saveCardToDeck(newCard, deckName);
}

/**
 * Memperbarui tingkat penguasaan (mastery) kartu berdasarkan jawaban pengguna.
 * @param {string} deckName - Nama dek.
 * @param {string} cardId - ID kartu.
 * @param {boolean} wasCorrect - Apakah pengguna menjawab dengan benar.
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

/**
 * Memulai sesi belajar untuk dek, mengurutkan kartu berdasarkan jadwal review.
 * @param {string} deckName - Nama dek yang akan dipelajari.
 * @returns {Array} Daftar kartu yang sudah diurutkan.
 */
export function startDeckStudySession(deckName) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck || deck.length === 0) return [];

    const now = new Date();
    // Urutkan kartu: yang sudah jatuh tempo & tingkat penguasaan terendah akan muncul duluan.
    return [...deck].sort((a, b) => {
        const aIsDue = new Date(a.nextReviewDate) <= now;
        const bIsDue = new Date(b.nextReviewDate) <= now;
        if (aIsDue && !bIsDue) return -1;
        if (!aIsDue && bIsDue) return 1;
        return a.masteryLevel - b.masteryLevel;
    });
}

/** Menghapus satu kartu dari dek. */
export function deleteCard(deckName, cardId) {
    actions.removeCardFromDeck(deckName, cardId);
}

/** Memperbarui konten sebuah kartu. */
export function updateCardContent(deckName, cardId, newContent) {
    actions.editCardInDeck(deckName, cardId, newContent);
}

/** Mengganti nama sebuah dek. */
export function renameDeck(oldName, newName) {
    if (!newName || oldName === newName || state.userData.savedDecks[newName]) {
        console.error("Gagal mengubah nama: Nama baru tidak valid atau sudah ada.");
        return false;
    }
    actions.renameDeckInState(oldName, newName);
    return true;
}

/** Menghapus seluruh dek. */
export function deleteDeck(deckName) {
    actions.removeDeckFromState(deckName);
}

/** Mengekspor dek sebagai file JSON. */
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

/** Mengimpor dek dari file JSON. */
export async function importDeckFromJson(file, deckName) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedCards = JSON.parse(event.target.result);
                if (!Array.isArray(importedCards)) {
                    throw new Error("Format JSON tidak valid.");
                }
                let importedCount = 0;
                importedCards.forEach(card => {
                    // Pastikan kartu yang diimpor memiliki data minimal
                    if (card.term && (card.definition || card.simple_definition)) {
                        saveNewCard({
                            term: card.term,
                            simple_definition: card.simple_definition || card.definition
                        }, deckName);
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
