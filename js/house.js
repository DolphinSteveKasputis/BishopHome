// ============================================================
// house.js — House / Interior Feature
// Handles Floors (Phase H1), Rooms (Phase H2), Things (Phase H3+)
// Uses the same Firestore patterns as zones.js / plants.js
// ============================================================

// ---- State ----
var currentFloor = null;   // The floor document currently being viewed

// ============================================================
// HOUSE HOME PAGE  (#house)
// Lists all floors sorted by floorNumber ascending.
// ============================================================

/**
 * Load and render the House home page.
 * Called by app.js when the route is #house.
 */
function loadHousePage() {
    var container  = document.getElementById('floorListContainer');
    var emptyState = document.getElementById('floorEmptyState');

    container.innerHTML  = '';
    emptyState.textContent = 'Loading…';

    db.collection('floors')
        .orderBy('floorNumber', 'asc')
        .get()
        .then(function(snapshot) {
            emptyState.textContent = '';

            if (snapshot.empty) {
                emptyState.textContent = 'No floors yet. Add a floor to get started.';
                return;
            }

            snapshot.forEach(function(doc) {
                var data = doc.data();
                container.appendChild(buildFloorCard(doc.id, data));
            });
        })
        .catch(function(err) {
            console.error('loadHousePage error:', err);
            emptyState.textContent = 'Error loading floors.';
        });
}

/**
 * Build a card element for a floor in the house home list.
 * @param {string} id    - Firestore document ID
 * @param {object} data  - Floor data {name, floorNumber, createdAt}
 * @returns {HTMLElement}
 */
function buildFloorCard(id, data) {
    var card = document.createElement('div');
    card.className = 'card card--clickable';

    var label = escapeHtml(data.name || 'Unnamed Floor');
    var numLabel = (data.floorNumber !== undefined && data.floorNumber !== null)
        ? ' <span class="house-floor-num">Floor ' + data.floorNumber + '</span>'
        : '';

    card.innerHTML =
        '<div class="card-main">' +
            '<span class="card-title">' + label + numLabel + '</span>' +
        '</div>' +
        '<span class="card-arrow">›</span>';

    card.addEventListener('click', function() {
        window.location.hash = '#floor/' + id;
    });

    return card;
}

// ============================================================
// FLOOR DETAIL PAGE  (#floor/{floorId})
// ============================================================

/**
 * Load and render the Floor detail page.
 * Called by app.js when the route is #floor/{id}.
 * @param {string} floorId - Firestore document ID of the floor
 */
function loadFloorDetail(floorId) {
    db.collection('floors').doc(floorId).get()
        .then(function(doc) {
            if (!doc.exists) {
                // Floor was deleted — go back to house page
                window.location.hash = '#house';
                return;
            }

            currentFloor = { id: doc.id, ...doc.data() };
            renderFloorDetail(currentFloor);
        })
        .catch(function(err) {
            console.error('loadFloorDetail error:', err);
        });
}

/**
 * Render the floor detail page with the floor's data.
 * @param {object} floor - {id, name, floorNumber, ...}
 */
function renderFloorDetail(floor) {
    // Page title
    document.getElementById('floorTitle').textContent = floor.name || 'Floor';

    // Meta line — floor number
    var meta = document.getElementById('floorMeta');
    if (floor.floorNumber !== undefined && floor.floorNumber !== null) {
        meta.textContent = 'Floor number: ' + floor.floorNumber;
        meta.style.display = '';
    } else {
        meta.textContent = '';
        meta.style.display = 'none';
    }

    // Breadcrumb — "House › Floor Name"
    buildHouseBreadcrumb([
        { label: 'House', hash: '#house' },
        { label: floor.name || 'Floor', hash: null }
    ]);
}

// ============================================================
// BREADCRUMB / HEADER HELPERS
// ============================================================

/**
 * Build breadcrumb bar and update the sticky header title
 * for House-section pages.
 * @param {Array} crumbs  - [{label, hash}, ...]
 *   - If hash is null the crumb is the current page (not a link)
 */
function buildHouseBreadcrumb(crumbs) {
    var bar    = document.getElementById('breadcrumbBar');
    var header = document.getElementById('headerTitle');

    bar.innerHTML = '';

    crumbs.forEach(function(crumb, i) {
        var span = document.createElement('span');
        if (crumb.hash) {
            var a = document.createElement('a');
            a.href      = crumb.hash;
            a.className = 'breadcrumb-link';
            a.textContent = crumb.label;
            span.appendChild(a);
        } else {
            span.className   = 'breadcrumb-current';
            span.textContent = crumb.label;
        }
        bar.appendChild(span);

        if (i < crumbs.length - 1) {
            var sep = document.createElement('span');
            sep.className   = 'breadcrumb-sep';
            sep.textContent = ' › ';
            bar.appendChild(sep);
        }
    });

    // Update sticky header — show "Bishop › [last non-null crumb]"
    var deepest = crumbs[crumbs.length - 1].label;
    header.innerHTML =
        '<a href="#home" class="home-link">Bishop</a>' +
        '<span class="header-zone-sep">›</span>' +
        '<span class="header-zone-name">' + escapeHtml(deepest) + '</span>';
}

// ============================================================
// FLOOR MODAL  (Add / Edit)
// ============================================================

/**
 * Open the floor add/edit modal.
 * @param {string|null} editId  - If editing, the floor's Firestore ID; null for add
 * @param {object|null} data    - Existing floor data when editing
 */
function openFloorModal(editId, data) {
    var modal      = document.getElementById('floorModal');
    var title      = document.getElementById('floorModalTitle');
    var nameInput  = document.getElementById('floorNameInput');
    var numInput   = document.getElementById('floorNumberInput');
    var deleteBtn  = document.getElementById('floorModalDeleteBtn');

    if (editId) {
        title.textContent     = 'Edit Floor';
        nameInput.value       = data.name || '';
        numInput.value        = (data.floorNumber !== undefined && data.floorNumber !== null)
                                    ? data.floorNumber
                                    : '';
        deleteBtn.style.display = '';
        modal.dataset.mode   = 'edit';
        modal.dataset.editId = editId;
    } else {
        title.textContent     = 'Add Floor';
        nameInput.value       = '';
        numInput.value        = '';
        deleteBtn.style.display = 'none';
        modal.dataset.mode   = 'add';
        modal.dataset.editId = '';
    }

    openModal('floorModal');
    nameInput.focus();
}

// Save button handler
document.getElementById('floorModalSaveBtn').addEventListener('click', function() {
    var modal     = document.getElementById('floorModal');
    var nameVal   = document.getElementById('floorNameInput').value.trim();
    var numVal    = document.getElementById('floorNumberInput').value.trim();

    if (!nameVal) {
        alert('Please enter a floor name.');
        return;
    }

    var floorData = {
        name:        nameVal,
        floorNumber: numVal !== '' ? parseInt(numVal, 10) : null
    };

    var mode   = modal.dataset.mode;
    var editId = modal.dataset.editId;

    if (mode === 'edit' && editId) {
        // Update existing floor
        db.collection('floors').doc(editId).update(floorData)
            .then(function() {
                closeModal('floorModal');
                // Reload whichever page we're on
                if (window.location.hash.startsWith('#floor/')) {
                    loadFloorDetail(editId);
                } else {
                    loadHousePage();
                }
            })
            .catch(function(err) { console.error('Update floor error:', err); });
    } else {
        // Add new floor
        floorData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('floors').add(floorData)
            .then(function() {
                closeModal('floorModal');
                loadHousePage();
            })
            .catch(function(err) { console.error('Add floor error:', err); });
    }
});

// Cancel button handler
document.getElementById('floorModalCancelBtn').addEventListener('click', function() {
    closeModal('floorModal');
});

// Delete button handler (inside modal — only shown in edit mode)
document.getElementById('floorModalDeleteBtn').addEventListener('click', function() {
    var editId = document.getElementById('floorModal').dataset.editId;
    if (!editId) return;

    if (!confirm('Delete this floor? This cannot be undone.')) return;

    db.collection('floors').doc(editId).delete()
        .then(function() {
            closeModal('floorModal');
            window.location.hash = '#house';
        })
        .catch(function(err) { console.error('Delete floor error:', err); });
});

// ============================================================
// PAGE BUTTON WIRING  (buttons on the House pages)
// ============================================================

// "Add Floor" button on the house home page
document.getElementById('addFloorBtn').addEventListener('click', function() {
    openFloorModal(null, null);
});

// "Edit" button on the floor detail page
document.getElementById('editFloorBtn').addEventListener('click', function() {
    if (!currentFloor) return;
    openFloorModal(currentFloor.id, currentFloor);
});

// "Delete" button on the floor detail page
document.getElementById('deleteFloorBtn').addEventListener('click', function() {
    if (!currentFloor) return;

    if (!confirm('Delete "' + (currentFloor.name || 'this floor') + '"? This cannot be undone.')) return;

    db.collection('floors').doc(currentFloor.id).delete()
        .then(function() {
            window.location.hash = '#house';
        })
        .catch(function(err) { console.error('Delete floor error:', err); });
});
