# Vehicles Feature Plan

## Overview
Track vehicles with full history — maintenance activities, mileage logs, photos, calendar reminders, problems, facts, and future projects. Mirrors the patterns already used by House (Things) and Yard (Plants).

A new **Vehicles** tile is added to the home screen. The existing "Garage / Coming soon" tile is left as-is for a future separate feature.

---

## Decisions Made

| Topic | Decision |
|---|---|
| Home tile | New "Vehicles" tile added alongside existing Yard, House, Garage tiles |
| Garage tile | Left unchanged ("Coming soon") — Vehicles is a separate feature |
| Nav bar | No nav context for Vehicles — user returns to home via the header link |
| Saved actions | Unchanged — works automatically for vehicle activities |
| Mileage | Own Firestore collection (`mileageLogs`) |

---

## Navigation

- **Home screen**: new "Vehicles" tile → navigates to `#vehicles`
- **No nav bar changes** — top nav stays as-is; user returns home via the app title link
- **Routes**:
  - `#vehicles` — vehicle list page
  - `#vehicle/:id` — vehicle detail page

---

## Vehicle List Page (`#vehicles`)

- Page header: "Vehicles" + **+ Add Vehicle** button
- Shows all **active** (non-archived) vehicles in cards, one per row
- Each card shows: **Year Make Model**, color, license plate
- Clicking a card navigates to `#vehicle/:id`
- **Show Archived** toggle at the bottom — reveals a separate grayed-out section of archived vehicles

---

## Vehicle Record Fields

| Field          | Type      | Notes                                     |
|----------------|-----------|-------------------------------------------|
| year           | text      | e.g. "2021"                               |
| make           | text      | e.g. "Toyota"                             |
| model          | text      | e.g. "Tacoma"                             |
| trim           | text      | optional, e.g. "TRD Off-Road"             |
| color          | text      | e.g. "Cement Gray"                        |
| vin            | text      | 17-character VIN                          |
| licensePlate   | text      | plate number                              |
| purchaseDate   | text      | ISO date, e.g. "2021-04-15"               |
| purchasePrice  | text      | free text, e.g. "$32,500"                 |
| notes          | text      | general free-form notes                   |
| archived       | bool      | false by default; true when sold/gone     |
| archivedAt     | timestamp | set when archived                         |
| archivedReason | text      | optional — "Sold", "Traded in", etc.      |
| createdAt      | timestamp |                                           |

---

## Vehicle Detail Page (`#vehicle/:id`)

Sections in order:

1. **Vehicle Info** — editable fields (year, make, model, trim, color, VIN, license plate, purchase date, purchase price, notes). Save button.
2. **Mileage Log** — list of date + odometer entries, newest first. Add / delete entries.
3. **Photos** — standard photo gallery (`targetType: 'vehicle'`)
4. **Activity History** — standard activities (`targetType: 'vehicle'`)
5. **Calendar Events** — standard calendar events (`targetType: 'vehicle'`)
6. **Problems / Concerns** — standard problems (`targetType: 'vehicle'`)
7. **Facts** — standard facts (`targetType: 'vehicle'`)
8. **Future Projects** — standard projects (`targetType: 'vehicle'`)

**Archive / Unarchive** button at the bottom of the page.

---

## Mileage Log

Firestore collection: `mileageLogs`

| Field     | Type      | Notes                         |
|-----------|-----------|-------------------------------|
| vehicleId | string    | ID of the parent vehicle doc  |
| date      | string    | ISO date, e.g. "2025-06-01"   |
| mileage   | number    | odometer reading              |
| notes     | text      | optional                      |
| createdAt | timestamp |                               |

- Displayed newest-first on the detail page
- Add entry via small inline form: date, mileage, optional notes
- Delete: confirm then remove

---

## Add Vehicle Modal

Fields: year, make, model, trim, color, VIN, license plate, purchase date, purchase price, notes.
Required: year, make, model. All others optional.

---

## Archive Flow

- **Archive Vehicle** button on detail page (danger/secondary style)
- Prompts for an optional reason (e.g. "Sold", "Traded in", "Totaled")
- Sets `archived: true`, `archivedAt`, `archivedReason` on the document
- Vehicle disappears from the active list
- Archived vehicle detail page shows a banner: "Archived — [reason] on [date]"
- **Unarchive** button on the banner clears archived status and returns vehicle to the active list

---

## Firestore Collections

| Collection  | Key Fields                                                                                                 |
|-------------|------------------------------------------------------------------------------------------------------------|
| vehicles    | year, make, model, trim, color, vin, licensePlate, purchaseDate, purchasePrice, notes, archived, archivedAt, archivedReason, createdAt |
| mileageLogs | vehicleId, date, mileage, notes, createdAt                                                                 |

Existing cross-entity collections work automatically via `targetType: 'vehicle'`:
- activities, photos, problems, facts, projects, calendarEvents

---

## New File

`js/vehicles.js` — vehicle list, detail, mileage log, add/edit/archive logic

---

## Changes to Existing Files

| File             | Change                                                                                         |
|------------------|------------------------------------------------------------------------------------------------|
| index.html       | Add Vehicles tile to home screen; add `#page-vehicles` and `#page-vehicle` sections and modals |
| js/app.js        | Add `'vehicles'` to TOP_LEVEL_PAGES; add `'vehicle'` to ALL_PAGES; add routing cases           |
| js/settings.js   | Add `'vehicles'` and `'mileageLogs'` to `BACKUP_DATA_COLLECTIONS`                             |
| css/styles.css   | Vehicle card styles, mileage log table/list styles, archive banner style                       |

All other JS files (activities, photos, problems, facts, projects, calendar) need no changes.

---

## Build Phases

1. **Routing + list page** — new page section, Vehicles tile on home, Firestore CRUD, add modal, list UI
2. **Detail page** — vehicle info editing, archive/unarchive flow, archive banner
3. **Mileage log** — add/delete mileage entries on detail page
4. **Cross-entity sections** — wire in photos, activities, calendar, problems, facts, projects
5. **Polish + backup** — archived section on list, add collections to backup list, CSS cleanup
