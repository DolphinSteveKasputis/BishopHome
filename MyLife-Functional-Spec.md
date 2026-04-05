# MyLife (Bishop) — Functional Specification

> **Purpose**: This document is the source of truth for the MyLife/Bishop application. It is written for developers, AI coding assistants, and power users. Each major section describes what a feature does and how it works. Shared features (photos, facts, activities, etc.) are described in depth in [Part 10: Shared Features](#part-10-shared-features) — individual sections above reference them and only expand on nuances.

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
9. [AI / LLM Features](#part-9-ai--llm-features)
10. [Shared Features](#part-10-shared-features)
11. [Navigation & Routing](#part-11-navigation--routing)
12. [Testing](#part-12-testing)
13. [Deployment](#part-13-deployment)
14. [Firestore Data Model](#part-14-firestore-data-model)

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

**Firestore**: `floorPlans` — `floorId`, `widthFt`, `heightFt`, `rooms[]`, `doors[]`, `windows[]`, `updatedAt`

**Features**:
- SVG-based canvas with optional grid overlay
- Snap-to-grid in 1 ft or 6-inch increments
- Rectilinear room polygons (all angles are 90°, but L/T/U shapes are possible)
- Doors: placed on room walls, show swing direction
- Windows: placed on walls with width and position
- Electrical markers: outlets and switches
- Plumbing markers: toilets, sinks, bathtubs, showers, floor drains, water heater, washer/dryer hookup
- Ceiling fixtures (lights, ceiling fans) shown as symbols inside rooms
- Stairs shown with hatch pattern and label

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
- `journalEntries` — `date`, `entryTime` (HH:MM), `entryText`, `mentionedPersonIds[]`, `sourceEventId?`, `createdAt`, `updatedAt`
- `journalTrackingItems` — `date`, `category`, `value`, `createdAt`
- `journalCategories` — `name`, `createdAt`
- `lifeEventLogs` — `logDate`, `logTime`, `body`, `eventId`, `mentionedPersonIds[]`, `createdAt` (mini logs from Life Calendar)

**Routes**: `#journal` (list), `#journal-entry` (add/edit), `#journal-tracking` (tracking entries), `#journal-categories` (manage categories)

**@Mentions**: Typing `@` in the entry text triggers an autocomplete dropdown of tracked people by name.

**Date range filter**: Sticky per-user preference (7/30/60/90 days or custom) saved to `userCol('settings').doc('journal')`.

**Tracking items**: Numeric values logged per category per day (e.g., weight, mood, blood pressure). A trend view shows all values for a selected category over time.

**Life Event Logs integration**: Mini log entries from Life Calendar events appear inline in the journal feed. Toggle "Show Event Notes" to show/hide them.

### People (`people.js`)

**Plan document**: `People.md`

**Firestore**:
- `people` — `name`, `nickname`, `category`, `phone`, `email`, `address`, `facebookUrl`, `howKnown`, `notes`, `profilePhotoData?`, `parentPersonId?`, `createdAt`
- `peopleImportantDates` — `personId`, `label` (Birthday/Anniversary/Other), `month`, `day`, `year?`, `notes`, `createdAt`
- `peopleInteractions` — `personId`, `date`, `notes`, `createdAt`
- `peopleCategories` — `name`, `createdAt`

**Routes**: `#people` (list), `#person/{id}` (detail)

**Hierarchy**: Sub-people (`parentPersonId`) allow grouping (e.g., family members under a parent record).

**Person detail sections**:
- Contact info: phone (tel: link), email (mailto: link), address (Google Maps link), Facebook, how known, notes
- Important dates: birthdays, anniversaries — shown on person detail and referenced in calendar
- Photos: full gallery, profile photo support (auto-set from first photo)
- Interactions: dating log of meetings/conversations
- Shared life events: Life Calendar events tagged with this person (title, date, status)
- Facts, Projects

**Last interaction**: Shown on the person card in the list view.

### Health (`health.js`)

**Plan document**: `Health.md`

A comprehensive medical tracking hub.

**Firestore collections** (all under `userCol`):

| Collection | Key Fields |
|------------|------------|
| `healthVisits` | date, provider, providerType, reason, whatWasDone, outcome, cost, notes |
| `medications` | name, dosage, purpose, prescribedBy, startDate, endDate, status (active/completed), type (Ongoing/Short-term/As-needed) |
| `healthConcerns` | title, bodyArea, startDate, status (open/resolved), resolvedDate, summary |
| `healthConcernLogs` | concernId, date, note, painScale |
| `healthConditions` | name, category, diagnosedDate, diagnosedBy, status (active/managed/resolved), managementNotes |
| `bloodWork` | date, lab, orderedBy, notes, markers[] (name/value/unit/referenceRange/flagged) |
| `vitals` | date, time, type (BP/HR/O2/Glucose/Temp/Other), value1, value2, unit, notes |
| `supplements` | name, dosage, brand, reason, frequency, startDate, endDate, status (active/stopped) |
| `vaccinations` | name, date, dateApproximate, provider, lotNumber, nextDueDate |
| `eyePrescriptions` | date, type (Distance/Reading), rightEye{}, leftEye{}, pd, provider |
| `insurance` | provider, policyNumber, groupNumber, memberId, copay, deductible, photoDocuments[] |
| `emergencyInfo` | emergencyContacts[], allergies[], medicalAdvances, dnr, notes |
| `appointments` | date, time, provider, location, reason, notes, completed |

**Routes**: `#health`, `#health-visits`, `#health-visit/{id}`, `#health-medications`, `#health-conditions`, `#health-concerns`, `#health-concern/{id}`, `#health-bloodwork`, `#health-bloodwork-detail/{id}`, `#health-vitals`, `#health-supplements`, `#health-vaccinations`, `#health-eye`, `#health-insurance`, `#health-insurance-detail/{id}`, `#health-emergency`, `#health-appointments`, `#health-allergies`

**Blood Work LLM Import**: User pastes lab report text → LLM extracts structured markers (name, value, unit, reference range, flagged status) → editable preview before save.

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

### Life Calendar (`lifecalendar.js`)

**Plan document**: `LifeCalendar.md`

Tracks major life events — trips, milestones, goals, relationships.

**Firestore**:
- `lifeEvents` — `title`, `description`, `startDate`, `endDate?`, `location?`, `categoryId?`, `status` (upcoming/in-progress/completed/past), `peopleIds[]`, `notes?`, `miniLogEnabled`, `createdAt`
- `lifeCategories` — `name`, `color`, `createdAt`
- `lifeEventLogs` — `logDate`, `logTime`, `body`, `eventId`, `mentionedPersonIds[]`, `createdAt`

**Routes**: `#life-calendar` (list), `#life-event/{id}` (detail/edit), `#life-event/new` (create)

**Event Form**:
- Title, start date, end date (with validation — end date cannot be before start date)
- Category (color-coded), status dropdown, location, people tags, description
- Mini log textarea (journal-style notes attached to the event)
- Top-level Save button (next to title) and bottom Save button
- Save auto-closes and returns to `#life-calendar`

**Status**: Events auto-transition between upcoming/in-progress/completed/past based on dates.

**People linking**: Events can tag multiple people from the `people` collection. Linked events appear on each person's detail page.

**Mini logs**: Inline journal-style entries attached to a life event. Appear in the main journal feed (togglable).

---

## Part 9: AI / LLM Features

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
| `UNKNOWN_ACTION` | LLM could not determine intent — no action taken |

**Help screen**: Built-in help listing all actions with icons, labels, descriptions, and example utterances. Maintained in `SB_HELP_ACTIONS` array — **must be kept in sync when new actions are added**.

### Weed Identification (LLM)
See [Yard: Weeds](#weeds-weedsjs) above.

### Blood Work Import (LLM)
See [Life: Health](#health-healthjs) above.

### House/Collection LLM Photo ID
See [House: LLM Photo Identification](#llm-photo-identification-house) and [Collections: LLM Identification](#llm-identification-for-collections) above.

---

## Part 10: Shared Features

These features are used across multiple sections. The implementation lives primarily in dedicated JS files.

### Photos (`photos.js`)

**Firestore**: `photos` — `targetType`, `targetId`, `imageData` (Base64 JPEG), `caption`, `takenAt`, `createdAt`

**Key fields**:
- `targetType`: identifies the entity type (e.g., `plant`, `zone`, `thing`, `subthing`, `item`, `collectionitem`, `person`, `vehicle`, `weed`, `chemical`, etc.)
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
- `activities` — `targetType`, `targetId`, `description`, `notes`, `date`, `chemicalIds[]`, `savedActionId?`, `createdAt`
- `savedActions` — `name`, `description`, `chemicalIds[]`, `notes`, `createdAt`

**Log activity modal**:
- Date picker (defaults to today)
- Description text (pre-filled if saved action selected)
- Notes textarea
- Chemical multi-select: checkbox list of all chemicals, supports selecting multiple
- "Use Saved Action" dropdown: pre-fills description and chemical selection

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

**Used by**: All entity types

### Projects (`projects.js`)

**Firestore**: `projects` — `targetType`, `targetId`, `title`, `notes`, `status` (active/completed), `items[]` (array of `{text, done, completedAt, notes}`), `completedAt`, `createdAt`

**UI**: Collapsible cards — collapsed shows title + item count badge; expanded shows full checklist.

**Checklist items**: Click item to toggle done. Completion timestamp recorded per item. Notes can be added to individual items.

**Project completion**: Mark entire project as complete → sets `completedAt`.

**Show completed**: Checkbox to toggle visibility of completed projects.

**Roll-up**: Same pattern as Problems — parent entities aggregate all descendant projects.

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

## Part 11: Navigation & Routing

The app has three navigation contexts, each with its own nav bar:

| Context | Nav Items |
|---------|-----------|
| **Yard** | Home (zones), Weeds, Products (chemicals), Calendar, Activity Report, Saved Actions, Bulk Activity, Structures, Search |
| **House** | House (floors), Garage, Vehicles, Checklists |
| **Life** | Journal, People, Health, Notes, Collections, Life Calendar, SecondBrain, Chat |

**Shared pages** (retain last active context): Settings, Change Password, GPS Map

**Mobile nav**: Hamburger menu that toggles a full-screen overlay. Desktop nav: horizontal bar.

**Breadcrumb bar**: Sticky header below the nav bar showing the current hierarchy (e.g., "House › 1st Floor › Kitchen"). Built dynamically on each page load into `document.getElementById('breadcrumbBar')`.

**Context switching**: Tapping "My House" logo navigates to `#home` and sets yard context. Separate nav items switch between House and Life contexts.

---

## Part 12: Testing

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

## Part 13: Deployment

- **Hosting**: GitHub Pages — live at `https://dolphinstevekasputis.github.io/BishopHome`
- **GitHub username**: `DolphinSteveKasputis`
- **Branch**: `main` (deployed automatically from main branch)
- **Push protocol**: Always send the ntfy.sh notification before `git push` — Windows requires a credential confirmation prompt:
  ```
  curl -d "Ready to push — please confirm the Windows prompt" ntfy.sh/WolfLifeBishop
  ```
- **Notifications**: Task completion notifications sent to `ntfy.sh/WolfLifeBishop`

---

## Part 14: Firestore Data Model

All collections live under `/users/{uid}/`. Every module uses `userCol('collectionName')` to scope reads/writes.

### Yard

| Collection | Key Fields |
|------------|------------|
| `zones` | name, parentId, level (1/2/3), createdAt |
| `plants` | name, zoneId, metadata{}, profilePhotoData?, createdAt |
| `weeds` | name, treatmentMethod, applicationTiming, notes, zoneIds[], profilePhotoData?, createdAt |
| `chemicals` | name, notes, createdAt |
| `activities` | targetType, targetId, description, notes, date, chemicalIds[], savedActionId? |
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
| `people` | name, nickname, category, phone, email, address, facebookUrl, howKnown, notes, profilePhotoData?, parentPersonId?, createdAt |
| `peopleImportantDates` | personId, label, month, day, year?, notes, createdAt |
| `peopleInteractions` | personId, date, notes, createdAt |
| `peopleCategories` | name, createdAt |
| `journalEntries` | date, entryTime, entryText, mentionedPersonIds[], sourceEventId?, createdAt, updatedAt |
| `journalTrackingItems` | date, category, value, createdAt |
| `journalCategories` | name, createdAt |
| `lifeEvents` | title, description, startDate, endDate?, location?, categoryId?, status, peopleIds[], notes?, miniLogEnabled, createdAt |
| `lifeCategories` | name, color, createdAt |
| `lifeEventLogs` | logDate, logTime, body, eventId, mentionedPersonIds[], createdAt |
| `notebooks` | name, color, noteCount, createdAt, updatedAt |
| `notes` | notebookId, body, createdAt, updatedAt |

### Health

| Collection | Key Fields |
|------------|------------|
| `healthVisits` | date, provider, providerType, reason, whatWasDone, outcome, cost, notes |
| `medications` | name, dosage, purpose, prescribedBy, startDate, endDate, status, type |
| `healthConcerns` | title, bodyArea, startDate, status, resolvedDate, summary |
| `healthConcernLogs` | concernId, date, note, painScale? |
| `healthConditions` | name, category, diagnosedDate, diagnosedBy, status, managementNotes |
| `bloodWork` | date, lab, orderedBy, notes, markers[] |
| `vitals` | date, time, type, value1, value2?, unit, notes |
| `supplements` | name, dosage, brand, reason, frequency, startDate, endDate, status |
| `vaccinations` | name, date, dateApproximate, provider, lotNumber, nextDueDate |
| `eyePrescriptions` | date, type, rightEye{}, leftEye{}, pd, provider |
| `insurance` | provider, policyNumber, groupNumber, memberId, copay, deductible, photoDocuments[] |
| `emergencyInfo` | emergencyContacts[], allergies[], medicalAdvances, dnr, notes |
| `appointments` | date, time, provider, location, reason, notes, completed |

### Shared

| Collection | Key Fields |
|------------|------------|
| `photos` | targetType, targetId, imageData (Base64), caption, takenAt, createdAt |
| `facts` | targetType, targetId, label, value, createdAt |
| `problems` | targetType, targetId, description, notes, status, dateLogged, resolvedAt |
| `projects` | targetType, targetId, title, notes, status, items[], completedAt |
| `calendarEvents` | title, description, date, recurring{type,intervalDays}?, targetType?, targetId?, zoneIds[], savedActionId?, completed, completedDates[], cancelledDates[] |

### Settings

| Path | Fields |
|------|--------|
| `settings/llm` | provider, apiKey, model? |
| `settings/journal` | defaultDateRange |
