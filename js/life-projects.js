// ============================================================
// life-projects.js — Life Projects (Vacation, Build, General)
// Rich project management with itineraries, bookings, packing,
// to-dos, notes, and cost tracking.
// ============================================================

// ---------- Constants ----------

const LP_TEMPLATES = {
    vacation: { label: 'Vacation', icon: '✈️', enabled: true },
    build:    { label: 'Build',    icon: '🔨', enabled: false },
    general:  { label: 'General',  icon: '📋', enabled: false }
};

const LP_STATUSES = {
    planning: { label: 'Planning', color: '#2563eb' },
    active:   { label: 'Active',   color: '#16a34a' },
    'on-hold':{ label: 'On Hold',  color: '#d97706' },
    done:     { label: 'Done',     color: '#6b7280' }
};

const LP_DEFAULT_BOOKING_TYPES = [
    'Lodging', 'Flight', 'Car Rental', 'Excursion', 'Sports Event'
];

const LP_VACATION_TODO_STARTERS = [
    'Book flights',
    'Book hotel / lodging',
    'Book rental car',
    'Request time off from work',
    'Arrange pet care',
    'Check passport expiration',
    'Set up mail hold',
    'Download offline maps',
    'Notify bank of travel dates',
    'Print confirmations'
];

// ---------- Collection helpers ----------

/** Get reference to user-scoped lifeProjects collection */
function lpCol() {
    return userCol('lifeProjects');
}

/** Get subcollection under a project doc */
function lpSub(projectId, subName) {
    return lpCol().doc(projectId).collection(subName);
}

// ============================================================
// Project List Page (#life-projects)
// ============================================================

async function loadLifeProjectsPage() {
    // Set breadcrumb in sticky header
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML = '<a href="#life">Life</a><span class="separator">&rsaquo;</span><span>Projects</span>';

    const page = document.getElementById('page-life-projects');
    page.innerHTML = `
        <div class="page-header">
            <button class="back-btn" onclick="location.hash='#life'">&larr;</button>
            <h2 style="flex:1;">Projects</h2>
        </div>
        <div style="padding:16px;">
            <div id="lpShowArchivedWrap" style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <label style="font-size:0.9em; color:#666; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="lpShowArchived" onchange="renderLifeProjectsList()"> Show archived
                </label>
            </div>
            <div id="lpProjectList"></div>
            <div style="display:flex; gap:8px; margin-top:16px;">
                <button class="btn btn-primary" style="flex:1;" onclick="openNewLifeProjectModal()">+ New Project</button>
                <button class="btn" style="flex:0 0 auto;" onclick="document.getElementById('lpImportFileInput').click()">📥 Import</button>
            </div>
            <input type="file" id="lpImportFileInput" accept=".json" style="display:none;" onchange="_lpHandleImportFile(event)">
        </div>

        <!-- Import People Linking Modal -->
        <div class="modal-overlay" id="lpImportPeopleModal">
            <div class="modal">
                <h3>Link People</h3>
                <div id="lpImportPeopleBody"></div>
            </div>
        </div>

        <!-- Import Progress Modal -->
        <div class="modal-overlay" id="lpImportProgressModal">
            <div class="modal">
                <h3>Importing Project…</h3>
                <div id="lpImportProgressBody" style="padding:12px 0;">
                    <p style="color:#666;">Creating project and all data…</p>
                </div>
            </div>
        </div>

        <!-- New/Edit Project Modal -->
        <div class="modal-overlay" id="lpProjectModal">
            <div class="modal">
                <h3 id="lpProjectModalTitle">New Project</h3>
                <div id="lpProjectModalBody"></div>
                <div class="modal-actions">
                    <button class="btn" onclick="closeModal('lpProjectModal')">Cancel</button>
                    <button class="btn btn-primary" id="lpProjectSaveBtn" onclick="saveLifeProject()">Create</button>
                </div>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div class="modal-overlay" id="lpDeleteModal">
            <div class="modal">
                <h3>Delete Project</h3>
                <p id="lpDeleteMsg">Are you sure? This will delete the project and all its data (days, bookings, to-dos, packing list, notes). This cannot be undone.</p>
                <div class="modal-actions">
                    <button class="btn" onclick="closeModal('lpDeleteModal')">Cancel</button>
                    <button class="btn btn-danger" id="lpDeleteConfirmBtn" onclick="confirmDeleteLifeProject()">Delete</button>
                </div>
            </div>
        </div>
    `;

    await renderLifeProjectsList();
}

/** Render the project card list */
async function renderLifeProjectsList() {
    const container = document.getElementById('lpProjectList');
    if (!container) return;
    container.innerHTML = '<p style="color:#999;">Loading projects...</p>';

    try {
        const showArchived = document.getElementById('lpShowArchived')?.checked || false;
        let query = lpCol().orderBy('createdAt', 'desc');
        const snap = await query.get();

        const projects = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (!showArchived && d.archived) return;
            projects.push({ id: doc.id, ...d });
        });

        if (projects.length === 0) {
            container.innerHTML = '<p style="color:#999; text-align:center; margin-top:32px;">No projects yet. Create one to get started!</p>';
            return;
        }

        container.innerHTML = projects.map(p => _lpProjectCard(p)).join('');
    } catch (err) {
        console.error('Error loading life projects:', err);
        container.innerHTML = '<p style="color:red;">Error loading projects.</p>';
    }
}

/** Build HTML for a single project card */
function _lpProjectCard(p) {
    const tpl = LP_TEMPLATES[p.template] || LP_TEMPLATES.general;
    const st = LP_STATUSES[p.status] || LP_STATUSES.planning;
    const dateRange = _lpFormatDateRange(p.startDate, p.endDate);
    const archivedBadge = p.archived ? '<span style="background:#e5e7eb;color:#6b7280;font-size:0.75em;padding:2px 8px;border-radius:12px;margin-left:6px;">Archived</span>' : '';

    return `
        <div class="card" style="margin-bottom:12px; cursor:pointer; ${p.archived ? 'opacity:0.6;' : ''}"
             onclick="location.hash='#life-project/${p.id}'">
            <div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span style="font-size:1.1em;">${tpl.icon}</span>
                    <strong style="font-size:1.05em;">${_lpEsc(p.title)}</strong>
                    ${archivedBadge}
                </div>
                ${p.description ? `<p style="color:#666; font-size:0.9em; margin:4px 0 0;">${_lpEsc(p.description)}</p>` : ''}
                ${dateRange ? `<p style="color:#888; font-size:0.85em; margin:4px 0 0;">${dateRange}</p>` : ''}
                <div style="margin-top:4px;">
                    <span style="background:${st.color};color:#fff;font-size:0.75em;padding:2px 10px;border-radius:12px;white-space:nowrap;">${st.label}</span>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px; justify-content:flex-end;" onclick="event.stopPropagation();">
                <button class="btn btn-small" onclick="openEditLifeProjectModal('${p.id}')" title="Edit">✏️</button>
                <button class="btn btn-small" onclick="toggleArchiveLifeProject('${p.id}', ${!p.archived})" title="${p.archived ? 'Unarchive' : 'Archive'}">${p.archived ? '📤' : '📥'}</button>
                <button class="btn btn-small btn-danger" onclick="openDeleteLifeProject('${p.id}', '${_lpEsc(p.title)}')" title="Delete">🗑️</button>
            </div>
        </div>
    `;
}

/** Format date range for display */
function _lpFormatDateRange(start, end) {
    if (!start) return '';
    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    const s = new Date(start + 'T00:00:00').toLocaleDateString(undefined, opts);
    if (!end) return s;
    const e = new Date(end + 'T00:00:00').toLocaleDateString(undefined, opts);
    return `${s} — ${e}`;
}

// ============================================================
// New / Edit Project Modal
// ============================================================

function openNewLifeProjectModal() {
    const modal = document.getElementById('lpProjectModal');
    modal.dataset.mode = 'add';
    modal.dataset.editId = '';
    document.getElementById('lpProjectModalTitle').textContent = 'New Project';
    document.getElementById('lpProjectSaveBtn').textContent = 'Create';

    document.getElementById('lpProjectModalBody').innerHTML = `
        <div class="form-group" style="margin-bottom:12px;">
            <label>Template</label>
            <div id="lpTemplatePicker" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;">
                ${Object.entries(LP_TEMPLATES).map(([key, t]) => `
                    <button class="btn ${key === 'vacation' ? 'btn-primary' : ''}"
                            data-template="${key}"
                            onclick="_lpPickTemplate('${key}')"
                            ${!t.enabled ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
                        ${t.icon} ${t.label}
                    </button>
                `).join('')}
            </div>
            <input type="hidden" id="lpTemplate" value="vacation">
        </div>
        <div class="form-group" style="margin-bottom:12px;">
            <label for="lpTitle">Title *</label>
            <input type="text" id="lpTitle" class="form-control" placeholder="e.g. Yellowstone 2026">
        </div>
        <div class="form-group" style="margin-bottom:12px;">
            <label for="lpDescription">Description</label>
            <textarea id="lpDescription" class="form-control" rows="2" placeholder="Brief description..."></textarea>
        </div>
        <div style="display:flex; gap:12px; margin-bottom:12px;">
            <div class="form-group" style="flex:1;">
                <label for="lpStartDate">Start Date</label>
                <input type="date" id="lpStartDate" class="form-control">
            </div>
            <div class="form-group" style="flex:1;">
                <label for="lpEndDate">End Date</label>
                <input type="date" id="lpEndDate" class="form-control">
            </div>
        </div>
    `;

    openModal('lpProjectModal');
}

function openEditLifeProjectModal(projectId) {
    const modal = document.getElementById('lpProjectModal');
    modal.dataset.mode = 'edit';
    modal.dataset.editId = projectId;
    document.getElementById('lpProjectModalTitle').textContent = 'Edit Project';
    document.getElementById('lpProjectSaveBtn').textContent = 'Save';

    // Load project data and populate
    lpCol().doc(projectId).get().then(doc => {
        if (!doc.exists) { alert('Project not found.'); return; }
        const p = doc.data();

        document.getElementById('lpProjectModalBody').innerHTML = `
            <div class="form-group" style="margin-bottom:12px;">
                <label>Template</label>
                <p style="margin:4px 0; color:#666;">${(LP_TEMPLATES[p.template] || LP_TEMPLATES.general).icon} ${(LP_TEMPLATES[p.template] || LP_TEMPLATES.general).label} <span style="font-size:0.8em; color:#999;">(locked)</span></p>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="lpTitle">Title *</label>
                <input type="text" id="lpTitle" class="form-control" value="${_lpEsc(p.title || '')}">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="lpDescription">Description</label>
                <textarea id="lpDescription" class="form-control" rows="2">${_lpEsc(p.description || '')}</textarea>
            </div>
            <div style="display:flex; gap:12px; margin-bottom:12px;">
                <div class="form-group" style="flex:1;">
                    <label for="lpStartDate">Start Date</label>
                    <input type="date" id="lpStartDate" class="form-control" value="${p.startDate || ''}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label for="lpEndDate">End Date</label>
                    <input type="date" id="lpEndDate" class="form-control" value="${p.endDate || ''}">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="lpStatus">Status</label>
                <select id="lpStatus" class="form-control">
                    ${Object.entries(LP_STATUSES).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
            </div>
        `;

        openModal('lpProjectModal');
    });
}

/** Template picker highlight */
function _lpPickTemplate(key) {
    document.querySelectorAll('#lpTemplatePicker button').forEach(btn => {
        btn.classList.toggle('btn-primary', btn.dataset.template === key);
    });
    document.getElementById('lpTemplate').value = key;
}

/** Save new or updated project */
async function saveLifeProject() {
    const modal = document.getElementById('lpProjectModal');
    const mode = modal.dataset.mode;
    const editId = modal.dataset.editId;

    const title = document.getElementById('lpTitle')?.value.trim();
    if (!title) { alert('Title is required.'); return; }

    const description = document.getElementById('lpDescription')?.value.trim() || '';
    const startDate = document.getElementById('lpStartDate')?.value || null;
    const endDate = document.getElementById('lpEndDate')?.value || null;

    try {
        if (mode === 'add') {
            const template = document.getElementById('lpTemplate')?.value || 'vacation';
            const now = firebase.firestore.FieldValue.serverTimestamp();

            const docData = {
                title,
                description,
                template,
                status: 'planning',
                mode: 'planning',
                archived: false,
                startDate,
                endDate,
                targetType: 'life',
                targetId: null,
                people: [],
                bookingTypes: [...LP_DEFAULT_BOOKING_TYPES],
                createdAt: now,
                updatedAt: now
            };

            const ref = await lpCol().add(docData);

            // Auto-populate vacation starter to-do items
            if (template === 'vacation') {
                const batch = firebase.firestore().batch();
                LP_VACATION_TODO_STARTERS.forEach((text, i) => {
                    const todoRef = lpSub(ref.id, 'todoItems').doc();
                    batch.set(todoRef, { text, done: false, notes: '', sortOrder: i });
                });
                await batch.commit();
            }

            closeModal('lpProjectModal');
            // Navigate to the new project detail — delay so closeModal's
            // history.back() settles before we push a new hash
            setTimeout(() => { location.hash = `#life-project/${ref.id}`; }, 50);
        } else {
            // Edit mode
            const status = document.getElementById('lpStatus')?.value || 'planning';
            await lpCol().doc(editId).update({
                title,
                description,
                startDate,
                endDate,
                status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            closeModal('lpProjectModal');
            await renderLifeProjectsList();
        }
    } catch (err) {
        console.error('Error saving life project:', err);
        alert('Error saving project. Please try again.');
    }
}

// ============================================================
// Archive / Delete
// ============================================================

async function toggleArchiveLifeProject(projectId, archive) {
    try {
        await lpCol().doc(projectId).update({
            archived: archive,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await renderLifeProjectsList();
    } catch (err) {
        console.error('Error archiving project:', err);
        alert('Error updating project.');
    }
}

/** Store project ID pending deletion */
let _lpDeleteId = null;

function openDeleteLifeProject(projectId, title) {
    _lpDeleteId = projectId;
    document.getElementById('lpDeleteMsg').textContent =
        `Are you sure you want to delete "${title}"? This will delete the project and all its data (days, bookings, to-dos, packing list, notes). This cannot be undone.`;
    openModal('lpDeleteModal');
}

/** Cascade delete: remove all subcollections then the project doc */
async function confirmDeleteLifeProject() {
    if (!_lpDeleteId) return;
    const projectId = _lpDeleteId;
    _lpDeleteId = null;
    closeModal('lpDeleteModal');

    try {
        // Delete all subcollections
        const subs = ['days', 'bookings', 'bookingPhotos', 'todoItems', 'packingItems', 'projectNotes'];
        for (const sub of subs) {
            const snap = await lpSub(projectId, sub).get();
            if (!snap.empty) {
                const batch = firebase.firestore().batch();
                snap.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
        // Delete the project doc
        await lpCol().doc(projectId).delete();
        await renderLifeProjectsList();
    } catch (err) {
        console.error('Error deleting life project:', err);
        alert('Error deleting project. Please try again.');
    }
}

// ============================================================
// Project Detail Page (#life-project/:id)
// ============================================================

/** Current project state — shared across accordion sections */
let _lpCurrentProject = null;
let _lpCurrentProjectId = null;

async function loadLifeProjectDetailPage(projectId) {
    _lpCurrentProjectId = projectId;
    const page = document.getElementById('page-life-project');

    // Set breadcrumb — will update with project title after load
    var crumb = document.getElementById('breadcrumbBar');
    if (crumb) crumb.innerHTML = '<a href="#life">Life</a><span class="separator">&rsaquo;</span><a href="#life-projects">Projects</a><span class="separator">&rsaquo;</span><span>Loading...</span>';

    page.innerHTML = '<div style="padding:16px;"><p style="color:#999;">Loading project...</p></div>';

    try {
        const doc = await lpCol().doc(projectId).get();
        if (!doc.exists) {
            page.innerHTML = '<div style="padding:16px;"><p style="color:red;">Project not found.</p></div>';
            return;
        }
        _lpCurrentProject = { id: doc.id, ...doc.data() };
        // Update breadcrumb with project title
        var crumb = document.getElementById('breadcrumbBar');
        if (crumb) crumb.innerHTML = '<a href="#life">Life</a><span class="separator">&rsaquo;</span><a href="#life-projects">Projects</a><span class="separator">&rsaquo;</span><span>' + _lpEsc(_lpCurrentProject.title) + '</span>';
        _lpRenderDetailPage(page);
    } catch (err) {
        console.error('Error loading project detail:', err);
        page.innerHTML = '<div style="padding:16px;"><p style="color:red;">Error loading project.</p></div>';
    }
}

function _lpRenderDetailPage(page) {
    const p = _lpCurrentProject;
    const tpl = LP_TEMPLATES[p.template] || LP_TEMPLATES.general;
    const st = LP_STATUSES[p.status] || LP_STATUSES.planning;
    const dateRange = _lpFormatDateRange(p.startDate, p.endDate);
    const travel = _lpIsTravelMode();

    page.innerHTML = `
        <div class="page-header" style="flex-wrap:wrap; gap:8px;">
            <button class="back-btn" onclick="location.hash='#life-projects'">&larr;</button>
            <h2 style="flex:1; min-width:0;">${tpl.icon} ${_lpEsc(p.title)}</h2>
            <div style="display:flex; gap:6px; align-items:center;">
                <span style="background:${st.color};color:#fff;font-size:0.75em;padding:2px 10px;border-radius:12px;">${st.label}</span>
                <button class="btn btn-small" onclick="_lpToggleMode()" id="lpModeToggle" title="Switch mode">
                    ${p.mode === 'travel' ? '🧳 Travel' : '📝 Planning'}
                </button>
            </div>
        </div>
        <div style="padding:16px;">
            ${dateRange ? `<p style="color:#888; font-size:0.9em; margin-bottom:12px;">${dateRange}</p>` : ''}
            ${p.description ? `<p style="color:#555; margin-bottom:16px;">${_lpEsc(p.description)}</p>` : ''}

            <!-- Search box -->
            <div style="margin-bottom:12px;">
                <input type="text" id="lpSearchBox" class="form-control" placeholder="Search project..." oninput="_lpFilterBySearch(this.value)" style="font-size:0.9em;">
            </div>

            <!-- Accordion sections -->
            <div id="lpAccordion">
                ${_lpAccordionSection('tripInfo', '📍 Trip Info', '', true)}
                ${_lpAccordionSection('people', '👥 People', _lpPeopleSummary(p), false)}
                ${travel ? '' : _lpAccordionSection('todos', '☑️ To-Do', '', false)}
                ${_lpAccordionSection('itinerary', '📅 Itinerary', '', travel)}
                ${_lpAccordionSection('bookings', '🏨 Bookings', '', travel)}
                ${_lpAccordionSection('packing', '🧳 Packing', '', false)}
                ${travel ? '' : _lpAccordionSection('notes', '📝 Notes', '', false)}
            </div>
        </div>
    `;

    // Load bookings + days first so Trip Info can show cost rollup, then load visible sections
    _lpLoadInitialData().then(() => {
        _lpLoadTripInfo();
        if (!travel) _lpLoadTodos();
        if (travel) { _lpLoadItinerary(); _lpLoadBookings(); }
    });
}

/** Pre-load bookings and days data for cost rollup and booking badges */
async function _lpLoadInitialData() {
    if (!_lpCurrentProjectId) return;
    try {
        const [daySnap, bookingSnap] = await Promise.all([
            lpSub(_lpCurrentProjectId, 'days').orderBy('sortOrder').get(),
            lpSub(_lpCurrentProjectId, 'bookings').orderBy('sortOrder').get()
        ]);
        _lpDays = [];
        daySnap.forEach(doc => _lpDays.push({ id: doc.id, ...doc.data() }));
        _lpBookings = [];
        bookingSnap.forEach(doc => _lpBookings.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
        console.error('Error pre-loading data:', err);
    }
}

/** Build an accordion section shell */
function _lpAccordionSection(id, title, summary, expanded) {
    return `
        <div class="lp-accordion-section" id="lpAcc_${id}" data-expanded="${expanded}">
            <div class="lp-accordion-header" onclick="_lpToggleAccordion('${id}')" style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; margin-bottom:4px; user-select:none;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="lp-accordion-arrow" id="lpArrow_${id}" style="transition:transform 0.2s; display:inline-block; ${expanded ? 'transform:rotate(90deg);' : ''}"">▶</span>
                    <strong>${title}</strong>
                    ${summary ? `<span style="color:#888; font-size:0.85em; margin-left:4px;">${summary}</span>` : ''}
                </div>
            </div>
            <div class="lp-accordion-body" id="lpBody_${id}" style="padding:12px 8px; ${expanded ? '' : 'display:none;'}">
                <p style="color:#999; font-size:0.9em;">Loading...</p>
            </div>
        </div>
    `;
}

/** Toggle an accordion section open/closed */
function _lpToggleAccordion(id) {
    const section = document.getElementById(`lpAcc_${id}`);
    const body = document.getElementById(`lpBody_${id}`);
    const arrow = document.getElementById(`lpArrow_${id}`);
    const isExpanded = section.dataset.expanded === 'true';

    if (isExpanded) {
        body.style.display = 'none';
        arrow.style.transform = '';
        section.dataset.expanded = 'false';
    } else {
        body.style.display = '';
        arrow.style.transform = 'rotate(90deg)';
        section.dataset.expanded = 'true';
        // Lazy-load content on first expand
        _lpLoadAccordionContent(id);
    }
}

/** Load content for an accordion section (lazy) */
function _lpLoadAccordionContent(id) {
    switch (id) {
        case 'tripInfo': _lpLoadTripInfo(); break;
        case 'people':   _lpLoadPeople(); break;
        case 'todos':    _lpLoadTodos(); break;
        case 'itinerary': _lpLoadItinerary(); break;
        case 'bookings': _lpLoadBookings(); break;
        case 'packing':  _lpLoadPacking(); break;
        case 'notes':    _lpLoadNotes(); break;
    }
}

/** Is the project currently in travel mode? */
function _lpIsTravelMode() {
    return _lpCurrentProject && _lpCurrentProject.mode === 'travel';
}

/** Toggle planning/travel mode — re-renders the entire detail page */
async function _lpToggleMode() {
    if (!_lpCurrentProjectId || !_lpCurrentProject) return;
    const newMode = _lpCurrentProject.mode === 'travel' ? 'planning' : 'travel';
    try {
        await lpCol().doc(_lpCurrentProjectId).update({ mode: newMode, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        _lpCurrentProject.mode = newMode;
        // Re-render entire detail page to apply mode filtering
        const page = document.getElementById('page-life-project');
        _lpRenderDetailPage(page);
    } catch (err) {
        console.error('Error toggling mode:', err);
    }
}

// ============================================================
// Trip Info Section
// ============================================================

function _lpLoadTripInfo() {
    const body = document.getElementById('lpBody_tripInfo');
    if (!body || !_lpCurrentProject) return;
    const p = _lpCurrentProject;
    const costRollup = _lpCalculateCostRollup();

    body.innerHTML = `
        <div style="display:grid; gap:8px;">
            ${p.startDate ? `<div><strong>Dates:</strong> ${_lpFormatDateRange(p.startDate, p.endDate)}</div>` : '<div style="color:#999;">No dates set</div>'}
            ${p.description ? `<div><strong>Description:</strong> ${_lpEsc(p.description)}</div>` : ''}
            ${costRollup.total > 0 ? `<div style="font-size:1.05em;"><strong>Total Trip Cost:</strong> <span style="color:#16a34a; font-weight:700;">$${costRollup.total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span> <span style="color:#888; font-size:0.8em;">(bookings: $${costRollup.bookings.toFixed(2)}, activities: $${costRollup.items.toFixed(2)})</span></div>` : ''}
            <div style="color:#999; font-size:0.85em;">Edit project metadata from the list page (✏️ button).</div>
        </div>
    `;
}

/** Calculate total cost from bookings + day items */
function _lpCalculateCostRollup() {
    let bookingTotal = 0;
    _lpBookings.forEach(b => { if (b.cost != null && !isNaN(b.cost)) bookingTotal += Number(b.cost); });
    let itemTotal = 0;
    _lpDays.forEach(d => (d.items || []).forEach(it => { if (it.cost != null && !isNaN(it.cost)) itemTotal += Number(it.cost); }));
    return { bookings: bookingTotal, items: itemTotal, total: bookingTotal + itemTotal };
}

// ============================================================
// People Section
// ============================================================

function _lpPeopleSummary(p) {
    if (!p.people || p.people.length === 0) return '';
    return `(${p.people.length})`;
}

/** All contacts cache for people picker */
let _lpAllPeople = null;

async function _lpEnsurePeopleCache() {
    if (_lpAllPeople) return _lpAllPeople;
    const snap = await userCol('people').orderBy('name').get();
    _lpAllPeople = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || '' }));
    return _lpAllPeople;
}

async function _lpLoadPeople() {
    const body = document.getElementById('lpBody_people');
    if (!body || !_lpCurrentProject) return;
    const people = _lpCurrentProject.people || [];

    // Load contacts cache
    await _lpEnsurePeopleCache();

    body.innerHTML = `
        <div class="lc-people-chips" id="lpPeopleChips"></div>
        <div class="lc-people-picker-wrap">
            <input type="text" id="lpPeopleSearch" class="form-control"
                   placeholder="Search by name…" autocomplete="off">
            <ul class="lc-people-dropdown hidden" id="lpPeopleDropdown"></ul>
        </div>
    `;

    // Render existing people as chips
    _lpRenderPeopleChips();

    // Wire search input
    const searchEl = document.getElementById('lpPeopleSearch');
    const dropEl   = document.getElementById('lpPeopleDropdown');

    searchEl.addEventListener('input', function() {
        const q = this.value.trim().toLowerCase();
        if (!q) { dropEl.classList.add('hidden'); dropEl.innerHTML = ''; return; }

        const selectedIds = (people).map(p => p.contactId).filter(Boolean);
        const matches = _lpAllPeople.filter(p =>
            p.name.toLowerCase().includes(q) && !selectedIds.includes(p.id)
        );

        if (matches.length === 0) {
            dropEl.innerHTML = '<li class="lc-people-no-match">No matches</li>';
            dropEl.classList.remove('hidden');
            return;
        }

        dropEl.innerHTML = matches.map(p =>
            `<li data-id="${p.id}" data-name="${_lpEsc(p.name)}">${_lpEsc(p.name)}</li>`
        ).join('');
        dropEl.classList.remove('hidden');

        dropEl.querySelectorAll('li[data-id]').forEach(li => {
            li.addEventListener('click', function() {
                _lpAddPersonFromContact(li.dataset.id, li.dataset.name);
                searchEl.value = '';
                dropEl.innerHTML = '';
                dropEl.classList.add('hidden');
            });
        });
    });

    // Enter key: if exactly one match (or first match), add it
    searchEl.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const q = this.value.trim().toLowerCase();
        if (!q) return;
        const selectedIds = (_lpCurrentProject.people || []).map(p => p.contactId).filter(Boolean);
        const matches = _lpAllPeople.filter(p =>
            p.name.toLowerCase().includes(q) && !selectedIds.includes(p.id)
        );
        if (matches.length >= 1) {
            _lpAddPersonFromContact(matches[0].id, matches[0].name);
            searchEl.value = '';
            dropEl.innerHTML = '';
            dropEl.classList.add('hidden');
        }
    });

    // Close dropdown on outside click
    document.addEventListener('click', function _lpPickerOutside(e) {
        if (!e.target.closest('#lpPeopleSearch') && !e.target.closest('#lpPeopleDropdown')) {
            dropEl.classList.add('hidden');
            document.removeEventListener('click', _lpPickerOutside);
        }
    });
}

function _lpRenderPeopleChips() {
    const container = document.getElementById('lpPeopleChips');
    if (!container) return;
    container.innerHTML = '';

    const people = _lpCurrentProject.people || [];
    people.forEach((p, i) => {
        const chip = document.createElement('span');
        chip.className = 'lc-person-chip';
        const nameText = p.contactId
            ? `<a href="#person/${p.contactId}" class="lc-chip-name">${_lpEsc(p.name)}</a>`
            : `<span class="lc-chip-name">${_lpEsc(p.name)}</span>`;
        chip.innerHTML = nameText +
            `<button type="button" class="lc-chip-remove" title="Remove">✕</button>`;

        chip.querySelector('.lc-chip-remove').addEventListener('click', () => _lpRemovePerson(i));
        container.appendChild(chip);
    });
}

async function _lpAddPersonFromContact(contactId, name) {
    const people = [...(_lpCurrentProject.people || [])];
    if (people.some(p => p.contactId === contactId)) return; // already added
    people.push({ name: name.trim(), contactId: contactId, notes: '' });

    try {
        await lpCol().doc(_lpCurrentProjectId).update({
            people,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        _lpCurrentProject.people = people;
        _lpRenderPeopleChips();
        _lpUpdateAccordionSummary('people', _lpPeopleSummary(_lpCurrentProject));
    } catch (err) {
        console.error('Error adding person:', err);
    }
}

async function _lpEditPerson(index) {
    const people = [...(_lpCurrentProject.people || [])];
    if (index < 0 || index >= people.length) return;

    const notes = prompt('Notes for ' + people[index].name + ':', people[index].notes || '') || '';
    people[index] = { ...people[index], notes: notes.trim() };

    try {
        await lpCol().doc(_lpCurrentProjectId).update({
            people,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        _lpCurrentProject.people = people;
    } catch (err) {
        console.error('Error editing person:', err);
    }
}

async function _lpRemovePerson(index) {
    const people = [...(_lpCurrentProject.people || [])];
    people.splice(index, 1);

    try {
        await lpCol().doc(_lpCurrentProjectId).update({
            people,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        _lpCurrentProject.people = people;
        _lpRenderPeopleChips();
        _lpUpdateAccordionSummary('people', _lpPeopleSummary(_lpCurrentProject));
    } catch (err) {
        console.error('Error removing person:', err);
    }
}

// ============================================================
// To-Do Section
// ============================================================

let _lpTodos = [];

async function _lpLoadTodos() {
    const body = document.getElementById('lpBody_todos');
    if (!body || !_lpCurrentProjectId) return;

    try {
        const snap = await lpSub(_lpCurrentProjectId, 'todoItems').orderBy('sortOrder').get();
        _lpTodos = [];
        snap.forEach(doc => _lpTodos.push({ id: doc.id, ...doc.data() }));
        _lpRenderTodos(body);
    } catch (err) {
        console.error('Error loading todos:', err);
        body.innerHTML = '<p style="color:red;">Error loading to-dos.</p>';
    }
}

function _lpRenderTodos(body) {
    const doneCount = _lpTodos.filter(t => t.done).length;
    const total = _lpTodos.length;

    // Update accordion summary
    const header = document.querySelector('#lpAcc_todos .lp-accordion-header strong');
    if (header) {
        const parent = header.parentElement;
        const existing = parent.querySelector('.lp-summary');
        if (existing) existing.remove();
        if (total > 0) {
            const span = document.createElement('span');
            span.className = 'lp-summary';
            span.style.cssText = 'color:#888; font-size:0.85em; margin-left:4px;';
            span.textContent = `(${doneCount}/${total})`;
            parent.appendChild(span);
        }
    }

    if (total === 0) {
        body.innerHTML = `
            <p style="color:#999; font-size:0.9em;">No to-do items yet.</p>
            <button class="btn btn-small btn-primary" onclick="_lpAddTodo()">+ Add Item</button>
        `;
        return;
    }

    body.innerHTML = `
        <div id="lpTodoList">
            ${_lpTodos.map(t => _lpTodoItem(t)).join('')}
        </div>
        <button class="btn btn-small btn-primary" style="margin-top:8px;" onclick="_lpAddTodo()">+ Add Item</button>
    `;

    // Initialize SortableJS if available
    if (typeof Sortable !== 'undefined') {
        const list = document.getElementById('lpTodoList');
        if (list) {
            Sortable.create(list, {
                animation: 150,
                handle: '.lp-drag-handle',
                onEnd: _lpReorderTodos
            });
        }
    }
}

function _lpTodoItem(t) {
    return `
        <div class="lp-todo-item" data-id="${t.id}" style="display:flex; align-items:flex-start; gap:8px; padding:6px 4px; border-bottom:1px solid #f0f0f0;">
            <span class="lp-drag-handle" style="cursor:grab; color:#ccc; padding:2px;">⠿</span>
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="_lpToggleTodo('${t.id}', this.checked)" style="margin-top:3px;">
            <div style="flex:1; min-width:0;">
                <span style="${t.done ? 'text-decoration:line-through; color:#999;' : ''}">${_lpEsc(t.text)}</span>
                ${t.notes ? `<div style="color:#888; font-size:0.85em; margin-top:2px;">${_lpEsc(t.notes)}</div>` : ''}
            </div>
            <div style="display:flex; gap:2px; flex-shrink:0;">
                <button class="btn btn-small" onclick="_lpEditTodo('${t.id}')" title="Edit" style="padding:2px 6px;">✏️</button>
                <button class="btn btn-small btn-danger" onclick="_lpDeleteTodo('${t.id}')" title="Delete" style="padding:2px 6px;">✕</button>
            </div>
        </div>
    `;
}

async function _lpAddTodo() {
    const text = prompt('To-do item:');
    if (!text || !text.trim()) return;
    const notes = prompt('Notes (optional):') || '';

    const maxOrder = _lpTodos.reduce((max, t) => Math.max(max, t.sortOrder || 0), -1);

    try {
        await lpSub(_lpCurrentProjectId, 'todoItems').add({
            text: text.trim(),
            done: false,
            notes: notes.trim(),
            sortOrder: maxOrder + 1
        });
        await _lpLoadTodos();
    } catch (err) {
        console.error('Error adding todo:', err);
        alert('Error adding to-do item.');
    }
}

async function _lpToggleTodo(todoId, done) {
    try {
        await lpSub(_lpCurrentProjectId, 'todoItems').doc(todoId).update({ done });
        const t = _lpTodos.find(t => t.id === todoId);
        if (t) t.done = done;
        // Re-render to update summary count
        const body = document.getElementById('lpBody_todos');
        if (body) _lpRenderTodos(body);
    } catch (err) {
        console.error('Error toggling todo:', err);
    }
}

async function _lpEditTodo(todoId) {
    const t = _lpTodos.find(t => t.id === todoId);
    if (!t) return;

    const text = prompt('To-do item:', t.text);
    if (!text || !text.trim()) return;
    const notes = prompt('Notes:', t.notes || '') || '';

    try {
        await lpSub(_lpCurrentProjectId, 'todoItems').doc(todoId).update({
            text: text.trim(),
            notes: notes.trim()
        });
        await _lpLoadTodos();
    } catch (err) {
        console.error('Error editing todo:', err);
    }
}

async function _lpDeleteTodo(todoId) {
    if (!confirm('Delete this to-do item?')) return;
    try {
        await lpSub(_lpCurrentProjectId, 'todoItems').doc(todoId).delete();
        await _lpLoadTodos();
    } catch (err) {
        console.error('Error deleting todo:', err);
    }
}

async function _lpReorderTodos(evt) {
    const items = document.querySelectorAll('#lpTodoList .lp-todo-item');
    const batch = firebase.firestore().batch();
    items.forEach((el, i) => {
        const id = el.dataset.id;
        batch.update(lpSub(_lpCurrentProjectId, 'todoItems').doc(id), { sortOrder: i });
    });
    try {
        await batch.commit();
        // Update local state
        const idOrder = Array.from(items).map(el => el.dataset.id);
        _lpTodos.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
        _lpTodos.forEach((t, i) => t.sortOrder = i);
    } catch (err) {
        console.error('Error reordering todos:', err);
    }
}

// ============================================================
// Itinerary Section — Days + Items
// ============================================================

const LP_ITEM_STATUSES = {
    confirmed: { label: 'Confirmed', color: '#16a34a', bg: '#dcfce7' },
    maybe:     { label: 'Maybe',     color: '#d97706', bg: '#fef3c7' },
    idea:      { label: 'Idea',      color: '#2563eb', bg: '#dbeafe' },
    nope:      { label: 'Nope',      color: '#6b7280', bg: '#f3f4f6' }
};

let _lpDays = [];

async function _lpLoadItinerary() {
    const body = document.getElementById('lpBody_itinerary');
    if (!body || !_lpCurrentProjectId) return;

    try {
        // Load bookings in parallel (needed for booking badges on items)
        const [daySnap, bookingSnap] = await Promise.all([
            lpSub(_lpCurrentProjectId, 'days').orderBy('sortOrder').get(),
            lpSub(_lpCurrentProjectId, 'bookings').orderBy('sortOrder').get()
        ]);
        _lpDays = [];
        daySnap.forEach(doc => _lpDays.push({ id: doc.id, ...doc.data() }));
        _lpBookings = [];
        bookingSnap.forEach(doc => _lpBookings.push({ id: doc.id, ...doc.data() }));
        _lpRenderItinerary(body);
    } catch (err) {
        console.error('Error loading itinerary:', err);
        body.innerHTML = '<p style="color:red;">Error loading itinerary.</p>';
    }
}

function _lpRenderItinerary(body) {
    const total = _lpDays.length;

    // Update accordion summary
    _lpUpdateAccordionSummary('itinerary', total > 0 ? `(${total} day${total !== 1 ? 's' : ''})` : '');

    if (total === 0) {
        const hasDateRange = _lpCurrentProject.startDate && _lpCurrentProject.endDate;
        body.innerHTML = `
            <p style="color:#999; font-size:0.9em;">No days yet.</p>
            ${hasDateRange ? `<button class="btn btn-small btn-primary" style="margin-right:8px;" onclick="_lpAutoGenerateDays()">Generate Days from Dates</button>` : ''}
            <button class="btn btn-small" onclick="_lpAddDay()">+ Add Day Manually</button>
        `;
        return;
    }

    body.innerHTML = `
        <div id="lpDayList">
            ${_lpDays.map(d => _lpDayCard(d)).join('')}
        </div>
        <div style="display:flex; gap:8px; margin-top:12px;">
            <button class="btn btn-small btn-primary" onclick="_lpAddDay()">+ Add Day</button>
        </div>
    `;

    // SortableJS for day reorder
    if (typeof Sortable !== 'undefined') {
        const list = document.getElementById('lpDayList');
        if (list) {
            Sortable.create(list, {
                animation: 150,
                handle: '.lp-day-drag',
                onEnd: _lpReorderDays
            });
        }
    }

    // SortableJS for items within each day
    if (typeof Sortable !== 'undefined') {
        _lpDays.forEach(d => {
            const itemList = document.getElementById(`lpItems_${d.id}`);
            if (itemList && itemList.children.length > 0) {
                Sortable.create(itemList, {
                    animation: 150,
                    handle: '.lp-item-drag',
                    onEnd: (evt) => _lpReorderItems(d.id, evt)
                });
            }
        });
    }
}

/** Update an accordion section's summary text */
function _lpUpdateAccordionSummary(sectionId, text) {
    const header = document.querySelector(`#lpAcc_${sectionId} .lp-accordion-header strong`);
    if (!header) return;
    const parent = header.parentElement;
    const existing = parent.querySelector('.lp-summary');
    if (existing) existing.remove();
    if (text) {
        const span = document.createElement('span');
        span.className = 'lp-summary';
        span.style.cssText = 'color:#888; font-size:0.85em; margin-left:4px;';
        span.textContent = text;
        parent.appendChild(span);
    }
}

// ---------- Day card rendering ----------

function _lpDayCard(d) {
    let items = (d.items || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    // Travel mode: hide maybe/idea/nope items
    if (_lpIsTravelMode()) items = items.filter(it => it.status === 'confirmed');
    const dateLabel = d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';

    return `
        <div class="lp-day-card" data-id="${d.id}" style="border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px; overflow:hidden;">
            <div style="background:#f1f5f9; padding:10px 12px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="lp-day-drag" style="cursor:grab; color:#ccc;">⠿</span>
                    <strong>${_lpEsc(d.label || dateLabel || 'Day')}</strong>
                    ${d.location ? `<span style="color:#666; font-size:0.9em;">— ${_lpEsc(d.location)}</span>` : ''}
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-small" onclick="_lpEditDay('${d.id}')" title="Edit day">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="_lpDeleteDay('${d.id}')" title="Delete day">✕</button>
                </div>
            </div>
            <div style="padding:8px 12px;">
                <div id="lpItems_${d.id}">
                    ${items.map(item => _lpItemRow(d.id, item)).join('')}
                </div>
                ${items.length === 0 ? '<p style="color:#bbb; font-size:0.85em; margin:4px 0;">No items yet.</p>' : ''}
                <button class="btn btn-small" style="margin-top:6px;" onclick="_lpAddItem('${d.id}')">+ Add Item</button>
            </div>
        </div>
    `;
}

// ---------- Day item rendering ----------

function _lpItemRow(dayId, item) {
    const st = LP_ITEM_STATUSES[item.status] || LP_ITEM_STATUSES.idea;
    const hasDetails = item.time || item.cost || item.duration || item.notes || item.confirmation || item.contact || (item.links && item.links.length);

    return `
        <div class="lp-item-row" data-item-id="${item.id}" style="padding:6px 0; border-bottom:1px solid #f0f0f0;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="lp-item-drag" style="cursor:grab; color:#ccc; font-size:0.8em;">⠿</span>
                <span style="background:${st.bg};color:${st.color};font-size:0.7em;padding:1px 8px;border-radius:10px;font-weight:600;">${st.label}</span>
                ${item.time ? `<span style="color:#888; font-size:0.85em;">${_lpEsc(item.time)}</span>` : ''}
                <span style="flex:1; min-width:0; font-weight:500;">${_lpEsc(item.title)}</span>
                ${_lpBookingBadge(item.bookingRef)}
                ${item.showOnCalendar ? '<span title="On calendar" style="font-size:0.75em;">📅</span>' : ''}
                <div style="display:flex; gap:2px; flex-shrink:0;">
                    <button class="btn btn-small" onclick="_lpToggleItemDetails('${dayId}','${item.id}')" title="${hasDetails ? 'Show details' : 'Show details'}" style="padding:2px 6px;">${hasDetails ? '📋' : '▿'}</button>
                    <button class="btn btn-small" onclick="_lpEditItem('${dayId}','${item.id}')" title="Edit" style="padding:2px 6px;">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="_lpDeleteItem('${dayId}','${item.id}')" title="Delete" style="padding:2px 6px;">✕</button>
                </div>
            </div>
            <div class="lp-item-details" id="lpItemDetails_${dayId}_${item.id}" style="display:none; margin-top:6px; padding-left:28px; font-size:0.88em; color:#555;">
                ${_lpItemDetailsContent(item)}
            </div>
        </div>
    `;
}

function _lpItemDetailsContent(item) {
    const travel = _lpIsTravelMode();
    const parts = [];
    if (item.duration) parts.push(`<div><strong>Duration:</strong> ${_lpEsc(item.duration)}</div>`);
    if (!travel && item.cost != null && item.cost !== '') parts.push(`<div><strong>Cost:</strong> $${Number(item.cost).toFixed(2)}${item.costNote ? ` <span style="color:#888;">(${_lpEsc(item.costNote)})</span>` : ''}</div>`);
    // In travel mode, confirmation and contact are prominent
    if (item.confirmation) parts.push(`<div${travel ? ' style="font-size:1.05em;"' : ''}><strong>Confirmation:</strong> ${_lpEsc(item.confirmation)}</div>`);
    if (item.contact) parts.push(`<div${travel ? ' style="font-size:1.05em;"' : ''}><strong>Contact:</strong> ${_lpEsc(item.contact)}</div>`);
    if (!travel && item.notes) parts.push(`<div><strong>Notes:</strong> ${_lpEsc(item.notes)}</div>`);
    if (!travel && item.links && item.links.length) {
        const linkHtml = item.links.map(l => `<a href="${_lpEsc(l.url)}" target="_blank" rel="noopener" style="color:#2563eb;">${_lpEsc(l.label || l.url)}</a>`).join(', ');
        parts.push(`<div><strong>Links:</strong> ${linkHtml}</div>`);
    }
    return parts.length ? parts.join('') : '<span style="color:#bbb;">No additional details.</span>';
}

function _lpToggleItemDetails(dayId, itemId) {
    const el = document.getElementById(`lpItemDetails_${dayId}_${itemId}`);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

// ---------- Auto-generate days ----------

async function _lpAutoGenerateDays() {
    const p = _lpCurrentProject;
    if (!p.startDate || !p.endDate) { alert('Set start and end dates first.'); return; }

    const preDays = parseInt(prompt('How many travel/pre-trip days before the start date?', '1') || '0', 10);
    const postDays = parseInt(prompt('How many travel/post-trip days after the end date?', '1') || '0', 10);

    const start = new Date(p.startDate + 'T00:00:00');
    const end = new Date(p.endDate + 'T00:00:00');

    // Build array of dates
    const dates = [];
    const actualStart = new Date(start);
    actualStart.setDate(actualStart.getDate() - Math.max(0, preDays));
    const actualEnd = new Date(end);
    actualEnd.setDate(actualEnd.getDate() + Math.max(0, postDays));

    for (let d = new Date(actualStart); d <= actualEnd; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
    }

    if (dates.length > 60) { alert('Too many days (max 60). Adjust your dates.'); return; }
    if (!confirm(`This will create ${dates.length} days. Continue?`)) return;

    try {
        const batch = firebase.firestore().batch();
        const existingMax = _lpDays.reduce((max, d) => Math.max(max, d.sortOrder || 0), -1);

        dates.forEach((dt, i) => {
            const iso = dt.toISOString().split('T')[0];
            const dayNum = i + 1;
            const dayOfWeek = dt.toLocaleDateString(undefined, { weekday: 'short' });
            const monthDay = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const label = `Day ${dayNum} — ${dayOfWeek} ${monthDay}`;

            const ref = lpSub(_lpCurrentProjectId, 'days').doc();
            batch.set(ref, {
                date: iso,
                label,
                location: '',
                sortOrder: existingMax + 1 + i,
                items: []
            });
        });
        await batch.commit();
        await _lpLoadItinerary();
    } catch (err) {
        console.error('Error generating days:', err);
        alert('Error generating days.');
    }
}

// ---------- Day CRUD ----------

async function _lpAddDay() {
    const label = prompt('Day label (e.g., "Day 5 — Sat Jul 20"):', '');
    if (!label || !label.trim()) return;
    const date = prompt('Date (YYYY-MM-DD, or leave blank):', '') || '';
    const location = prompt('Location (optional):', '') || '';

    const maxOrder = _lpDays.reduce((max, d) => Math.max(max, d.sortOrder || 0), -1);

    try {
        await lpSub(_lpCurrentProjectId, 'days').add({
            date: date.trim(),
            label: label.trim(),
            location: location.trim(),
            sortOrder: maxOrder + 1,
            items: []
        });
        await _lpLoadItinerary();
    } catch (err) {
        console.error('Error adding day:', err);
        alert('Error adding day.');
    }
}

async function _lpEditDay(dayId) {
    const day = _lpDays.find(d => d.id === dayId);
    if (!day) return;

    const label = prompt('Day label:', day.label || '');
    if (!label || !label.trim()) return;
    const date = prompt('Date (YYYY-MM-DD):', day.date || '') || '';
    const location = prompt('Location:', day.location || '') || '';

    try {
        await lpSub(_lpCurrentProjectId, 'days').doc(dayId).update({
            label: label.trim(),
            date: date.trim(),
            location: location.trim()
        });
        // Update local state
        Object.assign(day, { label: label.trim(), date: date.trim(), location: location.trim() });
        const body = document.getElementById('lpBody_itinerary');
        if (body) _lpRenderItinerary(body);
    } catch (err) {
        console.error('Error editing day:', err);
    }
}

async function _lpDeleteDay(dayId) {
    const day = _lpDays.find(d => d.id === dayId);
    const itemCount = (day?.items || []).length;
    const msg = itemCount > 0
        ? `Delete this day and its ${itemCount} item(s)? This cannot be undone.`
        : 'Delete this day? This cannot be undone.';
    if (!confirm(msg)) return;

    try {
        await lpSub(_lpCurrentProjectId, 'days').doc(dayId).delete();
        await _lpLoadItinerary();
    } catch (err) {
        console.error('Error deleting day:', err);
    }
}

async function _lpReorderDays(evt) {
    const cards = document.querySelectorAll('#lpDayList .lp-day-card');
    const batch = firebase.firestore().batch();
    cards.forEach((el, i) => {
        const id = el.dataset.id;
        batch.update(lpSub(_lpCurrentProjectId, 'days').doc(id), { sortOrder: i });
    });
    try {
        await batch.commit();
        const idOrder = Array.from(cards).map(el => el.dataset.id);
        _lpDays.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
        _lpDays.forEach((d, i) => d.sortOrder = i);
    } catch (err) {
        console.error('Error reordering days:', err);
    }
}

// ---------- Item CRUD ----------

/** Generate a short unique ID for items within a day's items array */
function _lpItemId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function _lpAddItem(dayId) {
    const title = prompt('Item title:');
    if (!title || !title.trim()) return;

    const day = _lpDays.find(d => d.id === dayId);
    if (!day) return;

    const items = [...(day.items || [])];
    const maxOrder = items.reduce((max, it) => Math.max(max, it.sortOrder || 0), -1);

    const newItem = {
        id: _lpItemId(),
        title: title.trim(),
        time: '',
        status: 'idea',
        cost: null,
        costNote: '',
        notes: '',
        links: [],
        confirmation: '',
        contact: '',
        duration: '',
        bookingRef: null,
        sortOrder: maxOrder + 1,
        showOnCalendar: false
    };
    items.push(newItem);

    try {
        await lpSub(_lpCurrentProjectId, 'days').doc(dayId).update({ items });
        day.items = items;
        const body = document.getElementById('lpBody_itinerary');
        if (body) _lpRenderItinerary(body);
    } catch (err) {
        console.error('Error adding item:', err);
        alert('Error adding item.');
    }
}

async function _lpEditItem(dayId, itemId) {
    const day = _lpDays.find(d => d.id === dayId);
    if (!day) return;
    const items = [...(day.items || [])];
    const idx = items.findIndex(it => it.id === itemId);
    if (idx < 0) return;
    const item = { ...items[idx] };

    // Multi-field edit via prompt sequence
    const title = prompt('Title:', item.title || '');
    if (!title || !title.trim()) return;
    item.title = title.trim();

    const statusInput = prompt('Status (confirmed / maybe / idea / nope):', item.status || 'idea');
    if (statusInput && LP_ITEM_STATUSES[statusInput.trim().toLowerCase()]) {
        item.status = statusInput.trim().toLowerCase();
    }

    item.time = (prompt('Time (e.g., "8:30am"):', item.time || '') || '').trim();
    item.duration = (prompt('Duration (e.g., "2 hours"):', item.duration || '') || '').trim();

    const costStr = prompt('Cost (number, or blank for none):', item.cost != null ? String(item.cost) : '');
    item.cost = costStr && !isNaN(Number(costStr)) ? Number(costStr) : null;
    if (item.cost != null) {
        item.costNote = (prompt('Cost note (e.g., "each", "for 2"):', item.costNote || '') || '').trim();
    }

    item.confirmation = (prompt('Confirmation #:', item.confirmation || '') || '').trim();
    item.contact = (prompt('Contact (phone/email):', item.contact || '') || '').trim();
    item.notes = (prompt('Notes:', item.notes || '') || '').trim();

    // Links — simple add, show current
    const currentLinks = (item.links || []).map(l => l.label ? `${l.label}: ${l.url}` : l.url).join(', ');
    const linksInput = prompt(`Links (comma-separated URLs, current: ${currentLinks || 'none'}):`, currentLinks);
    if (linksInput !== null) {
        item.links = linksInput.split(',').map(s => s.trim()).filter(Boolean).map(s => {
            const colonIdx = s.indexOf(': ');
            if (colonIdx > 0) return { label: s.slice(0, colonIdx).trim(), url: s.slice(colonIdx + 2).trim() };
            return { label: '', url: s };
        });
    }

    // Booking reference — show available bookings
    if (_lpBookings.length > 0) {
        const bookingNames = _lpBookings.map((b, i) => `${i + 1}. ${b.name}`).join(', ');
        const currentBooking = item.bookingRef ? (_lpBookings.find(b => b.id === item.bookingRef)?.name || 'none') : 'none';
        const bkInput = prompt(`Link to booking (current: ${currentBooking}).\nEnter number or blank to clear:\n${bookingNames}`, item.bookingRef ? String(_lpBookings.findIndex(b => b.id === item.bookingRef) + 1) : '');
        if (bkInput !== null) {
            const bkIdx = parseInt(bkInput, 10) - 1;
            item.bookingRef = (bkIdx >= 0 && bkIdx < _lpBookings.length) ? _lpBookings[bkIdx].id : null;
        }
    }

    // Show on calendar toggle
    const calToggle = prompt('Show on calendar? (yes/no):', item.showOnCalendar ? 'yes' : 'no');
    if (calToggle !== null) item.showOnCalendar = calToggle.trim().toLowerCase() === 'yes';

    // Move to different day
    const dayNames = _lpDays.map((d, i) => `${i + 1}. ${d.label || d.date || 'Day'}`).join(', ');
    const currentDayIdx = _lpDays.findIndex(d => d.id === dayId);
    const moveInput = prompt(`Move to day? (current: ${currentDayIdx + 1}). Enter number or leave same:\n${dayNames}`, String(currentDayIdx + 1));

    const targetDayIdx = moveInput !== null ? parseInt(moveInput, 10) - 1 : currentDayIdx;
    const targetDay = (targetDayIdx >= 0 && targetDayIdx < _lpDays.length) ? _lpDays[targetDayIdx] : null;
    const isMove = targetDay && targetDay.id !== dayId;

    items[idx] = item;

    try {
        if (isMove) {
            // Remove from current day
            const srcItems = items.filter(it => it.id !== itemId);
            await lpSub(_lpCurrentProjectId, 'days').doc(dayId).update({ items: srcItems });
            day.items = srcItems;
            // Add to target day
            const destItems = [...(targetDay.items || [])];
            item.sortOrder = destItems.reduce((max, it) => Math.max(max, it.sortOrder || 0), -1) + 1;
            destItems.push(item);
            await lpSub(_lpCurrentProjectId, 'days').doc(targetDay.id).update({ items: destItems });
            targetDay.items = destItems;
        } else {
            await lpSub(_lpCurrentProjectId, 'days').doc(dayId).update({ items });
            day.items = items;
        }
        const body = document.getElementById('lpBody_itinerary');
        if (body) _lpRenderItinerary(body);
        // Refresh Trip Info for cost rollup
        _lpLoadTripInfo();
    } catch (err) {
        console.error('Error editing item:', err);
    }
}

async function _lpDeleteItem(dayId, itemId) {
    if (!confirm('Delete this item?')) return;
    const day = _lpDays.find(d => d.id === dayId);
    if (!day) return;

    const items = (day.items || []).filter(it => it.id !== itemId);

    try {
        await lpSub(_lpCurrentProjectId, 'days').doc(dayId).update({ items });
        day.items = items;
        const body = document.getElementById('lpBody_itinerary');
        if (body) _lpRenderItinerary(body);
        _lpLoadTripInfo();
    } catch (err) {
        console.error('Error deleting item:', err);
    }
}

async function _lpReorderItems(dayId, evt) {
    const day = _lpDays.find(d => d.id === dayId);
    if (!day) return;

    const itemEls = document.querySelectorAll(`#lpItems_${dayId} .lp-item-row`);
    const newOrder = Array.from(itemEls).map(el => el.dataset.itemId);

    const items = [...(day.items || [])];
    items.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
    items.forEach((it, i) => it.sortOrder = i);

    try {
        await lpSub(_lpCurrentProjectId, 'days').doc(dayId).update({ items });
        day.items = items;
    } catch (err) {
        console.error('Error reordering items:', err);
    }
}

// ============================================================
// Bookings Section (Phase 6)
// ============================================================

const LP_PAYMENT_STATUSES = {
    paid:          { label: 'Paid',          color: '#16a34a' },
    deposit:       { label: 'Deposit Paid',  color: '#d97706' },
    'balance-owed':{ label: 'Balance Owed',  color: '#dc2626' }
};

let _lpBookings = [];

async function _lpLoadBookings() {
    const body = document.getElementById('lpBody_bookings');
    if (!body || !_lpCurrentProjectId) return;

    try {
        const snap = await lpSub(_lpCurrentProjectId, 'bookings').orderBy('sortOrder').get();
        _lpBookings = [];
        snap.forEach(doc => _lpBookings.push({ id: doc.id, ...doc.data() }));
        _lpRenderBookings(body);
    } catch (err) {
        console.error('Error loading bookings:', err);
        body.innerHTML = '<p style="color:red;">Error loading bookings.</p>';
    }
}

function _lpRenderBookings(body) {
    const total = _lpBookings.length;
    _lpUpdateAccordionSummary('bookings', total > 0 ? `(${total})` : '');

    if (total === 0) {
        body.innerHTML = `
            <p style="color:#999; font-size:0.9em;">No bookings yet.</p>
            <button class="btn btn-small btn-primary" onclick="_lpAddBooking()">+ Add Booking</button>
        `;
        return;
    }

    body.innerHTML = `
        <div id="lpBookingList">
            ${_lpBookings.map(b => _lpBookingCard(b)).join('')}
        </div>
        <button class="btn btn-small btn-primary" style="margin-top:8px;" onclick="_lpAddBooking()">+ Add Booking</button>
    `;

    if (typeof Sortable !== 'undefined') {
        const list = document.getElementById('lpBookingList');
        if (list) Sortable.create(list, { animation: 150, handle: '.lp-booking-drag', onEnd: _lpReorderBookings });
    }
}

function _lpBookingCard(b) {
    const ps = LP_PAYMENT_STATUSES[b.paymentStatus] || {};
    const dateStr = b.startDate ? new Date(b.startDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    const endStr = b.multiDay && b.endDate ? ' — ' + new Date(b.endDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    const timeStr = [b.startTime, b.endTime].filter(Boolean).join(' — ');

    return `
        <div class="lp-booking-card card" data-id="${b.id}" id="lpBooking_${b.id}" style="margin-bottom:10px; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span class="lp-booking-drag" style="cursor:grab; color:#ccc;">⠿</span>
                        <strong>${_lpEsc(b.name)}</strong>
                        ${b.type ? `<span style="background:#e0e7ff;color:#4338ca;font-size:0.7em;padding:1px 8px;border-radius:10px;">${_lpEsc(b.type)}</span>` : ''}
                        ${ps.label ? `<span style="color:${ps.color};font-size:0.75em;font-weight:600;">${ps.label}</span>` : ''}
                    </div>
                    ${dateStr ? `<div style="color:#666; font-size:0.85em; margin-top:2px;">${dateStr}${endStr}${timeStr ? ` &middot; ${_lpEsc(timeStr)}` : ''}</div>` : ''}
                    ${!_lpIsTravelMode() && b.cost != null && b.cost !== '' ? `<div style="color:#555; font-size:0.85em;">$${Number(b.cost).toFixed(2)}${b.costNote ? ` (${_lpEsc(b.costNote)})` : ''}</div>` : ''}
                </div>
                <div style="display:flex; gap:4px; flex-shrink:0;">
                    <button class="btn btn-small" onclick="_lpEditBooking('${b.id}')" title="Edit">✏️</button>
                    <button class="btn btn-small" onclick="_lpBookingScreenshots('${b.id}')" title="Screenshots">📷</button>
                    <button class="btn btn-small btn-danger" onclick="_lpDeleteBooking('${b.id}')" title="Delete">✕</button>
                </div>
            </div>
            ${_lpBookingDetailsHtml(b)}
        </div>
    `;
}

function _lpBookingDetailsHtml(b) {
    const parts = [];
    if (b.confirmation) parts.push(`<strong>Confirmation:</strong> ${_lpEsc(b.confirmation)}`);
    if (b.contact) parts.push(`<strong>Contact:</strong> ${_lpEsc(b.contact)}`);
    if (b.address) parts.push(`<strong>Address:</strong> ${_lpEsc(b.address)}`);
    if (b.link) parts.push(`<strong>Link:</strong> <a href="${_lpEsc(b.link)}" target="_blank" rel="noopener" style="color:#2563eb;">${_lpEsc(b.link)}</a>`);
    if (b.notes) parts.push(`<strong>Notes:</strong> ${_lpEsc(b.notes)}`);
    if (!parts.length) return '';
    return `<div style="margin-top:6px; font-size:0.85em; color:#555; display:grid; gap:2px;">${parts.map(p => `<div>${p}</div>`).join('')}</div>`;
}

// ---------- Booking type dropdown helper ----------

function _lpBookingTypeOptions(selected) {
    const types = _lpCurrentProject.bookingTypes || LP_DEFAULT_BOOKING_TYPES;
    return types.map(t => `<option value="${_lpEsc(t)}" ${t === selected ? 'selected' : ''}>${_lpEsc(t)}</option>`).join('') +
        '<option value="__add_new__">+ Add new type...</option>';
}

// ---------- Booking CRUD ----------

async function _lpAddBooking() {
    _lpShowBookingModal(null);
}

async function _lpEditBooking(bookingId) {
    const b = _lpBookings.find(x => x.id === bookingId);
    if (!b) return;
    _lpShowBookingModal(b);
}

function _lpShowBookingModal(booking) {
    const isEdit = !!booking;
    const b = booking || {};

    // Build modal HTML dynamically in the page
    const page = document.getElementById('page-life-project');
    let modal = document.getElementById('lpBookingModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lpBookingModal';
        modal.className = 'modal-overlay';
        page.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal" style="max-height:85vh; overflow-y:auto;">
            <h3>${isEdit ? 'Edit Booking' : 'New Booking'}</h3>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkName">Name *</label>
                <input type="text" id="lpBkName" class="form-control" value="${_lpEsc(b.name || '')}" placeholder="e.g. Canyon Lodge">
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkType">Type</label>
                <select id="lpBkType" class="form-control" onchange="_lpBookingTypeChange(this)">
                    <option value="">— Select —</option>
                    ${_lpBookingTypeOptions(b.type || '')}
                </select>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div class="form-group" style="flex:1;">
                    <label for="lpBkStartDate">Start Date</label>
                    <input type="date" id="lpBkStartDate" class="form-control" value="${b.startDate || ''}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label style="display:flex;align-items:center;gap:6px;">
                        <input type="checkbox" id="lpBkMultiDay" ${b.multiDay ? 'checked' : ''} onchange="document.getElementById('lpBkEndDateWrap').style.display=this.checked?'':'none'"> Multi-day
                    </label>
                    <div id="lpBkEndDateWrap" style="${b.multiDay ? '' : 'display:none;'}">
                        <input type="date" id="lpBkEndDate" class="form-control" value="${b.endDate || ''}">
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div class="form-group" style="flex:1;">
                    <label for="lpBkStartTime">Start Time</label>
                    <input type="text" id="lpBkStartTime" class="form-control" value="${_lpEsc(b.startTime || '')}" placeholder="3:00 PM">
                </div>
                <div class="form-group" style="flex:1;">
                    <label for="lpBkEndTime">End Time</label>
                    <input type="text" id="lpBkEndTime" class="form-control" value="${_lpEsc(b.endTime || '')}" placeholder="5:30 PM">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkConfirmation">Confirmation #</label>
                <input type="text" id="lpBkConfirmation" class="form-control" value="${_lpEsc(b.confirmation || '')}">
            </div>
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <div class="form-group" style="flex:1;">
                    <label for="lpBkCost">Cost</label>
                    <input type="number" id="lpBkCost" class="form-control" step="0.01" value="${b.cost != null ? b.cost : ''}" placeholder="0.00">
                </div>
                <div class="form-group" style="flex:1;">
                    <label for="lpBkCostNote">Cost Note</label>
                    <input type="text" id="lpBkCostNote" class="form-control" value="${_lpEsc(b.costNote || '')}" placeholder="each, total, deposit">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkPayment">Payment Status</label>
                <select id="lpBkPayment" class="form-control">
                    <option value="">— None —</option>
                    ${Object.entries(LP_PAYMENT_STATUSES).map(([k, v]) => `<option value="${k}" ${b.paymentStatus === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkContact">Contact</label>
                <input type="text" id="lpBkContact" class="form-control" value="${_lpEsc(b.contact || '')}" placeholder="Phone or email">
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkAddress">Address</label>
                <input type="text" id="lpBkAddress" class="form-control" value="${_lpEsc(b.address || '')}">
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkLink">Link / URL</label>
                <input type="url" id="lpBkLink" class="form-control" value="${_lpEsc(b.link || '')}" placeholder="https://...">
            </div>
            <div class="form-group" style="margin-bottom:10px;">
                <label for="lpBkNotes">Notes</label>
                <textarea id="lpBkNotes" class="form-control" rows="2">${_lpEsc(b.notes || '')}</textarea>
            </div>
            <div class="modal-actions">
                <button class="btn" onclick="closeModal('lpBookingModal')">Cancel</button>
                <button class="btn btn-primary" onclick="_lpSaveBooking('${isEdit ? b.id : ''}')">${isEdit ? 'Save' : 'Create'}</button>
            </div>
        </div>
    `;

    openModal('lpBookingModal');
}

function _lpBookingTypeChange(sel) {
    if (sel.value === '__add_new__') {
        const newType = prompt('New booking type:');
        if (newType && newType.trim()) {
            const types = [...(_lpCurrentProject.bookingTypes || LP_DEFAULT_BOOKING_TYPES)];
            if (!types.includes(newType.trim())) {
                types.push(newType.trim());
                _lpCurrentProject.bookingTypes = types;
                lpCol().doc(_lpCurrentProjectId).update({ bookingTypes: types, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
            // Rebuild options and select the new one
            sel.innerHTML = '<option value="">— Select —</option>' + _lpBookingTypeOptions(newType.trim());
        } else {
            sel.value = '';
        }
    }
}

async function _lpSaveBooking(editId) {
    const name = document.getElementById('lpBkName')?.value.trim();
    if (!name) { alert('Name is required.'); return; }

    const costVal = document.getElementById('lpBkCost')?.value;
    const data = {
        name,
        type: document.getElementById('lpBkType')?.value || '',
        startDate: document.getElementById('lpBkStartDate')?.value || '',
        multiDay: document.getElementById('lpBkMultiDay')?.checked || false,
        endDate: document.getElementById('lpBkEndDate')?.value || '',
        startTime: document.getElementById('lpBkStartTime')?.value.trim() || '',
        endTime: document.getElementById('lpBkEndTime')?.value.trim() || '',
        confirmation: document.getElementById('lpBkConfirmation')?.value.trim() || '',
        cost: costVal && !isNaN(Number(costVal)) ? Number(costVal) : null,
        costNote: document.getElementById('lpBkCostNote')?.value.trim() || '',
        paymentStatus: document.getElementById('lpBkPayment')?.value || '',
        contact: document.getElementById('lpBkContact')?.value.trim() || '',
        address: document.getElementById('lpBkAddress')?.value.trim() || '',
        link: document.getElementById('lpBkLink')?.value.trim() || '',
        notes: document.getElementById('lpBkNotes')?.value.trim() || ''
    };

    try {
        if (editId) {
            await lpSub(_lpCurrentProjectId, 'bookings').doc(editId).update(data);
        } else {
            const maxOrder = _lpBookings.reduce((max, b) => Math.max(max, b.sortOrder || 0), -1);
            data.sortOrder = maxOrder + 1;
            await lpSub(_lpCurrentProjectId, 'bookings').add(data);
        }
        closeModal('lpBookingModal');
        await _lpLoadBookings();
        _lpLoadTripInfo();
    } catch (err) {
        console.error('Error saving booking:', err);
        alert('Error saving booking.');
    }
}

async function _lpDeleteBooking(bookingId) {
    if (!confirm('Delete this booking and its screenshots?')) return;
    try {
        // Delete screenshots
        const photoSnap = await lpSub(_lpCurrentProjectId, 'bookingPhotos').where('bookingId', '==', bookingId).get();
        if (!photoSnap.empty) {
            const batch = firebase.firestore().batch();
            photoSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        await lpSub(_lpCurrentProjectId, 'bookings').doc(bookingId).delete();
        await _lpLoadBookings();
        _lpLoadTripInfo();
    } catch (err) {
        console.error('Error deleting booking:', err);
    }
}

async function _lpReorderBookings(evt) {
    const cards = document.querySelectorAll('#lpBookingList .lp-booking-card');
    const batch = firebase.firestore().batch();
    cards.forEach((el, i) => {
        const id = el.dataset.id;
        batch.update(lpSub(_lpCurrentProjectId, 'bookings').doc(id), { sortOrder: i });
    });
    try {
        await batch.commit();
        const idOrder = Array.from(cards).map(el => el.dataset.id);
        _lpBookings.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));
        _lpBookings.forEach((b, i) => b.sortOrder = i);
    } catch (err) {
        console.error('Error reordering bookings:', err);
    }
}

// ---------- Booking Screenshots ----------

async function _lpBookingScreenshots(bookingId) {
    const booking = _lpBookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Load existing screenshots
    let photos = [];
    try {
        const snap = await lpSub(_lpCurrentProjectId, 'bookingPhotos').where('bookingId', '==', bookingId).orderBy('createdAt', 'desc').get();
        snap.forEach(doc => photos.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
        // If index not ready, fallback to unordered
        const snap = await lpSub(_lpCurrentProjectId, 'bookingPhotos').where('bookingId', '==', bookingId).get();
        snap.forEach(doc => photos.push({ id: doc.id, ...doc.data() }));
    }

    const page = document.getElementById('page-life-project');
    let modal = document.getElementById('lpScreenshotModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lpScreenshotModal';
        modal.className = 'modal-overlay';
        page.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal" style="max-height:85vh; overflow-y:auto; max-width:600px;">
            <h3>Screenshots — ${_lpEsc(booking.name)}</h3>
            <div id="lpScreenshotList">
                ${photos.length === 0 ? '<p style="color:#999;">No screenshots yet.</p>' : ''}
                ${photos.map(ph => `
                    <div style="margin-bottom:12px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                        <img src="${ph.imageData}" style="width:100%; display:block;" alt="Screenshot">
                        ${ph.caption ? `<div style="padding:6px 10px; font-size:0.85em; color:#555;">${_lpEsc(ph.caption)}</div>` : ''}
                        <div style="padding:4px 10px 8px; text-align:right;">
                            <button class="btn btn-small btn-danger" onclick="_lpDeleteScreenshot('${bookingId}','${ph.id}')">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top:8px;">
                <label class="btn btn-small btn-primary" style="cursor:pointer;">
                    📷 Add Screenshot
                    <input type="file" accept="image/*" style="display:none;" onchange="_lpUploadScreenshot('${bookingId}', this.files)">
                </label>
            </div>
            <div class="modal-actions" style="margin-top:12px;">
                <button class="btn" onclick="closeModal('lpScreenshotModal')">Close</button>
            </div>
        </div>
    `;

    openModal('lpScreenshotModal');
}

async function _lpUploadScreenshot(bookingId, files) {
    if (!files || !files.length) return;
    try {
        const imageData = await compressImage(files[0]);
        const caption = prompt('Caption (optional):') || '';
        await lpSub(_lpCurrentProjectId, 'bookingPhotos').add({
            bookingId,
            imageData,
            caption: caption.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Refresh the screenshot modal
        await _lpBookingScreenshots(bookingId);
    } catch (err) {
        console.error('Error uploading screenshot:', err);
        alert('Error uploading screenshot.');
    }
}

async function _lpDeleteScreenshot(bookingId, photoId) {
    if (!confirm('Delete this screenshot?')) return;
    try {
        await lpSub(_lpCurrentProjectId, 'bookingPhotos').doc(photoId).delete();
        await _lpBookingScreenshots(bookingId);
    } catch (err) {
        console.error('Error deleting screenshot:', err);
    }
}

// ---------- Booking badge on day items ----------

function _lpBookingBadge(bookingRef) {
    if (!bookingRef) return '';
    const booking = _lpBookings.find(b => b.id === bookingRef);
    if (!booking) return '';
    return `<a href="javascript:void(0)" onclick="event.stopPropagation();document.getElementById('lpBooking_${bookingRef}')?.scrollIntoView({behavior:'smooth',block:'center'})" style="background:#e0e7ff;color:#4338ca;font-size:0.7em;padding:1px 8px;border-radius:10px;text-decoration:none;white-space:nowrap;" title="View booking">🏨 ${_lpEsc(booking.name)}</a>`;
}

// ============================================================
// Packing List Section (Phase 7)
// ============================================================

const LP_PACKING_CATEGORIES = ['Clothes', 'Toiletries', 'Electronics', 'Documents', 'Gear / Other'];

const LP_PACKING_DEFAULTS = {
    'Clothes': ['Underwear','Socks','Jeans / Pants','Shorts','T-shirts','Long sleeve shirts','Light jacket','Heavy coat','Swimsuit / Swim shorts','Hat(s)','Gloves','Comfortable walking shoes','Dress shoes (optional)','Pajamas','Belt'],
    'Toiletries': ['Toothbrush / Toothpaste','Deodorant','Shampoo / Conditioner','Sunscreen','Lip balm','Medications / Prescriptions','First aid basics (band-aids, ibuprofen)','Contact lenses / Solution','Glasses'],
    'Electronics': ['Phone + charger','Camera + charger / batteries','Extra memory cards','Portable battery pack','Headphones / Earbuds','Laptop / Tablet + charger','Power strip','Adapters if international'],
    'Documents': ['Passport','Driver\'s license','Credit cards','Insurance cards','Printed confirmations / Itinerary','Emergency contact info'],
    'Gear / Other': ['Backpack / Day bag','Sunglasses','Umbrella','Reusable water bottle','Snacks','Binoculars','Waterproof bag / Dry bag','Rain jacket / Poncho','Hand warmers (cold weather trips)']
};

let _lpPackingItems = [];

async function _lpLoadPacking() {
    const body = document.getElementById('lpBody_packing');
    if (!body || !_lpCurrentProjectId) return;

    try {
        const snap = await lpSub(_lpCurrentProjectId, 'packingItems').orderBy('sortOrder').get();
        _lpPackingItems = [];
        snap.forEach(doc => _lpPackingItems.push({ id: doc.id, ...doc.data() }));
        _lpRenderPacking(body);
    } catch (err) {
        console.error('Error loading packing list:', err);
        body.innerHTML = '<p style="color:red;">Error loading packing list.</p>';
    }
}

function _lpRenderPacking(body) {
    const total = _lpPackingItems.length;
    const packed = _lpPackingItems.filter(i => i.done).length;
    _lpUpdateAccordionSummary('packing', total > 0 ? `(${packed}/${total} packed)` : '');

    if (total === 0) {
        const isVacation = _lpCurrentProject.template === 'vacation';
        body.innerHTML = `
            <p style="color:#999; font-size:0.9em;">No packing items yet.</p>
            ${isVacation ? `<button class="btn btn-small btn-primary" style="margin-right:8px;" onclick="_lpPopulateDefaultPacking()">Populate Default List</button>` : ''}
            <button class="btn btn-small" onclick="_lpAddPackingItem()">+ Add Item</button>
        `;
        return;
    }

    // Group by category
    const grouped = {};
    LP_PACKING_CATEGORIES.forEach(cat => grouped[cat] = []);
    grouped['Uncategorized'] = [];
    _lpPackingItems.forEach(item => {
        const cat = item.category && grouped[item.category] ? item.category : 'Uncategorized';
        grouped[cat].push(item);
    });

    let html = '';
    for (const [cat, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;
        const catPacked = items.filter(i => i.done).length;
        html += `
            <div style="margin-bottom:12px;">
                <div style="font-weight:600; font-size:0.9em; color:#475569; margin-bottom:4px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
                    ${_lpEsc(cat)} <span style="color:#94a3b8; font-weight:400;">(${catPacked}/${items.length})</span>
                </div>
                <div class="lp-packing-group" data-category="${_lpEsc(cat)}">
                    ${items.map(item => _lpPackingItemRow(item)).join('')}
                </div>
            </div>
        `;
    }

    body.innerHTML = `
        ${html}
        <button class="btn btn-small btn-primary" style="margin-top:8px;" onclick="_lpAddPackingItem()">+ Add Item</button>
    `;
}

function _lpPackingItemRow(item) {
    return `
        <div class="lp-packing-item" data-id="${item.id}" style="display:flex; align-items:flex-start; gap:8px; padding:4px 0; border-bottom:1px solid #f8f8f8;">
            <input type="checkbox" ${item.done ? 'checked' : ''} onchange="_lpTogglePackingItem('${item.id}', this.checked)" style="margin-top:3px;">
            <div style="flex:1; min-width:0;">
                <span style="${item.done ? 'text-decoration:line-through; color:#999;' : ''}">${_lpEsc(item.text)}</span>
                ${item.notes ? `<div style="color:#888; font-size:0.8em;">${_lpEsc(item.notes)}</div>` : ''}
            </div>
            <div style="display:flex; gap:2px; flex-shrink:0;">
                <button class="btn btn-small" onclick="_lpEditPackingItem('${item.id}')" title="Edit" style="padding:2px 6px;">✏️</button>
                <button class="btn btn-small btn-danger" onclick="_lpDeletePackingItem('${item.id}')" title="Delete" style="padding:2px 6px;">✕</button>
            </div>
        </div>
    `;
}

async function _lpPopulateDefaultPacking() {
    if (!confirm('Populate the packing list with default items? This will add items to the list.')) return;
    try {
        const batch = firebase.firestore().batch();
        let sortOrder = _lpPackingItems.reduce((max, i) => Math.max(max, i.sortOrder || 0), -1) + 1;
        for (const [cat, items] of Object.entries(LP_PACKING_DEFAULTS)) {
            items.forEach(text => {
                const ref = lpSub(_lpCurrentProjectId, 'packingItems').doc();
                batch.set(ref, { text, done: false, notes: '', category: cat, sortOrder: sortOrder++ });
            });
        }
        await batch.commit();
        await _lpLoadPacking();
    } catch (err) {
        console.error('Error populating packing list:', err);
        alert('Error populating packing list.');
    }
}

async function _lpAddPackingItem() {
    const text = prompt('Packing item:');
    if (!text || !text.trim()) return;
    const category = prompt(`Category (${LP_PACKING_CATEGORIES.join(', ')}):`, 'Gear / Other') || 'Gear / Other';
    const notes = prompt('Notes (optional):') || '';

    const maxOrder = _lpPackingItems.reduce((max, i) => Math.max(max, i.sortOrder || 0), -1);

    try {
        await lpSub(_lpCurrentProjectId, 'packingItems').add({
            text: text.trim(),
            done: false,
            notes: notes.trim(),
            category: category.trim(),
            sortOrder: maxOrder + 1
        });
        await _lpLoadPacking();
    } catch (err) {
        console.error('Error adding packing item:', err);
    }
}

async function _lpTogglePackingItem(itemId, done) {
    try {
        await lpSub(_lpCurrentProjectId, 'packingItems').doc(itemId).update({ done });
        const item = _lpPackingItems.find(i => i.id === itemId);
        if (item) item.done = done;
        const body = document.getElementById('lpBody_packing');
        if (body) _lpRenderPacking(body);
    } catch (err) {
        console.error('Error toggling packing item:', err);
    }
}

async function _lpEditPackingItem(itemId) {
    const item = _lpPackingItems.find(i => i.id === itemId);
    if (!item) return;

    const text = prompt('Packing item:', item.text);
    if (!text || !text.trim()) return;
    const category = prompt(`Category (${LP_PACKING_CATEGORIES.join(', ')}):`, item.category || 'Gear / Other') || 'Gear / Other';
    const notes = prompt('Notes:', item.notes || '') || '';

    try {
        await lpSub(_lpCurrentProjectId, 'packingItems').doc(itemId).update({
            text: text.trim(),
            category: category.trim(),
            notes: notes.trim()
        });
        await _lpLoadPacking();
    } catch (err) {
        console.error('Error editing packing item:', err);
    }
}

async function _lpDeletePackingItem(itemId) {
    if (!confirm('Delete this packing item?')) return;
    try {
        await lpSub(_lpCurrentProjectId, 'packingItems').doc(itemId).delete();
        await _lpLoadPacking();
    } catch (err) {
        console.error('Error deleting packing item:', err);
    }
}

// ============================================================
// Notes / Journal Section (Phase 8)
// ============================================================

let _lpNotes = [];

async function _lpLoadNotes() {
    const body = document.getElementById('lpBody_notes');
    if (!body || !_lpCurrentProjectId) return;

    try {
        const snap = await lpSub(_lpCurrentProjectId, 'projectNotes').orderBy('createdAt', 'desc').get();
        _lpNotes = [];
        snap.forEach(doc => _lpNotes.push({ id: doc.id, ...doc.data() }));
        _lpRenderNotes(body);
    } catch (err) {
        console.error('Error loading notes:', err);
        body.innerHTML = '<p style="color:red;">Error loading notes.</p>';
    }
}

function _lpRenderNotes(body) {
    const total = _lpNotes.length;
    _lpUpdateAccordionSummary('notes', total > 0 ? `(${total})` : '');

    if (total === 0) {
        body.innerHTML = `
            <p style="color:#999; font-size:0.9em;">No notes yet.</p>
            <button class="btn btn-small btn-primary" onclick="_lpAddNote()">+ Add Note</button>
        `;
        return;
    }

    body.innerHTML = `
        ${_lpNotes.map(n => _lpNoteCard(n)).join('')}
        <button class="btn btn-small btn-primary" style="margin-top:8px;" onclick="_lpAddNote()">+ Add Note</button>
    `;
}

function _lpNoteCard(n) {
    const dateStr = n.createdAt ? new Date(n.createdAt.seconds ? n.createdAt.seconds * 1000 : n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

    return `
        <div class="lp-note-card card" style="margin-bottom:10px; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex:1; min-width:0;">
                    ${n.title ? `<strong>${_lpEsc(n.title)}</strong>` : ''}
                    ${dateStr ? `<div style="color:#999; font-size:0.8em;">${dateStr}</div>` : ''}
                </div>
                <div style="display:flex; gap:4px; flex-shrink:0;">
                    <button class="btn btn-small" onclick="_lpEditNote('${n.id}')" title="Edit">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="_lpDeleteNote('${n.id}')" title="Delete">✕</button>
                </div>
            </div>
            ${n.text ? `<div style="margin-top:6px; white-space:pre-wrap; font-size:0.9em; color:#444;">${_lpEsc(n.text)}</div>` : ''}
        </div>
    `;
}

async function _lpAddNote() {
    const title = prompt('Note title (optional):') || '';
    const text = prompt('Note text:');
    if (!text || !text.trim()) return;

    try {
        await lpSub(_lpCurrentProjectId, 'projectNotes').add({
            title: title.trim(),
            text: text.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            sortOrder: _lpNotes.length
        });
        await _lpLoadNotes();
    } catch (err) {
        console.error('Error adding note:', err);
        alert('Error adding note.');
    }
}

async function _lpEditNote(noteId) {
    const n = _lpNotes.find(x => x.id === noteId);
    if (!n) return;

    const title = prompt('Note title:', n.title || '') || '';
    const text = prompt('Note text:', n.text || '');
    if (text === null) return; // cancelled

    try {
        await lpSub(_lpCurrentProjectId, 'projectNotes').doc(noteId).update({
            title: title.trim(),
            text: (text || '').trim()
        });
        await _lpLoadNotes();
    } catch (err) {
        console.error('Error editing note:', err);
    }
}

async function _lpDeleteNote(noteId) {
    if (!confirm('Delete this note?')) return;
    try {
        await lpSub(_lpCurrentProjectId, 'projectNotes').doc(noteId).delete();
        await _lpLoadNotes();
    } catch (err) {
        console.error('Error deleting note:', err);
    }
}

// ============================================================
// Search / Filter
// ============================================================

function _lpFilterBySearch(query) {
    const q = (query || '').toLowerCase().trim();
    // Day cards
    document.querySelectorAll('.lp-day-card').forEach(card => {
        if (!q) { card.style.display = ''; return; }
        card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    // Booking cards
    document.querySelectorAll('.lp-booking-card').forEach(card => {
        if (!q) { card.style.display = ''; return; }
        card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    // To-do items
    document.querySelectorAll('.lp-todo-item').forEach(el => {
        if (!q) { el.style.display = ''; return; }
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    // Packing items
    document.querySelectorAll('.lp-packing-item').forEach(el => {
        if (!q) { el.style.display = ''; return; }
        el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    // Packing groups — hide group if all items hidden
    document.querySelectorAll('.lp-packing-group').forEach(group => {
        if (!q) { group.style.display = ''; return; }
        const visible = group.querySelectorAll('.lp-packing-item:not([style*="display: none"])');
        group.style.display = visible.length ? '' : 'none';
    });
    // Note cards
    document.querySelectorAll('.lp-note-card').forEach(card => {
        if (!q) { card.style.display = ''; return; }
        card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ============================================================
// Import from JSON
// ============================================================

/** Temporary import state */
let _lpImportData = null;

/** Handle file selection from the hidden input */
function _lpHandleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = ''; // reset so same file can be re-selected

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.project || !data.project.title) {
                alert('Invalid import file: missing project data.');
                return;
            }
            _lpImportData = data;
            _lpStartPeopleLinking();
        } catch (err) {
            alert('Error reading file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

/** Start the people-linking step — show modal for each person */
async function _lpStartPeopleLinking() {
    const people = _lpImportData.project.people || [];
    if (people.length === 0) {
        // No people to link — go straight to import
        await _lpExecuteImport();
        return;
    }

    // Load contacts cache
    await _lpEnsurePeopleCache();

    // Walk through each person one at a time
    _lpImportData._linkedPeople = [];
    _lpLinkNextPerson(0);
}

/** Show contact picker for person at index */
function _lpLinkNextPerson(index) {
    const people = _lpImportData.project.people || [];
    if (index >= people.length) {
        // All people processed — apply linked results and import
        closeModal('lpImportPeopleModal');
        _lpImportData.project.people = _lpImportData._linkedPeople;
        _lpExecuteImport();
        return;
    }

    const person = people[index];
    const body = document.getElementById('lpImportPeopleBody');
    body.innerHTML = `
        <p style="margin-bottom:12px;">Person ${index + 1} of ${people.length}: <strong>${_lpEsc(person.name)}</strong></p>
        <p style="font-size:0.9em; color:#666; margin-bottom:8px;">Search contacts to link, or skip to keep unlinked.</p>
        <div class="lc-people-picker-wrap">
            <input type="text" id="lpImportPersonSearch" class="form-control"
                   placeholder="Search contacts…" autocomplete="off">
            <ul class="lc-people-dropdown hidden" id="lpImportPersonDropdown"></ul>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="btn" style="flex:1;" onclick="_lpImportSkipPerson(${index})">Don't Link</button>
        </div>
    `;
    openModal('lpImportPeopleModal');

    // Wire search
    const searchEl = document.getElementById('lpImportPersonSearch');
    const dropEl = document.getElementById('lpImportPersonDropdown');

    searchEl.addEventListener('input', function() {
        const q = this.value.trim().toLowerCase();
        if (!q) { dropEl.classList.add('hidden'); dropEl.innerHTML = ''; return; }

        const matches = _lpAllPeople.filter(p => p.name.toLowerCase().includes(q));
        if (matches.length === 0) {
            dropEl.innerHTML = '<li class="lc-people-no-match">No matches</li>';
            dropEl.classList.remove('hidden');
            return;
        }

        dropEl.innerHTML = matches.map(p =>
            `<li data-id="${p.id}" data-name="${_lpEsc(p.name)}">${_lpEsc(p.name)}</li>`
        ).join('');
        dropEl.classList.remove('hidden');

        dropEl.querySelectorAll('li[data-id]').forEach(li => {
            li.addEventListener('click', function() {
                _lpImportSelectPerson(index, li.dataset.id, li.dataset.name);
            });
        });
    });

    // Enter key selects first match
    searchEl.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const q = this.value.trim().toLowerCase();
        if (!q) return;
        const matches = _lpAllPeople.filter(p => p.name.toLowerCase().includes(q));
        if (matches.length >= 1) {
            _lpImportSelectPerson(index, matches[0].id, matches[0].name);
        }
    });

    // Focus the search input
    setTimeout(() => searchEl.focus(), 100);
}

/** User selected a contact for this person */
function _lpImportSelectPerson(index, contactId, contactName) {
    const person = _lpImportData.project.people[index];
    _lpImportData._linkedPeople.push({
        name: contactName,
        contactId: contactId,
        notes: person.notes || ''
    });
    _lpLinkNextPerson(index + 1);
}

/** User chose not to link this person */
function _lpImportSkipPerson(index) {
    const person = _lpImportData.project.people[index];
    _lpImportData._linkedPeople.push({
        name: person.name,
        contactId: null,
        notes: person.notes || ''
    });
    _lpLinkNextPerson(index + 1);
}

/** Execute the actual Firestore import after people are linked */
async function _lpExecuteImport() {
    openModal('lpImportProgressModal');
    const prog = document.getElementById('lpImportProgressBody');

    try {
        const d = _lpImportData;
        const p = d.project;

        // 1. Create the project document
        prog.innerHTML = '<p>Creating project…</p>';
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const projectDoc = {
            title: p.title || 'Imported Project',
            description: p.description || '',
            template: p.template || 'vacation',
            status: p.status || 'planning',
            mode: p.mode || 'planning',
            archived: p.archived !== undefined ? p.archived : false,
            startDate: p.startDate || null,
            endDate: p.endDate || null,
            targetType: 'life',
            targetId: null,
            people: p.people || [],
            bookingTypes: p.bookingTypes || [...LP_DEFAULT_BOOKING_TYPES],
            createdAt: now,
            updatedAt: now
        };
        const projectRef = await lpCol().add(projectDoc);
        const projectId = projectRef.id;

        // 2. Create bookings — track IDs by sortOrder for bookingRef linking
        const bookingIdMap = {}; // confirmation# → Firestore doc ID
        if (d.bookings && d.bookings.length > 0) {
            prog.innerHTML = `<p>Creating ${d.bookings.length} bookings…</p>`;
            const batch = firebase.firestore().batch();
            d.bookings.forEach(b => {
                const ref = lpSub(projectId, 'bookings').doc();
                batch.set(ref, {
                    name: b.name || '',
                    type: b.type || '',
                    startDate: b.startDate || '',
                    multiDay: b.multiDay || false,
                    endDate: b.endDate || '',
                    startTime: b.startTime || '',
                    endTime: b.endTime || '',
                    confirmation: b.confirmation || '',
                    cost: b.cost != null ? b.cost : null,
                    costNote: b.costNote || '',
                    paymentStatus: b.paymentStatus || '',
                    contact: b.contact || '',
                    address: b.address || '',
                    link: b.link || '',
                    notes: b.notes || '',
                    sortOrder: b.sortOrder || 0
                });
                // Map confirmation numbers to doc IDs for bookingRef linking
                if (b.confirmation) {
                    bookingIdMap[b.confirmation] = ref.id;
                }
            });
            await batch.commit();
        }

        // 3. Create days with itinerary items
        if (d.days && d.days.length > 0) {
            prog.innerHTML = `<p>Creating ${d.days.length} days with itinerary…</p>`;
            // May need multiple batches (500 writes max per batch)
            const batch = firebase.firestore().batch();
            d.days.forEach(day => {
                const ref = lpSub(projectId, 'days').doc();
                const items = (day.items || []).map(item => {
                    // Wire up bookingRef if the item has a confirmation that matches a booking
                    let bookingRef = item.bookingRef || null;
                    if (!bookingRef && item.confirmation && bookingIdMap[item.confirmation]) {
                        bookingRef = bookingIdMap[item.confirmation];
                    }
                    return {
                        id: _lpItemId(),
                        title: item.title || '',
                        time: item.time || '',
                        status: item.status || 'idea',
                        cost: item.cost != null ? item.cost : null,
                        costNote: item.costNote || '',
                        notes: item.notes || '',
                        links: item.links || [],
                        confirmation: item.confirmation || '',
                        contact: item.contact || '',
                        duration: item.duration || '',
                        bookingRef: bookingRef,
                        sortOrder: item.sortOrder || 0,
                        showOnCalendar: item.showOnCalendar || false
                    };
                });
                batch.set(ref, {
                    date: day.date || '',
                    label: day.label || '',
                    location: day.location || '',
                    sortOrder: day.sortOrder || 0,
                    items: items
                });
            });
            await batch.commit();
        }

        // 4. Create to-do items
        if (d.todoItems && d.todoItems.length > 0) {
            prog.innerHTML = `<p>Creating ${d.todoItems.length} to-do items…</p>`;
            const batch = firebase.firestore().batch();
            d.todoItems.forEach(t => {
                const ref = lpSub(projectId, 'todoItems').doc();
                batch.set(ref, {
                    text: t.text || '',
                    done: t.done || false,
                    notes: t.notes || '',
                    sortOrder: t.sortOrder || 0
                });
            });
            await batch.commit();
        }

        // 5. Create packing items
        if (d.packingItems && d.packingItems.length > 0) {
            prog.innerHTML = `<p>Creating ${d.packingItems.length} packing items…</p>`;
            const batch = firebase.firestore().batch();
            d.packingItems.forEach(item => {
                const ref = lpSub(projectId, 'packingItems').doc();
                batch.set(ref, {
                    text: item.text || '',
                    done: item.done || false,
                    notes: item.notes || '',
                    category: item.category || 'Gear / Other',
                    sortOrder: item.sortOrder || 0
                });
            });
            await batch.commit();
        }

        // 6. Create project notes
        if (d.projectNotes && d.projectNotes.length > 0) {
            prog.innerHTML = `<p>Creating ${d.projectNotes.length} notes…</p>`;
            const batch = firebase.firestore().batch();
            d.projectNotes.forEach(n => {
                const ref = lpSub(projectId, 'projectNotes').doc();
                batch.set(ref, {
                    title: n.title || '',
                    text: n.text || '',
                    createdAt: now,
                    sortOrder: n.sortOrder || 0
                });
            });
            await batch.commit();
        }

        // Done!
        _lpImportData = null;
        closeModal('lpImportProgressModal');
        location.hash = '#life-project/' + projectId;

    } catch (err) {
        console.error('Import error:', err);
        prog.innerHTML = `<p style="color:red;">Error: ${err.message}</p>
            <button class="btn" style="margin-top:12px;" onclick="closeModal('lpImportProgressModal')">Close</button>`;
    }
}

// ============================================================
// Utilities
// ============================================================

/** HTML-escape a string */
function _lpEsc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
