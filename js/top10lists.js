// ============================================================
// top10lists.js — Top 10 Lists feature (Thoughts section)
// Phases 1–3: accordion list, sort control, create/edit page,
//             drag-and-drop reorder, per-item notes.
// ============================================================

// Module-level state
var _t10Lists    = [];       // cached list documents
var _t10Sort     = 'newest'; // current sort preference
var _t10ExpandId = null;     // list ID to auto-expand on return from create/edit

// ──────────────────────────────────────────────────────────
// Page: #top10lists — accordion list with sort control
// ──────────────────────────────────────────────────────────

function loadTop10ListsPage() {
    // Set breadcrumb immediately (before async work)
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>Top 10 Lists</span>';

    // Load persisted sort pref, then fetch lists
    userCol('settings').doc('thoughts').get().then(function(doc) {
        if (doc.exists && doc.data().top10SortPref) {
            _t10Sort = doc.data().top10SortPref;
        }
        var sel = document.getElementById('t10SortSelect');
        if (sel) sel.value = _t10Sort;
        _t10FetchAndRender();
    }).catch(function() {
        _t10FetchAndRender();
    });
}

function _t10FetchAndRender() {
    var container = document.getElementById('t10AccordionContainer');
    if (!container) return;
    container.innerHTML = '<p style="color:#999;padding:8px 0;">Loading…</p>';

    userCol('top10lists').get().then(function(snap) {
        _t10Lists = [];
        snap.forEach(function(doc) {
            var d  = doc.data();
            d.id   = doc.id;
            _t10Lists.push(d);
        });
        _t10RenderAccordion();
    }).catch(function(err) {
        console.error('top10lists fetch error:', err);
        var c = document.getElementById('t10AccordionContainer');
        if (c) c.innerHTML = '<p style="color:red;">Error loading lists.</p>';
    });
}

function _t10RenderAccordion() {
    var container = document.getElementById('t10AccordionContainer');
    if (!container) return;

    if (_t10Lists.length === 0) {
        container.innerHTML = '<p class="empty-state">No lists yet — create your first one.</p>';
        return;
    }

    // Apply sort
    var sorted = _t10Lists.slice();
    if (_t10Sort === 'newest') {
        sorted.sort(function(a, b) {
            return ((b.createdAt && b.createdAt.seconds) || 0) -
                   ((a.createdAt && a.createdAt.seconds) || 0);
        });
    } else if (_t10Sort === 'oldest') {
        sorted.sort(function(a, b) {
            return ((a.createdAt && a.createdAt.seconds) || 0) -
                   ((b.createdAt && b.createdAt.seconds) || 0);
        });
    } else if (_t10Sort === 'az') {
        sorted.sort(function(a, b) {
            return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
        });
    }

    container.innerHTML = '';
    var expanded = false;
    sorted.forEach(function(list) {
        var el = _t10BuildAccordionItem(list);
        if (_t10ExpandId && list.id === _t10ExpandId) {
            el.classList.remove('collapsed');
            expanded = true;
        }
        container.appendChild(el);
    });
    if (expanded) _t10ExpandId = null;
}

function _t10BuildAccordionItem(list) {
    var items = Array.isArray(list.items) ? list.items : [];

    // Preview: ranks 1–10 only (read-only)
    var previewHtml = '';
    for (var i = 0; i < 10; i++) {
        var item  = items[i] || {};
        var title = item.title || '';
        previewHtml +=
            '<div class="t10-preview-item' + (title ? '' : ' t10-preview-empty') + '">' +
                '<span class="t10-rank">' + (i + 1) + '</span>' +
                '<span class="t10-item-title">' +
                    (title ? escapeHtml(title) : '<em>empty</em>') +
                '</span>' +
            '</div>';
    }

    var descHtml = list.description
        ? '<p class="t10-description">' + escapeHtml(list.description) + '</p>'
        : '';

    var el = document.createElement('div');
    el.className = 'collapsible-section collapsed t10-accordion-item';
    el.dataset.id = list.id;
    el.innerHTML =
        '<div class="collapsible-header" ' +
            'onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
            '<div class="t10-acc-title">' +
                '<span class="t10-acc-name">' + escapeHtml(list.title || 'Untitled') + '</span>' +
                '<span class="t10-cat-badge t10-cat-none">None</span>' +
            '</div>' +
            '<span class="collapsible-chevron">&#8250;</span>' +
        '</div>' +
        '<div class="collapsible-body">' +
            descHtml +
            '<div class="t10-preview-list">' + previewHtml + '</div>' +
            '<div class="t10-acc-actions">' +
                '<button class="btn btn-sm" ' +
                    'onclick="event.stopPropagation();' +
                    'window.location.hash=\'#top10list-edit/' + list.id + '\'">Edit</button>' +
            '</div>' +
        '</div>';
    return el;
}

// Called by the Sort button
function t10ApplySort() {
    var sel = document.getElementById('t10SortSelect');
    if (!sel) return;
    _t10Sort = sel.value;
    userCol('settings').doc('thoughts').set({ top10SortPref: _t10Sort }, { merge: true });
    _t10RenderAccordion();
}

// ──────────────────────────────────────────────────────────
// Page: #top10list-create  /  #top10list-edit/:id
// ──────────────────────────────────────────────────────────

function loadTop10ListCreatePage() {
    _t10SetEditBreadcrumb('New List');
    var title = document.getElementById('t10EditPageTitle');
    if (title) title.textContent = 'New Top 10 List';
    _t10RenderForm(null, null);
}

function loadTop10ListEditPage(id) {
    _t10SetEditBreadcrumb('Edit List');
    var title = document.getElementById('t10EditPageTitle');
    if (title) title.textContent = 'Edit Top 10 List';

    userCol('top10lists').doc(id).get().then(function(doc) {
        if (!doc.exists) {
            window.location.hash = '#top10lists';
            return;
        }
        _t10RenderForm(id, doc.data());
    }).catch(function(err) {
        console.error('loadTop10ListEditPage error:', err);
        window.location.hash = '#top10lists';
    });
}

function _t10SetEditBreadcrumb(last) {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<a href="#top10lists">Top 10 Lists</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>' + last + '</span>';
}

function _t10RenderForm(id, data) {
    // Normalise items array to exactly 20 entries
    var items = (data && Array.isArray(data.items)) ? data.items.slice() : [];
    while (items.length < 20) items.push({ title: '', notes: '' });
    items = items.slice(0, 20);

    // Build the 20 item rows with the "Runners Up" separator after row 10
    var rowsHtml = '';
    for (var i = 0; i < 20; i++) {
        if (i === 10) {
            rowsHtml +=
                '<div class="t10-runners-up-separator">' +
                    '<span>Runners Up</span>' +
                '</div>';
        }
        var item      = items[i] || {};
        var itemTitle = item.title || '';
        var itemNotes = item.notes || '';
        var hasNotes  = itemNotes.trim().length > 0;
        rowsHtml +=
            '<div class="t10-item-row" data-index="' + i + '">' +
                '<span class="drag-handle" title="Drag to reorder">⠿</span>' +
                '<span class="t10-rank-num">' + (i + 1) + '</span>' +
                '<input type="text" class="t10-item-title-input" ' +
                    'placeholder="Item ' + (i + 1) + '" ' +
                    'value="' + escapeHtml(itemTitle) + '">' +
                '<button type="button" ' +
                    'class="t10-note-btn' + (hasNotes ? ' t10-note-btn--has-notes' : '') + '" ' +
                    'title="' + (hasNotes ? 'Edit note' : 'Add note') + '" ' +
                    'data-notes="' + escapeHtml(itemNotes) + '" ' +
                    'onclick="t10ToggleNote(this)">&#9998;</button>' +
                '<div class="t10-note-area hidden">' +
                    '<textarea class="t10-note-textarea" ' +
                        'placeholder="Notes for this item…" ' +
                        'rows="3">' + escapeHtml(itemNotes) + '</textarea>' +
                    '<div class="t10-note-btns">' +
                        '<button type="button" class="btn btn-sm btn-primary t10-note-save-btn" ' +
                            'onclick="t10SaveNote(this)">Save</button>' +
                        '<button type="button" class="btn btn-sm btn-secondary t10-note-cancel-btn" ' +
                            'onclick="t10CancelNote(this)">Cancel</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    var formEl = document.getElementById('t10EditFormContainer');
    if (!formEl) return;

    formEl.innerHTML =
        '<div class="form-group">' +
            '<label for="t10NameInput">Name <span style="color:red">*</span></label>' +
            '<input type="text" id="t10NameInput" class="form-control" ' +
                'placeholder="List name" ' +
                'value="' + escapeHtml((data && data.title) || '') + '">' +
        '</div>' +
        '<div class="form-group">' +
            '<label for="t10DescInput">Description</label>' +
            '<textarea id="t10DescInput" class="form-control" rows="2" ' +
                'placeholder="Optional description">' +
                escapeHtml((data && data.description) || '') +
            '</textarea>' +
        '</div>' +
        '<h3 class="t10-list-heading">The List</h3>' +
        '<div id="t10ItemList">' + rowsHtml + '</div>' +
        '<div class="t10-form-actions">' +
            '<button type="button" class="btn btn-primary" ' +
                'onclick="t10SaveList(\'' + (id || '') + '\')">Save</button>' +
            '<button type="button" class="btn btn-secondary" ' +
                'onclick="window.location.hash=\'#top10lists\'">Cancel</button>' +
            (id
                ? '<button type="button" class="btn btn-danger t10-delete-btn" ' +
                      'onclick="t10DeleteList(\'' + id + '\')">Delete List</button>'
                : '') +
        '</div>';

    // Escape key closes any open note area
    formEl.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var open = formEl.querySelector('.t10-note-area:not(.hidden)');
            if (open) open.querySelector('.t10-note-cancel-btn').click();
        }
    });

    // SortableJS: drag-and-drop, separator is non-draggable
    var itemList = document.getElementById('t10ItemList');
    if (itemList && window.Sortable) {
        Sortable.create(itemList, {
            handle:   '.drag-handle',
            filter:   '.t10-runners-up-separator',
            animation: 150,
            onEnd:    _t10UpdateRanksAndSeparator
        });
    }
}

// Re-number ranks and reposition the "Runners Up" separator after every drag
function _t10UpdateRanksAndSeparator() {
    var itemList  = document.getElementById('t10ItemList');
    if (!itemList) return;
    var rows      = Array.from(itemList.querySelectorAll('.t10-item-row'));
    var separator = itemList.querySelector('.t10-runners-up-separator');

    // Renumber 1–20 based on current DOM order
    rows.forEach(function(row, i) {
        var rankEl = row.querySelector('.t10-rank-num');
        if (rankEl) rankEl.textContent = i + 1;
    });

    // Keep separator between rank-10 and rank-11 items
    if (separator && rows.length > 10) {
        rows[10].before(separator);
    }
}

// ──────────────────────────────────────────────────────────
// Note icon: toggle / save / cancel
// ──────────────────────────────────────────────────────────

function t10ToggleNote(btn) {
    var row      = btn.closest('.t10-item-row');
    var noteArea = row.querySelector('.t10-note-area');
    var isOpen   = !noteArea.classList.contains('hidden');

    // Close any other open note areas first
    document.querySelectorAll('.t10-note-area').forEach(function(area) {
        if (area !== noteArea) area.classList.add('hidden');
    });

    if (isOpen) {
        noteArea.classList.add('hidden');
    } else {
        noteArea.classList.remove('hidden');
        noteArea.querySelector('.t10-note-textarea').focus();
    }
}

function t10SaveNote(saveBtn) {
    var row      = saveBtn.closest('.t10-item-row');
    var noteArea = row.querySelector('.t10-note-area');
    var textarea = noteArea.querySelector('.t10-note-textarea');
    var noteBtn  = row.querySelector('.t10-note-btn');
    var notes    = textarea.value;

    // Update saved-notes reference and green indicator
    noteBtn.dataset.notes = notes;
    if (notes.trim()) {
        noteBtn.classList.add('t10-note-btn--has-notes');
        noteBtn.title = 'Edit note';
    } else {
        noteBtn.classList.remove('t10-note-btn--has-notes');
        noteBtn.title = 'Add note';
    }
    noteArea.classList.add('hidden');
}

function t10CancelNote(cancelBtn) {
    var row      = cancelBtn.closest('.t10-item-row');
    var noteArea = row.querySelector('.t10-note-area');
    var textarea = noteArea.querySelector('.t10-note-textarea');
    var noteBtn  = row.querySelector('.t10-note-btn');

    // Restore textarea to last-saved value and close
    textarea.value = noteBtn.dataset.notes || '';
    noteArea.classList.add('hidden');
}

// ──────────────────────────────────────────────────────────
// Save / Delete
// ──────────────────────────────────────────────────────────

function t10SaveList(id) {
    var nameEl = document.getElementById('t10NameInput');
    var name   = nameEl ? nameEl.value.trim() : '';
    if (!name) {
        alert('Please enter a list name.');
        if (nameEl) nameEl.focus();
        return;
    }

    var descEl      = document.getElementById('t10DescInput');
    var description = descEl ? descEl.value.trim() : '';

    // Collect items from current DOM order (textarea holds authoritative note value)
    var items = [];
    document.querySelectorAll('#t10ItemList .t10-item-row').forEach(function(row) {
        var titleEl = row.querySelector('.t10-item-title-input');
        var noteEl  = row.querySelector('.t10-note-textarea');
        items.push({
            title: titleEl ? titleEl.value.trim() : '',
            notes: noteEl  ? noteEl.value        : ''
        });
    });

    var data = {
        title:       name,
        description: description,
        items:       items,
        categoryId:  null,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        userCol('top10lists').doc(id).update(data)
            .then(function() {
                _t10ExpandId = id;
                window.location.hash = '#top10lists';
            })
            .catch(function(err) {
                console.error('t10SaveList update error:', err);
                alert('Error saving. Please try again.');
            });
    } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        userCol('top10lists').add(data)
            .then(function(ref) {
                _t10ExpandId = ref.id;
                window.location.hash = '#top10lists';
            })
            .catch(function(err) {
                console.error('t10SaveList add error:', err);
                alert('Error saving. Please try again.');
            });
    }
}

function t10DeleteList(id) {
    if (!confirm('Delete this list? This cannot be undone.')) return;
    userCol('top10lists').doc(id).delete()
        .then(function() {
            _t10ExpandId = null;
            window.location.hash = '#top10lists';
        })
        .catch(function(err) {
            console.error('t10DeleteList error:', err);
            alert('Error deleting. Please try again.');
        });
}
