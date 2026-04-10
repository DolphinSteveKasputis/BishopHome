# Bishop — Electrical Plan Specifications

This is the living design document for the electrical plan features in the floor plan editor.
Update this doc whenever a decision changes or a new feature is added.

---

## Overview

The floor plan editor supports an **Electrical Mode** overlay that shows recessed lights,
wall plates (outlets + switches), and wiring connections between switches and the fixtures
they control. Electrical elements are always stored and rendered, but the wiring overlay and
"dim structure" fade are only active when Electrical Mode is on.

---

## Decisions Log

| Topic | Decision | Date |
|-------|----------|------|
| Recessed lights | Simple marker per light; no linked Thing; Facts/Problems/Activities via targetType | 2026-04-09 |
| Recessed light breaker | Not tracked on the light; breaker lives on the switch | 2026-04-09 |
| Recessed placement UX | Click-to-drop, no modal; Edit Marker for details | 2026-04-09 |
| Outlets + switches | Replaced by unified wall plate entity | 2026-04-09 |
| No data migration | No existing outlet/switch data in any floor plan | 2026-04-09 |
| Wall plate slots | 1–4 slots; each slot is switch or outlet with a subtype | 2026-04-09 |
| Electrical mode fade | Dims structural elements; Dim is toggle-able | 2026-04-09 |
| Wiring line visibility | Only shown for the currently-selected wall plate | 2026-04-09 |
| Wiring UX | Select plate → "Edit Targets" → click fixtures to toggle; Done/Escape | 2026-04-09 |
| 3-way detection | Auto-badge on plates that share a common target | 2026-04-09 |
| External switch targets | Slot-level flag (`external: true`); targets stored in `electricalTargets` Firestore collection for reverse lookup | 2026-04-10 |
| External target location | Use existing floor/room/item system; Outside floor + rooms covers all outdoor devices | 2026-04-10 |
| Target add UX (Option A) | Must add fp item to target floor plan first, then come back and link it from the slot | 2026-04-10 |
| Reverse lookup | `electricalTargets` collection stores `roomId`; room detail page queries by roomId | 2026-04-10 |
| Solar light | New ceiling fixture subtype `solar`; drag-and-drop like other ceiling fixtures | 2026-04-10 |
| Sprinkler head | New plumbing endpoint subtype `sprinkler`; drag-and-drop like spigot/stub-out | 2026-04-10 |
| Sprinkler pipe layout | Deferred — see FutureEnhancements.md | 2026-04-10 |
| Orphaned items report | Deferred — see FutureEnhancements.md | 2026-04-10 |

---

## Data Models

### Recessed Lights — `fpPlan.recessedLights[]`
```javascript
{
  id:     String,   // fpGenId()
  roomId: String,   // room shape ID (for bounds check only)
  x:      Number,   // feet, absolute position in plan
  y:      Number,   // feet
  label:  String,   // optional name/description
  notes:  String    // optional notes
}
```
Facts, Problems, and Activities are attached using:
`targetType: 'recessedLight', targetId: light.id`
No new Firestore collections needed.

### Wall Plates — `fpPlan.wallPlates[]`
```javascript
{
  id:           String,   // fpGenId()
  roomId:       String,   // room shape ID
  segmentIndex: Number,   // wall segment (0-based)
  position:     Number,   // feet from wall start
  targetIds:    [String], // IDs of fixtures this plate controls (for wiring)
  notes:        String,
  slots: [
    {
      type:      'switch' | 'outlet',
      subtype:   String,   // see subtypes below
      controls:  String,   // free text: "Ceiling fan", "Under-cabinet lights", etc.
      breakerId: String,   // Firestore breaker ID (or '')
      panelId:   String    // Firestore panel ID (or '')
    }
  ]
}
```

**Switch subtypes**: `single-pole`, `3-way`, `dimmer`, `smart`
**Outlet subtypes**: `standard`, `gfci`, `220v`, `usb`

### Wiring — stored inline on wall plates via `targetIds[]`
No separate wiring collection. A wall plate's `targetIds` array lists the IDs of every
fixture (recessedLight, ceilingFixture) it controls. Wiring lines are rendered at runtime
from this array when a plate is selected in electrical mode.

---

## External Switch Targets

### Overview

A wall plate **slot** can be marked `external: true` to indicate it controls something
**outside the current room** — another room on the same floor, a room on a different floor,
or an outdoor area (via the "Outside" floor). External targets are proper named entities
stored in Firestore so they can be found from both directions:
- From the switch: "what does slot 2 control?"
- From the room: "what switch controls the firepit flood light?"

### Updated Wall Plate Slot Shape

```javascript
{
  type:      'switch' | 'outlet',
  subtype:   String,
  external:  Boolean,              // NEW — true if this slot controls items outside this room
  controls:  String,               // free text notes (kept as fallback / extra description)
  breakerId: String,
  panelId:   String,
  electricalTargetIds: [String]    // NEW — IDs of electricalTarget Firestore docs
}
```

### `electricalTargets` Firestore Collection

Each document represents one controlled item (a floor plan fixture/light in any room):

```javascript
{
  id:                        String,   // auto Firestore ID
  name:                      String,   // display name, e.g. "Firepit flood light"
  // --- Where is it (for navigation and display) ---
  floorId:                   String,   // Firestore floors doc ID
  roomId:                    String,   // Firestore rooms doc ID (for reverse-lookup query)
  planId:                    String,   // Firestore floorPlans doc ID
  fpItemId:                  String,   // item.id within that floor plan
  // --- Who controls it (reverse lookup) ---
  controlledByPlanId:        String,   // floorPlan doc ID of the controlling wall plate
  controlledByWallPlateId:   String,   // wall plate ID
  controlledBySlotIndex:     Number    // 0-based slot index on that plate
}
```

One document per target. If a single slot controls 2 outdoor lights, that slot has 2
entries in `electricalTargetIds` and 2 documents in the collection.

### Location Picker UX (Option A — Pre-create First)

When adding an external target to a slot:
1. **Floor** — pick from existing floors (1st Floor, 2nd Floor, Outside, …)
2. **Room** — pick from rooms in that floor
3. **Item** — pick from floor plan items in that room (recessed lights, ceiling fixtures,
   solar lights, etc.)
4. **Name** — defaults to the item's display name; editable

If the item doesn't exist yet in the target floor plan, the user must first navigate to
that floor plan, add the item, then return to the wall plate and add the target. The slot's
`controls` text field can be used as a temporary note ("Back porch flood — add when drawn").

### Reverse Lookup on Room Pages

The room detail page includes a small **"Electrical Controls"** section that queries:
```
userCol('electricalTargets').where('roomId', '==', currentRoomId)
```
Each result shows:
- Item name + link to item detail page (`#floorplanitem/...`)
- "Controlled by:" link to the wall plate's floor plan + plate info

This means the Outside > Firepit Area room page will list all solar lights and flood
lights in that area and which switch(es) control them.

### Slot Symbol Update

Slots with `external: true` append `*` to the normal symbol:
- single-pole external → **S\***
- 3-way external → **3S\***
- dimmer external → **D\***
- smart external → **⚡\***

---

## New Item Types

### Solar Light (Ceiling Fixture Subtype)

Added to `fpPlan.ceilingFixtures[]` as `subtype: 'solar'`.

```javascript
{ id, roomId, x, y, subtype: 'solar', label, notes }
```

Rendered the same as other ceiling fixtures but with a distinct sun-style symbol.
Intended for use on the Outside floor's room floor plans. Full Facts/Problems/Activities
support via `targetType: 'ceiling', targetId: id`.

Ceiling fixture subtype list (updated):
`fan`, `fan-light`, `flush-mount`, `drop-light`, `chandelier`, `solar`, `generic`

### Sprinkler Head (Plumbing Endpoint Subtype)

Added to `fpPlan.plumbingEndpoints[]` as `endpointType: 'sprinkler'`.

```javascript
{ id, roomId, x, y, endpointType: 'sprinkler', label, notes }
```

Rendered with a distinct spray-arc symbol. Intended for use on outdoor room floor plans.
Full Facts/Problems/Activities support via `targetType: 'plumbingEndpoint', targetId: id`.

Plumbing endpoint subtype list (updated):
`spigot`, `stub-out`, `sprinkler`

---

## Visual Design

### Recessed Light Symbol
- Two concentric circles on the ceiling plane
- Outer circle: r=9px, white fill, dark grey stroke (#334155)
- Inner circle: r=5px, light grey fill (#d1d5db)
- Selected state: outer stroke orange (#cc8800), outer fill light yellow (#fffacc)
- Label (if set): 7px text centered below
- Hit area: transparent circle r=14px

### Wall Plate Symbol
- Rectangle placed on wall, centered at `position`
- Width: `slots.length × 14 + 6` px | Height: 22px
- Background: white (unselected) / light yellow (#fffacc) (selected)
- Outer stroke: #334155 (unselected) / orange #cc8800 (selected), 1.5px
- Thin vertical dividers (#ccc) between slot cells
- Per-slot mini symbol (9px font, centered in cell):
  - switch/single-pole: **S**
  - switch/3-way: **3S**
  - switch/dimmer: **D**
  - switch/smart: **⚡**
  - outlet/standard: two small dots (outlet face)
  - outlet/gfci: **GFI**
  - outlet/220v: **220**
  - outlet/usb: **USB**
- 3-way badge: small "3-way" label above plate when auto-detected

### Wiring Lines (electrical mode, selected plate only)
- Dashed line from plate center to each target's center
- Style: 1.5px dashed, blue (#3b82f6)
- No labels on lines

### Electrical Mode Fade
- When Electrical Mode ON + Dim toggle ON: structural SVG group (walls, doors, windows,
  plumbing) rendered at 0.25 opacity
- Electrical elements (recessed lights, wall plates, ceiling fixtures) at full opacity

---

## Toolbar Layout (Electrical Mode)

```
[▷ Select] [⬜ Room] [📐 Type] [🚪 Door] [🪟 Window] | [🔌 Plate] [◎ Recessed*] | [🚿 Plumbing] [🔆 Ceiling] | [⚡ Elec] [Dim*]
```
*Recessed tool and Dim toggle only visible when Electrical Mode is ON

---

## Edit Targets UX (Wiring)

1. In Select mode, click a wall plate → it becomes selected
2. Status bar shows "Edit Targets" button alongside "Edit Marker"
3. Press "Edit Targets" → enters `fpTargetEditMode`
4. Render changes:
   - Wall plate highlighted amber with pulsing border
   - Fixtures already in `targetIds` → amber fill
   - Other selectable fixtures (recessed lights, ceiling fixtures) → teal ring
   - Non-fixture elements faded
5. Click a fixture → toggles in/out of `plate.targetIds[]`; immediate re-render
6. Press **Done** button in status bar (or Escape) → exits mode, silent-saves
7. Wiring lines draw from plate to all targets (visible while plate is selected in elec mode)

---

## 3-Way Auto-Detection

After every `targetIds` change (in target edit mode), the render loop:
1. Builds a map: `{ fixtureId → [plateIds that target it] }`
2. For any fixture targeted by 2+ plates → marks those plates with runtime flag `_threeway = true`
3. `fpRenderWallPlate` checks `_threeway` and renders a small "3-way" badge above the rect
4. This flag is NOT stored in Firestore — recomputed on every render

**Visual implication**: If you have two 3-way switches controlling a hallway light, both
plates automatically show the "3-way" badge as soon as they share that light as a target.

---

## Future / Deferred Items

- **Always-on wire view**: Option to show wiring lines for ALL plates simultaneously (not just selected)
- **Wire labels**: Circuit number or wire gauge label along the dashed line
- **Outdoor termination**: Lines that exit room boundary with an arrow + label ("to exterior floods")
- **AFCI/GFCI indicators**: Visual badge when a slot is on a protected circuit
- **Dimmer load calculation**: Warn if total wattage on dimmer exceeds rating
- **Smart switch pairing**: Link smart switches to hub/app name
- **Orphaned items report**: View all unlinked switches + all fixtures not targeted by any switch — see FutureEnhancements.md
- **Sprinkler system layout**: Draw irrigation pipe routes, zone valves, scheduling — see FutureEnhancements.md
