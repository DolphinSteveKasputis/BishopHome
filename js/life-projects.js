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
    const page = document.getElementById('page-life-projects');
    page.innerHTML = `
        <div class="page-header">
            <button class="back-btn" onclick="location.hash='#life'">&larr;</button>
            <h2>Projects</h2>
        </div>
        <div style="padding:16px;">
            <div id="lpShowArchivedWrap" style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                <label style="font-size:0.9em; color:#666; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="lpShowArchived" onchange="renderLifeProjectsList()"> Show archived
                </label>
            </div>
            <div id="lpProjectList"></div>
            <button class="btn btn-primary" style="margin-top:16px; width:100%;" onclick="openNewLifeProjectModal()">+ New Project</button>
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
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <span style="font-size:1.1em;">${tpl.icon}</span>
                        <strong style="font-size:1.05em;">${_lpEsc(p.title)}</strong>
                        ${archivedBadge}
                    </div>
                    ${p.description ? `<p style="color:#666; font-size:0.9em; margin:4px 0 0;">${_lpEsc(p.description)}</p>` : ''}
                    ${dateRange ? `<p style="color:#888; font-size:0.85em; margin:4px 0 0;">${dateRange}</p>` : ''}
                </div>
                <span style="background:${st.color};color:#fff;font-size:0.75em;padding:2px 10px;border-radius:12px;white-space:nowrap;margin-left:8px;">${st.label}</span>
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

    page.innerHTML = '<div style="padding:16px;"><p style="color:#999;">Loading project...</p></div>';

    try {
        const doc = await lpCol().doc(projectId).get();
        if (!doc.exists) {
            page.innerHTML = '<div style="padding:16px;"><p style="color:red;">Project not found.</p></div>';
            return;
        }
        _lpCurrentProject = { id: doc.id, ...doc.data() };
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

            <!-- Accordion sections -->
            <div id="lpAccordion">
                ${_lpAccordionSection('tripInfo', '📍 Trip Info', '', true)}
                ${_lpAccordionSection('people', '👥 People', _lpPeopleSummary(p), false)}
                ${_lpAccordionSection('todos', '☑️ To-Do', '', false)}
                ${_lpAccordionSection('itinerary', '📅 Itinerary', '', false)}
                ${_lpAccordionSection('bookings', '🏨 Bookings', '', false)}
                ${_lpAccordionSection('packing', '🧳 Packing', '', false)}
                ${_lpAccordionSection('notes', '📝 Notes', '', false)}
            </div>
        </div>
    `;

    // Load accordion content for expanded sections
    _lpLoadTripInfo();
    _lpLoadTodos();
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

/** Toggle planning/travel mode */
async function _lpToggleMode() {
    if (!_lpCurrentProjectId || !_lpCurrentProject) return;
    const newMode = _lpCurrentProject.mode === 'travel' ? 'planning' : 'travel';
    try {
        await lpCol().doc(_lpCurrentProjectId).update({ mode: newMode, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        _lpCurrentProject.mode = newMode;
        const btn = document.getElementById('lpModeToggle');
        if (btn) btn.innerHTML = newMode === 'travel' ? '🧳 Travel' : '📝 Planning';
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

    body.innerHTML = `
        <div style="display:grid; gap:8px;">
            ${p.startDate ? `<div><strong>Dates:</strong> ${_lpFormatDateRange(p.startDate, p.endDate)}</div>` : '<div style="color:#999;">No dates set</div>'}
            ${p.description ? `<div><strong>Description:</strong> ${_lpEsc(p.description)}</div>` : ''}
            <div style="color:#999; font-size:0.85em;">Edit project metadata from the list page (✏️ button).</div>
        </div>
    `;
}

// ============================================================
// People Section
// ============================================================

function _lpPeopleSummary(p) {
    if (!p.people || p.people.length === 0) return '';
    return `(${p.people.length})`;
}

function _lpLoadPeople() {
    const body = document.getElementById('lpBody_people');
    if (!body || !_lpCurrentProject) return;
    const people = _lpCurrentProject.people || [];

    if (people.length === 0) {
        body.innerHTML = `
            <p style="color:#999; font-size:0.9em;">No people added yet.</p>
            <button class="btn btn-small btn-primary" onclick="_lpAddPerson()">+ Add Person</button>
        `;
        return;
    }

    body.innerHTML = `
        ${people.map((p, i) => `
            <div class="card" style="margin-bottom:8px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${_lpEsc(p.name)}</strong>
                    ${p.notes ? `<span style="color:#888; font-size:0.85em; margin-left:8px;">${_lpEsc(p.notes)}</span>` : ''}
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-small" onclick="_lpEditPerson(${i})" title="Edit">✏️</button>
                    <button class="btn btn-small btn-danger" onclick="_lpRemovePerson(${i})" title="Remove">✕</button>
                </div>
            </div>
        `).join('')}
        <button class="btn btn-small btn-primary" style="margin-top:8px;" onclick="_lpAddPerson()">+ Add Person</button>
    `;
}

async function _lpAddPerson() {
    const name = prompt('Person name:');
    if (!name || !name.trim()) return;
    const notes = prompt('Notes (optional):') || '';

    const people = [...(_lpCurrentProject.people || [])];
    people.push({ name: name.trim(), contactId: null, notes: notes.trim() });

    try {
        await lpCol().doc(_lpCurrentProjectId).update({
            people,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        _lpCurrentProject.people = people;
        _lpLoadPeople();
    } catch (err) {
        console.error('Error adding person:', err);
        alert('Error adding person.');
    }
}

async function _lpEditPerson(index) {
    const people = [...(_lpCurrentProject.people || [])];
    if (index < 0 || index >= people.length) return;

    const name = prompt('Person name:', people[index].name);
    if (!name || !name.trim()) return;
    const notes = prompt('Notes:', people[index].notes || '') || '';

    people[index] = { ...people[index], name: name.trim(), notes: notes.trim() };

    try {
        await lpCol().doc(_lpCurrentProjectId).update({
            people,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        _lpCurrentProject.people = people;
        _lpLoadPeople();
    } catch (err) {
        console.error('Error editing person:', err);
    }
}

async function _lpRemovePerson(index) {
    if (!confirm('Remove this person?')) return;
    const people = [...(_lpCurrentProject.people || [])];
    people.splice(index, 1);

    try {
        await lpCol().doc(_lpCurrentProjectId).update({
            people,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        _lpCurrentProject.people = people;
        _lpLoadPeople();
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
        const snap = await lpSub(_lpCurrentProjectId, 'days').orderBy('sortOrder').get();
        _lpDays = [];
        snap.forEach(doc => _lpDays.push({ id: doc.id, ...doc.data() }));
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
    const items = (d.items || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
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
    const parts = [];
    if (item.duration) parts.push(`<div><strong>Duration:</strong> ${_lpEsc(item.duration)}</div>`);
    if (item.cost != null && item.cost !== '') parts.push(`<div><strong>Cost:</strong> $${Number(item.cost).toFixed(2)}${item.costNote ? ` <span style="color:#888;">(${_lpEsc(item.costNote)})</span>` : ''}</div>`);
    if (item.confirmation) parts.push(`<div><strong>Confirmation:</strong> ${_lpEsc(item.confirmation)}</div>`);
    if (item.contact) parts.push(`<div><strong>Contact:</strong> ${_lpEsc(item.contact)}</div>`);
    if (item.notes) parts.push(`<div><strong>Notes:</strong> ${_lpEsc(item.notes)}</div>`);
    if (item.links && item.links.length) {
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

    items[idx] = item;

    try {
        await lpSub(_lpCurrentProjectId, 'days').doc(dayId).update({ items });
        day.items = items;
        const body = document.getElementById('lpBody_itinerary');
        if (body) _lpRenderItinerary(body);
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
// Stub sections — will be built in later phases
// ============================================================

function _lpLoadBookings() {
    const body = document.getElementById('lpBody_bookings');
    if (body) body.innerHTML = '<p style="color:#999; font-size:0.9em;">Bookings — coming in Phase 6.</p>';
}

function _lpLoadPacking() {
    const body = document.getElementById('lpBody_packing');
    if (body) body.innerHTML = '<p style="color:#999; font-size:0.9em;">Packing list — coming in Phase 7.</p>';
}

function _lpLoadNotes() {
    const body = document.getElementById('lpBody_notes');
    if (body) body.innerHTML = '<p style="color:#999; font-size:0.9em;">Notes — coming in Phase 8.</p>';
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
