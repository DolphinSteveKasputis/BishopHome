// ============================================================
// views.js — My Views section
// ============================================================

// ─────── Seed Data ───────
var _viewsCategorySeed = [
    { name: 'Politics & Society', subs: ['Politics', 'Government', 'Culture', 'Society', 'Media'] },
    { name: 'Personal Beliefs',   subs: ['Religion / Faith', 'Ethics & Morality', 'Philosophy'] },
    { name: 'Life & Family',      subs: ['Parenting', 'Relationships', 'Marriage', 'Family'] },
    { name: 'Practical',          subs: ['Finance & Money', 'Health & Medicine', 'Education', 'Career & Work', 'Technology'] },
    { name: 'Other',              subs: ['Environment', 'Sports', 'Food & Lifestyle'] }
];

function seedViewCategories() {
    userCol('viewCategories').limit(1).get().then(function(snap) {
        if (!snap.empty) return;
        var batch = db.batch();
        _viewsCategorySeed.forEach(function(cat, catIdx) {
            var catRef = userCol('viewCategories').doc();
            batch.set(catRef, { name: cat.name, order: catIdx, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            var generalRef = catRef.collection('subcategories').doc();
            batch.set(generalRef, { name: 'General', order: 0, isDefault: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            cat.subs.forEach(function(subName, subIdx) {
                var subRef = catRef.collection('subcategories').doc();
                batch.set(subRef, { name: subName, order: subIdx + 1, isDefault: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            });
        });
        batch.commit().catch(function(err) { console.error('seedViewCategories error:', err); });
    }).catch(function(err) { console.error('seedViewCategories check error:', err); });
}

// ─────── Module State ───────
var _viewId        = null;   // Firestore ID of the current view (null = new)
var _viewData      = null;   // current view document data
var _viewCatsData  = [];     // [{id, name, order, subs:[{id,name,isDefault,order}]}]
var _viewUrls      = [];     // [{label, url}] — links on the current view
var _viewLongLast  = '';     // last-saved long version (for auto-save change detection)

// ─────── Helpers ───────
function _viewEsc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _viewFormatDate(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Returns true if the given Firestore timestamp is today (calendar day)
function _viewIsToday(ts) {
    if (!ts) return false;
    var d     = ts.toDate ? ts.toDate() : new Date(ts);
    var today = new Date();
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth()    === today.getMonth()    &&
           d.getDate()     === today.getDate();
}

// ─────── Load Category Data ───────
function _viewLoadCatsData() {
    return userCol('viewCategories').orderBy('order').get().then(function(catSnap) {
        var subPromises = catSnap.docs.map(function(catDoc) {
            return catDoc.ref.collection('subcategories').orderBy('order').get()
                .then(function(subSnap) {
                    return {
                        id:    catDoc.id,
                        name:  catDoc.data().name,
                        order: catDoc.data().order,
                        subs:  subSnap.docs.map(function(s) { return Object.assign({ id: s.id }, s.data()); })
                    };
                });
        });
        return Promise.all(subPromises);
    });
}

// ─────── Dropdown Builders ───────
function _viewBuildMajorOptions(cats, selectedCatId) {
    return cats.map(function(cat) {
        return '<option value="' + cat.id + '"' + (cat.id === selectedCatId ? ' selected' : '') + '>' +
            _viewEsc(cat.name) + '</option>';
    }).join('');
}

function _viewBuildSubOptions(subs, selectedSubId) {
    return subs.map(function(sub) {
        return '<option value="' + sub.id + '"' + (sub.id === selectedSubId ? ' selected' : '') + '>' +
            _viewEsc(sub.name) + '</option>';
    }).join('');
}

function _viewBuildSubOptionsForCat(catId, selectedSubId) {
    if (!catId) return '';
    var cat = _viewCatsData.find(function(c) { return c.id === catId; });
    if (!cat) return '';
    return _viewBuildSubOptions(cat.subs, selectedSubId || '');
}

// ─────── Category change handler (shared by new and detail pages) ───────
function _viewOnMajorCatChange(newCatId, saveToFirestore) {
    var subSelect = document.getElementById('viewSubCatSelect');
    if (!subSelect) return;

    if (!newCatId) {
        subSelect.disabled = true;
        subSelect.innerHTML = '';
        if (saveToFirestore && _viewId) _viewSaveCategory();
        _viewCheckNewPageUnlock();
        return;
    }

    var cat = _viewCatsData.find(function(c) { return c.id === newCatId; });
    if (!cat) return;

    var generalSub = cat.subs.find(function(s) { return s.isDefault; }) || cat.subs[0];
    subSelect.disabled = false;
    subSelect.innerHTML = _viewBuildSubOptions(cat.subs, generalSub ? generalSub.id : '');

    if (saveToFirestore && _viewId) _viewSaveCategory();
    _viewCheckNewPageUnlock();
}

// Enables Create button on the new-view page once both title + category are set
function _viewCheckNewPageUnlock() {
    if (_viewId) return;
    var titleEl = document.getElementById('viewTitleInput');
    var majorEl = document.getElementById('viewMajorCatSelect');
    var btn     = document.getElementById('viewCreateBtn');
    if (!btn) return;
    var hasTitle = titleEl && titleEl.value.trim().length > 0;
    var hasCat   = majorEl && majorEl.value;
    btn.disabled = !(hasTitle && hasCat);
}

// ══════════════════════════════════════════════════════════════
// VIEWS LIST PAGE  (#views)
// ══════════════════════════════════════════════════════════════
function loadViewsPage() {
    seedViewCategories();

    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>My Views</span>';

    var searchEl = document.getElementById('viewsSearchInput');
    if (searchEl) { searchEl.value = ''; searchEl.oninput = function() { _viewSearch(this.value); }; }

    var container = document.getElementById('viewsAccordion');
    if (!container) return;
    container.innerHTML = '<p class="views-empty-state">Loading...</p>';

    Promise.all([
        userCol('viewCategories').orderBy('order').get(),
        userCol('views').get()
    ]).then(function(results) {
        var catSnap  = results[0];
        var viewSnap = results[1];

        var tileEl = document.getElementById('viewsCount');
        if (tileEl) tileEl.textContent = 'My Views (' + viewSnap.size + ')';

        var viewsBySubId = {};
        var uncategorized = [];
        viewSnap.docs.forEach(function(doc) {
            var data = doc.data(); data.id = doc.id;
            var subId = data.subcategoryId || null;
            if (!subId) { uncategorized.push(data); }
            else { if (!viewsBySubId[subId]) viewsBySubId[subId] = []; viewsBySubId[subId].push(data); }
        });

        if (catSnap.empty && uncategorized.length === 0) {
            container.innerHTML = '<p class="views-empty-state">No views yet. Click <strong>+ New View</strong> to get started.</p>';
            return;
        }

        var subPromises = catSnap.docs.map(function(catDoc) {
            return userCol('viewCategories').doc(catDoc.id).collection('subcategories').orderBy('order').get()
                .then(function(subSnap) { return { catDoc: catDoc, subDocs: subSnap.docs }; });
        });

        Promise.all(subPromises).then(function(catData) {
            _viewRenderAccordion(container, catData, viewsBySubId, uncategorized);
        });

    }).catch(function(err) {
        console.error('loadViewsPage error:', err);
        container.innerHTML = '<p class="views-empty-state">Error loading views.</p>';
    });
}

function _viewRenderAccordion(container, catData, viewsBySubId, uncategorized) {
    var html = '';
    var anyVisible = false;

    catData.forEach(function(cd) {
        var cat = cd.catDoc.data(); cat.id = cd.catDoc.id;
        var catTotal = 0;
        var subHtml  = '';

        cd.subDocs.forEach(function(subDoc) {
            var sub = subDoc.data(); sub.id = subDoc.id;
            var views = viewsBySubId[sub.id] || [];
            if (views.length === 0) return;
            catTotal += views.length;
            subHtml +=
                '<div class="views-sub-accordion" data-sub-id="' + sub.id + '">' +
                    '<div class="views-sub-header" onclick="_viewToggleSub(this)">' +
                        '<span class="views-chevron">&#9654;</span>' +
                        '<span class="views-sub-name">' + _viewEsc(sub.name) + '</span>' +
                        '<span class="views-sub-count">(' + views.length + ')</span>' +
                    '</div>' +
                    '<div class="views-sub-body hidden">' + views.map(_viewRenderCard).join('') + '</div>' +
                '</div>';
        });

        if (catTotal === 0) return;
        anyVisible = true;
        html +=
            '<div class="views-major-accordion" data-cat-id="' + cat.id + '">' +
                '<div class="views-major-header" onclick="_viewToggleMajor(this)">' +
                    '<span class="views-chevron">&#9654;</span>' +
                    '<span class="views-major-name">' + _viewEsc(cat.name) + '</span>' +
                    '<span class="views-major-count">(' + catTotal + ')</span>' +
                '</div>' +
                '<div class="views-major-body hidden">' + subHtml + '</div>' +
            '</div>';
    });

    if (uncategorized.length > 0) {
        anyVisible = true;
        html +=
            '<div class="views-major-accordion" data-cat-id="uncategorized">' +
                '<div class="views-major-header" onclick="_viewToggleMajor(this)">' +
                    '<span class="views-chevron">&#9654;</span>' +
                    '<span class="views-major-name">Uncategorized</span>' +
                    '<span class="views-major-count">(' + uncategorized.length + ')</span>' +
                '</div>' +
                '<div class="views-major-body hidden">' + uncategorized.map(_viewRenderCard).join('') + '</div>' +
            '</div>';
    }

    container.innerHTML = anyVisible
        ? html
        : '<p class="views-empty-state">No views yet. Click <strong>+ New View</strong> to get started.</p>';
}

function _viewRenderCard(v) {
    var dateStr    = _viewFormatDate(v.currentDate || v.createdAt);
    var shortHtml  = v.shortVersion ? '<p class="views-card-short">' + _viewEsc(v.shortVersion) + '</p>' : '';
    var histBadge  = (v.historyCount && v.historyCount > 0)
        ? '<div class="views-card-footer"><span class="views-history-badge">' +
          v.historyCount + ' previous view' + (v.historyCount !== 1 ? 's' : '') + '</span></div>'
        : '';
    return '<a href="#view/' + v.id + '" class="views-card">' +
        '<div class="views-card-header">' +
            '<span class="views-card-title">' + _viewEsc(v.title || '(Untitled)') + '</span>' +
            (dateStr ? '<span class="views-card-date">' + dateStr + '</span>' : '') +
        '</div>' + shortHtml + histBadge +
    '</a>';
}

function _viewToggleMajor(header) {
    var body = header.nextElementSibling;
    var chev = header.querySelector('.views-chevron');
    var open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    chev.style.transform = open ? '' : 'rotate(90deg)';
}
function _viewToggleSub(header) {
    var body = header.nextElementSibling;
    var chev = header.querySelector('.views-chevron');
    var open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    chev.style.transform = open ? '' : 'rotate(90deg)';
}

function _viewSearch(term) {
    var lc = term.toLowerCase().trim();
    var container = document.getElementById('viewsAccordion');
    if (!container) return;
    var majors = container.querySelectorAll('.views-major-accordion');

    if (!lc) {
        majors.forEach(function(major) {
            major.classList.remove('hidden');
            var body = major.querySelector('.views-major-body');
            var chev = major.querySelector('.views-major-header .views-chevron');
            body.classList.add('hidden');
            if (chev) chev.style.transform = '';
            major.querySelectorAll('.views-sub-accordion').forEach(function(sub) {
                sub.classList.remove('hidden');
                var sb = sub.querySelector('.views-sub-body');
                var sc = sub.querySelector('.views-sub-header .views-chevron');
                if (sb) sb.classList.add('hidden');
                if (sc) sc.style.transform = '';
                sub.querySelectorAll('.views-card').forEach(function(c) { c.classList.remove('hidden'); });
            });
            major.querySelectorAll('.views-major-body > .views-card').forEach(function(c) { c.classList.remove('hidden'); });
        });
        var nr = document.getElementById('viewsNoResults');
        if (nr) nr.remove();
        return;
    }

    var anyHit = false;

    majors.forEach(function(major) {
        var majorHit = false;
        var majorBody = major.querySelector('.views-major-body');
        var majorChev = major.querySelector('.views-major-header .views-chevron');

        major.querySelectorAll('.views-major-body > .views-card').forEach(function(card) {
            var match = _viewCardMatches(card, lc);
            card.classList.toggle('hidden', !match);
            if (match) majorHit = true;
        });

        major.querySelectorAll('.views-sub-accordion').forEach(function(sub) {
            var subHit = false;
            var subBody = sub.querySelector('.views-sub-body');
            var subChev = sub.querySelector('.views-sub-header .views-chevron');
            sub.querySelectorAll('.views-card').forEach(function(card) {
                var match = _viewCardMatches(card, lc);
                card.classList.toggle('hidden', !match);
                if (match) subHit = true;
            });
            sub.classList.toggle('hidden', !subHit);
            if (subHit) { majorHit = true; if (subBody) subBody.classList.remove('hidden'); if (subChev) subChev.style.transform = 'rotate(90deg)'; }
        });

        major.classList.toggle('hidden', !majorHit);
        if (majorHit) { anyHit = true; if (majorBody) majorBody.classList.remove('hidden'); if (majorChev) majorChev.style.transform = 'rotate(90deg)'; }
    });

    // Show or clear the no-results message
    var noResults = document.getElementById('viewsNoResults');
    if (!anyHit) {
        if (!noResults) {
            var msg = document.createElement('p');
            msg.id = 'viewsNoResults';
            msg.className = 'views-empty-state';
            msg.textContent = 'No views match "' + term.trim() + '"';
            container.appendChild(msg);
        }
    } else {
        if (noResults) noResults.remove();
    }
}

function _viewCardMatches(card, lc) {
    var t = (card.querySelector('.views-card-title') || {}).textContent || '';
    var s = (card.querySelector('.views-card-short') || {}).textContent || '';
    return t.toLowerCase().includes(lc) || s.toLowerCase().includes(lc);
}

// ══════════════════════════════════════════════════════════════
// VIEW DETAIL PAGE  (#view/:id  or  #view/new)
// ══════════════════════════════════════════════════════════════
function loadViewDetailPage(id) {
    _viewId   = (id === 'new') ? null : id;
    _viewData = null;
    _viewUrls = [];

    var container = document.getElementById('viewDetailContent');
    if (!container) return;
    container.innerHTML = '<p class="views-empty-state">Loading...</p>';

    _viewLoadCatsData().then(function(cats) {
        _viewCatsData = cats;

        if (_viewId === null) {
            _viewRenderNewPage();
        } else {
            userCol('views').doc(_viewId).get().then(function(doc) {
                if (!doc.exists) {
                    container.innerHTML = '<p class="views-empty-state">View not found. <a href="#views">Back to My Views</a></p>';
                    return;
                }
                _viewData = Object.assign({ id: doc.id }, doc.data());
                _viewUrls = (_viewData.urls || []).map(function(u) { return Object.assign({}, u); });
                _viewRenderExistingPage();
            }).catch(function(err) {
                console.error('loadViewDetailPage error:', err);
                container.innerHTML = '<p class="views-empty-state">Error loading view.</p>';
            });
        }
    });
}

// ── New View Page ──
function _viewRenderNewPage() {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a><span class="separator">&rsaquo;</span>' +
        '<a href="#views">My Views</a><span class="separator">&rsaquo;</span>' +
        '<span>New View</span>';

    var container = document.getElementById('viewDetailContent');
    container.innerHTML =
        '<div class="view-detail-container">' +
            '<h2 class="view-new-heading">New View</h2>' +

            '<div class="view-field-group">' +
                '<label class="view-field-label">Title <span class="view-required">*</span></label>' +
                '<input type="text" id="viewTitleInput" class="form-control" placeholder="What is this view about?">' +
            '</div>' +

            '<div class="view-category-row">' +
                '<div class="view-field-group">' +
                    '<label class="view-field-label">Major Category <span class="view-required">*</span></label>' +
                    '<select id="viewMajorCatSelect" class="form-control">' +
                        '<option value="">— Select —</option>' +
                        _viewBuildMajorOptions(_viewCatsData, '') +
                    '</select>' +
                '</div>' +
                '<div class="view-field-group">' +
                    '<label class="view-field-label">Subcategory</label>' +
                    '<select id="viewSubCatSelect" class="form-control" disabled>' +
                        '<option value="">— Select major first —</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +

            '<div class="view-create-actions">' +
                '<button id="viewCreateBtn" class="btn btn-primary" onclick="_viewCreateNew()" disabled>Create View</button>' +
                '<a href="#views" class="btn btn-secondary">Cancel</a>' +
            '</div>' +
        '</div>';

    // Wire handlers
    var titleEl = document.getElementById('viewTitleInput');
    var majorEl = document.getElementById('viewMajorCatSelect');
    if (titleEl) { titleEl.oninput = _viewCheckNewPageUnlock; titleEl.focus(); }
    if (majorEl) majorEl.onchange = function() { _viewOnMajorCatChange(this.value, false); _viewCheckNewPageUnlock(); };
}

function _viewCreateNew() {
    var titleEl = document.getElementById('viewTitleInput');
    var majorEl = document.getElementById('viewMajorCatSelect');
    var subEl   = document.getElementById('viewSubCatSelect');

    var title = titleEl ? titleEl.value.trim() : '';
    var catId  = majorEl ? majorEl.value        : '';
    var subId  = subEl  ? subEl.value           : '';

    if (!title) { alert('Please enter a title.'); if (titleEl) titleEl.focus(); return; }
    if (!catId) { alert('Please select a major category.'); if (majorEl) majorEl.focus(); return; }

    var btn = document.getElementById('viewCreateBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

    userCol('views').add({
        title:         title,
        shortVersion:  '',
        longVersion:   '',
        urls:          [],
        categoryId:    catId || null,
        subcategoryId: subId || null,
        historyCount:  0,
        currentDate:   firebase.firestore.FieldValue.serverTimestamp(),
        createdAt:     firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:     firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(ref) {
        window.location.hash = '#view/' + ref.id;
    }).catch(function(err) {
        console.error('_viewCreateNew error:', err);
        if (btn) { btn.disabled = false; btn.textContent = 'Create View'; }
        alert('Error creating view. Please try again.');
    });
}

// ── Existing View Detail Page ──
function _viewRenderExistingPage() {
    var d        = _viewData;
    var dateStr  = _viewFormatDate(d.currentDate || d.createdAt);
    var shortVal = d.shortVersion || '';
    var longVal  = d.longVersion  || '';

    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a><span class="separator">&rsaquo;</span>' +
        '<a href="#views">My Views</a><span class="separator">&rsaquo;</span>' +
        '<span id="viewDetailCrumb">' + _viewEsc(d.title || 'View') + '</span>';

    // Build subcategory options for current category
    var subOptions = d.categoryId ? _viewBuildSubOptionsForCat(d.categoryId, d.subcategoryId) : '';

    var container = document.getElementById('viewDetailContent');
    container.innerHTML =
        '<div class="view-detail-container">' +

            // Title row
            '<div class="view-title-row">' +
                '<input type="text" id="viewTitleInput" class="form-control view-title-input" ' +
                    'value="' + _viewEsc(d.title || '') + '" placeholder="Title">' +
                '<button class="btn btn-small btn-secondary" onclick="_viewSaveTitle()">Save</button>' +
            '</div>' +

            // Category row
            '<div class="view-category-row">' +
                '<div class="view-field-group">' +
                    '<label class="view-field-label">Major Category</label>' +
                    '<select id="viewMajorCatSelect" class="form-control" onchange="_viewOnMajorCatChange(this.value, true)">' +
                        '<option value="">— Uncategorized —</option>' +
                        _viewBuildMajorOptions(_viewCatsData, d.categoryId || '') +
                    '</select>' +
                '</div>' +
                '<div class="view-field-group">' +
                    '<label class="view-field-label">Subcategory</label>' +
                    '<select id="viewSubCatSelect" class="form-control" onchange="_viewSaveCategory()"' +
                        (d.categoryId ? '' : ' disabled') + '>' +
                        subOptions +
                    '</select>' +
                '</div>' +
            '</div>' +

            // Action buttons
            (function() {
                var canChange = !_viewIsToday(d.currentDate);
                return '<div class="view-header-actions">' +
                    '<button class="btn btn-secondary"' +
                        (canChange ? ' onclick="_viewOpenChangedModal()"' : ' disabled title="You\'ve already archived this view today"') + '>' +
                        'I\'ve Changed My View</button>' +
                    '<button class="btn btn-danger btn-small" onclick="_viewDeleteView()">Delete View</button>' +
                '</div>';
            })() +

            // Short Version
            '<div class="view-field-section">' +
                '<div class="view-field-label-row">' +
                    '<label class="view-field-label">Short Version</label>' +
                    '<span class="view-char-counter" id="viewShortCounter">' + shortVal.length + ' / 500</span>' +
                '</div>' +
                '<textarea id="viewShortInput" class="form-control" rows="3" maxlength="500" ' +
                    'placeholder="Brief summary of your stance (optional)...">' +
                    _viewEsc(shortVal) + '</textarea>' +
                '<button class="btn btn-small btn-secondary view-save-btn" onclick="_viewSaveShort()">Save</button>' +
            '</div>' +

            // Long Version
            '<div class="view-field-section">' +
                '<div class="view-field-label-row">' +
                    '<label class="view-field-label">Long Version</label>' +
                    (dateStr ? '<span class="view-current-date">Current since ' + dateStr + '</span>' : '') +
                '</div>' +
                '<textarea id="viewLongInput" class="form-control view-long-textarea" ' +
                    'placeholder="Your full viewpoint...">' +
                    _viewEsc(longVal) + '</textarea>' +
                '<button class="btn btn-small btn-secondary view-save-btn" onclick="_viewSaveLong()">Save</button>' +
            '</div>' +

            // Links
            '<div class="view-field-section">' +
                '<label class="view-field-label">Links</label>' +
                '<div id="viewUrlsList"></div>' +
                '<button class="btn btn-small btn-secondary view-add-link-btn" onclick="_viewOpenUrlForm(-1)">+ Add Link</button>' +
            '</div>' +

            // Previous Views
            '<div class="view-field-section">' +
                '<label class="view-field-label">Previous Views</label>' +
                '<div id="viewHistoryList"><p class="view-history-empty">Loading...</p></div>' +
            '</div>' +

        '</div>';

    _viewLongLast = longVal;
    _viewWireDetailHandlers();
    _viewRenderUrls();
    _viewLoadHistory();
}

function _viewWireDetailHandlers() {
    var shortEl = document.getElementById('viewShortInput');
    var longEl  = document.getElementById('viewLongInput');

    if (shortEl) shortEl.oninput = function() {
        var c = document.getElementById('viewShortCounter');
        if (c) c.textContent = this.value.length + ' / 500';
    };

    if (longEl) {
        longEl.onblur = function() {
            if (this.value !== _viewLongLast) _viewSaveLong();
        };
    }
}

// ─────── Save Functions ───────
function _viewSaveTitle() {
    if (!_viewId) return;
    var el    = document.getElementById('viewTitleInput');
    var title = el ? el.value.trim() : '';
    if (!title) { alert('Title cannot be empty.'); return; }
    userCol('views').doc(_viewId).update({
        title:     title,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        var crumb = document.getElementById('viewDetailCrumb');
        if (crumb) crumb.textContent = title;
    }).catch(function(err) { console.error('_viewSaveTitle error:', err); });
}

function _viewSaveShort() {
    if (!_viewId) return;
    var el  = document.getElementById('viewShortInput');
    var val = el ? el.value : '';
    userCol('views').doc(_viewId).update({
        shortVersion: val,
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(err) { console.error('_viewSaveShort error:', err); });
}

function _viewSaveLong() {
    if (!_viewId) return;
    var el  = document.getElementById('viewLongInput');
    var val = el ? el.value : '';
    _viewLongLast = val;
    userCol('views').doc(_viewId).update({
        longVersion: val,
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(err) { console.error('_viewSaveLong error:', err); });
}

function _viewSaveCategory() {
    if (!_viewId) return;
    var majorEl = document.getElementById('viewMajorCatSelect');
    var subEl   = document.getElementById('viewSubCatSelect');
    var catId   = majorEl ? majorEl.value : '';
    var subId   = subEl   ? subEl.value   : '';
    userCol('views').doc(_viewId).update({
        categoryId:    catId || null,
        subcategoryId: subId || null,
        updatedAt:     firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(err) { console.error('_viewSaveCategory error:', err); });
}

function _viewDeleteView() {
    if (!_viewId) return;
    if (!confirm('Delete this view and all its history? This cannot be undone.')) return;
    userCol('views').doc(_viewId).collection('history').get().then(function(snap) {
        var batch = db.batch();
        snap.docs.forEach(function(d) { batch.delete(d.ref); });
        batch.delete(userCol('views').doc(_viewId));
        return batch.commit();
    }).then(function() {
        window.location.hash = '#views';
    }).catch(function(err) { console.error('_viewDeleteView error:', err); });
}

// ══════════════════════════════════════════════════════════════
// "I'VE CHANGED MY VIEW" FLOW
// ══════════════════════════════════════════════════════════════
function _viewOpenChangedModal() {
    var shortEl = document.getElementById('viewShortInput');
    var longEl  = document.getElementById('viewLongInput');
    document.getElementById('viewChangedShort').value  = shortEl ? shortEl.value : '';
    document.getElementById('viewChangedLong').value   = longEl  ? longEl.value  : '';
    document.getElementById('viewChangedPrompt').value = '';
    openModal('viewChangedModal');
}

function _viewSaveChangedView() {
    if (!_viewId) return;
    var shortVal  = document.getElementById('viewChangedShort').value;
    var longVal   = document.getElementById('viewChangedLong').value;
    var promptVal = (document.getElementById('viewChangedPrompt').value || '').trim();

    var saveBtn = document.getElementById('viewChangedSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    var histRef = userCol('views').doc(_viewId).collection('history').doc();
    var batch   = db.batch();
    batch.set(histRef, {
        shortVersion: shortVal,
        longVersion:  longVal,
        prompt:       promptVal || null,
        archivedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.update(userCol('views').doc(_viewId), {
        currentDate:  firebase.firestore.FieldValue.serverTimestamp(),
        historyCount: firebase.firestore.FieldValue.increment(1),
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.commit().then(function() {
        closeModal('viewChangedModal');
        // Reload the detail page fresh so button state and history list update correctly
        loadViewDetailPage(_viewId);
    }).catch(function(err) {
        console.error('_viewSaveChangedView error:', err);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Archive & Continue'; }
    });
}

// ══════════════════════════════════════════════════════════════
// HISTORY LIST  (on detail page)
// ══════════════════════════════════════════════════════════════
function _viewLoadHistory() {
    var container = document.getElementById('viewHistoryList');
    if (!container) return;

    userCol('views').doc(_viewId).collection('history')
        .orderBy('archivedAt', 'desc').get()
        .then(function(snap) {
            if (snap.empty) {
                container.innerHTML = '<p class="view-history-empty">No previous views yet.</p>';
                return;
            }
            var html = snap.docs.map(function(doc) {
                var dateStr = _viewFormatDate(doc.data().archivedAt);
                return '<div class="view-history-row">' +
                    '<a href="#view-history/' + _viewId + '/' + doc.id + '" class="view-history-link">' +
                        dateStr + '</a>' +
                    '<button class="view-url-btn" title="Delete" ' +
                        'onclick="_viewDeleteHistoryEntry(\'' + doc.id + '\')">&#x2715;</button>' +
                '</div>';
            }).join('');
            container.innerHTML = html;
        }).catch(function(err) {
            console.error('_viewLoadHistory error:', err);
            container.innerHTML = '<p class="view-history-empty">Error loading history.</p>';
        });
}

function _viewDeleteHistoryEntry(historyId) {
    if (!confirm('Delete this historical viewpoint? This cannot be undone.')) return;
    var batch = db.batch();
    batch.delete(userCol('views').doc(_viewId).collection('history').doc(historyId));
    batch.update(userCol('views').doc(_viewId), {
        historyCount: firebase.firestore.FieldValue.increment(-1),
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.commit().then(function() {
        _viewLoadHistory();
    }).catch(function(err) {
        console.error('_viewDeleteHistoryEntry error:', err);
    });
}

// ══════════════════════════════════════════════════════════════
// LINKS SECTION  (same pattern as Memories)
// ══════════════════════════════════════════════════════════════
function _viewRenderUrls() {
    var container = document.getElementById('viewUrlsList');
    if (!container) return;

    if (_viewUrls.length === 0) { container.innerHTML = ''; return; }

    var html = _viewUrls.map(function(entry, i) {
        var display = _viewEsc(entry.label || entry.url || '(no URL)');
        var href    = _viewEsc(entry.url || '');
        return '<div class="view-url-row" data-index="' + i + '">' +
            '<a href="' + href + '" target="_blank" rel="noopener" class="view-url-link">&#128279; ' + display + '</a>' +
            '<button class="view-url-btn" title="Edit" data-index="' + i + '" onclick="_viewOpenUrlForm(' + i + ')">&#9998;</button>' +
            '<button class="view-url-btn" title="Remove" data-index="' + i + '" onclick="_viewDeleteUrl(' + i + ')">&times;</button>' +
        '</div>';
    }).join('');

    container.innerHTML = html;
}

function _viewDeleteUrl(index) {
    _viewUrls.splice(index, 1);
    _viewRenderUrls();
    _viewSaveUrls();
}

function _viewOpenUrlForm(index) {
    var container = document.getElementById('viewUrlsList');
    if (!container) return;

    var existing = index >= 0 ? _viewUrls[index] : { label: '', url: '' };
    var formHtml =
        '<div class="view-url-form" id="viewUrlForm">' +
            '<input type="url" id="viewUrlInput" class="form-control" placeholder="https://..." ' +
                'value="' + _viewEsc(existing.url) + '">' +
            '<input type="text" id="viewUrlLabelInput" class="form-control" placeholder="Label (optional)" ' +
                'value="' + _viewEsc(existing.label) + '">' +
            '<div class="view-url-form-btns">' +
                '<button class="btn btn-small btn-primary" onclick="_viewSubmitUrlForm(' + index + ')">Save</button>' +
                '<button class="btn btn-small btn-secondary" onclick="_viewRenderUrls()">Cancel</button>' +
            '</div>' +
        '</div>';

    if (index >= 0) {
        var rows = container.querySelectorAll('.view-url-row');
        if (rows[index]) { rows[index].outerHTML = formHtml; }
        else { container.insertAdjacentHTML('beforeend', formHtml); }
    } else {
        container.insertAdjacentHTML('beforeend', formHtml);
    }

    var urlInput = document.getElementById('viewUrlInput');
    if (urlInput) urlInput.focus();
}

function _viewSubmitUrlForm(index) {
    var urlInput   = document.getElementById('viewUrlInput');
    var labelInput = document.getElementById('viewUrlLabelInput');
    var url   = urlInput   ? urlInput.value.trim()   : '';
    var label = labelInput ? labelInput.value.trim() : '';
    if (!url) { if (urlInput) urlInput.focus(); return; }
    if (index >= 0) { _viewUrls[index] = { label: label, url: url }; }
    else            { _viewUrls.push({ label: label, url: url }); }
    _viewRenderUrls();
    _viewSaveUrls();
}

function _viewSaveUrls() {
    if (!_viewId) return;
    userCol('views').doc(_viewId).update({
        urls:      _viewUrls.slice(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(err) { console.error('_viewSaveUrls error:', err); });
}

// ══════════════════════════════════════════════════════════════
// STUB PAGES  (built in later phases)
// ══════════════════════════════════════════════════════════════
function loadViewHistoryPage(viewId, historyId) {
    var container = document.getElementById('viewHistoryContent');
    if (!container) return;
    container.innerHTML = '<p class="views-empty-state">Loading...</p>';

    Promise.all([
        userCol('views').doc(viewId).get(),
        userCol('views').doc(viewId).collection('history').doc(historyId).get()
    ]).then(function(results) {
        var viewDoc    = results[0];
        var histDoc    = results[1];

        if (!viewDoc.exists || !histDoc.exists) {
            container.innerHTML = '<p class="views-empty-state">Entry not found. <a href="#views">Back to My Views</a></p>';
            return;
        }

        var vd      = viewDoc.data();
        var hd      = histDoc.data();
        var title   = vd.title || 'Untitled';
        var dateStr = _viewFormatDate(hd.archivedAt);

        var crumb = document.getElementById('breadcrumbBar');
        if (crumb) crumb.innerHTML =
            '<a href="#thoughts">Thoughts</a><span class="separator">&rsaquo;</span>' +
            '<a href="#views">My Views</a><span class="separator">&rsaquo;</span>' +
            '<a href="#view/' + viewId + '">' + _viewEsc(title) + '</a>' +
            '<span class="separator">&rsaquo;</span>' +
            '<span>' + _viewEsc(dateStr) + '</span>';

        container.innerHTML =
            '<div class="view-detail-container">' +

                '<div class="view-history-page-header">' +
                    '<h2 class="view-new-heading">' + _viewEsc(title) + '</h2>' +
                    '<span class="view-history-page-date">Archived ' + _viewEsc(dateStr) + '</span>' +
                '</div>' +

                '<div class="view-history-badge-readonly">Past View — Read Only</div>' +

                (hd.prompt ?
                    '<div class="view-field-section">' +
                        '<label class="view-field-label">What prompted this change?</label>' +
                        '<p class="view-history-prompt">' + _viewEsc(hd.prompt) + '</p>' +
                    '</div>' : '') +

                '<div class="view-field-section">' +
                    '<label class="view-field-label">Short Version</label>' +
                    (hd.shortVersion
                        ? '<p class="view-history-text">' + _viewEsc(hd.shortVersion) + '</p>'
                        : '<p class="view-history-empty">No short version recorded.</p>') +
                '</div>' +

                '<div class="view-field-section">' +
                    '<label class="view-field-label">Long Version</label>' +
                    (hd.longVersion
                        ? '<div class="view-history-long">' + _viewEsc(hd.longVersion).replace(/\n/g, '<br>') + '</div>'
                        : '<p class="view-history-empty">No long version recorded.</p>') +
                '</div>' +

                '<div class="view-history-actions">' +
                    '<a href="#view/' + viewId + '" class="btn btn-secondary">&larr; Back</a>' +
                    '<button class="btn btn-danger" ' +
                        'onclick="_viewDeleteHistoryPage(\'' + viewId + '\', \'' + historyId + '\')">' +
                        'Delete This Entry</button>' +
                '</div>' +

            '</div>';
    }).catch(function(err) {
        console.error('loadViewHistoryPage error:', err);
        container.innerHTML = '<p class="views-empty-state">Error loading entry.</p>';
    });
}

function _viewDeleteHistoryPage(viewId, historyId) {
    if (!confirm('Delete this historical viewpoint? This cannot be undone.')) return;
    var batch = db.batch();
    batch.delete(userCol('views').doc(viewId).collection('history').doc(historyId));
    batch.update(userCol('views').doc(viewId), {
        historyCount: firebase.firestore.FieldValue.increment(-1),
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.commit().then(function() {
        window.location.hash = '#view/' + viewId;
    }).catch(function(err) {
        console.error('_viewDeleteHistoryPage error:', err);
    });
}

// ══════════════════════════════════════════════════════════════
// CATEGORY MAINTENANCE PAGE  (#views-categories)
// Phases 9 + 10: CRUD + drag-and-drop reorder
// ══════════════════════════════════════════════════════════════

var _catPageData     = [];   // [{id, name, order, subs:[{id,name,isDefault,order}]}]
var _catDragType     = null; // 'major' or 'sub'
var _catDragId       = null; // ID of the item being dragged
var _catDragParentId = null; // catId context for sub drags
var _catDragOverEl   = null; // element highlighted as drop target

function loadViewsCategoriesPage() {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a><span class="separator">&rsaquo;</span>' +
        '<a href="#views">My Views</a><span class="separator">&rsaquo;</span>' +
        '<span>Manage Categories</span>';

    var container = document.getElementById('viewsCategoriesContent');
    if (!container) return;
    container.innerHTML = '<p class="views-empty-state">Loading...</p>';

    _viewLoadCatsData().then(function(cats) {
        _catPageData = cats;
        _viewCatRenderPage();
    }).catch(function(err) {
        console.error('loadViewsCategoriesPage error:', err);
        container.innerHTML = '<p class="views-empty-state">Error loading categories.</p>';
    });
}

function _viewCatRenderPage() {
    var container = document.getElementById('viewsCategoriesContent');
    if (!container) return;

    var html = '<div class="vcat-page"><div id="vcatMajorList">';
    _catPageData.forEach(function(cat) { html += _viewCatMajorHtml(cat); });
    html += '</div>' +
        '<button class="btn btn-secondary vcat-add-major-btn" onclick="_viewCatAddMajor()">+ Add Major Category</button>' +
        '</div>';

    container.innerHTML = html;
}

function _viewCatMajorHtml(cat) {
    var cid = cat.id;
    return (
        '<div class="vcat-major-row" data-cat-id="' + cid + '" draggable="true" ' +
            'ondragstart="_catOnDragStart(event,this,\'major\',\'' + cid + '\',null)" ' +
            'ondragover="_catOnDragOver(event,this,\'major\',null)" ' +
            'ondrop="_catOnDrop(event,this,\'major\',\'' + cid + '\',null)" ' +
            'ondragend="_catOnDragEnd(event,this)">' +
            '<span class="vcat-drag-handle" title="Drag to reorder">&#8942;</span>' +
            '<span class="vcat-row-name" id="vcatMajorName_' + cid + '">' + _viewEsc(cat.name) + '</span>' +
            '<div class="vcat-row-actions">' +
                '<button class="vcat-btn" onclick="_viewCatRename(\'major\',\'' + cid + '\',null)">Rename</button>' +
                '<button class="vcat-btn vcat-btn-danger" onclick="_viewCatDeleteMajor(\'' + cid + '\')">Delete</button>' +
            '</div>' +
        '</div>' +
        '<div class="vcat-sub-list" data-parent-id="' + cid + '">' +
            cat.subs.map(function(sub) { return _viewCatSubHtml(cid, sub); }).join('') +
            '<button class="btn btn-small btn-secondary vcat-add-sub-btn" onclick="_viewCatAddSub(\'' + cid + '\')">+ Add Subcategory</button>' +
        '</div>'
    );
}

function _viewCatSubHtml(catId, sub) {
    var sid  = sub.id;
    var drag = !sub.isDefault
        ? ' draggable="true"' +
          ' ondragstart="_catOnDragStart(event,this,\'sub\',\'' + sid + '\',\'' + catId + '\')"' +
          ' ondragover="_catOnDragOver(event,this,\'sub\',\'' + catId + '\')"' +
          ' ondrop="_catOnDrop(event,this,\'sub\',\'' + sid + '\',\'' + catId + '\')"' +
          ' ondragend="_catOnDragEnd(event,this)"'
        : '';
    return (
        '<div class="vcat-sub-row' + (sub.isDefault ? ' vcat-general-row' : '') + '"' +
            ' data-sub-id="' + sid + '" data-cat-id="' + catId + '"' + drag + '>' +
            (!sub.isDefault
                ? '<span class="vcat-drag-handle" title="Drag to reorder">&#8942;</span>'
                : '<span class="vcat-drag-spacer"></span>') +
            '<span class="vcat-row-name" id="vcatSubName_' + sid + '">' + _viewEsc(sub.name) + '</span>' +
            (sub.isDefault ? '<span class="vcat-default-badge">default</span>' : '') +
            '<div class="vcat-row-actions">' +
                '<button class="vcat-btn" onclick="_viewCatRename(\'sub\',\'' + catId + '\',\'' + sid + '\')">Rename</button>' +
                (!sub.isDefault
                    ? '<button class="vcat-btn vcat-btn-danger" onclick="_viewCatDeleteSub(\'' + catId + '\',\'' + sid + '\')">Delete</button>'
                    : '') +
            '</div>' +
        '</div>'
    );
}

// ── Add major category ──
function _viewCatAddMajor() {
    var name = prompt('New major category name:');
    if (!name || !name.trim()) return;
    name = name.trim();
    var maxOrd = _catPageData.length
        ? Math.max.apply(null, _catPageData.map(function(c) { return c.order || 0; })) + 1 : 0;
    var catRef = userCol('viewCategories').doc();
    var genRef = catRef.collection('subcategories').doc();
    var batch  = db.batch();
    batch.set(catRef, { name: name, order: maxOrd, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    batch.set(genRef, { name: 'General', order: 0, isDefault: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    batch.commit().then(function() { loadViewsCategoriesPage(); })
        .catch(function(err) { console.error('_viewCatAddMajor error:', err); });
}

// ── Add subcategory ──
function _viewCatAddSub(catId) {
    var name = prompt('New subcategory name:');
    if (!name || !name.trim()) return;
    name = name.trim();
    var cat    = _catPageData.find(function(c) { return c.id === catId; });
    var maxOrd = (cat && cat.subs.length)
        ? Math.max.apply(null, cat.subs.map(function(s) { return s.order || 0; })) + 1 : 1;
    userCol('viewCategories').doc(catId).collection('subcategories').add({
        name: name, order: maxOrd, isDefault: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() { loadViewsCategoriesPage(); })
        .catch(function(err) { console.error('_viewCatAddSub error:', err); });
}

// ── Inline rename (major or sub) ──
function _viewCatRename(type, catId, subId) {
    var elemId   = type === 'major' ? 'vcatMajorName_' + catId : 'vcatSubName_' + subId;
    var nameEl   = document.getElementById(elemId);
    if (!nameEl) return;
    var original = nameEl.textContent;

    var input = document.createElement('input');
    input.type = 'text';
    input.value = original;
    input.className = 'form-control vcat-rename-input';
    nameEl.replaceWith(input);
    input.focus(); input.select();

    function restore() {
        var span = document.createElement('span');
        span.id = elemId; span.className = 'vcat-row-name'; span.textContent = original;
        if (input.parentNode) input.replaceWith(span);
    }
    function save() {
        var val = input.value.trim();
        if (!val) { restore(); return; }
        var span = document.createElement('span');
        span.id = elemId; span.className = 'vcat-row-name'; span.textContent = val;
        input.onblur = null;
        if (input.parentNode) input.replaceWith(span);
        if (type === 'major') {
            userCol('viewCategories').doc(catId).update({ name: val })
                .catch(function(e) { console.error('rename major:', e); });
            var c = _catPageData.find(function(c) { return c.id === catId; });
            if (c) c.name = val;
        } else {
            userCol('viewCategories').doc(catId).collection('subcategories').doc(subId).update({ name: val })
                .catch(function(e) { console.error('rename sub:', e); });
            var c2 = _catPageData.find(function(c) { return c.id === catId; });
            if (c2) { var s = c2.subs.find(function(s) { return s.id === subId; }); if (s) s.name = val; }
        }
    }
    input.onblur = save;
    input.onkeydown = function(e) {
        if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.onblur = null; restore(); }
    };
}

// ── Delete major category ──
function _viewCatDeleteMajor(catId) {
    userCol('views').where('categoryId', '==', catId).limit(1).get().then(function(snap) {
        if (!snap.empty) {
            alert('This category still has views assigned to it. Move or delete those views first.');
            return;
        }
        var cat = _catPageData.find(function(c) { return c.id === catId; });
        if (!confirm('Delete "' + (cat ? cat.name : 'this category') + '" and all its subcategories? This cannot be undone.')) return;
        userCol('viewCategories').doc(catId).collection('subcategories').get().then(function(subSnap) {
            var batch = db.batch();
            subSnap.docs.forEach(function(d) { batch.delete(d.ref); });
            batch.delete(userCol('viewCategories').doc(catId));
            return batch.commit();
        }).then(function() { loadViewsCategoriesPage(); })
          .catch(function(err) { console.error('_viewCatDeleteMajor error:', err); });
    }).catch(function(err) { console.error('_viewCatDeleteMajor check:', err); });
}

// ── Delete subcategory ──
function _viewCatDeleteSub(catId, subId) {
    userCol('views').where('subcategoryId', '==', subId).get().then(function(snap) {
        var cat     = _catPageData.find(function(c) { return c.id === catId; });
        var sub     = cat ? cat.subs.find(function(s) { return s.id === subId; }) : null;
        var general = cat ? cat.subs.find(function(s) { return s.isDefault; }) : null;
        var subName = sub ? sub.name : 'this subcategory';
        var msg = snap.size > 0
            ? 'Delete "' + subName + '"? ' + snap.size + ' view' + (snap.size !== 1 ? 's' : '') + ' will be moved to General. Continue?'
            : 'Delete "' + subName + '"?';
        if (!confirm(msg)) return;
        var batch = db.batch();
        if (snap.size > 0 && general) {
            snap.docs.forEach(function(d) { batch.update(d.ref, { subcategoryId: general.id }); });
        }
        batch.delete(userCol('viewCategories').doc(catId).collection('subcategories').doc(subId));
        batch.commit().then(function() { loadViewsCategoriesPage(); })
            .catch(function(err) { console.error('_viewCatDeleteSub error:', err); });
    }).catch(function(err) { console.error('_viewCatDeleteSub check:', err); });
}

// ── Drag-and-drop handlers ──
function _catOnDragStart(event, el, type, id, parentId) {
    _catDragType = type; _catDragId = id; _catDragParentId = parentId;
    event.dataTransfer.effectAllowed = 'move';
    setTimeout(function() { el.classList.add('vcat-dragging'); }, 0);
}

function _catOnDragOver(event, el, type, parentId) {
    if (type !== _catDragType) return;
    if (type === 'sub' && parentId !== _catDragParentId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (_catDragOverEl && _catDragOverEl !== el) _catDragOverEl.classList.remove('vcat-drag-over');
    _catDragOverEl = el;
    el.classList.add('vcat-drag-over');
}

function _catOnDrop(event, el, type, targetId, targetParentId) {
    event.preventDefault();
    if (_catDragOverEl) { _catDragOverEl.classList.remove('vcat-drag-over'); _catDragOverEl = null; }
    if (!_catDragId || _catDragId === targetId || _catDragType !== type) return;
    if (type === 'sub' && _catDragParentId !== targetParentId) return;
    if (type === 'major') { _catReorderMajors(_catDragId, targetId); }
    else                  { _catReorderSubs(_catDragParentId, _catDragId, targetId); }
}

function _catOnDragEnd(event, el) {
    el.classList.remove('vcat-dragging');
    if (_catDragOverEl) { _catDragOverEl.classList.remove('vcat-drag-over'); _catDragOverEl = null; }
    _catDragType = _catDragId = _catDragParentId = null;
}

function _catReorderMajors(draggedId, targetId) {
    var cats = _catPageData.slice();
    var fi = cats.findIndex(function(c) { return c.id === draggedId; });
    var ti = cats.findIndex(function(c) { return c.id === targetId; });
    if (fi < 0 || ti < 0) return;
    cats.splice(ti, 0, cats.splice(fi, 1)[0]);
    var batch = db.batch();
    cats.forEach(function(c, i) { c.order = i; batch.update(userCol('viewCategories').doc(c.id), { order: i }); });
    _catPageData = cats;
    batch.commit().catch(function(err) { console.error('_catReorderMajors error:', err); });
    _viewCatRenderPage();
}

function _catReorderSubs(catId, draggedId, targetId) {
    var cat = _catPageData.find(function(c) { return c.id === catId; });
    if (!cat) return;
    var subs = cat.subs.slice();
    var fi = subs.findIndex(function(s) { return s.id === draggedId; });
    var ti = subs.findIndex(function(s) { return s.id === targetId; });
    if (fi < 0 || ti < 0 || subs[ti].isDefault) return;
    subs.splice(ti, 0, subs.splice(fi, 1)[0]);
    var batch = db.batch();
    subs.forEach(function(s, i) { s.order = i; batch.update(userCol('viewCategories').doc(catId).collection('subcategories').doc(s.id), { order: i }); });
    cat.subs = subs;
    batch.commit().catch(function(err) { console.error('_catReorderSubs error:', err); });
    _viewCatRenderPage();
}
