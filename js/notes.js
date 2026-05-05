// ============================================================
// Notes.js — Notebooks and Notes feature
//
// Notebooks are user-created containers for notes.
// Each note belongs to exactly one notebook and contains
// free-form body text plus optional attached photos.
//
// Firestore collections (all via userCol()):
//   notebooks — name, color, noteCount, createdAt, updatedAt
//   notes     — notebookId, body, createdAt, updatedAt
//
// Photos use the existing photos collection:
//   targetType: 'note', targetId: {noteId}
// ============================================================

// ---------- Global State ----------

/** The notebook currently being viewed. Set when navigating to #notebook/{id}. */
window.currentNotebook = null;

/** The note currently being viewed or edited. Null when creating a new note. */
window.currentNote = null;

// ---------- Constants ----------

/** Reserved name for the auto-created fallback notebook. Cannot be deleted. */
var NOTES_DEFAULT_NOTEBOOK_NAME = 'Default';

/**
 * Preset color swatches for the Add/Edit Notebook modal.
 * Each entry: { label, gradient }
 * The gradient string is stored in Firestore and used as a CSS background.
 */
var NOTES_COLOR_SWATCHES = [
    { label: 'Indigo',  gradient: 'linear-gradient(135deg, #6366f1, #a5b4fc)' },
    { label: 'Teal',    gradient: 'linear-gradient(135deg, #0d9488, #34d399)' },
    { label: 'Rose',    gradient: 'linear-gradient(135deg, #e11d48, #fb7185)' },
    { label: 'Amber',   gradient: 'linear-gradient(135deg, #d97706, #fbbf24)' },
    { label: 'Sky',     gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
    { label: 'Violet',  gradient: 'linear-gradient(135deg, #7c3aed, #c4b5fd)' },
    { label: 'Green',   gradient: 'linear-gradient(135deg, #16a34a, #4ade80)' },
    { label: 'Gray',    gradient: 'linear-gradient(135deg, #6b7280, #9ca3af)' },
];

// ============================================================
// Default Notebook — ensure it always exists
// Called on entry to the #notes page before rendering.
// ============================================================

/**
 * Checks if a "Default" notebook exists for the current user.
 * If not, creates one silently with a neutral gray color.
 * Returns the Default notebook object { id, name, color, noteCount }.
 */
async function notesEnsureDefaultNotebook() {
    var snap = await userCol('notebooks')
        .where('name', '==', NOTES_DEFAULT_NOTEBOOK_NAME)
        .limit(1)
        .get();

    if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    // Not found — create it
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var ref = await userCol('notebooks').add({
        name:      NOTES_DEFAULT_NOTEBOOK_NAME,
        color:     'linear-gradient(135deg, #6b7280, #9ca3af)',
        noteCount: 0,
        createdAt: now,
        updatedAt: now
    });

    return {
        id:        ref.id,
        name:      NOTES_DEFAULT_NOTEBOOK_NAME,
        color:     'linear-gradient(135deg, #6b7280, #9ca3af)',
        noteCount: 0
    };
}

// ============================================================
// Notebooks — CRUD
// ============================================================

/**
 * Loads all notebooks for the current user, ordered by name.
 * @returns {Array} Array of { id, name, color, noteCount, createdAt, updatedAt }
 */
async function notesLoadNotebooks() {
    var snap = await userCol('notebooks').orderBy('name').get();
    return snap.docs.map(function(doc) {
        return { id: doc.id, ...doc.data() };
    });
}

/**
 * Creates a new notebook.
 * @param {string} name  - Notebook name (will be trimmed).
 * @param {string} color - CSS gradient string from NOTES_COLOR_SWATCHES.
 * @returns {string} The new notebook's Firestore document ID.
 */
async function notesAddNotebook(name, color) {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var ref = await userCol('notebooks').add({
        name:      name.trim(),
        color:     color,
        noteCount: 0,
        createdAt: now,
        updatedAt: now
    });
    return ref.id;
}

/**
 * Renames a notebook and/or changes its color.
 * @param {string} notebookId
 * @param {string} name  - New name.
 * @param {string} color - New color gradient.
 */
async function notesUpdateNotebook(notebookId, name, color) {
    await userCol('notebooks').doc(notebookId).update({
        name:      name.trim(),
        color:     color,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Deletes a notebook and ALL of its notes (and their photos).
 * The "Default" notebook cannot be deleted — this function returns early if attempted.
 * @param {string} notebookId
 * @param {string} notebookName - Used to guard against deleting Default.
 */
async function notesDeleteNotebook(notebookId, notebookName) {
    if (notebookName === NOTES_DEFAULT_NOTEBOOK_NAME) {
        console.warn('notesDeleteNotebook: the Default notebook cannot be deleted.');
        return;
    }

    // Delete every note (and its photos) in this notebook
    var snap = await userCol('notes').where('notebookId', '==', notebookId).get();
    await Promise.all(snap.docs.map(function(doc) {
        return _notesDeleteNoteAndPhotos(doc.id);
    }));

    // Delete the notebook document itself
    await userCol('notebooks').doc(notebookId).delete();
}

/**
 * Returns the number of notes in a notebook.
 * Used to show "This notebook contains X notes" in the delete warning.
 * @param {string} notebookId
 * @returns {number}
 */
async function notesGetNoteCount(notebookId) {
    var snap = await userCol('notes').where('notebookId', '==', notebookId).get();
    return snap.size;
}

// ============================================================
// Notes — CRUD
// ============================================================

/**
 * Loads all notes for a notebook, oldest first.
 * @param {string} notebookId
 * @returns {Array} Array of { id, notebookId, body, createdAt, updatedAt }
 */
async function notesLoadNotes(notebookId) {
    // No orderBy in the Firestore query — combining where() + orderBy() on different
    // fields requires a composite index. Sorting client-side avoids that requirement.
    var snap = await userCol('notes')
        .where('notebookId', '==', notebookId)
        .get();
    var notes = snap.docs.map(function(doc) {
        return { id: doc.id, ...doc.data() };
    });
    notes.sort(function(a, b) {
        var aMs = a.createdAt ? a.createdAt.toMillis() : 0;
        var bMs = b.createdAt ? b.createdAt.toMillis() : 0;
        return aMs - bMs;  // oldest first
    });
    return notes;
}

/**
 * Loads a single note by ID.
 * @param {string} noteId
 * @returns {Object|null}
 */
async function notesLoadNote(noteId) {
    var doc = await userCol('notes').doc(noteId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
}

/**
 * Adds a new note to a notebook.
 * Automatically increments noteCount and refreshes updatedAt on the notebook.
 * @param {string} notebookId
 * @param {string} body - The note text.
 * @returns {string} The new note's Firestore document ID.
 */
async function notesAddNote(notebookId, body) {
    var now = firebase.firestore.FieldValue.serverTimestamp();

    var ref = await userCol('notes').add({
        notebookId: notebookId,
        body:       body.trim(),
        createdAt:  now,
        updatedAt:  null
    });

    // Keep notebook metadata current
    await userCol('notebooks').doc(notebookId).update({
        noteCount: firebase.firestore.FieldValue.increment(1),
        updatedAt: now
    });

    return ref.id;
}

/**
 * Moves a note from one notebook to another.
 * Updates notebookId on the note document and adjusts noteCount on both notebooks.
 * @param {string} noteId
 * @param {string} oldNotebookId
 * @param {string} newNotebookId
 */
async function notesMoveNote(noteId, oldNotebookId, newNotebookId) {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    await userCol('notes').doc(noteId).update({ notebookId: newNotebookId, updatedAt: now });
    await userCol('notebooks').doc(oldNotebookId).update({
        noteCount: firebase.firestore.FieldValue.increment(-1),
        updatedAt: now
    });
    await userCol('notebooks').doc(newNotebookId).update({
        noteCount: firebase.firestore.FieldValue.increment(1),
        updatedAt: now
    });
}

/**
 * Updates the body of an existing note.
 * createdAt is never changed — only updatedAt is written.
 * @param {string} noteId
 * @param {string} notebookId - Needed to refresh updatedAt on the parent notebook.
 * @param {string} body       - The updated note text.
 */
async function notesUpdateNote(noteId, notebookId, body) {
    var now = firebase.firestore.FieldValue.serverTimestamp();

    await userCol('notes').doc(noteId).update({
        body:      body.trim(),
        updatedAt: now
    });

    await userCol('notebooks').doc(notebookId).update({
        updatedAt: now
    });
}

/**
 * Deletes a note and all its attached photos.
 * Decrements noteCount on the parent notebook.
 * @param {string} noteId
 * @param {string} notebookId
 */
async function notesDeleteNote(noteId, notebookId) {
    await _notesDeleteNoteAndPhotos(noteId);

    await userCol('notebooks').doc(notebookId).update({
        noteCount: firebase.firestore.FieldValue.increment(-1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Internal helper: deletes a note document and all its photo records from Firestore.
 * Does NOT touch the parent notebook's noteCount — callers are responsible for that.
 * @param {string} noteId
 */
async function _notesDeleteNoteAndPhotos(noteId) {
    // Remove all photos attached to this note
    var photosSnap = await userCol('photos')
        .where('targetType', '==', 'note')
        .where('targetId',   '==', noteId)
        .get();
    await Promise.all(photosSnap.docs.map(function(doc) {
        return doc.ref.delete();
    }));

    // Remove the note document
    await userCol('notes').doc(noteId).delete();
}

// ============================================================
// Search — client-side filtering
// Firestore has no native full-text search, so we load notes
// into memory and filter there. Fine at personal-use scale.
// ============================================================

/**
 * Loads ALL notes across ALL notebooks for the current user.
 * Used by the global search bar on the #notes page.
 * Enriches each note with a `notebookName` field for display.
 *
 * @param {Array} notebooks - Already-loaded notebooks list (avoids a second query).
 * @returns {Array} All notes, each with a `notebookName` property added.
 */
async function notesLoadAllNotes(notebooks) {
    var snap = await userCol('notes').orderBy('createdAt', 'asc').get();

    // Build a quick id→name lookup from the already-loaded notebooks
    var nameMap = {};
    notebooks.forEach(function(nb) { nameMap[nb.id] = nb.name; });

    return snap.docs.map(function(doc) {
        var data = doc.data();
        return { id: doc.id, ...data, notebookName: nameMap[data.notebookId] || 'Unknown' };
    });
}

/**
 * Filters a notes array by a search query (case-insensitive, body text only).
 * Works for both global search and notebook-level search.
 * Returns all notes if query is blank.
 *
 * @param {Array}  notes - Array of note objects (each with a `body` field).
 * @param {string} query - The search string typed by the user.
 * @returns {Array} Filtered notes.
 */
function notesFilterNotes(notes, query) {
    if (!query || !query.trim()) return notes;
    var q = query.trim().toLowerCase();
    return notes.filter(function(note) {
        return note.body && note.body.toLowerCase().includes(q);
    });
}

// ============================================================
// Formatting Helpers
// ============================================================

/**
 * Formats a Firestore Timestamp (or JS Date) as "March 30, 2026 · 2:14 PM".
 * Used on note cards and the note detail page.
 * @param {firebase.firestore.Timestamp|Date} ts
 * @returns {string}
 */
function notesFormatTimestamp(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : ts;
    var date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    var time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return date + ' \u00b7 ' + time;
}

/**
 * Truncates note body text for preview cards.
 * Appends an ellipsis if the text was cut.
 * @param {string} text
 * @param {number} maxLength - Defaults to 200 characters.
 * @returns {string}
 */
function notesTruncateBody(text, maxLength) {
    maxLength = maxLength || 200;
    if (!text || text.length <= maxLength) return text || '';
    return text.slice(0, maxLength).trimEnd() + '\u2026';
}

// ============================================================
// SecondBrain — ADD_NOTE write handler
// Called from secondbrain.js _sbWrite() after the user confirms.
// ============================================================

/**
 * Executes a confirmed ADD_NOTE action from SecondBrain.
 * Looks up the target notebook by name; falls back to "Default" if not found.
 *
 * @param {Object} parsed - The confirmed action object from SecondBrain.
 *   Expected fields: { action, notebook, notebookRequested, note }
 */
async function notesHandleSBAddNote(parsed) {
    // Guarantee Default exists before we try to fall back to it
    await notesEnsureDefaultNotebook();

    var allNotebooks = await notesLoadNotebooks();

    // Try to match the resolved notebook name (case-insensitive)
    var target = allNotebooks.find(function(nb) {
        return nb.name.toLowerCase() === (parsed.notebook || '').toLowerCase();
    });

    // Fall back to Default
    if (!target) {
        target = allNotebooks.find(function(nb) {
            return nb.name === NOTES_DEFAULT_NOTEBOOK_NAME;
        });
    }

    if (!target) {
        console.error('notesHandleSBAddNote: could not resolve a target notebook.');
        return;
    }

    await notesAddNote(target.id, parsed.note || '');
}

// ============================================================
// Module-level state
// ============================================================

/** Notebook being edited in the modal — null means Add mode. */
var _notesEditingNotebook = null;

/** Guard to prevent double-wiring of modal button listeners. */
var _notesModalWired = false;

/** Guard to prevent double-wiring of the textarea tab handler. */
var _notesTabWired = false;

// ============================================================
// Page Loader: #notes — Notebooks list
// ============================================================

/**
 * Entry point called by app.js when navigating to #notes.
 * Ensures the Default notebook exists, renders tiles, wires controls.
 */
/**
 * Navigates directly to the "Dev Notes" notebook, creating it if needed.
 * Called from the Settings page Dev Notes button.
 */
async function openDevNotesNotebook() {
    var snap = await userCol('notebooks').where('name', '==', 'Dev Notes').limit(1).get();
    var id;
    if (!snap.empty) {
        id = snap.docs[0].id;
    } else {
        var now = firebase.firestore.FieldValue.serverTimestamp();
        var ref = await userCol('notebooks').add({
            name: 'Dev Notes',
            noteCount: 0,
            createdAt: now,
            updatedAt: now
        });
        id = ref.id;
    }
    window.location.hash = '#notebook/' + id;
}

async function loadNotesPage() {
    // Set breadcrumb in sticky header
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML = '<a href="#life">Life</a><span class="separator">&rsaquo;</span><span>Notebooks</span>';

    // Always guarantee Default exists before rendering
    await notesEnsureDefaultNotebook();

    // Clear any previous global search
    var searchInput = document.getElementById('notesGlobalSearchInput');
    if (searchInput) searchInput.value = '';
    var resultsEl = document.getElementById('notesSearchResults');
    if (resultsEl) resultsEl.classList.add('hidden');

    await _notesRenderNotebookGrid();
    _notesWireNotebooksPage();
}

/**
 * Renders all notebook tiles into #notebookGrid.
 * Called on initial load and after add/edit/delete.
 */
async function _notesRenderNotebookGrid() {
    var grid  = document.getElementById('notebookGrid');
    var empty = document.getElementById('notebookGridEmpty');
    if (!grid) return;

    grid.innerHTML = '';

    var notebooks      = await notesLoadNotebooks();
    var defaultNbId    = await _notesGetDefaultNotebookId();

    if (notebooks.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    notebooks.forEach(function(nb) {
        var tile = document.createElement('div');
        tile.className = 'notebook-tile';
        tile.style.background = nb.color || 'linear-gradient(135deg, #6b7280, #9ca3af)';

        var count    = nb.noteCount || 0;
        var countStr = count + (count === 1 ? ' note' : ' notes');
        var starHtml = (nb.id === defaultNbId) ? '<span class="notebook-tile-star">⭐</span>' : '';

        tile.innerHTML =
            '<span class="notebook-tile-name">' + starHtml + escapeHtml(nb.name) + '</span>' +
            '<span class="notebook-tile-meta">' + escapeHtml(countStr) + '</span>';

        tile.onclick = function() { window.location.hash = '#notebook/' + nb.id; };
        grid.appendChild(tile);
    });
}

/**
 * Wires the Add Notebook button and global search input on #page-notes.
 * Safe to call multiple times — uses a guard for the modal buttons.
 */
function _notesWireNotebooksPage() {
    var addBtn = document.getElementById('addNotebookBtn');
    if (addBtn) addBtn.onclick = function() { _notesOpenNotebookModal(null); };

    // Global search input wired — search logic implemented in N-7
    var searchInput = document.getElementById('notesGlobalSearchInput');
    if (searchInput) searchInput.oninput = _notesHandleGlobalSearch;

    _notesWireModalButtons();
}

// ============================================================
// Page Loader: #notebook/{id} — Notebook detail
// ============================================================

/**
 * Entry point called by app.js when navigating to #notebook/{id}.
 * Loads the notebook, sets global state, renders header and wires controls.
 * Note card rendering is implemented in N-5.
 */
async function loadNotebookPage(notebookId) {
    var doc = await userCol('notebooks').doc(notebookId).get();
    if (!doc.exists) {
        // Notebook was deleted — go back to the list
        window.location.hash = '#notes';
        return;
    }

    var notebook = { id: doc.id, ...doc.data() };
    window.currentNotebook = notebook;

    // Update header name
    var nameEl = document.getElementById('notebookDetailName');
    if (nameEl) nameEl.textContent = notebook.name;

    // Breadcrumb: Notes › Notebook Name
    var bar = document.getElementById('breadcrumbBar');
    if (bar) {
        bar.innerHTML =
            '<a href="#life" class="breadcrumb-link">Life</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<a href="#notes" class="breadcrumb-link">Notes</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<span class="breadcrumb-current">' + (notebook.name || 'Notebook') + '</span>';
    }

    // Clear search
    var searchInput = document.getElementById('notebookSearchInput');
    if (searchInput) searchInput.value = '';

    _notesWireNotebookDetailPage(notebook);
    _notesWireModalButtons();

    // Render note cards for this notebook
    await _notesRenderNoteList(notebookId);
}

/**
 * Wires all interactive controls on the notebook detail page.
 * @param {Object} notebook - The current notebook object.
 */
function _notesWireNotebookDetailPage(notebook) {
    var backBtn = document.getElementById('notebookBackBtn');
    if (backBtn) backBtn.onclick = function() { window.location.hash = '#notes'; };

    var exportBtn = document.getElementById('exportNotebookBtn');
    if (exportBtn) exportBtn.onclick = function() { notesExportNotebook(notebook); };

    var editBtn = document.getElementById('editNotebookBtn');
    if (editBtn) editBtn.onclick = function() { _notesOpenNotebookModal(notebook); };

    var addNoteBtn = document.getElementById('addNoteBtn');
    if (addNoteBtn) {
        addNoteBtn.onclick = function() {
            window.location.hash = '#note/new';
        };
    }

    // Search input
    var searchInput = document.getElementById('notebookSearchInput');
    if (searchInput) searchInput.oninput = _notesHandleNotebookSearch;

    // Default notebook toggle
    _notesWireDefaultToggle(notebook.id);
}

/**
 * Reads the current default notebook ID from settings, sets the checkbox state,
 * and wires the toggle to save/clear the default.
 */
async function _notesWireDefaultToggle(notebookId) {
    var chk  = document.getElementById('notebookDefaultChk');
    var star = document.getElementById('notebookDefaultStar');
    if (!chk) return;

    // Read current default
    var currentDefault = await _notesGetDefaultNotebookId();
    var isDefault = currentDefault === notebookId;
    chk.checked = isDefault;
    if (star) star.textContent = isDefault ? '⭐ ' : '';

    chk.onchange = async function() {
        if (chk.checked) {
            await userCol('settings').doc('main').set(
                { defaultNotebookId: notebookId },
                { merge: true }
            );
            if (star) star.textContent = '⭐ ';
        } else {
            // Only clear if this notebook IS currently the default
            var cur = await _notesGetDefaultNotebookId();
            if (cur === notebookId) {
                await userCol('settings').doc('main').update(
                    { defaultNotebookId: firebase.firestore.FieldValue.delete() }
                );
            }
            if (star) star.textContent = '';
        }
    };
}

/**
 * Returns the user's configured default notebook ID, or null if not set.
 */
async function _notesGetDefaultNotebookId() {
    try {
        var doc = await userCol('settings').doc('main').get();
        return (doc.exists && doc.data().defaultNotebookId) || null;
    } catch (err) {
        return null;
    }
}

// ============================================================
// Add / Edit Notebook Modal
// ============================================================

/**
 * Opens the notebook modal in Add or Edit mode.
 * @param {Object|null} notebook - Pass an existing notebook to edit, null to add.
 */
function _notesOpenNotebookModal(notebook) {
    _notesEditingNotebook = notebook;

    var titleEl     = document.getElementById('notebookModalTitle');
    var nameInput   = document.getElementById('notebookNameInput');
    var colorInput  = document.getElementById('notebookColorValue');

    if (titleEl)   titleEl.textContent = notebook ? 'Edit Notebook' : 'Add Notebook';
    if (nameInput) nameInput.value     = notebook ? notebook.name : '';

    // Pre-select the current color (or first swatch for new notebooks)
    var selectedColor = (notebook && notebook.color) ? notebook.color : NOTES_COLOR_SWATCHES[0].gradient;
    if (colorInput) colorInput.value = selectedColor;
    _notesRenderColorSwatches(selectedColor);

    // Show "Delete Notebook" only in edit mode, and never for the Default notebook
    var deleteBtn = document.getElementById('notebookModalDeleteBtn');
    if (deleteBtn) {
        var isEditing = !!notebook;
        var isDefault = notebook && notebook.name === NOTES_DEFAULT_NOTEBOOK_NAME;
        deleteBtn.style.display = (isEditing && !isDefault) ? '' : 'none';
        deleteBtn.onclick = function() {
            closeModal('notebookModal');
            setTimeout(function() { _notesConfirmDeleteNotebook(notebook); }, 50);
        };
    }

    openModal('notebookModal');
    if (nameInput) nameInput.focus();
}

/**
 * Renders the color swatch circles in the modal.
 * Marks the currently-selected swatch with the `selected` class.
 * @param {string} selectedGradient - The gradient string to pre-select.
 */
function _notesRenderColorSwatches(selectedGradient) {
    var container = document.getElementById('notebookColorSwatches');
    if (!container) return;
    container.innerHTML = '';

    NOTES_COLOR_SWATCHES.forEach(function(swatch) {
        var el = document.createElement('div');
        el.className = 'notes-color-swatch' + (swatch.gradient === selectedGradient ? ' selected' : '');
        el.style.background = swatch.gradient;
        el.title = swatch.label;
        el.onclick = function() {
            container.querySelectorAll('.notes-color-swatch').forEach(function(s) {
                s.classList.remove('selected');
            });
            el.classList.add('selected');
            document.getElementById('notebookColorValue').value = swatch.gradient;
        };
        container.appendChild(el);
    });
}

/**
 * Wires the Save and Cancel buttons on the notebook modal.
 * Uses a guard flag so listeners are only attached once.
 */
function _notesWireModalButtons() {
    if (_notesModalWired) return;
    _notesModalWired = true;

    var saveBtn   = document.getElementById('notebookModalSaveBtn');
    var cancelBtn = document.getElementById('notebookModalCancelBtn');
    var nameInput = document.getElementById('notebookNameInput');

    if (saveBtn)   saveBtn.onclick   = _notesSaveNotebook;
    if (cancelBtn) cancelBtn.onclick = function() { closeModal('notebookModal'); };

    // Allow Enter key to save
    if (nameInput) {
        nameInput.onkeydown = function(e) {
            if (e.key === 'Enter') _notesSaveNotebook();
        };
    }
}

/**
 * Saves the notebook (add or edit) when the modal Save button is clicked.
 */
async function _notesSaveNotebook() {
    var name  = (document.getElementById('notebookNameInput').value || '').trim();
    var color = document.getElementById('notebookColorValue').value;

    if (!name) {
        alert('Please enter a notebook name.');
        return;
    }
    if (!color) {
        color = NOTES_COLOR_SWATCHES[0].gradient;
    }

    try {
        if (_notesEditingNotebook) {
            await notesUpdateNotebook(_notesEditingNotebook.id, name, color);
            closeModal('notebookModal');

            // If we're on the detail page for this notebook, refresh its header
            if (window.currentNotebook && window.currentNotebook.id === _notesEditingNotebook.id) {
                window.currentNotebook.name  = name;
                window.currentNotebook.color = color;
                var nameEl = document.getElementById('notebookDetailName');
                if (nameEl) nameEl.textContent = name;
            } else {
                await _notesRenderNotebookGrid();
            }
        } else {
            await notesAddNotebook(name, color);
            closeModal('notebookModal');
            await _notesRenderNotebookGrid();
        }
    } catch (e) {
        console.error('_notesSaveNotebook error:', e);
        alert('Error saving notebook. Please try again.');
    }
}

// ============================================================
// Delete Notebook
// ============================================================

/**
 * Shows a confirmation dialog before deleting a notebook.
 * Warns about note count; blocks deletion of the Default notebook.
 * @param {Object} notebook - The notebook to delete.
 */
async function _notesConfirmDeleteNotebook(notebook) {
    if (notebook.name === NOTES_DEFAULT_NOTEBOOK_NAME) return; // Guarded in UI too

    var count = await notesGetNoteCount(notebook.id);
    var msg = count > 0
        ? 'This notebook contains ' + count + (count === 1 ? ' note' : ' notes') +
          '. Deleting it will permanently remove all notes and photos. Continue?'
        : 'Delete "' + notebook.name + '"? This cannot be undone.';

    if (!confirm(msg)) return;

    try {
        await notesDeleteNotebook(notebook.id, notebook.name);
        window.location.hash = '#notes';
    } catch (e) {
        console.error('_notesConfirmDeleteNotebook error:', e);
        alert('Error deleting notebook. Please try again.');
    }
}

// ============================================================
// Note Cards — render list on #page-notebook
// ============================================================

/**
 * Loads and renders all note cards for a notebook, oldest first.
 * Called from loadNotebookPage and after add/delete operations.
 * @param {string} notebookId
 */
async function _notesRenderNoteList(notebookId) {
    var listEl  = document.getElementById('notesList');
    var emptyEl = document.getElementById('notesListEmpty');
    if (!listEl) return;

    listEl.innerHTML = '';

    var notes = await notesLoadNotes(notebookId);

    if (notes.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    notes.forEach(function(note) {
        listEl.appendChild(_notesBuildNoteCard(note));
    });

    // Load thumbnails for all rendered cards in one batch query
    var noteIds = notes.map(function(n) { return n.id; });
    _notesLoadNoteThumbnails(noteIds);
}

/**
 * Builds a single note card DOM element.
 * @param {Object} note - Note object with id, body, createdAt fields.
 * @returns {HTMLElement}
 */
function _notesBuildNoteCard(note) {
    var card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.id = note.id;

    var timestamp = notesFormatTimestamp(note.createdAt);
    var bodyText  = note.body || '';
    var truncated = bodyText.length > 200;
    var preview   = notesTruncateBody(bodyText, 200);

    card.innerHTML =
        '<div class="note-card-header">' +
            '<span class="note-card-timestamp">' + escapeHtml(timestamp) + '</span>' +
            '<div class="note-card-actions">' +
                '<button class="btn btn-icon btn-small" data-action="edit" data-id="' + note.id + '" title="Edit">✏️</button>' +
                '<button class="btn btn-icon btn-small" data-action="delete" data-id="' + note.id + '" title="Delete">🗑️</button>' +
            '</div>' +
        '</div>' +
        '<div class="note-card-body">' + escapeHtml(preview) + '</div>' +
        (truncated
            ? '<div class="note-card-read-more"><a href="#note/' + note.id + '">Read more</a></div>'
            : '') +
        '<div class="note-card-thumbs" data-note-id="' + note.id + '"></div>';

    // Wire edit button → navigate to note page in edit mode
    card.querySelector('[data-action="edit"]').onclick = function(e) {
        e.stopPropagation();
        window.currentNote = note;
        window.location.hash = '#note/' + note.id;
        // After navigation, _notesEnterEditMode() will be called
        // We set a flag so loadNotePage knows to open in edit mode
        window._noteOpenInEditMode = true;
    };

    // Wire delete button
    card.querySelector('[data-action="delete"]').onclick = function(e) {
        e.stopPropagation();
        _notesConfirmDeleteNote(note);
    };

    // Clicking the card body navigates to the full note page (view mode)
    card.onclick = function() {
        window.currentNote = note;
        window._noteOpenInEditMode = false;
        window.location.hash = '#note/' + note.id;
    };

    return card;
}

// ============================================================
// Note Delete (from card)
// ============================================================

/**
 * Confirms and deletes a note from the notebook detail page.
 * @param {Object} note
 */
async function _notesConfirmDeleteNote(note) {
    if (!confirm('Delete this note? This cannot be undone.')) return;

    var notebookId = window.currentNotebook ? window.currentNotebook.id : note.notebookId;
    try {
        await notesDeleteNote(note.id, notebookId);
        // Remove the card from the DOM immediately
        var card = document.querySelector('.note-card[data-id="' + note.id + '"]');
        if (card) card.remove();
        // Show empty state if no cards remain
        var listEl = document.getElementById('notesList');
        if (listEl && listEl.children.length === 0) {
            var emptyEl = document.getElementById('notesListEmpty');
            if (emptyEl) emptyEl.classList.remove('hidden');
        }
        // Update the notebook tile count on a return trip (update in memory)
        if (window.currentNotebook) {
            window.currentNotebook.noteCount = Math.max(0, (window.currentNotebook.noteCount || 1) - 1);
        }
    } catch (e) {
        console.error('_notesConfirmDeleteNote error:', e);
        alert('Error deleting note. Please try again.');
    }
}

// ============================================================
// Page Loader: #note/{id} — Note view/edit page
// ============================================================

/**
 * Entry point called by app.js when navigating to #note/{id}.
 * Loads the note, sets global state, shows view mode by default.
 * If window._noteOpenInEditMode is true (set by Edit button on card),
 * switches directly to edit mode after loading.
 */
async function loadNotePage(noteId) {
    var note = await notesLoadNote(noteId);
    if (!note) {
        // Note no longer exists — go back
        var backHash = window.currentNotebook ? '#notebook/' + window.currentNotebook.id : '#notes';
        window.location.hash = backHash;
        return;
    }

    window.currentNote = note;

    // Ensure currentNotebook is set (handles direct URL navigation)
    if (!window.currentNotebook || window.currentNotebook.id !== note.notebookId) {
        var nbDoc = await userCol('notebooks').doc(note.notebookId).get();
        window.currentNotebook = nbDoc.exists ? { id: nbDoc.id, ...nbDoc.data() } : null;
    }

    // Breadcrumb: Notes › Notebook Name › Note
    var bar = document.getElementById('breadcrumbBar');
    if (bar) {
        var nbName = (window.currentNotebook && window.currentNotebook.name) || 'Notebook';
        var nbHash = (window.currentNotebook) ? '#notebook/' + window.currentNotebook.id : '#notes';
        bar.innerHTML =
            '<a href="#life" class="breadcrumb-link">Life</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<a href="#notes" class="breadcrumb-link">Notes</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<a href="' + nbHash + '" class="breadcrumb-link">' + nbName + '</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<span class="breadcrumb-current">Note</span>';
    }

    // Populate view mode
    var timestampEl = document.getElementById('noteViewTimestamp');
    var bodyEl      = document.getElementById('noteViewBody');
    if (timestampEl) timestampEl.textContent = notesFormatTimestamp(note.createdAt);
    if (bodyEl)      bodyEl.textContent      = note.body || '';

    // Show view mode, hide edit mode and Add Photo section
    _notesShowViewMode();

    // Wire note page buttons
    _notesWireNotePage(note);

    // If navigated here via the Edit button on a card, jump straight to edit mode
    if (window._noteOpenInEditMode) {
        window._noteOpenInEditMode = false;
        _notesEnterEditMode();
    }

    // Load photos attached to this note
    loadPhotos('note', noteId, 'notePhotoContainer', 'notePhotoEmptyState');
}

/**
 * Entry point called by app.js when navigating to #note/new.
 * Shows a blank edit mode for writing a new note.
 */
function loadNewNotePage() {
    window.currentNote = null;

    // Push an extra history entry so the hardware back button hits this dummy
    // entry first. The popstate listener in _notesWireNotePageNew() will catch
    // it and run the dirty check before allowing navigation away.
    history.pushState({ noteNew: true }, '');

    // Breadcrumb: Notes › Notebook Name › New Note
    var bar = document.getElementById('breadcrumbBar');
    if (bar) {
        var nbName = (window.currentNotebook && window.currentNotebook.name) || 'Notebook';
        var nbHash = (window.currentNotebook) ? '#notebook/' + window.currentNotebook.id : '#notes';
        bar.innerHTML =
            '<a href="#life" class="breadcrumb-link">Life</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<a href="#notes" class="breadcrumb-link">Notes</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<a href="' + nbHash + '" class="breadcrumb-link">' + nbName + '</a>' +
            '<span class="breadcrumb-sep"> › </span>' +
            '<span class="breadcrumb-current">New Note</span>';
    }

    // Clear the textarea
    var textarea = document.getElementById('noteBodyInput');
    if (textarea) {
        textarea.value = '';
    }

    // Show edit mode, hide view mode
    _notesShowEditMode('New Note');

    // Wire save/cancel for a new note
    _notesWireNotePageNew();

    // Hide photo section — can't attach photos until the note has been saved
    var addPhotoSection = document.getElementById('noteAddPhotoSection');
    if (addPhotoSection) addPhotoSection.classList.add('hidden');
    var photoEmpty = document.getElementById('notePhotoEmptyState');
    if (photoEmpty) photoEmpty.classList.add('hidden');
    var photoContainer = document.getElementById('notePhotoContainer');
    if (photoContainer) photoContainer.innerHTML = '';

    // Hide move section — no existing notebook to move from on a new note
    var moveSection = document.getElementById('noteMoveSection');
    if (moveSection) moveSection.classList.add('hidden');
}

// ============================================================
// Note Page — view/edit mode switching
// ============================================================

/** Switches #page-note to view mode. */
function _notesShowViewMode() {
    var viewEl = document.getElementById('noteViewMode');
    var editEl = document.getElementById('noteEditMode');
    var addPhotoSection = document.getElementById('noteAddPhotoSection');
    var moveSection     = document.getElementById('noteMoveSection');
    if (viewEl) viewEl.classList.remove('hidden');
    if (editEl) editEl.classList.add('hidden');
    if (addPhotoSection) addPhotoSection.classList.add('hidden');
    if (moveSection) moveSection.classList.add('hidden');
}

/**
 * Switches #page-note to edit mode.
 * @param {string} title - Text for the noteEditTitle heading.
 */
function _notesShowEditMode(title) {
    var viewEl = document.getElementById('noteViewMode');
    var editEl = document.getElementById('noteEditMode');
    var titleEl = document.getElementById('noteEditTitle');
    var addPhotoSection = document.getElementById('noteAddPhotoSection');
    if (viewEl) viewEl.classList.add('hidden');
    if (editEl) editEl.classList.remove('hidden');
    if (titleEl) titleEl.textContent = title || 'Edit Note';
    if (addPhotoSection) addPhotoSection.classList.remove('hidden');

    // Initialize voice-to-text each time edit mode is shown
    if (typeof initVoiceToText === 'function') {
        initVoiceToText('noteBodyInput', 'noteSpeakBtn');
    }

    // Wire Tab key to insert a real tab character instead of moving focus (once only)
    if (!_notesTabWired) {
        _notesTabWired = true;
        var ta = document.getElementById('noteBodyInput');
        if (ta) {
            ta.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    var start = ta.selectionStart;
                    var end   = ta.selectionEnd;
                    ta.value  = ta.value.substring(0, start) + '\t' + ta.value.substring(end);
                    ta.selectionStart = ta.selectionEnd = start + 1;
                }
            });
        }
    }
}

/**
 * Populates the Move-to-Notebook dropdown with all notebooks except the current one.
 * Shows the row; hides it if there are no other notebooks to move to.
 * @param {string} currentNotebookId
 */
async function _notesPopulateMoveDropdown(currentNotebookId) {
    var sel     = document.getElementById('noteMoveSelect');
    var section = document.getElementById('noteMoveSection');
    if (!sel || !section) return;

    sel.innerHTML = '<option value="">— keep in current notebook —</option>';
    var notebooks = await notesLoadNotebooks();
    var others = notebooks.filter(function(nb) { return nb.id !== currentNotebookId; });

    if (others.length === 0) {
        section.classList.add('hidden');
        return;
    }

    others.forEach(function(nb) {
        var opt = document.createElement('option');
        opt.value       = nb.id;
        opt.textContent = nb.name;
        sel.appendChild(opt);
    });
    section.classList.remove('hidden');
}

/** Switches an existing note to edit mode, pre-fills the textarea, and populates the move dropdown. */
function _notesEnterEditMode() {
    var textarea = document.getElementById('noteBodyInput');
    if (textarea && window.currentNote) {
        textarea.value = window.currentNote.body || '';
    }
    _notesShowEditMode('Edit Note');
    var nbId = window.currentNotebook ? window.currentNotebook.id
             : (window.currentNote ? window.currentNote.notebookId : null);
    if (nbId) _notesPopulateMoveDropdown(nbId);
}

// ============================================================
// Note Page — button wiring
// ============================================================

/**
 * Wires all buttons on the note page for an existing note (view mode).
 * @param {Object} note
 */
function _notesWireNotePage(note) {
    var backBtn    = document.getElementById('noteBackBtn');
    var editBtn    = document.getElementById('noteEditBtn');
    var deleteBtn  = document.getElementById('noteDeleteBtn');
    var cancelBtn  = document.getElementById('noteCancelEditBtn');
    var saveBtn    = document.getElementById('noteSaveBtn');

    if (backBtn) backBtn.onclick = function() {
        var hash = window.currentNotebook ? '#notebook/' + window.currentNotebook.id : '#notes';
        window.location.hash = hash;
    };

    if (editBtn) editBtn.onclick = _notesEnterEditMode;

    if (deleteBtn) deleteBtn.onclick = function() { _notesConfirmDeleteNoteFromPage(note); };

    if (cancelBtn) cancelBtn.onclick = function() {
        var textarea = document.getElementById('noteBodyInput');
        var currentText = textarea ? textarea.value : '';
        var savedText   = window.currentNote ? (window.currentNote.body || '') : '';
        if (currentText !== savedText) {
            if (!confirm('Discard unsaved changes?')) return;
            // Copy the unsaved text to clipboard as a safety measure
            if (currentText.trim() && navigator.clipboard) {
                navigator.clipboard.writeText(currentText).catch(function() {});
            }
        }
        _notesShowViewMode();
    };

    if (saveBtn) saveBtn.onclick = function() { _notesSaveExistingNote(note); };

    var cameraBtn  = document.getElementById('noteCameraBtn');
    var galleryBtn = document.getElementById('noteGalleryBtn');
    if (cameraBtn)  cameraBtn.onclick  = function() { if (window.currentNote) triggerCameraUpload('note', window.currentNote.id); };
    if (galleryBtn) galleryBtn.onclick = function() { if (window.currentNote) triggerGalleryUpload('note', window.currentNote.id); };
}

/**
 * Wires Save, Cancel, and Back for a new note (#note/new).
 * Also installs a popstate guard so the hardware back button runs the same
 * dirty-check as Cancel before navigating away.
 */
function _notesWireNotePageNew() {
    var cancelBtn = document.getElementById('noteCancelEditBtn');
    var saveBtn   = document.getElementById('noteSaveBtn');
    var backBtn   = document.getElementById('noteBackBtn');

    // --- Dirty-check helpers ---

    function _getTypedText() {
        var textarea = document.getElementById('noteBodyInput');
        return textarea ? textarea.value.trim() : '';
    }

    function _copyToClipboard(text) {
        if (text && navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(function() {});
        }
    }

    function _navigateToNotebook() {
        var hash = window.currentNotebook ? '#notebook/' + window.currentNotebook.id : '#notes';
        window.location.hash = hash;
    }

    // --- Popstate guard (hardware back button) ---

    var _popStateHandler = null;

    function _removeDirtyBackGuard() {
        if (_popStateHandler) {
            window.removeEventListener('popstate', _popStateHandler);
            _popStateHandler = null;
        }
    }

    _popStateHandler = function() {
        var text = _getTypedText();
        if (!text) {
            // Nothing typed — clean up and let navigation proceed naturally
            _removeDirtyBackGuard();
            return;
        }
        // Re-push the dummy entry so we appear to stay on the page while prompting
        history.pushState({ noteNew: true }, '');
        if (!confirm('Discard this note?')) return; // User cancelled — state already restored
        // User confirmed discard
        _copyToClipboard(text);
        if (typeof window._stopVoiceToText === 'function') window._stopVoiceToText();
        _removeDirtyBackGuard();
        _navigateToNotebook();
    };
    window.addEventListener('popstate', _popStateHandler);

    // --- Cancel button ---

    if (cancelBtn) cancelBtn.onclick = function() {
        var text = _getTypedText();
        if (text) {
            if (!confirm('Discard this note?')) return;
            _copyToClipboard(text);
        }
        if (typeof window._stopVoiceToText === 'function') window._stopVoiceToText();
        _removeDirtyBackGuard();
        _navigateToNotebook();
    };

    // --- Save button ---

    if (saveBtn) saveBtn.onclick = function() {
        _removeDirtyBackGuard();
        _notesSaveNewNote();
    };

    // --- On-screen Back button (shown in edit mode) ---
    // Also runs the dirty check so it behaves consistently with Cancel and hardware back.

    if (backBtn) backBtn.onclick = function() {
        var text = _getTypedText();
        if (text) {
            if (!confirm('Discard this note?')) return;
            _copyToClipboard(text);
        }
        if (typeof window._stopVoiceToText === 'function') window._stopVoiceToText();
        _removeDirtyBackGuard();
        _navigateToNotebook();
    };
}

// ============================================================
// Note Save / Delete (from note page)
// ============================================================

/**
 * Saves a brand-new note and navigates to its detail page.
 */
async function _notesSaveNewNote() {
    // Stop any active voice recognition and give it a moment to append final results
    if (typeof window._stopVoiceToText === 'function') {
        window._stopVoiceToText();
        await new Promise(function(resolve) { setTimeout(resolve, 250); });
    }

    var body = (document.getElementById('noteBodyInput').value || '').trim();
    if (!body) {
        alert('Please write something before saving.');
        return;
    }
    if (!window.currentNotebook) {
        alert('No notebook selected. Please navigate from a notebook.');
        return;
    }

    try {
        var newId = await notesAddNote(window.currentNotebook.id, body);
        // Navigate back to the notebook after saving
        window.location.hash = '#notebook/' + window.currentNotebook.id;
    } catch (e) {
        console.error('_notesSaveNewNote error:', e);
        alert('Error saving note. Please try again.');
    }
}

/**
 * Saves edits to an existing note and returns to view mode.
 * @param {Object} note - The original note object.
 */
async function _notesSaveExistingNote(note) {
    // Stop any active voice recognition and give it a moment to append final results
    if (typeof window._stopVoiceToText === 'function') {
        window._stopVoiceToText();
        await new Promise(function(resolve) { setTimeout(resolve, 250); });
    }

    var body = (document.getElementById('noteBodyInput').value || '').trim();
    if (!body) {
        alert('Note cannot be empty.');
        return;
    }

    var notebookId = window.currentNotebook ? window.currentNotebook.id : note.notebookId;

    // Check if the user wants to move to a different notebook
    var moveSel    = document.getElementById('noteMoveSelect');
    var moveToId   = moveSel ? moveSel.value : '';

    try {
        await notesUpdateNote(note.id, notebookId, body);

        if (moveToId && moveToId !== notebookId) {
            await notesMoveNote(note.id, notebookId, moveToId);
            // Navigate to the destination notebook so the user sees the note there
            window.location.hash = '#notebook/' + moveToId;
            return;
        }

        // No move — return to the current notebook
        var hash = window.currentNotebook ? '#notebook/' + window.currentNotebook.id : '#notes';
        window.location.hash = hash;
    } catch (e) {
        console.error('_notesSaveExistingNote error:', e);
        alert('Error saving note. Please try again.');
    }
}

/**
 * Confirms and deletes the current note from the note detail page,
 * then navigates back to the notebook.
 * @param {Object} note
 */
async function _notesConfirmDeleteNoteFromPage(note) {
    if (!confirm('Delete this note? This cannot be undone.')) return;

    var notebookId = window.currentNotebook ? window.currentNotebook.id : note.notebookId;
    try {
        await notesDeleteNote(note.id, notebookId);
        var backHash = window.currentNotebook ? '#notebook/' + window.currentNotebook.id : '#notes';
        window.location.hash = backHash;
    } catch (e) {
        console.error('_notesConfirmDeleteNoteFromPage error:', e);
        alert('Error deleting note. Please try again.');
    }
}

// ============================================================
// Note Thumbnails — photo strips on note cards
// ============================================================

/**
 * Loads all photos with targetType 'note' whose targetId is in the given
 * noteIds array, then injects thumbnail images into each card's thumb strip.
 *
 * We fetch all note photos in one query and group client-side to avoid
 * issuing one query per card.
 *
 * @param {Array<string>} noteIds - The IDs of the visible note cards.
 */
async function _notesLoadNoteThumbnails(noteIds) {
    if (!noteIds || noteIds.length === 0) return;

    var snap = await userCol('photos')
        .where('targetType', '==', 'note')
        .get();

    // Group photos by targetId
    var photosByNote = {};
    snap.docs.forEach(function(doc) {
        var data = doc.data();
        var tid  = data.targetId;
        if (!photosByNote[tid]) photosByNote[tid] = [];
        photosByNote[tid].push({ id: doc.id, ...data });
    });

    // Inject thumbnails into each card that has photos
    noteIds.forEach(function(noteId) {
        var photos = photosByNote[noteId];
        if (!photos || photos.length === 0) return;

        var thumbsEl = document.querySelector('.note-card-thumbs[data-note-id="' + noteId + '"]');
        if (!thumbsEl) return;

        // Sort newest first, show up to 4 thumbs
        photos.sort(function(a, b) {
            var aMs = a.createdAt ? a.createdAt.toMillis() : 0;
            var bMs = b.createdAt ? b.createdAt.toMillis() : 0;
            return bMs - aMs;
        });
        var visible = photos.slice(0, 4);

        visible.forEach(function(photo) {
            var img = document.createElement('img');
            img.className = 'note-card-thumb';
            img.src   = photo.imageData;
            img.alt   = photo.caption || '';
            img.title = photo.caption || '';
            img.onclick = function(e) {
                e.stopPropagation();
                window.location.hash = '#note/' + noteId;
            };
            thumbsEl.appendChild(img);
        });
    });
}

// ============================================================
// Export Notebook
// ============================================================

/**
 * Exports all notes (and their photos) in a notebook as a JSON file.
 * File is named: "{NotebookName}-{YYYY-MM-DD}.json"
 * Photos are included as their stored Base64 imageData strings.
 * @param {Object} notebook - The notebook to export.
 */
async function notesExportNotebook(notebook) {
    var btn = document.getElementById('exportNotebookBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }

    try {
        var notes = await notesLoadNotes(notebook.id);

        // Load photos for all notes in one query, then group by note ID
        var photosSnap = await userCol('photos').where('targetType', '==', 'note').get();
        var photosByNote = {};
        photosSnap.docs.forEach(function(doc) {
            var d = doc.data();
            if (!photosByNote[d.targetId]) photosByNote[d.targetId] = [];
            photosByNote[d.targetId].push({
                id:        doc.id,
                imageData: d.imageData || '',
                caption:   d.caption   || '',
                createdAt: d.createdAt ? d.createdAt.toDate().toISOString() : null
            });
        });

        var exportedNotes = notes.map(function(note) {
            var photos = (photosByNote[note.id] || []).sort(function(a, b) {
                return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
            });
            return {
                id:        note.id,
                body:      note.body      || '',
                createdAt: note.createdAt ? note.createdAt.toDate().toISOString() : null,
                updatedAt: note.updatedAt ? note.updatedAt.toDate().toISOString() : null,
                photos:    photos
            };
        });

        var today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        var payload = {
            notebook: {
                id:         notebook.id,
                name:       notebook.name,
                color:      notebook.color || '',
                exportedAt: today
            },
            notes: exportedNotes
        };

        var json     = JSON.stringify(payload, null, 2);
        var safeName = notebook.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
        var filename = safeName + '-' + today + '.json';

        var blob = new Blob([json], { type: 'application/json' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        console.error('notesExportNotebook error:', e);
        alert('Export failed. See console for details.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Export'; }
    }
}

// ============================================================
// Search stubs — implemented in N-7
// ============================================================

// ============================================================
// Search — N-7
// ============================================================

/**
 * Handles input on the global search bar on #page-notes.
 * Loads all notes across all notebooks, filters client-side,
 * and displays results below the search bar.
 * Results are hidden when the query is blank.
 */
async function _notesHandleGlobalSearch() {
    var input      = document.getElementById('notesGlobalSearchInput');
    var resultsEl  = document.getElementById('notesSearchResults');
    var gridEl     = document.getElementById('notebookGrid');
    if (!input || !resultsEl) return;

    var query = input.value.trim();

    if (!query) {
        resultsEl.classList.add('hidden');
        resultsEl.innerHTML = '';
        if (gridEl) gridEl.classList.remove('hidden');
        return;
    }

    // Hide the tile grid while results are showing
    if (gridEl) gridEl.classList.add('hidden');

    try {
        var notebooks = await notesLoadNotebooks();
        var allNotes  = await notesLoadAllNotes(notebooks);
        var matches   = notesFilterNotes(allNotes, query);

        resultsEl.innerHTML = '';

        if (matches.length === 0) {
            resultsEl.innerHTML = '<p style="color:#888;padding:16px 0;">No notes match "' + escapeHtml(query) + '".</p>';
            resultsEl.classList.remove('hidden');
            return;
        }

        matches.forEach(function(note) {
            var el = document.createElement('div');
            el.className = 'note-search-result';

            var timestamp = notesFormatTimestamp(note.createdAt);
            var preview   = notesTruncateBody(note.body, 200);

            el.innerHTML =
                '<div class="note-search-result-meta">' +
                    '<span class="note-search-result-notebook">' + escapeHtml(note.notebookName) + '</span>' +
                    '<span class="note-search-result-time">' + escapeHtml(timestamp) + '</span>' +
                '</div>' +
                '<div class="note-search-result-body">' + escapeHtml(preview) + '</div>';

            el.onclick = function() { window.location.hash = '#note/' + note.id; };
            resultsEl.appendChild(el);
        });

        resultsEl.classList.remove('hidden');
    } catch (e) {
        console.error('_notesHandleGlobalSearch error:', e);
    }
}

/**
 * Handles input on the notebook-level search bar on #page-notebook.
 * Filters the already-loaded note cards client-side by showing/hiding them.
 * When the query is blank, all cards are shown.
 */
async function _notesHandleNotebookSearch() {
    var input = document.getElementById('notebookSearchInput');
    if (!input || !window.currentNotebook) return;

    var query = input.value.trim().toLowerCase();

    // If blank, show all cards and hide any results list
    if (!query) {
        document.querySelectorAll('.note-card').forEach(function(card) {
            card.classList.remove('hidden');
        });
        var emptyEl = document.getElementById('notesListEmpty');
        // Show empty state only if there are truly no cards
        var listEl = document.getElementById('notesList');
        if (emptyEl && listEl) {
            emptyEl.classList.toggle('hidden', listEl.children.length > 0);
        }
        return;
    }

    // Load notes for this notebook to get full text (cards may have truncated preview)
    try {
        var notes = await notesLoadNotes(window.currentNotebook.id);
        var matchIds = new Set(
            notesFilterNotes(notes, query).map(function(n) { return n.id; })
        );

        var visibleCount = 0;
        document.querySelectorAll('.note-card').forEach(function(card) {
            var id = card.dataset.id;
            if (matchIds.has(id)) {
                card.classList.remove('hidden');
                visibleCount++;
            } else {
                card.classList.add('hidden');
            }
        });

        // Show empty state if nothing matched
        var emptyEl = document.getElementById('notesListEmpty');
        if (emptyEl) {
            if (visibleCount === 0) {
                emptyEl.textContent = 'No notes match "' + query + '".';
                emptyEl.classList.remove('hidden');
            } else {
                emptyEl.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error('_notesHandleNotebookSearch error:', e);
    }
}

