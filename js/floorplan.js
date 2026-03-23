// ============================================================
// floorplan.js — SVG Floor Plan Editor  (Phase H8)
// ============================================================
// Provides a full interactive SVG canvas for drawing floor layouts.
// Rooms are rectilinear polygons (all right angles).  Doors and
// windows are placed on wall segments.
// Saves to Firestore collection: floorPlans/{floorId}
// ============================================================

// ---- Constants ----
var FP_SNAP_FEET          = 0.5;   // snap grid: 0.5 ft (6-inch increments)
var FP_WALL_SNAP_PX       = 12;    // pixels — snap-to-wall proximity threshold
var FP_CLOSE_PX           = 12;    // pixels — click near first point to close shape
var FP_MAX_PX_PER_FOOT    = 30;    // cap pixels-per-foot so huge floors still fit

// Auto-assigned color palette for new rooms
var FP_ROOM_COLORS = [
    '#B3D9FF', '#B3FFD9', '#FFD9B3', '#FFB3D9',
    '#D9FFB3', '#D9B3FF', '#FFE5B3', '#B3E5FF'
];

// ---- State ----
var fpFloorId     = null;   // Firestore floor document ID
var fpFloor       = null;   // floor data {name, floorNumber, ...}
var fpPlan        = null;   // floorPlans doc: {widthFt, heightFt, rooms[], doors[], windows[]}
var fpRoomList    = [];     // rooms on this floor (for linking new shapes)
var fpDirty       = false;  // unsaved changes?

// Drawing tool state
var fpActiveTool   = 'select';
var fpDrawing      = false;
var fpDrawPoints   = [];     // [{x,y}] in feet — corners placed so far
var fpPreviewPoint = null;   // {x,y} — live cursor position (snapped, constrained)

// Selection state
var fpSelectedId   = null;   // ID of selected room shape

// Computed display scale
var fpPixPerFoot   = 20;
var fpSvgW         = 800;
var fpSvgH         = 600;

// ============================================================
// LOAD — entry point called by app.js on #floorplan/{id}
// ============================================================

function loadFloorPlanPage(floorId) {
    fpFloorId      = floorId;
    fpDirty        = false;
    fpDrawing      = false;
    fpDrawPoints   = [];
    fpPreviewPoint = null;
    fpSelectedId   = null;

    // Reset toolbar to select
    fpSetTool('select');

    // Load floor record for the title
    db.collection('floors').doc(floorId).get()
        .then(function(doc) {
            if (!doc.exists) { window.location.hash = '#house'; return; }
            fpFloor = Object.assign({ id: doc.id }, doc.data());
            document.getElementById('fpFloorTitle').textContent =
                (fpFloor.name || 'Floor') + ' — Floor Plan';
            document.getElementById('fpBackBtn').href = '#floor/' + floorId;

            // Load rooms list (for linking shapes to room records)
            return db.collection('rooms').where('floorId', '==', floorId).get()
                .then(function(snap) {
                    fpRoomList = [];
                    snap.forEach(function(d) {
                        fpRoomList.push(Object.assign({ id: d.id }, d.data()));
                    });
                    fpRoomList.sort(function(a, b) {
                        var ta = a.createdAt ? a.createdAt.toMillis() : 0;
                        var tb = b.createdAt ? b.createdAt.toMillis() : 0;
                        return ta - tb;
                    });
                });
        })
        .then(function() {
            // Load or initialize the floor plan document
            return db.collection('floorPlans').doc(floorId).get();
        })
        .then(function(planDoc) {
            if (planDoc.exists) {
                fpPlan = planDoc.data();
                // Ensure all arrays exist (backwards compat)
                if (!fpPlan.rooms)   fpPlan.rooms   = [];
                if (!fpPlan.doors)   fpPlan.doors   = [];
                if (!fpPlan.windows) fpPlan.windows = [];
            } else {
                // First time — show dimensions dialog, init with defaults
                fpPlan = { widthFt: 40, heightFt: 30, rooms: [], doors: [], windows: [] };
                document.getElementById('fpWidthInput').value  = 40;
                document.getElementById('fpHeightInput').value = 30;
                openModal('fpDimensionsModal');
            }
            fpInitSvg();
            fpRender();
            fpSetStatus('Select a tool to begin. Use "Room" to draw rooms, "Door"/"Window" to place them on walls.');
        })
        .catch(function(err) {
            console.error('loadFloorPlanPage error:', err);
        });
}

// ============================================================
// SVG INITIALIZATION
// ============================================================

/**
 * Calculate pixels-per-foot so the floor fits in the available area,
 * then set the SVG element's width and height.
 */
function fpInitSvg() {
    var wrapper = document.getElementById('fpCanvasWrapper');
    var svg     = document.getElementById('fpSvg');

    var containerW = wrapper.clientWidth  || 800;
    var containerH = wrapper.clientHeight || 500;

    var pxW = Math.max(300, containerW - 32);
    var pxH = Math.max(200, containerH - 32);

    var scaleW = pxW / fpPlan.widthFt;
    var scaleH = pxH / fpPlan.heightFt;

    fpPixPerFoot = Math.min(scaleW, scaleH, FP_MAX_PX_PER_FOOT);
    fpSvgW = Math.round(fpPlan.widthFt  * fpPixPerFoot);
    fpSvgH = Math.round(fpPlan.heightFt * fpPixPerFoot);

    svg.setAttribute('width',   fpSvgW);
    svg.setAttribute('height',  fpSvgH);
    svg.setAttribute('viewBox', '0 0 ' + fpSvgW + ' ' + fpSvgH);
}

// ============================================================
// FULL RENDER — clears & redraws everything
// ============================================================

function fpRender() {
    var svg = document.getElementById('fpSvg');
    svg.innerHTML = '';

    // Background rectangle
    fpSvgEl(svg, 'rect', {
        x: 0, y: 0, width: fpSvgW, height: fpSvgH,
        fill: '#f8f8f8', stroke: '#444', 'stroke-width': 2
    });

    // Grid (if toggled on)
    if (document.getElementById('fpGridToggle').checked) {
        fpRenderGrid(svg);
    }

    // Room shapes (drawn polygons)
    (fpPlan.rooms || []).forEach(function(room) { fpRenderRoom(svg, room); });

    // Doors
    (fpPlan.doors || []).forEach(function(door) { fpRenderDoor(svg, door); });

    // Windows
    (fpPlan.windows || []).forEach(function(win) { fpRenderWindow(svg, win); });

    // In-progress drawing preview
    if (fpDrawing && fpDrawPoints.length > 0) {
        fpRenderDrawPreview(svg);
    }

    // Update Edit/Delete button visibility
    var showSel = !!(fpSelectedId && fpActiveTool === 'select');
    document.getElementById('fpEditRoomBtn').style.display   = showSel ? '' : 'none';
    document.getElementById('fpDeleteRoomBtn').style.display = showSel ? '' : 'none';
}

// ============================================================
// GRID RENDERING
// ============================================================

function fpRenderGrid(svg) {
    var g = fpSvgG(svg, 'fp-grid');

    for (var x = 0; x <= fpPlan.widthFt; x += FP_SNAP_FEET) {
        var isMajor = (Math.round(x) === x && Math.round(x) % 5 === 0);
        var isFoot  = (Math.round(x) === x);
        fpSvgEl(g, 'line', {
            x1: x * fpPixPerFoot, y1: 0,
            x2: x * fpPixPerFoot, y2: fpSvgH,
            stroke: isMajor ? '#bbb' : (isFoot ? '#ddd' : '#eee'),
            'stroke-width': isMajor ? 1 : 0.5
        });
    }

    for (var y = 0; y <= fpPlan.heightFt; y += FP_SNAP_FEET) {
        var isMajorY = (Math.round(y) === y && Math.round(y) % 5 === 0);
        var isFootY  = (Math.round(y) === y);
        fpSvgEl(g, 'line', {
            x1: 0, y1: y * fpPixPerFoot,
            x2: fpSvgW, y2: y * fpPixPerFoot,
            stroke: isMajorY ? '#bbb' : (isFootY ? '#ddd' : '#eee'),
            'stroke-width': isMajorY ? 1 : 0.5
        });
    }

    // Foot labels on major grid lines (every 5 feet)
    for (var xL = 0; xL <= fpPlan.widthFt; xL += 5) {
        var txt = fpSvgEl(g, 'text', {
            x: xL * fpPixPerFoot + 2, y: 10,
            'font-size': 9, fill: '#aaa', 'pointer-events': 'none'
        });
        txt.textContent = xL + 'ft';
    }
    for (var yL = 5; yL <= fpPlan.heightFt; yL += 5) {
        var txt2 = fpSvgEl(g, 'text', {
            x: 2, y: yL * fpPixPerFoot - 2,
            'font-size': 9, fill: '#aaa', 'pointer-events': 'none'
        });
        txt2.textContent = yL + 'ft';
    }
}

// ============================================================
// ROOM RENDERING
// ============================================================

function fpRenderRoom(svg, room) {
    if (!room.points || room.points.length < 3) return;

    var isSelected = (room.id === fpSelectedId);
    var ptsStr = room.points.map(function(p) {
        return fp2px(p.x) + ',' + fp2px(p.y);
    }).join(' ');

    // Filled polygon
    var poly = fpSvgEl(svg, 'polygon', {
        points: ptsStr,
        fill: room.color || FP_ROOM_COLORS[0],
        'fill-opacity': 0.45,
        stroke: isSelected ? '#0066cc' : '#333',
        'stroke-width': isSelected ? 3 : 2,
        style: 'cursor:pointer'
    });
    poly.dataset.shapeId = room.id;

    // Click handler — behaviour depends on active tool
    poly.addEventListener('click', function(e) {
        e.stopPropagation();
        if (fpActiveTool === 'room') {
            // In draw mode, treat as canvas click (add a point)
            fpHandleRoomClick(e);
        } else if (fpActiveTool === 'select') {
            fpSelectShape(room.id);
        } else if (fpActiveTool === 'door') {
            fpPlaceMarkerOnWall(e, room, 'door');
        } else if (fpActiveTool === 'window') {
            fpPlaceMarkerOnWall(e, room, 'window');
        }
    });

    // Room name label (centered)
    var c = fpCentroid(room.points);
    var fontSize = Math.max(10, Math.min(14, fpPixPerFoot * 0.65));

    var nameText = fpSvgEl(svg, 'text', {
        x: fp2px(c.x), y: fp2px(c.y) - fontSize * 0.6,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': fontSize, 'font-weight': 'bold',
        fill: '#222', 'pointer-events': 'none'
    });
    nameText.textContent = room.label || '?';

    // Dimension sub-label (bounding box)
    var bbox = fpBBox(room.points);
    var areaFt = fpPolygonArea(room.points);
    var dimText = fpSvgEl(svg, 'text', {
        x: fp2px(c.x), y: fp2px(c.y) + fontSize * 0.8,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': Math.max(8, fontSize * 0.75),
        fill: '#555', 'pointer-events': 'none'
    });
    dimText.textContent = bbox.w.toFixed(0) + '\xd7' + bbox.h.toFixed(0) + ' ft  (' + areaFt.toFixed(0) + ' sq ft)';

    // Corner drag handles when selected
    if (isSelected) {
        room.points.forEach(function(p, i) {
            var handle = fpSvgEl(svg, 'circle', {
                cx: fp2px(p.x), cy: fp2px(p.y), r: 6,
                fill: 'white', stroke: '#0066cc', 'stroke-width': 2,
                style: 'cursor:move'
            });
            handle.dataset.roomId    = room.id;
            handle.dataset.ptIndex   = i;
            fpMakeDraggableHandle(handle, room, i);
        });
    }
}

/**
 * Allow a corner handle to be dragged to reshape a room.
 */
function fpMakeDraggableHandle(handle, room, ptIndex) {
    handle.addEventListener('mousedown', function(eDown) {
        eDown.preventDefault();
        eDown.stopPropagation();

        function onMove(eMove) {
            var pt = fpMouseToFeet(eMove);
            room.points[ptIndex] = pt;
            fpDirty = true;
            fpRender();
        }

        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ============================================================
// DOOR RENDERING
// ============================================================

function fpRenderDoor(svg, door) {
    var room = (fpPlan.rooms || []).find(function(r) { return r.id === door.roomId; });
    if (!room || !room.points) return;
    var seg = fpGetSegment(room.points, door.segmentIndex);
    if (!seg) return;

    var info = fpWallMetrics(seg, door.position, door.width);
    if (!info) return;

    var h  = info.hinge;   // px coords of door hinge
    var oe = info.openEnd; // px coords of other side of opening
    var sw = door.swingLeft ? 1 : -1; // +1 = left normal, -1 = right normal

    // Panel endpoint (door in open position — perpendicular to wall)
    var panelX = h.x - sw * info.ny * fp2px(door.width);
    var panelY = h.y + sw * info.nx * fp2px(door.width);

    // 1. Gap (erase the wall at the opening)
    fpSvgEl(svg, 'line', {
        x1: h.x, y1: h.y, x2: oe.x, y2: oe.y,
        stroke: '#f8f8f8', 'stroke-width': 6, 'pointer-events': 'none'
    });

    // 2. Door panel (thin line from hinge perpendicular)
    fpSvgEl(svg, 'line', {
        x1: h.x, y1: h.y, x2: panelX, y2: panelY,
        stroke: '#444', 'stroke-width': 1.5, 'pointer-events': 'none'
    });

    // 3. Swing arc (quarter circle from panel end to opening end)
    // Large-arc = 0 (quarter), sweep-flag depends on swingLeft
    var sweepFlag = door.swingLeft ? 0 : 1;
    var r = fp2px(door.width);
    fpSvgEl(svg, 'path', {
        d: 'M ' + panelX + ' ' + panelY +
           ' A ' + r + ' ' + r + ' 0 0 ' + sweepFlag + ' ' + oe.x + ' ' + oe.y,
        fill: 'none', stroke: '#888', 'stroke-width': 1,
        'stroke-dasharray': '4,3', 'pointer-events': 'none'
    });
}

// ============================================================
// WINDOW RENDERING
// ============================================================

function fpRenderWindow(svg, win) {
    var room = (fpPlan.rooms || []).find(function(r) { return r.id === win.roomId; });
    if (!room || !room.points) return;
    var seg = fpGetSegment(room.points, win.segmentIndex);
    if (!seg) return;

    var info = fpWallMetrics(seg, win.position, win.width);
    if (!info) return;

    var h  = info.hinge;
    var oe = info.openEnd;

    // Gap (erase wall)
    fpSvgEl(svg, 'line', {
        x1: h.x, y1: h.y, x2: oe.x, y2: oe.y,
        stroke: '#f8f8f8', 'stroke-width': 6, 'pointer-events': 'none'
    });

    // Double line (standard window symbol: two parallel lines offset from wall)
    var off = 3; // pixels each side
    [-1, 1].forEach(function(sign) {
        fpSvgEl(svg, 'line', {
            x1: h.x  + sign * off * info.nx,
            y1: h.y  + sign * off * info.ny,
            x2: oe.x + sign * off * info.nx,
            y2: oe.y + sign * off * info.ny,
            stroke: '#4488cc', 'stroke-width': 1.5, 'pointer-events': 'none'
        });
    });

    // End caps
    fpSvgEl(svg, 'line', {
        x1: h.x  - off * info.nx, y1: h.y  - off * info.ny,
        x2: h.x  + off * info.nx, y2: h.y  + off * info.ny,
        stroke: '#4488cc', 'stroke-width': 1.5, 'pointer-events': 'none'
    });
    fpSvgEl(svg, 'line', {
        x1: oe.x - off * info.nx, y1: oe.y - off * info.ny,
        x2: oe.x + off * info.nx, y2: oe.y + off * info.ny,
        stroke: '#4488cc', 'stroke-width': 1.5, 'pointer-events': 'none'
    });
}

// ============================================================
// IN-PROGRESS DRAWING PREVIEW
// ============================================================

function fpRenderDrawPreview(svg) {
    var pts = fpDrawPoints.slice();

    // Add constrained live cursor point
    if (fpPreviewPoint && pts.length > 0) {
        pts.push(fpConstrainToAxis(fpPreviewPoint, pts[pts.length - 1]));
    }

    // Dashed preview polyline
    if (pts.length >= 2) {
        var ptsStr = pts.map(function(p) {
            return fp2px(p.x) + ',' + fp2px(p.y);
        }).join(' ');
        fpSvgEl(svg, 'polyline', {
            points: ptsStr, fill: 'none',
            stroke: '#0066cc', 'stroke-width': 2,
            'stroke-dasharray': '6,3', 'pointer-events': 'none'
        });
    }

    // Dot at each placed corner
    pts.forEach(function(p, i) {
        fpSvgEl(svg, 'circle', {
            cx: fp2px(p.x), cy: fp2px(p.y),
            r: i === 0 ? 7 : 4,
            fill: i === 0 ? 'white' : '#0066cc',
            stroke: '#0066cc', 'stroke-width': 2,
            'pointer-events': 'none'
        });
    });

    // Coordinate label at cursor
    if (fpPreviewPoint && pts.length > 0) {
        var cur = pts[pts.length - 1];
        var lbl = fpSvgEl(svg, 'text', {
            x: fp2px(cur.x) + 8, y: fp2px(cur.y) - 6,
            'font-size': 10, fill: '#0066cc', 'pointer-events': 'none'
        });
        lbl.textContent = cur.x.toFixed(1) + ', ' + cur.y.toFixed(1) + ' ft';
    }
}

// ============================================================
// SVG EVENT HANDLERS
// ============================================================

(function() {
    var svg = document.getElementById('fpSvg');

    // Click — room drawing (background) or deselect
    svg.addEventListener('click', function(e) {
        if (!fpPlan) return;
        if (fpActiveTool === 'room') {
            fpHandleRoomClick(e);
        } else if (fpActiveTool === 'select' && e.target === svg) {
            // Background click → deselect
            fpSelectedId = null;
            fpSetStatus('Ready.');
            fpRender();
        }
    });

    // Double-click — finish room or navigate to room
    svg.addEventListener('dblclick', function(e) {
        if (!fpPlan) return;
        if (fpActiveTool === 'room' && fpDrawing) {
            fpFinishRoom(fpMouseToFeet(e));
        } else if (fpActiveTool === 'select' && fpSelectedId) {
            var room = (fpPlan.rooms || []).find(function(r) { return r.id === fpSelectedId; });
            if (room && room.roomId) {
                if (confirm('Go to room detail page for "' + (room.label || 'this room') + '"?')) {
                    window.location.hash = '#room/' + room.roomId;
                }
            }
        }
    });

    // Mouse move — live preview while drawing
    svg.addEventListener('mousemove', function(e) {
        if (!fpPlan || !fpDrawing) return;
        fpPreviewPoint = fpMouseToFeet(e);
        if (fpDrawPoints.length > 0) {
            var constrained = fpConstrainToAxis(fpPreviewPoint, fpDrawPoints[fpDrawPoints.length - 1]);
            fpSetStatus('Drawing: (' + constrained.x.toFixed(1) + ', ' + constrained.y.toFixed(1) +
                ' ft)  |  Click to place corner  |  Double-click to close shape  |  Esc to cancel');
        }
        fpRender();
    });
})();

// ============================================================
// ROOM DRAWING LOGIC
// ============================================================

function fpHandleRoomClick(e) {
    var pt = fpMouseToFeet(e);

    if (!fpDrawing) {
        // Start a new room
        fpDrawing    = true;
        fpDrawPoints = [pt];
        fpSetStatus('Corner placed at (' + pt.x.toFixed(1) + ', ' + pt.y.toFixed(1) +
            ' ft).  Click to add corners.  Double-click to finish.');
        fpRender();
        return;
    }

    // Check if click is near the first point → close the shape
    var first = fpDrawPoints[0];
    var dx = (pt.x - first.x) * fpPixPerFoot;
    var dy = (pt.y - first.y) * fpPixPerFoot;
    if (fpDrawPoints.length >= 3 && Math.abs(dx) < FP_CLOSE_PX && Math.abs(dy) < FP_CLOSE_PX) {
        fpFinishRoom(null);  // close back to first point
        return;
    }

    // Add constrained corner
    var constrained = fpConstrainToAxis(pt, fpDrawPoints[fpDrawPoints.length - 1]);
    fpDrawPoints.push(constrained);
    fpRender();
}

/**
 * Finish drawing the room.  dblClickPt is the raw (snapped) position of the
 * double-click; null means the user clicked near the first point to close.
 */
function fpFinishRoom(dblClickPt) {
    fpDrawing      = false;
    fpPreviewPoint = null;

    var pts = fpDrawPoints.slice();
    fpDrawPoints = [];

    // --- Rectangle shortcut ---
    // If only 1 segment has been drawn (2 points) and we have a double-click position,
    // auto-complete the 4 corners of a rectangle.
    if (pts.length === 2 && dblClickPt) {
        var A = pts[0], B = pts[1];
        if (A.y === B.y) {
            // Horizontal first segment → use dblClickPt.y for the other dimension
            pts.push({ x: B.x, y: dblClickPt.y });
            pts.push({ x: A.x, y: dblClickPt.y });
        } else {
            // Vertical first segment → use dblClickPt.x
            pts.push({ x: dblClickPt.x, y: B.y });
            pts.push({ x: dblClickPt.x, y: A.y });
        }
    }

    if (pts.length < 3) {
        alert('Need at least 3 corners to close a room. Keep clicking to place more corners.');
        fpRender();
        return;
    }

    // Ensure shape closes with right angles:
    // If the last point and the first point are not on the same axis, add a bridging corner.
    var last  = pts[pts.length - 1];
    var first = pts[0];
    if (last.x !== first.x && last.y !== first.y) {
        pts.push({ x: first.x, y: last.y });
    }

    // Pick next color
    var color = FP_ROOM_COLORS[(fpPlan.rooms || []).length % FP_ROOM_COLORS.length];

    // Open the room-link modal
    fpOpenRoomLinkModal(pts, color);
    fpRender();
}

// ============================================================
// ROOM LINK MODAL  (link shape → Room record, or create new)
// ============================================================

function fpOpenRoomLinkModal(points, color) {
    var select = document.getElementById('fpRoomLinkSelect');
    select.innerHTML = '<option value="">— Create a new room —</option>';

    // Only offer rooms not already on this floor plan
    var usedIds = (fpPlan.rooms || []).map(function(r) { return r.roomId; });
    fpRoomList.forEach(function(room) {
        if (!usedIds.includes(room.id)) {
            var opt = document.createElement('option');
            opt.value = room.id;
            opt.textContent = room.name;
            select.appendChild(opt);
        }
    });

    var modal = document.getElementById('fpRoomLinkModal');
    modal.dataset.pendingPoints = JSON.stringify(points);
    modal.dataset.pendingColor  = color;

    document.getElementById('fpRoomLinkNewName').value = '';
    var newGroup = document.getElementById('fpRoomLinkNewNameGroup');
    newGroup.style.display = select.value === '' ? '' : 'none';

    select.onchange = function() {
        newGroup.style.display = select.value === '' ? '' : 'none';
    };

    openModal('fpRoomLinkModal');
}

document.getElementById('fpRoomLinkSaveBtn').addEventListener('click', function() {
    var modal   = document.getElementById('fpRoomLinkModal');
    var points  = JSON.parse(modal.dataset.pendingPoints || '[]');
    var color   = modal.dataset.pendingColor || FP_ROOM_COLORS[0];
    var select  = document.getElementById('fpRoomLinkSelect');
    var newName = document.getElementById('fpRoomLinkNewName').value.trim();

    if (!select.value && !newName) {
        alert('Please enter a name for the new room, or pick an existing one.');
        return;
    }

    function addShape(roomId, roomLabel) {
        var shape = {
            id:     fpGenId(),
            roomId: roomId,
            label:  roomLabel,
            points: points,
            color:  color
        };
        if (!fpPlan.rooms) fpPlan.rooms = [];
        fpPlan.rooms.push(shape);
        fpDirty = true;
        fpSelectedId = shape.id;
        closeModal('fpRoomLinkModal');
        fpRender();
        fpSetStatus('Room "' + roomLabel + '" placed.  Select it to edit corners or navigate to the room.');
    }

    if (select.value) {
        // Link to existing room
        var existing = fpRoomList.find(function(r) { return r.id === select.value; });
        addShape(select.value, existing ? existing.name : 'Room');
    } else {
        // Create a new room record in Firestore, then link
        db.collection('rooms').add({
            name:      newName,
            floorId:   fpFloorId,
            type:      'standard',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function(ref) {
            fpRoomList.push({ id: ref.id, name: newName, floorId: fpFloorId });
            addShape(ref.id, newName);
        }).catch(function(err) {
            console.error('Error creating room:', err);
            alert('Failed to create room: ' + err.message);
        });
    }
});

document.getElementById('fpRoomLinkCancelBtn').addEventListener('click', function() {
    closeModal('fpRoomLinkModal');
});

// ============================================================
// SHAPE SELECTION
// ============================================================

function fpSelectShape(shapeId) {
    fpSelectedId = (fpSelectedId === shapeId) ? null : shapeId;
    fpRender();
    if (fpSelectedId) {
        var room = (fpPlan.rooms || []).find(function(r) { return r.id === fpSelectedId; });
        fpSetStatus('"' + (room ? room.label : 'Room') + '" selected.  ' +
            'Edit corners/color with Edit.  Double-click to go to room page.  ' +
            'Delete key or Remove button to remove from floor plan.  Esc to deselect.');
    } else {
        fpSetStatus('Ready.');
    }
}

// ============================================================
// ROOM EDIT MODAL  (label, color, corner positions)
// ============================================================

function fpOpenRoomEditModal() {
    if (!fpSelectedId) return;
    var room = (fpPlan.rooms || []).find(function(r) { return r.id === fpSelectedId; });
    if (!room) return;

    document.getElementById('fpRoomEditLabel').value = room.label || '';
    document.getElementById('fpRoomEditColor').value = room.color || FP_ROOM_COLORS[0];

    // Build corner table rows
    var tbody = document.getElementById('fpRoomEditCornersBody');
    tbody.innerHTML = '';
    (room.points || []).forEach(function(p, i) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td>Corner ' + (i + 1) + '</td>' +
            '<td><input type="number" step="0.5" class="fp-corner-x" data-idx="' + i + '" value="' + p.x + '" style="width:70px"> ft</td>' +
            '<td><input type="number" step="0.5" class="fp-corner-y" data-idx="' + i + '" value="' + p.y + '" style="width:70px"> ft</td>';
        tbody.appendChild(tr);
    });

    document.getElementById('fpRoomEditModal').dataset.editId = fpSelectedId;
    openModal('fpRoomEditModal');
}

document.getElementById('fpRoomEditSaveBtn').addEventListener('click', function() {
    var shapeId = document.getElementById('fpRoomEditModal').dataset.editId;
    var room    = (fpPlan.rooms || []).find(function(r) { return r.id === shapeId; });
    if (!room) { closeModal('fpRoomEditModal'); return; }

    room.label = document.getElementById('fpRoomEditLabel').value.trim() || room.label;
    room.color = document.getElementById('fpRoomEditColor').value;

    document.querySelectorAll('.fp-corner-x').forEach(function(inp) {
        var i = parseInt(inp.dataset.idx, 10);
        if (room.points[i]) room.points[i].x = parseFloat(inp.value) || room.points[i].x;
    });
    document.querySelectorAll('.fp-corner-y').forEach(function(inp) {
        var i = parseInt(inp.dataset.idx, 10);
        if (room.points[i]) room.points[i].y = parseFloat(inp.value) || room.points[i].y;
    });

    fpDirty = true;
    closeModal('fpRoomEditModal');
    fpRender();
});

document.getElementById('fpRoomEditCancelBtn').addEventListener('click', function() {
    closeModal('fpRoomEditModal');
});

// ============================================================
// DELETE SELECTED ROOM SHAPE
// ============================================================

function fpDeleteSelected() {
    if (!fpSelectedId) return;
    var room = (fpPlan.rooms || []).find(function(r) { return r.id === fpSelectedId; });
    var name = room ? '"' + room.label + '"' : 'this room';
    if (!confirm('Remove ' + name + ' from the floor plan?\n(The room record in the database is NOT deleted — only the drawing is removed.)')) return;

    fpPlan.rooms   = (fpPlan.rooms   || []).filter(function(r) { return r.id !== fpSelectedId; });
    // Remove doors/windows associated with this room shape
    fpPlan.doors   = (fpPlan.doors   || []).filter(function(d) { return d.roomId !== fpSelectedId; });
    fpPlan.windows = (fpPlan.windows || []).filter(function(w) { return w.roomId !== fpSelectedId; });

    fpSelectedId = null;
    fpDirty = true;
    fpRender();
    fpSetStatus('Room removed from floor plan.');
}

// ============================================================
// DOOR & WINDOW PLACEMENT
// ============================================================

/**
 * Determine which wall segment of a room was clicked, then open the
 * appropriate modal to configure the door or window.
 */
function fpPlaceMarkerOnWall(e, room, markerType) {
    var pt = fpMouseToFeet(e);

    var bestSeg  = null;
    var bestDist = Infinity;
    var bestT    = 0;

    (room.points || []).forEach(function(_, i) {
        var seg = fpGetSegment(room.points, i);
        var r   = fpPtToSegDist(pt, seg);
        if (r.dist < bestDist) {
            bestDist = r.dist;
            bestSeg  = i;
            var segLen = fpSegLength(seg);
            bestT = r.t * segLen;
        }
    });

    // Must click within 2 feet of a wall
    if (bestSeg === null || bestDist > 2) {
        fpSetStatus('Click closer to a wall edge to place a ' + markerType + '.');
        return;
    }

    if (markerType === 'door') {
        var dModal = document.getElementById('fpDoorModal');
        dModal.dataset.roomId     = room.id;
        dModal.dataset.segIndex   = bestSeg;
        dModal.dataset.position   = bestT.toFixed(3);
        document.getElementById('fpDoorWidthInput').value = 3;
        document.getElementById('fpDoorSwingSelect').value = 'inward-left';
        openModal('fpDoorModal');
    } else {
        var wModal = document.getElementById('fpWindowModal');
        wModal.dataset.roomId   = room.id;
        wModal.dataset.segIndex = bestSeg;
        wModal.dataset.position = bestT.toFixed(3);
        document.getElementById('fpWindowWidthInput').value = 3;
        openModal('fpWindowModal');
    }
}

document.getElementById('fpDoorSaveBtn').addEventListener('click', function() {
    var m = document.getElementById('fpDoorModal');
    var swing = document.getElementById('fpDoorSwingSelect').value;
    var door = {
        id:           fpGenId(),
        roomId:       m.dataset.roomId,
        segmentIndex: parseInt(m.dataset.segIndex, 10),
        position:     parseFloat(m.dataset.position),
        width:        parseFloat(document.getElementById('fpDoorWidthInput').value) || 3,
        swingInward:  swing.startsWith('inward'),
        swingLeft:    swing.endsWith('left')
    };
    if (!fpPlan.doors) fpPlan.doors = [];
    fpPlan.doors.push(door);
    fpDirty = true;
    closeModal('fpDoorModal');
    fpRender();
    fpSetStatus('Door placed.  Switch to Select tool to navigate or select rooms.');
});

document.getElementById('fpDoorCancelBtn').addEventListener('click', function() {
    closeModal('fpDoorModal');
});

document.getElementById('fpWindowSaveBtn').addEventListener('click', function() {
    var m = document.getElementById('fpWindowModal');
    var win = {
        id:           fpGenId(),
        roomId:       m.dataset.roomId,
        segmentIndex: parseInt(m.dataset.segIndex, 10),
        position:     parseFloat(m.dataset.position),
        width:        parseFloat(document.getElementById('fpWindowWidthInput').value) || 3
    };
    if (!fpPlan.windows) fpPlan.windows = [];
    fpPlan.windows.push(win);
    fpDirty = true;
    closeModal('fpWindowModal');
    fpRender();
    fpSetStatus('Window placed.');
});

document.getElementById('fpWindowCancelBtn').addEventListener('click', function() {
    closeModal('fpWindowModal');
});

// ============================================================
// DIMENSIONS MODAL
// ============================================================

document.getElementById('fpSetDimensionsBtn').addEventListener('click', function() {
    if (fpPlan) {
        document.getElementById('fpWidthInput').value  = fpPlan.widthFt;
        document.getElementById('fpHeightInput').value = fpPlan.heightFt;
    }
    openModal('fpDimensionsModal');
});

document.getElementById('fpDimensionsSaveBtn').addEventListener('click', function() {
    var w = parseFloat(document.getElementById('fpWidthInput').value);
    var h = parseFloat(document.getElementById('fpHeightInput').value);
    if (!w || !h || w <= 0 || h <= 0) {
        alert('Enter valid dimensions (positive numbers).');
        return;
    }
    if (!fpPlan) fpPlan = { rooms: [], doors: [], windows: [] };
    fpPlan.widthFt  = w;
    fpPlan.heightFt = h;
    fpDirty = true;
    closeModal('fpDimensionsModal');
    fpInitSvg();
    fpRender();
    fpSetStatus('Canvas resized to ' + w + ' × ' + h + ' ft.');
});

document.getElementById('fpDimensionsCancelBtn').addEventListener('click', function() {
    closeModal('fpDimensionsModal');
    if (fpPlan) { fpInitSvg(); fpRender(); }
});

// ============================================================
// TOOL SELECTION
// ============================================================

['fpToolSelect', 'fpToolRoom', 'fpToolDoor', 'fpToolWindow'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', function() { fpSetTool(btn.dataset.tool); });
});

function fpSetTool(tool) {
    fpActiveTool = tool;
    // Cancel any in-progress drawing
    if (tool !== 'room') {
        fpDrawing      = false;
        fpDrawPoints   = [];
        fpPreviewPoint = null;
    }

    // Update button active states
    ['fpToolSelect', 'fpToolRoom', 'fpToolDoor', 'fpToolWindow'].forEach(function(id) {
        var btn = document.getElementById(id);
        if (btn) btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    var svg = document.getElementById('fpSvg');
    svg.style.cursor = (tool === 'select') ? 'default' : 'crosshair';

    var hints = {
        select:  'Click a room to select it.  Double-click to go to the room page.  Drag corner handles to reshape.',
        room:    'Click to place corners.  Segments auto-snap to horizontal/vertical.  Double-click to finish.',
        door:    'Click on any wall edge to place a door.',
        window:  'Click on any wall edge to place a window.'
    };
    fpSetStatus(hints[tool] || '');
    fpRender();
}

// ============================================================
// TOOLBAR BUTTONS
// ============================================================

document.getElementById('fpGridToggle').addEventListener('change', function() {
    fpRender();
});

document.getElementById('fpEditRoomBtn').addEventListener('click', function() {
    fpOpenRoomEditModal();
});

document.getElementById('fpDeleteRoomBtn').addEventListener('click', function() {
    fpDeleteSelected();
});

document.getElementById('fpSaveBtn').addEventListener('click', function() {
    fpSave();
});

// ============================================================
// SAVE TO FIRESTORE
// ============================================================

function fpSave() {
    if (!fpFloorId || !fpPlan) return;
    var btn = document.getElementById('fpSaveBtn');
    btn.textContent = 'Saving…';
    btn.disabled    = true;

    db.collection('floorPlans').doc(fpFloorId).set({
        widthFt:   fpPlan.widthFt,
        heightFt:  fpPlan.heightFt,
        rooms:     fpPlan.rooms   || [],
        doors:     fpPlan.doors   || [],
        windows:   fpPlan.windows || [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(function() {
        fpDirty         = false;
        btn.textContent = 'Saved ✓';
        setTimeout(function() { btn.textContent = 'Save'; btn.disabled = false; }, 1800);
        fpSetStatus('Floor plan saved.');
    })
    .catch(function(err) {
        console.error('fpSave error:', err);
        btn.textContent = 'Save';
        btn.disabled    = false;
        alert('Save failed: ' + err.message);
    });
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', function(e) {
    if (!window.location.hash.startsWith('#floorplan/')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.key === 'Escape') {
        if (fpDrawing) {
            fpDrawing      = false;
            fpDrawPoints   = [];
            fpPreviewPoint = null;
            fpSetStatus('Drawing cancelled.  Press Esc again to deselect.');
            fpRender();
        } else {
            fpSelectedId = null;
            fpRender();
            fpSetStatus('Deselected.');
        }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && fpSelectedId) {
        e.preventDefault();
        fpDeleteSelected();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        fpSave();
    }
});

// ============================================================
// THUMBNAIL  — render a small read-only floor plan preview
// Called from house.js renderFloorDetail
// ============================================================

/**
 * Load the floorPlans document for a floor and render a small SVG thumbnail
 * inside the given container element.
 *
 * @param {string}   floorId      - Firestore floor ID
 * @param {string}   containerId  - ID of the wrapper div
 * @param {string}   emptyId      - ID of the empty-state <p>
 */
function fpLoadAndRenderThumbnail(floorId, containerId, emptyId) {
    var container = document.getElementById(containerId);
    var emptyEl   = document.getElementById(emptyId);
    if (!container) return;

    db.collection('floorPlans').doc(floorId).get()
        .then(function(doc) {
            if (!doc.exists || !(doc.data().rooms || []).length) {
                if (emptyEl) emptyEl.style.display = '';
                return;
            }
            if (emptyEl) emptyEl.style.display = 'none';

            var plan = doc.data();
            var thumbW = Math.min(container.clientWidth || 400, 500);
            var scale  = Math.min(thumbW / plan.widthFt, 150 / plan.heightFt, 8);
            var svgW   = Math.round(plan.widthFt  * scale);
            var svgH   = Math.round(plan.heightFt * scale);

            // Build inline SVG
            var ns  = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('width',   svgW);
            svg.setAttribute('height',  svgH);
            svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);
            svg.setAttribute('class',   'fp-thumbnail-svg');

            // Background
            var bg = document.createElementNS(ns, 'rect');
            bg.setAttribute('x', 0); bg.setAttribute('y', 0);
            bg.setAttribute('width', svgW); bg.setAttribute('height', svgH);
            bg.setAttribute('fill', '#f0f0f0'); bg.setAttribute('stroke', '#888');
            bg.setAttribute('stroke-width', 1);
            svg.appendChild(bg);

            // Room shapes
            (plan.rooms || []).forEach(function(room) {
                if (!room.points || room.points.length < 3) return;
                var pts = room.points.map(function(p) {
                    return (p.x * scale) + ',' + (p.y * scale);
                }).join(' ');

                var poly = document.createElementNS(ns, 'polygon');
                poly.setAttribute('points', pts);
                poly.setAttribute('fill', room.color || '#B3D9FF');
                poly.setAttribute('fill-opacity', '0.5');
                poly.setAttribute('stroke', '#444');
                poly.setAttribute('stroke-width', 1);
                poly.style.cursor = 'pointer';
                poly.title = room.label || 'Room';
                poly.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (room.roomId) window.location.hash = '#room/' + room.roomId;
                });
                svg.appendChild(poly);

                // Label
                var c = fpCentroid(room.points);
                var txt = document.createElementNS(ns, 'text');
                txt.setAttribute('x', c.x * scale);
                txt.setAttribute('y', c.y * scale);
                txt.setAttribute('text-anchor', 'middle');
                txt.setAttribute('dominant-baseline', 'middle');
                txt.setAttribute('font-size', Math.max(6, scale * 0.55));
                txt.setAttribute('fill', '#333');
                txt.setAttribute('pointer-events', 'none');
                txt.textContent = room.label || '?';
                svg.appendChild(txt);
            });

            // Clear old content and insert
            // Keep the empty state element but hide it
            while (container.firstChild) container.removeChild(container.firstChild);
            if (emptyEl) container.appendChild(emptyEl);
            container.appendChild(svg);
        })
        .catch(function(err) {
            console.error('fpLoadAndRenderThumbnail error:', err);
        });
}

// ============================================================
// GEOMETRY & MATH HELPERS
// ============================================================

/** Convert feet to SVG pixels */
function fp2px(ft) { return ft * fpPixPerFoot; }

/** Snap a feet value to the grid (FP_SNAP_FEET increments) */
function fpSnap(ft) { return Math.round(ft / FP_SNAP_FEET) * FP_SNAP_FEET; }

/** Convert SVG mouse event coords to snapped feet */
function fpMouseToFeet(e) {
    var svg  = document.getElementById('fpSvg');
    var rect = svg.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(fpPlan.widthFt,  fpSnap((e.clientX - rect.left)  / fpPixPerFoot))),
        y: Math.max(0, Math.min(fpPlan.heightFt, fpSnap((e.clientY - rect.top)   / fpPixPerFoot)))
    };
}

/**
 * Constrain a new point so the segment from `from` is axis-aligned.
 * Whichever axis has the larger displacement wins.
 */
function fpConstrainToAxis(pt, from) {
    var dx = Math.abs(pt.x - from.x);
    var dy = Math.abs(pt.y - from.y);
    return dx >= dy
        ? { x: pt.x, y: from.y }   // horizontal
        : { x: from.x, y: pt.y };  // vertical
}

/** Centroid of a polygon (average of vertices) */
function fpCentroid(points) {
    var sx = 0, sy = 0;
    points.forEach(function(p) { sx += p.x; sy += p.y; });
    return { x: sx / points.length, y: sy / points.length };
}

/** Axis-aligned bounding box */
function fpBBox(points) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(function(p) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Area of a polygon (shoelace formula), in square feet */
function fpPolygonArea(points) {
    var n    = points.length;
    var area = 0;
    for (var i = 0; i < n; i++) {
        var j  = (i + 1) % n;
        area  += points[i].x * points[j].y;
        area  -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
}

/** Get the start/end of a wall segment (wraps around to 0) */
function fpGetSegment(points, index) {
    if (!points || index < 0 || index >= points.length) return null;
    return { start: points[index], end: points[(index + 1) % points.length] };
}

/** Length of a segment in feet */
function fpSegLength(seg) {
    var dx = seg.end.x - seg.start.x;
    var dy = seg.end.y - seg.start.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Distance from point pt to segment seg.
 * Returns {dist, t} where t is [0,1] along the segment.
 */
function fpPtToSegDist(pt, seg) {
    var dx = seg.end.x - seg.start.x;
    var dy = seg.end.y - seg.start.y;
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) {
        return { dist: Math.hypot(pt.x - seg.start.x, pt.y - seg.start.y), t: 0 };
    }
    var t  = ((pt.x - seg.start.x) * dx + (pt.y - seg.start.y) * dy) / len2;
    t      = Math.max(0, Math.min(1, t));
    var qx = seg.start.x + t * dx;
    var qy = seg.start.y + t * dy;
    return { dist: Math.hypot(pt.x - qx, pt.y - qy), t: t };
}

/**
 * Pre-compute wall metrics for door/window rendering (pixel coords).
 * Returns {hinge, openEnd, nx, ny} where nx,ny is the unit normal.
 */
function fpWallMetrics(seg, positionFt, widthFt) {
    var dx  = seg.end.x - seg.start.x;
    var dy  = seg.end.y - seg.start.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;

    var ux = dx / len;  // unit vector along wall
    var uy = dy / len;

    var pos = Math.min(positionFt, len - widthFt);
    if (pos < 0) pos = 0;

    return {
        hinge:   { x: fp2px(seg.start.x + ux * pos),          y: fp2px(seg.start.y + uy * pos) },
        openEnd: { x: fp2px(seg.start.x + ux * (pos + widthFt)), y: fp2px(seg.start.y + uy * (pos + widthFt)) },
        nx: -uy,   // perpendicular (left-hand normal)
        ny:  ux
    };
}

/** Generate a short random shape ID */
function fpGenId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Set the status bar text */
function fpSetStatus(msg) {
    var el = document.getElementById('fpStatus');
    if (el) el.textContent = msg;
}

// ============================================================
// SVG ELEMENT FACTORY HELPERS
// ============================================================

/** Create an SVG element with given attributes, append to parent, return it */
function fpSvgEl(parent, tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function(k) {
        el.setAttribute(k, attrs[k]);
    });
    parent.appendChild(el);
    return el;
}

/** Create a <g> group, append to parent, return it */
function fpSvgG(parent, className) {
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (className) g.setAttribute('class', className);
    parent.appendChild(g);
    return g;
}
