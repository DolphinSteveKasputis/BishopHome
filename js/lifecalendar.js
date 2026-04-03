// ============================================================
// lifecalendar.js — Life Calendar feature
// Personal event tracking with categories, mini logs, and
// journal integration.
// ============================================================

// ---------- Module State ----------

/** The currently loaded life event (for detail page). */
window.currentLifeEvent = null;

/**
 * Pre-filled date for new event creation.
 * Set by loadLifeCalendarPage() when user clicks a day cell.
 * Consumed (and cleared) by loadNewLifeEventPage().
 */
window._newEventDate = null;

/** The category currently being edited in the category modal (null = new). */
var _lcEditingCategoryId = null;

/**
 * Color swatches for category color picker.
 * Reuses the same gradient set as notebooks for visual consistency.
 */
var LC_COLOR_SWATCHES = [
    { label: 'Sky',     gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
    { label: 'Teal',    gradient: 'linear-gradient(135deg, #0d9488, #34d399)' },
    { label: 'Green',   gradient: 'linear-gradient(135deg, #16a34a, #4ade80)' },
    { label: 'Amber',   gradient: 'linear-gradient(135deg, #d97706, #fbbf24)' },
    { label: 'Rose',    gradient: 'linear-gradient(135deg, #e11d48, #fb7185)' },
    { label: 'Violet',  gradient: 'linear-gradient(135deg, #7c3aed, #c4b5fd)' },
    { label: 'Indigo',  gradient: 'linear-gradient(135deg, #6366f1, #a5b4fc)' },
    { label: 'Gray',    gradient: 'linear-gradient(135deg, #6b7280, #9ca3af)' },
];

/**
 * The 5 categories auto-seeded on first visit.
 * template links to category-specific field schemas (used in LC-5).
 */
var LC_SEED_CATEGORIES = [
    { name: 'Races',         template: 'race',    color: LC_COLOR_SWATCHES[1].gradient, sortOrder: 1 },
    { name: 'Concerts',      template: 'concert', color: LC_COLOR_SWATCHES[4].gradient, sortOrder: 2 },
    { name: 'Golf',          template: 'golf',    color: LC_COLOR_SWATCHES[2].gradient, sortOrder: 3 },
    { name: 'Travel',        template: 'travel',  color: LC_COLOR_SWATCHES[0].gradient, sortOrder: 4 },
    { name: 'Sports Events', template: 'sports',  color: LC_COLOR_SWATCHES[3].gradient, sortOrder: 5 },
];

// ============================================================
// Category — Firestore CRUD
// ============================================================

/**
 * Load all life categories ordered by sortOrder, then name.
 * @returns {Array} Array of { id, name, color, template, sortOrder }
 */
async function lcLoadCategories() {
    var snap = await userCol('lifeCategories').orderBy('sortOrder').get();
    return snap.docs.map(function(doc) {
        return { id: doc.id, ...doc.data() };
    });
}

/**
 * Create a new life category.
 * @param {string} name      - Category name
 * @param {string} color     - CSS gradient string
 * @param {string} template  - Template key (e.g. 'race', 'golf', or '' for generic)
 * @returns {string} New doc ID
 */
async function lcAddCategory(name, color, template) {
    // Assign sortOrder = max existing + 1
    var snap = await userCol('lifeCategories').orderBy('sortOrder', 'desc').limit(1).get();
    var nextOrder = snap.empty ? 1 : (snap.docs[0].data().sortOrder || 0) + 1;

    var ref = await userCol('lifeCategories').add({
        name:      name.trim(),
        color:     color,
        template:  template || '',
        sortOrder: nextOrder,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
}

/**
 * Update an existing life category's name and color.
 * @param {string} id    - Category doc ID
 * @param {string} name  - New name
 * @param {string} color - New CSS gradient
 */
async function lcUpdateCategory(id, name, color) {
    await userCol('lifeCategories').doc(id).update({
        name:  name.trim(),
        color: color
    });
}

/**
 * Delete a life category.
 * If any lifeEvents reference this category, shows the reassignment modal instead.
 * @param {string} id - Category doc ID
 */
async function lcDeleteCategory(id) {
    // Check for events using this category
    var eventsSnap = await userCol('lifeEvents').where('categoryId', '==', id).get();

    if (!eventsSnap.empty) {
        // Show reassignment modal
        _lcShowDeleteCategoryModal(id, eventsSnap.docs);
        return;
    }

    // No events — simple confirm + delete
    if (!confirm('Delete this category?')) return;
    await userCol('lifeCategories').doc(id).delete();
    loadLifeCalendarPage();
}

// ============================================================
// Category — Auto-seed on first visit
// ============================================================

/**
 * Checks if lifeCategories is empty for this user.
 * If so, seeds the 5 default categories.
 */
async function lcEnsureDefaultCategories() {
    var snap = await userCol('lifeCategories').limit(1).get();
    if (!snap.empty) return; // already seeded

    var batch = firebase.firestore().batch();
    var now = firebase.firestore.FieldValue.serverTimestamp();

    LC_SEED_CATEGORIES.forEach(function(cat) {
        var ref = userCol('lifeCategories').doc();
        batch.set(ref, {
            name:      cat.name,
            color:     cat.color,
            template:  cat.template,
            sortOrder: cat.sortOrder,
            createdAt: now
        });
    });

    await batch.commit();
}

// ============================================================
// Category — UI helpers
// ============================================================

/**
 * Renders the color swatch circles in the category modal.
 * @param {string} selectedGradient - The currently selected gradient string
 */
function lcRenderCategorySwatches(selectedGradient) {
    var container = document.getElementById('lcCategoryColorSwatches');
    if (!container) return;
    container.innerHTML = '';

    LC_COLOR_SWATCHES.forEach(function(swatch) {
        var el = document.createElement('div');
        el.className = 'notes-color-swatch' + (swatch.gradient === selectedGradient ? ' selected' : '');
        el.style.background = swatch.gradient;
        el.title = swatch.label;
        el.addEventListener('click', function() {
            container.querySelectorAll('.notes-color-swatch').forEach(function(s) {
                s.classList.remove('selected');
            });
            el.classList.add('selected');
            document.getElementById('lcCategoryColorValue').value = swatch.gradient;
        });
        container.appendChild(el);
    });
}

/**
 * Opens the category add/edit modal.
 * @param {Object|null} category - Existing category object (null = new)
 */
function lcOpenCategoryModal(category) {
    _lcEditingCategoryId = category ? category.id : null;

    var title    = document.getElementById('lcCategoryModalTitle');
    var nameInput = document.getElementById('lcCategoryNameInput');
    var colorInput = document.getElementById('lcCategoryColorValue');

    title.textContent = category ? 'Edit Category' : 'Add Category';
    nameInput.value   = category ? category.name  : '';

    var selectedColor = (category && category.color) ? category.color : LC_COLOR_SWATCHES[0].gradient;
    colorInput.value  = selectedColor;
    lcRenderCategorySwatches(selectedColor);

    openModal('lcCategoryModal');
    nameInput.focus();
}

/**
 * Shows the delete-category reassignment modal.
 * Lists the affected events and lets user pick a replacement category before deleting.
 * @param {string}   deletingId   - ID of category being deleted
 * @param {Array}    eventDocs    - Firestore QueryDocumentSnapshot array
 */
async function _lcShowDeleteCategoryModal(deletingId, eventDocs) {
    // Load all categories except the one being deleted
    var allCats = await lcLoadCategories();
    var others  = allCats.filter(function(c) { return c.id !== deletingId; });

    if (others.length === 0) {
        alert('Cannot delete the last category. Add another category first.');
        return;
    }

    // Build event list HTML
    var evList = eventDocs.map(function(doc) {
        return '<li>' + escapeHtml(doc.data().title || '(untitled)') + '</li>';
    }).join('');

    // Build replacement dropdown
    var opts = others.map(function(c) {
        return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
    }).join('');

    var container = document.getElementById('lcDeleteCategoryBody');
    container.innerHTML =
        '<p>The following events use this category. Choose a replacement before deleting:</p>' +
        '<ul class="lc-delete-event-list">' + evList + '</ul>' +
        '<div class="form-group" style="margin-top:12px;">' +
        '<label>Move events to:</label>' +
        '<select id="lcReplacementCategorySelect" class="form-control">' + opts + '</select>' +
        '</div>';

    // Wire confirm button
    var confirmBtn = document.getElementById('lcDeleteCategoryConfirmBtn');
    // Remove any old listener
    var fresh = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(fresh, confirmBtn);

    fresh.addEventListener('click', async function() {
        var replacementId = document.getElementById('lcReplacementCategorySelect').value;
        if (!replacementId) return;

        // Batch-update all affected events
        var batch = firebase.firestore().batch();
        eventDocs.forEach(function(doc) {
            batch.update(userCol('lifeEvents').doc(doc.id), { categoryId: replacementId });
        });
        await batch.commit();

        // Delete the category
        await userCol('lifeCategories').doc(deletingId).delete();
        closeModal('lcDeleteCategoryModal');
        loadLifeCalendarPage();
    });

    openModal('lcDeleteCategoryModal');
}

/**
 * Renders the category tile grid on the Life Calendar page.
 * @param {Array}  categories - Array of category objects
 * @param {Element} container - DOM element to render into
 */
function lcRenderCategoryTiles(categories, container) {
    if (categories.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);padding:8px 0;">No categories yet.</p>';
        return;
    }

    container.innerHTML = '';
    categories.forEach(function(cat) {
        var tile = document.createElement('div');
        tile.className = 'lc-category-tile';
        tile.style.background = cat.color;

        tile.innerHTML =
            '<span class="lc-category-tile-name">' + escapeHtml(cat.name) + '</span>' +
            '<div class="lc-category-tile-actions">' +
            '<button class="lc-tile-btn" data-action="edit" title="Edit">✏️</button>' +
            '<button class="lc-tile-btn" data-action="delete" title="Delete">🗑️</button>' +
            '</div>';

        tile.querySelector('[data-action="edit"]').addEventListener('click', function(e) {
            e.stopPropagation();
            lcOpenCategoryModal(cat);
        });
        tile.querySelector('[data-action="delete"]').addEventListener('click', function(e) {
            e.stopPropagation();
            lcDeleteCategory(cat.id);
        });

        container.appendChild(tile);
    });
}

// ============================================================
// Page Loaders
// ============================================================

/**
 * Load the Life Calendar main page (#life-calendar).
 * Auto-seeds categories on first visit, then renders the category grid.
 */
async function loadLifeCalendarPage() {
    const section = document.getElementById('page-life-calendar');
    if (!section) return;

    // Skeleton while loading
    section.innerHTML = `
        <div class="page-header">
            <div class="breadcrumb">
                <a href="#life" class="breadcrumb-link">Life</a>
                <span class="breadcrumb-sep"> › </span>
                <span>Calendar</span>
            </div>
            <h2>Life Calendar</h2>
        </div>
        <div class="lc-page-body">
            <p style="color:var(--text-muted);">Loading…</p>
        </div>
    `;

    try {
        // Seed default categories if this is the first visit
        await lcEnsureDefaultCategories();

        // Load categories
        var categories = await lcLoadCategories();

        // Render full page content
        section.innerHTML = `
            <div class="page-header">
                <div class="breadcrumb">
                    <a href="#life" class="breadcrumb-link">Life</a>
                    <span class="breadcrumb-sep"> › </span>
                    <span>Calendar</span>
                </div>
                <h2>Life Calendar</h2>
            </div>
            <div class="lc-page-body">
                <div class="lc-section-header">
                    <h3>Categories</h3>
                    <button class="btn btn-sm btn-secondary" id="lcAddCategoryBtn">+ Category</button>
                </div>
                <div class="lc-category-grid" id="lcCategoryGrid"></div>

                <div style="margin-top:24px;">
                    <a href="#life-event/new" class="btn btn-primary">+ New Event</a>
                </div>
            </div>
        `;

        // Render category tiles
        lcRenderCategoryTiles(categories, document.getElementById('lcCategoryGrid'));

        // Wire the Add Category button
        document.getElementById('lcAddCategoryBtn').addEventListener('click', function() {
            lcOpenCategoryModal(null);
        });

        // Wire category modal save button
        _lcWireCategoryModal();

    } catch (err) {
        console.error('loadLifeCalendarPage error:', err);
        document.querySelector('#page-life-calendar .lc-page-body').innerHTML =
            '<p style="color:var(--danger);">Failed to load. Please refresh.</p>';
    }
}

/**
 * Wire the save/cancel buttons on the category add/edit modal.
 * Called each time the Life Calendar page loads (idempotent via cloneNode trick).
 */
function _lcWireCategoryModal() {
    var saveBtn = document.getElementById('lcCategoryModalSaveBtn');
    var fresh = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(fresh, saveBtn);

    fresh.addEventListener('click', async function() {
        var name  = (document.getElementById('lcCategoryNameInput').value || '').trim();
        var color = document.getElementById('lcCategoryColorValue').value || LC_COLOR_SWATCHES[0].gradient;

        if (!name) {
            alert('Please enter a category name.');
            return;
        }

        try {
            if (_lcEditingCategoryId) {
                await lcUpdateCategory(_lcEditingCategoryId, name, color);
            } else {
                await lcAddCategory(name, color, '');
            }
            closeModal('lcCategoryModal');
            loadLifeCalendarPage();
        } catch (err) {
            console.error('lcSaveCategory error:', err);
            alert('Save failed. Please try again.');
        }
    });

    document.getElementById('lcCategoryModalCancelBtn').addEventListener('click', function() {
        closeModal('lcCategoryModal');
    });
    document.getElementById('lcDeleteCategoryModalCancelBtn').addEventListener('click', function() {
        closeModal('lcDeleteCategoryModal');
    });
}

/**
 * Load the New Life Event page (#life-event/new).
 * Pre-fills the date from window._newEventDate if set.
 */
function loadNewLifeEventPage() {
    const prefillDate = window._newEventDate || '';
    window._newEventDate = null; // consume it

    const section = document.getElementById('page-life-event');
    if (!section) return;

    section.innerHTML = `
        <div class="page-header">
            <div class="breadcrumb">
                <a href="#life" class="breadcrumb-link">Life</a>
                <span class="breadcrumb-sep"> › </span>
                <a href="#life-calendar" class="breadcrumb-link">Calendar</a>
                <span class="breadcrumb-sep"> › </span>
                <span>New Event</span>
            </div>
            <h2>New Event</h2>
        </div>
        <div style="padding: 16px; color: var(--text-muted);">
            <p>New Life Event form — coming in LC-3.</p>
            ${prefillDate ? `<p>Date: ${prefillDate}</p>` : ''}
        </div>
    `;
}

/**
 * Load the Life Event detail page (#life-event/{id}).
 * @param {string} id - Firestore document ID of the life event
 */
function loadLifeEventPage(id) {
    window.currentLifeEvent = null;

    const section = document.getElementById('page-life-event');
    if (!section) return;

    section.innerHTML = `
        <div class="page-header">
            <div class="breadcrumb">
                <a href="#life" class="breadcrumb-link">Life</a>
                <span class="breadcrumb-sep"> › </span>
                <a href="#life-calendar" class="breadcrumb-link">Calendar</a>
                <span class="breadcrumb-sep"> › </span>
                <span>Event</span>
            </div>
            <h2>Event Detail</h2>
        </div>
        <div style="padding: 16px; color: var(--text-muted);">
            <p>Life Event detail — coming in LC-3. (ID: ${id})</p>
        </div>
    `;
}
