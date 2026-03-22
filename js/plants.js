// ============================================================
// Plants.js — Plant CRUD, metadata, and display logic
// Handles creating, reading, updating, deleting, and moving
// plants, as well as rendering plant lists and detail pages.
// ============================================================

// ---------- Load Plants in a Zone ----------

/**
 * Loads all plants in a given zone and renders them in the zone detail page.
 * Called from zones.js when loading a zone detail.
 * @param {string} zoneId - The Firestore document ID of the zone.
 */
async function loadPlantsInZone(zoneId) {
    const container = document.getElementById('zonePlantListContainer');
    const emptyState = document.getElementById('zonePlantEmptyState');
    const addPlantBtn = document.getElementById('addPlantBtn');

    // Show the add plant button
    if (addPlantBtn) {
        addPlantBtn.style.display = 'inline-flex';
    }

    try {
        const snapshot = await db.collection('plants')
            .where('zoneId', '==', zoneId)
            .get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No plants in this zone yet.';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Sort plants alphabetically client-side
        const plants = [];
        snapshot.forEach(function(doc) {
            plants.push({ id: doc.id, ...doc.data() });
        });
        plants.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });

        plants.forEach(function(plant) {
            const card = createPlantCard(plant.id, plant);
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading plants:', error);
        emptyState.textContent = 'Error loading plants. Check console for details.';
        emptyState.style.display = 'block';
    }
}

// ---------- Create a Plant Card ----------

/**
 * Creates a clickable card element for a plant.
 * @param {string} id - The plant's Firestore document ID.
 * @param {Object} plant - The plant data.
 * @returns {HTMLElement} The card element.
 */
function createPlantCard(id, plant) {
    const card = document.createElement('div');
    card.className = 'card plant-card';
    card.addEventListener('click', function() {
        window.location.hash = 'plant/' + id;
    });

    const info = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = plant.name;
    info.appendChild(title);

    // Show a brief metadata summary if available
    const meta = plant.metadata || {};
    const summaryParts = [];
    if (meta.sunShade) summaryParts.push(meta.sunShade);
    if (meta.wateringNeeds) summaryParts.push(meta.wateringNeeds);
    if (summaryParts.length > 0) {
        const subtitle = document.createElement('div');
        subtitle.className = 'card-subtitle';
        subtitle.textContent = summaryParts.join(' | ');
        info.appendChild(subtitle);
    }

    card.appendChild(info);

    const arrow = document.createElement('span');
    arrow.className = 'card-arrow';
    arrow.textContent = '\u203A';
    card.appendChild(arrow);

    return card;
}

// ---------- Plant Detail Page ----------

/**
 * Loads and displays the full detail page for a plant.
 * @param {string} plantId - The Firestore document ID of the plant.
 */
async function loadPlantDetail(plantId) {
    const titleEl = document.getElementById('plantTitle');
    const metadataForm = document.getElementById('plantMetadataForm');
    const zoneInfoEl = document.getElementById('plantZoneInfo');
    const activityContainer = document.getElementById('plantActivityContainer');
    const activityEmptyState = document.getElementById('plantActivityEmptyState');

    try {
        const doc = await db.collection('plants').doc(plantId).get();

        if (!doc.exists) {
            titleEl.textContent = 'Plant not found';
            return;
        }

        const plant = doc.data();
        titleEl.textContent = plant.name;

        // Store current plant info for buttons
        window.currentPlant = { id: doc.id, ...plant };

        // Build breadcrumbs: Home > Zone path > Plant Name
        await buildPlantBreadcrumbs(doc.id, plant);

        // Show zone info link
        if (plant.zoneId) {
            const zonePath = await getZonePath(plant.zoneId);
            zoneInfoEl.innerHTML = '<strong>Zone:</strong> ' + zonePath;
        }

        // Populate metadata form (selects + text inputs)
        const meta = plant.metadata || {};
        document.getElementById('plantHeatTolerance').value = meta.heatTolerance || '';
        document.getElementById('plantColdTolerance').value = meta.coldTolerance || '';
        document.getElementById('plantWateringNeeds').value = meta.wateringNeeds || '';
        document.getElementById('plantSunShade').value = meta.sunShade || '';
        document.getElementById('plantBloomMonth').value = meta.bloomMonth || '';
        document.getElementById('plantDormantMonth').value = meta.dormantMonth || '';
        document.getElementById('plantNotes').value = meta.notes || '';

        // Snapshot original values for dirty-state tracking
        snapshotOriginalMetadata();

        // Load problems, facts, projects, calendar events, and activities for this plant
        loadProblems('plant', doc.id, 'plantProblemsContainer', 'plantProblemsEmptyState');
        loadFacts('plant', doc.id, 'plantFactsContainer', 'plantFactsEmptyState');
        loadProjects('plant', doc.id, 'plantProjectsContainer', 'plantProjectsEmptyState');
        if (typeof loadEventsForTarget === 'function') {
            var plantMonths = parseInt(document.getElementById('plantCalendarRangeSelect').value, 10) || 3;
            loadEventsForTarget('plant', doc.id, 'plantCalendarEventsContainer', 'plantCalendarEventsEmptyState', plantMonths);
        }

        // Load activity history
        loadActivities('plant', doc.id, 'plantActivityContainer', 'plantActivityEmptyState');

        // Load photos
        loadPhotos('plant', doc.id, 'plantPhotoContainer', 'plantPhotoEmptyState');

    } catch (error) {
        console.error('Error loading plant detail:', error);
        titleEl.textContent = 'Error loading plant';
    }
}

// ---------- Plant Breadcrumbs ----------

/**
 * Builds breadcrumbs for a plant: Home > Zone chain > Plant name
 * @param {string} plantId - The plant's Firestore document ID.
 * @param {Object} plant - The plant data.
 */
async function buildPlantBreadcrumbs(plantId, plant) {
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    const crumbs = [];

    // Walk up the zone parent chain
    let currentZoneId = plant.zoneId;
    while (currentZoneId) {
        const zoneDoc = await db.collection('zones').doc(currentZoneId).get();
        if (!zoneDoc.exists) break;
        const zone = zoneDoc.data();
        crumbs.unshift({ id: zoneDoc.id, name: zone.name, type: 'zone' });
        currentZoneId = zone.parentId;
    }

    // Build HTML
    let html = '<a href="#home">Home</a>';
    crumbs.forEach(function(crumb) {
        html += '<span class="separator">&rsaquo;</span>';
        html += '<a href="#zone/' + crumb.id + '">' + escapeHtml(crumb.name) + '</a>';
    });
    html += '<span class="separator">&rsaquo;</span>';
    html += '<span>' + escapeHtml(plant.name) + '</span>';

    breadcrumbBar.innerHTML = html;
}

// ---------- Zone Path Helper ----------

/**
 * Gets the full path string for a zone (e.g., "Front Yard > By Mailbox").
 * @param {string} zoneId - The zone's Firestore document ID.
 * @returns {string} The formatted zone path.
 */
async function getZonePath(zoneId) {
    const parts = [];
    let currentId = zoneId;

    while (currentId) {
        const doc = await db.collection('zones').doc(currentId).get();
        if (!doc.exists) break;
        const zone = doc.data();
        parts.unshift(escapeHtml(zone.name));
        currentId = zone.parentId;
    }

    return parts.join(' &rsaquo; ');
}

// ---------- Add Plant ----------

/**
 * Opens the add-plant modal.
 * @param {string} zoneId - The zone to add the plant to.
 */
function openAddPlantModal(zoneId) {
    const modal = document.getElementById('plantModal');
    const modalTitle = document.getElementById('plantModalTitle');
    const nameInput = document.getElementById('plantNameInput');

    modalTitle.textContent = 'Add Plant';
    nameInput.value = '';

    modal.dataset.mode = 'add';
    modal.dataset.zoneId = zoneId;

    openModal('plantModal');
    nameInput.focus();
}

/**
 * Opens the edit-plant-name modal.
 * @param {string} plantId - The plant's Firestore document ID.
 * @param {string} currentName - The plant's current name.
 */
function openEditPlantNameModal(plantId, currentName) {
    const modal = document.getElementById('plantModal');
    const modalTitle = document.getElementById('plantModalTitle');
    const nameInput = document.getElementById('plantNameInput');

    modalTitle.textContent = 'Edit Plant Name';
    nameInput.value = currentName;

    modal.dataset.mode = 'edit';
    modal.dataset.editId = plantId;

    openModal('plantModal');
    nameInput.focus();
}

/**
 * Handles save for the add/edit plant modal.
 */
async function handlePlantModalSave() {
    const modal = document.getElementById('plantModal');
    const nameInput = document.getElementById('plantNameInput');
    const name = nameInput.value.trim();

    if (!name) {
        alert('Please enter a plant name.');
        return;
    }

    const mode = modal.dataset.mode;

    try {
        if (mode === 'add') {
            const zoneId = modal.dataset.zoneId;
            await db.collection('plants').add({
                name: name,
                zoneId: zoneId,
                metadata: {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Plant added:', name);

        } else if (mode === 'edit') {
            const plantId = modal.dataset.editId;
            await db.collection('plants').doc(plantId).update({ name: name });
            console.log('Plant renamed:', name);
        }

        closeModal('plantModal');
        refreshCurrentView();

    } catch (error) {
        console.error('Error saving plant:', error);
        alert('Error saving plant. Check console for details.');
    }
}

// ---------- Plant Metadata — Dirty-State Tracking ----------

/** Stores the original metadata values when the plant is loaded. */
var originalMetadata = {};

/** IDs of all metadata form fields to track. */
var METADATA_FIELD_IDS = [
    'plantHeatTolerance', 'plantColdTolerance', 'plantWateringNeeds',
    'plantSunShade', 'plantBloomMonth', 'plantDormantMonth', 'plantNotes'
];

/**
 * Snapshots the current form field values into originalMetadata.
 * Called after loading a plant and after saving.
 */
function snapshotOriginalMetadata() {
    originalMetadata = {};
    METADATA_FIELD_IDS.forEach(function(fieldId) {
        originalMetadata[fieldId] = document.getElementById(fieldId).value;
    });
    updateMetadataSaveButtonState();
}

/**
 * Compares current field values to the snapshot.
 * Enables Save button if anything changed, disables if all match.
 */
function updateMetadataSaveButtonState() {
    var saveBtn = document.getElementById('saveMetadataBtn');
    var isDirty = false;

    METADATA_FIELD_IDS.forEach(function(fieldId) {
        if (document.getElementById(fieldId).value !== originalMetadata[fieldId]) {
            isDirty = true;
        }
    });

    saveBtn.disabled = !isDirty;
}

// ---------- Save Plant Metadata ----------

/**
 * Saves the metadata form fields for the current plant.
 */
async function savePlantMetadata() {
    if (!window.currentPlant) return;

    const metadata = {
        heatTolerance: document.getElementById('plantHeatTolerance').value.trim(),
        coldTolerance: document.getElementById('plantColdTolerance').value.trim(),
        wateringNeeds: document.getElementById('plantWateringNeeds').value.trim(),
        sunShade: document.getElementById('plantSunShade').value.trim(),
        bloomMonth: document.getElementById('plantBloomMonth').value.trim(),
        dormantMonth: document.getElementById('plantDormantMonth').value.trim(),
        notes: document.getElementById('plantNotes').value.trim()
    };

    try {
        await db.collection('plants').doc(window.currentPlant.id).update({
            metadata: metadata
        });

        // Update local copy
        window.currentPlant.metadata = metadata;

        // Re-snapshot original values so Save button becomes disabled again
        snapshotOriginalMetadata();

        // Show a brief confirmation
        const saveBtn = document.getElementById('saveMetadataBtn');
        saveBtn.textContent = 'Saved!';
        saveBtn.classList.remove('btn-primary');
        saveBtn.classList.add('btn-secondary');
        saveBtn.disabled = true;
        setTimeout(function() {
            saveBtn.textContent = 'Save Care Info';
            saveBtn.classList.remove('btn-secondary');
            saveBtn.classList.add('btn-primary');
            updateMetadataSaveButtonState();
        }, 1500);

        console.log('Plant metadata saved');

    } catch (error) {
        console.error('Error saving metadata:', error);
        alert('Error saving metadata. Check console for details.');
    }
}

// ---------- Move Plant to Another Zone ----------

/**
 * Opens the move-plant modal and populates it with all available zones.
 */
async function openMovePlantModal() {
    if (!window.currentPlant) return;

    const select = document.getElementById('movePlantZoneSelect');
    select.innerHTML = '<option value="">Loading zones...</option>';

    openModal('movePlantModal');

    try {
        // Load all zones
        const snapshot = await db.collection('zones').get();
        const zones = [];
        snapshot.forEach(function(doc) {
            zones.push({ id: doc.id, ...doc.data() });
        });

        // Build a tree structure for display
        const options = buildZoneOptionsTree(zones, null, '');

        select.innerHTML = '<option value="">-- Select a zone --</option>';
        options.forEach(function(opt) {
            const option = document.createElement('option');
            option.value = opt.id;
            option.textContent = opt.label;
            // Highlight current zone
            if (opt.id === window.currentPlant.zoneId) {
                option.textContent += ' (current)';
                option.disabled = true;
            }
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading zones for move:', error);
        select.innerHTML = '<option value="">Error loading zones</option>';
    }
}

/**
 * Builds a flat list of zone options with indentation to show hierarchy.
 * @param {Array} allZones - All zone documents.
 * @param {string|null} parentId - The parent ID to filter by.
 * @param {string} prefix - Indentation prefix for display.
 * @returns {Array} Flat array of {id, label} objects.
 */
function buildZoneOptionsTree(allZones, parentId, prefix) {
    const results = [];
    const children = allZones
        .filter(function(z) { return z.parentId === parentId; })
        .sort(function(a, b) { return a.name.localeCompare(b.name); });

    children.forEach(function(zone) {
        results.push({ id: zone.id, label: prefix + zone.name });
        // Recurse into children with deeper indentation
        const subResults = buildZoneOptionsTree(allZones, zone.id, prefix + '\u00A0\u00A0\u00A0\u00A0');
        results.push.apply(results, subResults);
    });

    return results;
}

/**
 * Handles the save for moving a plant to a new zone.
 */
async function handleMovePlantSave() {
    const select = document.getElementById('movePlantZoneSelect');
    const newZoneId = select.value;

    if (!newZoneId) {
        alert('Please select a zone.');
        return;
    }

    if (!window.currentPlant) return;

    try {
        await db.collection('plants').doc(window.currentPlant.id).update({
            zoneId: newZoneId
        });

        console.log('Plant moved to zone:', newZoneId);
        closeModal('movePlantModal');

        // Reload the plant detail to reflect the new zone
        loadPlantDetail(window.currentPlant.id);

    } catch (error) {
        console.error('Error moving plant:', error);
        alert('Error moving plant. Check console for details.');
    }
}

// ---------- Delete Plant ----------

/**
 * Deletes the current plant after confirmation.
 */
async function handleDeletePlant() {
    if (!window.currentPlant) return;

    if (!confirm('Are you sure you want to delete "' + window.currentPlant.name + '"? This cannot be undone.')) {
        return;
    }

    try {
        const zoneId = window.currentPlant.zoneId;
        await db.collection('plants').doc(window.currentPlant.id).delete();
        console.log('Plant deleted:', window.currentPlant.name);

        // Navigate back to the zone
        window.location.hash = 'zone/' + zoneId;

    } catch (error) {
        console.error('Error deleting plant:', error);
        alert('Error deleting plant. Check console for details.');
    }
}

// ---------- View All Plants (Recursive Zone Hierarchy) ----------

/**
 * Loads all plants in the current zone AND all its sub-zones recursively.
 * Displays them as a flat list with their zone path shown.
 */
async function loadAllPlantsInHierarchy() {
    if (!window.currentZone) return;

    const container = document.getElementById('allPlantsListContainer');
    const emptyState = document.getElementById('allPlantsEmptyState');
    const section = document.getElementById('viewAllPlantsSection');

    section.style.display = 'block';
    container.innerHTML = '';
    emptyState.textContent = 'Loading...';
    emptyState.style.display = 'block';

    try {
        // Step 1: Collect all zone IDs in the hierarchy (current zone + all descendants)
        const zoneIds = await getDescendantZoneIds(window.currentZone.id);

        // Step 2: Load plants from all these zones
        // Firestore 'in' queries support up to 10 values, so we may need multiple queries
        const allPlants = [];
        const chunks = chunkArray(zoneIds, 10);

        for (var i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            var snapshot = await db.collection('plants')
                .where('zoneId', 'in', chunk)
                .get();

            snapshot.forEach(function(doc) {
                allPlants.push({ id: doc.id, ...doc.data() });
            });
        }

        if (allPlants.length === 0) {
            emptyState.textContent = 'No plants found in this zone or any sub-zones.';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Sort alphabetically
        allPlants.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });

        // Step 3: Get zone paths for display (batch-load zone names)
        const zonePathCache = {};

        // Render each plant with its zone path
        for (var j = 0; j < allPlants.length; j++) {
            var plant = allPlants[j];
            // Get or cache the zone path
            if (!zonePathCache[plant.zoneId]) {
                zonePathCache[plant.zoneId] = await getZonePath(plant.zoneId);
            }

            var card = createPlantCardWithPath(plant.id, plant, zonePathCache[plant.zoneId]);
            container.appendChild(card);
        }

    } catch (error) {
        console.error('Error loading all plants in hierarchy:', error);
        emptyState.textContent = 'Error loading plants.';
        emptyState.style.display = 'block';
    }
}

/**
 * Recursively collects all zone IDs for a given zone and its descendants.
 * @param {string} zoneId - The starting zone's Firestore document ID.
 * @returns {Promise<string[]>} Array of zone IDs (includes the starting zone).
 */
async function getDescendantZoneIds(zoneId) {
    const ids = [zoneId];

    const snapshot = await db.collection('zones')
        .where('parentId', '==', zoneId)
        .get();

    const childPromises = [];
    snapshot.forEach(function(doc) {
        childPromises.push(getDescendantZoneIds(doc.id));
    });

    const childResults = await Promise.all(childPromises);
    childResults.forEach(function(childIds) {
        ids.push.apply(ids, childIds);
    });

    return ids;
}

/**
 * Splits an array into chunks of a given size.
 * @param {Array} array - The array to chunk.
 * @param {number} size - The maximum chunk size.
 * @returns {Array} Array of chunks.
 */
function chunkArray(array, size) {
    const chunks = [];
    for (var i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Creates a plant card that also shows the zone path underneath the name.
 * @param {string} id - The plant's Firestore document ID.
 * @param {Object} plant - The plant data.
 * @param {string} zonePath - The formatted zone path HTML.
 * @returns {HTMLElement} The card element.
 */
function createPlantCardWithPath(id, plant, zonePath) {
    const card = document.createElement('div');
    card.className = 'card plant-card';
    card.addEventListener('click', function() {
        window.location.hash = 'plant/' + id;
    });

    const info = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = plant.name;
    info.appendChild(title);

    // Show zone path
    const path = document.createElement('div');
    path.className = 'plant-zone-path';
    path.innerHTML = zonePath;
    info.appendChild(path);

    card.appendChild(info);

    const arrow = document.createElement('span');
    arrow.className = 'card-arrow';
    arrow.textContent = '\u203A';
    card.appendChild(arrow);

    return card;
}

// ---------- Refresh Helper ----------

/**
 * Refreshes the current view based on the hash.
 */
function refreshCurrentView() {
    const hash = window.location.hash.slice(1) || 'home';
    const parts = hash.split('/');

    if (parts[0] === 'plant' && parts[1]) {
        loadPlantDetail(parts[1]);
    } else if (parts[0] === 'zone' && parts[1]) {
        loadZoneDetail(parts[1]);
    } else {
        loadZonesList();
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // "Add Plant" button on zone detail page
    document.getElementById('addPlantBtn').addEventListener('click', function() {
        if (window.currentZone) {
            openAddPlantModal(window.currentZone.id);
        }
    });

    // Plant modal — Save button
    document.getElementById('plantModalSaveBtn').addEventListener('click', handlePlantModalSave);

    // Plant modal — Cancel button
    document.getElementById('plantModalCancelBtn').addEventListener('click', function() {
        closeModal('plantModal');
    });

    // Plant modal — Close on overlay click
    document.getElementById('plantModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('plantModal');
    });

    // Plant modal — Enter key to save
    document.getElementById('plantNameInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handlePlantModalSave();
    });

    // Plant detail — Edit name button
    document.getElementById('editPlantNameBtn').addEventListener('click', function() {
        if (window.currentPlant) {
            openEditPlantNameModal(window.currentPlant.id, window.currentPlant.name);
        }
    });

    // Plant detail — Move button
    document.getElementById('movePlantBtn').addEventListener('click', openMovePlantModal);

    // Plant detail — Delete button
    document.getElementById('deletePlantBtn').addEventListener('click', handleDeletePlant);

    // Plant detail — Save metadata button
    document.getElementById('saveMetadataBtn').addEventListener('click', savePlantMetadata);

    // Plant metadata — Dirty-state tracking on all metadata fields
    METADATA_FIELD_IDS.forEach(function(fieldId) {
        var el = document.getElementById(fieldId);
        // Use 'input' for text/textarea, 'change' for selects
        el.addEventListener('input', updateMetadataSaveButtonState);
        el.addEventListener('change', updateMetadataSaveButtonState);
    });

    // Move plant modal — Save button
    document.getElementById('movePlantSaveBtn').addEventListener('click', handleMovePlantSave);

    // Move plant modal — Cancel button
    document.getElementById('movePlantCancelBtn').addEventListener('click', function() {
        closeModal('movePlantModal');
    });

    // Move plant modal — Close on overlay click
    document.getElementById('movePlantModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('movePlantModal');
    });

    // "View All Plants" button on zone detail page
    document.getElementById('viewAllPlantsBtn').addEventListener('click', loadAllPlantsInHierarchy);

    // "Hide" button for View All Plants section
    document.getElementById('hideAllPlantsBtn').addEventListener('click', function() {
        document.getElementById('viewAllPlantsSection').style.display = 'none';
    });

    // "Add Event" button on plant detail page
    document.getElementById('addPlantCalendarEventBtn').addEventListener('click', function() {
        if (window.currentPlant && typeof openAddCalendarEventModal === 'function') {
            var reloadFn = function() {
                var months = parseInt(document.getElementById('plantCalendarRangeSelect').value, 10) || 3;
                loadEventsForTarget('plant', window.currentPlant.id,
                    'plantCalendarEventsContainer', 'plantCalendarEventsEmptyState', months);
            };
            openAddCalendarEventModal('plant', window.currentPlant.id, reloadFn);
        }
    });

    // Range picker for plant calendar events
    document.getElementById('plantCalendarRangeSelect').addEventListener('change', function() {
        if (window.currentPlant) {
            var months = parseInt(this.value, 10) || 3;
            loadEventsForTarget('plant', window.currentPlant.id,
                'plantCalendarEventsContainer', 'plantCalendarEventsEmptyState', months);
        }
    });
});
