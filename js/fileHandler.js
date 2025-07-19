// fileHandler.js: Logika untuk upload dan membaca file

export function setupFileHandling(onFileProcessed) {
    const uploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('file-input');
    if (!uploadArea || !fileInput) return;

    uploadArea.onclick = () => fileInput.click();
    uploadArea.ondragover = (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); };
    uploadArea.ondragleave = () => uploadArea.classList.remove('drag-over');
    uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0], onFileProcessed);
    };
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) processFile(e.target.files[0], onFileProcessed);
    };
}

async function processFile(file, callback) {
    callback({ status: 'processing', name: file.name });
    try {
        let text = '';
        if (file.type === 'application/pdf') {
            text = await extractTextFromPdf(file);
        } else if (file.name.endsWith('.docx')) {
            text = await extractTextFromDocx(file);
        } else {
            throw new Error('Format file tidak didukung.');
        }
        callback({ status: 'ready', name: file.name, text });
    } catch (error) {
        callback({ status: 'error', message: error.message });
    }
}

async function extractTextFromPdf(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
            try {
                const pdf = await pdfjsLib.getDocument({ data: event.target.result }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    fullText += content.items.map(item => item.str).join(' ') + '\n';
                }
                resolve(fullText);
            } catch (e) { reject(e); }
        };
        reader.readAsArrayBuffer(file);
    });
}

async function extractTextFromDocx(file) {
     const arrayBuffer = await file.arrayBuffer();
     const result = await mammoth.extractRawText({ arrayBuffer });
     return result.value;
}
