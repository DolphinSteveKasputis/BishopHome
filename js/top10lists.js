// ============================================================
// top10lists.js — Top 10 Lists feature (Thoughts section)
// Phases 1–6: accordion list, sort control, create/edit page,
//             drag-and-drop reorder, per-item notes, categories,
//             "By Category" nested accordion.
// ============================================================

// Module-level state
var _t10Lists        = [];       // cached list documents
var _t10Categories   = [];       // [{id, name}] cached categories
var _t10CatsLoaded   = false;    // guard: true once seeding/loading done
var _t10Sort         = 'newest'; // current sort preference
var _t10ExpandId     = null;     // list ID to auto-expand on return from create/edit
var _t10PrevCatValue = '';       // restore select value on Add New cancel

// ──────────────────────────────────────────────────────────
// Page: #top10lists — accordion list with sort control
// ──────────────────────────────────────────────────────────

function loadTop10ListsPage() {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>Top 10 Lists</span>';

    // Wire manage categories link
    var manageLink = document.querySelector('.t10-manage-categories-link a');
    if (manageLink) manageLink.setAttribute('onclick', 't10ToggleManageCategories(); return false;');

    // Load sort pref, ensure categories ready, then fetch lists
    userCol('settings').doc('thoughts').get().then(function(doc) {
        if (doc.exists && doc.data().top10SortPref) {
            _t10Sort = doc.data().top10SortPref;
        }
        var sel = document.getElementById('t10SortSelect');
        if (sel) sel.value = _t10Sort;
        return _t10EnsureCategoriesLoaded();
    }).then(function() {
        _t10FetchAndRender();
    }).catch(function() {
        _t10EnsureCategoriesLoaded().then(function() { _t10FetchAndRender(); });
    });
}

// Returns a Promise that resolves once categories are seeded/loaded
function _t10EnsureCategoriesLoaded() {
    if (_t10CatsLoaded) return Promise.resolve();
    return userCol('settings').doc('thoughts').get().then(function(doc) {
        if (!doc.exists || !doc.data().categoriesSeeded) {
            return _t10SeedCategories();
        }
        return _t10LoadCategories();
    });
}

function _t10SeedCategories() {
    var seeds = ['Books', 'Movies', 'Music'];
    var colRef = userCol('top10categories');
    var batch  = db.batch();
    seeds.forEach(function(name) {
        batch.set(colRef.doc(), {
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    return batch.commit()
        .then(function() {
            return userCol('settings').doc('thoughts').set({ categoriesSeeded: true }, { merge: true });
        })
        .then(function() {
            return _t10LoadCategories();
        });
}

function _t10LoadCategories() {
    return userCol('top10categories').get().then(function(snap) {
        _t10Categories = [];
        snap.forEach(function(doc) {
            _t10Categories.push({ id: doc.id, name: doc.data().name });
        });
        _t10Categories.sort(function(a, b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        _t10CatsLoaded = true;
    });
}

function _t10FetchAndRender() {
    var container = document.getElementById('t10AccordionContainer');
    if (!container) return;
    container.innerHTML = '<p style="color:#999;padding:8px 0;">Loading…</p>';

    userCol('top10lists').get().then(function(snap) {
        _t10Lists = [];
        snap.forEach(function(doc) {
            var d = doc.data();
            d.id  = doc.id;
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

    if (_t10Sort === 'category') {
        _t10RenderCategoryAccordion(container);
    } else {
        _t10RenderFlatAccordion(container);
    }
}

// ──────────────────────────────────────────────────────────
// Flat accordion (newest / oldest / a-z)
// ──────────────────────────────────────────────────────────

function _t10RenderFlatAccordion(container) {
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

// ──────────────────────────────────────────────────────────
// By-Category nested accordion
// ──────────────────────────────────────────────────────────

function _t10RenderCategoryAccordion(container) {
    container.innerHTML = '';

    // Group lists by categoryId
    var groups = {};
    var noneGroup = [];
    _t10Lists.forEach(function(list) {
        var cid = list.categoryId || null;
        if (!cid) {
            noneGroup.push(list);
        } else {
            if (!groups[cid]) groups[cid] = [];
            groups[cid].push(list);
        }
    });

    // None group at top
    if (noneGroup.length > 0) {
        container.appendChild(_t10BuildCategoryGroup(null, 'None', noneGroup));
    }

    // Named categories in alpha order
    _t10Categories.forEach(function(cat) {
        var lists = groups[cat.id];
        if (lists && lists.length > 0) {
            container.appendChild(_t10BuildCategoryGroup(cat.id, cat.name, lists));
        }
    });

    if (container.children.length === 0) {
        container.innerHTML = '<p class="empty-state">No lists yet — create your first one.</p>';
    }

    if (_t10ExpandId) _t10ExpandId = null;
}

function _t10BuildCategoryGroup(catId, catName, lists) {
    // Auto-expand this group if it contains the list to highlight
    var groupHasTarget = _t10ExpandId && lists.some(function(l) { return l.id === _t10ExpandId; });

    var wrapper = document.createElement('div');
    wrapper.className = 'collapsible-section t10-cat-group' + (groupHasTarget ? '' : ' collapsed');
    if (catId) wrapper.dataset.catId = catId;

    var innerHtml = '';
    lists.forEach(function(list) {
        var el = _t10BuildAccordionItem(list);
        if (_t10ExpandId && list.id === _t10ExpandId) {
            el.classList.remove('collapsed');
        }
        innerHtml += el.outerHTML;
    });

    var countLabel = lists.length === 1 ? '1 list' : lists.length + ' lists';

    wrapper.innerHTML =
        '<div class="collapsible-header t10-cat-group-header" ' +
            'onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
            '<span class="t10-cat-group-name">' + escapeHtml(catName) +
                ' <span class="t10-cat-group-count">(' + countLabel + ')</span>' +
            '</span>' +
            '<span class="collapsible-chevron">&#8250;</span>' +
        '</div>' +
        '<div class="collapsible-body t10-cat-group-body">' +
            innerHtml +
        '</div>';
    return wrapper;
}

// ──────────────────────────────────────────────────────────
// Individual accordion item
// ──────────────────────────────────────────────────────────

function _t10GetCategoryName(categoryId) {
    if (!categoryId) return 'None';
    var cat = _t10Categories.find(function(c) { return c.id === categoryId; });
    return cat ? cat.name : 'None';
}

function _t10BuildAccordionItem(list) {
    var items = Array.isArray(list.items) ? list.items : [];

    // Build preview for ranks 1–10, including a note line per item (hidden until toggled)
    var previewHtml = '';
    var anyNotes    = false;
    for (var i = 0; i < 10; i++) {
        var item  = items[i] || {};
        var title = item.title || '';
        var notes = item.notes || '';
        if (notes.trim()) anyNotes = true;
        previewHtml +=
            '<div class="t10-preview-item' + (title ? '' : ' t10-preview-empty') + '">' +
                '<span class="t10-rank">' + (i + 1) + '</span>' +
                '<span class="t10-item-title">' +
                    (title ? escapeHtml(title) : '<em>empty</em>') +
                '</span>' +
                (notes.trim()
                    ? '<div class="t10-preview-note">' + escapeHtml(notes) + '</div>'
                    : '') +
            '</div>';
    }

    var descHtml = list.description
        ? '<p class="t10-description">' + escapeHtml(list.description) + '</p>'
        : '';

    var catName  = _t10GetCategoryName(list.categoryId);
    var catClass = list.categoryId ? 't10-cat-named' : 't10-cat-none';

    // Notes toggle icon only rendered when at least one item has notes;
    // CSS hides it when the accordion is collapsed
    var notesIconHtml = anyNotes
        ? '<button class="t10-list-icon t10-list-notes-btn" title="Toggle item notes" ' +
              'onclick="t10ToggleListNotes(this,event)">&#8801;</button>'
        : '';

    var el = document.createElement('div');
    el.className = 'collapsible-section collapsed t10-accordion-item';
    el.dataset.id = list.id;
    el.innerHTML =
        '<div class="collapsible-header" ' +
            'onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
            '<div class="t10-acc-title">' +
                '<span class="t10-acc-name">' + escapeHtml(list.title || 'Untitled') + '</span>' +
                '<span class="t10-cat-badge ' + catClass + '">' + escapeHtml(catName) + '</span>' +
            '</div>' +
            '<div class="t10-acc-icons">' +
                notesIconHtml +
                '<button class="t10-list-icon t10-list-edit-btn" title="Edit list" ' +
                    'onclick="event.stopPropagation();window.location.hash=\'#top10list-edit/' + list.id + '\'">&#9998;</button>' +
            '</div>' +
            '<span class="collapsible-chevron">&#8250;</span>' +
        '</div>' +
        '<div class="collapsible-body">' +
            descHtml +
            '<div class="t10-preview-list">' + previewHtml + '</div>' +
        '</div>';
    return el;
}

// Toggle visibility of item notes in an accordion list
function t10ToggleListNotes(btn, event) {
    event.stopPropagation();
    var item = btn.closest('.t10-accordion-item');
    if (item) {
        item.classList.toggle('t10-notes-visible');
        btn.classList.toggle('t10-list-notes-btn--active', item.classList.contains('t10-notes-visible'));
    }
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
// Manage Categories panel (inline on #top10lists page)
// ──────────────────────────────────────────────────────────

function t10ToggleManageCategories() {
    var panel = document.getElementById('t10ManageCatPanel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
        _t10RenderManageCatPanel();
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

function _t10RenderManageCatPanel() {
    var panel = document.getElementById('t10ManageCatPanel');
    if (!panel) return;

    var rowsHtml = '';
    if (_t10Categories.length === 0) {
        rowsHtml = '<p class="empty-state" style="margin:8px 0;">No categories yet.</p>';
    } else {
        _t10Categories.forEach(function(cat) {
            rowsHtml +=
                '<div class="t10-manage-cat-row" data-id="' + cat.id + '">' +
                    '<input type="text" class="form-control t10-manage-cat-input" ' +
                        'id="t10CatInput_' + cat.id + '" ' +
                        'value="' + escapeHtml(cat.name) + '" readonly>' +
                    '<button class="btn btn-sm btn-secondary" ' +
                        'onclick="t10ManageEditCat(\'' + cat.id + '\')">Edit</button>' +
                    '<button class="btn btn-sm btn-danger" ' +
                        'onclick="t10ManageDeleteCat(\'' + cat.id + '\')">Delete</button>' +
                '</div>';
        });
    }

    panel.innerHTML =
        '<h4 class="t10-manage-cat-title">Manage Categories</h4>' +
        '<div id="t10ManageCatList">' + rowsHtml + '</div>' +
        '<div class="t10-manage-cat-add">' +
            '<input type="text" class="form-control" id="t10NewCatInput" placeholder="New category name">' +
            '<button class="btn btn-sm btn-primary" onclick="t10ManageAddCat()">Add</button>' +
        '</div>';
}

function t10ManageEditCat(id) {
    var input = document.getElementById('t10CatInput_' + id);
    var row   = input && input.closest('.t10-manage-cat-row');
    if (!input || !row) return;

    input.removeAttribute('readonly');
    input.focus();
    input.select();

    // Swap Edit→Save, Delete→Cancel
    var btns = row.querySelectorAll('button');
    if (btns[0]) {
        btns[0].textContent = 'Save';
        btns[0].className   = 'btn btn-sm btn-primary';
        btns[0].setAttribute('onclick', 't10ManageSaveCat(\'' + id + '\')');
    }
    if (btns[1]) {
        btns[1].textContent = 'Cancel';
        btns[1].className   = 'btn btn-sm btn-secondary';
        btns[1].setAttribute('onclick', 't10ManageCancelCat(\'' + id + '\')');
    }
}

function t10ManageCancelCat(id) {
    _t10RenderManageCatPanel(); // re-render restores read-only state
}

function t10ManageSaveCat(id) {
    var input   = document.getElementById('t10CatInput_' + id);
    if (!input) return;
    var newName = input.value.trim();
    if (!newName) {
        alert('Category name cannot be empty.');
        input.focus();
        return;
    }

    userCol('top10categories').doc(id).update({ name: newName })
        .then(function() {
            var cat = _t10Categories.find(function(c) { return c.id === id; });
            if (cat) cat.name = newName;
            _t10Categories.sort(function(a, b) {
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
            _t10RenderManageCatPanel();
            _t10RenderAccordion(); // refresh badges
        })
        .catch(function(err) {
            console.error('t10ManageSaveCat error:', err);
            alert('Error saving category. Please try again.');
        });
}

function t10ManageDeleteCat(id) {
    var cat = _t10Categories.find(function(c) { return c.id === id; });
    if (!confirm('Delete category "' + (cat ? cat.name : '') + '"? Lists in this category will be moved to None.')) return;

    // Clear categoryId from all affected lists
    var affectedLists = _t10Lists.filter(function(l) { return l.categoryId === id; });
    var promises      = affectedLists.map(function(list) {
        return userCol('top10lists').doc(list.id).update({ categoryId: null });
    });
    promises.push(userCol('top10categories').doc(id).delete());

    Promise.all(promises).then(function() {
        _t10Categories = _t10Categories.filter(function(c) { return c.id !== id; });
        affectedLists.forEach(function(list) { list.categoryId = null; });
        _t10RenderManageCatPanel();
        _t10RenderAccordion();
    }).catch(function(err) {
        console.error('t10ManageDeleteCat error:', err);
        alert('Error deleting category. Please try again.');
    });
}

function t10ManageAddCat() {
    var input = document.getElementById('t10NewCatInput');
    if (!input) return;
    var name = input.value.trim();
    if (!name) {
        alert('Please enter a category name.');
        input.focus();
        return;
    }

    userCol('top10categories').add({
        name: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(ref) {
        _t10Categories.push({ id: ref.id, name: name });
        _t10Categories.sort(function(a, b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        _t10RenderManageCatPanel();
    }).catch(function(err) {
        console.error('t10ManageAddCat error:', err);
        alert('Error adding category. Please try again.');
    });
}

// ──────────────────────────────────────────────────────────
// Page: #top10list-create  /  #top10list-edit/:id
// ──────────────────────────────────────────────────────────

function loadTop10ListCreatePage() {
    _t10SetEditBreadcrumb('New List');
    var title = document.getElementById('t10EditPageTitle');
    if (title) title.textContent = 'New Top 10 List';
    _t10EnsureCategoriesLoaded().then(function() {
        _t10RenderForm(null, null);
    });
}

function loadTop10ListEditPage(id) {
    _t10SetEditBreadcrumb('Edit List');
    var title = document.getElementById('t10EditPageTitle');
    if (title) title.textContent = 'Edit Top 10 List';

    _t10EnsureCategoriesLoaded().then(function() {
        return userCol('top10lists').doc(id).get();
    }).then(function(doc) {
        if (!doc.exists) { window.location.hash = '#top10lists'; return; }
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
    while (items.length < 20) items.push({ title: '', notes: '', url: '' });
    items = items.slice(0, 20);

    // Build category select options
    var currentCatId = (data && data.categoryId) || '';
    var catOptions   = '<option value="">None</option>';
    _t10Categories.forEach(function(cat) {
        var sel = currentCatId === cat.id ? ' selected' : '';
        catOptions += '<option value="' + cat.id + '"' + sel + '>' + escapeHtml(cat.name) + '</option>';
    });
    catOptions += '<option value="__add_new__">+ Add New Category…</option>';

    // Build 20 item rows with "Runners Up" separator after row 10
    var rowsHtml = '';
    for (var i = 0; i < 20; i++) {
        if (i === 10) {
            rowsHtml +=
                '<div class="t10-runners-up-separator"><span>Runners Up</span></div>';
        }
        var item      = items[i] || {};
        var itemTitle = item.title || '';
        var itemNotes = item.notes || '';
        var itemUrl   = item.url   || '';
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
                    'title="' + (hasNotes ? 'Edit note / URL' : 'Add note / URL') + '" ' +
                    'data-notes="' + escapeHtml(itemNotes) + '" ' +
                    'data-url="' + escapeHtml(itemUrl) + '" ' +
                    'onclick="t10ToggleNote(this)">&#9998;</button>' +
                '<div class="t10-note-area hidden">' +
                    '<textarea class="t10-note-textarea" ' +
                        'placeholder="Notes for this item…" ' +
                        'rows="3">' + escapeHtml(itemNotes) + '</textarea>' +
                    '<input type="url" class="t10-note-url-input form-control" ' +
                        'placeholder="URL (optional)" ' +
                        'value="' + escapeHtml(itemUrl) + '">' +
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
        '<div class="form-group">' +
            '<label for="t10CatSelect">Category</label>' +
            '<select id="t10CatSelect" class="form-control" ' +
                'data-prev-value="' + currentCatId + '" ' +
                'onchange="t10HandleCategoryChange(this)">' +
                catOptions +
            '</select>' +
            '<div id="t10AddNewCatArea" class="t10-add-new-cat-area hidden">' +
                '<input type="text" id="t10NewCatNameInput" class="form-control" ' +
                    'placeholder="New category name">' +
                '<div class="t10-add-new-cat-btns">' +
                    '<button type="button" class="btn btn-sm btn-primary" ' +
                        'onclick="t10ConfirmAddCategory()">Add</button>' +
                    '<button type="button" class="btn btn-sm btn-secondary" ' +
                        'onclick="t10CancelAddCategory()">Cancel</button>' +
                '</div>' +
            '</div>' +
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

    // SortableJS drag-and-drop; separator is non-draggable
    var itemList = document.getElementById('t10ItemList');
    if (itemList && window.Sortable) {
        Sortable.create(itemList, {
            handle:    '.drag-handle',
            filter:    '.t10-runners-up-separator',
            animation: 150,
            onEnd:     _t10UpdateRanksAndSeparator
        });
    }
}

// ──────────────────────────────────────────────────────────
// Category select helpers (create/edit form)
// ──────────────────────────────────────────────────────────

function t10HandleCategoryChange(sel) {
    if (sel.value === '__add_new__') {
        _t10PrevCatValue = sel.dataset.prevValue || '';
        var addArea = document.getElementById('t10AddNewCatArea');
        if (addArea) addArea.classList.remove('hidden');
        var newInput = document.getElementById('t10NewCatNameInput');
        if (newInput) { newInput.value = ''; newInput.focus(); }
    } else {
        sel.dataset.prevValue = sel.value;
        var addArea = document.getElementById('t10AddNewCatArea');
        if (addArea) addArea.classList.add('hidden');
    }
}

function t10ConfirmAddCategory() {
    var newInput = document.getElementById('t10NewCatNameInput');
    var name     = newInput ? newInput.value.trim() : '';
    if (!name) {
        alert('Please enter a category name.');
        if (newInput) newInput.focus();
        return;
    }

    userCol('top10categories').add({
        name: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(ref) {
        var newCat = { id: ref.id, name: name };
        _t10Categories.push(newCat);
        _t10Categories.sort(function(a, b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });

        // Insert new option into the select (before "Add New" at the end)
        var sel = document.getElementById('t10CatSelect');
        if (sel) {
            var opt    = document.createElement('option');
            opt.value  = ref.id;
            opt.textContent = name;
            opt.selected    = true;
            sel.insertBefore(opt, sel.lastChild);
            sel.dataset.prevValue = ref.id;
        }

        var addArea = document.getElementById('t10AddNewCatArea');
        if (addArea) addArea.classList.add('hidden');
    }).catch(function(err) {
        console.error('t10ConfirmAddCategory error:', err);
        alert('Error adding category. Please try again.');
    });
}

function t10CancelAddCategory() {
    var sel = document.getElementById('t10CatSelect');
    if (sel) sel.value = _t10PrevCatValue || '';
    var addArea = document.getElementById('t10AddNewCatArea');
    if (addArea) addArea.classList.add('hidden');
}

// ──────────────────────────────────────────────────────────
// Drag-and-drop: re-number ranks + reposition separator
// ──────────────────────────────────────────────────────────

function _t10UpdateRanksAndSeparator() {
    var itemList  = document.getElementById('t10ItemList');
    if (!itemList) return;
    var rows      = Array.from(itemList.querySelectorAll('.t10-item-row'));
    var separator = itemList.querySelector('.t10-runners-up-separator');

    rows.forEach(function(row, i) {
        var rankEl = row.querySelector('.t10-rank-num');
        if (rankEl) rankEl.textContent = i + 1;
    });

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
    var urlInput = noteArea.querySelector('.t10-note-url-input');
    var noteBtn  = row.querySelector('.t10-note-btn');
    var notes    = textarea.value;
    var url      = urlInput ? urlInput.value.trim() : '';

    noteBtn.dataset.notes = notes;
    noteBtn.dataset.url   = url;
    if (notes.trim()) {
        noteBtn.classList.add('t10-note-btn--has-notes');
        noteBtn.title = 'Edit note / URL';
    } else {
        noteBtn.classList.remove('t10-note-btn--has-notes');
        noteBtn.title = 'Add note / URL';
    }
    noteArea.classList.add('hidden');
}

function t10CancelNote(cancelBtn) {
    var row      = cancelBtn.closest('.t10-item-row');
    var noteArea = row.querySelector('.t10-note-area');
    var textarea = noteArea.querySelector('.t10-note-textarea');
    var urlInput = noteArea.querySelector('.t10-note-url-input');
    var noteBtn  = row.querySelector('.t10-note-btn');

    textarea.value = noteBtn.dataset.notes || '';
    if (urlInput) urlInput.value = noteBtn.dataset.url || '';
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

    var catSel = document.getElementById('t10CatSelect');
    var catVal = catSel ? catSel.value : '';
    var catId  = (catVal && catVal !== '__add_new__') ? catVal : null;

    // Collect items from current DOM order
    var items = [];
    document.querySelectorAll('#t10ItemList .t10-item-row').forEach(function(row) {
        var titleEl = row.querySelector('.t10-item-title-input');
        var noteEl  = row.querySelector('.t10-note-textarea');
        var urlEl   = row.querySelector('.t10-note-url-input');
        items.push({
            title: titleEl ? titleEl.value.trim() : '',
            notes: noteEl  ? noteEl.value        : '',
            url:   urlEl   ? urlEl.value.trim()  : ''
        });
    });

    var data = {
        title:       name,
        description: description,
        items:       items,
        categoryId:  catId,
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
