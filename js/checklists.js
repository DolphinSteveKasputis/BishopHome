// ============================================================
// Checklists.js — Seasonal Care Checklists
// Lets the user define reusable checklist templates (e.g.
// "Spring Startup") and run them as interactive to-do lists.
//
// Firestore collections:
//   checklistTemplates  — { name, items:[{label}], createdAt }
//   checklistRuns       — { templateId, templateName,
//                           startedAt, completedAt,
//                           items:[{label, done}] }
// ============================================================

// ---------- Page Entry Point ----------

/**
 * Called by the router when navigating to #checklists.
 * Loads active runs and templates in parallel; wires controls once.
 */
async function loadChecklistsPage() {
    // Wire the "New Template" button and completed toggle exactly once
    var addBtn = document.getElementById('addChecklistTemplateBtn');
    var toggle = document.getElementById('clShowCompletedToggle');

    if (!addBtn.dataset.wired) {
        addBtn.dataset.wired = 'true';

        addBtn.addEventListener('click', clOpenAddTemplateModal);

        toggle.addEventListener('change', function() {
            var completedDiv  = document.getElementById('clCompletedContainer');
            var completedEmpty = document.getElementById('clCompletedEmptyState');
            if (toggle.checked) {
                completedDiv.classList.remove('hidden');
                clLoadCompletedRuns();   // load on first show
            } else {
                completedDiv.classList.add('hidden');
                completedEmpty.classList.add('hidden');
            }
        });
    }

    // Reset completed section when page is re-entered
    toggle.checked = false;
    document.getElementById('clCompletedContainer').classList.add('hidden');
    document.getElementById('clCompletedEmptyState').classList.add('hidden');

    // Load both sections simultaneously
    await Promise.all([
        clLoadActiveRuns(),
        clLoadTemplates(),
    ]);
}

// ============================================================
// ACTIVE RUNS
// ============================================================

/**
 * Loads all non-completed runs (completedAt is null/absent) and renders them.
 */
async function clLoadActiveRuns() {
    var container = document.getElementById('clActiveRunsContainer');
    var emptyEl   = document.getElementById('clActiveRunsEmptyState');

    container.innerHTML = '<p class="ar-summary">Loading…</p>';
    emptyEl.classList.add('hidden');

    try {
        // Avoid composite index requirement by filtering + sorting client-side
        var snap = await userCol('checklistRuns')
            .where('completedAt', '==', null)
            .get();

        container.innerHTML = '';

        var runs = snap.docs
            .map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); })
            .sort(function(a, b) {
                return (b.startedAt || '').localeCompare(a.startedAt || '');
            });

        if (runs.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

        runs.forEach(function(run) {
            container.appendChild(clBuildRunCard(run));
        });

    } catch (err) {
        console.error('Error loading active runs:', err);
        container.innerHTML = '<p class="ar-summary" style="color:#c62828;">Error loading active checklists.</p>';
    }
}

/**
 * Builds a full interactive card for one active run.
 * @param {Object} run — Run document data including id.
 * @returns {HTMLElement}
 */
function clBuildRunCard(run) {
    var card = document.createElement('div');
    card.className  = 'cl-run-card';
    card.dataset.id = run.id;

    // ── Title row ─────────────────────────────────────────────
    var title = document.createElement('div');
    title.className   = 'cl-run-title';
    title.textContent = run.templateName || 'Checklist';
    card.appendChild(title);

    var dateEl = document.createElement('div');
    dateEl.className   = 'cl-run-date';
    dateEl.textContent = 'Started ' + clFormatDate(run.startedAt);
    card.appendChild(dateEl);

    // ── Progress bar ──────────────────────────────────────────
    var items    = run.items || [];
    var doneCount = items.filter(function(i) { return i.done; }).length;
    var total    = items.length;

    var progressRow = document.createElement('div');
    progressRow.className = 'cl-progress-row';

    var bar = document.createElement('div');
    bar.className = 'cl-progress-bar';
    var fill = document.createElement('div');
    fill.className = 'cl-progress-fill';
    fill.style.width = total > 0 ? Math.round(doneCount / total * 100) + '%' : '0%';
    bar.appendChild(fill);

    var progressText = document.createElement('span');
    progressText.className   = 'cl-progress-text';
    progressText.textContent = doneCount + ' / ' + total + ' done';

    progressRow.appendChild(bar);
    progressRow.appendChild(progressText);
    card.appendChild(progressRow);

    // ── Item checklist ────────────────────────────────────────
    var list = document.createElement('ul');
    list.className = 'cl-item-list';

    items.forEach(function(item, idx) {
        var li = document.createElement('li');
        li.className = 'cl-item';

        var cb = document.createElement('input');
        cb.type    = 'checkbox';
        cb.checked = !!item.done;
        cb.addEventListener('change', function() {
            clToggleItem(run.id, cb.checked, idx, card);
        });

        var label = document.createElement('span');
        label.className   = 'cl-item-label' + (item.done ? ' cl-item-label--done' : '');
        label.textContent = item.label;

        li.appendChild(cb);
        li.appendChild(label);
        list.appendChild(li);
    });

    card.appendChild(list);

    // ── Action buttons ────────────────────────────────────────
    var actions = document.createElement('div');
    actions.className = 'cl-run-actions';

    var completeBtn = document.createElement('button');
    completeBtn.className   = 'btn btn-primary btn-small';
    completeBtn.textContent = 'Mark Complete';
    completeBtn.addEventListener('click', function() {
        clMarkRunComplete(run.id);
    });

    var deleteBtn = document.createElement('button');
    deleteBtn.className   = 'btn btn-danger btn-small';
    deleteBtn.textContent = 'Abandon';
    deleteBtn.addEventListener('click', function() {
        clDeleteRun(run.id, 'active');
    });

    actions.appendChild(completeBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    return card;
}

/**
 * Toggles one item's done state.
 * Reads the run, flips the item, writes the whole array back.
 * Updates the card's progress bar and item label in-place (no full reload).
 * @param {string}  runId   — Firestore document ID of the run.
 * @param {boolean} checked — New done state.
 * @param {number}  idx     — Index of the item in the items array.
 * @param {HTMLElement} card — The run card element (for in-place UI update).
 */
async function clToggleItem(runId, checked, idx, card) {
    try {
        var doc = await userCol('checklistRuns').doc(runId).get();
        if (!doc.exists) return;

        var items = doc.data().items;
        items[idx].done = checked;

        await userCol('checklistRuns').doc(runId).update({ items: items });

        // Update label style in the card without a full reload
        var labels = card.querySelectorAll('.cl-item-label');
        if (labels[idx]) {
            labels[idx].className = 'cl-item-label' + (checked ? ' cl-item-label--done' : '');
        }

        // Refresh progress bar + text
        var doneCount = items.filter(function(i) { return i.done; }).length;
        var total     = items.length;
        var fill      = card.querySelector('.cl-progress-fill');
        var text      = card.querySelector('.cl-progress-text');
        if (fill) fill.style.width = total > 0 ? Math.round(doneCount / total * 100) + '%' : '0%';
        if (text) text.textContent = doneCount + ' / ' + total + ' done';

    } catch (err) {
        console.error('Error toggling checklist item:', err);
    }
}

/**
 * Stamps completedAt on a run (moves it to the Completed section).
 * @param {string} runId
 */
async function clMarkRunComplete(runId) {
    if (!confirm('Mark this checklist as complete? It will move to the Completed section.')) return;
    try {
        await userCol('checklistRuns').doc(runId).update({
            completedAt: new Date().toISOString()
        });
        clLoadActiveRuns();
    } catch (err) {
        console.error('Error completing run:', err);
    }
}

/**
 * Deletes a run after confirmation.
 * @param {string} runId
 * @param {string} section — 'active' or 'completed' (controls which list reloads).
 */
async function clDeleteRun(runId, section) {
    var msg = section === 'active'
        ? 'Abandon this checklist? All progress will be lost.'
        : 'Delete this completed checklist record?';
    if (!confirm(msg)) return;
    try {
        await userCol('checklistRuns').doc(runId).delete();
        if (section === 'active') {
            clLoadActiveRuns();
        } else {
            clLoadCompletedRuns();
        }
    } catch (err) {
        console.error('Error deleting run:', err);
    }
}

// ============================================================
// TEMPLATES
// ============================================================

/**
 * Loads all checklist templates and renders them.
 */
async function clLoadTemplates() {
    var container = document.getElementById('clTemplatesContainer');
    var emptyEl   = document.getElementById('clTemplatesEmptyState');

    container.innerHTML = '';
    emptyEl.classList.add('hidden');

    try {
        var snap = await userCol('checklistTemplates')
            .orderBy('name')
            .get();

        if (snap.empty) {
            emptyEl.classList.remove('hidden');
            return;
        }

        snap.forEach(function(doc) {
            container.appendChild(clBuildTemplateCard({ id: doc.id, ...doc.data() }));
        });

    } catch (err) {
        console.error('Error loading checklist templates:', err);
        container.innerHTML = '<p class="ar-summary" style="color:#c62828;">Error loading templates.</p>';
    }
}

/**
 * Builds a compact card for one template.
 * Shows the name, item count, and Start / Edit / Delete buttons.
 * @param {Object} template
 * @returns {HTMLElement}
 */
function clBuildTemplateCard(template) {
    var card = document.createElement('div');
    card.className = 'cl-template-card';

    var info = document.createElement('div');
    info.className = 'cl-template-info';

    var name = document.createElement('div');
    name.className   = 'cl-template-name';
    name.textContent = template.name;
    info.appendChild(name);

    var count = document.createElement('div');
    var itemCount = (template.items || []).length;
    count.className   = 'cl-template-count';
    count.textContent = itemCount + ' item' + (itemCount !== 1 ? 's' : '');
    info.appendChild(count);

    card.appendChild(info);

    // Buttons
    var btnGroup = document.createElement('div');
    btnGroup.className = 'cl-template-actions';

    var startBtn = document.createElement('button');
    startBtn.className   = 'btn btn-primary btn-small';
    startBtn.textContent = '▶ Start';
    startBtn.addEventListener('click', function() { clStartRun(template); });

    var editBtn = document.createElement('button');
    editBtn.className   = 'btn btn-secondary btn-small';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function() { clOpenEditTemplateModal(template); });

    var delBtn = document.createElement('button');
    delBtn.className   = 'btn btn-danger btn-small';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', function() { clDeleteTemplate(template.id); });

    btnGroup.appendChild(startBtn);
    btnGroup.appendChild(editBtn);
    btnGroup.appendChild(delBtn);
    card.appendChild(btnGroup);

    return card;
}

/**
 * Creates a new run from a template snapshot and reloads the active runs section.
 * The run stores a copy of the template's items so it is independent of future
 * template edits.
 * @param {Object} template
 */
async function clStartRun(template) {
    var items = (template.items || []).map(function(item) {
        return { label: item.label, done: false };
    });

    if (items.length === 0) {
        alert('This template has no items. Edit the template and add at least one task first.');
        return;
    }

    try {
        await userCol('checklistRuns').add({
            templateId:   template.id,
            templateName: template.name,
            startedAt:    new Date().toISOString(),
            completedAt:  null,
            items:        items,
            createdAt:    firebase.firestore.FieldValue.serverTimestamp()
        });

        // Scroll to the top of the page so the user sees the new run
        window.scrollTo({ top: 0, behavior: 'smooth' });
        clLoadActiveRuns();

    } catch (err) {
        console.error('Error starting checklist run:', err);
        alert('Error starting checklist. Please try again.');
    }
}

/**
 * Deletes a template after confirmation.
 * Existing runs are not affected (they carry a snapshot of the items).
 * @param {string} templateId
 */
async function clDeleteTemplate(templateId) {
    if (!confirm('Delete this template? Any active runs from this template will not be affected.')) return;
    try {
        await userCol('checklistTemplates').doc(templateId).delete();
        clLoadTemplates();
    } catch (err) {
        console.error('Error deleting template:', err);
    }
}

// ============================================================
// COMPLETED RUNS
// ============================================================

/**
 * Loads completed runs and renders them in the Completed section.
 * Called when the "Show completed" toggle is checked.
 */
async function clLoadCompletedRuns() {
    var container = document.getElementById('clCompletedContainer');
    var emptyEl   = document.getElementById('clCompletedEmptyState');

    container.innerHTML = '<p class="ar-summary">Loading…</p>';
    emptyEl.classList.add('hidden');

    try {
        var snap = await userCol('checklistRuns')
            .where('completedAt', '!=', null)
            .orderBy('completedAt', 'desc')
            .get();

        container.innerHTML = '';

        if (snap.empty) {
            emptyEl.classList.remove('hidden');
            return;
        }

        snap.forEach(function(doc) {
            container.appendChild(clBuildCompletedCard({ id: doc.id, ...doc.data() }));
        });

    } catch (err) {
        console.error('Error loading completed runs:', err);
        container.innerHTML = '<p class="ar-summary" style="color:#c62828;">Error loading completed checklists.</p>';
    }
}

/**
 * Builds a compact read-only card for one completed run.
 * @param {Object} run
 * @returns {HTMLElement}
 */
function clBuildCompletedCard(run) {
    var card = document.createElement('div');
    card.className = 'cl-completed-card';

    var info = document.createElement('div');
    info.className = 'cl-completed-info';

    var name = document.createElement('div');
    name.className   = 'cl-completed-name';
    name.textContent = run.templateName || 'Checklist';
    info.appendChild(name);

    var items     = run.items || [];
    var doneCount = items.filter(function(i) { return i.done; }).length;

    var dates = document.createElement('div');
    dates.className   = 'cl-completed-dates';
    dates.textContent = 'Started ' + clFormatDate(run.startedAt) +
                        ' · Completed ' + clFormatDate(run.completedAt) +
                        ' · ' + doneCount + '/' + items.length + ' items done';
    info.appendChild(dates);

    card.appendChild(info);

    var delBtn = document.createElement('button');
    delBtn.className   = 'btn btn-danger btn-small';
    delBtn.textContent = 'Delete';
    delBtn.style.flexShrink = '0';
    delBtn.addEventListener('click', function() { clDeleteRun(run.id, 'completed'); });
    card.appendChild(delBtn);

    return card;
}

// ============================================================
// TEMPLATE MODAL — Add / Edit
// ============================================================

/**
 * Opens the template modal in Add mode with a blank form.
 */
function clOpenAddTemplateModal() {
    var modal = document.getElementById('checklistTemplateModal');
    document.getElementById('clTemplateModalTitle').textContent = 'New Template';
    document.getElementById('clTemplateName').value = '';
    document.getElementById('clTemplateItemsEditor').innerHTML = '';
    modal.dataset.mode = 'add';
    delete modal.dataset.editId;

    // Start with 3 blank item rows so the user can get started immediately
    clAddItemRow('');
    clAddItemRow('');
    clAddItemRow('');

    openModal('checklistTemplateModal');
    document.getElementById('clTemplateName').focus();
}

/**
 * Opens the template modal in Edit mode pre-filled with existing data.
 * @param {Object} template
 */
function clOpenEditTemplateModal(template) {
    var modal = document.getElementById('checklistTemplateModal');
    document.getElementById('clTemplateModalTitle').textContent = 'Edit Template';
    document.getElementById('clTemplateName').value = template.name || '';

    var editor = document.getElementById('clTemplateItemsEditor');
    editor.innerHTML = '';
    (template.items || []).forEach(function(item) {
        clAddItemRow(item.label);
    });
    // Always leave one empty row at the bottom so adding more is easy
    clAddItemRow('');

    modal.dataset.mode   = 'edit';
    modal.dataset.editId = template.id;

    openModal('checklistTemplateModal');
    document.getElementById('clTemplateName').focus();
}

/**
 * Appends one item row (text input + remove button) to the editor.
 * @param {string} value — Pre-fill text, or empty string for a blank row.
 */
function clAddItemRow(value) {
    var editor = document.getElementById('clTemplateItemsEditor');

    var row = document.createElement('div');
    row.className = 'cl-item-row';

    var input = document.createElement('input');
    input.type        = 'text';
    input.className   = 'cl-item-input';
    input.placeholder = 'Task description…';
    input.value       = value || '';

    // Pressing Enter in an item row adds a new blank row below it
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            clAddItemRow('');
            // Focus the newly added row's input
            var rows = editor.querySelectorAll('.cl-item-input');
            rows[rows.length - 1].focus();
        }
    });

    var removeBtn = document.createElement('button');
    removeBtn.type      = 'button';
    removeBtn.className = 'cl-item-remove-btn';
    removeBtn.title     = 'Remove this item';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function() {
        row.remove();
    });

    row.appendChild(input);
    row.appendChild(removeBtn);
    editor.appendChild(row);
}

/**
 * Reads all non-blank item inputs from the editor.
 * @returns {Array<{label: string}>}
 */
function clGetItemsFromModal() {
    var inputs = document.querySelectorAll('#clTemplateItemsEditor .cl-item-input');
    var items  = [];
    inputs.forEach(function(input) {
        var val = input.value.trim();
        if (val) items.push({ label: val });
    });
    return items;
}

/**
 * Saves the template (add or edit mode) and reloads the templates section.
 */
async function clSaveTemplate() {
    var modal = document.getElementById('checklistTemplateModal');
    var name  = document.getElementById('clTemplateName').value.trim();
    var items = clGetItemsFromModal();

    if (!name) {
        alert('Please enter a template name.');
        document.getElementById('clTemplateName').focus();
        return;
    }
    if (items.length === 0) {
        alert('Please add at least one item to the template.');
        return;
    }

    try {
        var mode = modal.dataset.mode;
        if (mode === 'add') {
            await userCol('checklistTemplates').add({
                name:      name,
                items:     items,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await userCol('checklistTemplates').doc(modal.dataset.editId).update({
                name:  name,
                items: items
            });
        }
        closeModal('checklistTemplateModal');
        clLoadTemplates();

    } catch (err) {
        console.error('Error saving checklist template:', err);
        alert('Error saving template. Please try again.');
    }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Formats an ISO date string or Firestore Timestamp into a readable short date.
 * Returns '—' for missing values.
 * @param {string|Object} val — ISO string or Firestore Timestamp.
 * @returns {string}
 */
function clFormatDate(val) {
    if (!val) return '—';
    var d;
    if (typeof val === 'string') {
        d = new Date(val);
    } else if (val && typeof val.toDate === 'function') {
        d = val.toDate();
    } else {
        return '—';
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================
// EVENT LISTENERS
// ============================================================

document.addEventListener('DOMContentLoaded', function() {

    // Template modal — Save button
    document.getElementById('clTemplateModalSaveBtn').addEventListener('click', clSaveTemplate);

    // Template modal — Cancel button
    document.getElementById('clTemplateModalCancelBtn').addEventListener('click', function() {
        closeModal('checklistTemplateModal');
    });

    // Template modal — close on overlay click
    document.getElementById('checklistTemplateModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('checklistTemplateModal');
    });

    // Template modal — "+ Add Item" button
    document.getElementById('clAddItemBtn').addEventListener('click', function() {
        clAddItemRow('');
        // Focus the new row
        var inputs = document.querySelectorAll('#clTemplateItemsEditor .cl-item-input');
        if (inputs.length) inputs[inputs.length - 1].focus();
    });
});
