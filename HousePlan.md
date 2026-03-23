# Bishop — Home/Interior Feature Plan

## Concept
Add a "House" section alongside the existing "Yard" section. The Yard tracks outdoor zones
and plants. The House tracks the interior — floors and rooms — with the same full feature
set: activities, photos, facts, problems/concerns, projects, and calendar events.
Data at the room level rolls up to the floor level, which rolls up to the house level,
mirroring how plants roll up to zones in the yard.

---

## Navigation
- The main Bishop nav gets a top-level **"House"** link
  - "Home" is avoided because it already informally means "the app's main screen"
  - "House" is unambiguous and matches the physical concept
- Clicking it goes to a new `#house` page
- The two sides of the app are peers: **Yard** (outdoor) and **House** (indoor)
- The sticky header shows "Bishop › First Floor" (or room name) when drilled in,
  same as it does for yard zones today

---

## Hierarchy

```
House  (top level — the whole house)
  ├── Circuit Breaker Panel  (house-level resource — see Electrical section)
  └── Floor  (e.g., Basement, First Floor, Second Floor, Attic)
        └── Room  (e.g., Kitchen, Master Bedroom, Hall Bath, Hallway, Stairs)
              ├── Thing  (furniture/appliances: Bed, Couch, Refrigerator, Dresser)
              ├── Ceiling Fixture  (ceiling fan, ceiling light — full tracked Thing)
              ├── Wall Marker — Electrical  (outlet, switch — lightweight with properties)
              └── Wall/Floor Marker — Plumbing  (sink, toilet, tub — lightweight with properties)
```

- **Things** are full tracked items: facts, problems, projects, activities, photos, calendar events
- **Ceiling Fixtures** are Things with a special category and a position on the floor plan
- **Wall/Floor Markers** (electrical + plumbing) are lightweight — properties + problem logging only
- Floors and rooms aggregate/roll up all content from below

---

## Floors

- User-defined name (e.g., "First Floor", "Basement", "Attic")
- **Floor number** — a numeric field (e.g., -1 for basement, 1, 2, 3) used for sorting
  and display. Shown alongside the name: "First Floor (1)" or just used for ordering.
  Basement = 0 or -1, Main = 1, Second = 2, etc. — user decides the numbers.
- Ordered by floor number for display (lowest to highest, or user preference)
- A floor can have its own directly attached facts, problems, projects, activities,
  photos, and calendar events — plus rolled-up views from all rooms and things beneath it
- Has a **floor plan** (see Floor Plan section below)

---

## Rooms

- Belong to exactly one floor
- User-defined name (Kitchen, Living Room, Master Bedroom, Hall Bath, Garage, etc.)
- Can be moved to a different floor
- Have the full feature set (facts, problems, projects, activities, photos, calendar events)
- Contain **Things**, **Ceiling Fixtures**, **Electrical markers**, and **Plumbing markers**
- Linked to a shape on the floor plan (clicking the shape navigates to the room)
- **Dimensions shown at the top of the room detail page** — calculated automatically from
  the floor plan shape (e.g., "Approx. 12 × 14 ft · 168 sq ft"). For irregular shapes,
  shows the bounding box dimensions + actual square footage. Only shown if the room has
  been drawn on the floor plan.
- **Hallways** are rooms — named "Hallway", "Upstairs Hall", etc. Full feature set applies.
- **Stairs** are rooms with a special type flag — see Stairs section below.

---

## Things (Furniture, Appliances & Ceiling Fixtures)

Things are the House equivalent of Plants in the Yard — individual physical items
with their own record, history, and photos. There are two sub-types:

### Sub-type 1: General Things (furniture, appliances, electronics)
- Any physical item in a room: furniture, appliances, electronics, art, etc.
- Examples: Bed, Couch, Dining Table, Refrigerator, Washer, Dresser, TV
- Each is an **individual instance** — 2 nightstands = 2 separate Thing records
- Belongs to one room, can be moved to another

### Sub-type 2: Ceiling Fixtures (ceiling fans, ceiling lights)
- Ceiling-mounted items that also appear as a **symbol on the floor plan**
- Full feature set same as general Things
- Examples: "Master Bedroom Ceiling Fan", "Kitchen Recessed Light 1"
- **Floor plan symbol**: placed inside the room shape at an (x, y) position
  - Ceiling fan symbol: circle with 3–4 blade lines radiating out
  - Ceiling light symbol: circle with short rays (or filled circle for recessed)
- Clicking the symbol on the floor plan navigates to the Thing's detail page
- Multiple ceiling fixtures can exist in one room (e.g., 6 recessed lights)

### What All Things Have
- **Name** — e.g., "King Bed", "Samsung Refrigerator", "Master Bedroom Ceiling Fan"
- **Category** — Furniture / Appliance / Ceiling Fan / Ceiling Light / Electronics / Other
- **Facts** — key/value pairs:
  - Purchase date, purchase price, brand, model, serial number
  - Warranty expiration, dimensions, color, wattage, CFM (for fans), etc.
- **Photos** — document the item, capture damage, record model/serial label
- **Activity History** — "Cleaned", "Replaced bulb", "Repaired", "Warranty claim"
- **Problems / Concerns** — "Making noise", "Not working", "Stain on cushion"
- **Projects** — "Reupholster", "Replace with smart fan", "Find replacement part"
- **Calendar Events** — "Warranty expires", "Annual cleaning"

### Things Roll Up
- Room detail shows all its Things (general + ceiling fixtures)
- Floor detail shows rolled-up Things from all rooms on that floor
- House page shows a count/summary across everything

---

## Electrical — Wall Markers (Outlets & Switches)

Electrical outlets and switches are **lightweight wall markers** — placed on a wall
segment on the floor plan with a small set of properties. They are NOT full Things
(no activity history, no projects) but DO support problem logging since an outlet
or switch can break and need repair.

### Outlets
- **Floor plan symbol**: small circle on the wall with two short parallel lines
  (standard US architectural outlet symbol)
- **Properties**:
  - Type: Standard / GFCI / 220V / USB / Combination
  - Circuit breaker number (links to the breaker panel — see below)
  - Notes (free-form)
- **Problems / Concerns**: e.g., "Not working", "Sparking", "Loose plug"
- **Future**: tie to specific breaker in the circuit breaker panel view

### Switches
- **Floor plan symbol**: small "S" in a rectangle on the wall
- **Properties**:
  - Type: Single-pole / 3-way / Dimmer / Smart
  - Circuit breaker number
  - What it controls (free-form — e.g., "Controls ceiling fan")
  - Notes
- **Problems / Concerns**: e.g., "Not working", "Flickering", "Switch feels loose"

### Electrical Roll-Up
- Room detail page shows a list of all outlets and switches in the room
- Open problems on outlets/switches roll up to floor and house level

---

## Plumbing — Wall & Floor Markers

Plumbing fixtures are tracked like electrical — lightweight markers placed on the
floor plan with properties and problem logging. Some fixtures (water heater,
washer/dryer) may also be full Things if more detailed tracking is needed.

### Plumbing Fixture Types & Symbols
| Fixture | Symbol | Placement |
|---|---|---|
| Toilet | Oval with rounded rectangle (tank) | Floor (inside room) |
| Sink / Vanity | Small rectangle | Wall |
| Bathtub | Large rectangle with rounded short ends | Floor area |
| Shower | Square with diagonal corner lines | Floor area |
| Floor drain | Small circle with X | Floor |
| Water heater | Circle | Floor (inside room) |
| Washer / Dryer hookup | Rectangle with W or D | Wall |

### Properties (all plumbing fixtures)
- Type (from list above)
- Shut-off valve location (free-form — e.g., "Under sink, right side")
- Supply line type: Copper / PEX / CPVC / Unknown (optional)
- Notes
- **Problems / Concerns**: e.g., "Slow drain", "Dripping faucet", "Valve stuck"

### Plumbing Roll-Up
- Room detail shows all plumbing fixtures in the room
- Open plumbing problems roll up to floor and house level

---

## Stairs

Stairs are a special room type — drawn on the floor plan like any other room but
with a distinct visual treatment, and they connect two floors.

### How Stairs Work
- Created as a **Room** with type = "Stairs"
- Appears on **two floors** — the same staircase shape is shown on both Floor 1 and Floor 2
- **Floor plan symbol**: the room shape is filled with diagonal parallel lines (standard
  stair hatch pattern) and labeled "Stairs to 2nd Floor" / "Stairs to Basement", etc.
- Clicking a stairs shape on a floor plan shows a "Go to [Floor Name]" navigation link
- Full feature set applies (log "Replaced stair tread", add photos, log "Loose handrail")

### Stairs Properties
- Connects from floor / to floor (links the two floor records)
- Direction label: "Up to 2nd Floor" / "Down to Basement"

---

## Circuit Breaker Panel

A house-level resource accessible from the House home page — not tied to a specific room
(though the physical panel lives in one, like a basement or garage).

### Panel Layout Editor
- User defines the panel as a **grid of rows and columns** matching their actual box
  (e.g., 2 columns × 20 rows = 40 slots; 2 columns × 15 rows = 30 slots)
- Visual layout mirrors the physical panel cover — numbered top to bottom,
  left column first (standard US: 1, 3, 5... on left; 2, 4, 6... on right)
- **Double-pole breakers** (240V) can be marked to span two slots

### Each Breaker Slot Has
- **Number** — auto-assigned by position
- **Label** — what it controls (e.g., "Kitchen outlets", "HVAC", "Washer")
- **Amperage** — 15A / 20A / 30A / 50A / other
- **Type** — Single-pole / Double-pole / AFCI / GFCI / Main
- **Status** — Normal / Tripped / Off
- **Notes** — free-form
- **Problems / Concerns** — e.g., "Trips frequently", "Runs hot"

### Panel Visual
- Grid matching the physical panel door layout
- Each slot shows: breaker number + label + amperage
- Color-coded by status (normal = white, tripped = red/orange, off = gray)
- Click any breaker → view/edit label, amperage, notes, problems

### Circuit Linkage (Future Phase)
- Outlets, switches, ceiling fixtures, and plumbing fixtures can each be tagged
  with a breaker number
- Future view: click a breaker → see all fixtures on that circuit across all rooms
- Not in the initial build — planned for a later phase

---

## Floor Plan

A visual drawing tool for laying out each floor — where rooms, hallways, doors, and
windows are positioned relative to each other. Not GPS-based; entirely user-drawn on
a computer using a mouse. Real tape-measure dimensions are entered for accuracy.

### Design Decisions — RESOLVED ✅

| Question | Decision |
|---|---|
| Precision | Real measurements — user uses a tape measure and enters exact ft/in |
| Device | Computer (mouse) — no phone/touch drawing needed |
| Room shapes | Rectilinear polygons — all angles are 90°, but rooms can be L-shaped, T-shaped, U-shaped, etc. |
| Hallways | Treated as rooms (named "Hallway") — same as any other room |
| Doors | Yes — placed on walls at exact positions, with swing direction |
| Windows | Yes — placed on walls at exact positions, with width |
| Outlets | Yes — wall markers with type, breaker number, notes, problem logging |
| Switches | Yes — wall markers with type, what it controls, breaker number |
| Ceiling fixtures | Yes — inside the room shape, linked to a Thing record (ceiling fan / ceiling light) |
| Plumbing | Yes — wall/floor markers with type, shut-off valve info, problem logging |
| Stairs | Yes — special room type with stair hatch pattern, connects two floors |
| Room linkage | Yes — each room shape links to its Room record; clicking it navigates to the Room detail page |
| House page display | All floor plans shown as thumbnails on the House home page; click a floor plan → floor detail; click a room shape → room detail |

---

### Canvas & Scale

- User enters the **overall floor dimensions** (e.g., 40 ft × 28 ft) to set the canvas scale
- Canvas scales to fill the available screen width; 1 foot = a fixed number of pixels
- A **grid overlay** (toggleable) shows 1-foot increments — helps with alignment
- **Snap-to-grid**: drawn elements snap to the nearest foot (or 6-inch increment)
- **Snap-to-wall**: when dragging a room near another room's edge, it snaps flush
  (shared walls line up perfectly)
- Zoom in/out for detailed work in tight areas

---

### Drawing Rooms

All rooms are **rectilinear polygons** — every corner is exactly 90°, but rooms can be
any shape made of right angles: simple rectangles, L-shapes, T-shapes, U-shapes, etc.

**Drawing tool — constrained polygon:**
1. Select the **"Add Room"** tool
2. Click to place the first corner of the room
3. Move the mouse — the next segment **automatically snaps to horizontal or vertical**
   (whichever direction you move more). You cannot accidentally draw a diagonal.
4. Click to place each subsequent corner
5. **Double-click** (or click back on the starting point) to close the shape
6. A dialog appears:
   - **Link to Room record**: pick from existing rooms on this floor, or create a new one
   - **Adjust corner positions**: each corner shown as an (x, y) coordinate in feet;
     user can type exact values to lock in precise measurements
   - **Color**: auto-assigned from a palette, user can change
7. Room is drawn with its name label centered inside

**Simple rectangle shortcut:**
- Click corner 1, move right/down, double-click corner 2 → rectangle auto-completed
  (the tool infers the other two corners)

**Editing a room:**
- Click a room to select it, then:
  - **Drag** the whole room to move it
  - **Drag individual corner handles** to reshape
  - **Double-click** to edit name, adjust corner positions, color, or room link
  - **Delete key** or delete button to remove from the floor plan
    (does not delete the Room record — only removes it from the drawing)

**Stored as a polygon** (array of {x, y} points in feet), not as width/height —
this naturally handles rectangles and irregular shapes with the same data structure.

---

### Drawing Doors

Doors are placed on the wall of a room (an edge of a rectangle). Standard
architectural symbol: a gap in the wall with a quarter-circle arc showing the swing.

1. Select the **"Add Door"** tool
2. Click on any wall edge of a drawn room
3. A dialog appears:
   - **Width**: default 3 ft, adjustable
   - **Position**: exact distance from the nearest corner (e.g., "2 ft from left corner")
   - **Swing direction**: which way the door opens (4 options: inward left/right, outward left/right)
   - **Door type**: standard swing (default) — future: pocket, barn, double
4. Door is rendered as:
   - A gap in the wall line (the opening)
   - A thin quarter-circle arc showing the swing radius
   - A short line representing the door panel
5. Doors can be selected, repositioned along the wall, or deleted
6. A door shared between two rooms (e.g., between kitchen and hallway) is placed on
   one room's wall — it visually appears at the boundary between both

---

### Drawing Windows

Windows are placed on a wall edge, similar to doors but without a swing arc.
Standard symbol: a double line across the wall thickness.

1. Select the **"Add Window"** tool
2. Click on any wall edge of a drawn room
3. A dialog appears:
   - **Width**: default 3 ft, adjustable
   - **Position**: distance from the nearest corner
4. Window is rendered as a double line (or filled rectangle) across that section of wall
5. Windows can be selected, repositioned, or deleted

---

### Floor Plan — Viewing & Navigation

**On the Floor Detail page:**
- Full interactive floor plan with all tools available
- Read-only view shown by default; "Edit Floor Plan" button to enter drawing mode

**On the House Home page:**
- All floors shown as **thumbnail previews** (read-only, scaled to fit a card)
- Clicking a thumbnail navigates to that floor's detail page
- Clicking a **room shape** on any thumbnail navigates directly to that Room's detail page
- Floor plans are displayed in floor-number order (basement first, then 1, 2, etc.)

---

### Technical Approach

- **SVG** rendered in the browser — best for crisp lines at any zoom level, and
  easy to make elements clickable (each room, door, window is its own SVG element)
- No external library needed — plain SVG with JavaScript event handling
- Scale calculation: `pixelsPerFoot = canvasWidthPx / floorWidthFt`
- All coordinates stored in **real feet** (not pixels) — display scales on render

**Firestore: `floorPlans` collection**

One document per floor:

```
floorPlans/{floorId}
  widthFt:   number         // overall floor width
  heightFt:  number         // overall floor height
  rooms: [                  // array of room shapes (rectilinear polygons)
    {
      id:       string      // local shape ID
      roomId:   string      // links to rooms/{roomId} Firestore doc
      label:    string      // room name (copied for display)
      points:   [{x, y}]   // corners in feet from origin, in order
                            // all angles guaranteed 90° by the drawing tool
      color:    string      // hex color
    }
  ]
  doors: [
    {
      id:           string
      roomId:       string  // which room's wall this door is on
      segmentIndex: number  // which wall segment (index into room.points pairs)
      position:     number  // feet from the start of that segment
      width:        number  // in feet (default 3)
      swingInward:  boolean
      swingLeft:    boolean
    }
  ]
  windows: [
    {
      id:           string
      roomId:       string
      segmentIndex: number  // which wall segment
      position:     number  // feet from the start of that segment
      width:        number  // in feet (default 3)
    }
  ]
  updatedAt: timestamp
```

---

## Feature Set — What Rooms, Floors, and Things Have

Every feature that exists for zones and plants in the Yard is available for
Rooms, Floors, and Things in the House.

### Facts
- Key/value pairs (e.g., "Square footage: 220", "Paint color: SW Alabaster",
  "Flooring: Hardwood", "Last painted: 2021", "Serial number: XYZ123")
- Add, edit, delete
- URL values are clickable links (same as yard)

### Problems / Concerns
- Free-form: description, date logged, status (open/resolved), notes
- Examples: "Water stain on ceiling", "Outlet not working", "Drawer stuck"
- Add, edit, delete, mark resolved

### Projects
- Title, notes, optional checklist
- Examples: "Repaint master bedroom", "Replace kitchen faucet", "Reupholster couch"
- Add, edit, delete, check off items

### Activity History
- Logged events: what was done, when, free-form notes, optional product used
- Saved Actions reusable here (same chemicals/products list as yard)
- Displayed chronologically, newest first

### Photos
- Compressed client-side (~100-200KB), stored as Base64 in Firestore
- Gallery viewer: newest-first, Newer/Older, caption editing, delete
- Use cases: before/after, damage documentation, model labels, room states

### Calendar Events
- Same calendar system as yard — one-time or recurring
- Linked to a room, floor, or thing
- Show on the main Calendar page with context label (room/floor name)
- Examples: "HVAC filter replacement", "Warranty expires — Samsung fridge"

---

## Roll-Up Behavior

| Level | Sees |
|---|---|
| Thing detail | That thing's own facts, problems, projects, activities, photos, calendar events |
| Room detail | Room's own items + all Things in the room (rolled up) |
| Floor detail | Floor's own items + all Rooms + all Things on that floor (rolled up) |
| House page | Summary across all floors, rooms, and things |

### Roll-up in practice:
- **Activity feed on a floor**: floor-level + all room-level + all thing-level activities, sorted by date
- **Open problems on a floor**: all open problems from floor, its rooms, and their things
- **Photos on a floor**: all photos from floor, rooms, and things — newest first
- **Calendar**: events from any level appear on the main calendar with context label

---

## Data Model

### New Firestore Collections

#### `floors`
| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "First Floor" |
| floorNumber | number | e.g., -1, 0, 1, 2, 3 — used for sort order |
| createdAt | timestamp | |

#### `rooms`
| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Kitchen" |
| floorId | string | Reference to parent floor |
| createdAt | timestamp | |

#### `things`
| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "King Bed" |
| category | string | Furniture / Appliance / Fixture / Electronics / Other |
| roomId | string | Reference to parent room |
| createdAt | timestamp | |

#### `floorPlans` *(tentative — pending floor plan design decisions)*
| Field | Type | Notes |
|---|---|---|
| floorId | string | Which floor this plan belongs to |
| widthFt | number | Overall floor width in feet |
| heightFt | number | Overall floor height in feet |
| shapes | array | Each shape: `{ label, type, x, y, width, height, color, roomId? }` |
| updatedAt | timestamp | |

### Existing Collections — Extended targetType Values

| New targetType | Attaches to |
|---|---|
| `'room'` | A room document |
| `'floor'` | A floor document |
| `'thing'` | A thing document |

No schema changes to existing collections — just new `targetType` values.

---

## Page Structure

### `#house` — House Home Page
- Header: "My House"
- List of floors sorted by floor number, each showing room count + open problem count
- "Add Floor" button
- Quick summary: total open problems, upcoming calendar events across the house

### `#floor/{floorId}` — Floor Detail Page
- Floor name, floor number, edit/delete controls
- Floor plan thumbnail (if drawn) with link to full floor plan editor
- Rooms list for this floor
- "Add Room" button
- Sections: Facts · Problems · Projects · Activities · Photos
- Rolled-up section: "All Activity on This Floor" (floor + rooms + things combined)

### `#room/{roomId}` — Room Detail Page
- Room name, floor context, edit/delete/move controls
- Things list for this room ("Add Thing" button)
- Sections: Facts · Problems · Projects · Activities · Photos

### `#thing/{thingId}` — Thing Detail Page
- Thing name, category, room context, edit/delete/move controls
- Sections: Facts · Problems · Projects · Activities · Photos · Calendar Events

### `#floorplan/{floorId}` — Floor Plan Editor
- Full-screen canvas with the floor plan drawing tool
- Back button to floor detail page

---

## Parallel to Yard — Complete Feature Mapping

| Yard Concept | House Equivalent |
|---|---|
| Yard home page (`#home`) | House home page (`#house`) |
| Level-1 Zone (e.g., Front Yard) | Floor |
| Level-2/3 Zone (sub-zone) | *(not needed — 2 levels is enough)* |
| Plant (individual instance) | Thing (individual item in a room) |
| Zone facts / problems / projects | Floor + Room facts / problems / projects |
| Plant facts / problems / projects | Thing facts / problems / projects |
| Zone/Plant activities | Floor / Room / Thing activities |
| Zone/Plant photos | Floor / Room / Thing photos |
| Zone/Plant calendar events | Floor / Room / Thing calendar events |
| GPS shape / yard map | Floor plan (drawn canvas, not GPS) |
| "View All Plants" in a zone | Rolled-up Things list on floor or house page |

---

## What's Explicitly Out of Scope (for now)
- GPS mapping for rooms (floor plan is drawn, not GPS-traced)
- Sub-items below Things
- Chemicals/products list — shared with yard (same list used indoors and out)
- Saved Actions — shared with yard (reuse templates across both sides of app)

---

## ⚠️ Yard Screens — DO NOT MODIFY

**All work on the House feature must be strictly additive. The existing yard screens
(Home/Zones, Weeds, Calendar, Chemicals, Actions, Settings, GPS map, Yard map) are
considered complete and must not be changed in any way.**

- Do NOT modify `js/zones.js`, `js/plants.js`, `js/activities.js`, `js/chemicals.js`,
  `js/weeds.js`, `js/calendar.js`, `js/photos.js`, `js/problems.js`, `js/facts.js`,
  `js/projects.js`, or `js/gps.js`
- Do NOT modify existing sections in `index.html` (only ADD new sections)
- Do NOT change any existing CSS classes or rules (only ADD new rules)
- Do NOT change existing routes in `app.js` (only ADD new routes)
- The only allowed changes to `app.js` are adding new page names to `ALL_PAGES` and
  adding new route handlers to `handleRoute()`
- The only allowed changes to `index.html` nav are adding the new "House" nav link

---

## Open Questions

All questions resolved. ✅ See Decisions Log below.

---

## Build Phases

### Phase H1 — Nav + House Home Page + Floor CRUD
*Goal: Get the House section scaffolded and floors manageable. No rooms or things yet.*

**Files touched (additions only — no modifications to existing yard files):**
- `index.html` — add House nav link (desktop + mobile), add `page-house` section, add floor modals
- `js/app.js` — add `'house'` and `'floor'` to `ALL_PAGES`; add `#house` and `#floor/{id}` route handlers; add `'house'` to nav page mapping
- `js/house.js` — NEW FILE: all house/floor logic

**What gets built:**
- "House" nav link appears in the top nav bar (desktop) and mobile nav drawer, after "Settings" or after "Home" — between yard and settings
- Clicking "House" routes to `#house`
- **`#house` page**: header "My House", list of floors sorted by floor number, "Add Floor" button
- **`#floor/{floorId}` page**: floor name + number displayed, "Edit" / "Delete" buttons, placeholder sections for rooms (Phase H2), breadcrumb shows "House › Floor Name"
- **Floor CRUD**:
  - Add floor: name + floor number field (numeric, e.g., 1, 2, -1), saved to Firestore `floors` collection
  - Edit floor: change name or floor number
  - Delete floor: confirmation prompt; blocked if floor has rooms (Phase H2 adds that guard)
  - Floor list sorted by floor number ascending
- **Firestore**: new `floors` collection (`name`, `floorNumber`, `createdAt`)
- **Routing**: `#house` → `loadHousePage()`; `#floor/{id}` → `loadFloorDetail(id)`
- **Breadcrumb / header**: same pattern as yard zones — sticky header shows "Bishop › [Floor Name]" when on a floor detail page
- **Cache-bust**: bump `?v=N` on all script + CSS tags

---

### Phase H2 — Room CRUD
*Goal: Add rooms to floors. Rooms get their own detail page. Hallways and stairs are just rooms.*

**Files touched:**
- `index.html` — add `page-room` section, add room modals
- `js/app.js` — add `'room'` to `ALL_PAGES`; add `#room/{id}` route handler
- `js/house.js` — add room CRUD functions

**What gets built:**
- Floor detail page shows a Rooms list with "Add Room" button
- **Room CRUD**: name, optional room type (Standard / Hallway / Stairs — stored but not enforced specially until Phase H11)
- Move room to a different floor
- Delete room: confirmation; blocked if room has things (Phase H3 adds that guard)
- **`#room/{roomId}` page**: room name, floor context (breadcrumb shows "House › Floor › Room"), edit/delete/move controls, placeholder sections for things (Phase H3) and features (Phase H5)
- **Firestore**: new `rooms` collection (`name`, `floorId`, `type`, `createdAt`)
- **Breadcrumb**: "House › [Floor Name] › [Room Name]"

---

### Phase H3 — Thing CRUD
*Goal: Add things (furniture, appliances, ceiling fixtures) to rooms.*

**Files touched:**
- `index.html` — add `page-thing` section, add thing modals
- `js/app.js` — add `'thing'` to `ALL_PAGES`; add `#thing/{id}` route handler
- `js/house.js` — add thing CRUD functions

**What gets built:**
- Room detail page shows a Things list with "Add Thing" button
- **Thing CRUD**: name, category (Furniture / Appliance / Ceiling Fan / Ceiling Light / Electronics / Other)
- Move thing to a different room
- Delete thing: confirmation
- **`#thing/{thingId}` page**: thing name, category badge, room/floor context, edit/delete/move controls, placeholder sections for features (Phase H4)
- **Firestore**: new `things` collection (`name`, `category`, `roomId`, `createdAt`)
- **Breadcrumb**: "House › [Floor] › [Room] › [Thing]"

---

### Phase H4 — Full Feature Set on Things
*Goal: Things get the same feature treatment as Plants.*

**Files touched:**
- `index.html` — add feature sections inside `page-thing`
- `js/house.js` — wire up facts, problems, projects, activities, photos, calendar events to `targetType: 'thing'`

**What gets built:**
- Facts, Problems, Projects, Activities, Photos, Calendar Events sections on the Thing detail page
- Reuses all existing feature modules (facts.js, problems.js, projects.js, activities.js, photos.js, calendar.js) via `targetType: 'thing'` / `targetId`
- No changes to those modules — they already support arbitrary targetType values

---

### Phase H5 — Full Feature Set on Rooms + Floors
*Goal: Rooms and floors also get the full feature set, plus rolled-up views.*

**Files touched:**
- `index.html` — add feature sections inside `page-floor` and `page-room`
- `js/house.js` — wire up features to rooms/floors; implement roll-up queries

**What gets built:**
- Facts, Problems, Projects, Activities, Photos sections on Room and Floor detail pages
- Roll-up section on Room: "All Items in This Room" (room-level + all things)
- Roll-up section on Floor: "All Items on This Floor" (floor-level + all rooms + all things)
- targetType `'room'` and `'floor'` used throughout

---

### Phase H6 — House Summary Page
*Goal: The `#house` page becomes a useful dashboard.*

**What gets built:**
- Count of open problems across all floors/rooms/things
- Count of upcoming calendar events (next 30 days) linked to house items
- Quick navigation to any floor
- All floor plans (once drawn in H8) shown as thumbnails

---

### Phase H7 — Calendar Integration
*Goal: Events on rooms/floors/things show on the main Calendar page.*

**Files touched:**
- `js/calendar.js` — extend calendar to show house-context events with a label

**What gets built:**
- Calendar events with `targetType: 'thing'|'room'|'floor'` appear on the main calendar
- Context label shows "House › Floor › Room" next to the event title
- No other changes to the calendar

---

### Phase H8 — Floor Plan Editor (Canvas + Rooms + Doors + Windows)
*Goal: Draw the floor layout — rooms as rectilinear polygons, with doors and windows.*

**Files touched:**
- `index.html` — add `page-floorplan` section
- `js/app.js` — add `'floorplan'` route
- `js/floorplan.js` — NEW FILE: SVG floor plan editor

**What gets built:**
- Full SVG canvas with rectilinear polygon drawing tool (auto-snaps to H/V)
- Grid overlay (1-ft increments), snap-to-grid, snap-to-wall
- Room shapes linked to Room records; click navigates to room
- Doors and windows placed on wall segments
- Floor plan saves to `floorPlans` Firestore collection
- Thumbnails of floor plans shown on floor detail + house home pages
- **Firestore**: new `floorPlans` collection (see data model above)

---

### Phase H9 — Floor Plan: Electrical + Plumbing Markers
*Goal: Place outlet, switch, and plumbing markers on the floor plan.*

**What gets built:**
- Outlet markers (wall symbol), switch markers (wall symbol), plumbing markers (floor/wall)
- Each marker has properties (type, circuit number, notes) + problem logging
- Markers stored in the `floorPlans` document (inside arrays)

---

### Phase H10 — Floor Plan: Ceiling Fixture Markers
*Goal: Place ceiling fans and ceiling lights inside room shapes, linked to Thing records.*

**What gets built:**
- Ceiling fixture symbols (fan blades / light rays) inside room shapes
- Clicking a symbol navigates to the linked Thing's detail page
- Position stored in the `floorPlans` document

---

### Phase H11 — Floor Plan: Stairs Visual
*Goal: Stairs rooms get the hatch pattern and floor-to-floor navigation link.*

**What gets built:**
- Stairs room type gets diagonal hatch fill in the floor plan
- Label shows "Stairs to [Floor Name]"
- Clicking the shape shows "Go to [Floor Name]" navigation link

---

### Phase H12 — Circuit Breaker Panel
*Goal: Model the physical circuit breaker panel.*

**What gets built:**
- House home page: "Circuit Breaker Panel" section link
- Panel layout editor: define rows × columns matching physical panel
- Each breaker slot: number, label, amperage, type, status, notes, problems
- Visual grid matches physical panel layout (odd on left, even on right)
- Color-coded by status (normal / tripped / off)
- **Firestore**: new `breakerPanel` collection or house-level document

---

### Phase H13 — Circuit Linkage
*Goal: Connect outlets/switches/fixtures to specific breakers.*

**What gets built:**
- Each outlet, switch, and ceiling fixture can be tagged with a breaker number
- Panel view: click any breaker → see all tagged fixtures on that circuit
- Cross-reference list: "Everything on Circuit 12"

---

## Decisions Log
- **2026-03-22**: Initial plan created
- **2026-03-22**: Full feature set confirmed — all 6 yard features apply to floors, rooms, and things
- **2026-03-22**: Roll-up confirmed — thing → room → floor → house
- **2026-03-22**: "House" chosen as nav label
- **2026-03-22**: Things confirmed as the plants equivalent — individual physical items in rooms
- **2026-03-22**: Floors get a numeric `floorNumber` field for sorting and identification
- **2026-03-22**: Floor plan design fully resolved — SVG canvas, rectilinear polygon rooms (all right angles, can be L/T/U-shaped), real measurements, constrained drawing tool (auto-snaps to H/V), doors + windows on wall segments, room shapes link to Room records, all floor plans shown as thumbnails on House home page
- **2026-03-22**: Electrical markers added — outlets (Option A with properties + problem logging) and switches, both placed on walls
- **2026-03-22**: Ceiling fixtures (fans + lights) are full Things with floor plan symbol inside room shape
- **2026-03-22**: Plumbing tracked same as electrical — lightweight wall/floor markers with properties + problem logging
- **2026-03-22**: Stairs are a special room type — full feature set, stair hatch visual, connects two floors
- **2026-03-22**: Circuit breaker panel is a house-level resource — grid layout editor, per-breaker labels/amperage/status/problems; circuit linkage to fixtures is a future phase
- **2026-03-22**: Room dimensions auto-calculated from floor plan shape, shown at top of room detail page
