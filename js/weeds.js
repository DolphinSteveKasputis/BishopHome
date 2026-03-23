// ============================================================
// Weeds.js — Weed type CRUD, zone assignment, and display logic
// Tracks weed types found in the yard: their treatment methods,
// application timing, affected zones, photos, and activity history.
// Firestore collection: "weeds"
// ============================================================

// ---------- Load & Display: Weed List Page ----------

/**
 * Loads all weed types and displays them on the weeds list page.
 */
async function loadWeedsList() {
    var container = document.getElementById('weedsListContainer');
    var emptyState = document.getElementById('weedsEmptyState');

    try {
        var snapshot = await userCol('weeds').get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No weeds tracked yet — add one to get started!';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Sort alphabetically by name
        var weeds = [];
        snapshot.forEach(function(doc) {
            weeds.push({ id: doc.id, ...doc.data() });
        });
        weeds.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });

        // Build a card for each weed
        weeds.forEach(function(weed) {
            var card = createWeedCard(weed.id, weed);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading weeds:', error);
        emptyState.textContent = 'Error loading weeds. Check console for details.';
        emptyState.style.display = 'block';
    }
}

// ---------- Create a Weed Card Element ----------

/**
 * Creates a clickable card element for a weed type.
 * @param {string} id - The weed's Firestore document ID.
 * @param {Object} weed - The weed data.
 * @returns {HTMLElement} The card element.
 */
function createWeedCard(id, weed) {
    var card = document.createElement('div');
    card.className = 'card';
    card.addEventListener('click', function() {
        window.location.hash = 'weed/' + id;
    });

    var info = document.createElement('div');

    var title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = weed.name;
    info.appendChild(title);

    // Show treatment method as subtitle
    var subtitleParts = [];
    if (weed.treatmentMethod) subtitleParts.push(weed.treatmentMethod);
    if (weed.applicationTiming) subtitleParts.push(weed.applicationTiming);
    if (subtitleParts.length > 0) {
        var subtitle = document.createElement('div');
        subtitle.className = 'card-subtitle';
        subtitle.textContent = subtitleParts.join(' | ');
        info.appendChild(subtitle);
    }

    card.appendChild(info);

    var arrow = document.createElement('span');
    arrow.className = 'card-arrow';
    arrow.textContent = '\u203A';
    card.appendChild(arrow);

    return card;
}

// ---------- Load & Display: Weed Detail Page ----------

/**
 * Loads a weed's details: info, affected zones, photos, and activity history.
 * @param {string} weedId - The Firestore document ID of the weed.
 */
async function loadWeedDetail(weedId) {
    var titleEl = document.getElementById('weedTitle');

    try {
        var doc = await userCol('weeds').doc(weedId).get();

        if (!doc.exists) {
            titleEl.textContent = 'Weed not found';
            return;
        }

        var weed = doc.data();
        titleEl.textContent = weed.name;

        // Store current weed info for use by buttons
        window.currentWeed = { id: doc.id, ...weed };

        // Build breadcrumbs: Home (Weeds) > Weed Name
        buildWeedBreadcrumbs(weed.name);

        // Display treatment info
        var treatmentEl = document.getElementById('weedTreatmentMethod');
        treatmentEl.textContent = weed.treatmentMethod || 'Not specified';
        if (!weed.treatmentMethod) treatmentEl.classList.add('empty-field');
        else treatmentEl.classList.remove('empty-field');

        var timingEl = document.getElementById('weedApplicationTiming');
        timingEl.textContent = weed.applicationTiming || 'Not specified';
        if (!weed.applicationTiming) timingEl.classList.add('empty-field');
        else timingEl.classList.remove('empty-field');

        var notesEl = document.getElementById('weedNotesDisplay');
        notesEl.textContent = weed.notes || 'No notes.';
        if (!weed.notes) notesEl.classList.add('empty-field');
        else notesEl.classList.remove('empty-field');

        // Load affected zones
        await loadWeedZones(weed.zoneIds || []);

        // Load facts
        loadFacts('weed', doc.id, 'weedFactsContainer', 'weedFactsEmptyState');

        // Load photos
        loadPhotos('weed', doc.id, 'weedPhotoContainer', 'weedPhotoEmptyState');

        // Load activity history
        loadActivities('weed', doc.id, 'weedActivityContainer', 'weedActivityEmptyState');

    } catch (error) {
        console.error('Error loading weed detail:', error);
        titleEl.textContent = 'Error loading weed';
    }
}

// ---------- Weed Breadcrumbs ----------

/**
 * Builds breadcrumbs for the weed detail page: Weeds > Weed Name
 * @param {string} weedName - The weed's name.
 */
function buildWeedBreadcrumbs(weedName) {
    var breadcrumbBar = document.getElementById('breadcrumbBar');
    var html = '<a href="#weeds">Weeds</a>';
    html += '<span class="separator">&rsaquo;</span>';
    html += '<span>' + escapeHtml(weedName) + '</span>';
    breadcrumbBar.innerHTML = html;
}

// ---------- Load Affected Zones ----------

/**
 * Loads and displays the affected zones for a weed.
 * Shows zone names as clickable links.
 * @param {Array} zoneIds - Array of zone IDs the weed is found in.
 */
async function loadWeedZones(zoneIds) {
    var container = document.getElementById('weedZonesContainer');
    var emptyState = document.getElementById('weedZonesEmptyState');

    container.innerHTML = '';

    if (!zoneIds || zoneIds.length === 0) {
        emptyState.textContent = 'No zones assigned yet.';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Load zone names and build links
    for (var i = 0; i < zoneIds.length; i++) {
        try {
            var zoneDoc = await userCol('zones').doc(zoneIds[i]).get();
            if (zoneDoc.exists) {
                var zonePath = await getZonePath(zoneIds[i]);
                var link = document.createElement('a');
                link.className = 'weed-zone-link';
                link.href = '#zone/' + zoneIds[i];
                link.innerHTML = zonePath;
                container.appendChild(link);
            }
        } catch (e) {
            console.error('Error loading zone for weed:', e);
        }
    }
}

// ---------- Add/Edit Weed Modal ----------

/**
 * Opens the add-weed modal.
 */
function openAddWeedModal() {
    var modal = document.getElementById('weedModal');
    var modalTitle = document.getElementById('weedModalTitle');
    var nameInput = document.getElementById('weedNameInput');
    var treatmentInput = document.getElementById('weedTreatmentInput');
    var timingInput = document.getElementById('weedTimingInput');
    var notesInput = document.getElementById('weedNotesInput');

    modalTitle.textContent = 'Add Weed';
    nameInput.value = '';
    treatmentInput.value = '';
    timingInput.value = '';
    notesInput.value = '';

    modal.dataset.mode = 'add';

    openModal('weedModal');
    nameInput.focus();
}

/**
 * Opens the edit-weed modal for an existing weed.
 */
function openEditWeedModal() {
    if (!window.currentWeed) return;

    var modal = document.getElementById('weedModal');
    var modalTitle = document.getElementById('weedModalTitle');
    var nameInput = document.getElementById('weedNameInput');
    var treatmentInput = document.getElementById('weedTreatmentInput');
    var timingInput = document.getElementById('weedTimingInput');
    var notesInput = document.getElementById('weedNotesInput');

    modalTitle.textContent = 'Edit Weed';
    nameInput.value = window.currentWeed.name || '';
    treatmentInput.value = window.currentWeed.treatmentMethod || '';
    timingInput.value = window.currentWeed.applicationTiming || '';
    notesInput.value = window.currentWeed.notes || '';

    modal.dataset.mode = 'edit';
    modal.dataset.editId = window.currentWeed.id;

    openModal('weedModal');
    nameInput.focus();
}

/**
 * Handles the save button in the weed modal (add or edit).
 */
async function handleWeedModalSave() {
    var modal = document.getElementById('weedModal');
    var nameInput = document.getElementById('weedNameInput');
    var treatmentInput = document.getElementById('weedTreatmentInput');
    var timingInput = document.getElementById('weedTimingInput');
    var notesInput = document.getElementById('weedNotesInput');

    var name = nameInput.value.trim();
    var treatmentMethod = treatmentInput.value.trim();
    var applicationTiming = timingInput.value.trim();
    var notes = notesInput.value.trim();

    if (!name) {
        alert('Please enter a weed name.');
        return;
    }

    var mode = modal.dataset.mode;

    try {
        if (mode === 'add') {
            await userCol('weeds').add({
                name: name,
                treatmentMethod: treatmentMethod,
                applicationTiming: applicationTiming,
                notes: notes,
                zoneIds: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Weed added:', name);

        } else if (mode === 'edit') {
            var weedId = modal.dataset.editId;
            await userCol('weeds').doc(weedId).update({
                name: name,
                treatmentMethod: treatmentMethod,
                applicationTiming: applicationTiming,
                notes: notes
            });
            console.log('Weed updated:', name);
        }

        closeModal('weedModal');

        // Refresh the current view
        var hash = window.location.hash.slice(1) || 'home';
        var parts = hash.split('/');
        if (parts[0] === 'weed' && parts[1]) {
            loadWeedDetail(parts[1]);
        } else {
            loadWeedsList();
        }

    } catch (error) {
        console.error('Error saving weed:', error);
        alert('Error saving weed. Check console for details.');
    }
}

// ---------- Delete Weed ----------

/**
 * Deletes a weed after confirmation.
 */
async function handleDeleteWeed() {
    if (!window.currentWeed) return;

    if (!confirm('Are you sure you want to delete "' + window.currentWeed.name + '"? This will also remove all associated activities and photos.')) {
        return;
    }

    try {
        var weedId = window.currentWeed.id;

        // Delete associated activities
        var actSnapshot = await userCol('activities')
            .where('targetType', '==', 'weed')
            .where('targetId', '==', weedId)
            .get();
        var deletePromises = [];
        actSnapshot.forEach(function(doc) {
            deletePromises.push(doc.ref.delete());
        });

        // Delete associated photos
        var photoSnapshot = await userCol('photos')
            .where('targetType', '==', 'weed')
            .where('targetId', '==', weedId)
            .get();
        photoSnapshot.forEach(function(doc) {
            deletePromises.push(doc.ref.delete());
        });

        await Promise.all(deletePromises);

        // Delete the weed itself
        await userCol('weeds').doc(weedId).delete();
        console.log('Weed deleted:', window.currentWeed.name);

        // Navigate back to weeds list
        window.location.hash = 'weeds';

    } catch (error) {
        console.error('Error deleting weed:', error);
        alert('Error deleting weed. Check console for details.');
    }
}

// ---------- Zone Assignment Modal ----------

/**
 * Opens the zone assignment modal for the current weed.
 * Shows checkboxes for all zones with hierarchy indentation.
 */
async function openWeedZoneModal() {
    if (!window.currentWeed) return;

    var container = document.getElementById('weedZoneCheckboxList');
    container.innerHTML = '<p class="empty-state">Loading zones...</p>';

    openModal('weedZoneModal');

    try {
        // Load all zones
        var snapshot = await userCol('zones').get();
        var allZones = [];
        snapshot.forEach(function(doc) {
            allZones.push({ id: doc.id, ...doc.data() });
        });

        // Build flat list with hierarchy indentation (reuse from plants.js)
        var options = buildZoneOptionsTree(allZones, null, '');

        container.innerHTML = '';

        if (options.length === 0) {
            container.innerHTML = '<p class="empty-state">No zones created yet.</p>';
            return;
        }

        var currentZoneIds = window.currentWeed.zoneIds || [];

        options.forEach(function(opt) {
            var wrapper = document.createElement('label');
            wrapper.className = 'zone-checkbox-item';

            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = opt.id;
            checkbox.checked = currentZoneIds.indexOf(opt.id) !== -1;

            var text = document.createElement('span');
            text.textContent = opt.label;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(text);
            container.appendChild(wrapper);
        });

    } catch (error) {
        console.error('Error loading zones for weed assignment:', error);
        container.innerHTML = '<p class="empty-state">Error loading zones.</p>';
    }
}

/**
 * Saves the zone assignments from the zone assignment modal.
 */
async function handleWeedZoneSave() {
    if (!window.currentWeed) return;

    var container = document.getElementById('weedZoneCheckboxList');
    var checkboxes = container.querySelectorAll('input[type="checkbox"]');
    var selectedZoneIds = [];

    checkboxes.forEach(function(cb) {
        if (cb.checked) {
            selectedZoneIds.push(cb.value);
        }
    });

    try {
        await userCol('weeds').doc(window.currentWeed.id).update({
            zoneIds: selectedZoneIds
        });

        console.log('Weed zones updated:', selectedZoneIds.length, 'zones');
        closeModal('weedZoneModal');

        // Update local state and refresh zones display
        window.currentWeed.zoneIds = selectedZoneIds;
        await loadWeedZones(selectedZoneIds);

    } catch (error) {
        console.error('Error saving weed zones:', error);
        alert('Error saving zone assignments. Check console for details.');
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // "Add Weed" button on weeds list page
    document.getElementById('addWeedBtn').addEventListener('click', function() {
        openAddWeedModal();
    });

    // "Edit" button on weed detail page
    document.getElementById('editWeedBtn').addEventListener('click', function() {
        openEditWeedModal();
    });

    // "Delete" button on weed detail page
    document.getElementById('deleteWeedBtn').addEventListener('click', function() {
        handleDeleteWeed();
    });

    // "Manage Zones" button on weed detail page
    document.getElementById('manageWeedZonesBtn').addEventListener('click', function() {
        openWeedZoneModal();
    });

    // "Log Activity" button on weed detail page
    document.getElementById('logWeedActivityBtn').addEventListener('click', function() {
        if (window.currentWeed) {
            openLogActivityModal('weed', window.currentWeed.id);
        }
    });

    // "Add Photo" button on weed detail page
    document.getElementById('addWeedPhotoBtn').addEventListener('click', function() {
        if (window.currentWeed) {
            triggerPhotoUpload('weed', window.currentWeed.id);
        }
    });

    // Weed modal — Save button
    document.getElementById('weedModalSaveBtn').addEventListener('click', handleWeedModalSave);

    // Weed modal — Cancel button
    document.getElementById('weedModalCancelBtn').addEventListener('click', function() {
        closeModal('weedModal');
    });

    // Weed modal — Close on overlay click
    document.getElementById('weedModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('weedModal');
    });

    // Weed modal — Enter key to save (on name input)
    document.getElementById('weedNameInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleWeedModalSave();
    });

    // Zone assignment modal — Save button
    document.getElementById('weedZoneSaveBtn').addEventListener('click', handleWeedZoneSave);

    // Zone assignment modal — Cancel button
    document.getElementById('weedZoneCancelBtn').addEventListener('click', function() {
        closeModal('weedZoneModal');
    });

    // Zone assignment modal — Close on overlay click
    document.getElementById('weedZoneModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('weedZoneModal');
    });
});
