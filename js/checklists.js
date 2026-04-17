// ============================================================
// Checklists.js — Context-Aware Seasonal Care Checklists
// Lets the user define reusable checklist templates (e.g.
// "Spring Startup") and run them as interactive to-do lists.
//
// Templates and runs are scoped to a target (yard, zone, house,
// floor, room, or vehicle).  When the Checklists page loads, it
// reads window.checklistsContext (set by the router in app.js)
// and shows only templates / runs that belong to the current
// location or any of its descendants (roll-up).
//
// Firestore collections:
//   checklistTemplates  — { name, targetType, targetId, targetName,
//                           items:[{label}], createdAt }
//   checklistRuns       — { templateId, templateName,
//                           targetType, targetId, targetName,
//                           startedAt, completedAt,
//                           items:[{label, done}] }
// ============================================================

// ---- Module-level context (resolved once per page load) ----
/** Resolved context for the current checklists page view.
 *  Set by loadChecklistsPage(); used by all sub-loaders.
 *  Shape: { type, id?, name?, filterIds? }
 */
var clCurrentContext = null;

// ---------- Page Entry Point ----------

/**
 * Called by the router when navigating to #checklists.
 * Resolves the current context (yard / zone / house / floor / room /
 * vehicle / life), then loads active runs and templates in parallel.
 */
async function loadChecklistsPage() {
    // Resolve context from the global set by app.js router
    clCurrentContext = await clResolveContextFilter(
        window.checklistsContext || { type: 'yard' }
    );

    // Show context subtitle so the user knows what they're looking at
    var subtitle = document.getElementById('clContextSubtitle');
    if (subtitle) {
        subtitle.textContent = 'Showing: ' + clContextLabel(clCurrentContext);
    }

    // Wire the "New Template" button and completed toggle exactly once
    var addBtn = document.getElementById('addChecklistTemplateBtn');
    var toggle = document.getElementById('clShowCompletedToggle');

    if (!addBtn.dataset.wired) {
        addBtn.dataset.wired = 'true';

        addBtn.addEventListener('click', clOpenAddTemplateModal);

        toggle.addEventListener('change', function() {
            var completedDiv   = document.getElementById('clCompletedContainer');
            var completedEmpty = document.getElementById('clCompletedEmptyState');
            if (toggle.checked) {
                completedDiv.classList.remove('hidden');
                clLoadCompletedRuns();
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
// CONTEXT RESOLUTION
// ============================================================

/**
 * Returns a human-readable label for the current context.
 * Shown as a subtitle on the Checklists page.
 * @param {Object} ctx
 * @returns {string}
 */
function clContextLabel(ctx) {
    if (!ctx) return 'Yard';
    switch (ctx.type) {
        case 'life':    return 'Life';
        case 'yard':    return 'Yard';
        case 'zone':    return (ctx.name || 'Zone') + ' (Zone)';
        case 'house':   return 'House';
        case 'floor':   return (ctx.name || 'Floor') + ' (Floor)';
        case 'room':    return (ctx.name || 'Room') + ' (Room)';
        case 'vehicle': return ctx.name || 'Vehicle';
        default:        return 'Yard';
    }
}

/**
 * Augments a raw context object with filterIds[] for rollup queries.
 *
 * - zone context: fetches all zones; computes descendant IDs so that
 *   a zone page shows templates/runs for that zone AND its children.
 * - floor context: fetches rooms on this floor for rollup.
 * - All other contexts need no extra data.
 *
 * @param {Object} ctx  — Raw context from window.checklistsContext.
 * @returns {Object}    — Context with filterIds[] added when applicable.
 */
async function clResolveContextFilter(ctx) {
    if (!ctx) return { type: 'yard' };
    var result = Object.assign({}, ctx);

    if (ctx.type === 'zone') {
        // BFS: find all zones that are descendants of ctx.id
        var snap = await userCol('zones').get();
        var allZones = {};
        snap.forEach(function(doc) { allZones[doc.id] = doc.data(); });

        var desc  = [];
        var queue = [ctx.id];
        while (queue.length) {
            var cur = queue.shift();
            Object.keys(allZones).forEach(function(zid) {
                if (allZones[zid].parentId === cur) {
                    desc.push(zid);
                    queue.push(zid);
                }
            });
        }
        // filterIds includes the zone itself plus all descendants
        result.filterIds = [ctx.id].concat(desc);

    } else if (ctx.type === 'floor') {
        // Floor shows itself + all rooms on that floor
        var rSnap = await userCol('rooms').where('floorId', '==', ctx.id).get();
        result.filterIds = rSnap.docs.map(function(d) { return d.id; });
    }

    return result;
}

/**
 * Returns true if a template or run doc belongs to the current context.
 * Implements the "roll-up" rule: a child entity's items appear on the
 * parent page, but a parent's items do NOT appear on a child page.
 *
 * @param {Object} item — Template or run document data.
 * @param {Object} ctx  — Resolved context with filterIds if applicable.
 * @returns {boolean}
 */
function clMatchesContext(item, ctx) {
    var t  = item.targetType || null;
    var id = item.targetId   || null;

    switch (ctx.type) {
        case 'life':
            // Life shows templates explicitly tagged 'life' (or untagged legacy)
            return !t || t === 'life';

        case 'yard':
            // Yard top-level rolls up everything: yard-general and all zones
            return t === 'yard' || t === 'zone';

        case 'zone':
            // Zone page shows that zone + its children (filterIds pre-computed)
            return t === 'zone' && (ctx.filterIds || []).indexOf(id) !== -1;

        case 'house':
            // House top-level rolls up: house-general, floors, and rooms
            return t === 'house' || t === 'floor' || t === 'room';

        case 'floor':
            // Floor page shows floor templates + rooms on that floor
            if (t === 'floor' && id === ctx.id) return true;
            if (t === 'room'  && (ctx.filterIds || []).indexOf(id) !== -1) return true;
            return false;

        case 'room':
            // Room page shows only that room's templates
            return t === 'room' && id === ctx.id;

        case 'vehicle':
            // Vehicle page shows only that vehicle's templates
            return t === 'vehicle' && id === ctx.id;

        default:
            return false;
    }
}

// ============================================================
// ACTIVE RUNS
// ============================================================

/**
 * Loads all non-completed runs and filters to the current context.
 */
async function clLoadActiveRuns() {
    var container = document.getElementById('clActiveRunsContainer');
    var emptyEl   = document.getElementById('clActiveRunsEmptyState');

    container.innerHTML = '<p class="ar-summary">Loading…</p>';
    emptyEl.classList.add('hidden');

    try {
        var snap = await userCol('checklistRuns')
            .where('completedAt', '==', null)
            .get();

        var ctx = clCurrentContext || { type: 'yard' };

        var runs = snap.docs
            .map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); })
            .filter(function(run) { return clMatchesContext(run, ctx); })
            .sort(function(a, b) {
                return (b.startedAt || '').localeCompare(a.startedAt || '');
            });

        container.innerHTML = '';

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

    // Location badge (shown on roll-up views so user knows which entity it belongs to)
    if (run.targetName) {
        var badge = document.createElement('div');
        badge.className   = 'cl-target-badge';
        badge.textContent = '📍 ' + run.targetName;
        card.appendChild(badge);
    }

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
 * Toggles one item's done state and updates the card in-place.
 * @param {string}  runId
 * @param {boolean} checked
 * @param {number}  idx
 * @param {HTMLElement} card
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
 * @param {string} section — 'active' or 'completed'
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
 * Loads all checklist templates, filters to the current context, and renders them.
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

        var ctx = clCurrentContext || { type: 'yard' };

        var templates = snap.docs
            .map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); })
            .filter(function(t) { return clMatchesContext(t, ctx); });

        if (templates.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

        templates.forEach(function(tmpl) {
            container.appendChild(clBuildTemplateCard(tmpl));
        });

    } catch (err) {
        console.error('Error loading checklist templates:', err);
        container.innerHTML = '<p class="ar-summary" style="color:#c62828;">Error loading templates.</p>';
    }
}

/**
 * Builds a compact card for one template.
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

    // Location badge — helpful when viewing a roll-up (e.g. all zone templates on the Yard page)
    if (template.targetName) {
        var badge = document.createElement('div');
        badge.className   = 'cl-target-badge';
        badge.textContent = '📍 ' + template.targetName;
        info.appendChild(badge);
    }

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
 * Creates a new run from a template snapshot.
 * Copies targetType / targetId / targetName from the template so the
 * run is independently filterable by context.
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
            targetType:   template.targetType  || null,
            targetId:     template.targetId    || null,
            targetName:   template.targetName  || null,
            startedAt:    new Date().toISOString(),
            completedAt:  null,
            items:        items,
            createdAt:    firebase.firestore.FieldValue.serverTimestamp()
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
        clLoadActiveRuns();

    } catch (err) {
        console.error('Error starting checklist run:', err);
        alert('Error starting checklist. Please try again.');
    }
}

/**
 * Deletes a template after confirmation.
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
 * Loads completed runs, filters to context, renders in the Completed section.
 * Called when the "Show completed" toggle is checked.
 */
async function clLoadCompletedRuns() {
    var container = document.getElementById('clCompletedContainer');
    var emptyEl   = document.getElementById('clCompletedEmptyState');

    container.innerHTML = '<p class="ar-summary">Loading…</p>';
    emptyEl.classList.add('hidden');

    try {
        // Fetch all completed runs and sort client-side to avoid composite index
        var snap = await userCol('checklistRuns')
            .where('completedAt', '!=', null)
            .get();

        var ctx = clCurrentContext || { type: 'yard' };

        var runs = snap.docs
            .map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); })
            .filter(function(run) { return clMatchesContext(run, ctx); })
            .sort(function(a, b) {
                return (b.completedAt || '').localeCompare(a.completedAt || '');
            });

        container.innerHTML = '';

        if (runs.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

        runs.forEach(function(run) {
            container.appendChild(clBuildCompletedCard(run));
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

    if (run.targetName) {
        var badge = document.createElement('div');
        badge.className   = 'cl-target-badge';
        badge.textContent = '📍 ' + run.targetName;
        info.appendChild(badge);
    }

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
 * Opens the template modal in Add mode.
 * Populates the target picker defaulting to the current context entity.
 */
async function clOpenAddTemplateModal() {
    var modal = document.getElementById('checklistTemplateModal');
    document.getElementById('clTemplateModalTitle').textContent = 'New Template';
    document.getElementById('clTemplateName').value = '';
    document.getElementById('clTemplateItemsEditor').innerHTML = '';
    modal.dataset.mode = 'add';
    delete modal.dataset.editId;

    // Populate target picker (async: fetches zones / floors / rooms)
    var ctx = clCurrentContext || { type: 'yard' };
    await clPopulateTargetPicker(ctx, null);

    // Start with 3 blank item rows
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
async function clOpenEditTemplateModal(template) {
    var modal = document.getElementById('checklistTemplateModal');
    document.getElementById('clTemplateModalTitle').textContent = 'Edit Template';
    document.getElementById('clTemplateName').value = template.name || '';

    var editor = document.getElementById('clTemplateItemsEditor');
    editor.innerHTML = '';
    (template.items || []).forEach(function(item) {
        clAddItemRow(item.label);
    });
    clAddItemRow('');  // always leave one blank row at bottom

    modal.dataset.mode   = 'edit';
    modal.dataset.editId = template.id;

    // Populate target picker, pre-selecting the template's existing target
    var ctx = clCurrentContext || { type: 'yard' };
    await clPopulateTargetPicker(ctx, template);

    openModal('checklistTemplateModal');
    document.getElementById('clTemplateName').focus();
}

/**
 * Populates the Location dropdown in the template modal.
 *
 * - Yard context: shows "Yard (general)" + all zones (indented by level)
 * - House context: shows "House (general)" + floors + rooms (indented)
 * - Vehicle context: shows just the vehicle (no other choice)
 * - Life context: hides the picker entirely
 *
 * @param {Object} ctx            — Current resolved context.
 * @param {Object|null} existing  — Existing template (edit mode) or null (add mode).
 */
async function clPopulateTargetPicker(ctx, existing) {
    var group  = document.getElementById('clTargetPickerGroup');
    var select = document.getElementById('clTemplateTarget');
    select.innerHTML = '';

    if (ctx.type === 'life') {
        group.classList.add('hidden');
        return;
    }
    group.classList.remove('hidden');

    // When editing, restore the saved value; otherwise default to the current context entity
    var existingValue = existing
        ? ((existing.targetType || '') + '|' + (existing.targetId || ''))
        : null;

    // ── Yard / Zone context ────────────────────────────────────────────────
    if (ctx.type === 'yard' || ctx.type === 'zone') {
        var yardOpt = document.createElement('option');
        yardOpt.value = 'yard|';
        yardOpt.textContent = 'Yard (general)';
        select.appendChild(yardOpt);

        // Fetch all zones and render hierarchically (Level 1 → Level 2 → Level 3)
        var snap = await userCol('zones').get();
        var zones = {};
        snap.forEach(function(doc) {
            zones[doc.id] = Object.assign({ id: doc.id }, doc.data());
        });

        function addZoneOptions(parentId, prefix) {
            Object.values(zones)
                .filter(function(z) { return (z.parentId || null) === (parentId || null); })
                .sort(function(a, b) { return a.name.localeCompare(b.name); })
                .forEach(function(z) {
                    var o = document.createElement('option');
                    o.value = 'zone|' + z.id;
                    o.textContent = prefix + z.name;
                    select.appendChild(o);
                    addZoneOptions(z.id, prefix + '\u00a0\u00a0');  // non-breaking spaces for visual indent
                });
        }
        addZoneOptions(null, '\u2014 ');  // em-dash prefix for top-level zones

        // Set selection
        if (existingValue && existingValue !== '|') {
            select.value = existingValue;
        } else {
            select.value = ctx.type === 'zone' ? ('zone|' + ctx.id) : 'yard|';
        }
    }

    // ── House / Floor / Room context ───────────────────────────────────────
    else if (ctx.type === 'house' || ctx.type === 'floor' || ctx.type === 'room') {
        var houseOpt = document.createElement('option');
        houseOpt.value = 'house|';
        houseOpt.textContent = 'House (general)';
        select.appendChild(houseOpt);

        var floorsSnap = await userCol('floors').get();
        var floors = floorsSnap.docs
            .map(function(d) { return Object.assign({ id: d.id }, d.data()); })
            .sort(function(a, b) { return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name); });

        var roomsSnap = await userCol('rooms').get();
        var roomsByFloor = {};
        roomsSnap.forEach(function(doc) {
            var r = Object.assign({ id: doc.id }, doc.data());
            if (!roomsByFloor[r.floorId]) roomsByFloor[r.floorId] = [];
            roomsByFloor[r.floorId].push(r);
        });

        floors.forEach(function(floor) {
            var fo = document.createElement('option');
            fo.value = 'floor|' + floor.id;
            fo.textContent = '\u2014 ' + floor.name;
            select.appendChild(fo);

            (roomsByFloor[floor.id] || [])
                .sort(function(a, b) { return a.name.localeCompare(b.name); })
                .forEach(function(room) {
                    var ro = document.createElement('option');
                    ro.value = 'room|' + room.id;
                    ro.textContent = '\u00a0\u00a0\u2014 ' + room.name;
                    select.appendChild(ro);
                });
        });

        // Set selection
        if (existingValue && existingValue !== '|') {
            select.value = existingValue;
        } else if (ctx.type === 'room')  { select.value = 'room|'  + ctx.id; }
        else if (ctx.type === 'floor') { select.value = 'floor|' + ctx.id; }
        else                           { select.value = 'house|'; }
    }

    // ── Vehicle context ────────────────────────────────────────────────────
    else if (ctx.type === 'vehicle') {
        var vOpt = document.createElement('option');
        vOpt.value = 'vehicle|' + ctx.id;
        vOpt.textContent = ctx.name || 'Vehicle';
        select.appendChild(vOpt);
        select.value = 'vehicle|' + ctx.id;
    }
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

    // Pressing Enter adds a new blank row below and focuses it
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            clAddItemRow('');
            var rows = editor.querySelectorAll('.cl-item-input');
            rows[rows.length - 1].focus();
        }
    });

    var removeBtn = document.createElement('button');
    removeBtn.type        = 'button';
    removeBtn.className   = 'cl-item-remove-btn';
    removeBtn.title       = 'Remove this item';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', function() { row.remove(); });

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
 * Saves the template (add or edit mode).
 * Reads the Location picker to get targetType / targetId / targetName.
 */
async function clSaveTemplate() {
    var modal = document.getElementById('checklistTemplateModal');
    var name  = document.getElementById('clTemplateName').value.trim();
    var items = clGetItemsFromModal();
    var ctx   = clCurrentContext || { type: 'yard' };

    if (!name) {
        alert('Please enter a template name.');
        document.getElementById('clTemplateName').focus();
        return;
    }
    if (items.length === 0) {
        alert('Please add at least one item to the template.');
        return;
    }

    // Resolve target from picker (or hardcode 'life' for Life context)
    var targetType, targetId, targetName;
    if (ctx.type === 'life') {
        targetType = 'life';
        targetId   = null;
        targetName = 'Life';
    } else {
        var select = document.getElementById('clTemplateTarget');
        var parts  = (select.value || 'yard|').split('|');
        targetType = parts[0] || 'yard';
        targetId   = parts[1] || null;

        // Get the human-readable name from the selected option, stripping indent chars
        var selOpt = select.options[select.selectedIndex];
        targetName = selOpt
            ? selOpt.textContent.replace(/^[\u2014\u00a0\s]+/, '').trim()
            : targetType;
    }

    try {
        var mode = modal.dataset.mode;
        if (mode === 'add') {
            await userCol('checklistTemplates').add({
                name:       name,
                items:      items,
                targetType: targetType,
                targetId:   targetId   || null,
                targetName: targetName,
                createdAt:  firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await userCol('checklistTemplates').doc(modal.dataset.editId).update({
                name:       name,
                items:      items,
                targetType: targetType,
                targetId:   targetId   || null,
                targetName: targetName
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
 * Formats an ISO date string or Firestore Timestamp into a short date.
 * @param {string|Object} val
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
        var inputs = document.querySelectorAll('#clTemplateItemsEditor .cl-item-input');
        if (inputs.length) inputs[inputs.length - 1].focus();
    });
});
