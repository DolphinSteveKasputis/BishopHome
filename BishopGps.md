# Bishop GPS Mapping Feature — Planning Notes

## Concept
Add GPS-based perimeter walking to create 2D maps of yard zones.
User presses Start on phone, walks the boundary of an area, presses Stop,
names the shape, and saves it. Multiple shapes can be layered to form a
complete visual map of the yard with zones outlined.

---

## Feasibility
**Yes — this is doable from a phone browser.** The Web Geolocation API
(`navigator.geolocation.watchPosition`) is supported on iOS Safari, Android
Chrome, and most modern mobile browsers. GitHub Pages serves over HTTPS,
which is required for geolocation to work. ✅

---

## Decisions Log

### Map Background
- Use a real map/satellite background via **Leaflet.js + OpenStreetMap** (free, no API key)
- A **toggle** lets user show/hide the map underneath the shapes
- Design accounts for Leaflet from the start (not bolted on later)
- Toggle button: "Show Map" / "Hide Map" on the GPS map view page

### Zone Integration
- GPS shapes are **always tied to a zone** — no standalone shapes
- One shape per zone (a zone has one boundary map)
- Works at all levels: Back Yard has its own shape, Behind Garage has its own, etc.
- On the zone detail page: if a shape is linked, show a small inline map preview
- On the GPS map page: all shapes shown together, toggle per shape on/off
- From zone page: "Record Shape" or "Edit Shape" button

### Square Footage
- Calculate and display area in **square feet** (primary) and **acres** (secondary)
- Use the Shoelace formula adjusted for lat/lng coordinates (accounts for Earth curvature)
- Displayed on: shape detail, zone detail page (if linked), and the map page shape list

### Map Overlay Style
- **Option 1 — Simple Overlay** (chosen)
- Each zone shape is its own semi-transparent colored polygon drawn on top of others
- Sub-zones are drawn on top of parent zones — overlap is visible but readable
- More forgiving of GPS imprecision at boundaries than a cut-out approach
- Future: Option 2 (cut-into/donut style) can be added later if desired

### Shape Colors
- Auto-assigned from a predefined palette on creation
- Future: allow user to manually pick/change the color per shape
- Design must store color in Firestore and support changing it (field is always present)

### GPS Jump Handling — Two-Layer Approach
**Layer 1 — Auto-filter during recording (silent):**
- Reject points with reported accuracy worse than 20 meters
- Reject points that jump > 15m from previous point in < 2 seconds
- Handles most noise without user involvement

**Layer 2 — Visual point editor (after recording and any time later):**
- See below in Point Editor section

---

## Point / Shape Editor

The editor is used both immediately after recording and when editing a saved shape later.
Works on phone (touch drag) and on PC (mouse drag) — same code, both work well.
PC with a larger monitor is the recommended way to do precise fine-tuning.

### Features
| Feature | Complexity | Notes |
|---|---|---|
| Drag a point to move it | Moderate | Circular handle at each vertex, drag updates shape live |
| Tap/click a point to delete it | Easy | Shows delete button in a small popup |
| Show segment length on click | Moderate | Click/tap a side to see length in feet in an info box |
| Live length update while dragging | Easy (same math) | Adjacent segment lengths update in real-time as you drag |
| Auto-Simplify button | Easy | Runs Ramer-Douglas-Peucker (built into Leaflet) — removes redundant middle points while preserving shape. Turns a 10-point straight fence line into 2 points instantly. |
| Add a new point on a segment | Future | Click the midpoint of a side to insert a new draggable point |

### Workflow
1. After recording (or tapping "Edit Shape" on a saved shape), shape opens in editor
2. "Simplify" button available at top — good first step after a walk
3. Each vertex shown as a draggable circle handle
4. Tap/click a vertex: popup shows "Delete Point" + lengths of adjacent sides in feet
5. Tap/click a segment (line between two points): shows length of that side in feet
6. Drag any vertex: adjacent segment lengths update live in the info area
7. "Done" saves changes back to Firestore

---

## Feature Scope

### GPS Map Page (accessed from within a zone)
- Accessed via "Map" or "Shape" button on zone detail page
- Shows this zone's shape (if recorded) on the map
- "Record New Shape" button (if no shape yet)
- "Edit Shape" button (if shape exists)
- "View Yard Map" button — shows ALL shapes across all zones layered together
  with per-shape toggle on/off and the map background toggle

### Recording Flow
1. Press "Record New Shape" from zone detail page
2. Brief instruction screen: "Walk the perimeter of the area. Press Start when ready."
3. Press Start → GPS activates, points begin recording
4. Live feedback: point count, approximate distance walked, GPS accuracy indicator
5. Press Stop → recording ends, auto-filter runs silently
6. Shape opens directly in the point editor for immediate review/cleanup
7. "Simplify" available as first step
8. Press "Save" → stored in Firestore, linked to the zone

### Zone Detail Page Changes
- New "Shape" section showing:
  - Small inline map preview of the shape (if recorded)
  - Square footage and acreage
  - "Record Shape" or "Edit Shape" button

---

## Technical Approach

### Libraries
- **Leaflet.js** (free, open source) for all map display and interaction
- **OpenStreetMap** tiles (free, no API key needed)
- Ramer-Douglas-Peucker simplification via `L.LineUtil.simplify()` (built into Leaflet)
- Haversine formula for distance calculations (simple math, no library needed)
- No Google Maps, no paid services

### GPS Recording
- `navigator.geolocation.watchPosition()` with `enableHighAccuracy: true`
- Filter: skip points with `accuracy > 20` meters
- Filter: skip points that jump > 15m from previous in < 2 seconds
- Record approximately every 2 seconds or 2 meters of movement

### Area Calculation
- Shoelace formula on lat/lng coordinates with Earth-radius correction
- Output: square feet (primary), acres (secondary, shown for areas > 1000 sq ft)

### Data Storage — Firestore collection: `gpsShapes`
| Field | Type | Description |
|---|---|---|
| zoneId | string | Zone this shape belongs to (always required) |
| name | string | Pulled from zone name, editable |
| points | array of {lat, lng} | Ordered perimeter points |
| areaSqft | number | Calculated square footage |
| color | string | Hex color for map display (auto-assigned, user-changeable later) |
| createdAt | timestamp | |
| updatedAt | timestamp | Set on every edit |

---

## Open Questions
*(to be resolved during build)*

1. **Color palette**: What colors to use for auto-assignment?
   Suggestion: green, blue, orange, purple, red, teal, brown, pink — cycle through them
2. **"View Yard Map" placement**: Button on zone page, or a top-level nav item?
   Currently leaning toward a button on the Home (Zones list) page since it spans all zones.

---

## Build Phases (tentative)
- **Phase A**: Recording flow — walk, auto-filter, save shape linked to zone
- **Phase B**: Leaflet map display on zone page (shape preview + square footage)
- **Phase C**: Point editor — drag, delete, segment length display, Simplify button
- **Phase D**: "View Yard Map" — all shapes layered, per-shape toggles, map background toggle
- **Phase E**: Color picker per shape

