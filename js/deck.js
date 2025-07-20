/**
 * =====================================================================
 * File: js/deck.js
 * =====================================================================
 *
 * deck.js: Modul Manajemen Pengetahuan Pribadi
 * * Mengelola semua logika yang berhubungan dengan kartu belajar yang disimpan pengguna.
 * * Menerapkan Spaced Repetition System (SRS) untuk sesi belajar yang efisien.
 * * Menyediakan fungsi untuk CRUD (Create, Read, Update, Delete) pada kartu dan deck.
 * * Modul ini sangat bergantung pada 'state' dan 'actions' dari state.js.
 */

// Impor state dan actions dari pusat data aplikasi.
// Kita butuh 'state' untuk membaca data dan 'actions' untuk mengubahnya.
import { state, actions } from './state.js';

// =====================================================================
// KONFIGURASI & KONSTANTA
// =====================================================================

// Interval hari untuk Spaced Repetition System (SRS).
// Level 0: 1 hari, Level 1: 3 hari, Level 2: 7 hari, dst.
const SRS_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

// =====================================================================
// FUNGSI UTAMA: MANAJEMEN KARTU
// =====================================================================

/**
 * Menyimpan sebuah kartu baru ke dalam deck yang sesuai.
 * Ini adalah fungsi utama untuk menambahkan kartu, yang akan memperkaya
 * data kartu dengan metadata penting untuk SRS.
 * @param {object} cardData - Objek kartu dasar, harus berisi { term, definition }.
 */
/**
 * =====================================================================
 * File: js/deck.js (Perbaikan)
 * =====================================================================
 */

// ... (kode lainnya tetap sama) ...

/**
 * Menyimpan sebuah kartu baru ke dalam deck yang sesuai.
 * Ini adalah fungsi utama untuk menambahkan kartu, yang akan memperkaya
 * data kartu dengan metadata penting untuk SRS.
 * @param {object} cardData - Objek kartu dasar, harus berisi { term, definition }.
 * @param {string} deckName - Nama dek tujuan kartu. <--- PERBAIKAN
 */
export function saveNewCard(cardData, deckName) { // TERIMA PARAMETER deckName
    // Buat objek kartu baru dengan struktur data yang diperkaya.
    const newCard = {
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // ID unik
        term: cardData.term,
        definition: cardData.definition,
        dateSaved: new Date().toISOString(),
        masteryLevel: 0, // Mulai dari level 0 (Baru)
        nextReviewDate: new Date().toISOString(), // Jadwalkan untuk di-review segera
    };

    // Panggil action dari state.js untuk menyimpan kartu ini.
    // Pastikan deckName diteruskan ke state management.
    actions.saveCardToDeck(newCard, deckName); // <-- PERBAIKAN DI SINI
}

// ... (sisa kode di deck.js tidak perlu diubah) ...
    };

    // Panggil action dari state.js untuk menyimpan kartu ini.
    // Ini memastikan perubahan state terjadi secara aman dan terpusat.
    actions.saveCardToDeck(newCard);
}

/**
 * Memperbarui tingkat penguasaan (mastery) dan jadwal review kartu
 * berdasarkan jawaban pengguna dalam sesi belajar.
 * @param {string} deckName - Nama deck tempat kartu berada.
 * @param {string} cardId - ID unik dari kartu yang di-review.
 * @param {boolean} wasCorrect - Apakah jawaban pengguna untuk kartu ini benar.
 */
export function updateCardMastery(deckName, cardId, wasCorrect) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck) return;

    const cardIndex = deck.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    // Buat salinan kartu untuk dimodifikasi (prinsip immutability)
    let updatedCard = { ...deck[cardIndex] };
    
    if (wasCorrect) {
        // Jika benar, naikkan level penguasaan.
        updatedCard.masteryLevel = Math.min(updatedCard.masteryLevel + 1, SRS_INTERVALS.length - 1);
    } else {
        // Jika salah, turunkan level penguasaan.
        updatedCard.masteryLevel = Math.max(updatedCard.masteryLevel - 1, 0);
    }

    // Hitung tanggal review berikutnya berdasarkan level baru.
    const intervalDays = SRS_INTERVALS[updatedCard.masteryLevel];
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + intervalDays);
    updatedCard.nextReviewDate = nextReview.toISOString();

    // Panggil action untuk memperbarui kartu di dalam state.
    actions.updateCardInDeck(deckName, cardIndex, updatedCard);
}

// =====================================================================
// FITUR BELAJAR & SESI
// =====================================================================

/**
 * Menyiapkan dan mengembalikan daftar kartu untuk sesi belajar dari sebuah deck.
 * Kartu diprioritaskan berdasarkan jadwal review (due date) dan tingkat penguasaan.
 * @param {string} deckName - Nama deck yang akan dipelajari.
 * @returns {Array<object>} Daftar kartu yang sudah diurutkan untuk sesi belajar.
 */
export function startDeckStudySession(deckName) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck || deck.length === 0) return [];

    const now = new Date();

    // Urutkan kartu dengan logika prioritas:
    // 1. Kartu yang sudah waktunya di-review (paling utama).
    // 2. Jika sama-sama sudah/belum waktunya, prioritaskan yang levelnya lebih rendah.
    return [...deck].sort((a, b) => {
        const aIsDue = new Date(a.nextReviewDate) <= now;
        const bIsDue = new Date(b.nextReviewDate) <= now;

        if (aIsDue && !bIsDue) return -1; // Kartu 'a' lebih prioritas.
        if (!aIsDue && bIsDue) return 1;  // Kartu 'b' lebih prioritas.

        // Jika status 'due' sama, urutkan berdasarkan mastery level (terendah dulu).
        return a.masteryLevel - b.masteryLevel;
    });
}

// =====================================================================
// FITUR MANAJEMEN DECK & KARTU (Quality of Life)
// =====================================================================

/**
 * Menghapus sebuah kartu spesifik dari sebuah deck.
 * @param {string} deckName - Nama deck.
 * @param {string} cardId - ID kartu yang akan dihapus.
 */
export function deleteCard(deckName, cardId) {
    actions.removeCardFromDeck(deckName, cardId);
}

/**
 * Memperbarui konten (term dan definition) dari sebuah kartu.
 * @param {string} deckName - Nama deck.
 * @param {string} cardId - ID kartu yang akan diubah.
 * @param {object} newContent - Objek berisi { newTerm, newDefinition }.
 */
export function updateCardContent(deckName, cardId, newContent) {
    actions.editCardInDeck(deckName, cardId, newContent);
}

/**
 * Mengubah nama sebuah deck.
 * @param {string} oldName - Nama deck saat ini.
 * @param {string} newName - Nama baru untuk deck.
 * @returns {boolean} True jika berhasil, false jika gagal (misal, nama baru sudah ada).
 */
export function renameDeck(oldName, newName) {
    if (!newName || oldName === newName || state.userData.savedDecks[newName]) {
        console.error("Gagal mengubah nama: Nama baru tidak valid atau sudah ada.");
        return false;
    }
    actions.renameDeckInState(oldName, newName);
    return true;
}

/**
 * Menghapus seluruh deck beserta semua kartunya.
 * @param {string} deckName - Nama deck yang akan dihapus.
 */
export function deleteDeck(deckName) {
    actions.removeDeckFromState(deckName);
}

// =====================================================================
// FITUR LANJUTAN: IMPORT & EXPORT
// =====================================================================

/**
 * Mengekspor semua kartu dalam sebuah deck menjadi file JSON yang bisa diunduh.
 * @param {string} deckName - Nama deck yang akan diekspor.
 */
export function exportDeckAsJson(deckName) {
    const deck = state.userData.savedDecks[deckName];
    if (!deck) {
        console.error(`Deck dengan nama "${deckName}" tidak ditemukan.`);
        return;
    }

    // Ubah data array of objects menjadi string JSON yang rapi (diberi spasi 2).
    const jsonString = JSON.stringify(deck, null, 2);
    
    // Buat 'blob' (binary large object) dari string JSON.
    const blob = new Blob([jsonString], { type: "application/json" });
    
    // Buat URL sementara untuk blob tersebut.
    const url = URL.createObjectURL(blob);
    
    // Buat elemen link <a> palsu di memori.
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deckName.replace(/\s+/g, '_')}_deck.json`; // Nama file unduhan
    
    // Tambahkan link ke body, klik secara otomatis, lalu hapus lagi.
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Hapus URL sementara dari memori untuk mencegah memory leak.
    URL.revokeObjectURL(url);
}

/**
 * Mengimpor kartu dari file JSON yang dipilih pengguna.
 * @param {File} file - File JSON yang di-upload pengguna.
 * @param {string} deckName - Nama deck tujuan untuk kartu yang diimpor.
 * @returns {Promise<number>} Jumlah kartu yang berhasil diimpor.
 */
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
                    // Validasi sederhana untuk memastikan kartu punya properti dasar
                    if (card.term && card.definition) {
                        // Gunakan fungsi saveNewCard agar setiap kartu impor
                        // juga mendapatkan metadata SRS yang lengkap.
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
