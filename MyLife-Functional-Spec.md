# MyLife (Bishop) — Functional Specification

> **Purpose**: This document is the source of truth for the MyLife/Bishop application. It is written for developers, AI coding assistants, and power users. Each major section describes what a feature does and how it works. Shared features (photos, facts, activities, etc.) are described in depth in [Part 11: Shared Features](#part-11-shared-features) — individual sections above reference them and only expand on nuances.

---

## Table of Contents

1. [Architecture & Infrastructure](#part-1-architecture--infrastructure)
2. [Yard](#part-2-yard)
3. [House](#part-3-house)
4. [Garage](#part-4-garage)
5. [Structures](#part-5-structures)
6. [Vehicles](#part-6-vehicles)
7. [Collections](#part-7-collections)
8. [Life](#part-8-life)
9. [Places & Check-In](#part-9-places--check-in)
10. [AI / LLM Features](#part-10-ai--llm-features)
11. [Shared Features](#part-11-shared-features)
12. [Navigation & Routing](#part-12-navigation--routing)
13. [Testing](#part-13-testing)
14. [Deployment](#part-14-deployment)
15. [Firestore Data Model](#part-15-firestore-data-model)

---

## Part 1: Architecture & Infrastructure

### Firebase Project
- **Project ID**: `bishop-62d43`
- **Plan**: Spark (free tier) — no Firebase Storage, no Blaze upgrade required
- **Auth**: Firebase Auth, email/password only
- **Database**: Firestore in native mode
- **No server**: Static site + Firestore — zero backend cost

### Per-User Data Scoping
All Firestore reads and writes go through the `userCol(collectionName)` helper defined in `firebase-config.js`. It scopes all data under `/users/{uid}/{collection}`, so every user has a completely separate data namespace. **All JS modules use `userCol()` exclusively — no flat root-level collections exist.**

```js
// firebase-config.js
function userCol(collectionName) {
    return db.collection('users').doc(currentUid).collection(collectionName);
}
```

### Authentication (`auth.js`)
- Firebase Auth email/password
- On load: checks `auth.onAuthStateChanged` — if logged in, shows app; if not, shows login screen
- Login screen is a full-page overlay rendered before any app content
- `#changepassword` route allows password update
- No multi-user sharing or role-based access currently

### Routing (`app.js`)
- **Hash-based SPA routing**: All navigation uses `window.location.hash` (e.g., `#zone/abc123`, `#plant/xyz`)
- `hashchange` event triggers the router, which reads the hash and calls the appropriate load function
- 40+ unique routes across yard, house, life, and shared pages
- **No page reloads** — all navigation is client-side

### Modal System (`zones.js`)
- `openModal(id)` — shows a `<dialog>` or overlay div, calls `history.pushState({modal: id}, '')`
- `closeModal(id)` — hides the modal, calls `history.back()` asynchronously
- **Critical pattern**: Navigation after `closeModal()` must be wrapped in `setTimeout(..., 50)` to let `history.back()` resolve before a new hash is set, or the navigation will be lost
- `dataset.mode` and `dataset.editId` on modals distinguish add vs. edit

### Global State
Key entities being viewed are stored on `window` for cross-module access:
- `window.currentZone`, `window.currentPlant`, `window.currentWeed`, `window.currentChemical`
- `window.currentThing`, `window.currentSubThing`, `window.currentItem`
- `window.currentRoom`, `window.currentFloor`
- `window.currentVehicle`, `window.currentCollection`, `window.currentCollectionItem`
- `window.currentPerson`, `window.currentNotebook`
- `window.currentPlace`

### Stale Event Listener Pattern
Many modals and buttons are re-wired every time a page loads. To avoid accumulating duplicate listeners, the pattern is:
```js
var newBtn = btn.cloneNode(true);
btn.parentNode.replaceChild(newBtn, btn);
newBtn.addEventListener('click', handler);
```

### Cache Busting
All `<script>` and `<link>` tags in `index.html` have a `?v=N` version query string. When any JS or CSS file is changed, **all tags must be bumped** to the same new version number. The CSS `<link>` tag is easy to forget — it must also be bumped.

- Current pattern: `<script src="js/app.js?v=316"></script>`
- CSS: `<link rel="stylesheet" href="css/styles.css?v=316">`

### LLM Configuration (`settings.js`)
- Stored in `userCol('settings').doc('llm')` — behind auth, not in localStorage
- Fields: `provider` (openai / xai), `apiKey`, `model` (optional override)
- Default models: `gpt-4o-mini` (OpenAI), `grok-3` (xAI)
- Both use the OpenAI-compatible API format (`/v1/chat/completions`)

---

## Part 2: Yard

**Plan document**: `plan.md`

The Yard section tracks outdoor spaces, plants, weeds, chemicals, and maintenance activities. It is the original core of the app.

### Zones (`zones.js`)
Zones are the organizational backbone of the yard. They form a hierarchy up to 3 levels deep.

**Firestore**: `zones` — `name`, `parentId`, `level` (1/2/3), `createdAt`

**Routes**: `#home` (root zone list), `#zone/{id}` (zone detail)

**Hierarchy**:
- Level 1: Major zones (e.g., "Front Yard", "Back Yard", "Creek")
- Level 2: Sub-zones (e.g., "By Mailbox", "Behind Garage")
- Level 3: Detail zones (e.g., "Left Flower Bed")

**Features on each zone**:
- Child zones (add/edit/delete — deleting a zone with children is blocked)
- Plants in zone (list with "View All Plants" option — see Plants)
- [Shared] Facts, Problems, Projects, Activities, Photos, Calendar Events

**Edit/Delete modal**: The zone detail page has an Edit button that opens a modal pre-filled with the zone name. The Delete button is inside this edit modal (not on the detail page directly) — it appears only in edit mode, not when adding a new zone.

**Zone reassignment**: Plants and sub-zones can be moved to a different parent zone via a modal picker that shows the full hierarchy with indentation.

### Plants (`plants.js`)
Each plant is an individual physical instance — 3 azalea bushes = 3 records. Plants are tied to a single zone.

**Firestore**: `plants` — `name`, `zoneId`, `metadata{}`, `profilePhotoData?`, `createdAt`

**Metadata fields**: `heatTolerance`, `coldTolerance`, `sunShade`, `wateringNeeds`, `bloomMonth`, `dormantMonth` (all optional, set via dropdowns/pickers)

**Routes**: `#plant/{id}` (detail page)

**View All Plants**: From any zone, "View All Plants" shows a flat list of every plant in that zone and all sub-zones beneath it. Clicking a plant navigates to its detail page.

**Zone reassignment**: Modal picker with full zone hierarchy to move a plant.

**[Shared]**: Facts, Problems, Projects, Activities, Photos, Calendar Events — all available on plant detail.

### Weeds (`weeds.js`)
Weeds are tracked by type (not by zone instance). Each weed type stores its treatment and zone assignments.

**Firestore**: `weeds` — `name`, `treatmentMethod`, `applicationTiming`, `notes`, `zoneIds[]`, `profilePhotoData?`, `createdAt`

**Routes**: `#weeds` (list), `#weed/{id}` (detail)

**Zone assignment**: Checkbox modal showing all zones with indentation. A weed type can be assigned to multiple zones.

**LLM Identification** (if LLM configured):
- User takes/uploads a photo of the weed
- Photo sent to LLM with prompt to identify name, treatment, timing, tips, and reference URL
- Result shown in a review modal (all fields editable)
- On save: creates weed record + a Fact (reference URL) + saves photo(s)
- If LLM cannot identify: shows "Could Not Identify" modal — user can still save manually

**[Shared]**: Facts, Problems, Projects, Activities, Photos, Calendar Events

### Chemicals / Products (`chemicals.js`)
A shared inventory of all chemicals, fertilizers, herbicides, and products used in the yard.

**Firestore**: `chemicals` — `name`, `notes`, `createdAt`

**Routes**: `#chemicals` (list), `#chemical/{id}` (detail)

**Used by**: Activities and Saved Actions link to chemicals via `chemicalIds[]` array. Multiple chemicals can be linked to a single activity.

**[Shared]**: Facts (URL values clickable as links), Photos

### Activities & Saved Actions (`activities.js`)
See [Shared: Activities](#activities) for the full description. Nuances in the Yard context:
- Activities can target zones, plants, or weeds (`targetType` = `zone`/`plant`/`weed`)
- Multi-chemical selection: checklist of all chemicals, any number can be linked
- Saved Actions: reusable templates to pre-fill activity description + chemical selection

### Yard "More" Section (`#home`)
The yard main page has a **More** section below the zone list containing two panel cards:
- **Open Problems** — shows count of open problems across zones, plants, and weeds; clicking navigates to `#yard-problems`
- **All Projects** — shows count of all projects across zones, plants, and weeds; clicking navigates to `#yard-projects`

### Yard Problems Page (`projects.js`)
**Route**: `#yard-problems`

Lists all open problems (`status === 'open'`) across zones, plants, and weeds. Each card shows the problem description and a location label (for plants: "Zone › Plant Name"; for zones/weeds: the entity name). Clicking navigates to the owning entity's detail page.

**Breadcrumb**: Yard › Open Problems

### Yard Projects Page (`projects.js`)
**Route**: `#yard-projects`

Lists all projects whose `targetType` is `zone`, `plant`, or `weed`. Each project card is expandable and shows its title, target entity, and checklist.

**Breadcrumb**: Yard › All Projects

### Activity Reports (`activityreport.js`)
- **Route**: `#activityreport`
- Filter activities by date range, grouped by type and target entity
- Summary view of what was done and when across the entire yard

### Bulk Activity (`bulkactivity.js`)
- **Route**: `#bulkactivity`
- Log the same activity to multiple zones or plants in one action
- Avoids repetitive data entry for tasks done across many locations (e.g., "Watered everything")

---

## Part 3: House

**Plan document**: `HousePlan.md`

The House section tracks the interior of the home using a 4-level hierarchy: Floor → Room → Thing → Sub-Thing → Item.

**House page (`#house`)** shows: summary stats bar (upcoming calendar events only), **Open Problems** single panel card (shows count; clicking navigates to `#house-problems`), Floors section (clickable cards), a static **More** section with icon cards linking to Garage (`#garage`), Vehicles (`#vehicles`), and Collections (`#collections`), an Upcoming calendar rollup, and a Breaker Panels section. Garage, Vehicles, and Collections are no longer on the main landing page — they live under House → More. Room count removed from stats bar (visible per-floor already).

**House Projects page (`#house-projects`)**: Lists all projects from floors, rooms, and things. Each card shows the project title and location path. Clicking navigates to the owning entity. Breadcrumb: House › All Projects.

**House Problems page (`#house-problems`)**: Lists all open problems from floors, rooms, and things. Each card shows the problem description and a location path (Floor › Room › Thing). Clicking a card navigates to the owning entity. Breadcrumb: House › Open Problems.

### Floors (`house.js`)
The top level of the house hierarchy.

**Firestore**: `floors` — `name`, `floorNumber`, `createdAt`

**Routes**: `#house` (floor list), `#floor/{id}` (floor detail)

**[Shared]**: Facts, Problems (roll-up from rooms/things/sub-things), Projects (roll-up), Activities, Photos, Calendar Events

### Rooms (`house.js`)
Each room belongs to one floor.

**Firestore**: `rooms` — `name`, `floorId`, `sortOrder`, `createdAt`

**Routes**: `#room/{id}` (room detail)

**Floor plan linkage**: Each room can be drawn as a polygon on the floor plan. The shape links back to the room record — clicking the shape navigates to the room detail page. Dimensions (e.g., "12 × 14 ft · 168 sq ft") are calculated from the polygon.

**Stairs**: A special room type marked as connecting two floors. Appears with a hatch pattern on the floor plan.

**[Shared]**: Facts, Problems (roll-up from things/sub-things), Projects (roll-up), Activities, Photos, Calendar Events

### Things (`house.js`)
Items of significance in a room — furniture, appliances, fixtures.

**Firestore**: `things` — `name`, `category`, `roomId`, `description`, `worth`, `notes`, `profilePhotoData?`, `createdAt`

**Routes**: `#thing/{id}` (detail)

**Categories**: Furniture, Appliance, Ceiling Fan, Ceiling Light, Electronics, Other. Category badges are color-coded and shown on the list card.

**Thumbnails**: `profilePhotoData` stored on the document; shown as a small image on the list card. Auto-set from the first photo added (LLM or manual). Can be overridden via "Use as Profile" button in the photo gallery.

**[Shared]**: Facts, Problems, Projects, Activities, Photos, Calendar Events

### Sub-Things (`house.js`)
Sub-items within a Thing — drawers in a dresser, shelves in a bookcase, compartments in a cabinet.

**Firestore**: `subThings` — `name`, `thingId`, `description`, `worth`, `notes`, `tags[]`, `profilePhotoData?`, `createdAt`

**Routes**: `#subthing/{id}` (detail)

**Tags**: Optional free-form tags for grouping/filtering (e.g., "seasonal", "office supplies").

**Thumbnails**: Same pattern as Things — auto-set on first photo, overridable.

**[Shared]**: Facts, Problems, Activities, Photos

### Items (`house.js`, `SubThingItems.md`)
The deepest level — individual items inside a Sub-Thing.

**Firestore**: `subThingItems` — `name`, `subThingId`, `description`, `worth`, `notes`, `tags[]`, `profilePhotoData?`, `createdAt`

**Routes**: `#item/{id}` (detail)

**Thumbnails**: Same pattern as Things — auto-set on first photo, overridable.

**[Shared]**: Facts, Problems, Activities, Photos

### LLM Photo Identification (House)
Things, Sub-Things, and Items can all be added via `+Photo` button:
- Opens photo staging modal
- Photo sent to LLM with a "identify this household item" prompt
- LLM returns name, description, estimated value
- Item saved immediately with photo and thumbnail auto-set
- If LLM cannot identify name: shows alert (item not saved)

### Floor Plan (`floorplan.js`)
An interactive drawing tool for each floor.

**Firestore**: `floorPlans` — `floorId`, `widthFt`, `heightFt`, `rooms[]`, `doors[]`, `windows[]`, `plumbing[]`, `ceilingFixtures[]`, `recessedLights[]`, `wallPlates[]`, `fixtures[]`, `plumbingEndpoints[]`, `updatedAt`

**Features**:
- SVG-based canvas with optional grid overlay
- Snap-to-grid in 0.25 ft (3-inch) increments; grid displays 4 tiers: 5ft dark, 1ft medium, 0.5ft light, 0.25ft very faint
- **Coords bar**: always visible above canvas (fixed height, never hidden) — shows position + segment info during draw/drag/edit; blank when idle; prevents layout jump
- The SVG cursor label also shows position + segment length (smaller, near the cursor)
- Rectilinear room polygons (all angles are 90°, but L/T/U shapes are possible)
- **Room link modal**: always does a fresh Firestore query when opened so rooms added after the page loaded appear; existing unplaced rooms listed first (pre-selected if any exist); "Create new room" option at the bottom; new-name field only shown when "Create new" is selected
- **Dimensions auto-save**: when dimensions are confirmed in the Dimensions modal, the plan is immediately saved to Firestore (no need to also click the Save button). The floor detail thumbnail shows "Floor plan dimensions set — click Edit Floor Plan to draw rooms" once saved but before any rooms are drawn.
- **Doors**: placed on room walls; frame width and inseam tracked separately; can be dragged along wall; silent-save after drag. Door `subtype` controls rendering style:
  - `single` (default): swing arc + hinge dot + jamb ticks
  - `french`: two half-width panels with separate swing arcs, center divider post, "FR" label
  - `sliding`: two overlapping panel rects side-by-side, no arc, "SL" label
  - `pocket`: dashed pocket cavity rect extending into wall, door panel line, "PK" label
- **Windows**: placed on room walls; total frame width and inseam (e.g., for blind sizing) tracked separately; can be dragged to slide along wall; silent-save after drag
- **Wall plates** (🔌 Plate tool): unified outlet+switch entity placed on room walls; 1–4 slots per plate; each slot is a switch (single-pole/3-way/dimmer/smart) or outlet (standard/GFCI/220V/USB); per-slot symbol and divider lines render on the plate; plate scales in width with slot count; can be dragged along wall; Edit Marker shows slot editor (add/remove slots, type, controls, breaker link); position-from-wall in edit modal
- **Recessed lights** (◎ Recessed tool): click inside a room to drop instantly (no modal); each light is an independent record supporting Facts, Problems, and Activities via targetType `recessedLight`; drag to reposition; Edit Marker for label, notes, and history
- **Layout Fixtures** (🛁 Fixtures flyout in Layout mode): click-to-drop toilet, sink, or tub/shower symbol inside a room; each is an independent record with orientation (0–270°), name, notes; draggable in Layout/Select mode; Edit Marker opens edit modal with name/orientation/notes/delete
- **Ceiling fixtures**: shown as symbols inside rooms; `subtype` controls appearance: `fan` (4 blades), `fan-light` (blades + center bulb), `drop-light` (pendant stub), `chandelier` (4 arms with dots), `flush-mount` (concentric rings), `generic` (8-ray starburst + bulb); backward compat: `category === 'ceiling-fan'` maps to subtype `fan`
- Stairs shown with hatch pattern and label
- **Auto-save on drag**: all marker drags (doors, windows, wall plates, recessed lights, ceiling fixtures) silently save to Firestore on mouse-up — position persists across navigation without pressing Save

**Width/position input format**: doors and windows accept feet+inches notation (`32"`, `2'8"`, `3'`) as well as decimal feet.

**Position from wall (doors, windows, wall plates)**:
- In the Edit Marker modal, a "Position on Wall" section shows the current distance from start and distance from end of the wall (in feet+inches, read-only labels)
- An editable "Position" input lets the user type an exact distance from the start or end; the radio buttons toggle which end the distance is measured from
- Saving applies the override, clamping to valid range; position section is hidden when adding a new marker

**3-Row Toolbar**:
- **Row 1 — Mode bar** (dark navy background): pill-style `Layout`, `Electrical`, and `Plumbing` buttons; active mode highlighted (blue/teal); exactly one mode active at all times; Layout is the default
- **Row 2 — Tool bar**: tools shown depend on active mode; Select always visible; Layout tools (Room, Type, Door, Window, Fixtures flyout) only in Layout mode; Electrical tools (Plate, Ceiling, Recessed) only in Electrical mode; Plumbing tools (Spigot, Stub-out) only in Plumbing mode; Dim toggle visible in Electrical and Plumbing modes
- **Row 3 — Properties bar** (amber tint): appears when an item is selected; shows item type label + action buttons (Edit Marker/Room, Edit Targets for wall plates, Remove); hidden when nothing is selected
- Switching modes clears selection, resets to Select tool, exits any drawing or target-edit session
- Layout items (rooms, doors, windows) can only be clicked/dragged in Layout mode; electrical items only in Electrical mode

**Plumbing Overlay** (Phase 2):
- Active when Plumbing mode is selected in Row 1
- **Spigot** (🔧): click inside a room to drop; renders as blue circle with nozzle stub and "SP" label
- **Stub-out** (⊕): click inside a room to drop; renders as blue circle with "C" (cold, blue), "H" (hot, red), or "C/H" (both, purple) letter; color matches water type; Edit Marker opens modal to set name/subtype/notes/delete
- Plumbing endpoints visible in all modes (not faded); draggable in Plumbing/Select mode

**Electrical Overlay**:
- Active when Electrical mode is selected in Row 1
- **Dim toggle**: checkbox in overlay Row 2; when checked (default), structural elements render at 25% opacity so electrical elements pop visually
- **Wiring lines**: when a wall plate is selected in electrical mode, dashed colored lines draw from the plate to each fixture per slot (blue, red, purple, cyan for up to 4 slots)
- **Edit Targets**: selecting a wall plate in electrical mode shows "Edit Targets" in Row 3; pressing it enters target-selection mode — recessed lights and ceiling fixtures show rings (amber ring + warm fill + center dot = linked, dashed teal ring + faint fill = available); click any fixture to toggle the link; Done or Escape exits and saves
- **3-way auto-detection**: if two or more wall plates share the same target fixture, those plates automatically display a purple "3-way" badge above the plate symbol; badge only visible in electrical mode

**Drawing — Free Draw mode**:
- Click to place corners; Enter key places a corner at the current cursor position (no need to click exactly)
- Close-shape hit radius is 20px (generous) — cursor snaps visually when near the first point
- When drawing, the coords bar shows live position and current segment length

**Drawing — Type Numbers mode** (📐 Type button in toolbar):
- Click canvas to set anchor point (snapped to grid)
- Type a command string describing wall segments, e.g. `14, R, 21, R, 14, R, 21`
  - Numbers = distance in feet (decimals OK); R/L = turn right/left 90°
  - Optional first token sets starting direction: R, L, U, D (default = Down)
- Live SVG preview updates on every keystroke; dashed line shows whether the shape closes
- Status badge: green "✓ Shape closes" or orange "⚠ Off by X.XX ft"
- Start X / Start Y inputs let you nudge the anchor position in real-time
- Save Room button creates the room polygon exactly as Free Draw mode does

**Zoom**:
- Zoom slider (25%–800%) in the toolbar header; label shows current percentage
- Mouse wheel zooms centered on cursor position
- Two-finger pinch zooms centered on midpoint between fingers
- Double-clicking the zoom label resets zoom to 100%
- Zoom resets to 100% when loading a new floor plan

**Select mode — drag and drop**:
- Drag a room polygon body to translate all corners (move the entire room)
- Drag a ceiling fixture to reposition it anywhere on the plan
- Drag a door, window, or wall plate to slide it along its current wall segment
- Tap (no drag) any marker in select mode to select it; dragging does not trigger a selection
- **Auto-select on add**: after placing a new marker (door, window, wall plate, plumbing, ceiling fixture, recessed light), the tool automatically switches to Select and the new item is pre-selected — ready to drag immediately without extra clicks

**Select mode — corner drag**:
- Drag a corner handle dot to move that corner
- Coords bar shows position + two colored wall lengths: cyan = previous wall, orange = next wall
- The two wall segments and neighboring handle dots highlight in cyan/orange during drag

**Select mode — corner edit (double-click)**:
- Double-click a corner handle → coords bar shows two editable number inputs (cyan/orange) for the two wall lengths
- Typing new lengths moves the corner while keeping neighboring walls orthogonal
- Press Enter or Escape (or click elsewhere) to exit corner edit mode

### Breaker Panel (`house.js`)
Tracks the electrical breaker panel as a grid of slots.

**Firestore**: `breakers` — per-slot records with `slotNumber`, `label`, `amperage`, `type`, `status`, `notes`

**UI**: Visual grid matching the physical panel layout; color-coded by status; add/edit each slot's label and details.

---

## Part 4: Garage

**Plan document**: `Garage.md`

The Garage section mirrors the House section structure but is separate. It pre-seeds two default garage rooms ("Garage" and "Attic") on first visit.

**Firestore collections**: `garageRooms`, `garageThings`, `garageSubThings`

**Routes**: `#garage` (room list), `#garageroom/{id}`, `#garagething/{id}`, `#garagesubthing/{id}`

**Features**: Same as House — Things, Sub-Things, and their cross-entity sections (Facts, Problems, Projects, Activities, Photos, Calendar Events). LLM photo identification also available.

---

## Part 5: Structures

**Plan document**: `YardStructures.md`

Outdoor structures separate from the main house — sheds, decks, pergolas, gazebos, pools, etc.

**Firestore collections**: `structures`, `structureThings`, `structureSubThings`

**Routes**: `#structures` (list), `#structure/{id}`, `#structurething/{id}`, `#structuresubthing/{id}`

**Features**: Full feature set — Facts, Problems (roll-up), Projects (roll-up), Activities, Photos, Calendar Events. Same hierarchy as House but without floor plans or breaker panels.

---

## Part 6: Vehicles

**Plan document**: `Vehicles.md`

Tracks vehicles with maintenance history, mileage, and documentation.

**Firestore**: `vehicles` — `year`, `make`, `model`, `trim`, `color`, `vin`, `licensePlate`, `purchaseDate`, `purchasePrice`, `notes`, `archived`, `archivedAt`, `archivedReason`, `profilePhotoData?`, `createdAt`

**Routes**: `#vehicles` (list), `#vehicle/{id}` (detail)

**Archival**: Vehicles can be marked as sold/gone with an optional reason. Archived vehicles move to a collapsed "Archived" section on the list — they are not deleted, so their full history is preserved.

**Mileage Log**:
- **Firestore**: `mileageLogs` — `vehicleId`, `date`, `mileage`, `notes`, `createdAt`
- Add odometer reading entries; displayed newest-first with delete buttons
- Can be logged via SecondBrain ("Add 35K miles to the truck")

**[Shared]**: Facts, Problems, Projects, Activities, Photos, Calendar Events

---

## Part 7: Collections

**Plan document**: `Collections.md`

Tracks physical collectible inventories. Each collection is a named list with a type; each item within it has type-specific fields.

**Firestore**:
- `collections` — `name`, `type`, `label1/2/3` (generic custom labels), `createdAt`
- `collectionItems` — `collectionId`, `name`, `typeData{}`, `acquiredDate`, `pricePaid`, `estimatedValue`, `notes`, `locationRef{}`, `profilePhotoData?`, `createdAt`

**Routes**: `#collections` (list), `#collection/{id}` (collection detail), `#collectionitem/{id}` (item detail)

### Collection Types

| Type | Type-Specific Fields | Sort Order | Filter Field |
|------|---------------------|------------|--------------|
| Comics | series, issueNumber, variant, publisher, year | Series A-Z → issue # | series |
| Records/Albums | format, artist, album, label, year | Format → artist → album | artist |
| Hats | style, color, brand, year | Name A-Z | name |
| Hat Pins | description | Name A-Z | name |
| Beanie Babies | style, year, hasTags | Name A-Z | name |
| Ceramic Stadiums | team, year | Name A-Z | name |
| Books & Magazines | type (Book/Magazine), author, publisher, year, isbn, issueDate | Name A-Z | title + author |
| Generic | label1/2/3 values (custom labels per collection) | Name A-Z | name |

### Collection List Page
- Shows all collections as cards with item count + total estimated worth
- Add Collection button

### Collection Detail Page
- Item count + total estimated worth in header
- Client-side filter bar (search field pre-labeled by type, e.g., "Filter by series…")
- Item rows with: 48×48 thumbnail (if set), name, key field (author/artist/etc.), estimated value
- Add item (manual) and `+Photo` (LLM identification) buttons

### Collection Item Detail Page
- Full type-specific fields in an info card
- Acquired date, price paid, estimated value
- Location reference (free-text, e.g., "Shelf 3, Box B")
- Photos (gallery, with thumbnail support)

### Thumbnails
- `profilePhotoData` stored on each `collectionItems` document
- Auto-set from the first photo added (LLM or manual `+Photo`)
- Multiple photos: "⭐ Use as Thumbnail" button in the photo gallery
- Shown as 48×48 image in the item list row

### LLM Identification for Collections
- User taps `+Photo` → opens photo staging modal
- Photo sent to LLM with type-specific prompt (returns JSON matching the type's schema)
- Result shown in a review modal (`collectionShowResultModal`)
- On confirm: item saved to Firestore, thumbnail auto-set, photo stored
- "Add Another" button: resets modal for next item without leaving the page
- **Race condition handling**: `loadCollectionPage()` is deferred 100ms after `collectionShowResultModal()` updates the DOM, so the re-render doesn't race with the modal update

---

## Part 8: Life

**Plan document**: `PersonalPlan.md`

The Life section covers personal tracking — journal, people, health, notes, and major life events.

### Journal (`journal.js`)
Daily entry logging with optional tracking metrics.

**Firestore**:
- `journalEntries` — `date`, `entryTime` (HH:MM), `entryText`, `mentionedPersonIds[]`, `placeIds[]`, `isCheckin` (bool), `sourceEventId?`, `createdAt`, `updatedAt`
- `journalTrackingItems` — `date`, `category`, `value`, `createdAt`
- `journalCategories` — `name`, `createdAt`
- `lifeEventLogs` — `logDate`, `logTime`, `body`, `eventId`, `mentionedPersonIds[]`, `createdAt` (mini logs from Life Calendar)

**Routes**: `#journal` (list), `#journal-entry` (add/edit), `#journal-tracking` (tracking entries), `#journal-categories` (manage categories)

**@Mentions**: Typing `@` in the entry text triggers an autocomplete dropdown of tracked people by name.

**Date range filter**: Sticky per-user preference (7/30/60/90 days or custom) saved to `userCol('settings').doc('journal')`.

**Tracking items**: Numeric values logged per category per day (e.g., weight, mood, blood pressure). A trend view shows all values for a selected category over time.

**Life Event Logs integration**: Mini log entries from Life Calendar events appear inline in the journal feed. Toggle "Show Event Notes" to show/hide them.

**Place linking**: Journal entries can be linked to one or more places (`placeIds[]`). When an entry was created via the Check-In flow (`isCheckin: true`), a check-in badge (📍 checked-in) is shown in the journal feed. The entry form shows a "Place" search field to attach a place; if none exists it auto-creates one via `placesSaveNew()`.

**Check-in flow**: The "📍 Check In" button (on the QuickLog screen and SecondBrain) opens the check-in form pre-filled with a venue. On save, it creates a journal entry with `isCheckin: true` and `placeIds: [placeId]`.

**Tab key**: In the journal entry textarea, if the @mention dropdown is open, Tab selects the first name in the list (same as clicking it) and keeps focus in the textarea. If the dropdown is not open, Tab inserts 4 spaces (handled by `_initTabIndentTextareas` in `app.js`).

**Voice-to-text** (`initVoiceToText` in `journal.js`): 🎤 Speak button uses the Web Speech API (`continuous: true`). Spoken punctuation words are converted by `applySpokenPunctuation()`. Editing commands are handled by `_applyVoiceEditCommand()` and execute on the textarea directly — they are never appended as text. Commands must be spoken as their own phrase (pause before and after): — **"new line"** → inserts `\n` — **"new paragraph"** → inserts `\n\n` — **"delete last word"** → removes the last word — **"delete last sentence"** → removes everything after the last `.` `!` or `?` (clears all if no sentence boundary found) — **"clear all"** → empties the textarea. Full punctuation command list: period, comma, question mark, exclamation point, colon, semicolon, dash, hyphen, ellipsis, dot dot dot, open/close paren.

### Contacts (`contacts.js`)

Renamed from "People". Tracks personal contacts and medical/service professionals and facilities.

**Firestore** (collection name unchanged: `people`):
- `people` — `name`, `nickname`, `category` (see below), `specialty?`, `phone`, `email`, `address`, `website?`, `facebookUrl`, `howKnown`, `notes`, `profilePhotoData?`, `parentPersonId?`, `createdAt`
- `peopleImportantDates` — `personId`, `label`, `month`, `day`, `year?`, `recurrence`, `createdAt`
- `peopleInteractions` — `personId`, `date`, `text`, `sourceType`, `createdAt`

**Contact type categories** (fixed list, stored in `category` field):
- **Personal** — family, friends (default for all legacy records)
- **Medical Professional** — shows `specialty` combo box (~35 built-in options via `<datalist>`); custom specialties typed by the user are saved to `lookups/specialties` in Firestore and appear in the list for future contacts
- **Medical Facility** — clinic, hospital, lab, pharmacy
- **Service Professional** — shows `trade` combo box (built-ins: Plumber, Electrician, HVAC, Pest Control, Handyman); custom trades saved to `lookups/serviceTrades` in Firestore and appear in future combos
- **Other**

**Routes**: `#contacts` (list), `#contact/{id}` (detail). Legacy `#people` / `#person/{id}` redirect to the new routes.

**Hierarchy**: Sub-contacts (`parentPersonId`) allow grouping (e.g., family members under a parent record). The sub-contacts section heading dynamically adapts: **"Family Members"** for Personal/other categories, **"Staff"** for Medical Facility contacts. The empty-state text also adapts accordingly.

**Contact detail sections**:
- Contact info: specialty (Medical Professional only), phone (tel: link), email (mailto: link), address (Google Maps link), website (external link), Facebook, how known, notes
- Important dates: birthdays, anniversaries — shown on contact detail and referenced in calendar
- Photos: full gallery, profile photo support
- Interactions: log of meetings/conversations
- Shared life events: Life Calendar events tagged with this contact
- Facts

**ContactPicker component** (`buildContactPicker(containerId, options)`): Reusable searchable dropdown that filters contacts by category. Used by Care Team (Phase 2), Appointments (Phase 3), and other health features. Supports inline contact creation via `allowCreate: true`. When `filterCategory` is set, queries all contacts with that category (including sub-contacts like staff under a Medical Facility) — a staff member with `category: 'Medical Professional'` will appear in the provider picker even if they have a `parentPersonId`. Supports `facilityPickerId` option: when the provider field is focused with an empty query and a facility is already selected, the dropdown immediately shows all staff sub-contacts of that facility (filtered by category) under a "Staff at [Facility]" header — single tap to select.

**List view**: Category badge with color coding (green = Personal, blue = Medical Professional, purple = Medical Facility, orange = Service Professional, grey = Other). Specialty shown as subline for Medical Professionals; address shown for Medical Facilities.

### Health (`health.js`)

**Plan document**: `HealthEnhancements.md`

A comprehensive medical tracking hub.

**My Health main page tile order** (2-column grid):
Row 1: Conditions, Concerns | Row 2: Appointments, Health Visits | Row 3: Medications, Supplements | Row 4: Blood Work, Vitals | Row 5: Insurance, Emergency Info | Row 6: Vaccinations, Allergies | Row 7: Eye / Glasses | Row 8: My Care Team (full-width)

**My Care Team** (`#health-care-team`):
- Dedicated page listing the user's medical care team
- Data: `userCol('healthCareTeam').doc('default')` — single document with `members[]` array
- Each member: `{ role (free text), providerContactId?, facilityContactId? }`
- Member cards show role, provider (tappable link → `#contact/{id}`), facility (tappable link)
- "+ Add Member" button → modal with Role input + ContactPicker for provider (Medical Professional) + ContactPicker for facility (Medical Facility)
- Both provider and facility are optional per member
- Edit / Remove per member (Remove confirms before deleting)

**Firestore collections** (all under `userCol`):

| Collection | Key Fields |
|------------|------------|
| `healthVisits` | date, type, provider (legacy), providerType (legacy), facilityContactId, providerContactId, concernIds[], conditionIds[], reason, whatWasDone, outcome, cost, notes |
| `medications` | name, dosage, purpose, prescribedBy, startDate, endDate, status (active/completed), type (Ongoing/Short-term/As-needed), concernIds[], conditionIds[] |
| `concerns` | title, bodyArea, startDate, status (open/resolved/promoted), resolvedDate, summary, promotedToConditionId, promotedDate |
| `healthConcernLogs` | concernId, date, note, painScale?, type (manual/system/visit-note), visitId? |
| `conditions` | name, category, diagnosedDate, diagnosedBy, status (active/managed/resolved), managementNotes |
| `healthConditionLogs` | conditionId, date, note, painScale, type (manual/system/visit-note), visitId (optional), createdAt |
| `bloodWork` | date, lab, orderedBy, notes, markers[] (name/value/unit/referenceRange/flagged) |
| `vitals` | date, time, type (BP/HR/O2/Glucose/Temp/Other), value1, value2, unit, notes |
| `supplements` | name, dosage, brand, reason, frequency, startDate, endDate, status (active/stopped) |
| `vaccinations` | name, date, dateApproximate, provider, lotNumber, nextDueDate |
| `eyePrescriptions` | date, type (Distance/Reading), rightEye{}, leftEye{}, pd, provider |
| `insurance` | provider, policyNumber, groupNumber, memberId, copay, deductible, photoDocuments[] |
| `emergencyInfo` | emergencyContacts[], allergies[], medicalAdvances, dnr, notes |
| `healthAppointments` | date, time, type, facilityContactId, providerContactId, concernIds[], conditionIds[], notes, status (scheduled/completed/cancelled/converted), linkedVisitId |

**Appointments** (`#health-appointments`): List page shows Overdue / Upcoming / Past sections. Each card shows: type badge, date/time (tappable — opens edit modal, same as Edit button), Facility (tappable link to `#contact/{id}` if contactId set), Provider (tappable link or plain text), concern/condition chips, notes. Actions: Edit (hidden on converted), ✓ Mark Done (scheduled/overdue only), View Visit link (if linkedVisitId set). **Delete and Cancel Appointment are in the edit modal** (not the card). Edit modal bottom row: left side has Delete (always shown when editing) + Cancel Appt (shown only for active appointments — not cancelled/completed/converted); right side has Close + Save. "Cancel Appt" saves current notes field + sets `status: 'cancelled'` in one step, then closes modal. Add/Edit modal: date, time, type dropdown (Dr. Visit / Specialist / Follow-up / Physical or Annual / Urgent Care / Emergency / Dental / Eye Exam / Lab or Test / Procedure), status, Facility ContactPicker (Medical Facility, allowCreate), Provider ContactPicker (Medical Professional, allowCreate, optional), scrollable concern/condition checkbox list (open concerns + active/managed conditions), notes. Mark Done → opens `apptConvertModal` to create a Health Visit; on save sets `status: 'converted'` and `linkedVisitId`. Converted appointments show no Edit button and a "View Visit" link.

**Health Visits** (`#health-visits`, `#health-visit/{id}`): List page shows visits in reverse-chronological order grouped by year. Each card shows: date, provider (resolved via contactMap: `providerContactId` → contact name, then `providerText`, then legacy `provider`), type badge. Visit detail page header shows "[Type] — [formatted date]" (falls back to "Visit — [date]" if no type). Detail rows: Facility (tappable link to `#contact/{id}` if `facilityContactId` set, or plain text from `facilityText`, hidden if neither set), Provider (tappable link or plain text, falls back to `providerText` then legacy `provider` field), Provider Type, Reason for Visit, What Was Done, Outcome/Next Steps, Cost, Notes. **"Visit Notes"** section (hidden when none): loads `concernUpdates` + `healthConditionLogs` where `visitId == visit.id`, renders each as "⚠️/📋 Name — note text" — view-only. "This visit covered" section: tappable concern chips (→ `#health-concern/{id}`) and condition chips (→ `#health-condition/{id}`) from `concernIds[]` / `conditionIds[]`; section hidden if both arrays empty. **"Notes & Meds ›"** button in the "This visit covered" header navigates to `#health-visit-step2/{id}` — accessible any time (not only immediately after Mark Done). **Edit visit modal**: provider pre-fills from `providerText` (falling back to legacy `provider`); concern/condition field is a multi-select checkbox list (open concerns + active/managed conditions) replacing the old single-select dropdown; saves to `providerText`, `concernIds[]`, `conditionIds[]`. Provider Type dropdown removed from the modal — when `providerContactId` is set, the detail page auto-pulls `specialty` from the contact record instead.

**Concern Detail** (`#health-concern/{id}`): Collapsible-section layout. Summary card at top shows: title, status badge (Open/Resolved/Promoted), body area, since date, summary text, resolved date (if resolved), Edit + Mark Resolved/Reopen buttons. Collapsed section headers show a muted count badge, e.g. "Medications (2)", so the user knows records exist without expanding. Six collapsible sections — **Journal Updates** (starts expanded; all others start collapsed): — chronological log entries (date, pain scale, note); entries from a visit show a clickable **"Visit ›"** chip next to the date — clicking navigates to `#health-visit-step2/{visitId}` where notes can be reviewed/updated; Add Entry button opens `concernUpdateModal`; **Linked Medications** — medications whose `concernIds[]` includes this concern's id; shows name + dosage, Unlink button; "Link Medications" button opens `medPickerModal`; **Appointments & Visits** — appointments from `appointments` where `concernIds array-contains` + visits from `healthVisits` where `concernIds array-contains` (plus legacy `concernId == id`); each row shows date (tappable link) + type/provider meta; **Photos** — photo gallery; **Facts** — key-value facts. Med Picker overlay (`medPickerModal`): lists all non-discontinued medications as checkboxes, pre-checked if already linked; "Add New Medication" opens med modal and returns to picker on save (via `window._medPickerCallback`); Save applies `arrayUnion`/`arrayRemove` diffs in a Firestore batch. **"↑ Promote to Condition" button** at bottom opens `promoteModal`; hidden once promoted. **Archived state** (when `status === 'promoted'`): purple "Promoted to Condition" banner with date + "View Condition →" link appears; all edit controls hidden via CSS class `concern-archived`; page is read-only.

**Promote to Condition** (`promoteModal`): Pre-filled with concern title → Condition Name, body area → Category. On "Promote": queries all conditions for a case-insensitive name match. No match → creates new condition (`active`, diagnosed date from concern start date) then runs migration. Match found → shows conflict section: "Create New" (creates second condition) or "Merge into existing" (appends to existing condition). Migration (`_doPromotionWork`): copies `concernUpdates` journal → `healthConditionLogs` (prefixed "Imported from concern: [title] — "); adds `conditionIds arrayUnion` to all linked meds/appointments/visits; re-points photos from `targetType: 'concern'` to `targetType: 'condition'`; sets concern `status: 'promoted'`, `promotedToConditionId`, `promotedDate`; adds first condition log: "Promoted/Merged from concern: [title] on [date]." All in a single Firestore batch. After: navigates to the condition detail page.

**Condition Detail** (`#health-condition/{id}`): Collapsible-section layout (mirrors concern detail). Summary card at top shows: name, status badge (Active/Managed/Resolved), category, diagnosed date, management notes, cycle-status button (Active → Managed → Resolved → Active), Edit + Delete buttons. Collapsed section headers show a muted count badge (e.g. "Medications (1)") loaded alongside the section data. Six collapsible sections — **Journal** (starts expanded): log entries from `healthConditionLogs` (date, pain scale, note, type); entries from a visit show a clickable **"Visit ›"** chip — navigates to `#health-visit-step2/{visitId}`; Add Note button opens `conditionUpdateModal`; **Medications** (collapsed): medications whose `conditionIds[]` includes this id; Unlink button, "+ Add Med" → `openMedPicker('condition', id)`; **Appointments & Visits** (collapsed): queries `appointments` + `healthVisits` where `conditionIds array-contains id`; **Photos** (collapsed): targetType `condition`; **Facts** (collapsed): targetType `condition`; **Projects** (collapsed): targetType `condition`. Condition cards on the list page are tappable (click navigates to detail; button clicks do not bubble).

**Mark Done 2-Step Flow**: When an appointment is marked Done, the convert modal (Step 1) opens pre-filled from the appointment: date (today), time, visit type (from `appointment.type`), facility display (tappable link if `facilityContactId` set, or plain text from `facilityText`), "Who did you see?" text input (pre-filled from `providerText` or contact name). Legacy Provider/ProviderType fields replaced. Single concern dropdown removed — concern/condition linking carried forward from appointment. After saving the visit record (which copies `concernIds[]`, `conditionIds[]`, `type`, `facilityContactId`, `providerContactId` from the appointment), navigates to Step 2 (`#health-visit-step2/{visitId}`). Step 2 page: accordion list of all linked concerns/conditions (tagged ⚠️ Concern / 📋 Condition); each item has a **🎤 Speak** button next to the Notes label (voice-to-text via Web Speech API); if a note was previously saved for this concern/condition from this same visit, it is pre-loaded into the textarea for editing; saving updates the existing note rather than creating a duplicate. Medications sub-section: existing linked meds with ✕ unlink; **"+ New Med"** opens the Add Medication modal (visit pre-selected) — after save the med is auto-linked and the list refreshes; **"+ Link Existing"** opens the med picker overlay. Each type has two buttons: **"+ New Concern/Condition"** (inline stacked form — inputs are full-width for easy mobile typing; creates a new record + links it) and **"+ Add Existing Concern/Condition"** (inline select — loads open concerns / active conditions not already on the visit; selecting one links it via `arrayUnion` and adds it to the accordion). "Done → Visit" saves any non-empty notes as `concernUpdates` (type: 'visit-note', visitId) or `healthConditionLogs` (same) then navigates to `#health-visit/{id}`. Skipping notes is valid.

**Routes**: `#health`, `#health-visits`, `#health-visit/{id}`, `#health-visit-step2/{id}`, `#health-medications`, `#health-conditions`, `#health-condition/{id}`, `#health-concerns`, `#health-concern/{id}`, `#health-bloodwork`, `#health-bloodwork-detail/{id}`, `#health-vitals`, `#health-supplements`, `#health-vaccinations`, `#health-eye`, `#health-insurance`, `#health-insurance-detail/{id}`, `#health-emergency`, `#health-appointments`, `#health-allergies`

**Blood Work LLM Import**: User pastes lab report text → LLM extracts structured markers (name, value, unit, reference range, flagged status) → editable preview before save.

**Medication Photos**: Each medication card has a "Photos" button that opens a dedicated photo modal with Camera / Gallery / Paste upload options. Photos stored in `photos` collection with `targetType: 'medication'`.

**Scan Rx Label (LLM Vision)**: The Add/Edit Medication modal has a "📷 Scan Rx Label" button. User selects a photo of their prescription receipt; the app compresses it and sends it to the configured LLM (gpt-4o / grok-2-vision) with a structured extraction prompt. LLM returns JSON: name, dosage, prescribedBy, startDate, type (Ongoing/Short-term/As-needed), notes (Rx#, NDC, qty, refills, insurance savings). Fields are auto-populated for review before saving. The scanned image is automatically saved as a photo on the medication after save.

**Vitals trend**: Select a vital type, see all readings over time in a table.

### Notes / Notebooks (`notes.js`)

**Plan document**: `Notes.md`

A notebook-organized note-taking system.

**Firestore**:
- `notebooks` — `name`, `color` (gradient CSS string), `noteCount`, `createdAt`, `updatedAt`
- `notes` — `notebookId`, `body`, `createdAt`, `updatedAt`

**Routes**: `#notes` (notebook list), `#notebook/{id}` (note list), `#note/{id}` (view/edit)

**Color swatches**: 8 preset gradient colors for notebooks. Rendered as colored cards.

**Default notebook**: Auto-created "Default" gray notebook on first visit; cannot be deleted.

**Search**: Global search across all note body text.

**New note save**: After saving a new note, the app navigates back to the notebook list (not to the note's edit page).

**Tab key**: In the note body textarea, pressing Tab inserts 4 spaces instead of moving focus to the next field.

### Life Main Page (`#life`)

Landing page showing tile shortcuts to Journal, Contacts, Health, Notes, and Calendar. Below the tiles, a **"Coming Up"** section (hidden when empty) shows events within the next 30 days, sorted by date. Two sources are merged:
- **Annual contact dates** (`peopleImportantDates` where `recurrence == annual`) — shows label, person name (tappable link to `#contact/{id}`), and "turns N" age badge if a birth year is set
- **Upcoming life calendar events** (`lifeEvents` where `startDate` in next 30 days, excluding attended/missed/didntgo) — shows event title as a tappable link to `#life-event/{id}`

Each item shows a relative time label: "Today!", "Tomorrow", or "In N days".

### Life Calendar (`lifecalendar.js`)

**Plan document**: `LifeCalendar.md`

Tracks major life events — trips, milestones, goals, relationships.

**Firestore**:
- `lifeEvents` — `title`, `description`, `startDate`, `endDate?`, `startTime?` (HH:MM), `endTime?` (HH:MM), `location?`, `categoryId?`, `status` (upcoming/in-progress/completed/past), `peopleIds[]`, `notes?`, `miniLogEnabled`, `createdAt`
- `lifeCategories` — `name`, `color`, `createdAt`
- `lifeEventLogs` — `logDate`, `logTime`, `body`, `eventId`, `mentionedPersonIds[]`, `createdAt`

**Health Appointments in Calendar**: `healthAppointments` are loaded alongside `lifeEvents` and displayed in both list and grid views.
- Appointments are normalized to a common shape (`_kind: 'appt'`) with `startDate`, `startTime`, and a title built from `type` + provider name
- Shown in red (`linear-gradient(135deg,#ef4444,#f87171)`) with an **Appt** pill badge
- **List view**: filtered by status (scheduled = Upcoming, completed = Attended; missed filter excludes appointments); hidden when a category filter is active
- **Grid view**: all non-cancelled appointments always appear regardless of status filter (past appointments visible when browsing past months)
- Clicking an appointment card or grid bar navigates to `#health-appointments`

**Routes**: `#life-calendar` (list), `#life-event/{id}` (detail/edit), `#life-event/new` (create)

**Event Form**:
- Title, start date, end date (with validation — end date cannot be before start date), optional start time, optional end time
- Category (color-coded), status dropdown, location, people tags, description
- Mini log textarea (journal-style notes attached to the event)
- Top-level Save button (next to title) and bottom Save button
- Saving a **new** event navigates to `#life-calendar` (not the event detail page)
- Saving an **edited** event navigates to `#life-calendar`

**Status**: Events auto-transition between upcoming/in-progress/completed/past based on dates.

**People linking**: Events can tag multiple people from the `people` collection. Linked events appear on each person's detail page.

**Mini logs**: Inline journal-style entries attached to a life event. Appear in the main journal feed (togglable).

---

## Part 9: Places & Check-In

**JS file**: `js/places.js`

Tracks real-world places the user visits. Places tie together journal check-ins, activities, and a searchable location history. Uses OpenStreetMap (OSM) data for discovery and geocoding — no paid API key required.

### Places List (`#places`)
- Shows all saved places as cards (name, address/city, category)
- Soft-delete: `status: 0` hides a place from the list without removing Firestore data
- "+ New Place" button opens the add-place modal

### Place Detail Page (`#place/{id}`)
- Sets `window.currentPlace` on load
- **Summary line**: "X journal entries · Y activities" (loaded in parallel via `Promise.all`)
- **Interactive map**: Leaflet.js map centered on `lat`/`lng`, showing a marker. Initialized in a 50ms `setTimeout` after the container becomes visible; `map.invalidateSize()` called to handle deferred layout. Previous map instance destroyed with `_placeDetailMap.remove()` on re-visit.
- **Photos**: Full gallery via `photos.js` — `targetType: 'place'`, `targetId: place.id`. Camera and gallery upload buttons wired in `photos.js` `DOMContentLoaded`.
- **Facts**: Key/value pairs via `facts.js` — `targetType: 'place'`. "Add Fact" button wired in `facts.js` `DOMContentLoaded`.
- **Journal Entries**: Lists all journal entries with `placeIds` array containing this place's ID. Uses `array-contains` Firestore query (no composite index needed). Sorted newest-first. Check-in entries show a 📍 badge. Clicking an entry navigates to it via `openEditJournalEntry(id)`.
- **Activities**: Full activity list via `activities.js` — `targetType: 'place'`. "Log Activity" button wired in `activities.js`.

### Add / Edit Place
- Modal with fields: Name, Address, City, State, Zip, Category, Notes
- **GPS capture**: "Use My Location" button calls `navigator.geolocation.getCurrentPosition`, then reverse-geocodes via Nominatim to auto-fill Name/Address/City/State/Zip
- **Search**: Text search field queries OSM Nominatim for matching venues; results shown in dropdown; selecting auto-fills all fields including `lat`/`lng`/`osmId`

### Check-In Flow
1. User taps "📍 Check In" (QuickLog or SecondBrain)
2. **Check-in form**: Shows nearby venues (via OSM Overpass API within 500m radius) or search results
3. User selects a venue
4. Form pre-fills as a journal entry with `isCheckin: true` and the venue pre-attached
5. User edits entry text (optional) and taps Save
6. Saves a `journalEntries` doc with `placeIds: [placeId]`, `isCheckin: true`
7. If the place wasn't already in Firestore, `placesSaveNew()` creates it first (dedup by `osmId` if available)

### OSM Integration
- **Nominatim** (text search + reverse geocode): `https://nominatim.openstreetmap.org/search` and `/reverse`
- **Overpass API** (nearby venues): Queries nodes within radius; returns name, lat, lng, address tags
- Both endpoints are free, no API key needed; rate-limited (max 1 req/sec)
- Results shown in a dropdown; user selects to populate place fields

### LLM Enrichment (`placesEnrichWithLLM()`)
- Non-blocking background enrichment after a new place is saved
- Sends place name + address to LLM and asks for category, opening hours hint, and notes
- If LLM responds, updates the Firestore doc with enriched fields
- Silent failure — no UI feedback if LLM is not configured or enrichment fails

### Deduplication
- Before creating a new place, `placesSaveNew()` checks if any existing place has the same `osmId` (if provided)
- If a match is found, returns the existing place's ID without creating a duplicate
- Places without `osmId` (manually entered) are never auto-deduped

### Firestore
- **Collection**: `places`
- **Key fields**: `name`, `address`, `city`, `state`, `zip`, `country`, `lat`, `lng`, `osmId?`, `category?`, `notes`, `status` (1=active, 0=soft-deleted), `profilePhotoData?`, `createdAt`
- **Soft delete**: `status: 0` (never hard-deleted)
- **No `orderBy`** in queries — avoids composite index requirement; results sorted client-side

### Routes
- `#places` — places list
- `#place/{id}` — place detail

### SecondBrain Integration
- `CHECK_IN` action: short-circuit (same pattern as `FIND_THING` — no Firestore write from SecondBrain itself)
- If `payload.placeName` provided: calls `placesSearchByName()` → passes first match to `openCheckInForm(venue, false)`
- If `payload.useGps: true` or no name: calls `openCheckIn()` (GPS-based nearby venues)
- The place is not committed to Firestore until the user taps Save on the check-in form

---

## Part 10: AI / LLM Features

**Plan documents**: `Chat.md`, `SecondBrain.md`

### Settings (`settings.js`)
LLM is configured per-user in `userCol('settings').doc('llm')`:
- `provider`: `openai` or `xai`
- `apiKey`: user's personal API key (stored behind auth, not in localStorage)
- `model`: optional override (defaults: `gpt-4o-mini` for OpenAI, `grok-3` for xAI)

### Chat (`chat.js`)
Simple conversational AI interface.

**Route**: `#chat`

- Free-form text input with optional image attachment
- Responses rendered as markdown (via Marked.js)
- Ephemeral — no conversation history stored in Firestore
- Use cases: plant identification, general yard/home questions, advice

### SecondBrain (`secondbrain.js`, `sbissues.js`)

**Plan document**: `SecondBrain.md`

Natural language command interface for logging anything hands-free.

**Route**: `#secondbrain` (accessed via nav)

**Input**: Text field or voice input. Optional photo attachment.

**Flow**:
1. User types or speaks a command (e.g., "I sprayed herbicide on the front yard today")
2. App sends command + full entity context (all zones, plants, vehicles, etc. by name+ID) to LLM
3. LLM returns a JSON `{action, payload}` describing what to do
4. App shows a **confirmation screen** with editable fields
5. User reviews and confirms (or edits) → app writes to Firestore
6. App navigates to the relevant entity detail page

**Confirmation screen**: Shows all detected fields. Unknown entities (e.g., a chemical not in the list) are flagged for user confirmation. Chemicals shown as checkboxes.

**Supported actions**:

| Action | What it does |
|--------|-------------|
| `LOG_ACTIVITY` | Logs an activity to a zone, plant, weed, vehicle, house entity |
| `ADD_JOURNAL_ENTRY` | Creates a journal entry |
| `ADD_CALENDAR_EVENT` | Creates a calendar event |
| `ADD_PROBLEM` | Logs a problem/concern to an entity |
| `ADD_IMPORTANT_DATE` | Adds a birthday/anniversary to a person |
| `LOG_MILEAGE` | Adds a mileage log entry to a vehicle |
| `ADD_FACT` | Adds a fact (key/value) to an entity |
| `ADD_PROJECT` | Creates a project on an entity |
| `LOG_INTERACTION` | Logs a people interaction |
| `ADD_WEED` | Creates a new weed record |
| `ADD_TRACKING_ENTRY` | Logs a journal tracking value |
| `ADD_THING` | Creates a house thing |
| `ATTACH_PHOTOS` | Attaches photos to an entity |
| `ADD_NOTE` | Adds a note to a notebook |
| `CHECK_IN` | Opens the check-in form for a named or GPS-based place (short-circuit — no Firestore write; navigates to the check-in form) |
| `UNKNOWN_ACTION` | LLM could not determine intent — no action taken |

**Help screen**: Built-in help listing all actions with icons, labels, descriptions, and example utterances. Maintained in `SB_HELP_ACTIONS` array — **must be kept in sync when new actions are added**.

### Weed Identification (LLM)
See [Yard: Weeds](#weeds-weedsjs) above.

### Blood Work Import (LLM)
See [Life: Health](#health-healthjs) above.

### House/Collection LLM Photo ID
See [House: LLM Photo Identification](#llm-photo-identification-house) and [Collections: LLM Identification](#llm-identification-for-collections) above.

---

## Part 11: Shared Features

These features are used across multiple sections. The implementation lives primarily in dedicated JS files.

### Photos (`photos.js`)

**Firestore**: `photos` — `targetType`, `targetId`, `imageData` (Base64 JPEG), `caption`, `takenAt`, `createdAt`

**Key fields**:
- `targetType`: identifies the entity type (e.g., `plant`, `zone`, `thing`, `subthing`, `item`, `collectionitem`, `person`, `vehicle`, `weed`, `chemical`, `place`, etc.)
- `targetId`: Firestore document ID of the entity

**Storage**: Base64 JPEG compressed client-side using the Canvas API. Target size ~100–200KB per photo.

**Gallery UI**:
- Shows newest photo by default
- Newer / Older navigation buttons with counter (e.g., "2 of 5")
- Caption shown below photo (edit caption or add caption button)
- Action buttons per photo: **⭐ Use as Profile/Thumbnail** (supported types only), **🔍 View**, **Edit/Add Caption**, **Delete Photo**

**Photo upload paths**:
- Camera input (`<input type="file" accept="image/*" capture>`)
- Gallery picker (`<input type="file" accept="image/*">`)
- Clipboard paste
- LLM identification flow (photos staged and compressed before sending)

**Crop tool**: Cropper.js instance shown before save — user can adjust framing. Optional, can skip. Also accessible from the View lightbox (see below).

**View Lightbox** (`openPhotoLightbox()` in `photos.js`):
- Tapping **🔍 View** opens a full-screen dark overlay (z-index 9999)
- **Pinch-to-zoom**: 2-finger pinch gesture scales the image from 1× up to 5×
- **Pan**: 1-finger drag pans the image when zoomed in (no-op at 1×)
- **Long-press download**: Hold finger on the image for ~650ms to trigger a download of the photo as `photo.jpg`
- **✂ Crop button**: shown at the bottom — closes lightbox and opens the Cropper.js flow
- **✕ close button**: top-right corner dismisses the overlay
- Implemented as a dynamically-created DOM element appended to `document.body` (no static modal in `index.html`)

**Profile / Thumbnail photos**:
- Supported entity types: `plant`, `weed`, `person`, `vehicle`, `thing`, `subthing`, `item`, `collectionitem`
- Stored as `profilePhotoData` directly on the entity document (compressed further to ~300px max dimension)
- **Auto-set**: When the first photo is added to a supported entity (via LLM flow or manual add), `profilePhotoData` is auto-set from that first photo
- **Manual override**: "⭐ Use as Profile" (or "⭐ Use as Thumbnail" for collection items) button in the gallery sets any photo as the thumbnail
- **Live update**: Setting a thumbnail updates the in-memory `window.current*` state object so the UI reflects the change without a full page reload

**Key maps in `photos.js`**:
```js
// Which entity types support profile/thumbnail photos
var PROFILE_PHOTO_TYPES = ['plant', 'weed', 'person', 'vehicle', 'thing', 'subthing', 'item', 'collectionitem'];

// Maps targetType → Firestore collection for writing profilePhotoData
var PROFILE_COLLECTION_MAP = {
    plant:          'plants',
    weed:           'weeds',
    person:         'people',
    vehicle:        'vehicles',
    thing:          'things',
    subthing:       'subThings',
    item:           'subThingItems',
    collectionitem: 'collectionItems',
};

// Maps targetType → [containerId, emptyStateId] for the gallery container
var PHOTO_CONTAINERS = { /* ... all entity types ... */ };
```

### Facts (`facts.js`)

**Firestore**: `facts` — `targetType`, `targetId`, `label`, `value`, `createdAt`

**UI**: Displayed as a table of label/value pairs. Add and edit via a modal. Delete with confirmation.

**URL values**: If `value` starts with `http`, it renders as a clickable `<a href="..." target="_blank">` link.

**Used by**: Zones, plants, weeds, chemicals, vehicles, people, all house/garage/structure entities, health entities

### Activities (`activities.js`)

**Firestore**:
- `activities` — `targetType`, `targetId`, `description`, `notes`, `date`, `chemicalIds[]`, `savedActionId?`, `placeId?`, `createdAt`
- `savedActions` — `name`, `description`, `chemicalIds[]`, `notes`, `createdAt`

**Log activity modal**:
- Date picker (defaults to today)
- Description text (pre-filled if saved action selected)
- Notes textarea
- Chemical multi-select: checkbox list of all chemicals, supports selecting multiple
- "Use Saved Action" dropdown: pre-fills description and chemical selection
- **Place (optional)**: Search field to attach a place to the activity. Typing opens a dropdown of matching places (via Nominatim + saved places). Selecting shows a chip with a clear button. If the place doesn't exist in Firestore yet, it is auto-created via `placesSaveNew()` when the activity is saved. Saved place name shown as a tappable link in the activity list row.

**Activity list**: Compact rows with date + description + Edit button. Edit modal shows full details (read-only) plus Save as Action and Delete.

**Saved Actions**: Reusable templates. Created from an existing activity ("Save as Action" button) or from the Saved Actions management page (`#actions`). Used across any entity type.

**Used by**: All entity types (yard zones/plants/weeds, house things, vehicles, people, etc.)

### Problems / Concerns (`problems.js`)

**Firestore**: `problems` — `targetType`, `targetId`, `description`, `notes`, `status` (open/resolved), `dateLogged`, `resolvedAt`, `createdAt`

**UI**: List of problems per entity. Each shows description, date logged, and status badge. Click to expand for notes and full detail.

**Status toggle**: Mark as resolved → sets `resolvedAt` timestamp and status to "resolved". Can be re-opened.

**Show resolved**: Checkbox to toggle visibility of past-resolved problems.

**Roll-up**: Parent entities (floors, rooms, things) aggregate all descendant problems (e.g., a floor's problem list includes all problems from rooms and things in that floor). Source label shown (e.g., "from: Kitchen").

**Facts on problems**: Each problem can have its own facts (key/value pairs).

**Add/Edit modal**: Save and Cancel buttons appear both at the top (inline with the title) and at the bottom, so the user can save without scrolling regardless of keyboard position.

**Fields**: "Title" (short name, text input) and "Description" (free-form details, textarea). Stored as `description` and `notes` in Firestore respectively.

**Voice-to-text**: The Description textarea has a 🎤 Speak button for hands-free dictation in the field.

**Photos on problems**: Each problem can have photos attached (Camera, Gallery, or Paste). `targetType: 'problem'`, `targetId: problem.id`. In add mode, the problem is auto-saved first to get an ID before photos can be attached.

**Used by**: All entity types

### Projects (`projects.js`)

**Firestore**: `projects` — `targetType`, `targetId`, `title`, `notes`, `status` (active/completed), `items[]` (array of `{text, done, completedAt, notes}`), `completedAt`, `createdAt`

**UI**: Collapsible cards — collapsed shows title + item count badge; expanded shows full checklist.

**Checklist items**: Click item to toggle done. Completion timestamp recorded per item. Notes can be added to individual items.

**Project completion**: Mark entire project as complete → sets `completedAt`.

**Show completed**: Checkbox to toggle visibility of completed projects.

**Roll-up**: Same pattern as Problems — parent entities aggregate all descendant projects.

**Add/Edit modal**: Save and Cancel buttons appear both at the top (inline with the title) and at the bottom, so the user can save without scrolling regardless of keyboard position.

**Voice-to-text**: The Notes textarea has a 🎤 Speak button for hands-free dictation.

**Used by**: All entity types

### Calendar Events (`calendar.js`)

**Firestore**: `calendarEvents` — `title`, `description`, `date` (ISO string), `recurring` (null or `{type, intervalDays}`), `targetType?`, `targetId?`, `zoneIds[]`, `savedActionId?`, `completed`, `completedDates[]`, `cancelledDates[]`, `createdAt`

**Recurring types**: `weekly` (+7 days), `monthly` (same day next month, clamped to month-end), `every_x_days` (user-specified interval)

**Display range**: Configurable 1/3/6/12 months. Default is 3 months. Events shown chronologically, grouped by month with headers.

**Complete event flow**:
1. Click "Complete" on an event occurrence
2. Optional notes modal
3. Creates an Activity record on the linked entity (if `targetType`/`targetId` set)
4. Marks the occurrence as completed (`completed = true` for one-time, adds date to `completedDates[]` for recurring)

**Overdue section**: Past-due uncompleted events shown at the top with orange "OVERDUE" badge.

**Delete recurring**: Shows warning that ALL occurrences will be removed.

**Copy event**: Creates a new one-time event pre-filled with the source event's title and description (date cleared).

**Multi-zone**: Events can be linked to multiple zones via `zoneIds[]`.

**Entity-linked events**: Events on zone/plant/vehicle/house entity detail pages show only events for that entity.

**Used by**: All sections (yard, house, garage, vehicles, life, structures)

### GPS / Location (`gps.js`, `BishopGps.md`)
- Zones can be assigned GPS coordinates
- `#yardmap`: shows all zones with coordinates on an interactive map
- `#gpsmap/{id}`: shows a single zone's location
- Map library: Leaflet.js (free, open-source)

### Search (`search.js`)
- **Route**: `#search`
- Global full-text search across zones, plants, weeds, chemicals, vehicles, people, notes, and more
- Result cards show entity type, name, key details
- Clicking a result navigates to the entity detail page

### Checklists (`checklists.js`)
- **Route**: `#checklists`
- Standalone quick checklists (shopping lists, to-do lists, packing lists)
- Independent of the project system — lightweight, quick-access

---

## Part 12: Navigation & Routing

The app has three navigation contexts, each with its own nav bar:

| Context | Nav Items |
|---------|-----------|
| **Yard** | Home (zones), Weeds, Products (chemicals), Calendar, Activity Report, Saved Actions, Bulk Activity, Structures, Search |
| **House** | House (floors), Garage, Vehicles, Checklists |
| **Life** | Journal, Places, Contacts, Health, Notes, Collections, Life Calendar, SecondBrain, Chat |

**Shared pages** (retain last active context): Settings, Change Password, GPS Map

**Mobile nav**: Hamburger menu that toggles a full-screen overlay. Desktop nav: horizontal bar.

**Breadcrumb bar**: Sticky header below the nav bar showing the current hierarchy (e.g., "House › 1st Floor › Kitchen"). Built dynamically on each page load into `document.getElementById('breadcrumbBar')`.

**Context switching**: Tapping "My House" logo navigates to `#home` and sets yard context. Separate nav items switch between House and Life contexts.

---

## Part 13: Testing

### Test Account
The app requires Firebase Auth login. A shared test account is used for local preview server testing:

- **Email**: `skasputi@pattersoncompanies.com`
- **Password**: `steve2a2`
- **Server**: `http://localhost:8080` (Python HTTP server, port 8080)

Credentials are stored locally in `.test-credentials.md` (gitignored — never committed to the repo).

### Dev Server
The dev server is a Python HTTP server configured in `.claude/launch.json`:
- **Name**: `bishop-dev`
- **Port**: 8080
- Launch via Claude Code preview tools (`preview_start` with name `bishop-dev`)

### Test Plans
Feature-specific test plans live in their own markdown files:
- `LifeCalendar.md` — includes a detailed test matrix (T-1 through T-16, all passing)

### General Test Approach
1. Start the dev server (`preview_start` → `bishop-dev`)
2. Log in with test account credentials
3. Navigate to the feature being tested
4. Verify: create, edit, delete, field validation, and any feature-specific flows
5. Verify mobile layout at 375px viewport width
6. Check browser console for JS errors (`preview_console_logs` with `level: error`)

### Known Test Gotchas
- `alert()` calls (e.g., on the event form dirty-check) will freeze `preview_eval` for 30 seconds — navigate to a fresh page before running evals that might trigger alerts
- After `closeModal()`, navigation must use `setTimeout(..., 50)` — test that back-button behavior is correct after modal interactions
- Duplicate event listeners accumulate on buttons if `cloneNode` is not used — test that clicking modal buttons multiple times doesn't fire handlers multiple times
- Cache busting: if a fix isn't appearing, verify the `?v=N` was bumped on all script and CSS tags
- **Empty test account**: The test account may have no data. For UI-only verifications (e.g., checking a button label or that a modal opens), inject mock state via `preview_eval` rather than concluding the feature is untestable

### Keeping This Spec Current
- The functional spec must be updated in the **same commit** as any feature change
- Do not defer spec updates — a stale spec gives the wrong context at the start of the next session
- Update the section that owns the changed feature; add new sections for new entity types or major new capabilities
- **Always tell the user** when the spec was updated — state which section(s) changed and what was added/modified. This allows the user to notice if a spec update was skipped when it should have happened.

---

## Part 14: Deployment

- **Hosting**: GitHub Pages — live at `https://dolphinstevekasputis.github.io/BishopHome`
- **GitHub username**: `DolphinSteveKasputis`
- **Branch**: `main` (deployed automatically from main branch)
- **Push protocol**: Always send the ntfy.sh notification before `git push` — Windows requires a credential confirmation prompt:
  ```
  curl -d "Ready to push — please confirm the Windows prompt" ntfy.sh/WolfLifeBishop
  ```
- **Notifications**: Task completion notifications sent to `ntfy.sh/WolfLifeBishop`

---

## Part 15: Firestore Data Model

All collections live under `/users/{uid}/`. Every module uses `userCol('collectionName')` to scope reads/writes.

### Yard

| Collection | Key Fields |
|------------|------------|
| `zones` | name, parentId, level (1/2/3), createdAt |
| `plants` | name, zoneId, metadata{}, profilePhotoData?, createdAt |
| `weeds` | name, treatmentMethod, applicationTiming, notes, zoneIds[], profilePhotoData?, createdAt |
| `chemicals` | name, notes, createdAt |
| `activities` | targetType, targetId, description, notes, date, chemicalIds[], savedActionId?, placeId? |
| `savedActions` | name, description, chemicalIds[], notes |

### House

| Collection | Key Fields |
|------------|------------|
| `floors` | name, floorNumber, createdAt |
| `rooms` | name, floorId, sortOrder, createdAt |
| `things` | name, category, roomId, description, worth, notes, profilePhotoData?, createdAt |
| `subThings` | name, thingId, description, worth, tags[], profilePhotoData?, createdAt |
| `subThingItems` | name, subThingId, description, worth, tags[], profilePhotoData?, createdAt |
| `floorPlans` | floorId, widthFt, heightFt, rooms[], doors[], windows[], updatedAt |
| `breakers` | slotNumber, label, amperage, type, status, notes |

### Garage

| Collection | Key Fields |
|------------|------------|
| `garageRooms` | name, order, createdAt |
| `garageThings` | name, roomId, category, description, worth, notes, createdAt |
| `garageSubThings` | name, thingId, tags[], createdAt |

### Structures

| Collection | Key Fields |
|------------|------------|
| `structures` | name, type, notes, createdAt |
| `structureThings` | name, structureId, category, description, worth, notes, createdAt |
| `structureSubThings` | name, thingId, tags[], createdAt |

### Vehicles

| Collection | Key Fields |
|------------|------------|
| `vehicles` | year, make, model, trim, color, vin, licensePlate, purchaseDate, purchasePrice, notes, archived, archivedAt, archivedReason, profilePhotoData?, createdAt |
| `mileageLogs` | vehicleId, date, mileage, notes, createdAt |

### Collections

| Collection | Key Fields |
|------------|------------|
| `collections` | name, type, label1, label2, label3, createdAt |
| `collectionItems` | collectionId, name, typeData{}, acquiredDate, pricePaid, estimatedValue, notes, locationRef{}, profilePhotoData?, createdAt |

### Life

| Collection | Key Fields |
|------------|------------|
| `people` | name, nickname, category (Personal/Medical Professional/Medical Facility/Service Professional/Other), specialty?, phone, email, address, facebookUrl, howKnown, notes, profilePhotoData?, parentPersonId?, createdAt |
| `peopleImportantDates` | personId, label, month, day, year?, notes, createdAt |
| `peopleInteractions` | personId, date, notes, createdAt |
| `peopleCategories` | name, createdAt |
| `journalEntries` | date, entryTime, entryText, mentionedPersonIds[], placeIds[], isCheckin, sourceEventId?, createdAt, updatedAt |
| `journalTrackingItems` | date, category, value, createdAt |
| `journalCategories` | name, createdAt |
| `lifeEvents` | title, description, startDate, endDate?, startTime?, endTime?, location?, categoryId?, status, peopleIds[], notes?, miniLogEnabled, createdAt |
| `lifeCategories` | name, color, createdAt |
| `lifeEventLogs` | logDate, logTime, body, eventId, mentionedPersonIds[], createdAt |
| `notebooks` | name, color, noteCount, createdAt, updatedAt |
| `notes` | notebookId, body, createdAt, updatedAt |

### Health

| Collection | Key Fields |
|------------|------------|
| `healthVisits` | date, type, provider (legacy), providerType (legacy), facilityContactId, providerContactId, concernIds[], conditionIds[], reason, whatWasDone, outcome, cost, notes |
| `medications` | name, dosage, purpose, prescribedBy, prescribedAtVisitId?, startDate, endDate, status, type, concernIds[], conditionIds[] |
| `concerns` | title, bodyArea, startDate, status (open/resolved/promoted), resolvedDate, summary, promotedToConditionId?, promotedDate? |
| `healthConcernLogs` | concernId, date, note, painScale?, type (manual/system/visit-note), visitId? |
| `conditions` | name, category, diagnosedDate, diagnosedBy, status (active/managed/resolved), managementNotes |
| `healthConditionLogs` | conditionId, date, note, painScale?, type (manual/system/visit-note), visitId?, createdAt |
| `healthCareTeam` | single doc (`default`): members[{role, providerContactId?, facilityContactId?}] |
| `bloodWork` | date, lab, orderedBy, notes, markers[] |
| `vitals` | date, time, type, value1, value2?, unit, notes |
| `supplements` | name, dosage, brand, reason, frequency, startDate, endDate, status |
| `vaccinations` | name, date, dateApproximate, provider, lotNumber, nextDueDate |
| `eyePrescriptions` | date, type, rightEye{}, leftEye{}, pd, provider |
| `insurance` | provider, policyNumber, groupNumber, memberId, copay, deductible, photoDocuments[] |
| `emergencyInfo` | emergencyContacts[], allergies[], medicalAdvances, dnr, notes |
| `healthAppointments` | date, time, type, facilityContactId, providerContactId, concernIds[], conditionIds[], notes, status (scheduled/completed/cancelled/converted), linkedVisitId |

### Shared

| Collection | Key Fields |
|------------|------------|
| `photos` | targetType, targetId, imageData (Base64), caption, takenAt, createdAt |
| `facts` | targetType, targetId, label, value, createdAt |
| `problems` | targetType, targetId, description, notes, status, dateLogged, resolvedAt |
| `projects` | targetType, targetId, title, notes, status, items[], completedAt |
| `calendarEvents` | title, description, date, recurring{type,intervalDays}?, targetType?, targetId?, zoneIds[], savedActionId?, completed, completedDates[], cancelledDates[] |

### Places

| Collection | Key Fields |
|------------|------------|
| `places` | name, address, city, state, zip, country, lat, lng, osmId?, category?, notes, status (1=active/0=deleted), profilePhotoData?, createdAt |

### Settings

| Path | Fields |
|------|--------|
| `settings/llm` | provider, apiKey, model? |
| `settings/journal` | defaultDateRange |
