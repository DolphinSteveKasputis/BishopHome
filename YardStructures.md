# YardStructures.md — Plan Document

## Overview
Track outdoor structures in the yard (sheds, fences, firepits, playground sets, etc.).
Structures behave like a single room from the House feature, with an optional "storage" mode
that enables Things and SubThings tracking inside the structure.

This plan also covers two cross-cutting changes:
1. **Unified thing categories** across House, Garage, and Structures
2. **Move Things/SubThings** across all three contexts

---

## Navigation
- "Structures" is added as a link in the **Yard nav bar** (same bar that has Zones, Weeds, etc.)
- Routes to `#structures`
- No top-level home screen tile — only accessible from within the Yard section

---

## Structures List Page (`#structures`)
- Displays all structures as cards (name, storage badge if enabled)
- **Add Structure** button — opens add modal (name + storage toggle)
- Each card has **Edit** and **Delete** buttons
- Edit modal: name + storage toggle (toggle disabled/greyed out with tooltip if things exist)
- Delete: standard confirmation dialog

### Firestore Collection: `structures`
| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Required |
| `isStorage` | boolean | Enables Things/SubThings tracking |
| `createdAt` | timestamp | |

---

## Structure Detail Page (`#structure/:id`)
Behaves exactly like a single room in the House feature.

### Sections (always visible):
- **Photos** — `targetType: 'structure'`, `targetId: id`
- **Activities** — same cross-entity pattern
- **Calendar Events** — same cross-entity pattern
- **Problems / Concerns** — same
- **Facts** — same
- **Projects** — same

### Storage Section (visible only when `isStorage = true`):
- **Things** list with **Add Thing** button
- Shows things belonging to this structure
- Clicking a thing navigates to `#structurething/:id`

### Storage Toggle Rules:
- Toggle can be turned OFF only if no things exist for this structure
- If things exist, toggle shows as disabled with a note: "Remove all items first to disable storage"

---

## Structure Things (`#structurething/:id`)
Same model as House and Garage things.

### Firestore Collection: `structureThings`
| Field | Type | Notes |
|-------|------|-------|
| `structureId` | string | Parent structure |
| `name` | string | Required |
| `category` | string | From unified category list |
| `description` | string | |
| `purchaseDate` | string | ISO date |
| `worth` | number | Estimated value |
| `notes` | string | |
| `createdAt` | timestamp | |

### Thing Detail Sections:
- Thing info card (category, description, purchaseDate, worth, notes) + Edit button
- **Photos** — `targetType: 'structurething'`
- **SubThings** list + Add SubThing button
- **Activities, Calendar Events, Problems, Facts, Projects** — all cross-entity
- **Move** button — see Move Things section below
- **Delete** button

### "From Picture" LLM Identification:
- Same pattern as House and Garage things
- Camera + gallery inputs in Add Thing modal
- Sends photo to LLM with prompt for: name, description, worth estimate, category suggestion
- Review modal to confirm before saving
- Only available if LLM is configured in Settings

---

## Structure SubThings (`#structuresubthing/:id`)
Same model as House and Garage subthings.

### Firestore Collection: `structureSubThings`
| Field | Type | Notes |
|-------|------|-------|
| `thingId` | string | Parent thing |
| `name` | string | Required |
| `description` | string | |
| `purchaseDate` | string | ISO date |
| `worth` | number | |
| `notes` | string | |
| `createdAt` | timestamp | |

### SubThing Detail Sections:
- SubThing info card + Edit button
- **Photos, Activities, Calendar Events, Problems, Facts, Projects** — all cross-entity
- **Move** button — see Move Things section below
- **Delete** button

---

## Calendar Integration
- Structure calendar events use `targetType: 'structure'` / `targetId: id`
- Events appear on:
  - The **Structure detail page** (scoped to that structure)
  - The **Yard home page** calendar summary (alongside zone events)
  - The **Main calendar page** (`#calendar`) — shows all events app-wide

---

## Unified Thing Categories (Cross-Cutting Change)
All thing modals across **House**, **Garage**, and **Structures** will use the same category list:

| Value | Display Label |
|-------|--------------|
| `appliance` | Appliance |
| `furniture` | Furniture |
| `electronics` | Electronics |
| `fixture` | Fixture |
| `tools` | Tools |
| `power-tools` | Power Tools |
| `auto` | Auto |
| `chemical` | Chemical |
| `other` | Other |

**Files to update:**
- `index.html` — all three thing modals (houseThingModal, garageThingModal, new structureThingModal)
- No JS changes needed — category is just a string value

---

## Move Things / SubThings (Cross-Cutting Change)

### Concept
A **Move** button appears on every Thing and SubThing detail page across House, Garage, and Structures.
Opens a shared move modal that lets the user pick a destination.

### Move a Thing
Destinations:
- Any **House room** (from `rooms` collection)
- Either **Garage room** (Garage or Attic, from `garageRooms`)
- Any **Structure with `isStorage = true`** (from `structures`)

What moves:
- The thing doc itself — its reference field is updated (`roomId` → `null`, new `structureId` set, etc.)
- All subthings automatically follow (they reference `thingId` which doesn't change)
- All cross-entity data (activities, photos, facts, problems, projects, calendar events) automatically follows — they reference `targetType/targetId` which doesn't change

### Move a SubThing (Two Options)
**Option A — Move to another Thing** (stays a subthing):
- Pick any Thing across House, Garage, or Structures as the new parent
- Just updates `thingId` on the subthing doc
- All cross-entity data follows automatically

**Option B — Promote to standalone Thing** (becomes a Thing):
- Pick a destination room/garage room/structure
- Creates a new Thing doc at the destination with the subthing's name/description/worth/purchaseDate/notes
- Migrates all cross-entity docs by updating `targetType` and `targetId` to match the new thing
- Deletes the old subthing doc
- Navigates to the new thing's detail page

### Move Modal UI
Single shared modal (`moveThingModal`) used by all contexts:
- Dropdown or grouped list of destinations, organized by section:
  - 🏠 **House** → [list of rooms]
  - 🚗 **Garage** → Garage, Attic
  - 🏚️ **Structures** → [list of storage structures]
- For SubThing moves: radio or tab to choose "Move to another Thing" vs "Promote to standalone Thing"
- Confirm / Cancel buttons

---

## Data Model Summary

| Collection | Key Fields |
|------------|-----------|
| `structures` | name, isStorage, createdAt |
| `structureThings` | structureId, name, category, description, purchaseDate, worth, notes |
| `structureSubThings` | thingId, name, description, purchaseDate, worth, notes |

Cross-entity targetTypes:
- `'structure'` → structures
- `'structurething'` → structureThings
- `'structuresubthing'` → structureSubThings

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `js/structures.js` | New file — all structure/thing/subthing logic |
| `js/moveThings.js` | New file — shared move modal logic (cross-cutting) |
| `index.html` | New pages + modals; update category lists in all 3 thing modals; yard nav bar link; script tags |
| `js/app.js` | Add `#structures`, `#structure/:id`, `#structurething/:id`, `#structuresubthing/:id` routing |
| `js/yard.js` or `js/zones.js` | Add "Structures" to yard nav bar |
| `js/settings.js` | Add structures, structureThings, structureSubThings to BACKUP_DATA_COLLECTIONS |
| `css/styles.css` | Structure card styles; move modal styles |

---

## Implementation Phases

### Phase 1 — Structures Core
- Structures list page: add/edit/delete structures
- Structure detail page: all cross-entity sections (no things yet)
- Yard nav bar link

### Phase 2 — Things & SubThings in Structures
- Things list on structure detail (when isStorage = true)
- Thing detail page with all sections
- SubThings within things
- "From Picture" LLM identification for things

### Phase 3 — Unified Categories
- Update all three thing modals with the full unified category list

### Phase 4 — Move Things (Cross-Cutting)
- Move modal shared across House, Garage, Structures
- Move a Thing to any destination
- Move a SubThing (to another thing or promote to standalone)

---

## Open Questions / Future Considerations
- Should structures eventually be linkable to a specific yard **zone**? (e.g. "Shed is in the Back Yard zone") — deferred for now
- Should structure things appear in a global "all things" inventory view someday? — deferred
- Category list is currently hardcoded in HTML — if it grows, consider moving to Firestore `settings` doc

---

*Status: PLANNING — no implementation started*
