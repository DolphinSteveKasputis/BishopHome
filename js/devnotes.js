// ============================================================
// Devnotes.js — Shared dev scratchpad
// Notes are stored in a shared Firestore collection visible to ALL users.
// Fields: text, author (email), createdAt
// Collection: db.collection('sharedDevNotes')  (NOT per-user)
// ============================================================

/** Firestore ID of the note currently being edited (null = add mode). */
var currentNoteEditId = null;

// ---------- Helper ----------

/** Returns the current user's email (or display name) for author attribution. */
function _devNoteAuthor() {
    var user = firebase.auth().currentUser;
    if (!user) return 'Unknown';
    return user.email || user.displayName || 'Unknown';
}

// ---------- Load & Render ----------

/**
 * Loads all shared dev notes from Firestore (newest first) and renders them.
 * Called by the router when navigating to #devnotes.
 */
async function loadDevNotesPage() {
    // Set breadcrumb
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML = '<a href="#settings">Settings</a><span class="separator">&rsaquo;</span><span>Dev Notes</span>';

    var container  = document.getElementById('devNotesContainer');
    var emptyState = document.getElementById('devNotesEmptyState');

    container.innerHTML      = '';
    emptyState.textContent   = 'Loading…';
    emptyState.style.display = 'block';

    try {
        var snap = await db.collection('sharedDevNotes').orderBy('createdAt', 'desc').get();

        emptyState.style.display = 'none';

        if (snap.empty) {
            emptyState.textContent   = 'No notes yet. Press + Add Note to write one.';
            emptyState.style.display = 'block';
            return;
        }

        snap.forEach(function(doc) {
            container.appendChild(buildDevNoteCard(doc.id, doc.data()));
        });

    } catch (err) {
        console.error('loadDevNotesPage error:', err);
        emptyState.textContent   = 'Error loading notes.';
        emptyState.style.display = 'block';
    }
}

/**
 * Builds a single dev note card element.
 * @param {string} noteId - Firestore document ID.
 * @param {Object} data   - Note data (text, author, createdAt).
 * @returns {HTMLElement}
 */
function buildDevNoteCard(noteId, data) {
    var card = document.createElement('div');
    card.className = 'note-card';

    // Date + author row
    var meta = document.createElement('div');
    meta.className = 'note-date';
    var dateStr = '';
    if (data.createdAt && data.createdAt.toDate) {
        dateStr = data.createdAt.toDate().toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }
    var authorStr = data.author ? ' · ' + data.author : '';
    meta.textContent = dateStr + authorStr;
    card.appendChild(meta);

    // Note text — preserves line breaks
    var textEl = document.createElement('div');
    textEl.className   = 'note-text';
    textEl.textContent = data.text || '';
    card.appendChild(textEl);

    // Action buttons
    var actions = document.createElement('div');
    actions.className = 'note-actions';

    var editBtn = document.createElement('button');
    editBtn.className   = 'btn btn-small btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function() {
        openDevNoteModal(noteId, data.text || '');
    });
    actions.appendChild(editBtn);

    var deleteBtn = document.createElement('button');
    deleteBtn.className   = 'btn btn-small btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function() {
        if (!confirm('Delete this note?')) return;
        handleDevNoteDelete(noteId);
    });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);
    return card;
}

// ---------- Modal ----------

/**
 * Opens the note modal.
 * @param {string|null} noteId - Firestore ID for edit mode; null for add.
 * @param {string}      text   - Existing note text (empty for add).
 */
function openDevNoteModal(noteId, text) {
    currentNoteEditId = noteId || null;

    document.getElementById('noteModalTitle').textContent =
        noteId ? 'Edit Note' : 'Add Note';
    document.getElementById('noteTextInput').value = text || '';

    openModal('noteModal');
    document.getElementById('noteTextInput').focus();
}

/**
 * Saves the note (add or edit) to the shared Firestore collection and reloads the list.
 */
async function handleDevNoteSave() {
    var text = document.getElementById('noteTextInput').value.trim();
    if (!text) { alert('Please enter some text.'); return; }

    try {
        if (currentNoteEditId) {
            // Edit — preserve original author, just update text
            await db.collection('sharedDevNotes').doc(currentNoteEditId).update({ text: text });
        } else {
            await db.collection('sharedDevNotes').add({
                text:      text,
                author:    _devNoteAuthor(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        closeModal('noteModal');
        loadDevNotesPage();
    } catch (err) {
        console.error('handleDevNoteSave error:', err);
        alert('Error saving note.');
    }
}

/**
 * Deletes a note from the shared Firestore collection and reloads the list.
 * @param {string} noteId - Firestore document ID.
 */
async function handleDevNoteDelete(noteId) {
    try {
        await db.collection('sharedDevNotes').doc(noteId).delete();
        loadDevNotesPage();
    } catch (err) {
        console.error('handleDevNoteDelete error:', err);
        alert('Error deleting note.');
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // Dev Notes page — Add button
    var addBtn = document.getElementById('addDevNoteBtn');
    if (addBtn) addBtn.addEventListener('click', function() {
        openDevNoteModal(null, '');
    });

    // Note modal — Save
    document.getElementById('noteModalSaveBtn').addEventListener('click', handleDevNoteSave);

    // Note modal — Cancel
    document.getElementById('noteModalCancelBtn').addEventListener('click', function() {
        closeModal('noteModal');
    });

    // Note modal — Close on overlay click
    document.getElementById('noteModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('noteModal');
    });

    // Note modal — Ctrl+Enter to save quickly
    document.getElementById('noteTextInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleDevNoteSave();
    });
});
