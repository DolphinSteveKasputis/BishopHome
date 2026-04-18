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
var _memCurrentTags    = [];     // live tag names for the memory being edited
var _memAllTags        = [];     // all tags from memoryTags collection (alphabetical)

// ============================================================
// LIST PAGE — #memories
// ============================================================

function loadMemoriesPage() {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>Memories</span>';

    var addBtn = document.getElementById('addMemoryBtn');
    if (addBtn) addBtn.onclick = function() { window.location.hash = '#memory-create'; };

    var filterEl = document.getElementById('memoriesInProgressFilter');
    if (filterEl) {
        filterEl.checked = false;
        filterEl.onchange = function() {
            _memRenderList(_memCachedList, filterEl.checked);
        };
    }

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

    _memId       = null;
    _memIsNew    = false;
    _memOriginal = null;
    clearTimeout(_memSaveTimer);

    var input = document.getElementById('memoryCreateTitle');
    if (!input) return;
    input.value    = '';
    input.disabled = false;
    setTimeout(function() { input.focus(); }, 100);

    var cancelBtn = document.getElementById('memoryCreateCancel');
    if (cancelBtn) cancelBtn.onclick = function() { window.location.hash = '#memories'; };

    input.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    };

    input.onblur = function() {
        var title = input.value.trim();
        if (!title) return;
        input.disabled = true;

        // Load all memories to calculate proper sort position (sortDate null → bottom)
        userCol('memories').orderBy('sortOrder', 'asc').get()
            .then(function(snap) {
                var others = snap.docs.map(function(d) {
                    return { sortOrder: d.data().sortOrder || 0, sortDate: d.data().sortDate || null };
                });
                var sortOrder = _memCalcSortOrder(null, others);

                return userCol('memories').add({
                    title:              title,
                    body:               '',
                    dateText:           '',
                    sortDate:           null,
                    sortOrder:          sortOrder,
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
        if (!doc.exists) { window.location.hash = '#memories'; return; }
        var data = doc.data();

        _memOriginal = {
            title:      data.title      || '',
            body:       data.body       || '',
            dateText:   data.dateText   || '',
            sortDate:   data.sortDate   || null,
            sortOrder:  data.sortOrder  || 0,
            location:   data.location   || '',
            inProgress: data.inProgress !== false,
            tags:       (data.tags      || []).slice()
        };
        _memCurrentTags = (data.tags || []).slice();

        _memPopulateEditFields(data);
        _memWireEditHandlers();
        _memLoadAndRenderTags(data.tags || []);
    }).catch(function(err) {
        console.error('loadMemoryEditPage error:', err);
    });
}

function _memPopulateEditFields(data) {
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
        bodyEl.style.height = 'auto';
        bodyEl.style.height = Math.max(bodyEl.scrollHeight, 300) + 'px';
    }
}

function _memWireEditHandlers() {
    var fld = function(id) { return document.getElementById(id); };

    ['memoryEditTitle', 'memoryEditLocation', 'memoryEditBody'].forEach(function(elId) {
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

    // dateText: oninput triggers auto-save; onblur also recalculates sortDate + sortOrder
    var dateEl = fld('memoryEditDateText');
    if (dateEl) {
        dateEl.oninput = _memScheduleSave;
        dateEl.onblur  = _memHandleDateBlur;
    }

    var ipEl = fld('memoryEditInProgress');
    if (ipEl) ipEl.onchange = _memScheduleSave;

    var cancelBtn = fld('memoryEditCancel');
    if (cancelBtn) cancelBtn.onclick = _memHandleCancel;

    var deleteBtn = fld('memoryEditDelete');
    if (deleteBtn) deleteBtn.onclick = _memHandleDelete;
}

// ── Date blur: recalculate sortDate + sortOrder ────────────

function _memHandleDateBlur() {
    if (!_memId) return;
    var dateEl  = document.getElementById('memoryEditDateText');
    var dateText = dateEl ? dateEl.value.trim() : '';
    var newSortDate = _memParseSortDate(dateText);

    // Fetch all other memories to compute correct insertion position
    userCol('memories').orderBy('sortOrder', 'asc').get().then(function(snap) {
        var others = snap.docs
            .filter(function(d) { return d.id !== _memId; })
            .map(function(d) {
                return { sortOrder: d.data().sortOrder || 0, sortDate: d.data().sortDate || null };
            });

        var newSortOrder = _memCalcSortOrder(newSortDate, others);
        clearTimeout(_memSaveTimer);

        var data = _memCollectFields();
        data.sortDate   = newSortDate;
        data.sortOrder  = newSortOrder;
        data.updatedAt  = firebase.firestore.FieldValue.serverTimestamp();

        return userCol('memories').doc(_memId).update(data)
            .then(function() {
                return _memRebalanceIfNeeded(snap.docs, newSortOrder);
            });
    }).catch(function(err) {
        console.error('_memHandleDateBlur error:', err);
    });
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
        title:      (fld('memoryEditTitle')     || {}).value || '',
        body:       (fld('memoryEditBody')      || {}).value || '',
        dateText:   (fld('memoryEditDateText')  || {}).value || '',
        location:   (fld('memoryEditLocation')  || {}).value || '',
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
// M3 — DATE PARSER + SORT ORDER
// ============================================================

var _MEM_MONTHS = {
    january:1, february:2, march:3, april:4, may:5, june:6,
    july:7, august:8, september:9, october:10, november:11, december:12,
    jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8,
    sep:9, oct:10, nov:11, dec:12
};
var _MEM_SEASONS = { spring:'04', summer:'07', fall:'10', autumn:'10', winter:'01' };

function _memParseSortDate(text) {
    if (!text) return null;
    var t = text.toLowerCase().trim().replace(/\s+/g, ' ');
    var m;

    // ISO: 1990-06-15
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

    // Month Day, Year — "june 15, 1990" / "june 15 1990"
    m = t.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m && _MEM_MONTHS[m[1]]) {
        return m[3] + '-' + _memPad(_MEM_MONTHS[m[1]]) + '-' + _memPad(parseInt(m[2]));
    }

    // Named holidays + year
    m = t.match(/christmas\s+(\d{4})/);   if (m) return m[1] + '-12-25';
    m = t.match(/thanksgiving\s+(\d{4})/); if (m) return m[1] + '-11-01';
    m = t.match(/new year'?s?\s+(\d{4})/); if (m) return m[1] + '-01-01';
    m = t.match(/easter\s+(\d{4})/);       if (m) return m[1] + '-04-01';

    // Month + Year — "march 1992"
    m = t.match(/^([a-z]+)\s+(\d{4})$/);
    if (m && _MEM_MONTHS[m[1]]) {
        return m[2] + '-' + _memPad(_MEM_MONTHS[m[1]]) + '-01';
    }

    // Season [of/in] ['YY | YYYY] — "fall of '87" / "summer 1994" / "spring '01"
    m = t.match(/^(spring|summer|fall|autumn|winter)(?:\s+(?:of|in))?\s+(?:'(\d{2})|(\d{4}))$/);
    if (m) {
        var yr = m[3] || _memExpandYear(m[2]);
        return yr + '-' + _MEM_SEASONS[m[1]] + '-01';
    }
    // Season with no year — "last fall", "one summer" → null (can't sort)
    m = t.match(/^(spring|summer|fall|autumn|winter)$/);
    if (m) return null;

    // Decade prefix — "early 80's" / "mid 1980s" / "late 70s"
    m = t.match(/^(early|mid|late)\s+(\d{2,4})(?:'?s)?$/);
    if (m) {
        var n = parseInt(m[2]);
        if (n < 100) n = (n >= 30 ? 1900 : 2000) + n;
        n = Math.floor(n / 10) * 10;
        var offset = m[1] === 'early' ? 0 : m[1] === 'mid' ? 4 : 7;
        return (n + offset) + '-01-01';
    }

    // Year only — "1995"
    if (/^\d{4}$/.test(t)) return t + '-01-01';

    // Two-digit year with apostrophe — "'87"
    m = t.match(/^'(\d{2})$/);
    if (m) return _memExpandYear(m[1]) + '-01-01';

    return null;
}

function _memExpandYear(twoDigit) {
    var n = parseInt(twoDigit);
    return String(n >= 30 ? 1900 + n : 2000 + n);
}

function _memPad(n) {
    return String(n).padStart(2, '0');
}

// Calculate a sortOrder float that slots newSortDate between the right neighbors.
// others: [{sortOrder, sortDate}] sorted by sortOrder asc, excluding the current memory.
function _memCalcSortOrder(newSortDate, others) {
    if (others.length === 0) return 10000;

    // null sortDate goes to the bottom
    if (!newSortDate) {
        return (others[others.length - 1].sortOrder || 0) + 10000;
    }

    // Find first neighbor whose sortDate is after ours (or has no sortDate)
    var insertBefore = -1;
    for (var i = 0; i < others.length; i++) {
        var o = others[i];
        if (!o.sortDate || o.sortDate > newSortDate) {
            insertBefore = i;
            break;
        }
    }

    if (insertBefore === -1) {
        // Goes after everything
        return (others[others.length - 1].sortOrder || 0) + 10000;
    }
    if (insertBefore === 0) {
        // Goes before the first item
        return (others[0].sortOrder || 10000) / 2;
    }
    var prev = others[insertBefore - 1].sortOrder || 0;
    var next = others[insertBefore].sortOrder || (prev + 20000);
    return (prev + next) / 2;
}

// Rebalance sortOrder if the new value landed too close to a neighbor.
function _memRebalanceIfNeeded(snapDocs, newSortOrder) {
    var needsRebalance = snapDocs.some(function(d) {
        return Math.abs((d.data().sortOrder || 0) - newSortOrder) < 0.0001 && d.id !== _memId;
    });
    if (!needsRebalance) return Promise.resolve();

    // Re-read full list in order and assign clean integer multiples
    return userCol('memories').orderBy('sortOrder', 'asc').get().then(function(snap) {
        var batch = db.batch();
        snap.docs.forEach(function(d, i) {
            batch.update(d.ref, { sortOrder: (i + 1) * 10000 });
        });
        return batch.commit();
    });
}

// ============================================================
// M4 — TAGS
// ============================================================

function _memLoadAndRenderTags(activeTags) {
    userCol('memoryTags').orderBy('name', 'asc').get().then(function(snap) {
        _memAllTags = snap.docs.map(function(d) { return d.data().name; });
        _memRenderTagPills(_memAllTags, activeTags);

        // Show the tags section now that it has content
        var section = document.getElementById('memoryTagsSection');
        if (section) section.classList.remove('hidden');
    }).catch(function(err) {
        console.error('_memLoadAndRenderTags error:', err);
    });
}

function _memRenderTagPills(allTags, activeTags) {
    var container = document.getElementById('memoryEditTags');
    if (!container) return;

    var pipsHtml = allTags.map(function(name) {
        var checked = activeTags.indexOf(name) !== -1 ? ' checked' : '';
        var activeClass = checked ? ' active' : '';
        return '<label class="memory-tag-pill' + activeClass + '">' +
            '<input type="checkbox" value="' + _memEscape(name) + '"' + checked + '>' +
            _memEscape(name) +
        '</label>';
    }).join('');

    var addInputHtml =
        '<div class="memory-new-tag-row">' +
            '<input type="text" id="memoryNewTagInput" class="memory-new-tag-input"' +
                ' placeholder="Add tag..." maxlength="40">' +
        '</div>';

    container.innerHTML = '<div class="memory-tag-pills-row">' + pipsHtml + '</div>' + addInputHtml;

    // Wire checkbox changes
    container.querySelectorAll('.memory-tag-pill input').forEach(function(cb) {
        cb.onchange = function() {
            var label = cb.parentElement;
            label.classList.toggle('active', cb.checked);
            _memToggleTag(cb.value, cb.checked);
        };
    });

    // Wire add-tag input
    var newInput = document.getElementById('memoryNewTagInput');
    if (newInput) {
        newInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var name = newInput.value.trim();
                if (name) _memAddNewTag(name);
            }
        };
    }
}

function _memToggleTag(tagName, isChecked) {
    if (isChecked) {
        if (_memCurrentTags.indexOf(tagName) === -1) _memCurrentTags.push(tagName);
    } else {
        _memCurrentTags = _memCurrentTags.filter(function(t) { return t !== tagName; });
    }
    if (_memId) {
        userCol('memories').doc(_memId).update({
            tags:      _memCurrentTags.slice(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function(err) { console.error('Tag save error:', err); });
    }
}

function _memAddNewTag(name) {
    // Normalise to lowercase for consistency
    var normalised = name.toLowerCase().trim();
    if (!normalised) return;

    var newInput = document.getElementById('memoryNewTagInput');

    // Check if tag already exists in allTags
    var exists = _memAllTags.some(function(t) { return t.toLowerCase() === normalised; });

    var saveToFirestore = exists
        ? Promise.resolve()
        : userCol('memoryTags').add({
            name: normalised,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

    saveToFirestore.then(function() {
        if (!exists) _memAllTags.push(normalised);
        _memAllTags.sort();

        // Add to current memory's tags if not already there
        if (_memCurrentTags.indexOf(normalised) === -1) {
            _memCurrentTags.push(normalised);
        }

        _memRenderTagPills(_memAllTags, _memCurrentTags);

        if (_memId) {
            userCol('memories').doc(_memId).update({
                tags:      _memCurrentTags.slice(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(function(err) { console.error('Tag save error:', err); });
        }
        // Re-focus add input for quick multi-tag entry
        var inp = document.getElementById('memoryNewTagInput');
        if (inp) inp.focus();
    }).catch(function(err) {
        console.error('_memAddNewTag error:', err);
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
