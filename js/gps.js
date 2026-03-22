// ============================================================
// GPS.js — GPS Shape Recording and Map Display
// Walk a zone perimeter with your phone to record a 2D shape.
// Uses Leaflet.js + OpenStreetMap (free, no API key needed).
// ============================================================

// ---------- Constants ----------

// Dark, high-contrast colors for shape display
const GPS_COLORS = ['#2E7D32', '#1565C0', '#E65100', '#6A1B9A',
                    '#C62828', '#00695C', '#4E342E', '#AD1457'];

const TILE_URL   = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// ---------- Module State ----------

var gpsWatchId        = null;     // geolocation watchPosition ID
var gpsRecordedPoints = [];       // points collected during current recording
var gpsLastPoint      = null;     // last accepted point (for jump detection)
var gpsCurrentZoneId  = null;     // zone being viewed/recorded
var gpsCurrentShape   = null;     // loaded Firestore shape doc for current zone

// Leaflet map instances — only one should be active at a time
var gpsViewMap       = null;
var gpsViewTileLayer = null;
var gpsEditMap       = null;
var gpsEditTileLayer = null;
var gpsYardMap       = null;
var gpsYardTileLayer = null;

// Point editor state
var gpsEditPoints  = [];   // working copy of points in the editor
var gpsEditMarkers = [];   // Leaflet Marker objects for each edit point
var gpsEditPolygon = null; // Leaflet Polygon drawn in edit mode

// Live recording map state
var gpsRecordMap         = null;
var gpsRecordTileLayer   = null;
var gpsRecordPolyline    = null;  // path walked so far
var gpsRecordClosingLine = null;  // dashed line closing the shape back to start
var gpsRecordDot         = null;  // red dot showing current position

// ---------- Page Entry: loadGpsMapPage ----------

/**
 * Called by app.js when routing to #gpsmap/{zoneId}.
 * Loads the zone and its existing shape (if any), then shows the right mode.
 */
async function loadGpsMapPage(zoneId) {
    gpsCurrentZoneId = zoneId;

    // Load zone name if not already in window.currentZone
    if (!window.currentZone || window.currentZone.id !== zoneId) {
        try {
            var zDoc = await db.collection('zones').doc(zoneId).get();
            if (zDoc.exists) {
                window.currentZone = { id: zDoc.id, ...zDoc.data() };
            }
        } catch (e) {
            console.error('GPS: error loading zone', e);
        }
    }

    var zoneName = window.currentZone ? window.currentZone.name : 'Zone';
    document.getElementById('gpsmapTitle').textContent = zoneName + ' — Map';
    document.getElementById('gpsmapRecordZoneName').textContent = zoneName;

    // Destroy any leftover maps from previous navigation
    destroyMap('view');
    destroyMap('edit');

    // Load existing shape
    gpsCurrentShape = await loadShapeForZone(zoneId);

    if (gpsCurrentShape) {
        showGpsViewMode();
    } else {
        showGpsViewMode(); // View mode still shows Record button when no shape
    }
}

// ---------- Mode Switching ----------

/**
 * Show the view-mode panel (displays existing shape or "no shape yet").
 */
function showGpsViewMode() {
    document.getElementById('gpsmapViewMode').classList.remove('hidden');
    document.getElementById('gpsmapRecordMode').classList.add('hidden');
    document.getElementById('gpsmapEditMode').classList.add('hidden');

    destroyMap('view');
    destroyMap('edit');

    if (gpsCurrentShape) {
        document.getElementById('gpsmapEditBtn').style.display   = 'inline-flex';
        document.getElementById('gpsmapDeleteBtn').style.display = 'inline-flex';
        document.getElementById('gpsmapRecordBtn').textContent   = 'Re-record Shape';
        document.getElementById('gpsmapAreaDisplay').textContent = formatArea(gpsCurrentShape.areaSqft);

        // Init the view map after a brief delay so the container is visible
        setTimeout(function() { initViewMap(gpsCurrentShape.points, gpsCurrentShape.color); }, 120);
    } else {
        document.getElementById('gpsmapEditBtn').style.display   = 'none';
        document.getElementById('gpsmapDeleteBtn').style.display = 'none';
        document.getElementById('gpsmapRecordBtn').textContent   = 'Record Shape';
        document.getElementById('gpsmapAreaDisplay').textContent = '';
    }
}

/**
 * Show the recording mode panel (walk perimeter flow).
 */
function showGpsRecordMode() {
    document.getElementById('gpsmapViewMode').classList.add('hidden');
    document.getElementById('gpsmapRecordMode').classList.remove('hidden');
    document.getElementById('gpsmapEditMode').classList.add('hidden');

    // Reset UI to pre-start state
    document.getElementById('gpsmapStartBtn').classList.remove('hidden');
    var stopBtn = document.getElementById('gpsmapStopBtn');
    stopBtn.classList.add('hidden');
    stopBtn.textContent = '■ Stop Recording';
    stopBtn.disabled = false;
    document.getElementById('gpsmapRecordStats').classList.add('hidden');
    updateRecordStats(0, 0, null);
}

/**
 * Show the point-editor mode panel.
 * @param {Array} points - Array of {lat, lng} to start editing.
 */
function showGpsEditMode(points) {
    document.getElementById('gpsmapViewMode').classList.add('hidden');
    document.getElementById('gpsmapRecordMode').classList.add('hidden');
    document.getElementById('gpsmapEditMode').classList.remove('hidden');

    // Copy points into working state
    gpsEditPoints = points.map(function(p) { return { lat: p.lat, lng: p.lng }; });

    destroyMap('edit');
    setTimeout(function() { initEditMap(gpsEditPoints); }, 120);
}

// ---------- Recording ----------

/**
 * Start GPS watchPosition and begin collecting points.
 */
function startRecording() {
    if (!navigator.geolocation) {
        alert('GPS is not available on this device or browser.');
        return;
    }

    gpsRecordedPoints = [];
    gpsLastPoint      = null;
    destroyRecordMap(); // clear any previous recording map

    document.getElementById('gpsmapStartBtn').classList.add('hidden');
    document.getElementById('gpsmapStopBtn').classList.remove('hidden');
    document.getElementById('gpsmapRecordStats').classList.remove('hidden');

    gpsWatchId = navigator.geolocation.watchPosition(
        handleGpsPosition,
        handleGpsError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
}

/**
 * Stop GPS recording and move to the point editor.
 */
function stopRecording() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    // Give immediate visual feedback that recording has stopped
    var stopBtn = document.getElementById('gpsmapStopBtn');
    stopBtn.textContent = '⏹ Recording Stopped';
    stopBtn.disabled = true;

    if (gpsRecordedPoints.length < 3) {
        alert('Not enough points recorded (need at least 3 to form a shape). Try walking a larger area.');
        showGpsRecordMode();
        return;
    }

    // Tear down the live recording map before opening the editor
    destroyRecordMap();

    // Move directly to the point editor for cleanup
    showGpsEditMode(gpsRecordedPoints);
}

/**
 * Called by watchPosition for each new GPS reading.
 * Applies accuracy and jump filters before accepting the point.
 */
function handleGpsPosition(position) {
    var lat      = position.coords.latitude;
    var lng      = position.coords.longitude;
    var accuracy = position.coords.accuracy; // meters

    // Update stats display regardless of whether point is accepted
    updateRecordStats(gpsRecordedPoints.length, totalDistanceFt(gpsRecordedPoints), accuracy);

    // Filter 1: reject if GPS accuracy is too poor
    if (accuracy > 20) { return; }

    var newPoint = { lat: lat, lng: lng };

    if (gpsLastPoint !== null) {
        var dist = haversineDistance(gpsLastPoint, newPoint);

        // Filter 2: reject GPS jumps (> 15m since last accepted point)
        if (dist > 15) { return; }

        // Filter 3: skip duplicate/stationary readings (< 1m movement)
        if (dist < 1) { return; }
    }

    gpsRecordedPoints.push(newPoint);
    gpsLastPoint = newPoint;
    updateRecordStats(gpsRecordedPoints.length, totalDistanceFt(gpsRecordedPoints), accuracy);
    updateRecordMap(gpsRecordedPoints);
}

function handleGpsError(error) {
    // Transient errors are normal — log but don't stop recording
    console.warn('GPS position error:', error.message);
}

// ---------- Live Recording Map ----------

/**
 * Called after each accepted GPS point to update the live map.
 * On the first point, initializes the Leaflet map and shows the container.
 * On subsequent points, updates the polyline and pans to follow.
 */
function updateRecordMap(points) {
    var container = document.getElementById('gpsmapRecordMapContainer');
    var last = points[points.length - 1];

    if (points.length === 1) {
        // First point — initialize the map centered here
        container.classList.remove('hidden');

        gpsRecordMap       = L.map('gpsmapRecordMapContainer').setView([last.lat, last.lng], 19);
        gpsRecordTileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTR }).addTo(gpsRecordMap);

        // Blue polyline for the path walked
        gpsRecordPolyline = L.polyline([[last.lat, last.lng]], {
            color:  '#1565C0',
            weight: 4
        }).addTo(gpsRecordMap);

        // Red dot for current position
        gpsRecordDot = L.circleMarker([last.lat, last.lng], {
            radius:      9,
            color:       '#fff',
            weight:      2,
            fillColor:   '#C62828',
            fillOpacity: 1
        }).addTo(gpsRecordMap);

    } else if (gpsRecordPolyline) {
        // Update path and move the current-position dot
        var latLngs = points.map(function(p) { return [p.lat, p.lng]; });
        gpsRecordPolyline.setLatLngs(latLngs);
        gpsRecordDot.setLatLng([last.lat, last.lng]);

        // Pan smoothly to keep the dot in view
        gpsRecordMap.panTo([last.lat, last.lng]);

        // Once we have 3+ points draw a dashed closing line back to the start
        if (points.length >= 3) {
            var first = points[0];
            if (gpsRecordClosingLine) {
                gpsRecordClosingLine.setLatLngs([[last.lat, last.lng], [first.lat, first.lng]]);
            } else {
                gpsRecordClosingLine = L.polyline([[last.lat, last.lng], [first.lat, first.lng]], {
                    color:     '#888',
                    weight:    2,
                    dashArray: '6 5'
                }).addTo(gpsRecordMap);
            }
        }
    }
}

/**
 * Tear down the live recording map and hide the container.
 */
function destroyRecordMap() {
    if (gpsRecordMap) {
        gpsRecordMap.remove();
        gpsRecordMap         = null;
        gpsRecordTileLayer   = null;
        gpsRecordPolyline    = null;
        gpsRecordClosingLine = null;
        gpsRecordDot         = null;
    }
    var container = document.getElementById('gpsmapRecordMapContainer');
    if (container) container.classList.add('hidden');
}

/**
 * Update the live stats display during recording.
 */
function updateRecordStats(pointCount, distanceFt, accuracy) {
    document.getElementById('gpsmapPointCount').textContent = pointCount;
    document.getElementById('gpsmapDistance').textContent   = Math.round(distanceFt) + ' ft';
    document.getElementById('gpsmapAccuracy').textContent   = accuracy ? Math.round(accuracy) + ' m' : '—';
}

// ---------- View Map ----------

function initViewMap(points, color) {
    var latLngs = points.map(function(p) { return [p.lat, p.lng]; });
    gpsViewMap       = L.map('gpsmapViewMapContainer');
    gpsViewTileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTR }).addTo(gpsViewMap);

    var poly = L.polygon(latLngs, {
        color:       color || GPS_COLORS[0],
        fillColor:   color || GPS_COLORS[0],
        fillOpacity: 0.35,
        weight:      3
    }).addTo(gpsViewMap);

    gpsViewMap.fitBounds(poly.getBounds(), { padding: [20, 20] });
}

// ---------- Edit Map ----------

function initEditMap(points) {
    var latLngs = points.map(function(p) { return [p.lat, p.lng]; });
    gpsEditMap       = L.map('gpsmapEditMapContainer');
    gpsEditTileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTR }).addTo(gpsEditMap);

    gpsEditPolygon = L.polygon(latLngs, {
        color:       '#333',
        fillColor:   '#4CAF50',
        fillOpacity: 0.15,
        weight:      2,
        dashArray:   '6 4'
    }).addTo(gpsEditMap);

    gpsEditMap.fitBounds(gpsEditPolygon.getBounds(), { padding: [30, 30] });

    // Click on a polygon edge to see that segment's length
    gpsEditPolygon.on('click', handlePolygonEdgeClick);

    rebuildEditMarkers();
    showEditorInfo('Tap a vertex handle to select. Drag to move. Tap Auto-Simplify to clean up extra points.');
}

/**
 * Rebuild draggable vertex markers after any point change.
 */
function rebuildEditMarkers() {
    // Remove old markers
    gpsEditMarkers.forEach(function(m) { gpsEditMap.removeLayer(m); });
    gpsEditMarkers = [];

    // Custom small square icon for vertex handles
    var markerIcon = L.divIcon({
        className: 'gps-edit-marker',
        iconSize:  [14, 14],
        iconAnchor: [7, 7]
    });

    gpsEditPoints.forEach(function(pt, index) {
        var marker = L.marker([pt.lat, pt.lng], {
            draggable:    true,
            icon:         markerIcon,
            zIndexOffset: 1000
        }).addTo(gpsEditMap);

        // While dragging: update polygon and adjacent segment lengths live
        marker.on('drag', function(e) {
            var ll = e.target.getLatLng();
            gpsEditPoints[index] = { lat: ll.lat, lng: ll.lng };
            updateEditPolygon();

            // Show live adjacent segment lengths
            var n    = gpsEditPoints.length;
            var prev = (index - 1 + n) % n;
            var next = (index + 1) % n;
            var d1   = Math.round(haversineDistance(gpsEditPoints[prev], gpsEditPoints[index]) * 3.28084);
            var d2   = Math.round(haversineDistance(gpsEditPoints[index], gpsEditPoints[next]) * 3.28084);
            showEditorInfo('← ' + d1 + ' ft  |  ' + d2 + ' ft →');
        });

        // Click: popup with delete button and adjacent segment lengths
        marker.on('click', function() {
            var n    = gpsEditPoints.length;
            var prev = (index - 1 + n) % n;
            var next = (index + 1) % n;
            var d1   = Math.round(haversineDistance(gpsEditPoints[prev], gpsEditPoints[index]) * 3.28084);
            var d2   = Math.round(haversineDistance(gpsEditPoints[index], gpsEditPoints[next]) * 3.28084);

            var content = '<div class="gps-point-popup">' +
                '<div class="gps-popup-lengths">← ' + d1 + ' ft &nbsp;|&nbsp; ' + d2 + ' ft →</div>' +
                '<button class="btn btn-danger btn-small" onclick="deleteEditPoint(' + index + ')">Delete Point</button>' +
                '</div>';

            marker.bindPopup(content, { closeButton: false, offset: L.point(0, -10) }).openPopup();
        });

        gpsEditMarkers.push(marker);
    });
}

/**
 * Delete a vertex by index. Minimum 3 points required.
 * Called from inline onclick in Leaflet popup HTML.
 */
function deleteEditPoint(index) {
    if (gpsEditPoints.length <= 3) {
        alert('Cannot delete — a shape needs at least 3 points.');
        return;
    }
    gpsEditPoints.splice(index, 1);
    updateEditPolygon();
    rebuildEditMarkers();
    showEditorInfo('Point deleted. ' + gpsEditPoints.length + ' points remaining.');
}

/**
 * Click on the polygon to show the nearest segment length.
 */
function handlePolygonEdgeClick(e) {
    var n       = gpsEditPoints.length;
    var bestIdx = 0;
    var bestD   = Infinity;

    // Find segment whose midpoint is closest to the click
    for (var i = 0; i < n; i++) {
        var j   = (i + 1) % n;
        var mid = {
            lat: (gpsEditPoints[i].lat + gpsEditPoints[j].lat) / 2,
            lng: (gpsEditPoints[i].lng + gpsEditPoints[j].lng) / 2
        };
        var d = haversineDistance(e.latlng, mid);
        if (d < bestD) { bestD = d; bestIdx = i; }
    }

    var j    = (bestIdx + 1) % n;
    var dist = Math.round(haversineDistance(gpsEditPoints[bestIdx], gpsEditPoints[j]) * 3.28084);
    showEditorInfo('Side length: ' + dist + ' ft  (' + Math.round(dist / 3.281) + ' m)');
}

/**
 * Sync the Leaflet polygon to the current gpsEditPoints array.
 */
function updateEditPolygon() {
    if (gpsEditPolygon) {
        gpsEditPolygon.setLatLngs(gpsEditPoints.map(function(p) { return [p.lat, p.lng]; }));
    }
}

function showEditorInfo(msg) {
    document.getElementById('gpsmapEditorInfo').textContent = msg;
}

// ---------- Auto-Simplify ----------

/**
 * Run Ramer-Douglas-Peucker (built into Leaflet) to remove redundant
 * middle points while preserving the overall shape.
 */
function simplifyEditPoints() {
    if (gpsEditPoints.length < 4) {
        showEditorInfo('Not enough points to simplify (need at least 4).');
        return;
    }

    var before     = gpsEditPoints.length;
    var tolerance  = 0.000045; // ~5 meters in degrees

    // L.LineUtil.simplify expects {x, y} objects
    var pts        = gpsEditPoints.map(function(p) { return { x: p.lng, y: p.lat }; });
    var simplified = L.LineUtil.simplify(pts, tolerance);
    gpsEditPoints  = simplified.map(function(p) { return { lat: p.y, lng: p.x }; });

    // Need at least 3 points
    if (gpsEditPoints.length < 3) {
        gpsEditPoints = pts.slice(0, 3).map(function(p) { return { lat: p.y, lng: p.x }; });
    }

    updateEditPolygon();
    rebuildEditMarkers();
    showEditorInfo('Simplified: ' + before + ' → ' + gpsEditPoints.length + ' points.');
}

// ---------- Save Shape ----------

/**
 * Save the edited points to Firestore (create or update).
 */
async function saveGpsShape() {
    if (gpsEditPoints.length < 3) {
        alert('Need at least 3 points to save a shape.');
        return;
    }

    var saveBtn = document.getElementById('gpsmapSaveEditBtn');
    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving...';

    try {
        var areaSqft = calculateAreaSqft(gpsEditPoints);
        var color    = gpsCurrentShape ? gpsCurrentShape.color : assignColor(gpsCurrentZoneId);

        var shapeData = {
            zoneId:   gpsCurrentZoneId,
            name:     window.currentZone ? window.currentZone.name : 'Zone Shape',
            points:   gpsEditPoints,
            areaSqft: areaSqft,
            color:    color,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (gpsCurrentShape) {
            await db.collection('gpsShapes').doc(gpsCurrentShape.id).update(shapeData);
            gpsCurrentShape = { id: gpsCurrentShape.id, ...shapeData };
        } else {
            shapeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            var ref = await db.collection('gpsShapes').add(shapeData);
            gpsCurrentShape = { id: ref.id, ...shapeData };
        }

        destroyMap('edit');
        showGpsViewMode();

    } catch (err) {
        console.error('Error saving GPS shape:', err);
        alert('Error saving shape — check console.');
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Shape';
    }
}

// ---------- Delete Shape ----------

async function deleteGpsShape() {
    if (!gpsCurrentShape) return;
    if (!confirm('Delete this shape? This cannot be undone.')) return;

    try {
        await db.collection('gpsShapes').doc(gpsCurrentShape.id).delete();
        gpsCurrentShape = null;
        destroyMap('view');
        showGpsViewMode();
    } catch (err) {
        console.error('Error deleting shape:', err);
        alert('Error deleting shape.');
    }
}

// ---------- Firestore: Load Shape ----------

async function loadShapeForZone(zoneId) {
    try {
        var snap = await db.collection('gpsShapes')
            .where('zoneId', '==', zoneId)
            .limit(1)
            .get();
        if (snap.empty) return null;
        var d = snap.docs[0];
        return { id: d.id, ...d.data() };
    } catch (err) {
        console.error('Error loading GPS shape:', err);
        return null;
    }
}

// ---------- Zone Detail GPS Section ----------

/**
 * Called from zones.js after loading a zone detail page.
 * Shows a small area badge if a shape exists, or "no shape" message.
 */
async function loadGpsSection(zoneId) {
    var preview    = document.getElementById('zoneGpsPreview');
    var emptyState = document.getElementById('zoneGpsEmptyState');

    preview.innerHTML    = '';
    emptyState.style.display = 'none';

    try {
        var shape = await loadShapeForZone(zoneId);

        if (shape) {
            var badge      = document.createElement('div');
            badge.className = 'gps-zone-preview';
            badge.innerHTML = '<span class="gps-color-dot" style="background:' + shape.color + '"></span>' +
                              '<span class="gps-area-badge">📐 ' + formatArea(shape.areaSqft) + '</span>';
            preview.appendChild(badge);
        } else {
            emptyState.textContent   = 'No shape recorded yet. Tap 📍 Map to record one.';
            emptyState.style.display = 'block';
        }
    } catch (err) {
        console.error('Error loading GPS section:', err);
    }
}

// ---------- Map Background Toggle ----------

/**
 * Toggle the OpenStreetMap tile layer on/off for any map instance.
 * @param {L.Map} mapInstance
 * @param {L.TileLayer} tileLayer
 * @param {string} btnId - ID of the toggle button to update text
 */
function toggleMapBg(mapInstance, tileLayer, btnId) {
    var btn = document.getElementById(btnId);
    if (!mapInstance || !tileLayer) return;

    if (mapInstance.hasLayer(tileLayer)) {
        mapInstance.removeLayer(tileLayer);
        if (btn) btn.textContent = 'Show Map';
    } else {
        tileLayer.addTo(mapInstance);
        if (btn) btn.textContent = 'Hide Map';
    }
}

// ---------- Yard Map Page ----------

/**
 * Loads ALL gpsShapes from Firestore and displays them layered on one map.
 * Called by app.js when routing to #yardmap.
 */
async function loadYardMapPage() {
    var togglesEl  = document.getElementById('yardmapShapeToggles');
    var emptyState = document.getElementById('yardmapEmptyState');

    togglesEl.innerHTML      = '';
    emptyState.style.display = 'none';

    destroyMap('yard');

    try {
        var snap = await db.collection('gpsShapes').get();

        if (snap.empty) {
            emptyState.textContent   = 'No shapes recorded yet. Open a zone and tap 📍 Map to record its boundary.';
            emptyState.style.display = 'block';
            return;
        }

        var shapes = [];
        snap.forEach(function(doc) { shapes.push({ id: doc.id, ...doc.data() }); });

        // Initialize the Leaflet map
        setTimeout(function() {
            gpsYardMap       = L.map('yardmapContainer');
            gpsYardTileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTR }).addTo(gpsYardMap);

            var allBounds    = null;
            var shapePolys   = {};  // shapeId → L.Polygon, for toggle control

            shapes.forEach(function(shape) {
                if (!shape.points || shape.points.length < 3) return;

                var latLngs = shape.points.map(function(p) { return [p.lat, p.lng]; });
                var poly    = L.polygon(latLngs, {
                    color:       shape.color || GPS_COLORS[0],
                    fillColor:   shape.color || GPS_COLORS[0],
                    fillOpacity: 0.35,
                    weight:      3
                }).addTo(gpsYardMap);

                poly.bindTooltip(shape.name, {
                    permanent:  true,
                    direction:  'center',
                    className:  'gps-shape-label'
                });

                shapePolys[shape.id] = poly;
                var bounds           = poly.getBounds();
                allBounds            = allBounds ? allBounds.extend(bounds) : bounds;

                // Build toggle row
                var row = document.createElement('label');
                row.className = 'gps-shape-toggle-row';
                row.innerHTML =
                    '<input type="checkbox" checked data-sid="' + shape.id + '">' +
                    '<span class="gps-color-swatch" style="background:' + shape.color + '"></span>' +
                    '<span class="gps-toggle-name">' + shape.name + '</span>' +
                    '<span class="gps-toggle-area">' + formatArea(shape.areaSqft) + '</span>';

                row.querySelector('input').addEventListener('change', function(e) {
                    var p = shapePolys[e.target.dataset.sid];
                    if (e.target.checked) { p.addTo(gpsYardMap); }
                    else                  { gpsYardMap.removeLayer(p); }
                });

                togglesEl.appendChild(row);
            });

            if (allBounds) {
                gpsYardMap.fitBounds(allBounds, { padding: [20, 20] });
            }
        }, 120);

    } catch (err) {
        console.error('Error loading yard map:', err);
        emptyState.textContent   = 'Error loading shapes.';
        emptyState.style.display = 'block';
    }
}

// ---------- Map Destroy Helpers ----------

function destroyMap(which) {
    if (which === 'view' && gpsViewMap) {
        gpsViewMap.remove();
        gpsViewMap       = null;
        gpsViewTileLayer = null;
    }
    if (which === 'edit' && gpsEditMap) {
        gpsEditMap.remove();
        gpsEditMap       = null;
        gpsEditTileLayer = null;
        gpsEditPolygon   = null;
        gpsEditMarkers   = [];
    }
    if (which === 'yard' && gpsYardMap) {
        gpsYardMap.remove();
        gpsYardMap       = null;
        gpsYardTileLayer = null;
    }
}

// ---------- Math Utilities ----------

/**
 * Haversine formula — straight-line distance between two lat/lng points.
 * Returns distance in METERS.
 */
function haversineDistance(p1, p2) {
    var R    = 6371000; // Earth radius, meters
    var dLat = (p2.lat - p1.lat) * Math.PI / 180;
    var dLng = (p2.lng - p1.lng) * Math.PI / 180;
    var lat1 = p1.lat * Math.PI / 180;
    var lat2 = p2.lat * Math.PI / 180;
    var a    = Math.sin(dLat/2) * Math.sin(dLat/2) +
               Math.cos(lat1)   * Math.cos(lat2) *
               Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sum of all segment distances in a recorded point array.
 * Returns total perimeter in FEET.
 */
function totalDistanceFt(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
        total += haversineDistance(points[i - 1], points[i]);
    }
    return total * 3.28084; // meters → feet
}

/**
 * Shoelace formula for polygon area, corrected for lat/lng curvature.
 * Returns area in SQUARE FEET.
 */
function calculateAreaSqft(points) {
    if (points.length < 3) return 0;

    var latRef  = points[0].lat;
    var lngRef  = points[0].lng;
    var R       = 6371000;
    var latRad  = latRef * Math.PI / 180;
    var mPerDeg = R * Math.PI / 180;

    // Project lat/lng to approximate x/y in meters relative to first point
    var xy = points.map(function(p) {
        return {
            x: (p.lng - lngRef) * Math.cos(latRad) * mPerDeg,
            y: (p.lat - latRef) * mPerDeg
        };
    });

    // Shoelace
    var area = 0;
    var n    = xy.length;
    for (var i = 0; i < n; i++) {
        var j = (i + 1) % n;
        area += xy[i].x * xy[j].y;
        area -= xy[j].x * xy[i].y;
    }
    area = Math.abs(area) / 2; // square meters

    return area * 10.7639; // m² → ft²
}

/**
 * Format square footage for display, adding acreage for large areas.
 */
function formatArea(sqft) {
    if (!sqft || sqft <= 0) return '';
    var result = Math.round(sqft).toLocaleString() + ' sq ft';
    if (sqft >= 43560) {
        result += ' (' + (sqft / 43560).toFixed(2) + ' acres)';
    }
    return result;
}

/**
 * Assign a consistent color from the palette based on the zone ID string.
 * Same zone always gets the same color.
 */
function assignColor(zoneId) {
    var hash = 0;
    for (var i = 0; i < zoneId.length; i++) {
        hash = ((hash * 31) + zoneId.charCodeAt(i)) | 0;
    }
    return GPS_COLORS[Math.abs(hash) % GPS_COLORS.length];
}

// ---------- Button Wire-Up ----------

document.getElementById('viewYardMapBtn').addEventListener('click', function() {
    window.location.hash = 'yardmap';
});

document.getElementById('zoneGpsBtn').addEventListener('click', function() {
    if (window.currentZone) {
        window.location.hash = 'gpsmap/' + window.currentZone.id;
    }
});

document.getElementById('gpsmapRecordBtn').addEventListener('click', function() {
    showGpsRecordMode();
});

document.getElementById('gpsmapEditBtn').addEventListener('click', function() {
    if (gpsCurrentShape) { showGpsEditMode(gpsCurrentShape.points); }
});

document.getElementById('gpsmapDeleteBtn').addEventListener('click', deleteGpsShape);

document.getElementById('gpsmapStartBtn').addEventListener('click', startRecording);

document.getElementById('gpsmapStopBtn').addEventListener('click', stopRecording);

document.getElementById('gpsmapCancelRecordBtn').addEventListener('click', function() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    destroyRecordMap();
    showGpsViewMode();
});

document.getElementById('gpsmapSimplifyBtn').addEventListener('click', simplifyEditPoints);

document.getElementById('gpsmapSaveEditBtn').addEventListener('click', saveGpsShape);

document.getElementById('gpsmapCancelEditBtn').addEventListener('click', function() {
    destroyMap('edit');
    showGpsViewMode();
});

document.getElementById('gpsmapToggleBgBtn').addEventListener('click', function() {
    toggleMapBg(gpsViewMap, gpsViewTileLayer, 'gpsmapToggleBgBtn');
});

document.getElementById('gpsmapToggleBgEditBtn').addEventListener('click', function() {
    toggleMapBg(gpsEditMap, gpsEditTileLayer, 'gpsmapToggleBgEditBtn');
});

document.getElementById('yardmapToggleBgBtn').addEventListener('click', function() {
    toggleMapBg(gpsYardMap, gpsYardTileLayer, 'yardmapToggleBgBtn');
});
