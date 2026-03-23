// ============================================================
// house.js — House / Interior Feature
// Handles Floors (Phase H1), Rooms (Phase H2), Things (Phase H3+)
// Uses the same Firestore patterns as zones.js / plants.js
// ============================================================

// ---- State ----
var currentFloor = null;   // Floor document currently being viewed
var currentRoom  = null;   // Room document currently being viewed
var currentThing = null;   // Thing document currently being viewed

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
 * Called by app.js when the route is #house.
 */
function loadHousePage() {
    var container  = document.getElementById('floorListContainer');
    var emptyState = document.getElementById('floorEmptyState');

    container.innerHTML    = '';
    emptyState.textContent = 'Loading…';

    db.collection('floors')
        .orderBy('floorNumber', 'asc')
        .get()
        .then(function(snapshot) {
            emptyState.textContent = '';

            if (snapshot.empty) {
                emptyState.textContent = 'No floors yet. Add a floor to get started.';
                return;
            }

            snapshot.forEach(function(doc) {
                container.appendChild(buildFloorCard(doc.id, doc.data()));
            });
        })
        .catch(function(err) {
            console.error('loadHousePage error:', err);
            emptyState.textContent = 'Error loading floors.';
        });
}

/**
 * Build a clickable card for a floor.
 */
function buildFloorCard(id, data) {
    var card = document.createElement('div');
    card.className = 'card card--clickable';

    var label    = escapeHtml(data.name || 'Unnamed Floor');
    var numLabel = (data.floorNumber !== undefined && data.floorNumber !== null)
        ? ' <span class="house-floor-num">Floor ' + data.floorNumber + '</span>'
        : '';

    card.innerHTML =
        '<div class="card-main">' +
            '<span class="card-title">' + label + numLabel + '</span>' +
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
 * Render floor header / meta / breadcrumb.
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
 * Render room header / meta / breadcrumb.
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

    if (editId) {
        document.getElementById('roomModalTitle').textContent = 'Edit Room';
        nameInput.value          = data.name || '';
        typeSelect.value         = data.type || 'standard';
        deleteBtn.style.display  = '';
        modal.dataset.mode       = 'edit';
        modal.dataset.editId     = editId;
    } else {
        document.getElementById('roomModalTitle').textContent = 'Add Room';
        nameInput.value          = '';
        typeSelect.value         = 'standard';
        deleteBtn.style.display  = 'none';
        modal.dataset.mode       = 'add';
        modal.dataset.editId     = '';
    }

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

    if (mode === 'edit' && editId) {
        db.collection('rooms').doc(editId).update({ name: nameVal, type: typeVal })
            .then(function() {
                closeModal('roomModal');
                loadRoomDetail(editId);
            })
            .catch(function(err) { console.error('Update room error:', err); });
    } else {
        // Add — floorId comes from the currently viewed floor
        if (!currentFloor) { alert('No floor selected.'); return; }
        var roomData = {
            name:      nameVal,
            type:      typeVal,
            floorId:   currentFloor.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
        deleteBtn.style.display = '';
        modal.dataset.mode      = 'edit';
        modal.dataset.editId    = editId;
    } else {
        document.getElementById('thingModalTitle').textContent = 'Add Thing';
        nameInput.value         = '';
        catSelect.value         = 'furniture';
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

    if (mode === 'edit' && editId) {
        db.collection('things').doc(editId).update({ name: nameVal, category: catVal })
            .then(function() {
                closeModal('thingModal');
                loadThingDetail(editId);
            })
            .catch(function(err) { console.error('Update thing error:', err); });
    } else {
        if (!currentRoom) { alert('No room selected.'); return; }
        var thingData = {
            name:      nameVal,
            category:  catVal,
            roomId:    currentRoom.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
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
