# Floor Plan Enhancement Plan

---

## Previously Completed Features
- ✅ Enter key closes shape + larger close-circle hit radius (20px)
- ✅ Zoom (slider + mouse wheel)
- ✅ Type Numbers mode (command string drawing)
- ✅ Electrical overlay: wall plates, recessed lights, wiring targets, 3-way detection
- ✅ Auto-select on place, orphan scrub, per-slot targeting
- ✅ v379: Elec button amber when on; structural tools hide in elec mode; electrical controls grouped

*Note: v379 was a partial step. The full 3-row restructure is Phase 1 below.*

---

## Decisions Log

| Topic | Decision |
|-------|----------|
| Mode switching | Click a Row 1 mode → immediately in edit mode; stays until you click a different mode |
| Layout interactivity | Layout items only moveable/editable in Layout mode; same for Electrical and Plumbing |
| Overlay dimming | When Electrical or Plumbing is active, Layout dims; Dim is still a user toggle (checkbox) |
| Select tool | Exists in Row 2 of every mode; resets to Select when switching modes |
| Getting to detail page | Row 3 "Details →" button (added in Phase 3 only, after page exists); also in Edit Marker modal |
| Room page item list | Room detail page lists all items assigned to that room, grouped by mode |
| Item identification | `name` field on every object; auto-default names; editable inline in Row 3 (Phase 2+) |
| Item profile photo | Real photo of the actual item; shown on detail page and room item list only (not on canvas) |
| Roll-up display | Collapsible sections showing count; expand to list; problems + projects only |
| Rotation | Single "Rotate" button, 90° clockwise per press, 4 orientations |
| Phase priority | Phase 1 → 2 → 3 → 4; see phases below |
| Legacy ceiling fixture data | No legacy data — user cleared it |
| Pipe routing lines | Punted to FutureEnhancements.md |
| Doors shared between rooms | Door belongs to one room only; revisit later |
| Profile photo on canvas | Photo only on detail page and room item list |
| Unassigned items | Items must be placed inside a room boundary |
| Roll-up scope | Open Problems and in-progress Projects only; Activities not rolled up |
| Plumbing in Phase 1 | Plumbing mode button deferred to Phase 2 — no tools exist yet in Phase 1 |
| Details→ button timing | Not added until Phase 3 when the destination page actually exists |
| `name` field timing | Added in Phase 2; Phase 1 Row 3 is read-only (no inline editing yet) |

---

## Row 1 — Mode Bar (final design)

```
[ Layout ]  [ Electrical ]  [ Plumbing ]
```

- **Mutually exclusive**: exactly one mode is always active; Layout is the default on page load
- Clicking a mode immediately enters edit mode for that layer; you stay there until you switch
- When Electrical or Plumbing is active: Layout dims to 25% opacity (Dim toggle still user-controllable)
- **Cannot** select/move/edit items from a different layer than the active mode
- Mode switch always: clears current selection, resets tool to Select, exits any drawing or target-edit session
- Plumbing button added in Phase 2 (no tools exist until then)

---

## Row 2 — Tool Bar (changes by active mode)

**Select tool appears in Row 2 of every mode** — it is the default "cursor" state.

### Layout Mode
```
[ ▷ Select ]  [ Room ]  [ Type ]  [ Door ]  [ Window ]  [ Fixtures ▾ ]
```
- **Fixtures ▾ flyout** (Phase 2): Toilet / Sink / Tub-Shower; closes after placing one; other buttons temporarily hide while open
- **Room** and **Type**: existing free-draw and command-string room tools
- **Door**: places a Single door by default; subtype changed via Row 3 (Phase 2)
- **Window**: all look identical visually; subtype is a property label only

### Electrical Mode
```
[ ▷ Select ]  [ Plate ]  [ Ceiling ]  [ Recessed ]
```
- **Ceiling**: places a generic fixture; subtype (Fan, Drop Light, etc.) set via Row 3 (Phase 2 for visuals)
- Dim toggle (checkbox) shown in Row 2 of Electrical mode

### Plumbing Mode (Phase 2)
```
[ ▷ Select ]  [ Spigot ]  [ Stub-out ]
```
- **Spigot**: outdoor cold-water endpoint; blue symbol
- **Stub-out**: indoor supply endpoint; Row 3 picks Cold (blue) / Hot (red) / Both (split blue+red)
- Dim toggle (checkbox) shown in Row 2 of Plumbing mode

---

## Row 3 — Properties Bar

**Phase 1 version** (read-only with action buttons):
- Shows what is selected: type label + key dimension or note
- Buttons: Edit Marker, Edit Targets (wall plates only), Remove — moved from toolbar to Row 3
- No inline editing in Phase 1 (name field doesn't exist yet, renders don't have subtypes yet)
- No Details→ button in Phase 1 (destination page doesn't exist yet)

**Phase 2+ version** (full inline editing):
| Selected item      | Row 3 shows                                                           |
|--------------------|-----------------------------------------------------------------------|
| Room               | Name (inline edit)  Sq ft (read-only)  [Edit Room]                   |
| Door               | Name (inline)  Type [Single▼]  Width [ft]  Swing [In/Out▼]  [Edit Marker]  [Remove] |
| Window             | Name (inline)  Type [Fixed▼]  Width [ft]  [Edit Marker]  [Remove]   |
| Toilet             | Name (inline)  [Rotate]  [Edit Marker]  [Remove]                     |
| Sink               | Name (inline)  Type [Vanity▼]  [Rotate]  [Edit Marker]  [Remove]    |
| Tub / Shower       | Name (inline)  Type [Tub▼]  [Rotate]  [Edit Marker]  [Remove]       |
| Ceiling fixture    | Name (inline)  Type [Fan▼]  [Edit Marker]  [Remove]                  |
| Recessed light     | Name (inline)  [Edit Marker]  [Remove]                               |
| Wall plate         | Name (inline)  Slots (read-only)  [Edit Targets]  [Edit Marker]  [Remove] |
| Spigot / Stub-out  | Name (inline)  Type [Cold▼]  [Edit Marker]  [Remove]                 |

**Phase 3+**: Details→ button added to every Row 3 entry.

---

## Mode: Electrical — Unchanged Behaviors Carried Forward

These behaviors from the current implementation carry forward unchanged into the new mode system:
- Wiring lines (dashed, colored per slot) from selected wall plate to its target fixtures
- Edit Targets → slot picker → fixture picker two-step UX
- 3-way badge on plates sharing a target (Electrical mode only)
- Target-edit overlay rings (amber = linked, teal = available)
- fpScrubTargetIds on fixture deletion

The only change: `fpElectricalMode` boolean is replaced by `fpActiveMode === 'electrical'` check.

---

## Floor Plan Item Detail Pages (`#floorplanitem/{id}`)

### What Gets a Detail Page
All placed objects: Doors, Windows, Toilet, Sink, Tub/Shower, Ceiling fixtures, Recessed lights, Wall plates, Spigots, Stub-outs

### Detail Page Contents
- Header: item name (editable), type badge, room name (link to room page), floor plan name
- Profile photo (same photo pipeline as plants/zones)
- Sections: Facts, Problems/Concerns, Activities, Projects, Photos

### Data model — no new Firestore collections needed
Uses existing `targetType` / `targetId` cross-entity pattern:
- `targetType`: `'door'` | `'window'` | `'toilet'` | `'sink'` | `'tub'` |
  `'ceilingFixture'` | `'recessedLight'` | `'wallPlate'` | `'spigot'` | `'stubout'`
- All existing collections (facts, problems, activities, projects, photos) work as-is

### `name` field (added Phase 2)
Every floor plan data object gets a `name` field. Auto-defaults on place:
| Type | Default name |
|------|-------------|
| Door (single) | "Door" |
| Door (french) | "French Door" |
| Door (sliding) | "Sliding Door" |
| Door (pocket) | "Pocket Door" |
| Window | "Window" |
| Toilet | "Toilet" |
| Sink | "Sink" |
| Tub/Shower (tub) | "Tub" |
| Tub/Shower (shower) | "Shower" |
| Tub/Shower (combo) | "Tub/Shower" |
| Ceiling fixture | "Ceiling Fixture" |
| Recessed light | "Recessed Light" |
| Wall plate | "Plate" |
| Spigot | "Spigot" |
| Stub-out | "Stub-out" |

If a room already has an item with the same default name, auto-number: "Window", "Window 2", "Window 3", etc.
Existing items placed before Phase 2 (no name field) use their type as a display fallback — never show blank.

---

## Room Detail Page: Items List (Phase 3)

New section on the room's existing detail page: **"Items in this Room"**

Lists all floor plan objects with `roomId === room.id`, grouped:
- **Layout** (doors, windows, toilet, sink, tub)
- **Electrical** (ceiling fixtures, recessed lights, wall plates)
- **Plumbing** (spigots, stub-outs)

Each entry:
- Type icon + item name
- Type badge
- Profile photo thumbnail (if exists; tappable)
- **[Edit]** → opens Edit Marker modal for that item
- **[Details →]** → navigates to `#floorplanitem/{id}`

---

## Roll-up: Problems + Projects (Phase 4)

Collapsible sections on room, floor, and house detail pages.

### Room detail page
- **"Open Concerns — Items in this Room"**: count badge; expand → list of `[name] — [description]`, each links to item detail page
- **"Active Projects — Items in this Room"**: same pattern for in-progress projects

### Floor detail page
- **"Open Concerns — This Floor"**: rolls up all rooms + their items on this floor
- **"Active Projects — This Floor"**: same

### House detail page
- **"Open Concerns — Whole House"**: rolls up all floors
- **"Active Projects — Whole House"**: same

---

## New Fixture Renders (Phase 2)

### Door Subtypes
| Subtype  | Visual                                            |
|----------|---------------------------------------------------|
| Single   | Current arc (unchanged)                           |
| French   | Center post + two arcs, one per panel, ~same width |
| Sliding  | Two offset rectangles side by side, no arc        |
| Pocket   | Dashed rectangle inset into wall, no arc          |

### Ceiling Fixture Subtypes
| Subtype     | Visual                                       |
|-------------|----------------------------------------------|
| Fan         | Existing asterisk/wheel (unchanged)          |
| Fan+Light   | Wheel + small filled circle at center        |
| Drop Light  | Circle with a center dot                     |
| Chandelier  | Circle + cross + dots at tips                |
| Flush Mount | Solid filled circle                          |
| Generic     | Current symbol (fallback for unset type)     |

### Toilet
- Rounded rect (tank, against wall) + oval (bowl, into room)
- 4 rotations via Rotate button

### Sink
- Rectangle with circle (drain) inside
- Subtype variants: Vanity (small), Kitchen (wider), Utility (plain rect, no circle)
- 4 rotations

### Tub / Shower
- Tub: rectangle with oval inside
- Shower: rectangle with diagonal cross-hatch
- Combo: tub render with small shower-head dot at one corner
- 4 rotations

### Plumbing Endpoints
- Spigot: blue filled circle with a small horizontal pipe stub
- Stub-out cold: blue circle with "C"
- Stub-out hot: red circle with "H"
- Stub-out both: half-blue half-red circle

---

## Phase Plan

### Phase 1 — Mode Refactor + Toolbar Restructure

**Goal**: Convert the existing toolbar into the 3-row Layout/Electrical model. No new objects, no new data fields. Every behavior that exists today still works — just wired through the new mode system.

**JavaScript changes (floorplan.js)**:
- Replace `fpElectricalMode` boolean with `fpActiveMode = 'layout' | 'electrical' | 'plumbing'`
- `fpSetMode(mode)`: sets active mode, clears selection, resets tool to Select, exits drawing/target-edit, updates all UI
- Update every `if (fpElectricalMode)` check to `if (fpActiveMode === 'electrical')`
- Mode-locked interaction: in `fpSvg mousedown`, ignore clicks on items that don't belong to the active mode
- Dim toggle: reattach to mode state (show in Row 2 for Electrical; eventually Plumbing too)
- Edit Marker, Edit Targets, Remove buttons: move from floating toolbar area to Row 3 panel
- Row 3 panel: shows read-only info + action buttons for selected item; hidden when nothing selected
- **No Plumbing mode yet** (button not shown; no tools exist)

**HTML changes (index.html)**:
- Row 1: `[ Layout ]  [ Electrical ]` (Plumbing added in Phase 2)
- Row 2: two sets of tool buttons — Layout set and Electrical set; show/hide by mode
- Row 3: new div below Row 2; dynamically populated by JS based on fpSelectedType
- Remove standalone Elec group box from v379 (replaced by Row 1)
- Select button appears in both Row 2 sets

**CSS changes**:
- Active mode button style (one clear active state for Row 1)
- Row 3 panel styling (light background, inline layout)

**What does NOT change in Phase 1**:
- No name fields, no type pickers, no rotation, no new renders
- No Details→ button (page doesn't exist)
- No Plumbing mode
- No Fixtures flyout
- All existing floor plan data models unchanged

**Verification**:
1. Layout mode: can draw rooms, place doors/windows; cannot click electrical items
2. Electrical mode: can place plates/recessed/ceiling; cannot click rooms or doors
3. Switching modes clears selection and resets to Select tool
4. All electrical features (wiring, Edit Targets, 3-way badge) work unchanged
5. Edit Marker, Remove accessible via Row 3 for all item types

---

### Phase 2 — New Objects + Subtypes + Full Row 3

**Goal**: Add the new fixture types, door/ceiling subtypes, Plumbing mode, and the `name` field. Row 3 becomes fully interactive.

**Data changes**:
- Add `name` field to: doors, windows, recessed lights, wall plates, ceiling fixtures (all in `fpPlan.*` arrays)
- Add `subtype` field to: doors (single/french/sliding/pocket), ceiling fixtures (fan/fan+light/etc.), tub (tub/shower/combo), sink (vanity/kitchen/utility)
- Add `orientation` field (0/1/2/3 = N/E/S/W) to: toilet, sink, tub/shower
- New `fpPlan.fixtures[]` array for toilet, sink, tub/shower (with `fixtureType`, `name`, `orientation`, `roomId`)
- New `fpPlan.plumbingEndpoints[]` array for spigots/stub-outs (with `endpointType`, `name`, `roomId`, `x`, `y`)
- Existing `fpPlan.plumbing[]` (old generic markers): kept and still renders in Plumbing mode as "Legacy Plumbing" — no forced migration

**New render functions**:
- `fpRenderDoor`: updated to branch on `door.subtype`
- `fpRenderCeilingFixture`: updated to branch on `fixture.subtype`
- `fpRenderToilet`, `fpRenderSink`, `fpRenderTubShower`: new
- `fpRenderPlumbingEndpoint`: new

**New tools (placement)**:
- `fpToolFixtures` flyout → toilet / sink / tub-shower placement
- `fpToolSpigot`, `fpToolStubout` in Plumbing mode Row 2

**Row 1**: Add Plumbing button (now has tools)

**Row 3 — fully interactive**:
- Name inline edit → silent-saves on blur
- Type pickers → silent-save on change + re-render
- Rotate button → increments orientation 0→1→2→3→0, silent-saves, re-renders
- Edit Marker, Edit Targets, Remove: carried from Phase 1 Row 3

**Fixtures flyout** in Layout Row 2 (see design notes above)

**Auto-naming** on place for all new and existing object types; fallback display for items without `name`

**Verification**:
1. Place toilet → appears in room, rotates 4 ways with Rotate button, name auto-set
2. Place French door → renders center post + two arcs
3. Change ceiling fixture type via Row 3 → symbol changes immediately
4. Inline name edit → saves silently, name persists after reload
5. Plumbing mode: Spigot and Stub-out tools work; old plumbing markers still render
6. Row 3 shows for every item type, all fields save correctly

---

### Phase 3 — Floor Plan Item Detail Pages + Room Item List

**Goal**: Every placed object gets a full detail page. Room page shows all its items.

**New route**: `#floorplanitem/{planId}/{itemType}/{itemId}`
- Needs planId to load the correct `fpPlan` document from Firestore
- Needs itemType to know which sub-array to look in
- Needs itemId to find the specific object

**New page** (`#floorplanitem/...`):
- Header: item name (editable, saves to fpPlan), type badge, room name (→ room page), floor plan name (→ floor plan)
- Profile photo (upload / view / delete — same pipeline as plant photos)
- Sections: Facts, Problems/Concerns, Activities, Projects, Photos
- All use `targetType` / `targetId` pattern — all existing helpers work

**Details→ button**: added to Row 3 for all item types (now works)
**"View Detail Page"** button added to all Edit Marker modals

**Room detail page changes**:
- New **"Items in this Room"** section (see design above)
- Queries `fpPlan` for items where `roomId === room.id`; must load the plan doc (efficient: already cached if user navigated from floor plan)

**Key challenge**: The room detail page is in `zones.js` (or similar) and knows about Firestore zone data, but floor plan items live inside a Firestore `floorPlans/{planId}` document. The room page needs to load the plan doc to get items. The plan `id` must be derivable from the room — floor → plan → items. Floor has `planId` reference, so the room page needs to traverse: room → floor → planId → load fpPlan.

**Verification**:
1. Select a recessed light → Details→ button appears in Row 3 → detail page loads with correct name/type
2. Add a Fact on the detail page → appears on item's detail page (not on room page directly)
3. Add a Problem on item detail page → shows in room's "Items in this Room" list
4. Room page items list grouped correctly by Layout/Electrical/Plumbing
5. Navigate: room page → item detail → back → room page (browser back works)
6. Profile photo: upload → appears in room item list as thumbnail

---

### Phase 4 — Roll-up Collapsible Sections

**Goal**: Open problems and active projects from floor plan items bubble up to room, floor, and house detail pages.

**Room detail page**:
- Query: all `problems` where `targetType` is a floor-plan-item type AND `targetId` is in the room's items list AND `status === 'open'`
- Render as collapsible section: "Open Concerns (N)" → expand → list with item name + concern + link
- Same for projects where `status !== 'complete'`

**Floor detail page**:
- Roll up across all rooms on this floor (same queries, wider scope)

**House detail page**:
- Roll up across all floors

**Performance note**: These rollup queries may require multiple Firestore reads (one per problem/project). Use the same batching pattern already used elsewhere in the app. If the item count is small (it will be for a house), this is fine.

**Verification**:
1. Add open concern on a window → shows in room rollup, floor rollup, house rollup
2. Resolve the concern → disappears from all rollups
3. Add in-progress project on a ceiling fixture → shows in room + floor + house rollups
4. Complete the project → disappears
5. Collapsible sections show count in header even when collapsed

---

## Gaps Resolved in This Revision

The following issues were found in the prior version of this plan and are now addressed:

1. **Plumbing button in Phase 1 had no tools** → deferred to Phase 2
2. **Select tool not mentioned** → explicitly in Row 2 of every mode
3. **`name` field contradiction** → deferred to Phase 2; Phase 1 Row 3 is read-only
4. **Details→ button before page exists** → deferred to Phase 3
5. **Dim toggle location** → stays as checkbox in Row 2 of Electrical (and future Plumbing) mode
6. **fpTargetEditPanel in new design** → Edit Targets moves to Row 3; panel stays below Row 3
7. **Mode switch edge cases** → fpSetMode() clears selection, resets tool, exits all special modes
8. **Existing generic plumbing markers** → kept, render in Plumbing mode, no forced migration
9. **Ceiling fixture type picker in Phase 1** → deferred to Phase 2 (render doesn't exist yet)
10. **"Pure reshuffling" understated Phase 1 JS work** → Phase 1 is a proper mode refactor
11. **`fpActiveMode` vs `fpElectricalMode` migration** → all checks updated in Phase 1
12. **Room page plan-doc loading** → noted as key challenge in Phase 3; traverse room→floor→planId

---

## Status: PLAN REVIEWED + GAPS RESOLVED — ready to implement Phase 1
