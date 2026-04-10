# Floor Plan Enhancement Plan

---

## Previously Completed Features
- ✅ Feature 1: Enter key closes shape + larger close-circle hit radius (20px)
- ✅ Feature 2: Zoom (slider + mouse wheel)
- ✅ Feature 3: Type Numbers mode (command string drawing)
- ✅ Electrical overlay (wall plates, recessed lights, wiring targets, 3-way detection)
- ✅ Auto-select on place, orphan scrub, per-slot targeting
- ✅ v379: 3-row toolbar (Layout/Elec/Plumbing modes, amber Elec button, grouped controls)

---

## Big Redesign: 3-Row Toolbar + Floor Plan Item Detail Pages

---

## Decisions Log

| Topic | Decision |
|-------|----------|
| Mode switching | Click Electrical → immediately in edit mode; stays until you click Layout or Plumbing |
| Layout interactivity | Layout items (rooms, doors, windows, fixtures) are only moveable/editable when in Layout mode |
| Overlay dimming | When Electrical or Plumbing is active, Layout dims (existing fade behavior) |
| Getting to detail page | Row 3 shows "Details →" button for any selected item; also in Edit Marker modal |
| Room page item list | Room detail page has a dropdown/list of all items assigned to that room (all modes); each entry has Edit + Details buttons |
| Item identification | Items need a user-editable name; auto-default: "Door 1", "Window 1", "Fan", etc.; name shows in room list |
| Item profile photo | Real photo (taken of the actual door/window/fixture in your house), same as plant/zone photos |
| Roll-up display standard | Collapsible sections (count shown, click to expand full list); use this for house/floor/room item rollups; compare to yard "number → new page" approach over time |
| Rotation for fixtures | Single "Rotate" button in Row 3; each press = 90° clockwise; 4 orientations total |
| Phase priority | Decided by dev; see Phase Order section below |
| Legacy ceiling fixture data | No legacy data — user cleared it; no migration needed |
| Pipe routing lines | Punted to FutureEnhancements.md |

---

## Row 1 — Mode Bar

```
[ Layout ]  [ Electrical ]  [ Plumbing ]
```

- **Mutual exclusion**: exactly one mode is always active
- **Layout** is the default on page load
- Clicking a mode button immediately enters edit mode for that layer
- To stop editing electrical/plumbing, click **Layout** (or the other overlay)
- When an overlay (Electrical/Plumbing) is active: Layout dims to 25% opacity
- **Cannot** click/move/edit layout objects while in Electrical or Plumbing mode
- **Cannot** click/move/edit electrical objects while in Layout or Plumbing mode
- Replaces the standalone "⚡ Elec" toggle from v379

---

## Row 2 — Tool Bar (changes by mode)

### Layout Tools
```
[ Room ]  [ Type ]  [ Door ]  [ Window ]  [ Fixtures ▾ ]
```

**Fixtures ▾ flyout** (toilet / sink / tub):
- Single button; click opens a flyout panel with the three options
- After placing one item, flyout closes and tool reverts to Select
- While flyout is open, other Row 2 buttons temporarily hide

**Door subtypes** (visual distinction):
| Subtype     | Visual                                      |
|-------------|---------------------------------------------|
| Single      | Current arc render                          |
| French      | Center post + two arcs, one per panel       |
| Sliding     | Two stacked offset rectangles, no arc       |
| Pocket      | Dashed rectangle into wall, no arc          |
- Default on place: Single; change type via Row 3 type picker

**Window subtypes** (property label only, no visual change):
- Fixed, Double-hung, Casement, Sliding, Bay, Skylight
- All render identically

### Electrical Tools
```
[ Plate ]  [ Ceiling ]  [ Recessed ]
```
- Ceiling: drops a generic fixture; Row 3 picks subtype

**Ceiling fixture subtypes**:
| Subtype      | Visual                                    |
|--------------|-------------------------------------------|
| Fan          | Existing asterisk/wheel symbol            |
| Fan + Light  | Wheel + small circle center               |
| Drop Light   | Circle with a center dot                  |
| Chandelier   | Circle + cross + dots at tips             |
| Flush Mount  | Solid filled circle                       |
| Generic      | Current symbol (fallback)                 |

### Plumbing Tools
```
[ Spigot ]  [ Stub-out ]
```
- **Spigot**: outdoor cold-water; blue symbol
- **Stub-out**: indoor supply endpoint; Row 3 picks Cold (blue) / Hot (red) / Both (split)
- No pipe routing — endpoints only (routing punted to FutureEnhancements.md)

---

## Row 3 — Properties Bar

Supplemental to modals. Shows the most commonly edited properties for the selected item.
Full/rare config stays in Edit Marker modal.

| Selected item      | Row 3 shows                                                          |
|--------------------|----------------------------------------------------------------------|
| Room               | Name (inline edit), sq ft (read-only)                                |
| Door               | Type [Single▼]  Width [2.8ft]  Swing [In/Out▼]  [Rotate]  [Details→] |
| Window             | Type [Double-hung▼]  Width [3ft]  [Details→]                        |
| Toilet             | Name (inline)  [Rotate]  [Details→]                                  |
| Sink               | Name (inline)  Type [Vanity▼]  [Rotate]  [Details→]                 |
| Tub / Shower       | Name (inline)  Type [Tub/Shower/Combo▼]  [Rotate]  [Details→]       |
| Ceiling fixture    | Name (inline)  Type [Fan▼]  [Details→]                               |
| Recessed light     | Name (inline)  [Details→]                                            |
| Wall plate         | Slots (read-only)  Notes (inline)  [Details→]                        |
| Spigot / Stub-out  | Name (inline)  Type [Cold/Hot/Both▼]  [Details→]                     |

---

## Floor Plan Item Detail Pages

### What Gets a Detail Page
Every placed object:
- Doors, Windows
- Toilet, Sink, Tub/Shower
- Ceiling fixtures, Recessed lights, Wall plates
- Spigots, Stub-outs

### Detail Page Contents
Same pattern as Plants and Zones:
- Header: item name (editable), type badge, which room it's in
- Profile photo (real photo of the actual item in your house)
- Facts, Problems/Concerns, Activities, Projects, Photos tabs/sections

### Navigation
- **From floor plan**: Row 3 "Details →" button when item is selected
- **From floor plan**: Edit Marker modal has a "View Detail Page" button
- **From room page**: dropdown/list of all items in that room (see below)
- Route: `#floorplanitem/{id}`

### Data Model
Uses existing cross-entity pattern — no new Firestore collections:
- `targetType`: `'door'` | `'window'` | `'toilet'` | `'sink'` | `'tub'` |
  `'ceilingFixture'` | `'recessedLight'` | `'wallPlate'` | `'spigot'` | `'stubout'`
- `targetId`: the item's `id`
- All existing collections (facts, problems, activities, projects, photos) work as-is

### Item Naming & Auto-defaults
Items get a `name` field in their floor plan data object.
Auto-default on place (if user doesn't rename):
- "Door", "French Door", "Window", "Toilet", "Sink", "Tub", "Shower",
  "Fan", "Ceiling Light", "Recessed", "Outlet Plate", "Spigot", "Stub-out"
- If a room has multiple of the same type, auto-number: "Window 1", "Window 2"
- Name is editable inline in Row 3 or in the detail page header

---

## Room Detail Page: Items List

On a room's detail page, a new section **"Items in this Room"** lists all floor plan objects
assigned to that room (`roomId === room.id`), across all modes (layout, electrical, plumbing).

### List Entry
Each entry shows:
- Item icon (type symbol) + **name** (e.g., "Window 1", "Fan")
- Type badge (Door / Sink / Recessed / etc.)
- **Edit** button → opens Edit Marker modal for that item
- **Details →** button → navigates to `#floorplanitem/{id}`
- Profile photo thumbnail if one has been added (tappable → opens photo viewer)

### Grouping
Items grouped by mode:
- **Layout** (doors, windows, toilet, sink, tub)
- **Electrical** (ceiling fixtures, recessed lights, wall plates)
- **Plumbing** (spigots, stub-outs)

---

## Roll-up: Problems / Concerns

Collapsible sections are the new standard for floor plan item roll-ups.

### Room detail page
- Collapsible section: **"Open Concerns — Items in this Room"**
- Header shows count badge: "3 open"
- Expanded: list of `[item name] — [concern description]` each linking to the item's detail page
- Same pattern for Projects with status "In Progress"

### Floor detail page
- Collapsible section: **"Open Concerns — This Floor"**
- Rolls up: all rooms on this floor + all items in those rooms + items not in a room on this floor

### House detail page
- Collapsible section: **"Open Concerns — Whole House"**
- Rolls up everything across all floors

*After using this for a while, compare to the yard "number → new page" approach and decide
which standard to keep.*

---

## New Fixture Renders

### Toilet
- Rounded rectangle (tank) at the wall + oval (bowl) extending into the room
- Rotation: 4 orientations (facing N/E/S/W)

### Sink
- Rectangle with a circle (drain) inside
- Subtypes: Vanity (small), Kitchen (larger, no circle), Utility (plain rect)
- Rotation: 4 orientations

### Tub / Shower
- Tub: large rectangle + oval inside
- Shower: large rectangle + diagonal cross-hatch lines
- Combo: tub render with a shower head dot in one corner
- Rotation: 4 orientations

---

## Phase Order (dev-decided)

### Phase 1 — 3-Row Toolbar Restructure
Pure reshuffling of existing tools into the new Row 1 / Row 2 / Row 3 layout.
No new features, no new data.
- Row 1: Layout | Electrical | Plumbing (replace standalone Elec toggle)
- Row 2: existing tools reorganized by mode
- Row 3: basic property bar (door width/type, window type, ceiling fixture type picker, name inline edit, Details→ button)
- Mode switching logic: click mode → enter edit for that layer; Layout always default
- Elec mode behavior carried over from current Elec toggle (fade, can't move layout items)

### Phase 2 — New Object Types + Enhanced Renders
- Toilet, Sink, Tub/Shower: render, placement tool, Fixtures ▾ flyout, rotation
- Door subtypes: French, Sliding, Pocket render variants + Row 3 type picker
- Ceiling fixture subtypes: Fan, Drop Light, Chandelier, Flush Mount render variants
- Rotation button (Row 3, 90° per click) for all rotatable items
- `name` field added to all floor plan object data models
- Auto-numbering defaults on place

### Phase 3 — Floor Plan Item Detail Pages
- `#floorplanitem/{id}` page with Facts / Problems / Activities / Projects / Photos
- "Details →" button in Row 3 and Edit Marker modals
- Room detail page: "Items in this Room" section (grouped by mode, with Edit + Details buttons)
- Profile photo support for floor plan items (same compression pipeline as plants/zones)

### Phase 4 — Roll-up Collapsible Sections
- Room detail page: collapsible "Open Concerns — Items in this Room"
- Floor detail page: collapsible roll-up across all rooms + unassigned items on floor
- House detail page: collapsible roll-up across all floors
- Same sections for in-progress Projects

---

## Final Decisions

| Question | Decision |
|----------|----------|
| Doors shared between rooms | Door belongs to one room only; show it once in that room's list; revisit later if needed |
| Profile photo on canvas | Photo only on detail page and room item list — not on the floor plan canvas |
| Unassigned items | Items must be assigned to a room; cannot be placed outside a room boundary (enforce at place time, same as current behavior) |
| Roll-up scope | Roll up open Problems and in-progress Projects only; Activities not rolled up |

---

## Status: PLAN COMPLETE — ready to implement
