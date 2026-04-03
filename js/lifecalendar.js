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
 * Tracks unsaved changes on the event form.
 * Set to true on any field change; cleared on save.
 * Checked on hashchange to warn the user before navigating away.
 */
var _lcEventDirty = false;

/** ID of the event currently being edited (null = new event). */
var _lcEditingEventId = null;

/**
 * People IDs currently selected on the event form.
 * Populated from the loaded event on edit, or empty on new.
 */
var _lcSelectedPeopleIds = [];

/**
 * Full people list loaded once per event page visit.
 * Each entry: { id, name }
 */
var _lcAllPeople = [];

/**
 * Links currently on the event form.
 * Each entry: { label, url }
 */
var _lcEventLinks = [];

/**
 * Categories cached for template lookup on the event form.
 * Populated by loadNewLifeEventPage / loadLifeEventPage.
 */
var _lcAllCategories = [];

// Template keys for each known category type.
// 'travel' intentionally has no extra fields (marker only).
var LC_TEMPLATE_KEYS = ['race', 'concert', 'golf', 'sports'];

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
// Event — Firestore CRUD
// ============================================================

/**
 * Create a new life event in Firestore.
 * @param {Object} data - Event fields (title, categoryId, startDate, etc.)
 * @returns {string} New document ID
 */
async function lcAddEvent(data) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    var ref = await userCol('lifeEvents').add(data);
    return ref.id;
}

/**
 * Update an existing life event.
 * @param {string} id   - Firestore doc ID
 * @param {Object} data - Fields to update
 */
async function lcUpdateEvent(id, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await userCol('lifeEvents').doc(id).update(data);
}

/**
 * Delete a life event and cascade-delete its mini logs and photos.
 * Journal entries that reference this event are left intact.
 * @param {string} id - Firestore doc ID
 */
async function lcDeleteEvent(id) {
    var batch = firebase.firestore().batch();

    // Delete mini logs
    var logsSnap = await userCol('lifeEventLogs').where('eventId', '==', id).get();
    logsSnap.docs.forEach(function(doc) { batch.delete(doc.ref); });

    // Delete photos
    var photosSnap = await userCol('photos')
        .where('targetType', '==', 'lifeEvent')
        .where('targetId', '==', id)
        .get();
    photosSnap.docs.forEach(function(doc) { batch.delete(doc.ref); });

    // Delete the event itself
    batch.delete(userCol('lifeEvents').doc(id));

    await batch.commit();
}

// ============================================================
// People — load for picker
// ============================================================

/**
 * Load all people for the current user, sorted by name.
 * Used to populate the people picker autocomplete.
 * @returns {Array} Array of { id, name }
 */
async function lcLoadPeople() {
    var snap = await userCol('people').orderBy('name').get();
    return snap.docs.map(function(doc) {
        return { id: doc.id, name: doc.data().name || '' };
    });
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

// ============================================================
// Event Form — shared helpers
// ============================================================

/**
 * Builds the category <option> list for the event form dropdown.
 * @param {Array}  categories     - Array of category objects
 * @param {string} selectedId     - Currently selected category ID (or '')
 * @returns {string} HTML option tags
 */
function _lcBuildCategoryOptions(categories, selectedId) {
    return categories.map(function(cat) {
        var sel = cat.id === selectedId ? ' selected' : '';
        return '<option value="' + cat.id + '"' + sel + '>' + escapeHtml(cat.name) + '</option>';
    }).join('');
}

/**
 * Renders the event form HTML into #page-life-event.
 * Used by both new and edit flows.
 * @param {Object|null} event      - Existing event data (null = new)
 * @param {Array}       categories - All life categories
 * @param {string}      prefillDate - ISO date string to pre-fill startDate (new only)
 */
function _lcRenderEventForm(event, categories, prefillDate) {
    const isNew    = !event;
    const title    = isNew ? '' : (event.title || '');
    const catId    = isNew ? (categories[0] ? categories[0].id : '') : (event.categoryId || '');
    const startDate = isNew ? (prefillDate || '') : (event.startDate || '');
    const endDate  = isNew ? '' : (event.endDate || '');
    const location = isNew ? '' : (event.location || '');
    const cost     = isNew ? '' : (event.cost != null ? event.cost : '');
    const status   = isNew ? 'upcoming' : (event.status || 'upcoming');
    const didntGoReason = isNew ? '' : (event.didntGoReason || '');
    const description   = isNew ? '' : (event.description || '');
    const outcome       = isNew ? '' : (event.outcome || '');

    const breadcrumbLabel = isNew ? 'New Event' : escapeHtml(title || 'Event');
    const pageTitle       = isNew ? 'New Event' : escapeHtml(title || 'Event');

    const didntGoHidden = status === 'didntgo' ? '' : ' hidden';

    const catOptions = _lcBuildCategoryOptions(categories, catId);

    const section = document.getElementById('page-life-event');
    section.innerHTML = `
        <div class="page-header">
            <div class="breadcrumb">
                <a href="#life" class="breadcrumb-link">Life</a>
                <span class="breadcrumb-sep"> › </span>
                <a href="#life-calendar" class="breadcrumb-link">Calendar</a>
                <span class="breadcrumb-sep"> › </span>
                <span>${breadcrumbLabel}</span>
            </div>
            <h2>${pageTitle}</h2>
        </div>
        <div class="lc-event-form-wrap">
            <form class="lc-event-form" id="lcEventForm" autocomplete="off">

                <div class="form-group">
                    <label for="lcEventTitle">Title *</label>
                    <input type="text" id="lcEventTitle" class="form-control"
                           placeholder="Event name" value="${escapeHtml(title)}">
                </div>

                <div class="form-group">
                    <label for="lcEventCategory">Category *</label>
                    <select id="lcEventCategory" class="form-control">
                        ${catOptions}
                    </select>
                </div>

                <div class="lc-date-row">
                    <div class="form-group">
                        <label for="lcEventStartDate">Start Date *</label>
                        <input type="date" id="lcEventStartDate" class="form-control"
                               value="${escapeHtml(startDate)}">
                    </div>
                    <div class="form-group">
                        <label for="lcEventEndDate">End Date <span class="label-optional">(optional)</span></label>
                        <input type="date" id="lcEventEndDate" class="form-control"
                               value="${escapeHtml(endDate)}">
                    </div>
                </div>

                <div class="form-group">
                    <label for="lcEventLocation">Location</label>
                    <input type="text" id="lcEventLocation" class="form-control"
                           placeholder="City, venue, etc." value="${escapeHtml(location)}">
                </div>

                <div class="form-group">
                    <label for="lcEventCost">Cost ($)</label>
                    <input type="number" id="lcEventCost" class="form-control"
                           placeholder="0.00" min="0" step="0.01"
                           value="${cost !== '' ? cost : ''}">
                </div>

                <div class="form-group lc-status-row">
                    <label>Status</label>
                    <div class="lc-status-options">
                        <label class="lc-status-label">
                            <input type="radio" name="lcEventStatus" value="upcoming"
                                   ${status === 'upcoming' ? 'checked' : ''}> Upcoming
                        </label>
                        <label class="lc-status-label">
                            <input type="radio" name="lcEventStatus" value="attended"
                                   ${status === 'attended' ? 'checked' : ''}> Attended
                        </label>
                        <label class="lc-status-label">
                            <input type="radio" name="lcEventStatus" value="didntgo"
                                   ${status === 'didntgo' ? 'checked' : ''}> Didn't Go
                        </label>
                    </div>
                </div>

                <div class="form-group lc-didnt-go-reason${didntGoHidden}" id="lcDidntGoGroup">
                    <label for="lcEventDidntGoReason">Reason for not going</label>
                    <textarea id="lcEventDidntGoReason" class="form-control" rows="2"
                              placeholder="Why didn't you go?">${escapeHtml(didntGoReason)}</textarea>
                </div>

                <div class="form-group">
                    <label for="lcEventDescription">Description</label>
                    <textarea id="lcEventDescription" class="form-control" rows="3"
                              placeholder="What is this event?">${escapeHtml(description)}</textarea>
                </div>

                <div class="form-group">
                    <label for="lcEventOutcome">Outcome / Notes</label>
                    <textarea id="lcEventOutcome" class="form-control" rows="3"
                              placeholder="How did it go?">${escapeHtml(outcome)}</textarea>
                </div>

                <!-- Category-specific type fields (shown/hidden by template) -->
                <div class="lc-type-fields hidden" id="lcTypeFields-race">
                    <div class="lc-type-fields-header">Race Details</div>
                    <div class="form-group">
                        <label for="lcRaceDistance">Distance</label>
                        <input type="text" id="lcRaceDistance" class="form-control" placeholder="e.g. 26.2 miles">
                    </div>
                    <div class="form-group">
                        <label for="lcRaceFinishTime">Finish Time</label>
                        <input type="text" id="lcRaceFinishTime" class="form-control" placeholder="e.g. 3:45:22">
                    </div>
                </div>

                <div class="lc-type-fields hidden" id="lcTypeFields-concert">
                    <div class="lc-type-fields-header">Concert Details</div>
                    <div class="form-group">
                        <label>Acts / Performers</label>
                        <div class="lc-tag-chips" id="lcConcertActChips"></div>
                        <div class="lc-tag-input-wrap">
                            <input type="text" id="lcConcertActInput" class="form-control"
                                   placeholder="Type name, press Enter to add">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="lcConcertSeat">Section &amp; Seat</label>
                        <input type="text" id="lcConcertSeat" class="form-control" placeholder="e.g. Section 101 Row D Seat 12">
                    </div>
                </div>

                <div class="lc-type-fields hidden" id="lcTypeFields-golf">
                    <div class="lc-type-fields-header">Golf Details</div>
                    <div class="form-group">
                        <label>Course(s)</label>
                        <div class="lc-tag-chips" id="lcGolfCourseChips"></div>
                        <div class="lc-tag-input-wrap">
                            <input type="text" id="lcGolfCourseInput" class="form-control"
                                   placeholder="Type course name, press Enter to add">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Score(s)</label>
                        <div class="lc-tag-chips" id="lcGolfScoreChips"></div>
                        <div class="lc-tag-input-wrap">
                            <input type="text" id="lcGolfScoreInput" class="form-control"
                                   placeholder="Type score, press Enter to add">
                        </div>
                    </div>
                </div>

                <div class="lc-type-fields hidden" id="lcTypeFields-sports">
                    <div class="lc-type-fields-header">Sports Event Details</div>
                    <div class="form-group">
                        <label for="lcSportType">Sport</label>
                        <select id="lcSportType" class="form-control">
                            <option value="">Select…</option>
                            <option value="Baseball">Baseball</option>
                            <option value="Football">Football</option>
                            <option value="Basketball">Basketball</option>
                            <option value="Hockey">Hockey</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group hidden" id="lcSportOtherGroup">
                        <label for="lcSportOther">Sport (other)</label>
                        <input type="text" id="lcSportOther" class="form-control" placeholder="Specify sport">
                    </div>
                    <div class="form-group">
                        <label for="lcSportsTeams">Teams Playing</label>
                        <input type="text" id="lcSportsTeams" class="form-control" placeholder="e.g. Cubs vs Cardinals">
                    </div>
                    <div class="form-group">
                        <label for="lcSportsFinalScore">Final Score</label>
                        <input type="text" id="lcSportsFinalScore" class="form-control" placeholder="e.g. 4–2">
                    </div>
                    <div class="form-group">
                        <label for="lcSportsSeat">Section &amp; Seat</label>
                        <input type="text" id="lcSportsSeat" class="form-control" placeholder="e.g. Section 203 Row B">
                    </div>
                </div>

                <!-- People picker -->
                <div class="form-group">
                    <label>Who went with you?</label>
                    <div class="lc-people-chips" id="lcPeopleChips"></div>
                    <div class="lc-people-picker-wrap">
                        <input type="text" id="lcPeopleSearch" class="form-control"
                               placeholder="Search by name…" autocomplete="off">
                        <ul class="lc-people-dropdown hidden" id="lcPeopleDropdown"></ul>
                    </div>
                </div>

                <!-- Links -->
                <div class="form-group">
                    <div class="lc-section-header" style="margin-bottom:8px;">
                        <label style="margin:0;">Links</label>
                        <button type="button" class="btn btn-sm btn-secondary" id="lcAddLinkBtn">+ Link</button>
                    </div>
                    <div id="lcLinkInlineForm" class="lc-link-inline-form hidden">
                        <input type="text" id="lcLinkLabel" class="form-control" placeholder="Label (e.g. Race Results)">
                        <input type="url"  id="lcLinkUrl"   class="form-control" placeholder="https://…" style="margin-top:6px;">
                        <div class="lc-link-inline-btns">
                            <button type="button" class="btn btn-sm btn-primary"    id="lcLinkConfirmBtn">Add</button>
                            <button type="button" class="btn btn-sm btn-secondary"  id="lcLinkCancelBtn">Cancel</button>
                        </div>
                    </div>
                    <ul class="lc-links-list" id="lcLinksList"></ul>
                </div>

                <div class="lc-event-form-actions">
                    <button type="button" class="btn btn-primary" id="lcEventSaveBtn">Save</button>
                    ${!isNew ? '<button type="button" class="btn btn-danger" id="lcEventDeleteBtn">Delete</button>' : ''}
                    <button type="button" class="btn btn-secondary" id="lcEventCancelBtn">Cancel</button>
                </div>

            </form>
        </div>
    `;

    // Toggle "Didn't Go" reason visibility when status changes
    section.querySelectorAll('input[name="lcEventStatus"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
            var group = document.getElementById('lcDidntGoGroup');
            if (this.value === 'didntgo') {
                group.classList.remove('hidden');
            } else {
                group.classList.add('hidden');
            }
            _lcEventDirty = true;
        });
    });

    // Mark dirty on any field change
    ['lcEventTitle','lcEventCategory','lcEventStartDate','lcEventEndDate',
     'lcEventLocation','lcEventCost','lcEventDidntGoReason',
     'lcEventDescription','lcEventOutcome'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', function() { _lcEventDirty = true; });
        if (el) el.addEventListener('change', function() { _lcEventDirty = true; });
    });

    // Wire Save
    document.getElementById('lcEventSaveBtn').addEventListener('click', function() {
        _lcSaveEvent(isNew);
    });

    // Wire Delete (edit mode only)
    if (!isNew) {
        document.getElementById('lcEventDeleteBtn').addEventListener('click', function() {
            _lcConfirmDeleteEvent(_lcEditingEventId);
        });
    }

    // Wire Cancel
    document.getElementById('lcEventCancelBtn').addEventListener('click', function() {
        if (_lcEventDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
        _lcEventDirty = false;
        window.location.hash = '#life-calendar';
    });

    // ---- Type fields ----

    // Show the right typeFields section based on the current category, and populate from event.typeFields
    var tf = (event && event.typeFields) ? event.typeFields : {};
    _lcShowTypeFields(_lcGetTemplateForCategory(catId), tf);

    // Re-show on category change
    document.getElementById('lcEventCategory').addEventListener('change', function() {
        var tmpl = _lcGetTemplateForCategory(this.value);
        _lcShowTypeFields(tmpl, {});
        _lcEventDirty = true;
    });

    // Sports: toggle "Other" text input
    var sportSel = document.getElementById('lcSportType');
    if (sportSel) {
        sportSel.addEventListener('change', function() {
            var otherGroup = document.getElementById('lcSportOtherGroup');
            if (this.value === 'Other') {
                otherGroup.classList.remove('hidden');
            } else {
                otherGroup.classList.add('hidden');
            }
        });
    }

    // Wire tag-list inputs (Enter to add)
    _lcWireTagInput('lcConcertActInput',  'lcConcertActChips');
    _lcWireTagInput('lcGolfCourseInput',  'lcGolfCourseChips');
    _lcWireTagInput('lcGolfScoreInput',   'lcGolfScoreChips');

    // ---- People picker ----

    // Initialize selected people from the event (edit) or empty (new)
    _lcSelectedPeopleIds = (event && event.peopleIds) ? event.peopleIds.slice() : [];

    // Render chips for already-selected people (using cached _lcAllPeople)
    _lcRenderPeopleChips();

    // Wire search input
    var searchEl = document.getElementById('lcPeopleSearch');
    var dropEl   = document.getElementById('lcPeopleDropdown');

    searchEl.addEventListener('input', function() {
        var q = this.value.trim().toLowerCase();
        if (!q) { dropEl.classList.add('hidden'); dropEl.innerHTML = ''; return; }

        var matches = _lcAllPeople.filter(function(p) {
            return p.name.toLowerCase().includes(q) && !_lcSelectedPeopleIds.includes(p.id);
        });

        if (matches.length === 0) {
            dropEl.innerHTML = '<li class="lc-people-no-match">No matches</li>';
            dropEl.classList.remove('hidden');
            return;
        }

        dropEl.innerHTML = matches.map(function(p) {
            return '<li data-id="' + p.id + '" data-name="' + escapeHtml(p.name) + '">'
                + escapeHtml(p.name) + '</li>';
        }).join('');
        dropEl.classList.remove('hidden');

        dropEl.querySelectorAll('li[data-id]').forEach(function(li) {
            li.addEventListener('click', function() {
                _lcAddPersonChip(li.dataset.id, li.dataset.name);
                searchEl.value = '';
                dropEl.innerHTML = '';
                dropEl.classList.add('hidden');
            });
        });
    });

    // Enter key: if exactly one match, add it
    searchEl.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var q = this.value.trim().toLowerCase();
        var matches = _lcAllPeople.filter(function(p) {
            return p.name.toLowerCase().includes(q) && !_lcSelectedPeopleIds.includes(p.id);
        });
        if (matches.length === 1) {
            _lcAddPersonChip(matches[0].id, matches[0].name);
            searchEl.value = '';
            dropEl.innerHTML = '';
            dropEl.classList.add('hidden');
        }
    });

    // Close dropdown on outside click
    document.addEventListener('click', function _lcPickerOutside(e) {
        if (!e.target.closest('#lcPeopleSearch') && !e.target.closest('#lcPeopleDropdown')) {
            dropEl.classList.add('hidden');
            document.removeEventListener('click', _lcPickerOutside);
        }
    });

    // ---- Links ----

    // Initialize links from event (edit) or empty (new)
    _lcEventLinks = (event && event.links) ? event.links.map(function(l) {
        return { label: l.label || '', url: l.url || '' };
    }) : [];

    // Track which index is being edited (-1 = new)
    var _lcEditingLinkIdx = -1;

    _lcRenderLinks();

    document.getElementById('lcAddLinkBtn').addEventListener('click', function() {
        _lcEditingLinkIdx = -1;
        document.getElementById('lcLinkLabel').value = '';
        document.getElementById('lcLinkUrl').value   = '';
        document.getElementById('lcLinkConfirmBtn').textContent = 'Add';
        document.getElementById('lcLinkInlineForm').classList.remove('hidden');
        document.getElementById('lcLinkLabel').focus();
    });

    document.getElementById('lcLinkCancelBtn').addEventListener('click', function() {
        document.getElementById('lcLinkInlineForm').classList.add('hidden');
    });

    document.getElementById('lcLinkConfirmBtn').addEventListener('click', function() {
        var label = (document.getElementById('lcLinkLabel').value || '').trim();
        var url   = (document.getElementById('lcLinkUrl').value || '').trim();
        if (!label || !url) { alert('Please enter both a label and a URL.'); return; }

        if (_lcEditingLinkIdx >= 0) {
            _lcEventLinks[_lcEditingLinkIdx] = { label: label, url: url };
        } else {
            _lcEventLinks.push({ label: label, url: url });
        }
        _lcEditingLinkIdx = -1;
        document.getElementById('lcLinkInlineForm').classList.add('hidden');
        _lcRenderLinks();
        _lcEventDirty = true;
    });
}

// ============================================================
// Type fields helpers
// ============================================================

/**
 * Returns the template key for a given category ID.
 * Falls back to '' if the category has no template or isn't found.
 * @param {string} categoryId
 * @returns {string} template key, e.g. 'race', 'concert', 'golf', 'sports', 'travel', or ''
 */
function _lcGetTemplateForCategory(categoryId) {
    var cat = _lcAllCategories.find(function(c) { return c.id === categoryId; });
    return (cat && cat.template) ? cat.template : '';
}

/**
 * Hide all typeFields sections, then show the one matching `template`.
 * Populate the visible section's fields from `typeFields` data.
 * @param {string} template - e.g. 'race', 'concert', 'golf', 'sports', or ''
 * @param {Object} tf       - typeFields data from the event doc
 */
function _lcShowTypeFields(template, tf) {
    // Hide all
    LC_TEMPLATE_KEYS.forEach(function(key) {
        var el = document.getElementById('lcTypeFields-' + key);
        if (el) el.classList.add('hidden');
    });

    if (!template || !LC_TEMPLATE_KEYS.includes(template)) return;

    var section = document.getElementById('lcTypeFields-' + template);
    if (!section) return;
    section.classList.remove('hidden');

    // Populate fields from saved data
    if (template === 'race') {
        _lcSetVal('lcRaceDistance',  tf.distance   || '');
        _lcSetVal('lcRaceFinishTime', tf.finishTime || '');
    } else if (template === 'concert') {
        _lcSetVal('lcConcertSeat', tf.seat || '');
        _lcRenderTagChips('lcConcertActChips', tf.acts || [], 'lcConcertActInput');
    } else if (template === 'golf') {
        _lcRenderTagChips('lcGolfCourseChips', tf.courses || [], 'lcGolfCourseInput');
        _lcRenderTagChips('lcGolfScoreChips',  tf.scores  || [], 'lcGolfScoreInput');
    } else if (template === 'sports') {
        _lcSetVal('lcSportsTeams',      tf.teams      || '');
        _lcSetVal('lcSportsFinalScore', tf.finalScore || '');
        _lcSetVal('lcSportsSeat',       tf.seat       || '');
        var sportSel = document.getElementById('lcSportType');
        if (sportSel) {
            var sport = tf.sport || '';
            var knownSports = ['Baseball','Football','Basketball','Hockey'];
            if (sport && !knownSports.includes(sport)) {
                sportSel.value = 'Other';
                _lcSetVal('lcSportOther', sport);
                var otherGroup = document.getElementById('lcSportOtherGroup');
                if (otherGroup) otherGroup.classList.remove('hidden');
            } else {
                sportSel.value = sport;
            }
        }
    }
}

/** Set a form element's value safely. */
function _lcSetVal(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
}

/**
 * Read all visible typeFields and return an object to store in Firestore.
 * Returns {} if no template section is currently visible.
 */
function _lcReadTypeFields() {
    for (var i = 0; i < LC_TEMPLATE_KEYS.length; i++) {
        var key = LC_TEMPLATE_KEYS[i];
        var section = document.getElementById('lcTypeFields-' + key);
        if (!section || section.classList.contains('hidden')) continue;

        if (key === 'race') {
            return {
                distance:   (document.getElementById('lcRaceDistance').value  || '').trim(),
                finishTime: (document.getElementById('lcRaceFinishTime').value || '').trim()
            };
        } else if (key === 'concert') {
            return {
                acts: _lcReadTagChips('lcConcertActChips'),
                seat: (document.getElementById('lcConcertSeat').value || '').trim()
            };
        } else if (key === 'golf') {
            return {
                courses: _lcReadTagChips('lcGolfCourseChips'),
                scores:  _lcReadTagChips('lcGolfScoreChips')
            };
        } else if (key === 'sports') {
            var sportEl = document.getElementById('lcSportType');
            var sport = sportEl ? sportEl.value : '';
            if (sport === 'Other') {
                sport = (document.getElementById('lcSportOther').value || '').trim() || 'Other';
            }
            return {
                sport:       sport,
                teams:       (document.getElementById('lcSportsTeams').value      || '').trim(),
                finalScore:  (document.getElementById('lcSportsFinalScore').value  || '').trim(),
                seat:        (document.getElementById('lcSportsSeat').value        || '').trim()
            };
        }
    }
    return {};
}

/**
 * Wires an Enter-key tag-input to add chips.
 * @param {string} inputId      - ID of the text input
 * @param {string} chipsId      - ID of the chips container
 */
function _lcWireTagInput(inputId, chipsId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var val = this.value.trim();
        if (!val) return;
        var existing = _lcReadTagChips(chipsId);
        if (!existing.includes(val)) {
            existing.push(val);
            _lcRenderTagChips(chipsId, existing, inputId);
            _lcEventDirty = true;
        }
        this.value = '';
    });
}

/**
 * Render tag chips in a container.
 * @param {string} chipsId  - ID of the container div
 * @param {Array}  tags     - Array of string values
 * @param {string} inputId  - ID of the associated input (for re-wiring after render)
 */
function _lcRenderTagChips(chipsId, tags, inputId) {
    var container = document.getElementById(chipsId);
    if (!container) return;
    container.innerHTML = '';
    tags.forEach(function(tag) {
        var chip = document.createElement('span');
        chip.className = 'lc-tag-chip';
        chip.innerHTML = escapeHtml(tag) +
            '<button type="button" class="lc-chip-remove" title="Remove">✕</button>';
        chip.querySelector('.lc-chip-remove').addEventListener('click', function() {
            var current = _lcReadTagChips(chipsId);
            var idx = current.indexOf(tag);
            if (idx > -1) current.splice(idx, 1);
            _lcRenderTagChips(chipsId, current, inputId);
            _lcEventDirty = true;
        });
        container.appendChild(chip);
    });
}

/**
 * Read current tag chips from a container as an array of strings.
 * @param {string} chipsId
 * @returns {Array<string>}
 */
function _lcReadTagChips(chipsId) {
    var container = document.getElementById(chipsId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('.lc-tag-chip')).map(function(chip) {
        // text content minus the ✕ button text
        return chip.childNodes[0].textContent.trim();
    });
}

/**
 * Add a person chip to the selected list and re-render.
 * @param {string} id   - Person Firestore ID
 * @param {string} name - Person display name
 */
function _lcAddPersonChip(id, name) {
    if (_lcSelectedPeopleIds.includes(id)) return;
    _lcSelectedPeopleIds.push(id);

    // Cache name for re-rendering (in case _lcAllPeople doesn't have it yet)
    if (!_lcAllPeople.find(function(p) { return p.id === id; })) {
        _lcAllPeople.push({ id: id, name: name });
    }
    _lcRenderPeopleChips();
    _lcEventDirty = true;
}

/**
 * Render all currently selected people as chips.
 */
function _lcRenderPeopleChips() {
    var container = document.getElementById('lcPeopleChips');
    if (!container) return;
    container.innerHTML = '';

    _lcSelectedPeopleIds.forEach(function(personId) {
        var person = _lcAllPeople.find(function(p) { return p.id === personId; });
        var name   = person ? person.name : personId;

        var chip = document.createElement('span');
        chip.className = 'lc-person-chip';
        chip.innerHTML =
            '<a href="#person/' + personId + '" class="lc-chip-name">' + escapeHtml(name) + '</a>' +
            '<button type="button" class="lc-chip-remove" data-id="' + personId + '" title="Remove">✕</button>';

        chip.querySelector('.lc-chip-remove').addEventListener('click', function() {
            _lcSelectedPeopleIds = _lcSelectedPeopleIds.filter(function(id) { return id !== personId; });
            _lcRenderPeopleChips();
            _lcEventDirty = true;
        });

        container.appendChild(chip);
    });
}

/**
 * Render the links list.
 */
function _lcRenderLinks() {
    var list = document.getElementById('lcLinksList');
    if (!list) return;
    list.innerHTML = '';

    _lcEventLinks.forEach(function(link, idx) {
        var li = document.createElement('li');
        li.className = 'lc-link-item';
        li.innerHTML =
            '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener" class="lc-link-label">'
            + escapeHtml(link.label) + '</a>' +
            '<div class="lc-link-actions">' +
            '<button type="button" class="btn btn-xs btn-secondary" data-action="edit">Edit</button>' +
            '<button type="button" class="btn btn-xs btn-danger"    data-action="delete">Delete</button>' +
            '</div>';

        li.querySelector('[data-action="edit"]').addEventListener('click', function() {
            // stash editing index into closure variable via re-assignment
            document.getElementById('lcLinkLabel').value = link.label;
            document.getElementById('lcLinkUrl').value   = link.url;
            document.getElementById('lcLinkConfirmBtn').textContent = 'Update';
            document.getElementById('lcLinkInlineForm').classList.remove('hidden');
            document.getElementById('lcLinkLabel').focus();
            // Update the confirm handler's editing index
            // We reach into the closure via the module-level approach:
            // The confirmBtn listener reads _lcEditingLinkIdx from its own scope
            // so we update it on the parent form via a custom attribute trick
            document.getElementById('lcLinkInlineForm').dataset.editIdx = idx;
            // Re-wire confirm button for this index
            var cb = document.getElementById('lcLinkConfirmBtn');
            var fresh = cb.cloneNode(true);
            cb.parentNode.replaceChild(fresh, cb);
            fresh.addEventListener('click', function() {
                var label = (document.getElementById('lcLinkLabel').value || '').trim();
                var url   = (document.getElementById('lcLinkUrl').value || '').trim();
                if (!label || !url) { alert('Please enter both a label and a URL.'); return; }
                _lcEventLinks[idx] = { label: label, url: url };
                document.getElementById('lcLinkInlineForm').classList.add('hidden');
                _lcRenderLinks();
                _lcEventDirty = true;
            });
        });

        li.querySelector('[data-action="delete"]').addEventListener('click', function() {
            _lcEventLinks.splice(idx, 1);
            _lcRenderLinks();
            _lcEventDirty = true;
        });

        list.appendChild(li);
    });
}

/**
 * Reads all event form fields and returns a plain data object.
 * @returns {Object|null} Event data, or null if validation fails
 */
function _lcReadEventForm() {
    var title = (document.getElementById('lcEventTitle').value || '').trim();
    if (!title) { alert('Please enter a title.'); return null; }

    var startDate = document.getElementById('lcEventStartDate').value || '';
    if (!startDate) { alert('Please enter a start date.'); return null; }

    var statusEl = document.querySelector('input[name="lcEventStatus"]:checked');
    var status   = statusEl ? statusEl.value : 'upcoming';

    var data = {
        title:         title,
        categoryId:    document.getElementById('lcEventCategory').value || '',
        startDate:     startDate,
        endDate:       document.getElementById('lcEventEndDate').value || '',
        location:      (document.getElementById('lcEventLocation').value || '').trim(),
        status:        status,
        didntGoReason: status === 'didntgo'
            ? (document.getElementById('lcEventDidntGoReason').value || '').trim()
            : '',
        description:   (document.getElementById('lcEventDescription').value || '').trim(),
        outcome:       (document.getElementById('lcEventOutcome').value || '').trim(),
    };

    var costVal = document.getElementById('lcEventCost').value;
    data.cost = costVal !== '' ? parseFloat(costVal) : null;

    data.peopleIds  = _lcSelectedPeopleIds.slice();
    data.links      = _lcEventLinks.map(function(l) { return { label: l.label, url: l.url }; });
    data.typeFields = _lcReadTypeFields();

    return data;
}

/**
 * Save handler — called from both new and edit form.
 * @param {boolean} isNew - true when creating, false when editing
 */
async function _lcSaveEvent(isNew) {
    var data = _lcReadEventForm();
    if (!data) return;

    var saveBtn = document.getElementById('lcEventSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
        if (isNew) {
            var newId = await lcAddEvent(data);
            _lcEventDirty = false;
            window.location.hash = '#life-event/' + newId;
        } else {
            await lcUpdateEvent(_lcEditingEventId, data);
            _lcEventDirty = false;
            // Update the breadcrumb title in place
            var h2 = document.querySelector('#page-life-event h2');
            if (h2) h2.textContent = data.title;
            var breadcrumbSpan = document.querySelector('#page-life-event .breadcrumb span:last-child');
            if (breadcrumbSpan) breadcrumbSpan.textContent = data.title;
            saveBtn.textContent = 'Saved ✓';
            setTimeout(function() {
                if (document.getElementById('lcEventSaveBtn')) {
                    document.getElementById('lcEventSaveBtn').textContent = 'Save';
                    document.getElementById('lcEventSaveBtn').disabled = false;
                }
            }, 1500);
            return; // don't re-enable below
        }
    } catch (err) {
        console.error('_lcSaveEvent error:', err);
        alert('Save failed. Please try again.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

/**
 * Prompt and delete a life event, then navigate to #life-calendar.
 * @param {string} id - Event doc ID
 */
async function _lcConfirmDeleteEvent(id) {
    if (!confirm('Delete this event? Mini logs and photos will also be deleted. Journal entries will be kept.')) return;
    try {
        await lcDeleteEvent(id);
        _lcEventDirty = false;
        window.location.hash = '#life-calendar';
    } catch (err) {
        console.error('_lcConfirmDeleteEvent error:', err);
        alert('Delete failed. Please try again.');
    }
}

// ============================================================
// Page Loaders — Event pages
// ============================================================

/**
 * Load the New Life Event page (#life-event/new).
 * Pre-fills the date from window._newEventDate if set.
 */
async function loadNewLifeEventPage() {
    const prefillDate = window._newEventDate || '';
    window._newEventDate = null; // consume it
    _lcEditingEventId  = null;
    _lcEventDirty      = false;

    const section = document.getElementById('page-life-event');
    if (!section) return;

    section.innerHTML = '<div class="lc-page-body"><p style="color:var(--text-muted);">Loading…</p></div>';

    try {
        var [categories, people] = await Promise.all([
            lcLoadCategories(),
            lcLoadPeople()
        ]);
        if (categories.length === 0) {
            await lcEnsureDefaultCategories();
            categories = await lcLoadCategories();
        }
        _lcAllPeople      = people;
        _lcAllCategories  = categories;
        _lcRenderEventForm(null, categories, prefillDate);
    } catch (err) {
        console.error('loadNewLifeEventPage error:', err);
        section.innerHTML = '<div class="lc-page-body"><p style="color:var(--danger);">Failed to load. Please refresh.</p></div>';
    }
}

/**
 * Load the Life Event detail/edit page (#life-event/{id}).
 * @param {string} id - Firestore document ID of the life event
 */
async function loadLifeEventPage(id) {
    window.currentLifeEvent = null;
    _lcEditingEventId  = id;
    _lcEventDirty      = false;

    const section = document.getElementById('page-life-event');
    if (!section) return;

    section.innerHTML = '<div class="lc-page-body"><p style="color:var(--text-muted);">Loading…</p></div>';

    try {
        var [eventDoc, categories, people] = await Promise.all([
            userCol('lifeEvents').doc(id).get(),
            lcLoadCategories(),
            lcLoadPeople()
        ]);
        _lcAllPeople     = people;
        _lcAllCategories = categories;

        if (!eventDoc.exists) {
            section.innerHTML = '<div class="lc-page-body"><p style="color:var(--danger);">Event not found.</p></div>';
            return;
        }

        var event = { id: eventDoc.id, ...eventDoc.data() };
        window.currentLifeEvent = event;

        _lcRenderEventForm(event, categories, '');
    } catch (err) {
        console.error('loadLifeEventPage error:', err);
        section.innerHTML = '<div class="lc-page-body"><p style="color:var(--danger);">Failed to load. Please refresh.</p></div>';
    }
}

// ============================================================
// Dirty flag — hashchange guard
// ============================================================

/**
 * Intercepts hash navigation when the event form has unsaved changes.
 * Fires before app.js's handleRoute because this file is loaded first.
 * If the user cancels, we restore the old hash to stay on the form.
 */
window.addEventListener('hashchange', function(e) {
    if (!_lcEventDirty) return;

    // Only guard when we're currently on the event page
    var oldHash = (e.oldURL || '').split('#')[1] || '';
    if (!oldHash.startsWith('life-event')) return;

    if (!confirm('You have unsaved changes. Leave anyway?')) {
        // Restore the old hash without triggering another hashchange
        history.replaceState(null, '', '#' + oldHash);
        // Stop further handlers (app.js's handleRoute) from running
        e.stopImmediatePropagation();
        return;
    }

    // User confirmed — clear the dirty flag so the route proceeds normally
    _lcEventDirty = false;
}, true); // useCapture = true so this fires before app.js's listener
