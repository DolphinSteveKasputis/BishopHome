// ============================================================
// Chemicals.js — Chemicals / Products CRUD and display logic
// Manages the list of chemicals/products used in yard care.
// Stored in Firestore collection: "chemicals"
// ============================================================

// ---------- Load & Display Chemicals Page ----------

/**
 * Loads all chemicals and displays them on the Chemicals page.
 */
async function loadChemicalsList() {
    const container = document.getElementById('chemicalsListContainer');
    const emptyState = document.getElementById('chemicalsEmptyState');

    try {
        const snapshot = await db.collection('chemicals').get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No chemicals or products added yet.';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Sort alphabetically by name
        const chemicals = [];
        snapshot.forEach(function(doc) {
            chemicals.push({ id: doc.id, ...doc.data() });
        });
        chemicals.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });

        chemicals.forEach(function(chemical) {
            const item = createChemicalItem(chemical);
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading chemicals:', error);
        emptyState.textContent = 'Error loading chemicals.';
        emptyState.style.display = 'block';
    }
}

// ---------- Create a Chemical Item Element ----------

/**
 * Creates a DOM element representing a single chemical/product.
 * @param {Object} chemical - The chemical data (id, name, notes).
 * @returns {HTMLElement} The chemical item element.
 */
function createChemicalItem(chemical) {
    const item = document.createElement('div');
    item.className = 'chemical-item card';
    // Clicking the card body navigates to the chemical detail page
    item.addEventListener('click', function() {
        window.location.hash = 'chemical/' + chemical.id;
    });

    const info = document.createElement('div');
    info.style.flex = '1';

    const title = document.createElement('div');
    title.className = 'card-title card-title--link';
    title.textContent = chemical.name;
    info.appendChild(title);

    if (chemical.notes) {
        const notes = document.createElement('div');
        notes.className = 'card-subtitle';
        notes.textContent = chemical.notes;
        info.appendChild(notes);
    }

    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.style.flexShrink = '0';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-small btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openEditChemicalModal(chemical);
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-small btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        handleDeleteChemical(chemical.id);
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);

    return item;
}

// ---------- Add Chemical ----------

/**
 * Opens the add-chemical modal.
 */
function openAddChemicalModal() {
    const modal = document.getElementById('chemicalModal');
    const modalTitle = document.getElementById('chemicalModalTitle');
    const nameInput = document.getElementById('chemicalNameInput');
    const notesInput = document.getElementById('chemicalNotesInput');

    modalTitle.textContent = 'Add Chemical / Product';
    nameInput.value = '';
    notesInput.value = '';

    modal.dataset.mode = 'add';

    // Hide facts section — no ID yet for a new chemical
    document.getElementById('chemicalFactsSection').style.display = 'none';

    openModal('chemicalModal');
    nameInput.focus();
}

// ---------- Edit Chemical ----------

/**
 * Opens the edit-chemical modal with existing data.
 * @param {Object} chemical - The chemical data (including id).
 */
function openEditChemicalModal(chemical) {
    const modal = document.getElementById('chemicalModal');
    const modalTitle = document.getElementById('chemicalModalTitle');
    const nameInput = document.getElementById('chemicalNameInput');
    const notesInput = document.getElementById('chemicalNotesInput');

    modalTitle.textContent = 'Edit Chemical / Product';
    nameInput.value = chemical.name || '';
    notesInput.value = chemical.notes || '';

    modal.dataset.mode = 'edit';
    modal.dataset.editId = chemical.id;

    // Show facts section and load existing facts
    document.getElementById('chemicalFactsSection').style.display = 'block';
    loadFacts('chemical', chemical.id, 'chemicalModalFactsContainer', 'chemicalModalFactsEmptyState');

    openModal('chemicalModal');
    nameInput.focus();
}

// ---------- Save Chemical (Add or Edit) ----------

/**
 * Handles the save button in the chemical modal.
 */
async function handleChemicalModalSave() {
    const modal = document.getElementById('chemicalModal');
    const nameInput = document.getElementById('chemicalNameInput');
    const notesInput = document.getElementById('chemicalNotesInput');

    const name = nameInput.value.trim();
    const notes = notesInput.value.trim();

    if (!name) {
        alert('Please enter a name.');
        return;
    }

    const mode = modal.dataset.mode;

    try {
        if (mode === 'add') {
            await db.collection('chemicals').add({
                name: name,
                notes: notes,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Chemical added:', name);

        } else if (mode === 'edit') {
            const chemicalId = modal.dataset.editId;
            await db.collection('chemicals').doc(chemicalId).update({
                name: name,
                notes: notes
            });
            console.log('Chemical updated:', name);
        }

        closeModal('chemicalModal');
        // Reload the appropriate view depending on where we are
        var hash = window.location.hash.slice(1) || 'home';
        if (hash.startsWith('chemical/')) {
            loadChemicalDetail(hash.split('/')[1]);
        } else {
            loadChemicalsList();
        }

    } catch (error) {
        console.error('Error saving chemical:', error);
        alert('Error saving chemical. Check console for details.');
    }
}

// ---------- Delete Chemical ----------

/**
 * Deletes a chemical after confirmation.
 * @param {string} chemicalId - The chemical's Firestore document ID.
 */
async function handleDeleteChemical(chemicalId) {
    if (!confirm('Are you sure you want to delete this chemical/product?')) {
        return;
    }

    try {
        await db.collection('chemicals').doc(chemicalId).delete();
        console.log('Chemical deleted:', chemicalId);
        // If we were on the detail page, go back to the list
        window.location.hash = 'chemicals';

    } catch (error) {
        console.error('Error deleting chemical:', error);
        alert('Error deleting chemical. Check console for details.');
    }
}

// ---------- Chemical Detail Page ----------

/**
 * Loads and displays the detail page for a single chemical.
 * Sets window.currentChemical for use by the Edit/Delete buttons and facts.js.
 * @param {string} chemicalId - The chemical's Firestore document ID.
 */
async function loadChemicalDetail(chemicalId) {
    try {
        const doc = await db.collection('chemicals').doc(chemicalId).get();

        if (!doc.exists) {
            document.getElementById('chemicalDetailName').textContent = 'Chemical not found';
            return;
        }

        const chemical = { id: doc.id, ...doc.data() };
        window.currentChemical = chemical;

        document.getElementById('chemicalDetailName').textContent = chemical.name;

        // Show notes section if notes are present
        const notesSection = document.getElementById('chemicalDetailNotesSection');
        if (chemical.notes) {
            document.getElementById('chemicalDetailNotes').textContent = chemical.notes;
            notesSection.style.display = 'block';
        } else {
            notesSection.style.display = 'none';
        }

        // Load facts for this chemical
        loadFacts('chemical', chemicalId, 'chemicalFactsContainer', 'chemicalFactsEmptyState');

    } catch (error) {
        console.error('Error loading chemical detail:', error);
        document.getElementById('chemicalDetailName').textContent = 'Error loading chemical';
    }
}

// ---------- Helper: Get chemicals for dropdown ----------

/**
 * Loads all chemicals and returns them as an array (for use in dropdowns).
 * @returns {Promise<Array>} Array of {id, name, notes} objects sorted by name.
 */
async function getAllChemicals() {
    const snapshot = await db.collection('chemicals').get();
    const chemicals = [];
    snapshot.forEach(function(doc) {
        chemicals.push({ id: doc.id, ...doc.data() });
    });
    chemicals.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    return chemicals;
}

// ============================================================
// BARCODE SCANNER
// Uses html5-qrcode (CDN) for camera scanning, then queries
// two free APIs for product info and shows all returned data
// in a popup so the user can see what's available.
//
// APIs tried (in order, both free / no key required):
//   1. UPC Item DB  — https://api.upcitemdb.com/prod/trial/lookup
//   2. Open Food Facts — https://world.openfoodfacts.org/api/v0/product/
// ============================================================

var barcodeScanner = null;  // Html5Qrcode instance

/**
 * Open the scanner modal and start the rear camera.
 */
function openBarcodeScanner() {
    var scannerDiv = document.getElementById('barcodeScannerDiv');
    var statusEl   = document.getElementById('barcodeScanStatus');

    // Clear any previous camera frame
    scannerDiv.innerHTML = '';
    statusEl.textContent = 'Point camera at a barcode\u2026';

    openModal('barcodeScanModal');

    barcodeScanner = new Html5Qrcode('barcodeScannerDiv');
    barcodeScanner.start(
        { facingMode: 'environment' },          // use rear/back camera
        { fps: 10, qrbox: { width: 260, height: 120 } },
        function onSuccess(decodedText) {
            // Stop immediately on first successful scan
            barcodeScanner.stop().then(function() {
                barcodeScanner = null;
                lookupBarcode(decodedText);
            }).catch(function() {
                lookupBarcode(decodedText);
            });
        },
        function onFailure() { /* ignore per-frame misses while scanning */ }
    ).catch(function(err) {
        statusEl.textContent = 'Camera error: ' + err;
    });
}

/**
 * Stop camera and close the scanner modal.
 */
function closeBarcodeScanner() {
    if (barcodeScanner) {
        barcodeScanner.stop().catch(function() {});
        barcodeScanner = null;
    }
    closeModal('barcodeScanModal');
}

/**
 * Query UPC Item DB first, then Open Food Facts as a fallback.
 * Both are free with no API key required.
 * @param {string} barcode
 */
async function lookupBarcode(barcode) {
    // Switch to result modal immediately with a loading message
    closeModal('barcodeScanModal');
    renderBarcodeResult('<p style="color:#555;padding:12px 0">Looking up <strong>' +
        escapeHtml(barcode) + '</strong>\u2026</p>');
    openModal('barcodeResultModal');

    try {
        // ---- Attempt 1: UPC Item DB ----
        var upcRes  = await fetch('https://api.upcitemdb.com/prod/trial/lookup?upc=' +
                                  encodeURIComponent(barcode));
        var upcData = await upcRes.json();

        if (upcData.items && upcData.items.length > 0) {
            var item = upcData.items[0];
            renderBarcodeResult(buildBarcodeTable([
                { label: 'Barcode',       value: barcode },
                { label: 'Title',         value: item.title },
                { label: 'Brand',         value: item.brand },
                { label: 'Description',   value: item.description },
                { label: 'Category',      value: item.category },
                { label: 'Size / Weight', value: item.size },
                { label: 'Color',         value: item.color },
                { label: 'Model #',       value: item.model },
                { label: 'ASIN',          value: item.asin },
                { label: 'EAN',           value: item.ean },
                { label: 'Offers found',  value: item.offers ? String(item.offers.length) : null },
                { label: 'Source',        value: 'UPC Item DB' }
            ], item.images && item.images.length ? item.images[0] : null));
            return;
        }

        // ---- Attempt 2: Open Food Facts ----
        var ffRes  = await fetch('https://world.openfoodfacts.org/api/v0/product/' +
                                  encodeURIComponent(barcode) + '.json');
        var ffData = await ffRes.json();

        if (ffData.status === 1 && ffData.product) {
            var p = ffData.product;
            renderBarcodeResult(buildBarcodeTable([
                { label: 'Barcode',     value: barcode },
                { label: 'Name',        value: p.product_name || p.product_name_en },
                { label: 'Brand',       value: p.brands },
                { label: 'Categories',  value: p.categories },
                { label: 'Quantity',    value: p.quantity },
                { label: 'Ingredients', value: p.ingredients_text },
                { label: 'Countries',   value: p.countries },
                { label: 'Source',      value: 'Open Food Facts' }
            ], p.image_front_url || p.image_url || null));
            return;
        }

        // ---- Nothing found in either database ----
        renderBarcodeResult(buildBarcodeTable([
            { label: 'Barcode', value: barcode },
            { label: 'Result',  value: 'No product information found. Free databases have limited ' +
                                       'coverage for pesticides and specialty chemicals \u2014 ' +
                                       'this is normal.' }
        ], null));

    } catch (err) {
        renderBarcodeResult(buildBarcodeTable([
            { label: 'Barcode', value: barcode },
            { label: 'Error',   value: 'Lookup failed: ' + err.message }
        ], null));
    }
}

/**
 * Build an HTML string: optional product image + a two-column table of fields.
 * Skips rows where value is null / empty.
 * @param {Array<{label:string, value:string|null}>} fields
 * @param {string|null} imageUrl
 * @returns {string}
 */
function buildBarcodeTable(fields, imageUrl) {
    var html = '';
    if (imageUrl) {
        html += '<img src="' + escapeHtml(imageUrl) +
                '" class="barcode-result-img" alt="Product image">';
    }
    html += '<table class="barcode-result-table">';
    fields.forEach(function(f) {
        if (f.value === null || f.value === undefined || f.value === '') return;
        html += '<tr>' +
                '<td class="barcode-result-label">' + escapeHtml(f.label) + '</td>' +
                '<td class="barcode-result-value">' + escapeHtml(String(f.value)) + '</td>' +
                '</tr>';
    });
    html += '</table>';
    return html;
}

/** Set the innerHTML of the result modal body. */
function renderBarcodeResult(html) {
    document.getElementById('barcodeResultContent').innerHTML = html;
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // "Add Chemical" button on chemicals page
    document.getElementById('addChemicalBtn').addEventListener('click', openAddChemicalModal);

    // Chemical modal — Save button
    document.getElementById('chemicalModalSaveBtn').addEventListener('click', handleChemicalModalSave);

    // Chemical modal — Cancel button
    document.getElementById('chemicalModalCancelBtn').addEventListener('click', function() {
        closeModal('chemicalModal');
    });

    // Chemical modal — Close on overlay click
    document.getElementById('chemicalModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('chemicalModal');
    });

    // Chemical modal — Enter key to save
    document.getElementById('chemicalNameInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleChemicalModalSave();
    });

    // Chemical detail — Edit button
    document.getElementById('editChemicalDetailBtn').addEventListener('click', function() {
        if (window.currentChemical) {
            openEditChemicalModal(window.currentChemical);
        }
    });

    // Chemical detail — Delete button
    document.getElementById('deleteChemicalDetailBtn').addEventListener('click', function() {
        if (window.currentChemical) {
            handleDeleteChemical(window.currentChemical.id);
        }
    });

    // Barcode scanner — Scan Barcode button on chemicals list page
    document.getElementById('scanBarcodeBtn').addEventListener('click', openBarcodeScanner);

    // Barcode scanner — Cancel button inside scanner modal
    document.getElementById('barcodeCancelBtn').addEventListener('click', closeBarcodeScanner);

    // Barcode scanner — clicking the overlay closes the scanner
    document.getElementById('barcodeScanModal').addEventListener('click', function(e) {
        if (e.target === this) closeBarcodeScanner();
    });

    // Barcode result — Close button
    document.getElementById('barcodeResultCloseBtn').addEventListener('click', function() {
        closeModal('barcodeResultModal');
    });

    // Barcode result — clicking the overlay closes it
    document.getElementById('barcodeResultModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('barcodeResultModal');
    });
});
