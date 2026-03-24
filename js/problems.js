// ============================================================
// Problems.js — Problems / Concerns CRUD and display logic
// Problems can be attached to plants or zones via targetType/targetId.
// When resolved, a resolvedAt timestamp is recorded.
// Resolved problems are hidden by default (toggle with checkbox).
// Stored in Firestore collection: "problems"
// ============================================================

// ---------- Shared Date/Time Formatter ----------

/**
 * Formats an ISO date string or Firestore Timestamp for display.
 * Returns a readable date/time like "Mar 9, 2026, 2:30 PM"
 * This function is used by both problems.js and projects.js.
 * @param {string|Object} dateValue - ISO string or Firestore Timestamp.
 * @returns {string} Formatted date/time string.
 */
function formatDateTime(dateValue) {
    if (!dateValue) return '';
    var date;
    if (dateValue.toDate) {
        date = dateValue.toDate();  // Firestore Timestamp
    } else {
        date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// ---------- Load & Display Problems ----------

/**
 * Loads and displays problems for a given target (plant or zone).
 * Resolved problems are hidden unless the "show resolved" checkbox is checked.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The Firestore document ID of the plant or zone.
 * @param {string} containerId - The ID of the container element to render into.
 * @param {string} emptyStateId - The ID of the empty-state message element.
 */
async function loadProblems(targetType, targetId, containerId, emptyStateId) {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);

    // Check if "show resolved" checkbox is checked — map every targetType to its checkbox ID
    const checkboxMap = {
        'plant':            'showResolvedPlantProblems',
        'zone':             'showResolvedZoneProblems',
        'vehicle':          'showResolvedVehicleProblems',
        'garageroom':       'showResolvedGarageRoomProblems',
        'garagething':      'showResolvedGarageThingProblems',
        'garagesubthing':   'showResolvedGarageSubThingProblems',
        'structure':        'showResolvedStructureProblems',
        'structurething':   'showResolvedStructureThingProblems',
        'structuresubthing':'showResolvedStructureSubThingProblems',
        'floor':            'showResolvedFloorProblems',
        'room':             'showResolvedRoomProblems',
        'thing':            'showResolvedThingProblems',
        'subthing':         'showResolvedSubThingProblems',
        'panel':            'showResolvedPanelProblems',
        'weed':             'showResolvedWeedProblems',
    };
    const checkboxId = checkboxMap[targetType];
    const checkbox = checkboxId ? document.getElementById(checkboxId) : null;
    const showResolved = checkbox ? checkbox.checked : false;

    try {
        const snapshot = await userCol('problems')
            .where('targetType', '==', targetType)
            .where('targetId', '==', targetId)
            .get();

        container.innerHTML = '';

        if (snapshot.empty) {
            emptyState.textContent = 'No problems or concerns logged.';
            emptyState.style.display = 'block';
            return;
        }

        // Collect all problems
        const allProblems = [];
        snapshot.forEach(function(doc) {
            allProblems.push({ id: doc.id, ...doc.data() });
        });

        // Separate open and resolved
        const openProblems = allProblems.filter(function(p) {
            return p.status === 'open';
        });
        const resolvedProblems = allProblems.filter(function(p) {
            return p.status === 'resolved';
        });

        // Sort each group: newest first by dateLogged
        openProblems.sort(function(a, b) {
            return (b.dateLogged || '').localeCompare(a.dateLogged || '');
        });
        resolvedProblems.sort(function(a, b) {
            return (b.dateLogged || '').localeCompare(a.dateLogged || '');
        });

        // Build display list: open always shown, resolved only if checkbox checked
        const displayProblems = showResolved
            ? openProblems.concat(resolvedProblems)
            : openProblems;

        if (displayProblems.length === 0) {
            if (resolvedProblems.length > 0) {
                emptyState.textContent = 'All issues resolved! Check "Show resolved" to see them.';
            } else {
                emptyState.textContent = 'No problems or concerns logged.';
            }
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        displayProblems.forEach(function(problem) {
            const item = createProblemItem(problem, targetType, targetId);
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error loading problems:', error);
        emptyState.textContent = 'Error loading problems.';
        emptyState.style.display = 'block';
    }
}

// ---------- Create a Problem Item Element ----------

/**
 * Creates a DOM element representing a single problem/concern.
 * Shows a resolved timestamp when the problem has been resolved.
 * @param {Object} problem - The problem data.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 * @returns {HTMLElement} The problem item element.
 */
function createProblemItem(problem, targetType, targetId) {
    const item = document.createElement('div');
    item.className = 'problem-item' + (problem.status === 'resolved' ? ' resolved' : '');

    // Left side: badge + description (and optional secondary info)
    const leftSide = document.createElement('div');
    leftSide.className = 'problem-left';

    // Top row: badge + description
    const topRow = document.createElement('div');
    topRow.className = 'problem-top-row';

    const badge = document.createElement('span');
    badge.className = 'problem-badge ' + (problem.status === 'open' ? 'badge-open' : 'badge-resolved');
    badge.textContent = problem.status === 'open' ? 'Open' : 'Resolved';
    topRow.appendChild(badge);

    const desc = document.createElement('span');
    desc.className = 'problem-description';
    desc.textContent = problem.description;
    topRow.appendChild(desc);

    leftSide.appendChild(topRow);

    // Secondary info line (date + notes preview)
    var secondaryParts = [];
    if (problem.dateLogged) secondaryParts.push('Logged: ' + problem.dateLogged);
    if (problem.status === 'resolved' && problem.resolvedAt) {
        secondaryParts.push('Resolved: ' + formatDateTime(problem.resolvedAt));
    }
    if (problem.notes) secondaryParts.push(problem.notes);

    if (secondaryParts.length > 0) {
        const secondary = document.createElement('div');
        secondary.className = 'problem-secondary';
        secondary.textContent = secondaryParts.join(' \u2022 ');
        leftSide.appendChild(secondary);
    }

    item.appendChild(leftSide);

    // Right side: action buttons
    const actions = document.createElement('div');
    actions.className = 'problem-actions';

    // Toggle status button (Resolve / Reopen)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-small ' + (problem.status === 'open' ? 'btn-primary' : 'btn-secondary');
    toggleBtn.textContent = problem.status === 'open' ? 'Resolve' : 'Reopen';
    toggleBtn.addEventListener('click', function() {
        toggleProblemStatus(problem.id, problem.status, targetType, targetId);
    });
    actions.appendChild(toggleBtn);

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-small btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function() {
        openEditProblemModal(problem, targetType, targetId);
    });
    actions.appendChild(editBtn);

    item.appendChild(actions);

    return item;
}

// ---------- Add Problem ----------

/**
 * Opens the add-problem modal.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
function openAddProblemModal(targetType, targetId) {
    const modal = document.getElementById('problemModal');
    const modalTitle = document.getElementById('problemModalTitle');
    const descInput = document.getElementById('problemDescInput');
    const notesInput = document.getElementById('problemNotesInput');

    modalTitle.textContent = 'Add Problem / Concern';
    descInput.value = '';
    notesInput.value = '';

    modal.dataset.mode = 'add';
    modal.dataset.targetType = targetType;
    modal.dataset.targetId = targetId;

    // Hide Delete button in add mode; show (empty) Facts section
    document.getElementById('problemModalDeleteBtn').style.display = 'none';
    document.getElementById('problemFactsSection').style.display = 'block';
    document.getElementById('problemFactsContainer').innerHTML = '';
    document.getElementById('problemFactsEmptyState').textContent = 'Save this problem first, then add facts.';
    document.getElementById('problemFactsEmptyState').style.display = 'block';

    openModal('problemModal');
    descInput.focus();
}

// ---------- Edit Problem ----------

/**
 * Opens the edit-problem modal with existing data.
 * @param {Object} problem - The problem data (including id).
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
function openEditProblemModal(problem, targetType, targetId) {
    const modal = document.getElementById('problemModal');
    const modalTitle = document.getElementById('problemModalTitle');
    const descInput = document.getElementById('problemDescInput');
    const notesInput = document.getElementById('problemNotesInput');

    modalTitle.textContent = 'Edit Problem / Concern';
    descInput.value = problem.description || '';
    notesInput.value = problem.notes || '';

    modal.dataset.mode = 'edit';
    modal.dataset.editId = problem.id;
    modal.dataset.targetType = targetType;
    modal.dataset.targetId = targetId;

    // Show Delete button in edit mode
    document.getElementById('problemModalDeleteBtn').style.display = 'inline-flex';

    // Show Facts section and load facts for this problem
    document.getElementById('problemFactsSection').style.display = 'block';
    loadFacts('problem', problem.id, 'problemFactsContainer', 'problemFactsEmptyState');

    openModal('problemModal');
    descInput.focus();
}

// ---------- Save Problem (Add or Edit) ----------

/**
 * Handles the save button in the problem modal.
 */
async function handleProblemModalSave() {
    const modal = document.getElementById('problemModal');
    const descInput = document.getElementById('problemDescInput');
    const notesInput = document.getElementById('problemNotesInput');

    const description = descInput.value.trim();
    const notes = notesInput.value.trim();

    if (!description) {
        alert('Please enter a description.');
        return;
    }

    const mode = modal.dataset.mode;
    const targetType = modal.dataset.targetType;
    const targetId = modal.dataset.targetId;

    try {
        if (mode === 'add') {
            await userCol('problems').add({
                targetType: targetType,
                targetId: targetId,
                description: description,
                notes: notes,
                status: 'open',
                dateLogged: new Date().toISOString().split('T')[0],  // YYYY-MM-DD
                resolvedAt: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Problem added:', description);

        } else if (mode === 'edit') {
            const problemId = modal.dataset.editId;
            await userCol('problems').doc(problemId).update({
                description: description,
                notes: notes
            });
            console.log('Problem updated:', description);
        }

        closeModal('problemModal');
        reloadProblemsForCurrentTarget(targetType, targetId);

    } catch (error) {
        console.error('Error saving problem:', error);
        alert('Error saving problem. Check console for details.');
    }
}

// ---------- Toggle Problem Status ----------

/**
 * Toggles a problem between open and resolved.
 * When resolving, records a resolvedAt timestamp.
 * When reopening, clears the resolvedAt timestamp.
 * @param {string} problemId - The problem's Firestore document ID.
 * @param {string} currentStatus - The current status ("open" or "resolved").
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
async function toggleProblemStatus(problemId, currentStatus, targetType, targetId) {
    const newStatus = currentStatus === 'open' ? 'resolved' : 'open';

    // Confirm before resolving (not needed for reopening)
    if (newStatus === 'resolved') {
        if (!confirm('Mark this problem as resolved?')) return;
    }

    try {
        const updateData = { status: newStatus };

        if (newStatus === 'resolved') {
            // Record the resolution timestamp
            updateData.resolvedAt = new Date().toISOString();
        } else {
            // Clear the resolution timestamp when reopening
            updateData.resolvedAt = null;
        }

        await userCol('problems').doc(problemId).update(updateData);
        console.log('Problem status changed to:', newStatus);
        reloadProblemsForCurrentTarget(targetType, targetId);

    } catch (error) {
        console.error('Error toggling problem status:', error);
        alert('Error updating problem. Check console for details.');
    }
}

// ---------- Delete Problem ----------

/**
 * Deletes a problem after confirmation.
 * @param {string} problemId - The problem's Firestore document ID.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
async function handleDeleteProblem(problemId, targetType, targetId) {
    if (!confirm('Are you sure you want to delete this problem?')) {
        return;
    }

    try {
        await userCol('problems').doc(problemId).delete();
        console.log('Problem deleted:', problemId);
        reloadProblemsForCurrentTarget(targetType, targetId);

    } catch (error) {
        console.error('Error deleting problem:', error);
        alert('Error deleting problem. Check console for details.');
    }
}

// ---------- Reload Helper ----------

/**
 * Reloads the problems list for the current target.
 * Determines the correct container IDs based on target type.
 * @param {string} targetType - "plant" or "zone"
 * @param {string} targetId - The target's Firestore document ID.
 */
function reloadProblemsForCurrentTarget(targetType, targetId) {
    var map = {
        'plant':            ['plantProblemsContainer',               'plantProblemsEmptyState'],
        'zone':             ['zoneProblemsContainer',                'zoneProblemsEmptyState'],
        'vehicle':          ['vehicleProblemsContainer',             'vehicleProblemsEmptyState'],
        'panel':            ['panelProblemsContainer',               'panelProblemsEmptyState'],
        'floor':            ['floorProblemsContainer',               'floorProblemsEmptyState'],
        'room':             ['roomProblemsContainer',                'roomProblemsEmptyState'],
        'thing':            ['thingProblemsContainer',               'thingProblemsEmptyState'],
        'subthing':         ['stProblemsContainer',                  'stProblemsEmptyState'],
        'garageroom':       ['garageRoomProblemsContainer',          'garageRoomProblemsEmpty'],
        'garagething':      ['garageThingProblemsContainer',         'garageThingProblemsEmpty'],
        'garagesubthing':   ['garageSubThingProblemsContainer',      'garageSubThingProblemsEmpty'],
        'structure':        ['structureProblemsContainer',           'structureProblemsEmpty'],
        'structurething':   ['structureThingProblemsContainer',      'structureThingProblemsEmpty'],
        'structuresubthing':['structureSubThingProblemsContainer',   'structureSubThingProblemsEmpty'],
        'fpOutlet':         ['fpOutletProblemsContainer',            'fpOutletProblemsEmptyState'],
        'fpSwitch':         ['fpSwitchProblemsContainer',            'fpSwitchProblemsEmptyState'],
        'fpPlumbing':       ['fpPlumbingProblemsContainer',          'fpPlumbingProblemsEmptyState'],
        'fpCeiling':        ['fpCeilingProblemsContainer',           'fpCeilingProblemsEmptyState'],
        'breaker':          ['breakerProblemsContainer',             'breakerProblemsEmptyState'],
        'weed':             ['weedProblemsContainer',                'weedProblemsEmptyState'],
    };
    var ids = map[targetType];
    if (ids) {
        loadProblems(targetType, targetId, ids[0], ids[1]);
    }
}

// ---------- Ensure Problem Saved (for facts in add mode) ----------

/**
 * If the problem modal is in add mode, saves the problem and switches to edit mode.
 * Used by the facts "+ Add" button so facts can be added during initial problem creation.
 * @returns {string|null} The problem ID if saved/already exists, or null if validation failed.
 */
async function ensureProblemSaved() {
    var modal = document.getElementById('problemModal');
    if (modal.dataset.mode === 'edit') {
        return modal.dataset.editId || null;
    }

    // In add mode — validate then save
    var description = document.getElementById('problemDescInput').value.trim();
    var notes = document.getElementById('problemNotesInput').value.trim();
    var targetType = modal.dataset.targetType;
    var targetId = modal.dataset.targetId;

    if (!description) {
        alert('Please enter a description before adding facts.');
        return null;
    }

    try {
        var docRef = await userCol('problems').add({
            targetType: targetType,
            targetId: targetId,
            description: description,
            notes: notes,
            status: 'open',
            dateLogged: new Date().toISOString().split('T')[0],
            resolvedAt: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('Problem auto-saved for facts:', description);

        // Switch modal to edit mode so subsequent saves update instead of re-inserting
        modal.dataset.mode = 'edit';
        modal.dataset.editId = docRef.id;
        document.getElementById('problemModalTitle').textContent = 'Edit Problem / Concern';
        document.getElementById('problemModalDeleteBtn').style.display = 'inline-flex';

        // Reload the facts section now that we have an ID
        loadFacts('problem', docRef.id, 'problemFactsContainer', 'problemFactsEmptyState');

        // Reload the problems list in the background
        reloadProblemsForCurrentTarget(targetType, targetId);

        return docRef.id;

    } catch (error) {
        console.error('Error auto-saving problem:', error);
        alert('Error saving problem. Check console for details.');
        return null;
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // "Add Problem" buttons (plant and zone detail pages)
    document.getElementById('addPlantProblemBtn').addEventListener('click', function() {
        if (window.currentPlant) {
            openAddProblemModal('plant', window.currentPlant.id);
        }
    });

    document.getElementById('addZoneProblemBtn').addEventListener('click', function() {
        if (window.currentZone) {
            openAddProblemModal('zone', window.currentZone.id);
        }
    });

    // "Show resolved" checkboxes — reload list when toggled
    // Uses a helper to avoid repetition across all target types
    function wireShowResolved(checkboxId, getTargetFn, containerId, emptyId, targetType) {
        var cb = document.getElementById(checkboxId);
        if (!cb) return;
        cb.addEventListener('change', function() {
            var target = getTargetFn();
            if (target) loadProblems(targetType, target.id, containerId, emptyId);
        });
    }

    wireShowResolved('showResolvedZoneProblems',             function(){ return window.currentZone; },           'zoneProblemsContainer',               'zoneProblemsEmptyState',           'zone');
    wireShowResolved('showResolvedPlantProblems',            function(){ return window.currentPlant; },          'plantProblemsContainer',              'plantProblemsEmptyState',          'plant');
    wireShowResolved('showResolvedVehicleProblems',          function(){ return window.currentVehicle; },        'vehicleProblemsContainer',            'vehicleProblemsEmptyState',        'vehicle');
    wireShowResolved('showResolvedGarageRoomProblems',       function(){ return window.currentGarageRoom; },     'garageRoomProblemsContainer',         'garageRoomProblemsEmpty',          'garageroom');
    wireShowResolved('showResolvedGarageThingProblems',      function(){ return window.currentGarageThing; },    'garageThingProblemsContainer',        'garageThingProblemsEmpty',         'garagething');
    wireShowResolved('showResolvedGarageSubThingProblems',   function(){ return window.currentGarageSubThing; }, 'garageSubThingProblemsContainer',     'garageSubThingProblemsEmpty',      'garagesubthing');
    wireShowResolved('showResolvedStructureProblems',        function(){ return window.currentStructure; },      'structureProblemsContainer',          'structureProblemsEmpty',           'structure');
    wireShowResolved('showResolvedStructureThingProblems',   function(){ return window.currentStructureThing; }, 'structureThingProblemsContainer',     'structureThingProblemsEmpty',      'structurething');
    wireShowResolved('showResolvedStructureSubThingProblems',function(){ return window.currentStructureSubThing;},'structureSubThingProblemsContainer', 'structureSubThingProblemsEmpty',   'structuresubthing');
    wireShowResolved('showResolvedFloorProblems',            function(){ return window.currentFloor; },          'floorProblemsContainer',              'floorProblemsEmptyState',          'floor');
    wireShowResolved('showResolvedRoomProblems',             function(){ return window.currentRoom; },           'roomProblemsContainer',               'roomProblemsEmptyState',           'room');
    wireShowResolved('showResolvedThingProblems',            function(){ return window.currentThing; },          'thingProblemsContainer',              'thingProblemsEmptyState',          'thing');
    wireShowResolved('showResolvedSubThingProblems',         function(){ return window.currentSubThing; },       'stProblemsContainer',                 'stProblemsEmptyState',             'subthing');
    wireShowResolved('showResolvedPanelProblems',            function(){ return window.currentPanel; },          'panelProblemsContainer',              'panelProblemsEmptyState',          'panel');

    // Problem modal — Save button
    document.getElementById('problemModalSaveBtn').addEventListener('click', handleProblemModalSave);

    // Problem modal — Delete button (only visible in edit mode)
    document.getElementById('problemModalDeleteBtn').addEventListener('click', function() {
        var modal = document.getElementById('problemModal');
        var problemId = modal.dataset.editId;
        var targetType = modal.dataset.targetType;
        var targetId = modal.dataset.targetId;
        if (problemId) {
            closeModal('problemModal');
            handleDeleteProblem(problemId, targetType, targetId);
        }
    });

    // Problem modal — Cancel button
    document.getElementById('problemModalCancelBtn').addEventListener('click', function() {
        closeModal('problemModal');
    });

    // Problem modal — Close on overlay click
    document.getElementById('problemModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('problemModal');
    });
});
