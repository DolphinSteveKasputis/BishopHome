# Locations & Distances — Feature Plan

## Goal
Add a reusable `locations` collection so that any "place" (hotel, attraction, airport, restaurant) can be defined once and reused across projects. Distances between locations are stored globally and surfaced per-project during planning.

---

## Data Model

### User-Scoped Collections (under `users/{uid}/` — works with existing security rules, cross-project reuse within the account)

#### `locations`
One record per real-world place. Shared across all projects.
```
{
  name:        string       // "Mammoth Hot Springs"
  address:     string       // "Yellowstone National Park, WY"
  phone:       string
  website:     string       // URL
  contact:     string       // contact name or email
  notes:       string
  createdAt:   timestamp
}
```

#### `distances`
One record per from→to pair. Global so "Mammoth → Canyon Village = 25 min" is entered once and reused on any Yellowstone trip.
```
{
  fromLocationId:  string   // locations doc ID
  toLocationId:    string   // locations doc ID
  miles:           number   // optional
  time:            string   // "25 min", "1hr 45min"
  mode:            string   // "drive" | "walk" | "bike"
  notes:           string   // optional
}
```
- Distance is stored once; assumed approximately symmetric.
- When displaying, show both A→B and B→A from the same record.

### Per-Project Subcollection

#### `projectLocations` (subcollection on `lifeProjects`)
Tracks which locations are "in use" for this project. Lightweight — just a link.
```
{
  locationId:  string   // locations doc ID
  addedAt:     timestamp
}
```

### Updates to Existing Documents

#### Planning/Itinerary Items (embedded in `days.items[]` and `planningGroups.items[]`)
Add one optional field:
```
locationId:  string | null   // locations doc ID, null if not linked
```
Items that reference a real place get linked. Items like "Stop at CVS" or "Fly to Bozeman" can stay unlinked.

---

## UI — Locations Accordion (planning mode only)

**Location:** New accordion on the Life Project detail page, between People and To-Do.
Icon: 📍

**List view:**
- One row per location linked to this project
- Shows: name, address snippet
- Buttons per row: Edit (opens modal), Unlink (removes from project, keeps global record), Delete (removes global record — confirm first)

**Add Location modal:**
- **Search field** — type to filter existing locations by name. Shows a dropdown list. Selecting one links it to the current project (adds to `projectLocations`).
- **OR — "New location" section** below the search, always visible:
  - Name *, Address, Phone, Website, Contact, Notes
  - Checkbox: **"Add to Planning Board"** — when checked, a new planning item is created with this location's name and `locationId` set
  - Save → creates the global location doc → links to project → optionally creates planning item

**Item row buttons — icon-only with tooltips, max 4 per row:**

| Condition | Buttons shown |
|-----------|--------------|
| No location set | ⠿ drag · 📋 details · ✏️ edit · 📍 set location |
| Location is set  | ⠿ drag · 📋 details · ✏️ edit · 🛣️ add distance |

- All buttons are icon-only (no text labels). Each has a `title` tooltip.
- **Delete is removed from the row** — it lives inside the edit modal only.
- **📍 (set location):** visible only when `locationId` is null. Opens a compact picker: dropdown of this project's locations + "New location…" option.
- **🛣️ (add distance):** visible only when `locationId` is set. Opens the Add Distance modal with From pre-filled.
- To **change or clear** a linked location: done through the edit modal (location field with a "Clear" option).
- Applies to both **planning board items** and **itinerary items**.

**Location display on item row:**

*Collapsed:*
- Small badge inline on the row showing the location name (e.g. `📍 Mammoth Hot Springs`)
- Hovering the badge shows a tooltip with: name, address, phone

*Expanded (detail panel open):*
- Location gets its own dedicated row at the top of the detail panel
- Shows: name, address, phone — full text, no truncation

---

## UI — Distances (planning mode only)

Distances are not a standalone entry form — they are created FROM a planning item.

### Creating a distance

On each planning item row, an **"Add Distance" button** (or 🛣️ icon):
- **From** = the current item's linked location (required — if no location is set yet, prompt to set one first)
- Opens a small modal:
  - **To:** dropdown of all locations already linked to this project (excludes the From location)
  - **Time:** text ("25 min", "1hr 45min")
  - **Miles:** number (optional)
  - **Mode:** Drive / Walk / Bike (select)
  - **Notes:** text (optional)
- Saves to the global `distances` collection

### Viewing distances

A **Distances accordion** on the project (planning mode only, icon 🛣️):
- Read-mostly reference list — shows all distances where both locations are in this project
- Displayed as: **From → To | Time | Miles | Mode** with a Delete button
- No standalone "Add" button here — always create from a planning item
- Edit: clicking a row opens the same modal pre-filled (in case you need to correct time/miles)

---

## JSON Import Format Changes

Add two top-level arrays to the import JSON:

```json
{
  "locations": [
    {
      "id": "loc_mammoth",
      "name": "Mammoth Hot Springs",
      "address": "Yellowstone National Park, WY",
      "phone": "",
      "website": "",
      "contact": "",
      "notes": ""
    },
    ...
  ],
  "distances": [
    {
      "fromLocationId": "loc_mammoth",
      "toLocationId": "loc_canyon",
      "miles": 18,
      "time": "25 min",
      "mode": "drive",
      "notes": ""
    },
    ...
  ],
  "days": [...],
  "planningGroups": [...],
  ...
}
```

- Items in `days[].items[]` and `planningGroups[].items[]` get an optional `"locationId": "loc_mammoth"` field using the JSON ID (not the Firestore ID).

### Import Flow (additions to `_lpExecuteImport`):
1. **Locations first** — for each location in JSON:
   - Check if a location with the same name already exists in Firestore (avoid dupes)
   - If exists: use existing doc ID
   - If new: create doc, capture Firestore ID
   - Build a map: `{ json_id → firestore_id }`
2. **Link locations to project** — batch-write to `projectLocations` subcollection
3. **Distances** — for each distance in JSON, map `fromLocationId`/`toLocationId` through the ID map, write to global `distances` collection (skip if already exists for this pair)
4. **Days/planning items** — when creating items, map `locationId` through the ID map

---

## Build Phases

### Phase 1 — Locations accordion + global collection
- Locations accordion UI: list, add modal (search + new form + "Add to Planning Board")
- Firestore reads/writes for `locations` + `projectLocations`
- Unlink and delete

### Phase 2 — Location picker on items + row button refactor
- Remove ✕ delete from item rows on both planning board and itinerary (delete stays in edit modal)
- All remaining row buttons become icon-only with `title` tooltips
- 📍 button: visible only when no locationId set — compact picker (project locations + "New location…")
- 🛣️ button: visible only when locationId is set — Add Distance modal (From pre-filled)
- Add location field to item edit modal (dropdown of project locations + "Clear" option)
- Applies to both planning board items and itinerary items

### Phase 3 — Distances
- 🛣️ Add Distance modal: To dropdown (project locations, excludes From), Time, Miles, Mode, Notes
- Distances accordion: reference list (From → To | Time | Miles | Mode), Edit + Delete per row
- Firestore reads/writes for global `distances` collection
- Applies to both planning board and itinerary items

### Phase 4 — JSON + Importer
- Update `yellowstone-2024.json` with `locations[]`, `distances[]`, and `locationId` on items
- Update `_lpExecuteImport` with the new steps above

---

## Open Questions (resolved)
- **Tight or loose coupling?** → Tight — items optionally link to a location via `locationId`
- **Global or per-project distances?** → Global `distances` collection; filtered by project's location set
- **Convert existing data?** → No. New import handles it; existing items stay as-is

---

## Files to Touch
- `js/life-projects.js` — accordions, item row buttons, location picker, import
- `index.html` — version bump
- `imports/yellowstone-2024.json` — add locations + distances arrays, wire locationIds on items
- `MyLife-Functional-Spec.md` — update Life Projects section

---

## What Does NOT Change
- The `facts` feature on items stays — facts are for ad-hoc item-specific info
- Planning items without a real-world place stay unlinked (no locationId required)
- Existing imported Yellowstone data is not re-imported until Phase 4 is done
