// ============================================================
// views.js — My Views section
// ============================================================

// ---------- Seed Data ----------
var _viewsCategorySeed = [
    { name: 'Politics & Society', subs: ['Politics', 'Government', 'Culture', 'Society', 'Media'] },
    { name: 'Personal Beliefs',   subs: ['Religion / Faith', 'Ethics & Morality', 'Philosophy'] },
    { name: 'Life & Family',      subs: ['Parenting', 'Relationships', 'Marriage', 'Family'] },
    { name: 'Practical',          subs: ['Finance & Money', 'Health & Medicine', 'Education', 'Career & Work', 'Technology'] },
    { name: 'Other',              subs: ['Environment', 'Sports', 'Food & Lifestyle'] }
];

function seedViewCategories() {
    userCol('viewCategories').limit(1).get().then(function(snap) {
        if (!snap.empty) return; // already seeded
        var batch = db.batch();
        _viewsCategorySeed.forEach(function(cat, catIdx) {
            var catRef = userCol('viewCategories').doc();
            batch.set(catRef, {
                name: cat.name,
                order: catIdx,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            var generalRef = catRef.collection('subcategories').doc();
            batch.set(generalRef, {
                name: 'General',
                order: 0,
                isDefault: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            cat.subs.forEach(function(subName, subIdx) {
                var subRef = catRef.collection('subcategories').doc();
                batch.set(subRef, {
                    name: subName,
                    order: subIdx + 1,
                    isDefault: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        });
        batch.commit().catch(function(err) { console.error('seedViewCategories error:', err); });
    }).catch(function(err) { console.error('seedViewCategories check error:', err); });
}

// ---------- Helpers ----------
function _viewEsc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _viewFormatDate(ts) {
    if (!ts) return '';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------- Views List Page ----------
function loadViewsPage() {
    seedViewCategories();

    // Breadcrumb
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>My Views</span>';

    // Wire search
    var searchEl = document.getElementById('viewsSearchInput');
    if (searchEl) {
        searchEl.value = '';
        searchEl.oninput = function() { _viewSearch(this.value); };
    }

    var container = document.getElementById('viewsAccordion');
    if (!container) return;
    container.innerHTML = '<p class="views-empty-state">Loading...</p>';

    var catsPromise  = userCol('viewCategories').orderBy('order').get();
    var viewsPromise = userCol('views').get();

    Promise.all([catsPromise, viewsPromise]).then(function(results) {
        var catSnap  = results[0];
        var viewSnap = results[1];

        // Update tile count on Thoughts landing (if visible)
        var tileEl = document.getElementById('viewsCount');
        if (tileEl) tileEl.textContent = 'My Views (' + viewSnap.size + ')';

        // Group views by subcategoryId; null goes to uncategorized
        var viewsBySubId = {};
        var uncategorized = [];
        viewSnap.docs.forEach(function(doc) {
            var data = doc.data();
            data.id = doc.id;
            var subId = data.subcategoryId || null;
            if (!subId) {
                uncategorized.push(data);
            } else {
                if (!viewsBySubId[subId]) viewsBySubId[subId] = [];
                viewsBySubId[subId].push(data);
            }
        });

        if (catSnap.empty && uncategorized.length === 0) {
            container.innerHTML = '<p class="views-empty-state">No views yet. Click <strong>+ New View</strong> to get started.</p>';
            return;
        }

        // Load subcollections for all categories in parallel
        var subPromises = catSnap.docs.map(function(catDoc) {
            return userCol('viewCategories').doc(catDoc.id)
                .collection('subcategories').orderBy('order').get()
                .then(function(subSnap) {
                    return { catDoc: catDoc, subDocs: subSnap.docs };
                });
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
        var cat = cd.catDoc.data();
        cat.id  = cd.catDoc.id;

        var catTotal = 0;
        var subHtml  = '';

        cd.subDocs.forEach(function(subDoc) {
            var sub   = subDoc.data();
            sub.id    = subDoc.id;
            var views = viewsBySubId[sub.id] || [];
            if (views.length === 0) return; // hide empty subcategories

            catTotal += views.length;
            var cardsHtml = views.map(_viewRenderCard).join('');

            subHtml +=
                '<div class="views-sub-accordion" data-sub-id="' + sub.id + '">' +
                    '<div class="views-sub-header" onclick="_viewToggleSub(this)">' +
                        '<span class="views-chevron">&#9654;</span>' +
                        '<span class="views-sub-name">' + _viewEsc(sub.name) + '</span>' +
                        '<span class="views-sub-count">(' + views.length + ')</span>' +
                    '</div>' +
                    '<div class="views-sub-body hidden">' + cardsHtml + '</div>' +
                '</div>';
        });

        if (catTotal === 0) return; // hide empty major categories
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

    // Uncategorized section — always at bottom
    if (uncategorized.length > 0) {
        anyVisible = true;
        var uncatCards = uncategorized.map(_viewRenderCard).join('');
        html +=
            '<div class="views-major-accordion" data-cat-id="uncategorized">' +
                '<div class="views-major-header" onclick="_viewToggleMajor(this)">' +
                    '<span class="views-chevron">&#9654;</span>' +
                    '<span class="views-major-name">Uncategorized</span>' +
                    '<span class="views-major-count">(' + uncategorized.length + ')</span>' +
                '</div>' +
                '<div class="views-major-body hidden">' + uncatCards + '</div>' +
            '</div>';
    }

    if (!anyVisible) {
        html = '<p class="views-empty-state">No views yet. Click <strong>+ New View</strong> to get started.</p>';
    }

    container.innerHTML = html;
}

function _viewRenderCard(v) {
    var dateStr = _viewFormatDate(v.currentDate || v.createdAt);
    var histBadge = '';
    if (v.historyCount && v.historyCount > 0) {
        histBadge = '<span class="views-history-badge">' +
            v.historyCount + ' previous view' + (v.historyCount !== 1 ? 's' : '') +
            '</span>';
    }
    var shortHtml = v.shortVersion
        ? '<p class="views-card-short">' + _viewEsc(v.shortVersion) + '</p>'
        : '';

    return '<a href="#view/' + v.id + '" class="views-card">' +
        '<div class="views-card-header">' +
            '<span class="views-card-title">' + _viewEsc(v.title || '(Untitled)') + '</span>' +
            (dateStr ? '<span class="views-card-date">' + dateStr + '</span>' : '') +
        '</div>' +
        shortHtml +
        (histBadge ? '<div class="views-card-footer">' + histBadge + '</div>' : '') +
    '</a>';
}

// ---------- Accordion Toggle ----------
function _viewToggleMajor(header) {
    var body    = header.nextElementSibling;
    var chevron = header.querySelector('.views-chevron');
    var isOpen  = !body.classList.contains('hidden');
    body.classList.toggle('hidden', isOpen);
    chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function _viewToggleSub(header) {
    var body    = header.nextElementSibling;
    var chevron = header.querySelector('.views-chevron');
    var isOpen  = !body.classList.contains('hidden');
    body.classList.toggle('hidden', isOpen);
    chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
}

// ---------- Search ----------
function _viewSearch(term) {
    var lc        = term.toLowerCase().trim();
    var container = document.getElementById('viewsAccordion');
    if (!container) return;

    var majors = container.querySelectorAll('.views-major-accordion');

    if (!lc) {
        // Restore collapsed state, show everything
        majors.forEach(function(major) {
            major.classList.remove('hidden');
            var majorBody   = major.querySelector('.views-major-body');
            var majorChevron = major.querySelector('.views-major-header .views-chevron');
            majorBody.classList.add('hidden');
            if (majorChevron) majorChevron.style.transform = '';

            major.querySelectorAll('.views-sub-accordion').forEach(function(sub) {
                sub.classList.remove('hidden');
                var subBody    = sub.querySelector('.views-sub-body');
                var subChevron = sub.querySelector('.views-sub-header .views-chevron');
                if (subBody) subBody.classList.add('hidden');
                if (subChevron) subChevron.style.transform = '';
                sub.querySelectorAll('.views-card').forEach(function(c) { c.classList.remove('hidden'); });
            });

            // Direct cards (uncategorized)
            major.querySelectorAll('.views-major-body > .views-card').forEach(function(c) {
                c.classList.remove('hidden');
            });
        });
        return;
    }

    // Search mode: expand matching, hide non-matching
    majors.forEach(function(major) {
        var majorHasMatch = false;
        var majorBody     = major.querySelector('.views-major-body');
        var majorChevron  = major.querySelector('.views-major-header .views-chevron');

        // Direct cards (uncategorized major section)
        major.querySelectorAll('.views-major-body > .views-card').forEach(function(card) {
            var match = _viewCardMatches(card, lc);
            card.classList.toggle('hidden', !match);
            if (match) majorHasMatch = true;
        });

        // Subcategory accordions
        major.querySelectorAll('.views-sub-accordion').forEach(function(sub) {
            var subHasMatch = false;
            var subBody     = sub.querySelector('.views-sub-body');
            var subChevron  = sub.querySelector('.views-sub-header .views-chevron');

            sub.querySelectorAll('.views-card').forEach(function(card) {
                var match = _viewCardMatches(card, lc);
                card.classList.toggle('hidden', !match);
                if (match) subHasMatch = true;
            });

            sub.classList.toggle('hidden', !subHasMatch);
            if (subHasMatch) {
                majorHasMatch = true;
                if (subBody) subBody.classList.remove('hidden');
                if (subChevron) subChevron.style.transform = 'rotate(90deg)';
            }
        });

        major.classList.toggle('hidden', !majorHasMatch);
        if (majorHasMatch) {
            if (majorBody) majorBody.classList.remove('hidden');
            if (majorChevron) majorChevron.style.transform = 'rotate(90deg)';
        }
    });
}

function _viewCardMatches(card, lc) {
    var titleEl = card.querySelector('.views-card-title');
    var shortEl = card.querySelector('.views-card-short');
    var title = titleEl ? titleEl.textContent.toLowerCase() : '';
    var short = shortEl ? shortEl.textContent.toLowerCase() : '';
    return title.includes(lc) || short.includes(lc);
}

// ---------- Stub pages (built out in later phases) ----------
function loadViewDetailPage(id) {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<a href="#views">My Views</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span id="viewDetailCrumb">View</span>';

    var container = document.getElementById('viewDetailContent');
    if (container) container.innerHTML = '<p class="views-empty-state">View detail coming in Phase 3.</p>';
}

function loadViewHistoryPage(viewId, historyId) {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<a href="#views">My Views</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>Previous View</span>';

    var container = document.getElementById('viewHistoryContent');
    if (container) container.innerHTML = '<p class="views-empty-state">History page coming in Phase 7.</p>';
}

function loadViewsCategoriesPage() {
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML =
        '<a href="#thoughts">Thoughts</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<a href="#views">My Views</a>' +
        '<span class="separator">&rsaquo;</span>' +
        '<span>Manage Categories</span>';

    var container = document.getElementById('viewsCategoriesContent');
    if (container) container.innerHTML = '<p class="views-empty-state">Category management coming in Phase 9.</p>';
}
