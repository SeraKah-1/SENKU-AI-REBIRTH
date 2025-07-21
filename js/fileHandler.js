/**
 * =====================================================================
 * File: js/fileHandler.js (VERSI DIPERBARUI & DIBUAT LEBIH ROBUST)
 * =====================================================================
 *
 * Deskripsi: Modul ini bertanggung jawab untuk menangani interaksi pengguna
 * dengan elemen upload file di UI. Ia menerima file, melakukan validasi
 * awal, lalu mendelegasikannya ke 'fileProcessor.worker.js' untuk
 * pemrosesan di latar belakang.
 *
 * PERUBAHAN PENTING:
 * 1.  Worker Instantiation: Worker sekarang dibuat dengan opsi `{ type: 'module' }`.
 * Ini SANGAT PENTING agar worker dapat menggunakan sintaks `import` untuk
 * memuat library dari CDN.
 * 2.  Robust Callbacks: Logika callback disederhanakan untuk memastikan semua
 * status (processing, progress, ready, error) diteruskan kembali ke UI.
 * 3.  Complete Error Handling: Menambahkan listener `worker.onerror` untuk
 * menangkap masalah yang lebih dalam, seperti jika file worker itu sendiri
 * tidak dapat ditemukan atau mengalami crash.
 */

/**
 * Menyiapkan event listener untuk area upload file (drag-drop dan klik).
 * @param {Function} onFileUpdate - Callback yang dipanggil setiap kali ada update
 * status dari pemrosesan file.
 */
export function setupFileHandling(onFileUpdate) {
    const uploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput) {
        console.warn("Peringatan: Elemen UI untuk upload file tidak ditemukan. Fitur upload file tidak akan aktif.");
        return;
    }

    const handleDragEvent = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragover') {
            uploadArea.classList.add('drag-over'); // Efek visual
        } else {
            uploadArea.classList.remove('drag-over');
        }
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0], onFileUpdate);
        }
    };

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragEvent);
    uploadArea.addEventListener('dragleave', handleDragEvent);
    uploadArea.addEventListener('drop', handleFileDrop);

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            processFile(files[0], onFileUpdate);
        }
    });
}

/**
 * Memvalidasi file dan mengirimkannya ke Web Worker untuk diproses.
 * @param {File} file - Objek file dari input pengguna.
 * @param {Function} onFileUpdate - Callback untuk melaporkan status kembali ke main.js.
 */
function processFile(file, onFileUpdate) {
    // Validasi awal di main thread untuk feedback instan
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_FILE_SIZE) {
        onFileUpdate({ status: 'error', message: 'Ukuran file terlalu besar (maks 25MB).' });
        return;
    }

    // Cek dukungan Web Worker di browser
    if (!window.Worker) {
        onFileUpdate({ status: 'error', message: 'Browser ini tidak mendukung pemrosesan file di latar belakang.' });
        console.error("Browser tidak mendukung Web Workers.");
        return;
    }

    try {
        // Laporkan status awal ke UI
        onFileUpdate({ status: 'processing', name: file.name });

        // PENTING: Buat instance worker dengan '{ type: 'module' }'
        const worker = new Worker('./js/fileProcessor.worker.js', { type: 'module' });

        // Kirim file ke worker untuk diproses
        worker.postMessage(file);

        // Listener untuk menerima pesan dari worker
        worker.onmessage = (event) => {
            const result = event.data;
            // Teruskan pesan apa pun dari worker ke UI
            onFileUpdate(result);

            // Hentikan worker jika tugasnya sudah selesai (berhasil atau gagal)
            if (result.status === 'ready' || result.status === 'error') {
                worker.terminate();
            }
        };

        // Listener untuk menangani error jika worker crash
        worker.onerror = (error) => {
            console.error("Terjadi error fatal pada worker:", error);
            onFileUpdate({ status: 'error', message: `Gagal memuat pemroses file: ${error.message}` });
            worker.terminate();
        };

    } catch (e) {
         onFileUpdate({ status: 'error', message: `Gagal memulai pemroses file: ${e.message}` });
    }
}
