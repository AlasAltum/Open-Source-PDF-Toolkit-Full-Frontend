// DOM Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const browseBtn = document.getElementById('browseBtn');
const fileListContainer = document.getElementById('fileList');
const processActionBtn = document.getElementById('processActionBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingText = document.getElementById('loadingText');

// PDF Editor Modal Elements
const pdfEditorModal = document.getElementById('pdfEditorModal');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const compressBtn = document.getElementById('compressBtn');
const cropBtn = document.getElementById('cropBtn');
const removeCommentsBtn = document.getElementById('removeCommentsBtn');
const removeMetadataBtn = document.getElementById('removeMetadataBtn');
const deletePageBtn = document.getElementById('deletePageBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfoDisplay = document.getElementById('pageInfo');
const pdfCanvas = document.getElementById('pdfCanvas');
const cropControlsContainer = document.getElementById('cropControlsContainer');
const cropTopInput = document.getElementById('cropTop');
const cropBottomInput = document.getElementById('cropBottom');
const cropLeftInput = document.getElementById('cropLeft');
const cropRightInput = document.getElementById('cropRight');
const applyCropBtn = document.getElementById('applyCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const savePdfChangesBtn = document.getElementById('savePdfChangesBtn');
const cancelEditorBtn = document.getElementById('cancelEditorBtn');

// Confirmation Modal Elements
const confirmationModal = document.getElementById('confirmationModal');
const confirmationTitle = document.getElementById('confirmationTitle');
const confirmationMessage = document.getElementById('confirmationMessage');
const confirmYesBtn = document.getElementById('confirmYesBtn');
const confirmNoBtn = document.getElementById('confirmNoBtn');
const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');
let confirmCallback = null;


// State variables
let selectedFiles = []; // Stores original File objects or modified ArrayBuffers/Blobs
let currentEditingFileIndex = -1; // Index in selectedFiles
let currentPdfDocInstance = null; // pdf.js document instance
let currentPageNum = 1;
let totalPagesInCurrentDoc = 1;
let pdfRenderTask = null; // pdf.js render task
let isMetadataRemoved = false; // Track if metadata has been removed

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleFileDrop);
dropZone.addEventListener('click', () => fileInput.click());
processActionBtn.addEventListener('click', processFiles);

// Editor Listeners
closeEditorBtn.addEventListener('click', closePdfEditor);
cancelEditorBtn.addEventListener('click', closePdfEditor);
savePdfChangesBtn.addEventListener('click', savePdfChanges);
rotateLeftBtn.addEventListener('click', () => rotateCurrentPdfPage(-90));
rotateRightBtn.addEventListener('click', () => rotateCurrentPdfPage(90));
compressBtn.addEventListener('click', compressCurrentPdf);
cropBtn.addEventListener('click', showCropControls);
removeCommentsBtn.addEventListener('click', removeCommentsFromCurrentPdf);
removeMetadataBtn.addEventListener('click', removeMetadataFromCurrentPdf);
deletePageBtn.addEventListener('click', () => {
     if (totalPagesInCurrentDoc <= 1) {
        showCustomNotification('Cannot delete the only page.', 'error');
        return;
    }
    showConfirmation('Delete Page', `Are you sure you want to delete page ${currentPageNum}? This action cannot be undone.`, deleteCurrentPdfPage);
});
prevPageBtn.addEventListener('click', showPreviousPage);
nextPageBtn.addEventListener('click', showNextPage);
applyCropBtn.addEventListener('click', applyCropToCurrentPdf);
cancelCropBtn.addEventListener('click', hideCropControls);

// Confirmation Modal Listeners
confirmYesBtn.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    hideConfirmation();
});
confirmNoBtn.addEventListener('click', hideConfirmation);
closeConfirmModalBtn.addEventListener('click', hideConfirmation);


// File Handling Functions
function handleFileSelect(event) {
    const files = Array.from(event.target.files).filter(file => file.type === 'application/pdf');
    addFilesToList(files);
    // CRITICAL: Reset input value to allow selecting the same file again.
    // This addresses the common scenario where a file input might seem to ignore
    // re-selection of the exact same file because its 'value' hasn't changed.
    event.target.value = '';
}

function handleDragOver(event) {
    event.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleFileDrop(event) {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(event.dataTransfer.files).filter(file => file.type === 'application/pdf');
    if (files.length > 0) {
        addFilesToList(files);
    }
}

function addFilesToList(newFiles) {
    newFiles.forEach(file => {
        if (!selectedFiles.some(existingFile => existingFile.name === file.name && existingFile.size === file.size)) {
            selectedFiles.push(file);
        }
    });
    renderFileList();
    updateProcessActionButton();
}

function renderFileList() {
    fileListContainer.innerHTML = '';
    selectedFiles.forEach((fileData, index) => {
        const file = (fileData instanceof File) ? fileData : new File([fileData.arrayBuffer || fileData.blob], fileData.name, {type: 'application/pdf'});

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.index = index;
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-number">${index + 1}</div>
                <span class="file-icon">📄</span>
                <div class="file-details">
                    <h4>${escapeHtml(file.name)}</h4>
                    <p>${formatFileSize(file.size)}</p>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-edit" title="Edit PDF"><span class="btn-icon">✏️</span> Edit</button>
                <button class="btn btn-up" title="Move Up" ${index === 0 ? 'disabled' : ''}><span class="btn-icon">↑</span></button>
                <button class="btn btn-down" title="Move Down" ${index === selectedFiles.length - 1 ? 'disabled' : ''}><span class="btn-icon">↓</span></button>
                <button class="btn btn-remove" title="Remove PDF"><span class="btn-icon">✕</span></button>
            </div>
        `;
        fileItem.querySelector('.btn-edit').addEventListener('click', () => openPdfEditor(index));
        fileItem.querySelector('.btn-up').addEventListener('click', () => moveFile(index, -1));
        fileItem.querySelector('.btn-down').addEventListener('click', () => moveFile(index, 1));
        fileItem.querySelector('.btn-remove').addEventListener('click', () => removeFile(index));

        fileListContainer.appendChild(fileItem);
    });
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    updateProcessActionButton();
}

function moveFile(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < selectedFiles.length) {
        [selectedFiles[index], selectedFiles[newIndex]] = [selectedFiles[newIndex], selectedFiles[index]];
        renderFileList();
    }
}

function updateProcessActionButton() {
    const numFiles = selectedFiles.length;
    if (numFiles === 0) {
        processActionBtn.disabled = true;
        processActionBtn.innerHTML = '🚀 Merge PDFs';
    } else if (numFiles === 1) {
        processActionBtn.disabled = false;
        processActionBtn.innerHTML = '📄 Create PDF';
    } else {
        processActionBtn.disabled = false;
        processActionBtn.innerHTML = '🚀 Merge PDFs';
    }
}

async function processFiles() {
    if (selectedFiles.length === 0) return;

    processActionBtn.style.display = 'none';
    loadingIndicator.style.display = 'flex';

    try {
        let resultFileName = 'processed-document.pdf';
        let finalPdfBytes;

        if (selectedFiles.length === 1) {
            loadingText.textContent = 'Processing your PDF...';
            const fileData = selectedFiles[0];
            const arrayBuffer = (fileData instanceof File) ? await fileData.arrayBuffer() : fileData.arrayBuffer || await fileData.blob.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            finalPdfBytes = await pdfDoc.save();
            resultFileName = selectedFiles[0].name.replace(/\.pdf$/i, '') + '-processed.pdf';
            showCustomNotification('✅ PDF processed successfully!', 'success');
        } else {
            loadingText.textContent = 'Merging your PDFs...';
            const mergedPdf = await PDFLib.PDFDocument.create();
            for (const fileData of selectedFiles) {
                 const arrayBuffer = (fileData instanceof File) ? await fileData.arrayBuffer() : fileData.arrayBuffer || await fileData.blob.arrayBuffer();
                const pdfToMerge = await PDFLib.PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
                copiedPages.forEach(page => mergedPdf.addPage(page));
            }
            finalPdfBytes = await mergedPdf.save();
            resultFileName = 'merged-document.pdf';
            showCustomNotification('✅ PDFs merged successfully!', 'success');
        }

        const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Error processing PDFs:', error);
        showCustomNotification(`❌ Error: ${error.message}`, 'error');
    } finally {
        processActionBtn.style.display = 'inline-block';
        loadingIndicator.style.display = 'none';
        loadingText.textContent = 'Processing your PDFs...';
    }
}

async function openPdfEditor(index) {
    currentEditingFileIndex = index;
    const fileData = selectedFiles[index];
    
    // Reset metadata removal state when opening a new document
    isMetadataRemoved = false;
    compressBtn.disabled = false;
    compressBtn.title = 'Compress PDF';
    compressBtn.style.opacity = '';
    compressBtn.style.cursor = '';

    try {
        const arrayBuffer = (fileData instanceof File) ? await fileData.arrayBuffer() : fileData.arrayBuffer || await fileData.blob.arrayBuffer();
        currentPdfDocInstance = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        totalPagesInCurrentDoc = currentPdfDocInstance.numPages;
        currentPageNum = 1;

        pdfEditorModal.classList.add('active');
        await renderCurrentPageInEditor();
        updateEditorPageInfo();
        hideCropControls();
    } catch (error) {
        console.error('Error opening PDF for editing:', error);
        showCustomNotification('❌ Error opening PDF for editing.', 'error');
        closePdfEditor();
    }
}

function closePdfEditor() {
    pdfEditorModal.classList.remove('active');
    if (pdfRenderTask) {
        pdfRenderTask.cancel();
        pdfRenderTask = null;
    }
    currentPdfDocInstance = null;
}

async function renderCurrentPageInEditor() {
    if (!currentPdfDocInstance) return;

    try {
        prevPageBtn.disabled = currentPageNum <= 1;
        nextPageBtn.disabled = currentPageNum >= totalPagesInCurrentDoc;

        const page = await currentPdfDocInstance.getPage(currentPageNum);
        const viewport = page.getViewport({ scale: 1.5 });

        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        const context = pdfCanvas.getContext('2d');

        const renderContext = { canvasContext: context, viewport: viewport };

        if (pdfRenderTask) pdfRenderTask.cancel();
        pdfRenderTask = page.render(renderContext);
        await pdfRenderTask.promise;
        pdfRenderTask = null;
    } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
            console.error('Error rendering page:', error);
            showCustomNotification('❌ Error rendering page.', 'error');
        }
    }
}

function updateEditorPageInfo() {
    pageInfoDisplay.textContent = `Page ${currentPageNum} of ${totalPagesInCurrentDoc}`;
}

async function showPreviousPage() {
    if (currentPageNum > 1) {
        currentPageNum--;
        await renderCurrentPageInEditor();
        updateEditorPageInfo();
    }
}

async function showNextPage() {
    if (currentPageNum < totalPagesInCurrentDoc) {
        currentPageNum++;
        await renderCurrentPageInEditor();
        updateEditorPageInfo();
    }
}

async function getEditablePdfDoc() {
    const fileData = selectedFiles[currentEditingFileIndex];
    const arrayBuffer = (fileData instanceof File) ? await fileData.arrayBuffer() : fileData.arrayBuffer || await fileData.blob.arrayBuffer();
    return PDFLib.PDFDocument.load(arrayBuffer);
}

async function updateSelectedFile(pdfDoc) {
    const pdfBytes = await pdfDoc.save();
    const originalFile = selectedFiles[currentEditingFileIndex];
    selectedFiles[currentEditingFileIndex] = {
        name: (originalFile instanceof File) ? originalFile.name : originalFile.name,
        size: pdfBytes.byteLength,
        arrayBuffer: pdfBytes,
    };
    currentPdfDocInstance = await pdfjsLib.getDocument({data: pdfBytes.slice(0)}).promise;
    totalPagesInCurrentDoc = currentPdfDocInstance.numPages;
    if (currentPageNum > totalPagesInCurrentDoc && totalPagesInCurrentDoc > 0) {
        currentPageNum = totalPagesInCurrentDoc;
    } else if (totalPagesInCurrentDoc === 0) {
        currentPageNum = 0;
        const ctx = pdfCanvas.getContext('2d');
        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        pageInfoDisplay.textContent = "No pages";
        showCustomNotification('All pages deleted. Save changes to apply.', 'info');
        return;
    }
    await renderCurrentPageInEditor();
    updateEditorPageInfo();
}

async function rotateCurrentPdfPage(degrees) {
    if (currentEditingFileIndex === -1 || !currentPdfDocInstance) return;
    try {
        const pdfDoc = await getEditablePdfDoc();
        const page = pdfDoc.getPage(currentPageNum - 1);
        const currentRotation = page.getRotation().angle;
        page.setRotation(PDFLib.degrees(currentRotation + degrees));
        await updateSelectedFile(pdfDoc);
        showCustomNotification(`✅ Page ${currentPageNum} rotated.`, 'success');
    } catch (e) {
        showCustomNotification('❌ Error rotating page.', 'error'); console.error(e);
    }
}

async function compressCurrentPdf() {
    if (currentEditingFileIndex === -1) return;
    
    if (isMetadataRemoved) {
        showCustomNotification('❌ Cannot compress PDF after metadata has been removed.', 'error');
        return;
    }
    
    try {
        const pdfDoc = await getEditablePdfDoc();
        await updateSelectedFile(pdfDoc);
        showCustomNotification('✅ PDF re-processed (basic optimization).', 'success');
    } catch (e) {
        showCustomNotification('❌ Error compressing PDF.', 'error');
        console.error(e);
    }
}

function showCropControls() {
    cropControlsContainer.style.display = 'block';
    cropTopInput.value = 0; cropBottomInput.value = 0; cropLeftInput.value = 0; cropRightInput.value = 0;
}
function hideCropControls() {
    cropControlsContainer.style.display = 'none';
}

async function applyCropToCurrentPdf() {
    if (currentEditingFileIndex === -1 || !currentPdfDocInstance) return;
    const top = parseInt(cropTopInput.value) || 0;
    const bottom = parseInt(cropBottomInput.value) || 0;
    const left = parseInt(cropLeftInput.value) || 0;
    const right = parseInt(cropRightInput.value) || 0;

    try {
        const pdfDoc = await getEditablePdfDoc();
        const page = pdfDoc.getPage(currentPageNum - 1);
        const { width, height } = page.getSize();

        if (left + right >= width || top + bottom >= height) {
            showCustomNotification('❌ Invalid crop dimensions.', 'error');
            return;
        }
        page.setCropBox(left, bottom, width - left - right, height - top - bottom);
        await updateSelectedFile(pdfDoc);
        showCustomNotification(`✅ Page ${currentPageNum} cropped.`, 'success');
        hideCropControls();
    } catch (e) {
        showCustomNotification('❌ Error cropping page.', 'error'); console.error(e);
    }
}

async function removeCommentsFromCurrentPdf() {
    if (currentEditingFileIndex === -1) return;
    try {
        const pdfDoc = await getEditablePdfDoc();
        let commentsRemoved = false;
        pdfDoc.getPages().forEach(page => {
            const annotsRef = page.node.get(PDFLib.PDFName.of('Annots'));
            if (annotsRef) {
                page.node.delete(PDFLib.PDFName.of('Annots'));
                commentsRemoved = true;
            }
        });
        if (commentsRemoved) {
            await updateSelectedFile(pdfDoc);
            showCustomNotification('✅ Annotations (comments) removed.', 'success');
        } else {
            showCustomNotification('ℹ️ No annotations found to remove.', 'info');
        }
    } catch (e) {
        showCustomNotification('❌ Error removing comments.', 'error'); console.error(e);
    }
}

async function removeMetadataFromCurrentPdf() {
    try {
        const pdfDoc = await getEditablePdfDoc();
        
        // Remove all document metadata
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
        
        // Remove custom properties
        const info = pdfDoc.getInfoDict();
        info.delete('CreationDate');
        info.delete('ModDate');
        info.delete('Trapped');
        
        // Update the file with cleaned metadata
        await updateSelectedFile(pdfDoc);
        
        // Disable compression after metadata removal
        isMetadataRemoved = true;
        compressBtn.disabled = true;
        compressBtn.title = 'Compression disabled after metadata removal';
        compressBtn.style.opacity = '0.5';
        compressBtn.style.cursor = 'not-allowed';

        showCustomNotification('Metadata removed successfully. Compression has been disabled for this document since you cannot do both.', 'success');
    } catch (error) {
        console.error('Error removing metadata:', error);
        showCustomNotification('Failed to remove metadata', 'error');
    }
}

async function deleteCurrentPdfPage() {
    try {
        const pdfDoc = await getEditablePdfDoc();
        pdfDoc.removePage(currentPageNum - 1);
        
        // If we removed the last page, update current page number
        if (currentPageNum > pdfDoc.getPageCount()) {
            currentPageNum = pdfDoc.getPageCount();
        }
        
        totalPagesInCurrentDoc = pdfDoc.getPageCount();
        await updateSelectedFile(pdfDoc);
        await renderCurrentPageInEditor();
        updateEditorPageInfo();
    } catch (error) {
        console.error('Error deleting page:', error);
        showCustomNotification('Failed to delete page', 'error');
    }
}

function savePdfChanges() {
    renderFileList();
    closePdfEditor();
    showCustomNotification('✅ Changes to PDF saved locally.', 'success');
}

function showCustomNotification(message, type = 'info', duration = 3000) {
    const notificationArea = document.getElementById('notificationArea');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    notificationArea.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function showConfirmation(title, message, callback) {
    confirmationTitle.textContent = title;
    confirmationMessage.innerHTML = message;
    confirmCallback = callback;
    confirmationModal.classList.add('active');
}

function hideConfirmation() {
    confirmationModal.classList.remove('active');
    confirmCallback = null;
}
