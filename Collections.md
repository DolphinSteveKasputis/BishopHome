# Collections Feature Plan

## Overview
A dedicated Collections section for tracking physical collections (comics, records, hat pins, etc.).
Accessible from a new tile on the home screen AND from the House nav bar.
Designed around a collection-first view — location is secondary, not primary.

---

## Navigation & Routing
- Home screen tile: **Collections** → `#collections`
- Collections link also appears in the **House nav bar** (visible only when in House mode)
- `#collections` — list of all collections
- `#collection/:id` — collection detail page (item list + filter)
- `#collectionitem/:id` — individual item detail page

---

## Collections List Page (`#collections`)
- Each collection shown as a card/row with:
  - Collection name
  - Collection type badge (Comics, Records, etc.)
  - Number of items
  - Total estimated worth (sum of all item estimatedValue fields)
- Add / Edit collection buttons per card
- **Delete is only on the item detail page** — not on the list

---

## Collection Detail Page (`#collection/:id`)
- Header: name, type, item count, total worth
- **Filter bar** (dynamic per type):
  - Comics → text search on **Series** only
  - Records/Albums → text search on **Artist** only
  - All others (Hat Pins, Beanie Babies, Stadiums, Generic) → text search on **Name**
- Full item list sorted per type (see Sorting section)
- Add Item button
- No delete on this screen — user goes to item detail to delete

---

## Sorting (per type)
| Type             | Sort Order                                      |
|------------------|-------------------------------------------------|
| Comics           | Series A→Z, then Issue # ascending             |
| Records/Albums   | Format A→Z, then Artist A→Z, then Name A→Z    |
| Hat Pins         | Name A→Z                                        |
| Beanie Babies    | Name A→Z                                        |
| Ceramic Stadiums | Name A→Z                                        |
| Generic          | Name A→Z                                        |

---

## Collection Types & Fields

### Base fields (all types):
| Field           | Notes                                  |
|-----------------|----------------------------------------|
| Name            | Required                               |
| Acquired Date   | Optional — older items may be unknown  |
| Price Paid      | Optional                               |
| Estimated Value | Optional                               |
| Notes           | Free text                              |
| Photos          | Camera + Gallery buttons               |

### Type-specific fields:

**Comics**
- Series (e.g., "Amazing Spider-Man") — used for filtering
- Issue # (e.g., 434)
- Publisher (e.g., Marvel, DC)
- Year

**Records / Albums**
- Artist (e.g., "Eagles") — used for filtering
- Label (e.g., Asylum Records)
- Format (LP / 45 / Cassette / CD / 8-Track) — used for sorting
- Year

**Hat Pins**
- No type-specific fields — base fields only

**Beanie Babies**
- Style (e.g., "Peanut the Elephant")
- Year
- Has Tags (Yes / No checkbox)

**Ceramic Stadiums**
- Team (e.g., "Boston Red Sox")
- Year

**Generic**
- When creating or editing a Generic collection, the user names the 3 labels
  (e.g., Label 1 = "Brand", Label 2 = "Model", Label 3 = "Color")
- Label names are stored on the **collection doc** (`label1`, `label2`, `label3`)
  so each Generic collection has its own independent label scheme
- All 3 labels are always shown on every item — values are optional
- Each item stores `value1`, `value2`, `value3` corresponding to those labels
- On screen, labels show their custom names — behind the scenes always value1/2/3
- Items filtered by Name search

---

## Item Detail Page (`#collectionitem/:id`)
- Displays all base + type-specific fields
- Edit button (opens edit modal)
- Delete button (confirm before delete, returns to collection page)
- Location assignment section (optional)
- Photos section (Camera + Gallery buttons)

---

## Location Assignment
- Optional — can be left blank
- Assignable to:
  - House rooms (any room in the house)
  - House things (e.g., "Bookshelf" in the Office room)
  - Garage rooms (Garage, Attic)
- NOT assignable to: structures, subthings
- UI: dropdown/picker grouped by location type
- When assigned, shows room/thing name on item detail
- Reference info only — item does NOT appear on the room's page

---

## Firestore Collections

| Collection        | Key Fields                                                                                      |
|-------------------|-------------------------------------------------------------------------------------------------|
| `collections`     | name, type, label1, label2, label3, description, createdAt                                      |
| `collectionItems` | collectionId, name, typeData{}, locationRef{locType,locId}, acquiredDate, pricePaid, estimatedValue, notes, createdAt |

### typeData{} by type:
- **Comics**: `{ series, issueNumber, publisher, year }`
- **Records**: `{ artist, label, format, year }`
- **Hat Pins**: `{}`
- **Beanie Babies**: `{ style, year, hasTags }`
- **Ceramic Stadiums**: `{ team, year }`
- **Generic**: `{ value1, value2, value3 }` (labels come from parent collection doc)

### locationRef{}:
- `{ locType: 'houseroom' | 'housething' | 'garageroom', locId: string }`

---

## New File
- `js/collections.js`

## Modified Files
- `index.html` — new pages, modals, home tile, House nav bar link, script tag
- `js/app.js` — routing for all 3 collection routes
- `js/settings.js` — add `collections`, `collectionItems` to backup collections

---

## Decisions Log
- Location is reference info only — items do NOT appear on room's things list
- No assignment to structures or subthings
- Condition field deferred — not needed now
- One big collection per type with a filter field (not one collection per series/artist)
- Preset types: Comics, Records/Albums, Hat Pins, Beanie Babies, Ceramic Stadiums, Generic
- Base fields universal across all types: name, acquiredDate, pricePaid, estimatedValue, notes, photos
- Hat Pins: no type-specific fields
- Beanie Babies: tracks Has Tags (yes/no)
- Ceramic Stadiums: Team + Year
- Generic: 3 label names defined per collection (stored on collection doc as label1/2/3); all 3 always shown, values optional per item
- Filter is text search, not dropdown — dynamic per type
- Delete only from item detail page, not from list screens
- No cover photo for now
- Sorting is fixed per type (not user-selectable)
- Comics sorted by Series then Issue #
- Records sorted by Format, then Artist, then Name
- All others sorted by Name
