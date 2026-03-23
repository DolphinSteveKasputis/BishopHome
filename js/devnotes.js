// ============================================================
// Devnotes.js — Personal dev scratchpad
// Simple notes for tracking issues and ideas while testing.
// Firestore collection: "devNotes"  fields: text, createdAt
// ============================================================

/** Firestore ID of the note currently being edited (null = add mode). */
var currentNoteEditId = null;

// ---------- Load & Render ----------

/**
 * Loads all dev notes from Firestore (newest first) and renders them.
 * Called by the router when navigating to #notes.
 */
async function loadNotesPage() {
    var container  = document.getElementById('notesContainer');
    var emptyState = document.getElementById('notesEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';
    emptyState.style.display = 'block';

    try {
        var snap = await userCol('devNotes').orderBy('createdAt', 'desc').get();

        emptyState.style.display = 'none';

        if (snap.empty) {
            emptyState.textContent   = 'No notes yet. Press + Add to write one.';
            emptyState.style.display = 'block';
            return;
        }

        snap.forEach(function(doc) {
            container.appendChild(buildNoteCard(doc.id, doc.data()));
        });

    } catch (err) {
        console.error('loadNotesPage error:', err);
        emptyState.textContent   = 'Error loading notes.';
        emptyState.style.display = 'block';
    }
}

/**
 * Builds a single note card element.
 * @param {string} noteId - Firestore document ID.
 * @param {Object} data   - Note data (text, createdAt).
 * @returns {HTMLElement}
 */
function buildNoteCard(noteId, data) {
    var card = document.createElement('div');
    card.className = 'note-card';

    // Date stamp
    var dateEl = document.createElement('div');
    dateEl.className = 'note-date';
    if (data.createdAt && data.createdAt.toDate) {
        dateEl.textContent = data.createdAt.toDate().toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }
    card.appendChild(dateEl);

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
        openNoteModal(noteId, data.text || '');
    });
    actions.appendChild(editBtn);

    var deleteBtn = document.createElement('button');
    deleteBtn.className   = 'btn btn-small btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function() {
        if (!confirm('Delete this note?')) return;
        handleNoteDelete(noteId);
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
function openNoteModal(noteId, text) {
    currentNoteEditId = noteId || null;

    document.getElementById('noteModalTitle').textContent =
        noteId ? 'Edit Note' : 'Add Note';
    document.getElementById('noteTextInput').value = text || '';

    openModal('noteModal');
    document.getElementById('noteTextInput').focus();
}

/**
 * Saves the note (add or edit) to Firestore and reloads the list.
 */
async function handleNoteSave() {
    var text = document.getElementById('noteTextInput').value.trim();
    if (!text) { alert('Please enter some text.'); return; }

    try {
        if (currentNoteEditId) {
            await userCol('devNotes').doc(currentNoteEditId).update({ text: text });
        } else {
            await userCol('devNotes').add({
                text:      text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        closeModal('noteModal');
        loadNotesPage();
    } catch (err) {
        console.error('handleNoteSave error:', err);
        alert('Error saving note.');
    }
}

/**
 * Deletes a note from Firestore and reloads the list.
 * @param {string} noteId - Firestore document ID.
 */
async function handleNoteDelete(noteId) {
    try {
        await userCol('devNotes').doc(noteId).delete();
        loadNotesPage();
    } catch (err) {
        console.error('handleNoteDelete error:', err);
        alert('Error deleting note.');
    }
}

// ---------- Event Listeners ----------

document.addEventListener('DOMContentLoaded', function() {

    // Notes page — Add button
    document.getElementById('addNoteBtn').addEventListener('click', function() {
        openNoteModal(null, '');
    });

    // Note modal — Save
    document.getElementById('noteModalSaveBtn').addEventListener('click', handleNoteSave);

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
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleNoteSave();
    });
});
