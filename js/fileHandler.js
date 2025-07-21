/**
 * =====================================================================
 * File: js/fileHandler.js (VERSI DIPERBARUI)
 * =====================================================================
 *
 * fileHandler.js: Modul Pengelola Input File (Manajer)
 * * PERUBAHAN: Mengubah cara Worker dipanggil agar mendukung modul JavaScript modern (ESM).
 * * Bertanggung jawab untuk semua interaksi UI yang berhubungan dengan upload file.
 * * Menggunakan Web Worker untuk memproses file di background thread agar UI tetap responsif.
 * * Menerima file dari pengguna dan mendelegasikannya ke fileProcessor.worker.js.
 */

/**
 * Menyiapkan event listener untuk area upload file (drag-drop dan klik).
 * Fungsi ini harus dipanggil sekali saat layar 'start' ditampilkan.
 * @param {Function} onFileUpdate - Callback yang dipanggil setiap kali status pemrosesan file berubah.
 * Callback ini akan menerima objek seperti { status: 'processing'|'ready'|'error', ...data }
 */
export function setupFileHandling(onFileUpdate) {
    const uploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('file-input');
    
    // Jika elemen tidak ditemukan, hentikan eksekusi untuk mencegah error.
    if (!uploadArea || !fileInput) {
        console.warn("Elemen untuk upload file tidak ditemukan di DOM.");
        return;
    }

    // Handler untuk event drag-and-drop
    const dragDropHandler = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Mencegah event menyebar ke elemen lain

        if (e.type === 'dragover') {
            uploadArea.classList.add('drag-over'); // Tambahkan efek visual saat file di atas area
        } else {
            uploadArea.classList.remove('drag-over'); // Hapus efek visual
        }

        if (e.type === 'drop') {
            if (e.dataTransfer.files.length > 0) {
                // Proses file pertama yang di-drop oleh pengguna
                processFile(e.dataTransfer.files[0], onFileUpdate);
            }
        }
    };

    // Menambahkan event listener ke area upload
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', dragDropHandler);
    uploadArea.addEventListener('dragleave', dragDropHandler);
    uploadArea.addEventListener('drop', dragDropHandler);
    
    // Menambahkan event listener ke input file tersembunyi
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processFile(e.target.files[0], onFileUpdate);
        }
    });
}

/**
 * Memproses file yang dipilih oleh pengguna dengan mendelegasikannya ke Web Worker.
 * @param {File} file - Objek file yang akan diproses.
 * @param {Function} callback - Callback untuk melaporkan status kembali ke main.js.
 */
function processFile(file, callback) {
    // Lakukan validasi awal di sini (di main thread) untuk memberikan feedback cepat.
    if (file.size > 20 * 1024 * 1024) { // Batas ukuran file 20MB
        callback({ status: 'error', message: 'Ukuran file melebihi batas (20MB).' });
        return;
    }

    // Cek apakah browser mendukung Web Worker
    if (window.Worker) {
        // Laporkan status 'processing' ke UI agar pengguna tahu sesuatu sedang terjadi.
        callback({ status: 'processing', name: file.name });
        
        // Buat instance worker baru dari file eksternal.
        // Tambahkan { type: 'module' } agar worker bisa menggunakan 'import'.
        const worker = new Worker('./js/fileProcessor.worker.js', { type: 'module' });

        // Kirim objek 'File' ke worker untuk diproses di latar belakang.
        worker.postMessage(file);

        // Siapkan listener untuk menerima pesan balasan dari worker.
        worker.onmessage = (event) => {
            const { status, content, preview, message, progress, details } = event.data;
            
            // Teruskan hasil dari worker ke callback (yang akan ditangani di main.js)
            if (status === 'ready') {
                callback({ status: 'ready', content, preview });
                // Hentikan worker setelah selesai untuk melepaskan memori.
                worker.terminate();
            } else if (status === 'progress') {
                // Kamu bisa menambahkan logika untuk menampilkan progress bar di sini jika mau
                console.log(`Progress: ${progress}% - ${details}`);
            } else if (status === 'error') {
                 callback({ status: 'error', message });
                 worker.terminate();
            }
        };

        // Siapkan listener untuk menangani error yang mungkin terjadi di dalam worker.
        worker.onerror = (error) => {
            callback({ status: 'error', message: `Terjadi error pada worker: ${error.message}` });
            worker.terminate();
        };

    } else {
        // Fallback jika browser tidak mendukung Web Workers.
        // Ini memastikan aplikasi tidak crash di browser lama.
        console.warn("Browser tidak mendukung Web Workers, pemrosesan mungkin membuat UI lag.");
        callback({ status: 'error', message: 'Browser-mu tidak mendukung pemrosesan file di latar belakang.' });
    }
}
