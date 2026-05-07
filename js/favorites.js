// ============================================================
// FAVORITES — star any screen, show shortcuts on the home page
// ============================================================
// Data stored in userCol('settings').doc('favorites') as { items: [...] }
// Each item: { hash, label, icon }
// The star button in the header is always visible (except on #main itself).
// Drag-to-reorder is wired on desktop (pointer: fine) only.
// Mobile/tablet sees the same order without drag controls.

var _favItems  = [];   // current favorites array
var _favReady  = false; // true once Firestore load completes

// ---- Public API (called from app.js + index.html) ----

// Load favorites from Firestore. Called once from initApp() after auth.
async function favInit() {
    try {
        var doc = await userCol('settings').doc('favorites').get();
        _favItems = doc.exists ? (doc.data().items || []) : [];
    } catch (e) {
        _favItems = [];
    }
    _favReady = true;
    _favUpdateStar();
    favRenderHomeSection();
}

// Called from showPage() on every navigation to refresh the star state.
function favUpdateStar() {
    _favUpdateStar();
}

// Called from the #main route handler each visit to refresh the widget.
function favRenderHomeSection() {
    var section = document.getElementById('favoritesSection');
    if (!section) return;
    if (!_favReady || !_favItems.length) {
        section.innerHTML = '';
        return;
    }
    var cardsHtml = _favItems.map(function(fav) {
        return '<a href="' + escapeHtml(fav.hash) + '" class="fav-card">' +
            '<span class="fav-card-icon">' + escapeHtml(fav.icon || '⭐') + '</span>' +
            '<span class="fav-card-label">' + escapeHtml(fav.label) + '</span>' +
        '</a>';
    }).join('');

    section.innerHTML =
        '<div class="fav-section-title">⭐ Favorites</div>' +
        '<div class="fav-cards-row" id="favCardsRow">' + cardsHtml + '</div>';

    if (window.matchMedia('(pointer: fine)').matches) {
        _favSetupDrag(document.getElementById('favCardsRow'));
    }
}

// Toggle the current page as a favorite (called from the star button onclick).
async function favToggle() {
    var hash = window.location.hash;
    if (!hash || hash === '#main' || hash === '#' || hash === '') return;

    var idx = _favItems.findIndex(function(f) { return f.hash === hash; });
    if (idx >= 0) {
        _favItems.splice(idx, 1);
    } else {
        _favItems.push({ hash: hash, label: _favGetLabel(), icon: _favGetIcon() });
    }

    _favUpdateStar();
    favRenderHomeSection();
    await _favSave();
}

// ---- Internal helpers ----

function _favUpdateStar() {
    var btn = document.getElementById('favStarBtn');
    if (!btn) return;
    var hash = window.location.hash;
    // Hide on the main landing page and on auth/setup pages
    var hide = !hash || hash === '#main' || hash === '#' || hash === '';
    btn.style.display = hide ? 'none' : '';
    if (hide) return;

    var isFav = _favItems.some(function(f) { return f.hash === hash; });
    btn.textContent  = isFav ? '★' : '☆'; // ★ vs ☆
    btn.title        = isFav ? 'Remove from favorites' : 'Add to favorites';
    btn.classList.toggle('fav-star--active', isFav);
}

function _favGetLabel() {
    // Last breadcrumb <span> is the most specific name for the current screen
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) {
        var spans = crumb.querySelectorAll('span');
        if (spans.length) {
            var last = spans[spans.length - 1].textContent.trim();
            if (last) return last;
        }
    }
    // Fall back to headerTitle inner text (minus the app name link)
    var titleEl = document.getElementById('headerTitle');
    if (titleEl) {
        var text = titleEl.textContent.trim();
        var appName = window.appName || 'Bishop';
        if (text && text !== appName) return text;
    }
    // Last resort: humanize the hash
    return window.location.hash.replace('#', '').replace(/\//g, ' › ').replace(/-/g, ' ');
}

function _favGetIcon() {
    // Grab leading emoji from the visible page's <h2> if present
    var h2 = document.querySelector('.page:not(.hidden) h2');
    if (h2) {
        var m = h2.textContent.match(/^\p{Emoji_Presentation}/u);
        if (m) return m[0];
    }
    return '⭐';
}

async function _favSave() {
    try {
        await userCol('settings').doc('favorites').set({ items: _favItems }, { merge: true });
    } catch (e) {
        console.error('Failed to save favorites', e);
    }
}

// ---- Drag-to-reorder (desktop only) ----

function _favSetupDrag(row) {
    if (!row || row.dataset.dragInit === 'true') return;
    row.dataset.dragInit = 'true';
    var dragging = null;

    Array.from(row.querySelectorAll('.fav-card')).forEach(function(c) {
        c.setAttribute('draggable', 'true');
    });

    row.addEventListener('dragstart', function(e) {
        var card = e.target.closest('.fav-card');
        if (!card) return;
        dragging = card;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(function() { card.classList.add('fav-card--dragging'); }, 0);
    });

    row.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var target = e.target.closest('.fav-card');
        if (!target || target === dragging) return;
        row.querySelectorAll('.fav-card--drop-before, .fav-card--drop-after').forEach(function(el) {
            el.classList.remove('fav-card--drop-before', 'fav-card--drop-after');
        });
        var rect = target.getBoundingClientRect();
        target.classList.add(e.clientX < rect.left + rect.width / 2 ? 'fav-card--drop-before' : 'fav-card--drop-after');
    });

    row.addEventListener('dragleave', function(e) {
        if (!row.contains(e.relatedTarget)) _favClearDrag(row);
    });

    row.addEventListener('drop', function(e) {
        e.preventDefault();
        var target = e.target.closest('.fav-card');
        _favClearDrag(row);
        if (!target || !dragging || target === dragging) return;
        var rect = target.getBoundingClientRect();
        row.insertBefore(dragging, e.clientX < rect.left + rect.width / 2 ? target : target.nextSibling);
        _favSaveFromDOM(row);
    });

    row.addEventListener('dragend', function() {
        _favClearDrag(row);
        dragging = null;
    });
}

function _favClearDrag(row) {
    row.querySelectorAll('.fav-card--dragging, .fav-card--drop-before, .fav-card--drop-after').forEach(function(el) {
        el.classList.remove('fav-card--dragging', 'fav-card--drop-before', 'fav-card--drop-after');
    });
}

async function _favSaveFromDOM(row) {
    // Rebuild _favItems in DOM order, preserving existing item data by hash
    var byHash = {};
    _favItems.forEach(function(f) { byHash[f.hash] = f; });
    var newOrder = [];
    row.querySelectorAll('.fav-card').forEach(function(card) {
        var h = card.getAttribute('href');
        if (h && byHash[h]) newOrder.push(byHash[h]);
    });
    _favItems = newOrder;
    await _favSave();
}
