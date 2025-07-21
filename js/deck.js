// File: js/deck.js (FULL CODE - FINAL FIX)
import { state, actions } from './state.js';

// Konstanta untuk interval Spaced Repetition (dalam hari)
const SRS_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

/**
 * Menyimpan kartu baru ke dek dengan semua data yang diperlukan.
 * @param {object} cardData - Objek kartu dari respons AI.
 * @param {string} deckName - Nama dek tujuan.
 */
export function saveNewCard(cardData, deckName) {
    // PERBAIKAN UTAMA: Pastikan semua field ada sebelum disimpan
    const newCard = {
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        term: cardData.term || 'Istilah Kosong',
        simple_definition: cardData.simple_definition || 'Definisi tidak tersedia.',
        // Beri nilai default string kosong jika tidak ada dari AI
        analogy_or_example: cardData.analogy_or_example || '',
        active_recall_question: cardData.active_recall_question || `Apa yang kamu ketahui tentang ${cardData.term}?`,
        question_clue: cardData.question_clue || '',
        // Data untuk Spaced Repetition (SRS)
        dateSaved: new Date().toISOString(),
        masteryLevel: 0,
        nextReviewDate: new Date().toISOString(),
    };
    actions.saveCardToDeck(newCard, deckName);
}

/**
 * Memperbarui tingkat penguasaan dan jadwal review kartu.
 * @param {string} deckName - Nama dek.
 * @param {string} cardId - ID kartu yang akan diperbarui.
 * @param {boolean} wasCorrect - Apakah pengguna menjawab dengan benar.
 */
export function updateCardMastery(deckName, cardId, wasCorrect) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck) return;

    const cardIndex = deck.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    let updatedCard = { ...deck[cardIndex] };

    if (wasCorrect) {
        // Naikkan level penguasaan, maksimal sampai level terakhir di interval SRS
        updatedCard.masteryLevel = Math.min(updatedCard.masteryLevel + 1, SRS_INTERVALS.length - 1);
    } else {
        // Turunkan level penguasaan, minimal 0
        updatedCard.masteryLevel = Math.max(updatedCard.masteryLevel - 1, 0);
    }

    const intervalDays = SRS_INTERVALS[updatedCard.masteryLevel];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);
    updatedCard.nextReviewDate = nextReview.toISOString();

    actions.updateCardInDeck(deckName, cardIndex, updatedCard);
}

/**
 * Memulai sesi belajar untuk sebuah dek.
 * Mengembalikan kartu yang diurutkan berdasarkan tanggal review dan tingkat penguasaan.
 * @param {string} deckName - Nama dek yang akan dipelajari.
 * @returns {Array} - Daftar kartu yang sudah diurutkan.
 */
export function startDeckStudySession(deckName) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck || deck.length === 0) return [];

    const now = new Date();
    // Urutkan kartu: yang sudah jatuh tempo paling atas, lalu yang paling jarang dipelajari.
    return [...deck].sort((a, b) => {
        const aIsDue = new Date(a.nextReviewDate) <= now;
        const bIsDue = new Date(b.nextReviewDate) <= now;

        if (aIsDue && !bIsDue) return -1; // Kartu A lebih prioritas
        if (!aIsDue && bIsDue) return 1;  // Kartu B lebih prioritas

        // Jika keduanya sama-sama jatuh tempo (atau belum), urutkan berdasarkan level penguasaan
        return a.masteryLevel - b.masteryLevel;
    });
}

// --- FUNGSI MANAJEMEN DEK LAINNYA (TIDAK ADA PERUBAHAN) ---

export function deleteCard(deckName, cardId) {
    actions.removeCardFromDeck(deckName, cardId);
}

export function updateCardContent(deckName, cardId, newContent) {
    actions.editCardInDeck(deckName, cardId, newContent);
}

export function renameDeck(oldName, newName) {
    if (!newName || newName.trim() === "" || oldName === newName || state.userData.savedDecks[newName]) {
        console.error("Gagal mengubah nama: Nama baru tidak valid atau sudah ada.");
        return false;
    }
    actions.renameDeckInState(oldName, newName);
    return true;
}

export function deleteDeck(deckName) {
    actions.removeDeckFromState(deckName);
}

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
                    throw new Error("Format JSON tidak valid.");
                }
                let importedCount = 0;
                importedCards.forEach(card => {
                    // Pastikan kartu yang diimpor memiliki data minimal
                    if (card.term && (card.definition || card.simple_definition)) {
                        saveNewCard({
                            term: card.term,
                            simple_definition: card.simple_definition || card.definition,
                            analogy_or_example: card.analogy_or_example,
                            active_recall_question: card.active_recall_question,
                            question_clue: card.question_clue
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
