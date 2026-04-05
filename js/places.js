// ============================================================
// places.js — Places CRUD, GPS capture, Nominatim reverse geocode
//
// Firestore collection: userCol('places')
// Fields: name, address, category, lat, lng, osmId, status, createdAt
//
// status: 1 = active, 0 = soft-deleted
// osmId: OpenStreetMap node/way ID — used for dedup in Phase 3
// ============================================================

// Global reference to the place being edited (null = add mode)
var _placeEditId = null;

// Cache of the GPS coordinates captured in the modal
var _placeModalLat = null;
var _placeModalLng = null;

// Remember which page launched the place detail (for back button)
var _placeDetailFrom = '#places';

// ============================================================
// Places List Page
// ============================================================

/**
 * Load the #places page — fetch all active places and render the list.
 * Called by app.js when routing to #places.
 */
async function loadPlacesPage() {
    var container  = document.getElementById('placesListContainer');
    var emptyState = document.getElementById('placesEmptyState');
    var searchInput = document.getElementById('placesSearchInput');

    container.innerHTML  = '';
    emptyState.textContent = 'Loading...';
    emptyState.classList.remove('hidden');

    // Wire up Add button
    document.getElementById('addPlaceBtn').onclick = function() {
        _placesOpenModal(null);
    };

    // Wire up search filter
    searchInput.value = '';
    searchInput.oninput = function() {
        _placesFilterList(searchInput.value.trim().toLowerCase());
    };

    try {
        var snap = await userCol('places')
            .where('status', '==', 1)
            .orderBy('name')
            .get();

        if (snap.empty) {
            emptyState.textContent = 'No places yet. Tap + Add to get started.';
            return;
        }

        emptyState.classList.add('hidden');
        snap.forEach(function(doc) {
            container.appendChild(_placesRenderRow(doc.id, doc.data()));
        });

    } catch (err) {
        console.error('Error loading places:', err);
        emptyState.textContent = 'Error loading places.';
    }
}

/**
 * Build a single place list row element.
 */
function _placesRenderRow(id, data) {
    var row = document.createElement('div');
    row.className = 'card-list-item place-list-item';
    row.dataset.name = (data.name || '').toLowerCase();

    var main = document.createElement('div');
    main.className = 'place-list-main';
    main.style.cursor = 'pointer';
    main.onclick = function() {
        _placeDetailFrom = '#places';
        window.location.hash = '#place/' + id;
    };

    var nameEl = document.createElement('div');
    nameEl.className = 'place-list-name';
    nameEl.textContent = data.name || '(unnamed)';

    var subEl = document.createElement('div');
    subEl.className = 'place-list-sub';
    var parts = [];
    if (data.category) parts.push(data.category);
    if (data.address)  parts.push(data.address);
    subEl.textContent = parts.join(' · ');

    main.appendChild(nameEl);
    main.appendChild(subEl);

    var editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary btn-small';
    editBtn.textContent = 'Edit';
    editBtn.onclick = function(e) {
        e.stopPropagation();
        _placesOpenModal(id, data);
    };

    row.appendChild(main);
    row.appendChild(editBtn);
    return row;
}

/**
 * Filter the displayed list rows by the search term.
 */
function _placesFilterList(term) {
    var rows       = document.querySelectorAll('.place-list-item');
    var emptyState = document.getElementById('placesEmptyState');
    var anyVisible = false;

    rows.forEach(function(row) {
        var match = !term || row.dataset.name.includes(term);
        row.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
    });

    emptyState.textContent = anyVisible ? '' : 'No places match your search.';
    emptyState.classList.toggle('hidden', anyVisible);
}

// ============================================================
// Place Detail Page (stub — full detail built in Phase 6)
// ============================================================

/**
 * Load the #place/{id} detail page.
 * Called by app.js when routing to #place/{id}.
 */
async function loadPlaceDetailPage(placeId) {
    var nameEl  = document.getElementById('placeDetailName');
    var infoEl  = document.getElementById('placeDetailInfo');
    var backBtn = document.getElementById('placeDetailBackBtn');
    var editBtn = document.getElementById('editPlaceDetailBtn');

    nameEl.textContent  = 'Loading...';
    infoEl.innerHTML    = '';

    backBtn.onclick = function() {
        window.location.hash = _placeDetailFrom || '#places';
    };

    editBtn.onclick = function() {
        _placesOpenModal(placeId, window._placeDetailData);
    };

    try {
        var doc = await userCol('places').doc(placeId).get();
        if (!doc.exists || doc.data().status === 0) {
            nameEl.textContent = 'Place not found';
            return;
        }

        var data = doc.data();
        window._placeDetailData = data;  // cache for edit button
        nameEl.textContent = data.name || '(unnamed)';

        // Build info rows
        var rows = [];
        if (data.category) rows.push({ label: 'Category', value: data.category });
        if (data.address)  rows.push({ label: 'Address',  value: data.address });
        if (data.lat && data.lng) {
            rows.push({ label: 'Coordinates', value: data.lat.toFixed(6) + ', ' + data.lng.toFixed(6) });
        }

        if (rows.length > 0) {
            var table = document.createElement('div');
            table.className = 'place-detail-table';
            rows.forEach(function(r) {
                var row = document.createElement('div');
                row.className = 'place-detail-row';
                row.innerHTML = '<span class="place-detail-label">' + escapeHtml(r.label) + '</span>' +
                                '<span class="place-detail-value">' + escapeHtml(r.value) + '</span>';
                table.appendChild(row);
            });
            infoEl.appendChild(table);
        }

    } catch (err) {
        console.error('Error loading place detail:', err);
        nameEl.textContent = 'Error loading place';
    }
}

// ============================================================
// Add / Edit Modal
// ============================================================

/**
 * Open the place modal in add mode (placeId = null) or edit mode.
 * @param {string|null} placeId  - null for add, doc ID for edit
 * @param {object}      [data]   - existing place data (edit mode only)
 */
function _placesOpenModal(placeId, data) {
    _placeEditId    = placeId;
    _placeModalLat  = null;
    _placeModalLng  = null;

    var title     = document.getElementById('placeModalTitle');
    var nameInput = document.getElementById('placeNameInput');
    var addrInput = document.getElementById('placeAddressInput');
    var catInput  = document.getElementById('placeCategoryInput');
    var deleteBtn = document.getElementById('placeModalDeleteBtn');
    var gpsStatus = document.getElementById('placeGpsStatus');

    // Clear form
    nameInput.value = '';
    addrInput.value = '';
    catInput.value  = '';
    document.getElementById('placeLatInput').value = '';
    document.getElementById('placeLngInput').value = '';
    gpsStatus.textContent = '📍 No location captured';

    if (placeId && data) {
        // Edit mode
        title.textContent   = 'Edit Place';
        nameInput.value     = data.name     || '';
        addrInput.value     = data.address  || '';
        catInput.value      = data.category || '';
        deleteBtn.style.display = '';

        if (data.lat && data.lng) {
            _placeModalLat = data.lat;
            _placeModalLng = data.lng;
            document.getElementById('placeLatInput').value = data.lat;
            document.getElementById('placeLngInput').value = data.lng;
            gpsStatus.textContent = '📍 ' + data.lat.toFixed(5) + ', ' + data.lng.toFixed(5);
        }
    } else {
        // Add mode — auto-capture GPS
        title.textContent       = 'Add Place';
        deleteBtn.style.display = 'none';
        _placesCaptureGps();
    }

    // Wire buttons
    document.getElementById('placeModalCancelBtn').onclick = function() {
        closeModal('placeModal');
    };
    document.getElementById('placeModalSaveBtn').onclick  = _placesSave;
    document.getElementById('placeRecaptureGpsBtn').onclick = _placesCaptureGps;
    document.getElementById('placeModalDeleteBtn').onclick = function() {
        closeModal('placeModal');
        setTimeout(function() { _placesConfirmDelete(_placeEditId); }, 50);
    };

    openModal('placeModal');
}

/**
 * Capture GPS coordinates and attempt a Nominatim reverse geocode.
 * Updates the GPS status label and pre-fills the address if empty.
 */
function _placesCaptureGps() {
    var gpsStatus = document.getElementById('placeGpsStatus');
    var addrInput = document.getElementById('placeAddressInput');

    if (!navigator.geolocation) {
        gpsStatus.textContent = '⚠️ GPS not supported by this browser';
        return;
    }

    gpsStatus.textContent = '📍 Capturing location...';

    navigator.geolocation.getCurrentPosition(
        async function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            _placeModalLat = lat;
            _placeModalLng = lng;
            document.getElementById('placeLatInput').value = lat;
            document.getElementById('placeLngInput').value = lng;
            gpsStatus.textContent = '📍 ' + lat.toFixed(5) + ', ' + lng.toFixed(5);

            // Reverse geocode only if address field is empty
            if (!addrInput.value.trim()) {
                gpsStatus.textContent += '  (looking up address...)';
                var addr = await _placesReverseGeocode(lat, lng);
                if (addr) {
                    addrInput.value = addr;
                    gpsStatus.textContent = '📍 ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
                } else {
                    gpsStatus.textContent = '📍 ' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ' (no address found)';
                }
            }
        },
        function(err) {
            console.warn('GPS error:', err);
            gpsStatus.textContent = '⚠️ Location unavailable — enter address manually';
        },
        { timeout: 10000, maximumAge: 30000 }
    );
}

/**
 * Reverse geocode lat/lng to a human-readable address using Nominatim.
 * Returns a formatted address string, or null if not found.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>}
 */
async function _placesReverseGeocode(lat, lng) {
    try {
        var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' +
                  lat + '&lon=' + lng + '&zoom=18&addressdetails=1';
        var resp = await fetch(url, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'MyLifeApp/1.0' }
        });
        if (!resp.ok) return null;

        var data = await resp.json();
        if (!data.address) return null;

        var a = data.address;
        var parts = [];

        // House number + street
        var street = [a.house_number, a.road || a.pedestrian || a.path].filter(Boolean).join(' ');
        if (street) parts.push(street);

        // City
        var city = a.city || a.town || a.village || a.suburb || a.hamlet;
        if (city) parts.push(city);

        // State + postcode
        if (a.state && a.postcode) {
            parts.push(a.state + ' ' + a.postcode);
        } else if (a.state) {
            parts.push(a.state);
        }

        return parts.join(', ') || data.display_name || null;

    } catch (err) {
        console.warn('Nominatim reverse geocode error:', err);
        return null;
    }
}

// ============================================================
// Save
// ============================================================

/**
 * Save a new place or update an existing one.
 */
async function _placesSave() {
    var name     = document.getElementById('placeNameInput').value.trim();
    var address  = document.getElementById('placeAddressInput').value.trim();
    var category = document.getElementById('placeCategoryInput').value.trim();
    var saveBtn  = document.getElementById('placeModalSaveBtn');

    if (!name) {
        alert('Please enter a place name.');
        document.getElementById('placeNameInput').focus();
        return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving\u2026';

    var payload = {
        name    : name,
        address : address  || null,
        category: category || null,
        lat     : _placeModalLat || null,
        lng     : _placeModalLng || null,
        status  : 1
    };

    try {
        if (_placeEditId) {
            // Edit existing
            payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await userCol('places').doc(_placeEditId).update(payload);
            closeModal('placeModal');
            // Refresh whichever page is showing
            if (window.location.hash.startsWith('#place/')) {
                window._placeDetailData = Object.assign(window._placeDetailData || {}, payload);
                loadPlaceDetailPage(_placeEditId);
            } else {
                loadPlacesPage();
            }
        } else {
            // New place
            payload.osmId     = null;  // set by Phase 3 when created from OSM search
            payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            var ref = await userCol('places').add(payload);
            closeModal('placeModal');
            loadPlacesPage();
            // LLM enrichment fires here in Phase 3 (placesEnrichWithLLM will be wired in)
        }
    } catch (err) {
        console.error('Error saving place:', err);
        alert('Error saving place — please try again.');
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save';
    }
}

// ============================================================
// Delete (soft)
// ============================================================

/**
 * Confirm and soft-delete a place (sets status to 0).
 */
async function _placesConfirmDelete(placeId) {
    if (!placeId) return;
    if (!confirm('Delete this place? It will be hidden but not permanently removed.')) return;

    try {
        await userCol('places').doc(placeId).update({
            status   : 0,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Navigate back to the list
        window.location.hash = '#places';
    } catch (err) {
        console.error('Error deleting place:', err);
        alert('Error deleting place — please try again.');
    }
}
