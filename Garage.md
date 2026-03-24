# Garage Feature Plan

## Overview
The Garage is a mini-House with exactly 2 fixed rooms: **Garage** and **Attic**. No floors, no floor plans, no breaker panel. Both rooms support the full suite of cross-entity features (photos, activities, problems, facts, projects) and contain Things with SubThings, identical to the House.

The existing "Garage / Coming soon" tile on the home screen activates and routes to `#garage`. No nav bar changes.

---

## Decisions Made

| Topic | Decision |
|---|---|
| Home tile | Existing "Garage / Coming soon" tile activates → `#garage` |
| Nav bar | No nav context — user returns home via the app title link |
| Rooms | 2 fixed rooms: "Garage" and "Attic", auto-created on first visit |
| Room rename | Yes — rooms can be renamed (same as House rooms) |
| Floors | None — garage goes straight to rooms |
| Floor plan | None |
| Breaker panel | None |
| Things / SubThings | Yes — same as House |
| Room features | Photos, activities, problems, facts, projects (same as House rooms) |
| Thing features | Photos, activities, problems, facts, projects, purchase date, worth (same as House things) |
| SubThing features | Same as House subthings |

---

## Navigation

- **Home screen**: "Garage" tile → `#garage`
- **No nav bar changes** — user returns home via the app title link
- **Routes**:
  - `#garage` — garage home (2 room cards)
  - `#garageroom/:id` — room detail page
  - `#garagething/:id` — thing detail page
  - `#garagesubthing/:id` — subthing detail page

---

## Garage Home Page (`#garage`)

- Page header: "Garage"
- Shows 2 room cards: **Garage** and **Attic**
- Rooms are auto-created in Firestore on first visit if they don't exist yet
- Each card: room name, click to navigate to `#garageroom/:id`
- No "Add Room" button — the 2 rooms are fixed

---

## Garage Room Page (`#garageroom/:id`)

Sections in order:

1. **Room Info** — room name (editable, save button)
2. **Photos** — standard photo gallery (`targetType: 'garageroom'`)
3. **Things** — list of things in this room + **+ Add Thing** button. Each thing card navigates to `#garagething/:id`
4. **Activity History** — standard activities (`targetType: 'garageroom'`)
5. **Calendar Events** — standard calendar events (`targetType: 'garageroom'`)
6. **Problems / Concerns** — standard problems (`targetType: 'garageroom'`)
7. **Facts** — standard facts (`targetType: 'garageroom'`)
8. **Future Projects** — standard projects (`targetType: 'garageroom'`)

---

## Garage Thing Page (`#garagething/:id`)

Mirrors the House Thing page exactly.

Sections in order:

1. **Thing Info** — name, category, description, purchase date, worth, notes (editable, save button)
2. **Photos** — standard photo gallery (`targetType: 'garagething'`)
3. **SubThings** — list of subthings + **+ Add SubThing** button. Each subthing card navigates to `#garagesubthing/:id`
4. **Activity History** — standard activities (`targetType: 'garagething'`)
5. **Calendar Events** — standard calendar events (`targetType: 'garagething'`)
6. **Problems / Concerns** — standard problems (`targetType: 'garagething'`)
7. **Facts** — standard facts (`targetType: 'garagething'`)
8. **Future Projects** — standard projects (`targetType: 'garagething'`)
9. **Delete Thing** button at bottom

---

## Garage SubThing Page (`#garagesubthing/:id`)

Mirrors the House SubThing page exactly.

Sections in order:

1. **SubThing Info** — name, description, purchase date, worth, notes (editable, save button)
2. **Photos** — standard photo gallery (`targetType: 'garagesubthing'`)
3. **Activity History** — standard activities (`targetType: 'garagesubthing'`)
4. **Calendar Events** — standard calendar events (`targetType: 'garagesubthing'`)
5. **Problems / Concerns** — standard problems (`targetType: 'garagesubthing'`)
6. **Facts** — standard facts (`targetType: 'garagesubthing'`)
7. **Future Projects** — standard projects (`targetType: 'garagesubthing'`)
8. **Delete SubThing** button at bottom

---

## Data Model (Firestore Collections)

New garage-specific collections keep garage data separate from house data.

| Collection      | Key Fields                                                                 |
|-----------------|----------------------------------------------------------------------------|
| garageRooms     | name, order (1 or 2), createdAt                                            |
| garageThings    | name, roomId, category, description, purchaseDate, worth, notes, createdAt |
| garageSubThings | name, thingId, description, purchaseDate, worth, notes, createdAt          |

Cross-entity collections work automatically via `targetType`:
- activities, photos, problems, facts, projects, calendarEvents → `targetType: 'garageroom'` / `'garagething'` / `'garagesubthing'`

---

## Auto-Create Rooms on First Visit

When `loadGaragePage()` runs, it queries `userCol('garageRooms')`. If the collection is empty, it creates the 2 default rooms:

```
{ name: 'Garage', order: 1, createdAt: ... }
{ name: 'Attic',  order: 2, createdAt: ... }
```

Subsequent visits just load what's there. This is a one-time seed — no migration needed.

---

## New File

`js/garage.js` — all garage logic: home page, room detail, thing detail, subthing detail, add/edit/delete modals, auto-create rooms

---

## Changes to Existing Files

| File           | Change                                                                                                             |
|----------------|--------------------------------------------------------------------------------------------------------------------|
| index.html     | Activate Garage tile (change from disabled div to `<a href="#garage">`); add `#page-garage`, `#page-garageroom`, `#page-garagething`, `#page-garagesubthing` sections; add modals for add-thing, add-subthing, rename-room |
| js/app.js      | Add `'garage'` to `TOP_LEVEL_PAGES`; add `'garageroom'`, `'garagething'`, `'garagesubthing'` to `ALL_PAGES`; add routing cases for all 4 routes |
| js/settings.js | Add `'garageRooms'`, `'garageThings'`, `'garageSubThings'` to `BACKUP_DATA_COLLECTIONS`                           |
| css/styles.css | Garage room card styles; reuse existing thing/subthing styles where possible                                       |

All other JS files (activities, photos, problems, facts, projects, calendar) need no changes.

---

## Build Phases

1. **Routing + garage home** — activate tile, page section, auto-create 2 rooms, room cards
2. **Room detail page** — room info (rename), things list, all cross-entity sections
3. **Thing detail page** — thing info, subthings list, all cross-entity sections
4. **SubThing detail page** — subthing info, all cross-entity sections
5. **Polish + backup** — add collections to backup list, CSS cleanup
