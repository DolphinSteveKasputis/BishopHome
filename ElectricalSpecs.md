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
