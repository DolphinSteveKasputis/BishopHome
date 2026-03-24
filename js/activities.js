// ============================================================
// Activities.js — Activity logging, history display, and Saved Actions
// Activities are logged against plants, zones, or weeds.
// Saved Actions are reusable templates that pre-fill the activity form.
// Firestore collections: "activities" and "savedActions"
//
// Multi-chemical support: activities and saved actions store chemicalIds[]
// (array). Old records with a single chemicalId are normalized on read.
// ============================================================

/** Chemical IDs currently selected in the saved-action modal. */
var savedActionSelectedChemicalIds = [];

// ---------- Chemical Checkbox List Helpers ----------

/**
 * Normalizes an activity or saved action record so it always has chemicalIds[].
 * Old records stored a single chemicalId string.
 * @param {Object} record - The activity or saved action data.
 * @returns {string[]} The array of chemical IDs.
 */
function normalizeChemicalIds(record) {
    if (Array.isArray(record.chemicalIds)) {
        return record.chemicalIds;
    }
    if (record.chemicalId) {
        return [record.chemicalId];
    }
    return [];
}

/**
 * Builds a checkbox list of all chemicals inside a container element.
 * @param {string} containerId - The ID of the div to populate.
 * @param {string[]} selectedIds - Array of chemical IDs to pre-check.
 */
async function buildChemicalCheckboxList(containerId, selectedIds) {
    var container = document.getElementById(containerId);
    container.innerHTML = '<em style="color:#888;font-size:0.85em;">Loading...</em>';

    try {
        var chemicals = await getAllChemicals();

        container.innerHTML = '';

        if (chemicals.length === 0) {
            container.innerHTML = '<em style="color:#888;font-size:0.85em;">No chemicals added yet.</em>';
            return;
        }

        chemicals.forEach(function(chem) {
            var label = document.createElement('label');
            label.className = 'zone-checkbox-item';

            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = chem.id;
            checkbox.checked = selectedIds && selectedIds.indexOf(chem.id) >= 0;

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(' ' + chem.name));
            container.appendChild(label);
        });

    } catch (e) {
        console.error('Error loading chemicals for checkbox list:', e);
        container.innerHTML = '<em style="color:#888;font-size:0.85em;">Error loading chemicals.</em>';
    }
}

/**
 * Reads all checked chemical IDs from a checkbox list container.
 * @param {string} containerId - The ID of the checkbox list container.
 * @returns {string[]} Array of checked chemical IDs.
 */
function getCheckedChemicalIds(containerId) {
    var container = document.getElementById(containerId);
    var checked = [];
    var checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(function(cb) {
        if (cb.checked) {
            checked.push(cb.value);
        }
    });
    return checked;
}

// ---------- Amount Used Visibility Helper ----------

/**
 * Shows or hides the "Amount Used" field in the log-activity modal based on
 * whether at least one chemical checkbox is currently checked.
 * Called whenever checkboxes change or the modal opens.
 */
function updateAmountUsedVisibility() {
    var anyChecked = getCheckedChemicalIds('activityChemicalList').length > 0;
    var row = document.getElementById('activityAmountUsedRow');
    if (row) row.style.display = anyChecked ? '' : 'none';
}

// ---------- Load & Display Activity History ----------

/**
 * Loads and displays activity history for a given target (plant, zone, or weed).
 * Shows activities in reverse chronological order (newest first).
 * @param {string} targetType - "plant", "zone", or "weed"
 * @param {string} targetId - The Firestore document ID of the target.
 * @param {string} containerId - The ID of the container element.
 * @param {string} emptyStateId - The ID of the empty-state message element.
 */
async function loadActivities(targetType, targetId, containerId, emptyStateId) {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);

    try {
        const snapshot = await userCol('activities')
            .where('targetType', '==', targetType)
            .where('targetId', '==', targetId)
            .get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No activities logged yet.';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Collect and sort by date descending (newest first)
        const activities = [];
        snapshot.forEach(function(doc) {
            activities.push({ id: doc.id, ...doc.data() });
        });
        activities.sort(function(a, b) {
            return (b.date || '').localeCompare(a.date || '');
        });

        // Collect all unique chemical IDs needed (supports both old and new format)
        var allChemIds = [];
        activities.forEach(function(a) {
            var ids = normalizeChemicalIds(a);
            ids.forEach(function(id) {
                if (allChemIds.indexOf(id) < 0) allChemIds.push(id);
            });
        });

        // Fetch chemical names
        var chemicalNames = {};
        for (var i = 0; i < allChemIds.length; i++) {
            try {
                var chemDoc = await userCol('chemicals').doc(allChemIds[i]).get();
                if (chemDoc.exists) {
                    chemicalNames[allChemIds[i]] = chemDoc.data().name;
                }
            } catch (e) {
                // Chemical may have been deleted
            }
        }

        activities.forEach(function(activity) {
            var ids = normalizeChemicalIds(activity);
            var names = ids.map(function(id) { return chemicalNames[id] || 'Unknown'; });
            var item = createActivityItem(activity, names, targetType, targetId);
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading activities:', error);
        emptyState.textContent = 'Error loading activities.';
        emptyState.style.display = 'block';
    }
}

// ---------- Create an Activity Item Element ----------

/**
 * Creates a compact DOM element representing a single activity.
 * @param {Object} activity - The activity data.
 * @param {string[]} chemicalNames - Array of chemical names used (may be empty).
 * @param {string} targetType - "plant", "zone", or "weed"
 * @param {string} targetId - The target's Firestore document ID.
 * @returns {HTMLElement} The activity item element.
 */
function createActivityItem(activity, chemicalNames, targetType, targetId) {
    const item = document.createElement('div');
    item.className = 'activity-item';

    // Left side: date + description (compact)
    const leftSide = document.createElement('div');
    leftSide.className = 'activity-left';

    const dateBadge = document.createElement('span');
    dateBadge.className = 'activity-date';
    dateBadge.textContent = activity.date || 'No date';
    leftSide.appendChild(dateBadge);

    const desc = document.createElement('span');
    desc.className = 'activity-description';
    desc.textContent = activity.description;
    leftSide.appendChild(desc);

    // Show amount used if recorded (only appears when a chemical was used)
    if (activity.amountUsed) {
        const amountEl = document.createElement('span');
        amountEl.className = 'activity-amount';
        amountEl.textContent = activity.amountUsed;
        leftSide.appendChild(amountEl);
    }

    item.appendChild(leftSide);

    // Right side: Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-small btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function() {
        openViewActivityModal(activity, chemicalNames, targetType, targetId);
    });
    item.appendChild(editBtn);

    return item;
}

// ---------- View/Edit Activity Modal ----------

/**
 * Opens a view modal for an existing activity, showing full details
 * with "Save as Action" and "Delete" buttons.
 * @param {Object} activity - The activity data.
 * @param {string[]} chemicalNames - Array of chemical names (may be empty).
 * @param {string} targetType - "plant", "zone", or "weed".
 * @param {string} targetId - The target's Firestore document ID.
 */
function openViewActivityModal(activity, chemicalNames, targetType, targetId) {
    var modal = document.getElementById('viewActivityModal');

    document.getElementById('viewActivityDate').textContent = activity.date || 'No date';
    document.getElementById('viewActivityDesc').textContent = activity.description || '';
    document.getElementById('viewActivityChemical').textContent =
        chemicalNames && chemicalNames.length > 0 ? chemicalNames.join(', ') : 'None';
    document.getElementById('viewActivityNotes').textContent = activity.notes || 'None';

    // Show Amount Used only when it was recorded
    var amountField = document.getElementById('viewActivityAmountUsedField');
    var amountVal   = activity.amountUsed || '';
    if (amountVal) {
        document.getElementById('viewActivityAmountUsed').textContent = amountVal;
        amountField.style.display = '';
    } else {
        amountField.style.display = 'none';
    }

    // Show/hide "Save as Action" button
    var saveAsBtn = document.getElementById('viewActivitySaveAsBtn');
    if (activity.savedActionId) {
        saveAsBtn.style.display = 'none';
    } else {
        saveAsBtn.style.display = 'inline-flex';
    }

    // Store activity data for action buttons
    modal.dataset.activityId = activity.id;
    modal.dataset.targetType = targetType;
    modal.dataset.targetId = targetId;

    // Wire up Save as Action button
    saveAsBtn.onclick = function() {
        closeModal('viewActivityModal');
        openSaveAsActionModal(activity);
    };

    // Wire up Delete button — confirm before closing modal
    document.getElementById('viewActivityDeleteBtn').onclick = function() {
        if (!confirm('Are you sure you want to delete this activity?')) return;
        closeModal('viewActivityModal');
        handleDeleteActivity(activity.id, targetType, targetId);
    };

    openModal('viewActivityModal');
}

// ---------- Log Activity Modal ----------

/**
 * Opens the log-activity modal for a target (plant, zone, or weed).
 * @param {string} targetType - "plant", "zone", or "weed"
 * @param {string} targetId - The target's Firestore document ID.
 */
async function openLogActivityModal(targetType, targetId) {
    const modal = document.getElementById('activityModal');
    const descInput = document.getElementById('activityDescInput');
    const dateInput = document.getElementById('activityDateInput');
    const notesInput = document.getElementById('activityNotesInput');
    const savedActionSelect = document.getElementById('activitySavedActionSelect');

    // Reset form
    descInput.value = '';
    dateInput.value = new Date().toISOString().split('T')[0];  // Today
    notesInput.value = '';
    document.getElementById('activityAmountUsedInput').value = '';
    document.getElementById('activityAmountUsedRow').style.display = 'none';

    modal.dataset.targetType = targetType;
    modal.dataset.targetId = targetId;

    // Hide chemical/product section for target types that don't use chemicals
    var hideChemicals = (targetType === 'vehicle');
    var chemicalGroup = document.getElementById('activityChemicalList').closest('.form-group');
    if (chemicalGroup) chemicalGroup.style.display = hideChemicals ? 'none' : '';
    document.getElementById('activityAmountUsedRow').style.display = 'none';

    // Build chemical checkbox list (none pre-checked)
    if (!hideChemicals) {
        await buildChemicalCheckboxList('activityChemicalList', []);
        updateAmountUsedVisibility();
    }

    // Populate saved actions dropdown
    savedActionSelect.innerHTML = '<option value="">-- Start from scratch --</option>';
    try {
        const savedActions = await getAllSavedActions();
        savedActions.forEach(function(action) {
            const option = document.createElement('option');
            option.value = action.id;
            option.textContent = action.name;
            savedActionSelect.appendChild(option);
        });
    } catch (e) {
        console.error('Error loading saved actions for dropdown:', e);
    }

    openModal('activityModal');
    descInput.focus();
}

/**
 * Handles picking a saved action from the dropdown — pre-fills the form.
 */
async function handleSavedActionSelect() {
    const select = document.getElementById('activitySavedActionSelect');
    const actionId = select.value;

    if (!actionId) return;  // "Start from scratch" selected

    try {
        const doc = await userCol('savedActions').doc(actionId).get();
        if (!doc.exists) return;

        const action = doc.data();
        document.getElementById('activityDescInput').value = action.description || '';
        document.getElementById('activityNotesInput').value = action.notes || '';

        // Pre-check chemicals from the saved action
        var ids = normalizeChemicalIds(action);
        await buildChemicalCheckboxList('activityChemicalList', ids);
        updateAmountUsedVisibility();

        console.log('Saved action loaded:', action.name);

    } catch (error) {
        console.error('Error loading saved action:', error);
    }
}

// ---------- Save Activity ----------

/**
 * Handles the save button in the log-activity modal.
 */
async function handleActivityModalSave() {
    const modal = document.getElementById('activityModal');
    const descInput = document.getElementById('activityDescInput');
    const dateInput = document.getElementById('activityDateInput');
    const notesInput = document.getElementById('activityNotesInput');
    const savedActionSelect = document.getElementById('activitySavedActionSelect');

    const description = descInput.value.trim();
    const date = dateInput.value;
    const notes = notesInput.value.trim();
    const amountUsed = document.getElementById('activityAmountUsedInput').value.trim();
    const chemicalIds = getCheckedChemicalIds('activityChemicalList');
    const savedActionId = savedActionSelect.value || null;

    if (!description) {
        alert('Please enter a description.');
        return;
    }

    if (!date) {
        alert('Please enter a date.');
        return;
    }

    const targetType = modal.dataset.targetType;
    const targetId = modal.dataset.targetId;

    try {
        await userCol('activities').add({
            targetType:  targetType,
            targetId:    targetId,
            description: description,
            date:        date,
            notes:       notes,
            amountUsed:  amountUsed || '',
            chemicalIds: chemicalIds,
            savedActionId: savedActionId,
            createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('Activity logged:', description);
        closeModal('activityModal');
        reloadActivitiesForCurrentTarget(targetType, targetId);

    } catch (error) {
        console.error('Error logging activity:', error);
        alert('Error logging activity. Check console for details.');
    }
}

// ---------- Delete Activity ----------

/**
 * Deletes an activity after confirmation.
 * @param {string} activityId - The activity's Firestore document ID.
 * @param {string} targetType - "plant", "zone", or "weed"
 * @param {string} targetId - The target's Firestore document ID.
 */
async function handleDeleteActivity(activityId, targetType, targetId) {
    try {
        await userCol('activities').doc(activityId).delete();
        console.log('Activity deleted:', activityId);
        reloadActivitiesForCurrentTarget(targetType, targetId);

    } catch (error) {
        console.error('Error deleting activity:', error);
        alert('Error deleting activity. Check console for details.');
    }
}

// ---------- Reload Helper ----------

/**
 * Reloads activities for the current target.
 * @param {string} targetType - "plant", "zone", or "weed"
 * @param {string} targetId - The target's Firestore document ID.
 */
function reloadActivitiesForCurrentTarget(targetType, targetId) {
    var map = {
        'plant':            ['plantActivityContainer',               'plantActivityEmptyState'],
        'zone':             ['zoneActivityContainer',                'zoneActivityEmptyState'],
        'weed':             ['weedActivityContainer',                'weedActivityEmptyState'],
        'vehicle':          ['vehicleActivitiesContainer',           'vehicleActivitiesEmptyState'],
        'panel':            ['panelActivityContainer',               'panelActivityEmptyState'],
        'floor':            ['floorActivityContainer',               'floorActivityEmptyState'],
        'room':             ['roomActivityContainer',                'roomActivityEmptyState'],
        'thing':            ['thingActivityContainer',               'thingActivityEmptyState'],
        'subthing':         ['stActivityContainer',                  'stActivityEmptyState'],
        'garageroom':       ['garageRoomActivitiesContainer',        'garageRoomActivitiesEmpty'],
        'garagething':      ['garageThingActivitiesContainer',       'garageThingActivitiesEmpty'],
        'garagesubthing':   ['garageSubThingActivitiesContainer',    'garageSubThingActivitiesEmpty'],
        'structure':        ['structureActivitiesContainer',         'structureActivitiesEmpty'],
        'structurething':   ['structureThingActivitiesContainer',    'structureThingActivitiesEmpty'],
        'structuresubthing':['structureSubThingActivitiesContainer', 'structureSubThingActivitiesEmpty'],
    };
    var ids = map[targetType];
    if (ids) {
        loadActivities(targetType, targetId, ids[0], ids[1]);
    }
}

// ============================================================
// SAVED ACTIONS — Reusable activity templates
// ============================================================

// ---------- Load & Display Saved Actions Page ----------

/**
 * Loads all saved actions and displays them on the Saved Actions page.
 */
async function loadSavedActionsList() {
    const container = document.getElementById('savedActionsListContainer');
    const emptyState = document.getElementById('savedActionsEmptyState');

    try {
        const snapshot = await userCol('savedActions').get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No saved actions yet. Log an activity and save it as an action!';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        // Sort alphabetically
        const actions = [];
        snapshot.forEach(function(doc) {
            actions.push({ id: doc.id, ...doc.data() });
        });
        actions.sort(function(a, b) {
            return a.name.localeCompare(b.name);
        });

        // Pre-load all unique chemical names
        var allChemIds = [];
        actions.forEach(function(a) {
            var ids = normalizeChemicalIds(a);
            ids.forEach(function(id) {
                if (allChemIds.indexOf(id) < 0) allChemIds.push(id);
            });
        });

        var chemicalNames = {};
        for (var i = 0; i < allChemIds.length; i++) {
            try {
                var chemDoc = await userCol('chemicals').doc(allChemIds[i]).get();
                if (chemDoc.exists) {
                    chemicalNames[allChemIds[i]] = chemDoc.data().name;
                }
            } catch (e) { /* ignore */ }
        }

        actions.forEach(function(action) {
            var ids = normalizeChemicalIds(action);
            var names = ids.map(function(id) { return chemicalNames[id] || 'Unknown'; });
            var item = createSavedActionItem(action, names);
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading saved actions:', error);
        emptyState.textContent = 'Error loading saved actions.';
        emptyState.style.display = 'block';
    }
}

// ---------- Create a Saved Action Item ----------

/**
 * Creates a DOM element for a saved action on the management page.
 * @param {Object} action - The saved action data.
 * @param {string[]} chemicalNames - Array of chemical names (may be empty).
 * @returns {HTMLElement} The saved action item element.
 */
function createSavedActionItem(action, chemicalNames) {
    const item = document.createElement('div');
    item.className = 'saved-action-item card';

    const info = document.createElement('div');
    info.style.flex = '1';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = action.name;
    info.appendChild(title);

    // Description line
    if (action.description) {
        const desc = document.createElement('div');
        desc.className = 'card-subtitle';
        desc.textContent = action.description;
        info.appendChild(desc);
    }

    // Chemicals line
    if (chemicalNames && chemicalNames.length > 0) {
        const chem = document.createElement('div');
        chem.className = 'card-subtitle';
        chem.style.color = '#2e7d32';
        chem.textContent = 'Chemical: ' + chemicalNames.join(', ');
        info.appendChild(chem);
    }

    // Notes
    if (action.notes) {
        const notes = document.createElement('div');
        notes.className = 'card-subtitle';
        notes.textContent = action.notes;
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
        openEditSavedActionModal(action);
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-small btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        handleDeleteSavedAction(action.id);
    });
    actions.appendChild(deleteBtn);

    item.appendChild(actions);

    return item;
}

// ---------- Chemical Picker (for Saved Action modal) ----------

/**
 * Renders the selected chemicals as tags in the saved-action modal display area.
 * Shows "None selected" when the list is empty.
 * @param {string[]} chemicalIds - Array of selected chemical IDs.
 */
async function renderSavedActionChemicalsDisplay(chemicalIds) {
    var container = document.getElementById('savedActionSelectedChemicalsDisplay');
    container.innerHTML = '';

    if (!chemicalIds || chemicalIds.length === 0) {
        var none = document.createElement('span');
        none.className = 'chemicals-none-text';
        none.textContent = 'None selected';
        container.appendChild(none);
        return;
    }

    try {
        var chemicals = await getAllChemicals();
        var selected = chemicals.filter(function(c) { return chemicalIds.indexOf(c.id) >= 0; });
        if (selected.length === 0) {
            var none = document.createElement('span');
            none.className = 'chemicals-none-text';
            none.textContent = 'None selected';
            container.appendChild(none);
        } else {
            selected.forEach(function(c) {
                var tag = document.createElement('span');
                tag.className = 'chemical-tag';
                tag.textContent = c.name;
                container.appendChild(tag);
            });
        }
    } catch (e) {
        console.error('Error rendering chemicals display:', e);
    }
}

/**
 * Opens the chemical picker modal, pre-checking the currently selected chemicals.
 */
async function openChemicalPickerForSavedAction() {
    await buildChemicalCheckboxList('chemicalPickerList', savedActionSelectedChemicalIds);
    openModal('chemicalPickerModal');
}

/**
 * Applies the chemical picker selection back to the saved-action modal.
 */
async function handleChemicalPickerDone() {
    savedActionSelectedChemicalIds = getCheckedChemicalIds('chemicalPickerList');
    closeModal('chemicalPickerModal');
    await renderSavedActionChemicalsDisplay(savedActionSelectedChemicalIds);
}

// ---------- Save as Action (from an existing activity) ----------

/**
 * Opens a modal to save an activity as a reusable action.
 * @param {Object} activity - The activity to use as a template.
 */
async function openSaveAsActionModal(activity) {
    const modal = document.getElementById('savedActionModal');
    const modalTitle = document.getElementById('savedActionModalTitle');
    const nameInput = document.getElementById('savedActionNameInput');
    const descInput = document.getElementById('savedActionDescInput');
    const notesInput = document.getElementById('savedActionNotesInput');

    modalTitle.textContent = 'Save as Reusable Action';
    nameInput.value = '';
    descInput.value = activity.description || '';
    notesInput.value = activity.notes || '';

    modal.dataset.mode = 'add';

    // Set selected chemicals from the activity and render the display
    savedActionSelectedChemicalIds = normalizeChemicalIds(activity);
    await renderSavedActionChemicalsDisplay(savedActionSelectedChemicalIds);

    openModal('savedActionModal');
    nameInput.focus();
}

// ---------- Add Saved Action (from actions page) ----------

/**
 * Opens the add-saved-action modal from the Actions management page.
 */
async function openAddSavedActionModal() {
    const modal = document.getElementById('savedActionModal');
    const modalTitle = document.getElementById('savedActionModalTitle');
    const nameInput = document.getElementById('savedActionNameInput');
    const descInput = document.getElementById('savedActionDescInput');
    const notesInput = document.getElementById('savedActionNotesInput');

    modalTitle.textContent = 'Add Saved Action';
    nameInput.value = '';
    descInput.value = '';
    notesInput.value = '';

    modal.dataset.mode = 'add';

    // Reset selected chemicals and render empty display
    savedActionSelectedChemicalIds = [];
    await renderSavedActionChemicalsDisplay([]);

    openModal('savedActionModal');
    nameInput.focus();
}

// ---------- Edit Saved Action ----------

/**
 * Opens the edit modal for an existing saved action.
 * @param {Object} action - The saved action data (including id).
 */
async function openEditSavedActionModal(action) {
    const modal = document.getElementById('savedActionModal');
    const modalTitle = document.getElementById('savedActionModalTitle');
    const nameInput = document.getElementById('savedActionNameInput');
    const descInput = document.getElementById('savedActionDescInput');
    const notesInput = document.getElementById('savedActionNotesInput');

    modalTitle.textContent = 'Edit Saved Action';
    nameInput.value = action.name || '';
    descInput.value = action.description || '';
    notesInput.value = action.notes || '';

    modal.dataset.mode = 'edit';
    modal.dataset.editId = action.id;

    // Set selected chemicals from the action and render the display
    savedActionSelectedChemicalIds = normalizeChemicalIds(action);
    await renderSavedActionChemicalsDisplay(savedActionSelectedChemicalIds);

    openModal('savedActionModal');
    nameInput.focus();
}

// ---------- Save Saved Action (Add or Edit) ----------

/**
 * Handles the save button in the saved-action modal.
 */
async function handleSavedActionModalSave() {
    const modal = document.getElementById('savedActionModal');
    const nameInput = document.getElementById('savedActionNameInput');
    const descInput = document.getElementById('savedActionDescInput');
    const notesInput = document.getElementById('savedActionNotesInput');

    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const notes = notesInput.value.trim();
    const chemicalIds = savedActionSelectedChemicalIds;

    if (!name) {
        alert('Please enter a name for this action.');
        return;
    }

    const mode = modal.dataset.mode;

    try {
        if (mode === 'add') {
            await userCol('savedActions').add({
                name: name,
                description: description,
                notes: notes,
                chemicalIds: chemicalIds,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Saved action created:', name);

        } else if (mode === 'edit') {
            const actionId = modal.dataset.editId;
            await userCol('savedActions').doc(actionId).update({
                name: name,
                description: description,
                notes: notes,
                chemicalIds: chemicalIds
            });
            console.log('Saved action updated:', name);
        }

        closeModal('savedActionModal');

        // Refresh the saved actions page if we're on it
        const hash = window.location.hash.slice(1) || 'home';
        if (hash === 'actions') {
            loadSavedActionsList();
        }

    } catch (error) {
        console.error('Error saving action:', error);
        alert('Error saving action. Check console for details.');
    }
}

// ---------- Delete Saved Action ----------

/**
 * Deletes a saved action after confirmation.
 * @param {string} actionId - The saved action's Firestore document ID.
 */
async function handleDeleteSavedAction(actionId) {
    if (!confirm('Are you sure you want to delete this saved action?')) {
        return;
    }

    try {
        await userCol('savedActions').doc(actionId).delete();
        console.log('Saved action deleted:', actionId);
        loadSavedActionsList();

    } catch (error) {
        console.error('Error deleting saved action:', error);
        alert('Error deleting saved action. Check console for details.');
    }
}

// ---------- Helper: Get all saved actions ----------

/**
 * Loads all saved actions and returns them as an array.
 * @returns {Promise<Array>} Array of saved action objects sorted by name.
 */
async function getAllSavedActions() {
    const snapshot = await userCol('savedActions').get();
    const actions = [];
    snapshot.forEach(function(doc) {
        actions.push({ id: doc.id, ...doc.data() });
    });
    actions.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    return actions;
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // "Log Activity" buttons on plant and zone detail pages
    document.getElementById('logPlantActivityBtn').addEventListener('click', function() {
        if (window.currentPlant) {
            openLogActivityModal('plant', window.currentPlant.id);
        }
    });

    document.getElementById('logZoneActivityBtn').addEventListener('click', function() {
        if (window.currentZone) {
            openLogActivityModal('zone', window.currentZone.id);
        }
    });

    // Activity modal — Save button
    document.getElementById('activityModalSaveBtn').addEventListener('click', handleActivityModalSave);

    // Activity modal — Cancel button
    document.getElementById('activityModalCancelBtn').addEventListener('click', function() {
        closeModal('activityModal');
    });

    // Activity modal — Close on overlay click
    document.getElementById('activityModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('activityModal');
    });

    // Activity modal — Saved action dropdown change
    document.getElementById('activitySavedActionSelect').addEventListener('change', handleSavedActionSelect);

    // Activity modal — show/hide Amount Used field when chemicals are checked/unchecked
    // Uses event delegation on the container so it works even after the list is rebuilt
    document.getElementById('activityChemicalList').addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') updateAmountUsedVisibility();
    });

    // "Add Saved Action" button on the actions page
    document.getElementById('addSavedActionBtn').addEventListener('click', openAddSavedActionModal);

    // Saved action modal — Save button
    document.getElementById('savedActionModalSaveBtn').addEventListener('click', handleSavedActionModalSave);

    // Saved action modal — Cancel button
    document.getElementById('savedActionModalCancelBtn').addEventListener('click', function() {
        closeModal('savedActionModal');
    });

    // Chemical picker — open button (inside saved-action modal)
    document.getElementById('openChemicalPickerBtn').addEventListener('click', openChemicalPickerForSavedAction);

    // Chemical picker — Done button
    document.getElementById('chemicalPickerDoneBtn').addEventListener('click', handleChemicalPickerDone);

    // Chemical picker — Cancel button
    document.getElementById('chemicalPickerCancelBtn').addEventListener('click', function() {
        closeModal('chemicalPickerModal');
    });

    // Chemical picker — Close on overlay click
    document.getElementById('chemicalPickerModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('chemicalPickerModal');
    });

    // Saved action modal — intentionally NO overlay click-to-close
    // User must press Save or Cancel to close this modal

    // View activity modal — Close button
    document.getElementById('viewActivityCloseBtn').addEventListener('click', function() {
        closeModal('viewActivityModal');
    });

    // View activity modal — Close on overlay click
    document.getElementById('viewActivityModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('viewActivityModal');
    });
});
