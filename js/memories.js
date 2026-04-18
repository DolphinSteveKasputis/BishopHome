// ============================================================
// memories.js — Memories section (Thoughts > Memories)
// ============================================================

// ── Module state ────────────────────────────────────────────
var _memId             = null;   // current memory doc ID
var _memIsNew          = false;  // true while in the create flow
var _memOriginal       = null;   // snapshot of data on page load (for cancel/revert)
var _memSaveTimer      = null;   // debounce handle for auto-save
var _memCachedList     = [];     // last-loaded list (for filter toggle)
var _memSortable       = null;   // SortableJS instance on the list page

// ============================================================
// LIST PAGE — #memories
// ============================================================

function loadMemoriesPage() {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>Memories</span>';

    // Wire add button
    var addBtn = document.getElementById('addMemoryBtn');
    if (addBtn) addBtn.onclick = function() { window.location.hash = '#memory-create'; };

    // Wire in-progress filter toggle
    var filterEl = document.getElementById('memoriesInProgressFilter');
    if (filterEl) {
        filterEl.checked = false;
        filterEl.onchange = function() {
            _memRenderList(_memCachedList, filterEl.checked);
        };
    }

    // Load all memories ordered by sortOrder
    userCol('memories').orderBy('sortOrder', 'asc').get().then(function(snap) {
        _memCachedList = snap.docs.map(function(doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
        var filter = document.getElementById('memoriesInProgressFilter');
        _memRenderList(_memCachedList, filter && filter.checked);
        _memInitDragSort();
    }).catch(function(err) {
        console.error('loadMemoriesPage error:', err);
        var container = document.getElementById('memoriesList');
        if (container) container.innerHTML = '<p class="memory-empty-msg">Error loading memories.</p>';
    });
}

function _memRenderList(memories, filterInProgress) {
    var container = document.getElementById('memoriesList');
    if (!container) return;

    var list = filterInProgress
        ? memories.filter(function(m) { return m.inProgress; })
        : memories;

    if (list.length === 0) {
        container.innerHTML = '<p class="memory-empty-msg">' +
            (filterInProgress ? 'No in-progress memories.' : 'No memories yet. Click "+ New Memory" to add one.') +
            '</p>';
        return;
    }

    container.innerHTML = list.map(function(m) {
        var progressTag = m.inProgress
            ? '<span class="memory-in-progress-tag">In Progress</span>'
            : '';
        var dateSpan = m.dateText
            ? '<span class="memory-list-date">' + _memEscape(m.dateText) + '</span>'
            : '';
        return '<div class="memory-list-row" data-id="' + m.id + '" data-sort-order="' + (m.sortOrder || 0) + '">' +
            '<span class="memory-drag-handle" title="Drag to reorder">&#8942;</span>' +
            '<div class="memory-list-content" onclick="window.location.hash=\'#memory-edit/' + m.id + '\'">' +
                progressTag +
                '<span class="memory-list-title">' + _memEscape(m.title || 'Untitled') + '</span>' +
                dateSpan +
            '</div>' +
        '</div>';
    }).join('');
}

function _memInitDragSort() {
    var list = document.getElementById('memoriesList');
    if (!list || !window.Sortable) return;

    if (_memSortable) { _memSortable.destroy(); _memSortable = null; }

    _memSortable = Sortable.create(list, {
        handle:    '.memory-drag-handle',
        animation: 150,
        onEnd: function(evt) {
            var rows = Array.from(list.querySelectorAll('.memory-list-row'));
            var draggedRow = rows[evt.newIndex];
            if (!draggedRow) return;

            var draggedId  = draggedRow.dataset.id;
            var prevOrder  = evt.newIndex > 0
                ? parseFloat(rows[evt.newIndex - 1].dataset.sortOrder)
                : null;
            var nextOrder  = evt.newIndex < rows.length - 1
                ? parseFloat(rows[evt.newIndex + 1].dataset.sortOrder)
                : null;

            var newOrder;
            if (prevOrder === null && nextOrder === null) {
                newOrder = 10000;
            } else if (prevOrder === null) {
                newOrder = nextOrder / 2;
            } else if (nextOrder === null) {
                newOrder = prevOrder + 10000;
            } else {
                newOrder = (prevOrder + nextOrder) / 2;
            }

            draggedRow.dataset.sortOrder = newOrder;

            // Keep cached list in sync
            var cached = _memCachedList.find(function(m) { return m.id === draggedId; });
            if (cached) cached.sortOrder = newOrder;

            userCol('memories').doc(draggedId).update({ sortOrder: newOrder })
                .catch(function(err) { console.error('sortOrder update error:', err); });
        }
    });
}

// ============================================================
// CREATE PAGE — #memory-create
// ============================================================

function loadMemoryCreatePage() {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<a href="#memories">Memories</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>New Memory</span>';

    // Reset state
    _memId     = null;
    _memIsNew  = false;
    _memOriginal = null;
    clearTimeout(_memSaveTimer);

    var input = document.getElementById('memoryCreateTitle');
    if (!input) return;
    input.value = '';
    setTimeout(function() { input.focus(); }, 100);

    // Wire cancel
    var cancelBtn = document.getElementById('memoryCreateCancel');
    if (cancelBtn) cancelBtn.onclick = function() { window.location.hash = '#memories'; };

    // On Enter: trigger blur
    input.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    };

    // On blur with a title: create the Firestore doc and transition to edit page
    input.onblur = function() {
        var title = input.value.trim();
        if (!title) return;

        input.disabled = true; // prevent double-fire

        // Find the highest existing sortOrder so new memory lands at the bottom
        userCol('memories').orderBy('sortOrder', 'desc').limit(1).get()
            .then(function(snap) {
                var lastOrder = snap.empty ? 0 : (snap.docs[0].data().sortOrder || 0);
                return userCol('memories').add({
                    title:              title,
                    body:               '',
                    dateText:           '',
                    sortDate:           null,
                    sortOrder:          lastOrder + 10000,
                    location:           '',
                    tags:               [],
                    mentionedPersonIds: [],
                    mentionedNames:     [],
                    urls:               [],
                    inProgress:         true,
                    createdAt:          firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt:          firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .then(function(ref) {
                _memIsNew = true;
                history.replaceState(null, '', '#memory-edit/' + ref.id);
                showPage('memory-edit');
                loadMemoryEditPage(ref.id, { isNew: true });
            })
            .catch(function(err) {
                console.error('Error creating memory:', err);
                if (input) input.disabled = false;
                alert('Error creating memory. Please try again.');
            });
    };
}

// ============================================================
// EDIT PAGE — #memory-edit/:id
// ============================================================

function loadMemoryEditPage(id, opts) {
    _memId    = id;
    _memIsNew = (opts && opts.isNew) || false;
    clearTimeout(_memSaveTimer);

    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<a href="#memories">Memories</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span id="memEditCrumbTitle">Memory</span>';

    userCol('memories').doc(id).get().then(function(doc) {
        if (!doc.exists) {
            window.location.hash = '#memories';
            return;
        }
        var data = doc.data();
        // Store original for cancel/revert (shallow copy is enough for scalar fields)
        _memOriginal = {
            title:      data.title      || '',
            body:       data.body       || '',
            dateText:   data.dateText   || '',
            location:   data.location   || '',
            inProgress: data.inProgress !== false
        };

        _memPopulateEditFields(data);
        _memWireEditHandlers();
    }).catch(function(err) {
        console.error('loadMemoryEditPage error:', err);
    });
}

function _memPopulateEditFields(data) {
    // Breadcrumb title span
    var crumbTitle = document.getElementById('memEditCrumbTitle');
    if (crumbTitle) crumbTitle.textContent = data.title || 'Memory';

    var fld = function(id) { return document.getElementById(id); };

    var titleEl = fld('memoryEditTitle');
    if (titleEl) titleEl.value = data.title || '';

    var ipEl = fld('memoryEditInProgress');
    if (ipEl) ipEl.checked = data.inProgress !== false;

    var dateEl = fld('memoryEditDateText');
    if (dateEl) dateEl.value = data.dateText || '';

    var locEl = fld('memoryEditLocation');
    if (locEl) locEl.value = data.location || '';

    var bodyEl = fld('memoryEditBody');
    if (bodyEl) {
        bodyEl.value = data.body || '';
        // Auto-size to content
        bodyEl.style.height = 'auto';
        bodyEl.style.height = Math.max(bodyEl.scrollHeight, 300) + 'px';
    }
}

function _memWireEditHandlers() {
    var fld = function(id) { return document.getElementById(id); };

    // Auto-save on text fields
    ['memoryEditTitle', 'memoryEditDateText', 'memoryEditLocation', 'memoryEditBody'].forEach(function(elId) {
        var el = fld(elId);
        if (!el) return;
        el.oninput = function() {
            if (elId === 'memoryEditBody') _memGrowTextarea(el);
            if (elId === 'memoryEditTitle') {
                var span = document.getElementById('memEditCrumbTitle');
                if (span) span.textContent = el.value.trim() || 'Memory';
            }
            _memScheduleSave();
        };
    });

    // Auto-save on checkbox
    var ipEl = fld('memoryEditInProgress');
    if (ipEl) ipEl.onchange = _memScheduleSave;

    // Cancel
    var cancelBtn = fld('memoryEditCancel');
    if (cancelBtn) cancelBtn.onclick = _memHandleCancel;

    // Delete
    var deleteBtn = fld('memoryEditDelete');
    if (deleteBtn) deleteBtn.onclick = _memHandleDelete;
}

// ── Auto-save ─────────────────────────────────────────────

function _memScheduleSave() {
    clearTimeout(_memSaveTimer);
    _memSaveTimer = setTimeout(_memDoSave, 1500);
}

function _memDoSave() {
    if (!_memId) return;
    var data = _memCollectFields();
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    userCol('memories').doc(_memId).update(data)
        .catch(function(err) { console.error('Memory auto-save error:', err); });
}

function _memCollectFields() {
    var fld = function(id) { return document.getElementById(id); };
    return {
        title:      (fld('memoryEditTitle')    || {}).value || '',
        body:       (fld('memoryEditBody')     || {}).value || '',
        dateText:   (fld('memoryEditDateText') || {}).value || '',
        location:   (fld('memoryEditLocation') || {}).value || '',
        inProgress: !!((fld('memoryEditInProgress') || {}).checked)
    };
}

// ── Cancel ────────────────────────────────────────────────

function _memHandleCancel() {
    clearTimeout(_memSaveTimer);

    if (_memIsNew) {
        if (!confirm('Discard this memory?')) return;
        userCol('memories').doc(_memId).delete()
            .catch(function(err) { console.error('Error discarding new memory:', err); });
        _memId = null;
        window.location.hash = '#memories';
    } else {
        if (!confirm('Discard your changes?')) return;
        var restore = Object.assign({}, _memOriginal, {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        userCol('memories').doc(_memId).update(restore)
            .catch(function(err) { console.error('Error reverting memory:', err); });
        window.location.hash = '#memories';
    }
}

// ── Delete ────────────────────────────────────────────────

function _memHandleDelete() {
    if (!confirm('Permanently delete this memory? This cannot be undone.')) return;
    clearTimeout(_memSaveTimer);

    var id = _memId;
    // Delete all memoryLinks that reference this memory, then delete the memory itself
    userCol('memoryLinks').where('memoryIds', 'array-contains', id).get()
        .then(function(snap) {
            var batch = db.batch();
            snap.docs.forEach(function(linkDoc) { batch.delete(linkDoc.ref); });
            batch.delete(userCol('memories').doc(id));
            return batch.commit();
        })
        .then(function() {
            _memId = null;
            window.location.hash = '#memories';
        })
        .catch(function(err) {
            console.error('Error deleting memory:', err);
            alert('Error deleting memory. Please try again.');
        });
}

// ============================================================
// UTILITIES
// ============================================================

function _memGrowTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 300) + 'px';
}

function _memEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
