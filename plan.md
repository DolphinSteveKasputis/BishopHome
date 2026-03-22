# Bishop App - Build Plan

## Context
Building a yard & garden tracker web app from scratch. Static HTML/CSS/JS frontend with Firebase Firestore (free Spark plan, project: `bishop-62d43`) for data. Photos stored as Base64 in Firestore (no Firebase Storage needed). No frameworks, no auth initially. The app needs to work on desktop, Chromebook, and phone. Built in granular steps so each can be verified before moving on.

---

## Phase 0: Firebase Project Setup ✅ COMPLETE
- Firebase project `bishop-62d43` created
- Firestore enabled (test mode, no auth)
- Firebase config in `js/firebase-config.js`
- Firebase compat SDK v10.14.0 via CDN

---

## Phase 1: Project Scaffolding ✅ COMPLETE
- `index.html`: HTML shell with nav bar (Zones, Weeds, Calendar, Chemicals, Actions), main content area
- `css/styles.css`: Responsive styles, mobile-first layout
- `js/app.js`: Hash-based router (`#home`, `#zone/id`, `#plant/id`, `#weeds`, `#weed/id`, `#calendar`, `#chemicals`, `#actions`)
- Mobile hamburger nav

---

## Phase 2: Zone Management ✅ COMPLETE
- `js/zones.js`: Zone CRUD, breadcrumbs, modal utilities (`openModal`/`closeModal`)
- Firestore collection: `zones` — `name`, `parentId`, `level` (1/2/3), `createdAt`
- 3 levels of nesting, drill-down navigation
- Edit/delete zones with child warnings

---

## Phase 3: Plant Management ✅ COMPLETE
- `js/plants.js`: Plant CRUD, metadata editing, zone picker, move plant
- Firestore collection: `plants` — `name`, `zoneId`, `metadata{}`, `createdAt`
- Plant detail page with metadata (heat/cold tolerance, watering, sun/shade, notes)
- Zone reassignment picker with hierarchy
- "View All Plants" button on zone pages (flat list of all plants in zone + sub-zones)
- `buildZoneOptionsTree()` and `getZonePath()` reused by weeds.js

---

## Phase 4: Activity Logging ✅ COMPLETE
- `js/chemicals.js`: Chemical/product list CRUD
- `js/activities.js`: Activity logging with chemical dropdown, saved actions
- Firestore collections:
  - `chemicals` — `name`, `notes`
  - `activities` — `targetType`, `targetId`, `description`, `notes`, `chemicalId`, `date`, `savedActionId`
  - `savedActions` — `name`, `description`, `chemicalId`, `notes`
- Activities work on plants, zones, and weeds (targetType/targetId pattern)
- Saved actions: create from activity, pick to pre-fill form, manage page

---

## Phase 4.5: Problems, Facts, Projects ✅ COMPLETE
(Added between phases 4 and 5 based on user requirements)

- `js/problems.js`: Problems/concerns per plant or zone
  - Firestore: `problems` — `targetType`, `targetId`, `description`, `notes`, `status` (open/resolved), `dateLogged`, `resolvedAt`
  - Timestamps on status changes, optional notes
- `js/facts.js`: Key-value facts per plant or zone
  - Firestore: `facts` — `targetType`, `targetId`, `label`, `value`
- `js/projects.js`: Projects with checklists per plant or zone
  - Firestore: `projects` — `targetType`, `targetId`, `title`, `notes`, `status` (active/completed), `items[]`, `completedAt`
  - Checklist items with timestamps and optional notes
  - Project completion tracking with timestamps

---

## Phase 5: Photo Support ✅ COMPLETE
- `js/photos.js`: Photo capture, client-side compression (Canvas API, max 1200px, JPEG 0.7), Base64 storage
- Firestore collection: `photos` — `targetType` (plant/zone/weed), `targetId`, `imageData` (Base64), `caption`, `createdAt`
- No Firebase Storage — photos stored as Base64 strings in Firestore docs
- Photo viewer: newest-first navigation, Newer/Older buttons, caption editing, delete
- Works on plant detail, zone detail, and weed detail pages

---

## Phase 6: Weed Tracking ✅ COMPLETE
- `js/weeds.js`: Weed type CRUD, zone assignment, photos, activities
- Firestore collection: `weeds` — `name`, `treatmentMethod`, `applicationTiming`, `notes`, `zoneIds[]`, `createdAt`
- Weed list page (alphabetical), weed detail page
- Zone assignment via checkbox modal with hierarchy
- Affected zones display as clickable links with full path
- Photos on weeds (for identification)
- Activity logging on weeds
- Delete weed cascades: removes associated activities and photos

---

## Phase 7: Calendar View ✅ COMPLETE
(User modifications to original plan: recurring events, copy feature, configurable range)

- `js/calendar.js`: Calendar event CRUD, recurring occurrence generation
- Firestore collection: `calendarEvents` — `title`, `description`, `date` (ISO string), `recurring` (null or `{type, intervalDays}`), `createdAt`
- **Event types**: One-time (specific date) or Recurring (weekly, monthly, every X days)
- **Recurring logic**: Generates all occurrences within display range from start date
  - Weekly: +7 days
  - Monthly: same day next month with day-of-month clamping for short months
  - Every X Days: +N days (user-specified interval)
- **Display range**: Configurable — 1, 3 (default), 6, or 12 months from today
- Events shown chronologically, grouped by month with headers
- Each card: date, title, description, recurring badge (🔄 Weekly/Monthly/Every N days), Edit/Copy/Delete
- **Copy**: Pre-fills title/description, sets to one-time, clears date for user to pick new date
- **Edit**: Pre-fills all fields including recurring settings
- **Delete**: Standard confirm for one-time; special "ALL occurrences" warning for recurring

---

## Phase 7.5: UI Refinements ✅ COMPLETE
User-requested modifications to improve usability. All 10 changes implemented and tested.

### Mod 1: Plant metadata dropdowns + bloom/dormant fields
**Files**: `index.html`, `js/plants.js`

**index.html** — Replace heat/cold/sunShade text inputs with `<select>` dropdowns. Add bloom/dormant month row.
- `plantHeatTolerance`: `<select>` with options: (empty), "High", "Medium-High", "Medium", "Medium-Low", "Low"
- `plantColdTolerance`: `<select>` with same options as heat
- `plantSunShade`: `<select>` with options: (empty), "Full Sun", "Partial Sun", "Partial Shade", "Full Shade"
- `plantWateringNeeds`: stays as text input (free-form)
- Add new form-row after sun/shade row with two new fields:
  - `plantBloomMonth`: `<select>` with (empty) + January–December
  - `plantDormantMonth`: `<select>` with (empty) + January–December

**js/plants.js** — Update `loadPlantDetail()` to populate new selects and new fields. Update `savePlantMetadata()` to read/save `bloomMonth` and `dormantMonth` from `metadata`.

### Mod 2: Gray out Save unless metadata is dirty
**Files**: `js/plants.js`, `css/styles.css`

**js/plants.js**:
- Add module-level `var originalMetadata = {}` to store loaded values
- In `loadPlantDetail()`, after populating fields, snapshot all 7 field values into `originalMetadata`
- Add `updateMetadataSaveButtonState()` function: compares current field values to `originalMetadata`, enables Save if different, disables if same
- Call it on initial load (starts disabled)
- Add `input`/`change` event listeners on all 7 metadata fields (3 selects + 1 text + 1 textarea + 2 month selects) → call `updateMetadataSaveButtonState()`
- In `savePlantMetadata()` success callback: update `originalMetadata` to new values, disable button again

**css/styles.css** — Add `.btn:disabled` style: opacity 0.5, cursor not-allowed

### Mod 3: Collapse projects to title only; expand to show checklist
**Files**: `js/projects.js`, `css/styles.css`

**js/projects.js** — Modify `createProjectCard()`:
- Wrap notes + checklist + add-item-row in a `.project-body` div
- Add `.project-body` with `display: none` by default
- Add expand/collapse toggle: a clickable chevron (▸/▾) next to the project title
- Clicking chevron toggles `.project-body` visibility and rotates chevron
- Project header always shows: chevron + title + (item count badge, e.g. "3/5") + action buttons
- Completed projects remain collapsed by default

**css/styles.css**:
- `.project-body { display: none; }` and `.project-body.expanded { display: block; }`
- `.project-toggle` chevron styling (cursor pointer, transition)
- `.project-item-count` badge (small, gray, shows checked/total)

### Mod 4: Home page title → "My Yard"
**Files**: `index.html`

Change `<h2>My Zones</h2>` to `<h2>My Yard</h2>` in `page-home` section (line 53).

### Mod 5: My Yard page shows rolled-up projects + calendar
**Files**: `index.html`, `js/zones.js`, `js/projects.js`, `js/calendar.js`

**index.html** — Add two new sections to `page-home` after the zone list:
- "All Projects" section with container `homeProjectsContainer` + empty state
- "Upcoming Calendar" section with container `homeCalendarContainer` + empty state

**js/projects.js** — Add `loadAllProjects()` function:
- Query ALL projects from Firestore (no targetType filter)
- Filter to active only (unless show-completed checked)
- Render in `homeProjectsContainer`
- Each card shows project title + which zone/plant it belongs to (resolve targetId to name)

**js/calendar.js** — Add `loadHomeCalendar()` function:
- Reuse `generateOccurrences()` logic
- Default range: 3 months
- Render compact event cards in `homeCalendarContainer`

**js/zones.js** — In `loadZonesList()` (home page load), call `loadAllProjects()` and `loadHomeCalendar()` after loading zones.

### Mod 6: Zone detail shows sub-zone projects (checkbox toggle)
**Files**: `index.html`, `js/projects.js`, `js/zones.js`

**index.html** — Add checkbox to zone projects section header:
- `<label class="show-toggle"><input type="checkbox" id="showSubZoneProjects"> Include sub-zone projects</label>`

**js/projects.js** — Add `loadSubZoneProjects(zoneId, container, emptyState)` function:
- Recursively collect all sub-zone IDs under the given zone
- Also collect all plant IDs within those sub-zones
- Query projects where targetType='zone' AND targetId in sub-zone IDs, PLUS targetType='plant' AND targetId in plant IDs
- Append to the zone's project container (labeled with source zone/plant name)

**js/zones.js** or **js/projects.js** — Event listener on `showSubZoneProjects` checkbox:
- When checked: call `loadSubZoneProjects()` and append results
- When unchecked: reload just the zone's own projects

### Mod 7: Activities — compact list with Edit button; move Save-as-Action & Delete to edit screen
**Files**: `index.html`, `js/activities.js`, `css/styles.css`

**js/activities.js** — Rewrite `createActivityItem()`:
- Compact rendering: date + description on one line + "Edit" button on right
- Remove "Save as Action" and "Delete" buttons from list items

**index.html** — Add new `editActivityModal`:
- Read-only display of: date, description, chemical, notes
- Action buttons: "Save as Action" (if not from saved action), "Delete", "Close"

**js/activities.js** — Add `openEditActivityModal(activityId)`:
- Load activity from Firestore
- Populate read-only display fields
- Wire "Save as Action" to existing `openSaveAsActionModal()` flow
- Wire "Delete" to existing `handleDeleteActivity()` flow

**css/styles.css**:
- `.activity-item` compact layout: flex row, date + description + edit button
- Remove old action button styles from activity items

### Mod 8: Saved action modal stays open until Save/Cancel
**Files**: `js/activities.js`

- Remove the overlay click-to-close handler for `savedActionModal` (line ~733 in activities.js)
- The `if (e.target === this) closeModal('savedActionModal')` line gets removed
- Modal will only close via Save or Cancel buttons

### Mod 9: Problems — compact layout with inline buttons; Delete moved to edit modal
**Files**: `js/problems.js`, `index.html`, `css/styles.css`

**js/problems.js** — Rewrite `createProblemItem()`:
- Single-row layout: status badge + description on left, Resolve/Edit buttons on right
- Remove Delete button from list items
- Notes and dates shown as smaller secondary text below description (or hidden)

**index.html** — Add Delete button to `problemModal`:
- Only visible in edit mode (hidden when adding)
- Wired to `handleDeleteProblem()` then closes modal

**css/styles.css**:
- `.problem-item` flex row: badge + description left, buttons right
- Reduce vertical padding for more compact items

### Mod 10: (Covered in Mod 1 — bloom/dormant month fields)
Already included in Mod 1 above.

### Verification ✅ COMPLETE (tested in browser)
- ✅ Metadata dropdowns save/load correctly; Save button enables/disables on change
- ✅ Bloom/dormant month fields present and working
- ✅ Projects collapse/expand with chevron and item count badge
- ✅ My Yard shows rolled-up All Projects and Upcoming Calendar sections
- ✅ Zone detail "Include sub-zones" checkbox loads projects from entire hierarchy (resets on navigation)
- ✅ Activity Edit button opens Activity Details modal with Save as Action and Delete
- ✅ Problems show compact inline layout (Resolve/Edit inline); Delete is in edit modal
- ✅ Home page title is "My Yard"
- Mod 8 (saved action modal overlay fix) coded; logic correct

---

## Phase 7.6: Feature Enhancements ✅ COMPLETE

Eight user-requested features. Grouped by area: Facts/Chemicals, Multi-Chemical, and Calendar-Zone integration.

---

### Change 1: Clickable URLs in fact values
**Files**: `js/facts.js`

In `createFactItem()`, when rendering the fact value, check if the value starts with `http`. If so, render it as an `<a href="..." target="_blank" rel="noopener noreferrer">` link instead of plain text. This applies to facts on plants, zones, and chemicals (Change 8).

- No data model changes needed
- One-line change in the display renderer

---

### Change 2: Chemical detail page with facts
**Files**: `index.html`, `js/chemicals.js`, `js/app.js`, `css/styles.css`

Currently chemicals are just name + notes in a list. This adds a full detail page.

**New route**: `#chemical/id`

**`js/app.js`** — Add handler for `#chemical/id` that calls `loadChemicalDetail(id)` and shows `page-chemical`.

**`index.html`** — Add `page-chemical` section with:
- Chemical name heading + Edit/Delete buttons
- Notes display
- Facts section (Add/Edit/Delete facts, same pattern as plants/zones)
- Facts support clickable URLs from Change 1

**`js/chemicals.js`** — Add `loadChemicalDetail(id)` function. Make each chemical in the list clickable (navigates to `#chemical/id`).

**`js/facts.js`** — Already supports any `targetType`; just pass `'chemical'` and the chemicalId. No changes needed in facts.js beyond Change 1.

**Data model**: No new collection — `facts` already uses `targetType`/`targetId`, so `targetType: 'chemical'` just works.

---

### Change 3: Multiple chemicals on activities and saved actions
**Files**: `index.html`, `js/activities.js`, `css/styles.css`

Currently activities and saved actions hold a single `chemicalId`. Replace with `chemicalIds[]` array and a checkbox-list selector in the UI.

**Data model changes**:
- `savedActions`: `chemicalId` (string) → `chemicalIds` (string[])
- `activities`: `chemicalId` (string) → `chemicalIds` (string[])
- **Backward compat**: when reading old records, if `chemicalIds` is absent but `chemicalId` exists, treat as `[chemicalId]`

**`index.html`** — In `activityModal` and `savedActionModal`, replace the `<select>` chemical dropdown with a scrollable checkbox list (same style as the weed zone-checkbox-list).

**`js/activities.js`** — Update:
- `buildChemicalCheckboxList()`: new function to render checkboxes for all chemicals, pre-checking saved values
- `saveActivity()` / `handleSavedActionSave()`: read checked items, save as `chemicalIds[]`
- `loadChemicalCheckboxList()`: populate and pre-check when editing existing records
- Activity display (compact row + view modal): show comma-separated chemical names; handle multiple
- Backward compat: normalize `chemicalId` → `[chemicalId]` on read

---

### Change 4: Add calendar event from zone or plant page
**Files**: `index.html`, `js/calendar.js`, `js/zones.js`, `js/plants.js`

**Data model change** — `calendarEvents`: add optional fields:
- `targetType`: `'zone'` / `'plant'` / `null`
- `targetId`: string / `null`

These are `null` for events created from the main Calendar page.

**`index.html`** — Add "+ Add Event" button to zone detail and plant detail pages (in a new Calendar Events section header — see Change 5).

**`js/calendar.js`** — Update `openAddEventModal()` to accept optional `targetType` and `targetId` params. When provided, store them on the modal dataset and save them to Firestore. Display the linked entity name in the modal ("Adding event for: Front Yard").

**`js/zones.js` / `js/plants.js`** — Wire up the "+ Add Event" button to call `openAddEventModal('zone', zoneId)` or `openAddEventModal('plant', plantId)`.

---

### Change 5: Calendar events list on zone and plant pages
**Files**: `index.html`, `js/calendar.js`, `js/zones.js`, `js/plants.js`

Each zone and plant detail page shows upcoming calendar events tied to it.

**`index.html`** — Add a "Calendar Events" section to both `page-zone` and `page-plant`:
- Section header: "Calendar Events" + "+ Add Event" button
- Container div + empty state

**`js/calendar.js`** — Add `loadEventsForTarget(targetType, targetId, containerId, emptyStateId)`:
- Query `calendarEvents` where `targetType == targetType` AND `targetId == targetId`
- Generate occurrences for next 3 months (same logic as home page)
- Render compact event cards with Edit / Delete / Complete buttons (Complete from Change 6)

**`js/zones.js`** — Call `loadEventsForTarget('zone', zoneId, ...)` in `loadZoneDetail()`
**`js/plants.js`** — Call `loadEventsForTarget('plant', plantId, ...)` in `loadPlantDetail()`

---

### Change 6: Calendar events linked to saved actions
**Files**: `index.html`, `js/calendar.js`

**Data model change** — `calendarEvents`: add optional `savedActionId` field.

**`index.html`** — Add "Use Saved Action" dropdown to the calendar event modal (same as the activity modal's "Use Saved Action" picker). When an action is selected, pre-fill the event's title (from action name) and description. The dropdown shows `-- None --` by default.

**`js/calendar.js`** — Load saved actions into the dropdown when the modal opens. On change, auto-fill title and description. Store `savedActionId` in Firestore. When completing the event (Change 7), pass the `savedActionId` to the created activity.

---

### Change 7: Complete a calendar event → create activity
**Files**: `index.html`, `js/calendar.js`, `js/activities.js`, `css/styles.css`

**Data model changes** — `calendarEvents`:
- `completed`: boolean (for one-time events; default `false`)
- `completedDates`: string[] (for recurring events — array of ISO date strings of completed occurrences)

**Behavior**:
- **One-time event**: Complete button marks `completed: true`, records `completedAt` date, creates an activity, hides from upcoming view
- **Recurring event**: Complete button for a specific occurrence adds that date to `completedDates[]`, creates an activity for that date; the series continues and future occurrences still appear

**"Complete" flow**:
1. User clicks Complete on an event card
2. A small confirm modal opens: shows event title/date, optional notes field ("Add notes to the activity log?")
3. On confirm: creates activity record (`targetType`, `targetId`, `description` from event title, `notes` from input, `date` = occurrence date, `savedActionId` from event if set, `chemicalIds` from linked saved action if set), marks event/occurrence as completed
4. Reloads the event list

**`index.html`** — Add "Complete Event" confirm modal with notes textarea + Confirm/Cancel buttons.

**`js/calendar.js`** — Add `openCompleteEventModal(eventId, occurrenceDate)` and `handleCompleteEvent()`. Add Complete button to each event card.

**`css/styles.css`** — Style the Complete button (green outline or solid).

---

### Change 8: Show past uncompleted calendar events
**Files**: `js/calendar.js`, `index.html`, `css/styles.css`

Add an "Overdue" section to the main Calendar page (and optionally to zone/plant event lists) showing past events that were never completed.

**Logic**:
- One-time events: `date < today` AND `completed !== true`
- Recurring events: generate occurrences from `date` up to yesterday, exclude dates in `completedDates[]`

**`js/calendar.js`** — Add `loadOverdueEvents(containerId)`:
- Query all calendarEvents
- For each, check for uncompleted past occurrences
- Render in a distinct style (e.g., amber/orange left border, "OVERDUE" badge)

**`index.html`** — Add "Overdue" section at the top of the Calendar page (above upcoming events), with its own container and empty state.

**`css/styles.css`** — Add `.calendar-overdue-card` style with amber left border and overdue badge.

---

### Implementation Order
1. **Change 1** — Clickable URLs in facts (1 line, standalone)
2. **Change 2** — Chemical detail page (standalone, builds on Change 1)
3. **Change 3** — Multi-chemical checkboxes (standalone but complex — data model change)
4. **Change 4** — Add calendar event from zone/plant (adds targetType/targetId to calendarEvents)
5. **Change 5** — Zone/plant calendar event list (depends on Change 4)
6. **Change 6** — Calendar events linked to saved actions (depends on Changes 4/5)
7. **Change 7** — Complete event → create activity (depends on Changes 4/5/6)
8. **Change 8** — Overdue events (depends on Change 7)

### Data Model Changes Summary

| Collection     | Change |
|----------------|--------|
| `calendarEvents` | Add `targetType?`, `targetId?`, `savedActionId?`, `completed`, `completedDates[]` |
| `savedActions` | `chemicalId` → `chemicalIds[]` (backward compat: normalize on read) |
| `activities`   | `chemicalId` → `chemicalIds[]` (backward compat: normalize on read) |
| `facts`        | No schema change; `targetType: 'chemical'` now supported |

### Verification ✅ COMPLETE (tested in browser)
- ✅ Fact values with http URLs render as clickable links opening new tabs
- ✅ Chemical detail page shows name, notes, and facts; clickable from chemicals list
- ✅ Activity and saved action modals show chemical checkbox list; multiple chemicals save and display correctly
- ✅ "+ Add Event" button on zone page shows "Adding event for: [Zone Name]" label
- ✅ Zone page shows Calendar Events section with linked upcoming events
- ✅ Saved action dropdown in calendar event modal present
- ✅ Completing a one-time event creates an activity and hides the event from overdue/upcoming
- ✅ Overdue section on Calendar page shows past uncompleted events with orange styling and OVERDUE badge
- ✅ Cache-busting version params added to all script tags in index.html (`?v=76`)

---

## Phase 7.7: Ad-hoc Fixes & Enhancements

### Fix 1: Home screen calendar events show Complete/Edit/Copy/Delete buttons
**Files**: `js/calendar.js`

`loadHomeCalendar()` was rendering compact read-only rows (date + title only). Replaced with `createCalendarEventCard(occ, loadHomeCalendar)` so the same full cards used on the main Calendar page appear on the home screen, including Complete, Edit, Copy, and Delete buttons. Version bumped to `?v=77`.

**Verification** ✅: Edit modal opens correctly from home screen; Complete button triggers complete-event flow.

---

### Fix 2: Calendar event Delete moved to Edit modal
**Files**: `index.html`, `js/calendar.js`

Removed the Delete button from all event cards (`createCalendarEventCard()`). Added a Delete button to the calendar event modal — visible only in edit mode (hidden for add/copy). Delete sits on the left side of the modal button row (`margin-right:auto`), Cancel and Save on the right. Clicking Delete closes the modal then calls `handleDeleteCalendarEvent()` with the correct reload callback. Version bumped to `?v=78`.

**Verification** ✅: Cards show Complete/Edit/Copy only. Edit modal shows Delete (red, left-aligned) alongside Cancel and Save.

---

### Fix 3: "Are you sure" confirm always appears before modal closes
**Files**: `js/activities.js`, `js/calendar.js`

All delete handlers already had `confirm()` dialogs, but two cases had a UX bug: the modal closed *before* the confirm appeared (jarring sequence). Fixed both:

- **Activity delete** (`viewActivityModal`): moved confirm to the Delete button onclick (before `closeModal`), removed the now-redundant confirm from inside `handleDeleteActivity`.
- **Calendar event delete** (`calendarEventModal`): made the onclick async — fetches the event first to determine if recurring (so the message is correct), confirms while the modal is still open, then closes and deletes. Removed the now-redundant confirm+fetch from inside `handleDeleteCalendarEvent`.

All other deletes (zones, plants, weeds, chemicals, problems, facts, projects, photos, saved actions) already confirm correctly inline. Version bumped to `?v=79`.

**Verification** ✅: No console errors on reload.

---

### Fix 4: Multi-zone associations on calendar events
**Files**: `index.html`, `js/calendar.js`

Calendar events can now be linked to **multiple zones**. If an event was created from a plant page, the plant association is shown as read-only and zone editing is not available.

**Data model**: Added `zoneIds[]` array field to `calendarEvents`. The existing `targetType`/`targetId` fields are kept for backward compatibility (plant links still use them; old zone-linked events still query by them).

**Edit modal**: A "Linked Zones (optional)" checkbox list appears when editing/adding/copying events (hidden for plant-linked events). On edit, zones are pre-checked from `zoneIds[]`, falling back to `targetId` for old-style zone-linked events that predate this change.

**Zone page events**: `loadEventsForTarget()` now runs two Firestore queries for zone pages — one for old-style `targetType/targetId` links and one for new `zoneIds array-contains` — then merges results by event ID to avoid duplicates.

**New helper**: `loadCalEventZoneCheckboxes(selectedZoneIds)` builds the zone checkbox list using the same `buildZoneOptionsTree()` + `zone-checkbox-list` CSS pattern used by weed zone assignment.

Version bumped to `?v=80`.

**Verification** ✅:
- Add Event from calendar page shows all zones unchecked
- Edit existing zone-linked event shows that zone pre-checked (backward compat fallback)
- Add Event from plant page shows plant name read-only, no zone section
- No console errors

---

### Fix 5: "Show completed" checkbox on Calendar page
**Files**: `index.html`, `js/calendar.js`, `css/styles.css`

Added a "Show completed" checkbox to the Calendar page header (next to the range picker). When checked, completed events appear in the list alongside upcoming ones.

- **Unchecked (default)**: only uncompleted upcoming events shown (existing behavior)
- **Checked**: completed occurrences also appear, visually distinguished:
  - Card has green left border and 60% opacity
  - Title has strikethrough styling
  - Green "✓ Completed" badge shown
  - Complete button hidden (already done); Edit and Copy still available
- One-time events: `completed: true` events within the display range appear
- Recurring events: occurrences in `completedDates[]` within the display range appear
- Added `?v=81` to CSS link tag (previously missing — caused cached styles to persist)

Version bumped to `?v=81`.

**Verification** ✅:
- Unchecked: completed event hidden, shows "No events in the next 3 months"
- Checked: completed event appears with strikethrough, green badge, no Complete button
- No console errors

---

### Fix 6: Per-occurrence delete for recurring calendar events
**Files**: `index.html`, `js/calendar.js`

When editing a recurring event (opened from a specific occurrence card), clicking Delete now opens a new **Delete Recurring Event** modal with two choices:

- **Delete This Occurrence Only**: Adds the occurrence date to a `cancelledDates[]` array on the Firestore document. Future occurrences are unaffected. The occurrence disappears from all calendar views.
- **Delete All Occurrences**: Prompts a final confirmation, then deletes the Firestore document entirely (previous behavior).

Implementation details:
- New Firestore field: `cancelledDates[]` on calendarEvents — ISO date strings of individually deleted occurrences
- `generateOccurrences()` now filters out dates in `cancelledDates[]` when generating the occurrence list
- `openEditCalendarEventModal()` accepts a third param `occurrenceDate` and stores it in `modal.dataset.occurrenceDate`
- Edit button in `createCalendarEventCard()` passes `occ.occurrenceDate` to `openEditCalendarEventModal()`
- New modal: `deleteRecurringModal` with "Delete This Occurrence Only", "Delete All Occurrences", and Cancel buttons
- New functions: `openDeleteRecurringModal()`, `handleDeleteThisOccurrence()`, `handleDeleteAllOccurrences()`
- Module-level `pendingDeleteRecurring` state (pattern matches `pendingCompleteOccurrence`)
- If Edit was opened without an occurrence date (e.g. from a future integration), falls back to simple "delete all" confirm

Version bumped to `?v=82`.

---

## Phase 7.8: Review Fixes

### Fix 1: Facts section in chemical edit modal ✅ COMPLETE
**Files**: `index.html`, `js/chemicals.js`, `js/facts.js`

Added a Facts section to the `chemicalModal` (Add/Edit modal), matching the pattern used by the problem modal in Phase 7.7.

- `index.html`: Added `chemicalFactsSection` div (hidden by default) with a `+ Add` button (`addChemicalModalFactBtn`), `chemicalModalFactsContainer`, and `chemicalModalFactsEmptyState`
- `js/chemicals.js`: `openAddChemicalModal()` hides the facts section; `openEditChemicalModal()` shows it and calls `loadFacts('chemical', id, 'chemicalModalFactsContainer', ...)`
- `js/facts.js`: Updated `reloadFactsForCurrentTarget` — the `chemical` case now checks if `chemicalModal` has class `open`; if so, reloads `chemicalModalFactsContainer`, otherwise reloads `chemicalFactsContainer` (detail page). Added `addChemicalModalFactBtn` click listener that reads `chemicalModal.dataset.editId`.

- `css/styles.css`: Added `#factModal { z-index: 300; }` so the Add Fact modal renders above any parent modal (e.g. the chemical edit modal). Previously both had `z-index: 200` so the fact modal was hidden behind.

Version bumped to `?v=92`.

**Verification** ✅: Edit modal shows Facts section with "+ Add" button. Clicking "+ Add" opens the Add Fact modal on top of the chemical edit modal.

---

### Fix 2: Zone calendar section includes plant-linked events (roll-up) ✅ COMPLETE
**Files**: `js/calendar.js`

Zone calendar event sections now show events tied to plants within that zone and all its sub-zones, in addition to events directly linked to the zone.

**Logic added to `loadEventsForTarget` zone branch:**
1. Call `getDescendantZoneIds(zoneId)` (already in plants.js) to get the zone + all descendant zone IDs
2. Query `plants` where `zoneId in [zone IDs]` (chunked at 30 for Firestore limits) to collect plant IDs
3. Query `calendarEvents` where `targetType == 'plant' AND targetId in [plant IDs]` (chunked at 30) and merge into `eventsMap`

This means a plant event automatically appears on its direct zone, its parent zone, and the grandparent zone — matching the roll-up behavior expected.

Version bumped to `?v=93`.

**Verification** ✅: No new console errors.

---

### Fix 3: Facts section available when adding a problem/concern ✅ COMPLETE
**Files**: `js/problems.js`, `js/facts.js`

The Facts section now shows in both add and edit modes of the problem modal.

**Add mode behavior**: Facts section is visible with the message "Save this problem first, then add facts." When the user clicks "+ Add" on facts, `ensureProblemSaved()` runs first — it validates the description, saves the problem to Firestore, switches the modal to edit mode (title, delete button, dataset.editId all updated), then opens the Add Fact modal. Subsequent fact adds work normally since the modal is now in edit mode.

**`ensureProblemSaved()` helper** (new function in problems.js):
- If already in edit mode: returns `modal.dataset.editId`
- If in add mode: validates description → saves to Firestore → switches modal to edit mode → reloads facts section and problems list → returns new ID

**`addProblemFactBtn` listener** (facts.js): changed to `async`, calls `await ensureProblemSaved()`, then `openAddFactModal` with the returned ID.

Version bumped to `?v=94`.

**Verification** ✅: Add modal shows Facts section with helper message and "+ Add" button. No new console errors.

---

### Fix 4: Project checklist stays expanded after add/edit/delete ✅ COMPLETE
**Files**: `js/projects.js`

The expand-state preservation code already existed in `loadProjects()` (used by zone/plant pages), but `loadAllProjects()` (used by the home page "All Projects" section) was missing it. Projects on the home page would collapse after any checklist operation.

**Root cause**: `loadAllProjects()` called `container.innerHTML = ''` without first capturing which projects were expanded.

**Fix**: Added the same expand-capture-before-clear + restore-after-render pattern to `loadAllProjects()`:
- Before clearing: `container.querySelectorAll('[data-project-id]')` → capture IDs with `.project-body.expanded`
- After rendering each card: if `expandedIds[project.id]`, add `expanded` class and set chevron to ▾

Version bumped to `?v=95`.

**Verification** ✅: Expand a project on the home page, add a checklist item — project stays expanded after reload. Chevron remains ▾.

---

### Fix 5: Enter key in fact Value field submits the modal ✅ COMPLETE
**Files**: `js/facts.js`

Added a `keydown` listener on `factValueInput` — pressing Enter calls `handleFactModalSave()`, same as clicking Save.

Version bumped to `?v=96`.

**Verification** ✅: Enter key in value field closes modal (fact saved).

---

### Fix 6: Wider chemical edit modal + multi-line fact values ✅ COMPLETE
**Files**: `css/styles.css`

- Added `#chemicalModal .modal { max-width: 640px; }` — up from the default 480px, giving more room to see fact values and URLs.
- Changed `.fact-row` from `align-items: center` to `align-items: flex-start` so that multi-line fact values look correct (label and action buttons stay at the top instead of vertically centering against a tall value).

Version bumped to `?v=97`.

**Verification** ✅: Chemical edit modal is wider (640px max-width confirmed via CSS inspection).

---

### Fix 7: Show zone/plant association on calendar event cards ✅ COMPLETE
**Files**: `js/calendar.js`, `css/styles.css`

Added an async name-lookup after the description in `createCalendarEventCard()`:
- If `targetType === 'plant'`: fetches the plant doc and shows "Plant: {name}"
- If `zoneIds[]` is set: fetches each zone doc and shows "Zone: {name}" or "Zones: A, B, C"
- Displayed as `.calendar-event-target` — small (0.8rem), muted gray, italic
- Applies to all calendar event cards: main calendar page, zone/plant embedded sections, and overdue section

Version bumped to `?v=98`.

**Verification** ✅: Calendar page shows "Zone: Front Yard" under Test Event and "Plant: Purple Diamond" under Spray Weeds.

---

## Phase 8: Polish & Responsive Design — NOT STARTED

**Step 8.1** — Mobile and cross-device polish
- Test and fix responsive layout on phone, tablet, desktop
- Touch-friendly tap targets
- Loading indicators for Firebase operations
- Confirmation dialogs for destructive actions
- Empty state messages ("No plants yet — add one!")

**Verify**: Test on phone, Chromebook, and desktop. All screens usable on all devices.

---

## Phase 9: Deployment — NOT STARTED

**Step 9.1** — Deploy to free hosting
- Initialize git repo
- Push to GitHub
- Deploy via GitHub Pages (or Cloudflare Pages)
- Configure Firebase security rules for production (open read/write since no auth)

**Verify**: Access the app via the public URL from phone, Chromebook, and desktop. All features work.

---

## Data Model Summary (Actual)

| Collection       | Key Fields                                                                  |
|------------------|-----------------------------------------------------------------------------|
| zones            | name, parentId, level, createdAt                                            |
| plants           | name, zoneId, metadata{}, createdAt                                         |
| activities       | targetType, targetId, description, notes, chemicalIds[], date, savedActionId |
| savedActions     | name, description, chemicalIds[], notes                                      |
| chemicals        | name, notes                                                                  |
| photos           | targetType, targetId, imageData (Base64), caption, createdAt                |
| problems         | targetType, targetId, description, notes, status, dateLogged, resolvedAt    |
| facts            | targetType, targetId, label, value                                          |
| projects         | targetType, targetId, title, notes, status, items[], completedAt            |
| weeds            | name, treatmentMethod, applicationTiming, notes, zoneIds[]                  |
| calendarEvents   | title, description, date, recurring{type,intervalDays}, targetType?, targetId?, savedActionId?, completed, completedDates[] |

## File Structure (Current)

```
Bishop/
├── index.html              (all page sections, modals, script tags)
├── CLAUDE.md               (project instructions for Claude)
├── css/
│   └── styles.css          (all styles, responsive, mobile-first)
├── js/
│   ├── firebase-config.js  (Firebase init, project bishop-62d43)
│   ├── app.js              (routing, navigation, mobile nav)
│   ├── zones.js            (zone CRUD, modal utilities, breadcrumbs)
│   ├── plants.js           (plant CRUD, metadata, zone picker, "View All Plants")
│   ├── activities.js       (activity logging, saved actions, chemical dropdown)
│   ├── chemicals.js        (chemical/product list CRUD)
│   ├── photos.js           (photo capture, Base64 compress, gallery viewer)
│   ├── problems.js         (problems/concerns per plant/zone)
│   ├── facts.js            (facts per plant/zone)
│   ├── projects.js         (projects with checklists per plant/zone)
│   ├── weeds.js            (weed tracking, zone assignment, photos, activities)
│   └── calendar.js         (calendar events, recurring logic, occurrence generation)
└── .claude/
    └── launch.json         (dev server config: Python HTTP on port 8080)
```
