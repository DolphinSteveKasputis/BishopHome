// ============================================================
// house.js — House / Interior Feature
// Handles Floors (Phase H1), Rooms (Phase H2), Things (Phase H3+)
// Uses the same Firestore patterns as zones.js / plants.js
// ============================================================

// ---- State ----
var currentFloor = null;   // Floor document currently being viewed
var currentRoom  = null;   // Room document currently being viewed
var currentThing = null;   // Thing document currently being viewed
var currentPanel = null;   // Breaker panel document currently being viewed

// Breaker-modal edit state (which slot is open)
var bpEditSlot = null;     // Slot number (1-based) being edited
var bpEditId   = null;     // breaker.id of the existing entry, or null if new

var currentSubThing = null;   // Sub-thing document currently being viewed
// Tag input state for the subThingModal
var stSelectedTags  = [];     // Tags currently selected in the modal
var stAllTags       = [];     // All known tag names loaded from Firestore

// ============================================================
// HOUSE CONTEXT LABEL  (used by calendar.js for event cards)
// ============================================================

/**
 * Returns a human-readable "House › Floor › Room" context label for a
 * house entity. Called asynchronously from createCalendarEventCard in
 * calendar.js so that house event cards show a useful location label on
 * the main Calendar page.
 *
 * @param {string} targetType  - "floor" | "room" | "thing"
 * @param {string} targetId    - Firestore document ID of the target
 * @returns {Promise<string|null>} Formatted label, or null if not found
 */
async function getHouseContextLabel(targetType, targetId) {
    try {
        if (targetType === 'floor') {
            var floorDoc = await db.collection('floors').doc(targetId).get();
            if (!floorDoc.exists) return null;
            return 'House \u203a ' + floorDoc.data().name;

        } else if (targetType === 'room') {
            var roomDoc = await db.collection('rooms').doc(targetId).get();
            if (!roomDoc.exists) return null;
            var roomData = roomDoc.data();
            var floorDoc2 = await db.collection('floors').doc(roomData.floorId).get();
            var floorName = floorDoc2.exists ? floorDoc2.data().name : 'Floor';
            return 'House \u203a ' + floorName + ' \u203a ' + roomData.name;

        } else if (targetType === 'thing') {
            var thingDoc = await db.collection('things').doc(targetId).get();
            if (!thingDoc.exists) return null;
            var thingData = thingDoc.data();
            var roomDoc2 = await db.collection('rooms').doc(thingData.roomId).get();
            if (!roomDoc2.exists) return 'House \u203a \u2026 \u203a ' + thingData.name;
            var roomData2 = roomDoc2.data();
            var floorDoc3 = await db.collection('floors').doc(roomData2.floorId).get();
            var floorName2 = floorDoc3.exists ? floorDoc3.data().name : 'Floor';
            return 'House \u203a ' + floorName2 + ' \u203a ' + roomData2.name + ' \u203a ' + thingData.name;

        } else if (targetType === 'subthing') {
            var stDoc = await db.collection('subThings').doc(targetId).get();
            if (!stDoc.exists) return null;
            var stData   = stDoc.data();
            var thingDoc = await db.collection('things').doc(stData.thingId).get();
            if (!thingDoc.exists) return 'House \u203a \u2026 \u203a ' + stData.name;
            var tData    = thingDoc.data();
            var rDoc2    = await db.collection('rooms').doc(tData.roomId).get();
            if (!rDoc2.exists) return 'House \u203a \u2026 \u203a ' + tData.name + ' \u203a ' + stData.name;
            var rData2   = rDoc2.data();
            var fDoc2    = await db.collection('floors').doc(rData2.floorId).get();
            var fName2   = fDoc2.exists ? fDoc2.data().name : 'Floor';
            return 'House \u203a ' + fName2 + ' \u203a ' + rData2.name + ' \u203a ' + tData.name + ' \u203a ' + stData.name;
        }
        return null;
    } catch (e) {
        return null;  // Silently skip if any lookup fails
    }
}

// ---- Category helpers ----
var THING_CATEGORIES = {
    'furniture':     'Furniture',
    'appliance':     'Appliance',
    'ceiling-fan':   'Ceiling Fan',
    'ceiling-light': 'Ceiling Light',
    'electronics':   'Electronics',
    'other':         'Other'
};

// ============================================================
// HOUSE HOME PAGE  (#house)
// Lists all floors sorted by floorNumber ascending.
// ============================================================

/**
 * Load and render the House home page.
 * Fetches floors, rooms, open problems, and upcoming calendar events in parallel,
 * then renders a summary stats bar and the floor list with room counts.
 */
function loadHousePage() {
    var container  = document.getElementById('floorListContainer');
    var emptyState = document.getElementById('floorEmptyState');
    var statsEl    = document.getElementById('houseSummaryStats');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';
    statsEl.innerHTML      = '';

    // Load the breaker panels list independently (different DOM container)
    loadPanelList();

    // Build the date range for "upcoming in next 30 days"
    var today   = new Date();
    today.setHours(0, 0, 0, 0);
    var in30    = new Date(today);
    in30.setDate(in30.getDate() + 30);
    var todayStr = today.toISOString().slice(0, 10);
    var in30Str  = in30.toISOString().slice(0, 10);

    // Run all four queries in parallel
    var floorsQ   = db.collection('floors').orderBy('floorNumber', 'asc').get();
    var roomsQ    = db.collection('rooms').get();
    var problemsQ = db.collection('problems')
        .where('targetType', 'in', ['floor', 'room', 'thing']).get();
    var eventsQ   = db.collection('calendarEvents')
        .where('targetType', 'in', ['floor', 'room', 'thing']).get();

    Promise.all([floorsQ, roomsQ, problemsQ, eventsQ])
        .then(function(results) {
            var floorSnap   = results[0];
            var roomSnap    = results[1];
            var problemSnap = results[2];
            var eventSnap   = results[3];

            emptyState.textContent = '';

            // --- Room counts per floor ---
            var roomCountByFloor = {};
            roomSnap.forEach(function(doc) {
                var floorId = doc.data().floorId;
                if (floorId) {
                    roomCountByFloor[floorId] = (roomCountByFloor[floorId] || 0) + 1;
                }
            });

            // --- Open problem count ---
            var openProblems = 0;
            problemSnap.forEach(function(doc) {
                if (doc.data().status === 'open') openProblems++;
            });

            // --- Upcoming event count (next 30 days, one-time events only) ---
            // Recurring events are shown as "active" since they repeat indefinitely
            var upcomingEvents  = 0;
            var recurringEvents = 0;
            eventSnap.forEach(function(doc) {
                var d = doc.data();
                if (d.recurring) {
                    recurringEvents++;
                } else if (d.date && d.date >= todayStr && d.date <= in30Str) {
                    upcomingEvents++;
                }
            });

            // --- Render summary stats bar ---
            renderHouseSummaryStats(statsEl, {
                openProblems:   openProblems,
                upcomingEvents: upcomingEvents,
                recurringEvents: recurringEvents,
                totalRooms: roomSnap.size,
                totalThings: 0   // placeholder — not queried separately
            });

            // --- Render floor list ---
            if (floorSnap.empty) {
                emptyState.textContent = 'No floors yet. Add a floor to get started.';
                return;
            }

            floorSnap.forEach(function(doc) {
                var roomCount = roomCountByFloor[doc.id] || 0;
                container.appendChild(buildFloorCard(doc.id, doc.data(), roomCount));
            });
        })
        .catch(function(err) {
            console.error('loadHousePage error:', err);
            emptyState.textContent = 'Error loading house data.';
        });
}

/**
 * Render the summary stats bar on the House home page.
 * @param {Element} el     - The container element to populate
 * @param {object}  stats  - { openProblems, upcomingEvents, recurringEvents, totalRooms }
 */
function renderHouseSummaryStats(el, stats) {
    var items = [];

    // Open problems
    if (stats.openProblems > 0) {
        items.push(
            '<span class="house-stat house-stat--problems">' +
                '<span class="house-stat-num">' + stats.openProblems + '</span>' +
                '<span class="house-stat-label"> open problem' + (stats.openProblems !== 1 ? 's' : '') + '</span>' +
            '</span>'
        );
    } else {
        items.push(
            '<span class="house-stat house-stat--ok">' +
                '<span class="house-stat-label">No open problems</span>' +
            '</span>'
        );
    }

    // Upcoming events (next 30 days)
    if (stats.upcomingEvents > 0 || stats.recurringEvents > 0) {
        var eventParts = [];
        if (stats.upcomingEvents > 0) {
            eventParts.push(stats.upcomingEvents + ' upcoming');
        }
        if (stats.recurringEvents > 0) {
            eventParts.push(stats.recurringEvents + ' recurring');
        }
        items.push(
            '<span class="house-stat house-stat--events">' +
                '<span class="house-stat-num">' + eventParts.join(', ') + '</span>' +
                '<span class="house-stat-label"> calendar event' +
                    (stats.upcomingEvents + stats.recurringEvents !== 1 ? 's' : '') + '</span>' +
            '</span>'
        );
    } else {
        items.push(
            '<span class="house-stat house-stat--ok">' +
                '<span class="house-stat-label">No upcoming events</span>' +
            '</span>'
        );
    }

    // Room count
    items.push(
        '<span class="house-stat house-stat--neutral">' +
            '<span class="house-stat-num">' + stats.totalRooms + '</span>' +
            '<span class="house-stat-label"> room' + (stats.totalRooms !== 1 ? 's' : '') + '</span>' +
        '</span>'
    );

    el.innerHTML = items.join('<span class="house-stat-sep">·</span>');
}

/**
 * Build a clickable card for a floor, showing room count.
 * @param {string} id         - Firestore document ID
 * @param {object} data       - Floor document data
 * @param {number} roomCount  - Number of rooms on this floor
 */
function buildFloorCard(id, data, roomCount) {
    var card = document.createElement('div');
    card.className = 'card card--clickable';

    var label    = escapeHtml(data.name || 'Unnamed Floor');
    var numLabel = (data.floorNumber !== undefined && data.floorNumber !== null)
        ? ' <span class="house-floor-num">Floor ' + data.floorNumber + '</span>'
        : '';
    var roomLabel = roomCount > 0
        ? '<span class="house-floor-meta">' + roomCount + ' room' + (roomCount !== 1 ? 's' : '') + '</span>'
        : '<span class="house-floor-meta">No rooms yet</span>';

    card.innerHTML =
        '<div class="card-main">' +
            '<span class="card-title">' + label + numLabel + '</span>' +
            roomLabel +
        '</div>' +
        '<span class="card-arrow">›</span>';

    card.addEventListener('click', function() {
        window.location.hash = '#floor/' + id;
    });

    return card;
}

// ============================================================
// FLOOR DETAIL PAGE  (#floor/{floorId})
// ============================================================

/**
 * Load the Floor detail page.
 * Called by app.js when the route is #floor/{id}.
 */
function loadFloorDetail(floorId) {
    db.collection('floors').doc(floorId).get()
        .then(function(doc) {
            if (!doc.exists) {
                window.location.hash = '#house';
                return;
            }
            currentFloor = Object.assign({ id: doc.id }, doc.data());
            renderFloorDetail(currentFloor);
            loadRoomsList(floorId);
        })
        .catch(function(err) { console.error('loadFloorDetail error:', err); });
}

/**
 * Render floor header / meta / breadcrumb, then load all feature sections.
 */
function renderFloorDetail(floor) {
    document.getElementById('floorTitle').textContent = floor.name || 'Floor';

    var meta = document.getElementById('floorMeta');
    if (floor.floorNumber !== undefined && floor.floorNumber !== null) {
        meta.textContent  = 'Floor number: ' + floor.floorNumber;
        meta.style.display = '';
    } else {
        meta.textContent  = '';
        meta.style.display = 'none';
    }

    buildHouseBreadcrumb([
        { label: 'House', hash: '#house' },
        { label: floor.name || 'Floor', hash: null }
    ]);

    // ---- Floor Plan button + thumbnail ----
    var fpBtn = document.getElementById('editFloorPlanBtn');
    if (fpBtn) fpBtn.href = '#floorplan/' + floor.id;

    var thumbContainer = document.getElementById('floorPlanThumbnailContainer');
    if (thumbContainer) {
        thumbContainer.onclick = function() { window.location.hash = '#floorplan/' + floor.id; };
    }

    if (typeof fpLoadAndRenderThumbnail === 'function') {
        fpLoadAndRenderThumbnail(floor.id, 'floorPlanThumbnailContainer', 'floorPlanThumbnailEmpty');
    }

    // ---- Load all feature sections ----
    loadProblems('floor', floor.id, 'floorProblemsContainer', 'floorProblemsEmptyState');
    loadFacts(   'floor', floor.id, 'floorFactsContainer',    'floorFactsEmptyState');
    loadProjects('floor', floor.id, 'floorProjectsContainer', 'floorProjectsEmptyState');
    loadActivities('floor', floor.id, 'floorActivityContainer', 'floorActivityEmptyState');
    loadPhotos(  'floor', floor.id, 'floorPhotoContainer',    'floorPhotoEmptyState');

    if (typeof loadEventsForTarget === 'function') {
        var months = parseInt(document.getElementById('floorCalendarRangeSelect').value, 10) || 3;
        loadEventsForTarget('floor', floor.id,
            'floorCalendarEventsContainer', 'floorCalendarEventsEmptyState', months);
    }
}

// ============================================================
// ROOMS LIST  (shown on the Floor detail page)
// ============================================================

/**
 * Load and render the rooms list for a given floor.
 * @param {string} floorId
 */
function loadRoomsList(floorId) {
    var container  = document.getElementById('roomListContainer');
    var emptyState = document.getElementById('roomListEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';

    db.collection('rooms')
        .where('floorId', '==', floorId)
        .get()
        .then(function(snapshot) {
            emptyState.textContent = '';

            if (snapshot.empty) {
                emptyState.textContent = 'No rooms yet. Add a room to get started.';
                return;
            }

            // Sort client-side by createdAt to avoid needing a composite index
            var docs = [];
            snapshot.forEach(function(doc) { docs.push(doc); });
            docs.sort(function(a, b) {
                var ta = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
                var tb = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
                return ta - tb;
            });
            docs.forEach(function(doc) {
                container.appendChild(buildRoomCard(doc.id, doc.data()));
            });
        })
        .catch(function(err) {
            console.error('loadRoomsList error:', err);
            emptyState.textContent = 'Error loading rooms.';
        });
}

/**
 * Build a clickable card for a room.
 */
function buildRoomCard(id, data) {
    var card = document.createElement('div');
    card.className = 'card card--clickable';

    var label    = escapeHtml(data.name || 'Unnamed Room');
    var typeBadge = buildRoomTypeBadge(data.type);

    card.innerHTML =
        '<div class="card-main">' +
            '<span class="card-title">' + label + '</span>' +
            typeBadge +
        '</div>' +
        '<span class="card-arrow">›</span>';

    card.addEventListener('click', function() {
        window.location.hash = '#room/' + id;
    });

    return card;
}

/**
 * Return an HTML badge string for a room type (only for non-standard types).
 */
function buildRoomTypeBadge(type) {
    if (!type || type === 'standard') return '';
    var labels = { hallway: 'Hallway', stairs: 'Stairs' };
    var label  = labels[type] || type;
    return '<span class="house-room-type-badge house-room-type-badge--' +
           escapeHtml(type) + '">' + escapeHtml(label) + '</span>';
}

// ============================================================
// ROOM DETAIL PAGE  (#room/{roomId})
// ============================================================

/**
 * Load the Room detail page.
 * Called by app.js when the route is #room/{id}.
 */
function loadRoomDetail(roomId) {
    db.collection('rooms').doc(roomId).get()
        .then(function(doc) {
            if (!doc.exists) {
                window.location.hash = '#house';
                return;
            }
            currentRoom = Object.assign({ id: doc.id }, doc.data());

            // Also load the parent floor so we can show it in the breadcrumb
            return db.collection('floors').doc(currentRoom.floorId).get()
                .then(function(floorDoc) {
                    currentFloor = floorDoc.exists
                        ? Object.assign({ id: floorDoc.id }, floorDoc.data())
                        : { id: currentRoom.floorId, name: 'Unknown Floor' };
                    renderRoomDetail(currentRoom, currentFloor);
                    loadThingsList(currentRoom.id);
                });
        })
        .catch(function(err) { console.error('loadRoomDetail error:', err); });
}

/**
 * Render room header / meta / breadcrumb, then load all feature sections.
 */
function renderRoomDetail(room, floor) {
    document.getElementById('roomTitle').textContent = room.name || 'Room';

    // Meta: floor name + type badge
    var meta = document.getElementById('roomMeta');
    var typeLabel = '';
    if (room.type && room.type !== 'standard') {
        var typeLabels = { hallway: 'Hallway', stairs: 'Stairs' };
        typeLabel = ' · ' + (typeLabels[room.type] || room.type);
    }
    meta.textContent = (floor.name || 'Unknown Floor') + typeLabel;

    // Breadcrumb — "House › Floor Name › Room Name"
    buildHouseBreadcrumb([
        { label: 'House',              hash: '#house' },
        { label: floor.name || 'Floor', hash: '#floor/' + floor.id },
        { label: room.name || 'Room',  hash: null }
    ]);

    // ---- Load all feature sections ----
    loadProblems('room', room.id, 'roomProblemsContainer', 'roomProblemsEmptyState');
    loadFacts(   'room', room.id, 'roomFactsContainer',    'roomFactsEmptyState');
    loadProjects('room', room.id, 'roomProjectsContainer', 'roomProjectsEmptyState');
    loadActivities('room', room.id, 'roomActivityContainer', 'roomActivityEmptyState');
    loadPhotos(  'room', room.id, 'roomPhotoContainer',    'roomPhotoEmptyState');

    if (typeof loadEventsForTarget === 'function') {
        var months = parseInt(document.getElementById('roomCalendarRangeSelect').value, 10) || 3;
        loadEventsForTarget('room', room.id,
            'roomCalendarEventsContainer', 'roomCalendarEventsEmptyState', months);
    }
}

// ============================================================
// BREADCRUMB / HEADER HELPERS
// ============================================================

/**
 * Build the breadcrumb bar and sticky header for House pages.
 * @param {Array} crumbs  [{label, hash}] — hash null = current page (no link)
 */
function buildHouseBreadcrumb(crumbs) {
    var bar    = document.getElementById('breadcrumbBar');
    var header = document.getElementById('headerTitle');

    bar.innerHTML = '';

    crumbs.forEach(function(crumb, i) {
        var span = document.createElement('span');
        if (crumb.hash) {
            var a = document.createElement('a');
            a.href        = crumb.hash;
            a.className   = 'breadcrumb-link';
            a.textContent = crumb.label;
            span.appendChild(a);
        } else {
            span.className   = 'breadcrumb-current';
            span.textContent = crumb.label;
        }
        bar.appendChild(span);

        if (i < crumbs.length - 1) {
            var sep = document.createElement('span');
            sep.className   = 'breadcrumb-sep';
            sep.textContent = ' › ';
            bar.appendChild(sep);
        }
    });

    // Sticky header — "Bishop › [deepest label]"
    var deepest = crumbs[crumbs.length - 1].label;
    header.innerHTML =
        '<a href="#home" class="home-link">Bishop</a>' +
        '<span class="header-zone-sep">›</span>' +
        '<span class="header-zone-name">' + escapeHtml(deepest) + '</span>';
}

// ============================================================
// FLOOR MODAL  (Add / Edit)
// ============================================================

function openFloorModal(editId, data) {
    var modal     = document.getElementById('floorModal');
    var nameInput = document.getElementById('floorNameInput');
    var numInput  = document.getElementById('floorNumberInput');
    var deleteBtn = document.getElementById('floorModalDeleteBtn');

    if (editId) {
        document.getElementById('floorModalTitle').textContent = 'Edit Floor';
        nameInput.value         = data.name || '';
        numInput.value          = (data.floorNumber !== undefined && data.floorNumber !== null)
                                      ? data.floorNumber : '';
        deleteBtn.style.display = '';
        modal.dataset.mode      = 'edit';
        modal.dataset.editId    = editId;
    } else {
        document.getElementById('floorModalTitle').textContent = 'Add Floor';
        nameInput.value         = '';
        numInput.value          = '';
        deleteBtn.style.display = 'none';
        modal.dataset.mode      = 'add';
        modal.dataset.editId    = '';
    }

    openModal('floorModal');
    nameInput.focus();
}

document.getElementById('floorModalSaveBtn').addEventListener('click', function() {
    var modal   = document.getElementById('floorModal');
    var nameVal = document.getElementById('floorNameInput').value.trim();
    var numVal  = document.getElementById('floorNumberInput').value.trim();

    if (!nameVal) { alert('Please enter a floor name.'); return; }

    var floorData = {
        name:        nameVal,
        floorNumber: numVal !== '' ? parseInt(numVal, 10) : null
    };

    var mode   = modal.dataset.mode;
    var editId = modal.dataset.editId;

    if (mode === 'edit' && editId) {
        db.collection('floors').doc(editId).update(floorData)
            .then(function() {
                closeModal('floorModal');
                if (window.location.hash.startsWith('#floor/')) {
                    loadFloorDetail(editId);
                } else {
                    loadHousePage();
                }
            })
            .catch(function(err) { console.error('Update floor error:', err); });
    } else {
        floorData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('floors').add(floorData)
            .then(function() {
                closeModal('floorModal');
                loadHousePage();
            })
            .catch(function(err) { console.error('Add floor error:', err); });
    }
});

document.getElementById('floorModalCancelBtn').addEventListener('click', function() {
    closeModal('floorModal');
});

document.getElementById('floorModalDeleteBtn').addEventListener('click', function() {
    var editId = document.getElementById('floorModal').dataset.editId;
    if (!editId) return;

    // Block delete if the floor has rooms
    db.collection('rooms').where('floorId', '==', editId).limit(1).get()
        .then(function(snap) {
            if (!snap.empty) {
                alert('This floor has rooms. Delete or move all rooms first.');
                return;
            }
            if (!confirm('Delete this floor? This cannot be undone.')) return;
            db.collection('floors').doc(editId).delete()
                .then(function() {
                    closeModal('floorModal');
                    window.location.hash = '#house';
                })
                .catch(function(err) { console.error('Delete floor error:', err); });
        });
});

// ============================================================
// ROOM MODAL  (Add / Edit)
// ============================================================

/**
 * Open the room add/edit modal.
 * @param {string|null} editId  - Firestore room ID when editing; null for add
 * @param {object|null} data    - Existing room data when editing
 */
function openRoomModal(editId, data) {
    var modal      = document.getElementById('roomModal');
    var nameInput  = document.getElementById('roomNameInput');
    var typeSelect = document.getElementById('roomTypeSelect');
    var deleteBtn  = document.getElementById('roomModalDeleteBtn');
    var stairsGrp  = document.getElementById('roomStairsConnectGroup');
    var connectSel = document.getElementById('roomConnectsToFloorSelect');

    if (editId) {
        document.getElementById('roomModalTitle').textContent = 'Edit Room';
        nameInput.value         = data.name || '';
        typeSelect.value        = data.type || 'standard';
        deleteBtn.style.display = '';
        modal.dataset.mode      = 'edit';
        modal.dataset.editId    = editId;
    } else {
        document.getElementById('roomModalTitle').textContent = 'Add Room';
        nameInput.value         = '';
        typeSelect.value        = 'standard';
        deleteBtn.style.display = 'none';
        modal.dataset.mode      = 'add';
        modal.dataset.editId    = '';
    }

    // Load all floors into the "connects to" dropdown (exclude the current floor)
    connectSel.innerHTML = '<option value="">— Not specified —</option>';
    db.collection('floors').orderBy('floorNumber', 'asc').get()
        .then(function(snap) {
            snap.forEach(function(doc) {
                if (currentFloor && doc.id === currentFloor.id) return; // skip current floor
                var opt = document.createElement('option');
                opt.value       = doc.id;
                opt.textContent = doc.data().name || 'Floor';
                if (editId && data.connectsToFloorId === doc.id) opt.selected = true;
                connectSel.appendChild(opt);
            });
        });

    // Show/hide the "connects to floor" group based on type
    function toggleStairsGroup() {
        stairsGrp.style.display = typeSelect.value === 'stairs' ? '' : 'none';
    }
    toggleStairsGroup();
    typeSelect.onchange = toggleStairsGroup;

    openModal('roomModal');
    nameInput.focus();
}

document.getElementById('roomModalSaveBtn').addEventListener('click', function() {
    var modal   = document.getElementById('roomModal');
    var nameVal = document.getElementById('roomNameInput').value.trim();
    var typeVal = document.getElementById('roomTypeSelect').value;

    if (!nameVal) { alert('Please enter a room name.'); return; }

    var mode   = modal.dataset.mode;
    var editId = modal.dataset.editId;

    var connectsToFloorId = '';
    if (typeVal === 'stairs') {
        connectsToFloorId = document.getElementById('roomConnectsToFloorSelect').value || '';
    }

    if (mode === 'edit' && editId) {
        db.collection('rooms').doc(editId).update({
            name:               nameVal,
            type:               typeVal,
            connectsToFloorId:  connectsToFloorId
        })
            .then(function() {
                closeModal('roomModal');
                loadRoomDetail(editId);
            })
            .catch(function(err) { console.error('Update room error:', err); });
    } else {
        // Add — floorId comes from the currently viewed floor
        if (!currentFloor) { alert('No floor selected.'); return; }
        var roomData = {
            name:               nameVal,
            type:               typeVal,
            connectsToFloorId:  connectsToFloorId,
            floorId:            currentFloor.id,
            createdAt:          firebase.firestore.FieldValue.serverTimestamp()
        };
        db.collection('rooms').add(roomData)
            .then(function() {
                closeModal('roomModal');
                loadRoomsList(currentFloor.id);
            })
            .catch(function(err) { console.error('Add room error:', err); });
    }
});

document.getElementById('roomModalCancelBtn').addEventListener('click', function() {
    closeModal('roomModal');
});

document.getElementById('roomModalDeleteBtn').addEventListener('click', function() {
    var editId = document.getElementById('roomModal').dataset.editId;
    if (!editId) return;

    if (!confirm('Delete this room? This cannot be undone.')) return;

    db.collection('rooms').doc(editId).delete()
        .then(function() {
            closeModal('roomModal');
            // Go back to the floor this room belonged to
            if (currentFloor) {
                window.location.hash = '#floor/' + currentFloor.id;
            } else {
                window.location.hash = '#house';
            }
        })
        .catch(function(err) { console.error('Delete room error:', err); });
});

// ============================================================
// MOVE ROOM MODAL
// ============================================================

/**
 * Open the move-room modal, populating the floor dropdown.
 */
function openMoveRoomModal() {
    var select = document.getElementById('moveRoomFloorSelect');
    select.innerHTML = '<option value="">Loading floors…</option>';

    db.collection('floors').orderBy('floorNumber', 'asc').get()
        .then(function(snapshot) {
            select.innerHTML = '';
            snapshot.forEach(function(doc) {
                var opt   = document.createElement('option');
                opt.value = doc.id;
                var data  = doc.data();
                opt.textContent = data.name +
                    (data.floorNumber !== null && data.floorNumber !== undefined
                        ? ' (Floor ' + data.floorNumber + ')' : '');
                // Pre-select the current floor
                if (currentRoom && doc.id === currentRoom.floorId) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        });

    openModal('moveRoomModal');
}

document.getElementById('moveRoomSaveBtn').addEventListener('click', function() {
    var newFloorId = document.getElementById('moveRoomFloorSelect').value;
    if (!newFloorId || !currentRoom) return;

    if (newFloorId === currentRoom.floorId) {
        closeModal('moveRoomModal');
        return;
    }

    db.collection('rooms').doc(currentRoom.id).update({ floorId: newFloorId })
        .then(function() {
            closeModal('moveRoomModal');
            // Navigate to the new floor
            window.location.hash = '#floor/' + newFloorId;
        })
        .catch(function(err) { console.error('Move room error:', err); });
});

document.getElementById('moveRoomCancelBtn').addEventListener('click', function() {
    closeModal('moveRoomModal');
});

// ============================================================
// PAGE BUTTON WIRING
// ============================================================

// House home — Add Floor
document.getElementById('addFloorBtn').addEventListener('click', function() {
    openFloorModal(null, null);
});

// Floor detail — Edit Floor
document.getElementById('editFloorBtn').addEventListener('click', function() {
    if (!currentFloor) return;
    openFloorModal(currentFloor.id, currentFloor);
});

// Floor detail — Delete Floor
document.getElementById('deleteFloorBtn').addEventListener('click', function() {
    if (!currentFloor) return;

    // Block if rooms exist
    db.collection('rooms').where('floorId', '==', currentFloor.id).limit(1).get()
        .then(function(snap) {
            if (!snap.empty) {
                alert('This floor has rooms. Delete or move all rooms first.');
                return;
            }
            if (!confirm('Delete "' + (currentFloor.name || 'this floor') + '"? This cannot be undone.')) return;
            db.collection('floors').doc(currentFloor.id).delete()
                .then(function() { window.location.hash = '#house'; })
                .catch(function(err) { console.error('Delete floor error:', err); });
        });
});

// Floor detail — Add Room
document.getElementById('addRoomBtn').addEventListener('click', function() {
    openRoomModal(null, null);
});

// Room detail — Edit Room
document.getElementById('editRoomBtn').addEventListener('click', function() {
    if (!currentRoom) return;
    openRoomModal(currentRoom.id, currentRoom);
});

// Room detail — Move Room
document.getElementById('moveRoomBtn').addEventListener('click', function() {
    if (!currentRoom) return;
    openMoveRoomModal();
});

// Room detail — Delete Room
document.getElementById('deleteRoomBtn').addEventListener('click', function() {
    if (!currentRoom) return;

    if (!confirm('Delete "' + (currentRoom.name || 'this room') + '"? This cannot be undone.')) return;

    db.collection('rooms').doc(currentRoom.id).delete()
        .then(function() {
            if (currentFloor) {
                window.location.hash = '#floor/' + currentFloor.id;
            } else {
                window.location.hash = '#house';
            }
        })
        .catch(function(err) { console.error('Delete room error:', err); });
});

// ============================================================
// THINGS LIST  (shown on the Room detail page)
// ============================================================

/**
 * Load and render the things list for a given room.
 * @param {string} roomId
 */
function loadThingsList(roomId) {
    var container  = document.getElementById('thingListContainer');
    var emptyState = document.getElementById('thingListEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';

    db.collection('things')
        .where('roomId', '==', roomId)
        .get()
        .then(function(snapshot) {
            emptyState.textContent = '';

            if (snapshot.empty) {
                emptyState.textContent = 'No things yet. Add furniture, appliances, or fixtures.';
                return;
            }

            // Sort client-side by createdAt (avoids composite index requirement)
            var docs = [];
            snapshot.forEach(function(doc) { docs.push(doc); });
            docs.sort(function(a, b) {
                var ta = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
                var tb = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
                return ta - tb;
            });
            docs.forEach(function(doc) {
                container.appendChild(buildThingCard(doc.id, doc.data()));
            });
        })
        .catch(function(err) {
            console.error('loadThingsList error:', err);
            emptyState.textContent = 'Error loading things.';
        });
}

/**
 * Build a clickable card for a thing.
 */
function buildThingCard(id, data) {
    var card = document.createElement('div');
    card.className = 'card card--clickable';

    var label    = escapeHtml(data.name || 'Unnamed Thing');
    var catBadge = buildThingCategoryBadge(data.category);

    card.innerHTML =
        '<div class="card-main">' +
            '<span class="card-title">' + label + '</span>' +
            catBadge +
        '</div>' +
        '<span class="card-arrow">›</span>';

    card.addEventListener('click', function() {
        window.location.hash = '#thing/' + id;
    });

    return card;
}

/**
 * Return an HTML badge string for a thing category.
 */
function buildThingCategoryBadge(category) {
    if (!category) return '';
    var label = THING_CATEGORIES[category] || category;
    return '<span class="house-thing-cat-badge house-thing-cat-badge--' +
           escapeHtml(category) + '">' + escapeHtml(label) + '</span>';
}

// ============================================================
// THING DETAIL PAGE  (#thing/{thingId})
// ============================================================

/**
 * Load the Thing detail page.
 * Called by app.js when the route is #thing/{id}.
 */
function loadThingDetail(thingId) {
    db.collection('things').doc(thingId).get()
        .then(function(doc) {
            if (!doc.exists) {
                window.location.hash = '#house';
                return;
            }
            currentThing = Object.assign({ id: doc.id }, doc.data());

            // Load parent room, then parent floor for breadcrumb
            return db.collection('rooms').doc(currentThing.roomId).get()
                .then(function(roomDoc) {
                    currentRoom = roomDoc.exists
                        ? Object.assign({ id: roomDoc.id }, roomDoc.data())
                        : { id: currentThing.roomId, name: 'Unknown Room', floorId: null };

                    var floorId = currentRoom.floorId;
                    if (!floorId) {
                        currentFloor = { id: '', name: 'Unknown Floor' };
                        renderThingDetail(currentThing, currentRoom, currentFloor);
                        return;
                    }

                    return db.collection('floors').doc(floorId).get()
                        .then(function(floorDoc) {
                            currentFloor = floorDoc.exists
                                ? Object.assign({ id: floorDoc.id }, floorDoc.data())
                                : { id: floorId, name: 'Unknown Floor' };
                            renderThingDetail(currentThing, currentRoom, currentFloor);
                        });
                });
        })
        .catch(function(err) { console.error('loadThingDetail error:', err); });
}

/**
 * Render thing header / meta / breadcrumb, then load all feature sections.
 */
function renderThingDetail(thing, room, floor) {
    document.getElementById('thingTitle').textContent = thing.name || 'Thing';

    var meta     = document.getElementById('thingMeta');
    var catLabel = THING_CATEGORIES[thing.category] || thing.category || '';
    meta.textContent = (floor.name || '') + ' \u203a ' + (room.name || '') +
                       (catLabel ? ' \u00b7 ' + catLabel : '');

    // Inventory details card
    renderInventoryDetails(thing, 'thingDetailsSection');

    // Breadcrumb: House > Floor > Room > Thing
    buildHouseBreadcrumb([
        { label: 'House',               hash: '#house' },
        { label: floor.name || 'Floor', hash: '#floor/' + floor.id },
        { label: room.name  || 'Room',  hash: '#room/'  + room.id },
        { label: thing.name || 'Thing', hash: null }
    ]);

    // ---- Load all feature sections ----
    loadProblems('thing', thing.id, 'thingProblemsContainer', 'thingProblemsEmptyState');
    loadFacts(   'thing', thing.id, 'thingFactsContainer',    'thingFactsEmptyState');
    loadProjects('thing', thing.id, 'thingProjectsContainer', 'thingProjectsEmptyState');
    loadActivities('thing', thing.id, 'thingActivityContainer', 'thingActivityEmptyState');
    loadPhotos(  'thing', thing.id, 'thingPhotoContainer',    'thingPhotoEmptyState');

    if (typeof loadEventsForTarget === 'function') {
        var months = parseInt(document.getElementById('thingCalendarRangeSelect').value, 10) || 3;
        loadEventsForTarget('thing', thing.id,
            'thingCalendarEventsContainer', 'thingCalendarEventsEmptyState', months);
    }

    // Load sub-things (items) list
    loadSubThingsList(thing.id);
}

// ============================================================
// THING MODAL  (Add / Edit)
// ============================================================

function openThingModal(editId, data) {
    var modal     = document.getElementById('thingModal');
    var nameInput = document.getElementById('thingNameInput');
    var catSelect = document.getElementById('thingCategorySelect');
    var deleteBtn = document.getElementById('thingModalDeleteBtn');

    if (editId) {
        document.getElementById('thingModalTitle').textContent = 'Edit Thing';
        nameInput.value         = data.name || '';
        catSelect.value         = data.category || 'furniture';
        document.getElementById('thingPricePaidInput').value   = data.pricePaid   || '';
        document.getElementById('thingWorthInput').value       = data.worth       || '';
        document.getElementById('thingYearBoughtInput').value  = data.yearBought  || '';
        document.getElementById('thingDescriptionInput').value = data.description || '';
        document.getElementById('thingCommentInput').value     = data.comment     || '';
        deleteBtn.style.display = '';
        modal.dataset.mode      = 'edit';
        modal.dataset.editId    = editId;
    } else {
        document.getElementById('thingModalTitle').textContent = 'Add Thing';
        nameInput.value         = '';
        catSelect.value         = 'furniture';
        document.getElementById('thingPricePaidInput').value   = '';
        document.getElementById('thingWorthInput').value       = '';
        document.getElementById('thingYearBoughtInput').value  = '';
        document.getElementById('thingDescriptionInput').value = '';
        document.getElementById('thingCommentInput').value     = '';
        deleteBtn.style.display = 'none';
        modal.dataset.mode      = 'add';
        modal.dataset.editId    = '';
    }

    openModal('thingModal');
    nameInput.focus();
}

document.getElementById('thingModalSaveBtn').addEventListener('click', function() {
    var modal   = document.getElementById('thingModal');
    var nameVal = document.getElementById('thingNameInput').value.trim();
    var catVal  = document.getElementById('thingCategorySelect').value;

    if (!nameVal) { alert('Please enter a name.'); return; }

    var mode   = modal.dataset.mode;
    var editId = modal.dataset.editId;

    var extraFields = {
        pricePaid:   document.getElementById('thingPricePaidInput').value.trim()   || null,
        worth:       document.getElementById('thingWorthInput').value.trim()       || null,
        yearBought:  document.getElementById('thingYearBoughtInput').value.trim()  || null,
        description: document.getElementById('thingDescriptionInput').value.trim(),
        comment:     document.getElementById('thingCommentInput').value.trim()
    };

    if (mode === 'edit' && editId) {
        var updateData = Object.assign({ name: nameVal, category: catVal }, extraFields);
        db.collection('things').doc(editId).update(updateData)
            .then(function() {
                closeModal('thingModal');
                loadThingDetail(editId);
            })
            .catch(function(err) { console.error('Update thing error:', err); });
    } else {
        if (!currentRoom) { alert('No room selected.'); return; }
        var thingData = Object.assign({
            name:      nameVal,
            category:  catVal,
            roomId:    currentRoom.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, extraFields);
        db.collection('things').add(thingData)
            .then(function() {
                closeModal('thingModal');
                loadThingsList(currentRoom.id);
            })
            .catch(function(err) { console.error('Add thing error:', err); });
    }
});

document.getElementById('thingModalCancelBtn').addEventListener('click', function() {
    closeModal('thingModal');
});

document.getElementById('thingModalDeleteBtn').addEventListener('click', function() {
    var editId = document.getElementById('thingModal').dataset.editId;
    if (!editId) return;

    db.collection('subThings').where('thingId', '==', editId).limit(1).get()
        .then(function(snap) {
            if (!snap.empty) {
                alert('This thing has items. Delete all items first.');
                return;
            }

            if (!confirm('Delete this thing? This cannot be undone.')) return;

            db.collection('things').doc(editId).delete()
                .then(function() {
                    closeModal('thingModal');
                    if (currentRoom) {
                        window.location.hash = '#room/' + currentRoom.id;
                    } else {
                        window.location.hash = '#house';
                    }
                })
                .catch(function(err) { console.error('Delete thing error:', err); });
        })
        .catch(function(err) { console.error('Check subThings error:', err); });
});

// ============================================================
// MOVE THING MODAL
// ============================================================

/**
 * Open the move-thing modal, showing all rooms grouped by floor.
 */
function openMoveThingModal() {
    var select = document.getElementById('moveThingRoomSelect');
    select.innerHTML = '<option value="">Loading rooms…</option>';

    // Load all floors then all rooms, grouped by floor for the dropdown
    db.collection('floors').orderBy('floorNumber', 'asc').get()
        .then(function(floorSnap) {
            var floorMap   = {};
            var floorOrder = [];
            floorSnap.forEach(function(doc) {
                floorMap[doc.id] = doc.data().name || 'Floor';
                floorOrder.push(doc.id);
            });

            return db.collection('rooms').get().then(function(roomSnap) {
                var byFloor = {};
                roomSnap.forEach(function(doc) {
                    var d = doc.data();
                    if (!byFloor[d.floorId]) byFloor[d.floorId] = [];
                    byFloor[d.floorId].push({ id: doc.id, name: d.name || 'Room' });
                });

                select.innerHTML = '';
                floorOrder.forEach(function(floorId) {
                    var rooms = byFloor[floorId] || [];
                    if (!rooms.length) return;

                    var group = document.createElement('optgroup');
                    group.label = floorMap[floorId] || 'Floor';
                    rooms.forEach(function(r) {
                        var opt = document.createElement('option');
                        opt.value = r.id;
                        opt.textContent = r.name;
                        if (currentThing && r.id === currentThing.roomId) opt.selected = true;
                        group.appendChild(opt);
                    });
                    select.appendChild(group);
                });

                if (!select.options.length) {
                    select.innerHTML = '<option value="">No rooms available</option>';
                }
            });
        });

    openModal('moveThingModal');
}

document.getElementById('moveThingSaveBtn').addEventListener('click', function() {
    var newRoomId = document.getElementById('moveThingRoomSelect').value;
    if (!newRoomId || !currentThing) return;

    if (newRoomId === currentThing.roomId) {
        closeModal('moveThingModal');
        return;
    }

    db.collection('things').doc(currentThing.id).update({ roomId: newRoomId })
        .then(function() {
            closeModal('moveThingModal');
            window.location.hash = '#room/' + newRoomId;
        })
        .catch(function(err) { console.error('Move thing error:', err); });
});

document.getElementById('moveThingCancelBtn').addEventListener('click', function() {
    closeModal('moveThingModal');
});

// ============================================================
// THING PAGE BUTTON WIRING
// ============================================================

// Room detail — Add Thing
document.getElementById('addThingBtn').addEventListener('click', function() {
    openThingModal(null, null);
});

// Thing detail — Edit
document.getElementById('editThingBtn').addEventListener('click', function() {
    if (!currentThing) return;
    openThingModal(currentThing.id, currentThing);
});

// Thing detail — Move
document.getElementById('moveThingBtn').addEventListener('click', function() {
    if (!currentThing) return;
    openMoveThingModal();
});

// Thing detail — Delete
document.getElementById('deleteThingBtn').addEventListener('click', function() {
    if (!currentThing) return;

    if (!confirm('Delete "' + (currentThing.name || 'this thing') + '"? This cannot be undone.')) return;

    db.collection('things').doc(currentThing.id).delete()
        .then(function() {
            if (currentRoom) {
                window.location.hash = '#room/' + currentRoom.id;
            } else {
                window.location.hash = '#house';
            }
        })
        .catch(function(err) { console.error('Delete thing error:', err); });
});

// ============================================================
// THING FEATURE BUTTON WIRING  (Problems, Facts, Projects,
// Activities, Photos, Calendar Events on the Thing detail page)
// ============================================================

document.getElementById('addThingProblemBtn').addEventListener('click', function() {
    if (currentThing) openAddProblemModal('thing', currentThing.id);
});

document.getElementById('addThingFactBtn').addEventListener('click', function() {
    if (currentThing) openAddFactModal('thing', currentThing.id);
});

document.getElementById('addThingProjectBtn').addEventListener('click', function() {
    if (currentThing) openAddProjectModal('thing', currentThing.id);
});

document.getElementById('logThingActivityBtn').addEventListener('click', function() {
    if (currentThing) openLogActivityModal('thing', currentThing.id);
});

document.getElementById('addThingPhotoBtn').addEventListener('click', function() {
    if (currentThing) triggerPhotoUpload('thing', currentThing.id);
});

document.getElementById('addThingCalendarEventBtn').addEventListener('click', function() {
    if (currentThing && typeof openAddCalendarEventModal === 'function') {
        var reloadFn = function() {
            var months = parseInt(document.getElementById('thingCalendarRangeSelect').value, 10) || 3;
            loadEventsForTarget('thing', currentThing.id,
                'thingCalendarEventsContainer', 'thingCalendarEventsEmptyState', months);
        };
        openAddCalendarEventModal('thing', currentThing.id, reloadFn);
    }
});

document.getElementById('thingCalendarRangeSelect').addEventListener('change', function() {
    if (currentThing && typeof loadEventsForTarget === 'function') {
        var months = parseInt(this.value, 10) || 3;
        loadEventsForTarget('thing', currentThing.id,
            'thingCalendarEventsContainer', 'thingCalendarEventsEmptyState', months);
    }
});

// ============================================================
// FLOOR FEATURE BUTTON WIRING  (Problems, Facts, Projects,
// Activities, Photos, Calendar Events on the Floor detail page)
// ============================================================

document.getElementById('addFloorProblemBtn').addEventListener('click', function() {
    if (currentFloor) openAddProblemModal('floor', currentFloor.id);
});

document.getElementById('addFloorFactBtn').addEventListener('click', function() {
    if (currentFloor) openAddFactModal('floor', currentFloor.id);
});

document.getElementById('addFloorProjectBtn').addEventListener('click', function() {
    if (currentFloor) openAddProjectModal('floor', currentFloor.id);
});

document.getElementById('logFloorActivityBtn').addEventListener('click', function() {
    if (currentFloor) openLogActivityModal('floor', currentFloor.id);
});

document.getElementById('addFloorPhotoBtn').addEventListener('click', function() {
    if (currentFloor) triggerPhotoUpload('floor', currentFloor.id);
});

document.getElementById('addFloorCalendarEventBtn').addEventListener('click', function() {
    if (currentFloor && typeof openAddCalendarEventModal === 'function') {
        var reloadFn = function() {
            var months = parseInt(document.getElementById('floorCalendarRangeSelect').value, 10) || 3;
            loadEventsForTarget('floor', currentFloor.id,
                'floorCalendarEventsContainer', 'floorCalendarEventsEmptyState', months);
        };
        openAddCalendarEventModal('floor', currentFloor.id, reloadFn);
    }
});

document.getElementById('floorCalendarRangeSelect').addEventListener('change', function() {
    if (currentFloor && typeof loadEventsForTarget === 'function') {
        var months = parseInt(this.value, 10) || 3;
        loadEventsForTarget('floor', currentFloor.id,
            'floorCalendarEventsContainer', 'floorCalendarEventsEmptyState', months);
    }
});

// ============================================================
// ROOM FEATURE BUTTON WIRING  (Problems, Facts, Projects,
// Activities, Photos, Calendar Events on the Room detail page)
// ============================================================

document.getElementById('addRoomProblemBtn').addEventListener('click', function() {
    if (currentRoom) openAddProblemModal('room', currentRoom.id);
});

document.getElementById('addRoomFactBtn').addEventListener('click', function() {
    if (currentRoom) openAddFactModal('room', currentRoom.id);
});

document.getElementById('addRoomProjectBtn').addEventListener('click', function() {
    if (currentRoom) openAddProjectModal('room', currentRoom.id);
});

document.getElementById('logRoomActivityBtn').addEventListener('click', function() {
    if (currentRoom) openLogActivityModal('room', currentRoom.id);
});

document.getElementById('addRoomPhotoBtn').addEventListener('click', function() {
    if (currentRoom) triggerPhotoUpload('room', currentRoom.id);
});

document.getElementById('addRoomCalendarEventBtn').addEventListener('click', function() {
    if (currentRoom && typeof openAddCalendarEventModal === 'function') {
        var reloadFn = function() {
            var months = parseInt(document.getElementById('roomCalendarRangeSelect').value, 10) || 3;
            loadEventsForTarget('room', currentRoom.id,
                'roomCalendarEventsContainer', 'roomCalendarEventsEmptyState', months);
        };
        openAddCalendarEventModal('room', currentRoom.id, reloadFn);
    }
});

document.getElementById('roomCalendarRangeSelect').addEventListener('change', function() {
    if (currentRoom && typeof loadEventsForTarget === 'function') {
        var months = parseInt(this.value, 10) || 3;
        loadEventsForTarget('room', currentRoom.id,
            'roomCalendarEventsContainer', 'roomCalendarEventsEmptyState', months);
    }
});

// ============================================================
// BREAKER PANEL LIST  (Phase H12 — shown on House home page)
// ============================================================

/**
 * Load and render the breaker panels list for the House home page.
 * Runs independently from the floors query — different DOM container.
 */
function loadPanelList() {
    var container  = document.getElementById('panelListContainer');
    var emptyState = document.getElementById('panelEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';

    db.collection('breakerPanels').get()
        .then(function(snap) {
            emptyState.textContent = '';

            if (snap.empty) {
                emptyState.textContent = 'No breaker panels yet.';
                return;
            }

            // Sort client-side by createdAt ascending
            var docs = [];
            snap.forEach(function(doc) { docs.push(doc); });
            docs.sort(function(a, b) {
                var ta = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
                var tb = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
                return ta - tb;
            });

            docs.forEach(function(doc) {
                container.appendChild(buildPanelCard(doc.id, doc.data()));
            });
        })
        .catch(function(err) {
            console.error('loadPanelList error:', err);
            emptyState.textContent = 'Error loading panels.';
        });
}

/**
 * Build a clickable card for a breaker panel.
 * @param {string} id    - Firestore document ID
 * @param {object} data  - Panel document data
 */
function buildPanelCard(id, data) {
    var card = document.createElement('div');
    card.className = 'card card--clickable';

    var label      = escapeHtml(data.name || 'Unnamed Panel');
    var locMeta    = data.location
        ? '<span class="house-floor-meta">' + escapeHtml(data.location) + '</span>'
        : '';
    var assigned   = (data.breakers || []).length;
    var total      = data.totalSlots || 0;
    var slotsMeta  = '<span class="house-floor-meta">' + assigned + ' of ' + total + ' slots assigned</span>';

    card.innerHTML =
        '<div class="card-main">' +
            '<span class="card-title">' + label + '</span>' +
            locMeta + slotsMeta +
        '</div>' +
        '<span class="card-arrow">›</span>';

    card.addEventListener('click', function() {
        window.location.hash = '#panel/' + id;
    });

    return card;
}

// ============================================================
// PANEL DETAIL PAGE  (#panel/{panelId})
// ============================================================

/**
 * Load the Breaker Panel detail page.
 * Called by app.js when the route is #panel/{id}.
 * @param {string} panelId
 */
function loadPanelDetail(panelId) {
    db.collection('breakerPanels').doc(panelId).get()
        .then(function(doc) {
            if (!doc.exists) {
                window.location.hash = '#house';
                return;
            }
            currentPanel = Object.assign({ id: doc.id }, doc.data());
            renderPanelDetail(currentPanel);
        })
        .catch(function(err) { console.error('loadPanelDetail error:', err); });
}

/**
 * Render the panel header, breadcrumb, grid, and all feature sections.
 * @param {object} panel  - Panel doc data merged with { id }
 */
function renderPanelDetail(panel) {
    document.getElementById('panelTitle').textContent = panel.name || 'Breaker Panel';

    var locEl = document.getElementById('panelLocation');
    locEl.textContent   = panel.location || '';
    locEl.style.display = panel.location ? '' : 'none';

    var notesEl = document.getElementById('panelNotes');
    notesEl.textContent   = panel.notes || '';
    notesEl.style.display = panel.notes ? '' : 'none';

    buildHouseBreadcrumb([
        { label: 'House',                  hash: '#house' },
        { label: panel.name || 'Panel',    hash: null }
    ]);

    // Render the 2-column breaker grid
    renderPanelGrid(panel);

    // Standard cross-entity sections
    loadProblems(  'panel', panel.id, 'panelProblemsContainer', 'panelProblemsEmptyState');
    loadFacts(     'panel', panel.id, 'panelFactsContainer',    'panelFactsEmptyState');
    loadActivities('panel', panel.id, 'panelActivityContainer', 'panelActivityEmptyState');
    loadPhotos(    'panel', panel.id, 'panelPhotoContainer',    'panelPhotoEmptyState');
}

// ============================================================
// PANEL GRID RENDERER
// ============================================================

/**
 * Render the 2-column breaker grid.
 * Slots are paired left/right: (1,2), (3,4), (5,6)…
 * Empty slots show a dashed placeholder that can still be clicked to assign.
 * @param {object} panel
 */
function renderPanelGrid(panel) {
    var container  = document.getElementById('panelGridContainer');
    var emptyState = document.getElementById('panelGridEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = '';

    var total = panel.totalSlots || 0;
    if (total === 0) {
        emptyState.textContent = 'No slots configured. Edit the panel to set the number of slots.';
        return;
    }

    // Build a lookup map: slot number → breaker data
    var breakerMap = {};
    (panel.breakers || []).forEach(function(b) {
        breakerMap[b.slot] = b;
    });

    // Render pairs of slots as rows
    for (var i = 1; i <= total; i += 2) {
        var row = document.createElement('div');
        row.className = 'breaker-row';

        row.appendChild(buildBreakerSlotEl(i,     breakerMap[i]     || null));
        // Right column: only render if within total slots
        if (i + 1 <= total) {
            row.appendChild(buildBreakerSlotEl(i + 1, breakerMap[i + 1] || null));
        } else {
            // Spacer to keep grid symmetrical on odd totals
            var spacer = document.createElement('div');
            row.appendChild(spacer);
        }

        container.appendChild(row);
    }
}

/**
 * Build one breaker slot cell element.
 * @param {number}      slotNum  - 1-based slot position
 * @param {object|null} breaker  - Breaker data object or null if empty
 * @returns {HTMLElement}
 */
function buildBreakerSlotEl(slotNum, breaker) {
    var cell = document.createElement('div');

    if (!breaker) {
        cell.className = 'breaker-slot breaker-slot--empty';
        cell.innerHTML =
            '<span class="breaker-slot-num">' + slotNum + '</span>' +
            '<span class="breaker-slot-label">(empty)</span>';
    } else {
        var status = breaker.status || 'on';
        cell.className = 'breaker-slot breaker-slot--' + escapeHtml(status);

        var ampsHtml   = breaker.amps
            ? '<span class="breaker-amps">' + breaker.amps + 'A</span>'
            : '';
        var statusText = status.charAt(0).toUpperCase() + status.slice(1);

        cell.innerHTML =
            '<span class="breaker-slot-num">' + slotNum + '</span>' +
            '<span class="breaker-slot-label">' + escapeHtml(breaker.label || '(unlabeled)') + '</span>' +
            '<div class="breaker-slot-meta">' +
                ampsHtml +
                '<span class="breaker-status breaker-status--' + escapeHtml(status) + '">' +
                    statusText +
                '</span>' +
            '</div>';
    }

    cell.addEventListener('click', function() {
        openBreakerModal(slotNum, breaker);
    });

    return cell;
}

// ============================================================
// PANEL MODAL  (Add / Edit)
// ============================================================

/**
 * Open the add/edit modal for a breaker panel.
 * @param {string|null} editId  - Firestore document ID when editing; null for add
 * @param {object|null} data    - Existing panel data when editing
 */
function openPanelModal(editId, data) {
    var modal     = document.getElementById('panelModal');
    var deleteBtn = document.getElementById('panelModalDeleteBtn');

    document.getElementById('panelNameInput').value       = (editId && data) ? (data.name      || '') : '';
    document.getElementById('panelLocationInput').value   = (editId && data) ? (data.location  || '') : '';
    document.getElementById('panelNotesInput').value      = (editId && data) ? (data.notes     || '') : '';
    document.getElementById('panelTotalSlotsInput').value = (editId && data) ? (data.totalSlots || 20) : 20;

    if (editId) {
        document.getElementById('panelModalTitle').textContent = 'Edit Panel';
        deleteBtn.style.display = '';
        modal.dataset.mode   = 'edit';
        modal.dataset.editId = editId;
    } else {
        document.getElementById('panelModalTitle').textContent = 'Add Breaker Panel';
        deleteBtn.style.display = 'none';
        modal.dataset.mode   = 'add';
        modal.dataset.editId = '';
    }

    openModal('panelModal');
    document.getElementById('panelNameInput').focus();
}

document.getElementById('panelModalSaveBtn').addEventListener('click', function() {
    var modal    = document.getElementById('panelModal');
    var nameVal  = document.getElementById('panelNameInput').value.trim();
    var locVal   = document.getElementById('panelLocationInput').value.trim();
    var notesVal = document.getElementById('panelNotesInput').value.trim();
    var slotsVal = parseInt(document.getElementById('panelTotalSlotsInput').value, 10);

    if (!nameVal)                          { alert('Please enter a panel name.'); return; }
    if (isNaN(slotsVal) || slotsVal < 2)  { alert('Total slots must be at least 2.'); return; }

    // Round up to nearest even number (breaker panels always have pairs)
    if (slotsVal % 2 !== 0) slotsVal += 1;

    var panelData = { name: nameVal, location: locVal, notes: notesVal, totalSlots: slotsVal };

    var mode   = modal.dataset.mode;
    var editId = modal.dataset.editId;

    if (mode === 'edit' && editId) {
        db.collection('breakerPanels').doc(editId).update(panelData)
            .then(function() {
                closeModal('panelModal');
                loadPanelDetail(editId);
            })
            .catch(function(err) { console.error('Update panel error:', err); });
    } else {
        panelData.breakers  = [];
        panelData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('breakerPanels').add(panelData)
            .then(function(ref) {
                closeModal('panelModal');
                window.location.hash = '#panel/' + ref.id;
            })
            .catch(function(err) { console.error('Add panel error:', err); });
    }
});

document.getElementById('panelModalCancelBtn').addEventListener('click', function() {
    closeModal('panelModal');
});

document.getElementById('panelModalDeleteBtn').addEventListener('click', function() {
    var editId = document.getElementById('panelModal').dataset.editId;
    if (!editId) return;
    if (!confirm('Delete this panel and all its breaker data? This cannot be undone.')) return;
    db.collection('breakerPanels').doc(editId).delete()
        .then(function() {
            closeModal('panelModal');
            window.location.hash = '#house';
        })
        .catch(function(err) { console.error('Delete panel error:', err); });
});

// ============================================================
// BREAKER MODAL  (Edit a single slot)
// ============================================================

/**
 * Open the edit modal for one breaker slot.
 * @param {number}      slotNum  - Slot position (1-based)
 * @param {object|null} breaker  - Existing breaker data, or null if the slot is empty
 */
function openBreakerModal(slotNum, breaker) {
    bpEditSlot = slotNum;
    bpEditId   = breaker ? (breaker.id || null) : null;

    document.getElementById('breakerModalTitle').textContent = 'Breaker — Slot ' + slotNum;
    document.getElementById('breakerLabelInput').value   = breaker ? (breaker.label  || '') : '';
    document.getElementById('breakerAmpsSelect').value   = breaker ? (breaker.amps   || '') : '';
    document.getElementById('breakerStatusSelect').value = breaker ? (breaker.status || 'on') : 'on';
    document.getElementById('breakerNotesInput').value   = breaker ? (breaker.notes  || '') : '';

    // Connected devices section — only visible when editing an assigned slot (Phase H13)
    var devSection = document.getElementById('breakerDevicesSection');
    if (breaker && breaker.id) {
        devSection.style.display = '';
        loadBreakerDevices(breaker.id, 'breakerDevicesContainer', 'breakerDevicesEmptyState');
    } else {
        devSection.style.display = 'none';
        document.getElementById('breakerDevicesContainer').innerHTML = '';
    }

    // Problems section — only visible when editing an already-assigned slot
    var probSection = document.getElementById('breakerProblemsSection');
    if (breaker && breaker.id) {
        probSection.style.display = '';
        loadProblems('breaker', breaker.id,
            'breakerProblemsContainer', 'breakerProblemsEmptyState');
    } else {
        probSection.style.display = 'none';
        document.getElementById('breakerProblemsContainer').innerHTML = '';
    }

    // "Clear Slot" button only appears when editing an assigned slot
    document.getElementById('breakerClearBtn').style.display = (breaker && breaker.id) ? '' : 'none';

    openModal('breakerModal');
    document.getElementById('breakerLabelInput').focus();
}

document.getElementById('breakerModalSaveBtn').addEventListener('click', function() {
    if (!currentPanel || bpEditSlot === null) return;

    var labelVal  = document.getElementById('breakerLabelInput').value.trim();
    var ampsRaw   = document.getElementById('breakerAmpsSelect').value;
    var statusVal = document.getElementById('breakerStatusSelect').value;
    var notesVal  = document.getElementById('breakerNotesInput').value.trim();

    // Build the updated breakers array (copy so we don't mutate state before save)
    var breakers = (currentPanel.breakers || []).slice();

    // Find if an entry already exists for this slot
    var existingIdx = -1;
    for (var i = 0; i < breakers.length; i++) {
        if (breakers[i].slot === bpEditSlot) { existingIdx = i; break; }
    }

    var breakerEntry = {
        id:     bpEditId || bpUUID(),
        slot:   bpEditSlot,
        label:  labelVal,
        amps:   ampsRaw ? parseInt(ampsRaw, 10) : null,
        status: statusVal,
        notes:  notesVal
    };

    if (existingIdx >= 0) {
        // Preserve the original id so existing problem links stay intact
        breakerEntry.id = breakers[existingIdx].id;
        breakers[existingIdx] = breakerEntry;
    } else {
        breakers.push(breakerEntry);
    }

    // Keep array sorted by slot for readability in Firestore
    breakers.sort(function(a, b) { return a.slot - b.slot; });

    db.collection('breakerPanels').doc(currentPanel.id).update({ breakers: breakers })
        .then(function() {
            currentPanel.breakers = breakers;
            closeModal('breakerModal');
            renderPanelGrid(currentPanel);
        })
        .catch(function(err) { console.error('Save breaker error:', err); });
});

document.getElementById('breakerModalCancelBtn').addEventListener('click', function() {
    closeModal('breakerModal');
});

// "Clear Slot" — removes the breaker assignment, leaving the slot empty
document.getElementById('breakerClearBtn').addEventListener('click', function() {
    if (!currentPanel || bpEditSlot === null) return;
    if (!confirm('Clear slot ' + bpEditSlot + '? The label and settings will be removed.')) return;

    var breakers = (currentPanel.breakers || []).filter(function(b) {
        return b.slot !== bpEditSlot;
    });

    db.collection('breakerPanels').doc(currentPanel.id).update({ breakers: breakers })
        .then(function() {
            currentPanel.breakers = breakers;
            closeModal('breakerModal');
            renderPanelGrid(currentPanel);
        })
        .catch(function(err) { console.error('Clear breaker error:', err); });
});

// "+ Add Problem" button inside the breaker modal
document.getElementById('breakerAddProblemBtn').addEventListener('click', function() {
    if (!bpEditId) return;
    openAddProblemModal('breaker', bpEditId);
});

// ============================================================
// PANEL PAGE BUTTON WIRING
// ============================================================

// House home — Add Panel
document.getElementById('addPanelBtn').addEventListener('click', function() {
    openPanelModal(null, null);
});

// Panel detail — Edit Panel
document.getElementById('editPanelBtn').addEventListener('click', function() {
    if (!currentPanel) return;
    openPanelModal(currentPanel.id, currentPanel);
});

// Panel detail — Delete Panel
document.getElementById('deletePanelBtn').addEventListener('click', function() {
    if (!currentPanel) return;
    if (!confirm('Delete "' + (currentPanel.name || 'this panel') + '"? This cannot be undone.')) return;
    db.collection('breakerPanels').doc(currentPanel.id).delete()
        .then(function() { window.location.hash = '#house'; })
        .catch(function(err) { console.error('Delete panel error:', err); });
});

// Panel detail — "+ 2 Slots" button expands the grid by two positions
document.getElementById('addBreakerSlotBtn').addEventListener('click', function() {
    if (!currentPanel) return;
    var newTotal = (currentPanel.totalSlots || 0) + 2;
    db.collection('breakerPanels').doc(currentPanel.id).update({ totalSlots: newTotal })
        .then(function() {
            currentPanel.totalSlots = newTotal;
            renderPanelGrid(currentPanel);
        })
        .catch(function(err) { console.error('Add slot error:', err); });
});

// Panel detail — Problems / Facts / Activities / Photos
document.getElementById('addPanelProblemBtn').addEventListener('click', function() {
    if (currentPanel) openAddProblemModal('panel', currentPanel.id);
});

document.getElementById('addPanelFactBtn').addEventListener('click', function() {
    if (currentPanel) openAddFactModal('panel', currentPanel.id);
});

document.getElementById('logPanelActivityBtn').addEventListener('click', function() {
    if (currentPanel) openLogActivityModal('panel', currentPanel.id);
});

document.getElementById('addPanelPhotoBtn').addEventListener('click', function() {
    if (currentPanel) triggerPhotoUpload('panel', currentPanel.id);
});

// ============================================================
// ROOMS PAGE  (#rooms)
// Displays a navigable tree of all floors and their rooms.
// ============================================================

/**
 * Load and render the Rooms tree page.
 * Shows all floors (sorted by floorNumber) with their rooms listed
 * beneath each floor. Both floor and room rows are clickable links.
 */
function loadRoomsPage() {
    var container  = document.getElementById('roomsTreeContainer');
    var emptyState = document.getElementById('roomsTreeEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';

    buildHouseBreadcrumb([
        { label: 'House', hash: '#house' },
        { label: 'Rooms', hash: null }
    ]);

    var floorsQ = db.collection('floors').orderBy('floorNumber', 'asc').get();
    var roomsQ  = db.collection('rooms').get();

    Promise.all([floorsQ, roomsQ])
        .then(function(results) {
            var floorSnap = results[0];
            var roomSnap  = results[1];

            emptyState.textContent = '';

            if (floorSnap.empty) {
                emptyState.textContent = 'No floors yet. Add a floor from the House page.';
                return;
            }

            // Group rooms by floorId, sorted by createdAt
            var roomsByFloor = {};
            roomSnap.forEach(function(doc) {
                var fId = doc.data().floorId;
                if (!roomsByFloor[fId]) roomsByFloor[fId] = [];
                roomsByFloor[fId].push({ id: doc.id, data: doc.data() });
            });
            Object.keys(roomsByFloor).forEach(function(fId) {
                roomsByFloor[fId].sort(function(a, b) {
                    var ta = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
                    var tb = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
                    return ta - tb;
                });
            });

            // Render floor rows + indented room rows
            floorSnap.forEach(function(floorDoc) {
                var floor = floorDoc.data();
                var rooms = roomsByFloor[floorDoc.id] || [];

                // Floor link row
                var floorRow = document.createElement('a');
                floorRow.href      = '#floor/' + floorDoc.id;
                floorRow.className = 'rooms-tree-floor';
                floorRow.textContent = floor.name || 'Floor';
                if (floor.floorNumber !== null && floor.floorNumber !== undefined) {
                    var numSpan = document.createElement('span');
                    numSpan.className   = 'rooms-tree-floor-num';
                    numSpan.textContent = '  (Floor ' + floor.floorNumber + ')';
                    floorRow.appendChild(numSpan);
                }
                container.appendChild(floorRow);

                if (!rooms.length) {
                    var noRooms = document.createElement('div');
                    noRooms.className   = 'rooms-tree-empty';
                    noRooms.textContent = 'No rooms on this floor';
                    container.appendChild(noRooms);
                } else {
                    rooms.forEach(function(r) {
                        var roomRow = document.createElement('a');
                        roomRow.href      = '#room/' + r.id;
                        roomRow.className = 'rooms-tree-room';
                        roomRow.textContent = r.data.name || 'Room';
                        container.appendChild(roomRow);
                    });
                }
            });
        })
        .catch(function(err) {
            console.error('loadRoomsPage error:', err);
            emptyState.textContent = 'Error loading rooms.';
        });
}

// ============================================================
// CIRCUIT LINKAGE  (Phase H13)
// Scan all floor plan documents to find markers linked to a breaker.
// ============================================================

/**
 * Load and render all floor plan markers (outlets, switches, ceiling fixtures)
 * that have a matching breakerId.  Renders a compact list inside the breakerModal.
 *
 * @param {string} breakerId   - The breaker's stable UUID to search for
 * @param {string} containerId - id of the <div> to render into
 * @param {string} emptyId     - id of the <p class="empty-state"> element
 */
function loadBreakerDevices(breakerId, containerId, emptyId) {
    var container = document.getElementById(containerId);
    var emptyEl   = document.getElementById(emptyId);

    container.innerHTML    = '';
    emptyEl.textContent    = 'Loading…';

    // Scan all floorPlans documents for markers with this breakerId
    db.collection('floorPlans').get()
        .then(function(snap) {
            var devices = [];

            snap.forEach(function(planDoc) {
                var plan    = planDoc.data();
                var floorId = planDoc.id;

                // Check outlets, switches, and ceiling fixtures
                var markerArrays = {
                    outlets:         '⚡ Outlet',
                    switches:        '💡 Switch',
                    ceilingFixtures: '🔆 Ceiling Fixture'
                };

                Object.keys(markerArrays).forEach(function(key) {
                    (plan[key] || []).forEach(function(marker) {
                        if (marker.breakerId === breakerId) {
                            devices.push({
                                floorId:   floorId,
                                typeLabel: markerArrays[key],
                                marker:    marker
                            });
                        }
                    });
                });
            });

            emptyEl.textContent = '';

            if (!devices.length) {
                emptyEl.textContent =
                    'No devices linked yet. Edit outlets, switches, or ceiling fixtures ' +
                    'on a floor plan to link them to this circuit.';
                return;
            }

            // Collect unique floorIds so we can look up names
            var uniqueFloorIds = [];
            devices.forEach(function(d) {
                if (uniqueFloorIds.indexOf(d.floorId) === -1) {
                    uniqueFloorIds.push(d.floorId);
                }
            });

            // Fetch floor names, then render
            return Promise.all(uniqueFloorIds.map(function(fid) {
                return db.collection('floors').doc(fid).get();
            })).then(function(floorDocs) {
                var floorNames = {};
                floorDocs.forEach(function(d) {
                    floorNames[d.id] = d.exists ? (d.data().name || 'Floor') : 'Floor';
                });

                devices.forEach(function(d) {
                    var floorName = floorNames[d.floorId] || 'Floor';
                    var label     = d.marker.label || d.marker.type || '(unlabeled)';

                    var item = document.createElement('div');
                    item.className = 'breaker-device-item';
                    item.title     = 'Go to floor plan';
                    item.innerHTML =
                        '<span class="breaker-device-type">' + d.typeLabel + '</span>' +
                        '<span class="breaker-device-label">' + escapeHtml(label) + '</span>' +
                        '<span class="breaker-device-floor">' + escapeHtml(floorName) + '</span>';

                    // Clicking navigates to the floor plan for that floor
                    item.addEventListener('click', function() {
                        closeModal('breakerModal');
                        window.location.hash = '#floorplan/' + d.floorId;
                    });

                    container.appendChild(item);
                });
            });
        })
        .catch(function(err) {
            console.error('loadBreakerDevices error:', err);
            emptyEl.textContent = 'Error loading devices.';
        });
}

// ============================================================
// UUID HELPER  (generates stable IDs for individual breakers)
// ============================================================
// SHARED INVENTORY DETAIL RENDERER
// Renders price/worth/year/description/comment as a card.
// Used by both thing detail and sub-thing detail pages.
// ============================================================

function renderInventoryDetails(data, sectionId) {
    var section = document.getElementById(sectionId);
    if (!section) return;

    var rows = [];
    if (data.pricePaid  !== null && data.pricePaid  !== undefined && data.pricePaid  !== '')
        rows.push(['Price Paid',  '$' + data.pricePaid]);
    if (data.worth      !== null && data.worth      !== undefined && data.worth      !== '')
        rows.push(['Worth',       '$' + data.worth]);
    if (data.yearBought !== null && data.yearBought !== undefined && data.yearBought !== '')
        rows.push(['Year Bought', data.yearBought]);
    if (data.description)
        rows.push(['Description', data.description]);
    if (data.comment)
        rows.push(['Comment',     data.comment]);

    if (!rows.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    section.innerHTML = rows.map(function(r) {
        return '<div class="thing-detail-row">' +
               '<span class="thing-detail-label">' + escapeHtml(r[0]) + '</span>' +
               '<span class="thing-detail-value">'  + escapeHtml(String(r[1])) + '</span>' +
               '</div>';
    }).join('');
}

// ============================================================
// SUB-THINGS LIST  (shown on Thing detail page)
// ============================================================

function loadSubThingsList(thingId) {
    var container  = document.getElementById('subThingListContainer');
    var emptyState = document.getElementById('subThingListEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';

    db.collection('subThings').where('thingId', '==', thingId).get()
        .then(function(snapshot) {
            emptyState.textContent = '';
            if (snapshot.empty) {
                emptyState.textContent = 'No items yet. Add an item to start tracking inventory.';
                return;
            }

            var docs = [];
            snapshot.forEach(function(doc) { docs.push(doc); });
            docs.sort(function(a, b) {
                var ta = a.data().createdAt ? a.data().createdAt.toMillis() : 0;
                var tb = b.data().createdAt ? b.data().createdAt.toMillis() : 0;
                return ta - tb;
            });
            docs.forEach(function(doc) {
                container.appendChild(buildSubThingCard(doc.id, doc.data()));
            });
        })
        .catch(function(err) {
            console.error('loadSubThingsList error:', err);
            emptyState.textContent = 'Error loading items.';
        });
}

function buildSubThingCard(id, data) {
    var card = document.createElement('div');
    card.className = 'card card--clickable';

    var label = escapeHtml(data.name || 'Unnamed Item');
    var tags  = (data.tags || []).map(function(t) {
        return '<span class="thing-tag-badge">' + escapeHtml(t) + '</span>';
    }).join('');
    var meta  = tags
        ? '<div class="house-floor-meta" style="margin-top:3px">' + tags + '</div>'
        : '';

    card.innerHTML =
        '<div class="card-main">' +
            '<span class="card-title">' + label + '</span>' +
            meta +
        '</div>' +
        '<span class="card-arrow">\u203a</span>';

    card.addEventListener('click', function() {
        window.location.hash = '#subthing/' + id;
    });
    return card;
}

// ============================================================
// SUB-THING DETAIL PAGE  (#subthing/{id})
// ============================================================

function loadSubThingDetail(subThingId) {
    db.collection('subThings').doc(subThingId).get()
        .then(function(doc) {
            if (!doc.exists) { window.location.hash = '#house'; return; }
            currentSubThing = Object.assign({ id: doc.id }, doc.data());

            // Load parent chain: thing → room → floor
            return db.collection('things').doc(currentSubThing.thingId).get()
                .then(function(thingDoc) {
                    currentThing = thingDoc.exists
                        ? Object.assign({ id: thingDoc.id }, thingDoc.data())
                        : { id: currentSubThing.thingId, name: 'Thing', roomId: null };

                    var roomId = currentThing.roomId;
                    if (!roomId) {
                        currentRoom  = { id: '', name: 'Room',  floorId: null };
                        currentFloor = { id: '', name: 'Floor' };
                        renderSubThingDetail(currentSubThing, currentThing, currentRoom, currentFloor);
                        return;
                    }

                    return db.collection('rooms').doc(roomId).get()
                        .then(function(roomDoc) {
                            currentRoom = roomDoc.exists
                                ? Object.assign({ id: roomDoc.id }, roomDoc.data())
                                : { id: roomId, name: 'Room', floorId: null };

                            var floorId = currentRoom.floorId;
                            if (!floorId) {
                                currentFloor = { id: '', name: 'Floor' };
                                renderSubThingDetail(currentSubThing, currentThing, currentRoom, currentFloor);
                                return;
                            }

                            return db.collection('floors').doc(floorId).get()
                                .then(function(floorDoc) {
                                    currentFloor = floorDoc.exists
                                        ? Object.assign({ id: floorDoc.id }, floorDoc.data())
                                        : { id: floorId, name: 'Floor' };
                                    renderSubThingDetail(currentSubThing, currentThing, currentRoom, currentFloor);
                                });
                        });
                });
        })
        .catch(function(err) { console.error('loadSubThingDetail error:', err); });
}

function renderSubThingDetail(subThing, thing, room, floor) {
    document.getElementById('stTitle').textContent = subThing.name || 'Item';

    // Meta line: Floor › Room › Thing · #tag1 #tag2
    var meta     = document.getElementById('stMeta');
    var tagsText = (subThing.tags || []).map(function(t) { return '#' + t; }).join(' ');
    meta.textContent =
        (floor.name || '') + ' \u203a ' +
        (room.name  || '') + ' \u203a ' +
        (thing.name || '') +
        (tagsText ? ' \u00b7 ' + tagsText : '');

    // Breadcrumb: House › Floor › Room › Thing › Item
    buildHouseBreadcrumb([
        { label: 'House',                  hash: '#house' },
        { label: floor.name || 'Floor',    hash: floor.id  ? '#floor/' + floor.id  : null },
        { label: room.name  || 'Room',     hash: room.id   ? '#room/'  + room.id   : null },
        { label: thing.name || 'Thing',    hash: thing.id  ? '#thing/' + thing.id  : null },
        { label: subThing.name || 'Item',  hash: null }
    ]);

    // Details card
    renderInventoryDetails(subThing, 'stDetailsSection');

    // All cross-entity feature sections
    loadProblems(  'subthing', subThing.id, 'stProblemsContainer', 'stProblemsEmptyState');
    loadFacts(     'subthing', subThing.id, 'stFactsContainer',    'stFactsEmptyState');
    loadProjects(  'subthing', subThing.id, 'stProjectsContainer', 'stProjectsEmptyState');
    loadActivities('subthing', subThing.id, 'stActivityContainer', 'stActivityEmptyState');
    loadPhotos(    'subthing', subThing.id, 'stPhotoContainer',    'stPhotoEmptyState');

    if (typeof loadEventsForTarget === 'function') {
        var months = parseInt(document.getElementById('stCalendarRangeSelect').value, 10) || 3;
        loadEventsForTarget('subthing', subThing.id,
            'stCalendarEventsContainer', 'stCalendarEventsEmptyState', months);
    }
}

// ============================================================
// SUB-THING MODAL  (Add / Edit)
// ============================================================

function openSubThingModal(editId, data) {
    var modal     = document.getElementById('subThingModal');
    var nameInput = document.getElementById('stNameInput');
    var deleteBtn = document.getElementById('stModalDeleteBtn');

    if (editId) {
        document.getElementById('stModalTitle').textContent = 'Edit Item';
        nameInput.value                                      = data.name        || '';
        document.getElementById('stPricePaidInput').value   = data.pricePaid   || '';
        document.getElementById('stWorthInput').value       = data.worth       || '';
        document.getElementById('stYearBoughtInput').value  = data.yearBought  || '';
        document.getElementById('stDescriptionInput').value = data.description || '';
        document.getElementById('stCommentInput').value     = data.comment     || '';
        deleteBtn.style.display = '';
        modal.dataset.mode      = 'edit';
        modal.dataset.editId    = editId;
    } else {
        document.getElementById('stModalTitle').textContent = 'Add Item';
        nameInput.value                                      = '';
        document.getElementById('stPricePaidInput').value   = '';
        document.getElementById('stWorthInput').value       = '';
        document.getElementById('stYearBoughtInput').value  = '';
        document.getElementById('stDescriptionInput').value = '';
        document.getElementById('stCommentInput').value     = '';
        deleteBtn.style.display = 'none';
        modal.dataset.mode      = 'add';
        modal.dataset.editId    = '';
    }

    // Initialize tag state
    stSelectedTags = editId ? (data.tags || []).slice() : [];
    stRenderChips();
    document.getElementById('stTagInput').value = '';
    document.getElementById('stTagSuggestions').classList.add('hidden');

    // Load known tags from Firestore for autocomplete
    stLoadTags();

    openModal('subThingModal');
    nameInput.focus();
}

document.getElementById('stModalSaveBtn').addEventListener('click', function() {
    var modal   = document.getElementById('subThingModal');
    var nameVal = document.getElementById('stNameInput').value.trim();

    if (!nameVal) { alert('Please enter a name.'); return; }

    var itemData = {
        name:        nameVal,
        pricePaid:   document.getElementById('stPricePaidInput').value.trim()   || null,
        worth:       document.getElementById('stWorthInput').value.trim()       || null,
        yearBought:  document.getElementById('stYearBoughtInput').value.trim()  || null,
        description: document.getElementById('stDescriptionInput').value.trim(),
        comment:     document.getElementById('stCommentInput').value.trim(),
        tags:        stSelectedTags.slice()
    };

    var mode   = modal.dataset.mode;
    var editId = modal.dataset.editId;

    if (mode === 'edit' && editId) {
        db.collection('subThings').doc(editId).update(itemData)
            .then(function() {
                closeModal('subThingModal');
                loadSubThingDetail(editId);
            })
            .catch(function(err) { console.error('Update subThing error:', err); });
    } else {
        if (!currentThing) { alert('No parent item selected.'); return; }
        itemData.thingId   = currentThing.id;
        itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('subThings').add(itemData)
            .then(function() {
                closeModal('subThingModal');
                loadSubThingsList(currentThing.id);
            })
            .catch(function(err) { console.error('Add subThing error:', err); });
    }
});

document.getElementById('stModalCancelBtn').addEventListener('click', function() {
    closeModal('subThingModal');
});

document.getElementById('stModalDeleteBtn').addEventListener('click', function() {
    var editId = document.getElementById('subThingModal').dataset.editId;
    if (!editId) return;
    if (!confirm('Delete this item? This cannot be undone.')) return;
    db.collection('subThings').doc(editId).delete()
        .then(function() {
            closeModal('subThingModal');
            if (currentThing) {
                window.location.hash = '#thing/' + currentThing.id;
            } else {
                window.location.hash = '#house';
            }
        })
        .catch(function(err) { console.error('Delete subThing error:', err); });
});

// ============================================================
// TAG INPUT LOGIC
// ============================================================

function stLoadTags() {
    db.collection('tags').get()
        .then(function(snap) {
            stAllTags = [];
            snap.forEach(function(d) {
                var n = d.data().name;
                if (n) stAllTags.push(n);
            });
            stAllTags.sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
        })
        .catch(function(err) { console.error('stLoadTags error:', err); });
}

function stRenderChips() {
    var chipsEl = document.getElementById('stTagChips');
    chipsEl.innerHTML = '';
    stSelectedTags.forEach(function(tag) {
        var chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML =
            escapeHtml(tag) +
            '<button class="tag-chip-remove" data-tag="' + escapeHtml(tag) + '" title="Remove">\u00d7</button>';
        chip.querySelector('.tag-chip-remove').addEventListener('click', function(e) {
            e.stopPropagation();
            stRemoveTag(this.dataset.tag);
        });
        chipsEl.appendChild(chip);
    });
}

function stRemoveTag(name) {
    stSelectedTags = stSelectedTags.filter(function(t) { return t !== name; });
    stRenderChips();
}

function stAddTag(name) {
    name = name.trim();
    if (!name) return;
    // Avoid duplicates (case-insensitive check)
    var lower = name.toLowerCase();
    if (stSelectedTags.some(function(t) { return t.toLowerCase() === lower; })) return;
    stSelectedTags.push(name);
    stRenderChips();
    // Persist new tag to Firestore if it doesn't exist yet
    var existsInAll = stAllTags.some(function(t) { return t.toLowerCase() === lower; });
    if (!existsInAll) {
        stAllTags.push(name);
        stAllTags.sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
        db.collection('tags').add({
            name:      name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function(err) { console.error('stAddTag: error saving tag:', err); });
    }
}

function stUpdateSuggestions(query) {
    var sugEl = document.getElementById('stTagSuggestions');
    sugEl.innerHTML = '';

    var q = query.trim();
    if (!q) { sugEl.classList.add('hidden'); return; }

    var qLower   = q.toLowerCase();
    var selected = stSelectedTags.map(function(t) { return t.toLowerCase(); });

    // Filter existing tags matching the query that are not already selected
    var matches = stAllTags.filter(function(t) {
        return t.toLowerCase().indexOf(qLower) !== -1 &&
               selected.indexOf(t.toLowerCase()) === -1;
    });

    // Check if the exact query already exists as a tag
    var exactMatch = stAllTags.some(function(t) { return t.toLowerCase() === qLower; });

    var items = matches.map(function(t) { return { label: t, isNew: false }; });
    if (!exactMatch && selected.indexOf(qLower) === -1) {
        items.push({ label: q, isNew: true });
    }

    if (!items.length) { sugEl.classList.add('hidden'); return; }

    items.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'tag-suggestion-item' + (item.isNew ? ' tag-suggestion-new' : '');
        div.textContent = item.isNew ? '+ Add "' + item.label + '"' : item.label;
        div.addEventListener('mousedown', function(e) {
            e.preventDefault();  // Prevent input blur
            stAddTag(item.label);
            document.getElementById('stTagInput').value = '';
            stUpdateSuggestions('');
        });
        sugEl.appendChild(div);
    });

    sugEl.classList.remove('hidden');
}

// Wire up the tag text input events
document.getElementById('stTagInput').addEventListener('input', function() {
    stUpdateSuggestions(this.value);
});

document.getElementById('stTagInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        var val = this.value.trim().replace(/,$/, '');
        if (val) { stAddTag(val); this.value = ''; stUpdateSuggestions(''); }
    } else if (e.key === 'Backspace' && !this.value && stSelectedTags.length) {
        stRemoveTag(stSelectedTags[stSelectedTags.length - 1]);
    }
});

document.getElementById('stTagInput').addEventListener('blur', function() {
    setTimeout(function() {
        var sugEl = document.getElementById('stTagSuggestions');
        if (sugEl) sugEl.classList.add('hidden');
    }, 150);
});

// Focus the wrapper clicks into the input
document.getElementById('stTagWrapper').addEventListener('click', function() {
    document.getElementById('stTagInput').focus();
});

// ============================================================
// SUB-THING PAGE BUTTON WIRING
// ============================================================

// Thing detail — Add Sub-thing
document.getElementById('addSubThingBtn').addEventListener('click', function() {
    if (!currentThing) return;
    openSubThingModal(null, null);
});

// Sub-thing detail — Edit
document.getElementById('editStBtn').addEventListener('click', function() {
    if (!currentSubThing) return;
    openSubThingModal(currentSubThing.id, currentSubThing);
});

// Sub-thing detail — Delete
document.getElementById('deleteStBtn').addEventListener('click', function() {
    if (!currentSubThing) return;
    if (!confirm('Delete "' + (currentSubThing.name || 'this item') + '"? This cannot be undone.')) return;
    db.collection('subThings').doc(currentSubThing.id).delete()
        .then(function() {
            if (currentThing) {
                window.location.hash = '#thing/' + currentThing.id;
            } else {
                window.location.hash = '#house';
            }
        })
        .catch(function(err) { console.error('Delete subThing error:', err); });
});

// Sub-thing feature section buttons
document.getElementById('addStProblemBtn').addEventListener('click', function() {
    if (currentSubThing) openAddProblemModal('subthing', currentSubThing.id);
});

document.getElementById('addStFactBtn').addEventListener('click', function() {
    if (currentSubThing) openAddFactModal('subthing', currentSubThing.id);
});

document.getElementById('addStProjectBtn').addEventListener('click', function() {
    if (currentSubThing) openAddProjectModal('subthing', currentSubThing.id);
});

document.getElementById('logStActivityBtn').addEventListener('click', function() {
    if (currentSubThing) openLogActivityModal('subthing', currentSubThing.id);
});

document.getElementById('addStPhotoBtn').addEventListener('click', function() {
    if (currentSubThing) triggerPhotoUpload('subthing', currentSubThing.id);
});

document.getElementById('addStCalendarEventBtn').addEventListener('click', function() {
    if (currentSubThing && typeof openAddCalendarEventModal === 'function') {
        var reloadFn = function() {
            var months = parseInt(document.getElementById('stCalendarRangeSelect').value, 10) || 3;
            loadEventsForTarget('subthing', currentSubThing.id,
                'stCalendarEventsContainer', 'stCalendarEventsEmptyState', months);
        };
        openAddCalendarEventModal('subthing', currentSubThing.id, reloadFn);
    }
});

document.getElementById('stCalendarRangeSelect').addEventListener('change', function() {
    if (currentSubThing && typeof loadEventsForTarget === 'function') {
        var months = parseInt(this.value, 10) || 3;
        loadEventsForTarget('subthing', currentSubThing.id,
            'stCalendarEventsContainer', 'stCalendarEventsEmptyState', months);
    }
});

// ============================================================

/**
 * Generate a random UUID v4 string.
 * Used to assign a stable, unique id to each breaker entry
 * so that problems.js can link problems to individual breakers.
 * @returns {string}
 */
function bpUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
