# SubThingItems — Plan Document

## Overview

Adds a fourth level of depth to the House hierarchy beneath SubThings.
A SubThing (e.g. a desk drawer) can contain Items (e.g. a stapler, a notepad).
Items are the terminal level — they cannot have children.

---

## Hierarchy (after this feature)

```
Floor
  └── Room          (floorId → floor)
        └── Thing   (roomId → room)
              └── SubThing   (thingId → thing)
                    └── Item (subThingId → subThing)   ← NEW
```

**Real-world example:**
- Room: Office
- Thing: Desk
- SubThing: Top Right Drawer
- Items: Stapler, Notepad, Pen, Tape

---

## Firestore Data Model

### New collection: `subThingItems`

| Field         | Type      | Notes                                      |
|---------------|-----------|--------------------------------------------|
| `subThingId`  | string    | Parent subThing document ID                |
| `name`        | string    | Item name                                  |
| `description` | string    | Optional longer description                |
| `notes`       | string    | Free-form notes                            |
| `pricePaid`   | number    | Optional — what was paid                   |
| `worth`       | number    | Optional — current estimated value         |
| `yearBought`  | number    | Optional — year purchased                  |
| `purchaseDate`| string    | Optional — full date (YYYY-MM-DD)          |
| `tags`        | string[]  | Same global tag vocabulary as subThings    |
| `createdAt`   | timestamp | Server timestamp on creation               |

### Cross-entity pattern

Items participate in the existing `targetType`/`targetId` pattern used by all other entities.

| Collection      | targetType value |
|-----------------|-----------------|
| problems        | `'item'`        |
| facts           | `'item'`        |
| projects        | `'item'`        |
| activities      | `'item'`        |
| photos          | `'item'`        |
| calendarEvents  | `'item'`        |

---

## Routing

| Hash               | Page ID      | Function             |
|--------------------|--------------|----------------------|
| `#item/{itemId}`   | `item`       | `loadItemDetail(id)` |

Items do not have a standalone list page — they are always accessed through their parent SubThing's detail page.

---

## Navigation & Breadcrumbs

Full breadcrumb chain for an Item detail page:
```
House › Floor Name › Room Name › Thing Name › SubThing Name › Item Name
```

Back button on Item detail page navigates to the parent SubThing: `#subthing/{subThingId}`.

---

## Page: Item Detail (`#item/{id}`)

Mirrors the SubThing detail page in structure. Sections:

- **Header**: Item name, breadcrumb, Edit / Delete buttons
- **Inventory details**: pricePaid, worth, yearBought, purchaseDate, description, notes
- **Tags**: displayed as `#tag1 #tag2` (same tag system as subThings)
- **Problems** (targetType: `item`)
- **Facts** (targetType: `item`)
- **Projects** (targetType: `item`)
- **Activities** (targetType: `item`)
- **Photos** (targetType: `item`)
- **Calendar Events** (targetType: `item`)

---

## SubThing Detail Page — changes

The SubThing detail page gains an **Items** section at the bottom (mirroring how Thing detail shows SubThings):

- Section header: "Items" with an "+ Add Item" button
- Items listed as cards: name, tag chips, Edit / Delete buttons
- Clicking item name navigates to `#item/{itemId}`
- Empty state: "No items yet. Tap + Add Item."

---

## Add / Edit Item Modal

Single modal reused for both add and edit modes (same `dataset.mode` / `dataset.editId` pattern).

Fields:
- Name (required)
- Description
- Notes
- Price Paid
- Worth
- Year Bought
- Purchase Date
- Tags (same tag input as subThings)

---

## Delete Behavior

### Deleting a SubThing
- If the subThing has any Items, deletion is **blocked** with an alert:
  > "This sub-item has items. Delete all items first."
- This mirrors the existing guard on Things (blocked if it has SubThings).

### Deleting an Item
- Deletes the `subThingItems` document
- Deletes all cross-entity records: problems, facts, projects, activities, photos, calendarEvents where `targetType === 'item'` and `targetId === itemId`
- No children to cascade to (Items are terminal)

---

## Global Things Search Page (`#things`)

The existing global Things search page (`loadThingsPage`) currently indexes Things and SubThings. Items will be added as a third row type in the results, displayed with a deeper indent or a distinct label showing the full path (Thing › SubThing › Item).

---

## SecondBrain Changes

### Context builder (`_sbBuildContext`)

Extend the house hierarchy walk to include Items:

```
subThingsById[id].items = []   ← new array
subThingItemsSnap → group by subThingId → push into parent subThing
```

The serialized context JSON will include items nested under their parent subThing:
```json
{
  "id": "abc",
  "name": "Top Right Drawer",
  "type": "subthing",
  "items": [
    { "id": "xyz", "name": "Stapler" },
    { "id": "uvw", "name": "Notepad" }
  ]
}
```

### System prompt (`_sbBuildSystemPrompt`)

Update all action specs that reference the house hierarchy:

- `LOG_ACTIVITY` targetType options: add `item`
- `ADD_PROBLEM` targetType options: add `item`
- `ADD_FACT` targetType options: add `item`
- `ADD_PROJECT` targetType options: add `item`
- `ATTACH_PHOTOS` targetType options: add `item`
- `ADD_THING` parentType options: add `subthing` (creates an Item inside a SubThing)
- `MOVE_THING` itemType options: add `item`; destParentType options: add `subthing` (Items move to SubThings)

### Target types (`SB_TARGET_TYPES`)

Add `'item'` to:
- `LOG_ACTIVITY`
- `ADD_PROBLEM`
- `ADD_FACT`
- `ADD_PROJECT`
- `ATTACH_PHOTOS`

Add `'subthing'` to `ADD_THING` (parent types).
Add `'item'` to `MOVE_THING` item types and `'subthing'` to destination types.

### Navigation (`_sbNavigateTo` / `_sbTypeHash`)

Add `item` → `'#item/'` to the `_sbTypeHash` map.

---

## Implementation Phases

### Phase I-1 — HTML Structure
- Add `#page-item` section to `index.html`
- Add the add/edit Item modal to `index.html`
- Add `item` to `ALL_PAGES` in `app.js` (page visibility only — no route logic yet)
- Bump version tag

### Phase I-2 — Item CRUD + Detail Page (`house.js`)
- `loadItemDetail(itemId)` — full detail page with breadcrumbs, header, inventory details, tags
- `_itemsLoadCrossEntity(itemId)` — load all cross-entity sections (problems, facts, projects, activities, photos, calendar events)
- `addItem(subThingId, data)`, `updateItem(itemId, data)`, `deleteItem(itemId)` — Firestore CRUD
- `_deleteItemCascade(itemId)` — delete item + all cross-entity records
- Wire add/edit modal for Items

### Phase I-3 — Items List on SubThing Detail Page (`house.js`)
- `loadItemsList(subThingId)` — renders item cards on the SubThing detail page
- Add "+ Add Item" button to SubThing detail page
- Wire item card Edit / Delete buttons
- Add delete guard to SubThing delete: block if items exist

### Phase I-4 — Routing + Delete Guards (`app.js`)
- Add `#item/{id}` route → `loadItemDetail(id)`
- Add `'item'` to `HOUSE_PAGES` array
- Verify nav context highlighting works for item page

### Phase I-5 — SecondBrain (`secondbrain.js`)
- Context builder: fetch `subThingItems`, nest under parent subThings
- System prompt: update all action targetType lists to include `item`
- `ADD_THING` parentType: add `subthing`
- `MOVE_THING`: add `item` type and `subthing` destination
- `SB_TARGET_TYPES`: add `item` to all relevant arrays
- `_sbTypeHash`: add `item` mapping
- `_sbNavigateTo`: handle `ADD_THING` with `parentType === 'subthing'`

---

## Key Patterns to Follow

- **Modal pattern**: `openModal(id)` / `closeModal(id)`, `dataset.mode`, `dataset.editId`
- **Cross-entity**: `targetType: 'item'`, `targetId: itemId` — same as all other entity types
- **Tag system**: reuse `stSelectedTags`, `_renderTagInput()`, global `tags` collection
- **Delete cascade**: match `_deleteSubThingCascade` pattern exactly
- **Context label**: extend `getHouseContextLabel()` to handle `targetType === 'item'`
- **Global state**: add `window.currentItem` alongside existing `currentFloor`, `currentRoom`, etc.
