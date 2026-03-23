# Bishop — New Features Plan

## Overview
This document tracks planned feature enhancements beyond the original build phases.
Each feature has an ID (NF-1, NF-2, etc.), a description, scope, and implementation notes.

Status values: `PLANNED` | `IN PROGRESS` | `COMPLETE`

---

## NF-1 — Global Search
**Status:** COMPLETE

**What it does:**
A search bar (in the header or on its own "Search" page) that searches across all major entities simultaneously: plants, zones, chemicals, things/sub-things, and weeds. Results are grouped by type. Clicking a result navigates directly to that entity's detail page.

**Why it matters:**
Currently you must know where something lives in the hierarchy to find it. If you can't remember which zone a plant is in, you have to browse. Search fixes that.

**Scope:**
- Search input — either in the header nav or as a dedicated `#search` page
- Queries Firestore for each collection (plants, zones, chemicals, things, weeds) filtered by name
- Results rendered in grouped sections: Plants, Zones, Things, Chemicals, Weeds
- Each result is a clickable link to the detail page
- Minimum 2 characters before search fires; debounce ~400ms

**Effort estimate:** Medium (~4–6 hours)

---

## NF-2 — Activity History Report
**Status:** COMPLETE

**What it does:**
A report page (accessible from nav or Settings) showing all logged activities across all plants, zones, and weeds in reverse-chronological order. Filterable by date range and optionally by zone or chemical used.

**Why it matters:**
Activities are currently siloed — you can only see them per-plant or per-zone. There's no way to answer "what did I do this week?" without visiting every entity individually.

**Scope:**
- New page `#activityreport` (or a tab on the Calendar page)
- Loads all activities, sorted by date descending
- Filter controls: date range (From / To), zone picker, chemical multi-select
- Each row shows: date, target name (plant/zone/weed), description, chemicals used
- Clicking a row navigates to that entity's detail page
- "Export to CSV" button (optional stretch goal — generates a downloadable .csv)

**Effort estimate:** Medium (~4–6 hours)

---

## NF-3 — Chemical Usage Log (on Chemical Detail Page)
**Status:** COMPLETE

**What it does:**
On the chemical detail page, add a section listing every activity that has ever used that chemical — showing the date, the target (plant/zone/weed name), and the activity description.

**Why it matters:**
Currently there's no way to see where and when a chemical was applied without checking each plant/zone individually. This gives you a complete usage audit from the chemical's perspective.

**Scope:**
- New section on `#chemical` detail page: "Usage History"
- Queries `activities` where `chemicalIds` array contains this chemical's ID
- Displays list sorted by date descending: date | target name | description
- Target name is a clickable link to the plant/zone/weed detail page
- Fetches target names in batch after loading activities (avoid N+1 queries)

**Effort estimate:** Small (~2–3 hours)

---

## NF-4 — Plant Health Status
**Status:** COMPLETE

**What it does:**
Adds a **Health Status** field to each plant record: `Healthy`, `Struggling`, `Dormant`, or `Dead`. The status shows as a small colored badge on plant cards in zone list views, so you can immediately see which plants need attention without opening each one.

**Why it matters:**
Right now you'd have to read each plant's problems list to understand its current state. A simple status indicator on the list card surfaces that at a glance.

**Scope:**
- Add `healthStatus` field to plant Firestore documents (default: not set / unknown)
- Edit plant modal gets a "Health Status" dropdown: `—`, `Healthy`, `Struggling`, `Dormant`, `Dead`
- Plant cards in zone views display a badge when status is set:
  - 🟢 Healthy | 🟡 Struggling | 🔵 Dormant | 🔴 Dead
- Plant detail page header also shows the badge
- "View All Plants" list also shows the badge

**Effort estimate:** Small (~2–3 hours)

---

## NF-5 — Seasonal Care Checklists
**Status:** COMPLETE

**What it does:**
A reusable checklist system for recurring seasonal tasks. User creates named checklist templates (e.g., "Spring Startup", "Fall Winterization") with a list of task items. Each season, they "run" a checklist — which creates a fresh instance that can be checked off item by item. Completed runs are saved as history.

**Why it matters:**
Calendar events are great for individual tasks on specific dates. Checklists are better for a batch of tasks you do every year in sequence — "do these 10 things before winter."

**Scope:**
- New Firestore collections: `checklistTemplates` (name, items[]) and `checklistRuns` (templateId, startedAt, completedAt, items[{label, done}])
- New page `#checklists` accessible from nav (or from Settings)
- Template management: create/edit/delete templates with drag-to-reorder items
- "Start Checklist" button creates a new run from a template
- Active runs show as interactive checklists — tap item to toggle done
- Completed runs archived with date for reference

**Effort estimate:** Large (~8–10 hours)

---

## NF-6 — Application Rate / Amount on Activities
**Status:** COMPLETE

**What it does:**
When logging an activity that includes one or more chemicals, add an optional free-text **"Amount Used"** field to capture dosage/quantity. Examples: "2 oz per gallon, 1 gallon applied" or "Granules — broadcast 5 lbs."

**Why it matters:**
Currently there's no structured way to record how much of a product was used. For fertilizers and pesticides, this is useful for calculating reorder quantities and verifying correct application rates.

**Scope:**
- Add `amountUsed` text field to the activity add/edit modal, shown only when at least one chemical is selected
- Displayed in the activity detail list view on plant/zone/weed pages
- Also visible in the Chemical Usage Log (NF-3) history rows
- Saved as a string field on the `activities` Firestore document

**Effort estimate:** Small (~1–2 hours)

---

## NF-7 — Reschedule Overdue Calendar Events
**Status:** COMPLETE

**What it does:**
Adds a **Reschedule** button to events shown in the Overdue section of the Calendar page. Clicking it opens a simple date picker to pick a new date, then updates the event (or advances the next occurrence for recurring events).

**Why it matters:**
Currently an overdue event can only be completed or ignored. Often the task just got pushed back — "I didn't spray last week, let me move it to this Friday." Rescheduling without fully completing or deleting is a natural workflow.

**Scope:**
- Add "Reschedule" button alongside existing Complete / Edit / Delete buttons on overdue cards
- For **one-time events**: updates the `date` field in Firestore to the new date
- For **recurring events**: adds the old date to `cancelledDates[]` and updates the series start date so the next occurrence appears at the new date
- Simple inline date input (not a full modal — just a date picker + Confirm button that appears inline when Reschedule is clicked)

**Effort estimate:** Small–Medium (~2–3 hours)

---

## NF-8 — Clone / Duplicate a Plant
**Status:** COMPLETE

**What it does:**
A **Clone** button on the plant detail page that opens the Add Plant modal pre-filled with the source plant's name, zone, and all metadata fields. User can adjust any field before saving. Creates a fresh record with no activities, photos, facts, problems, or projects carried over.

**Why it matters:**
When you have multiple identical plants (e.g., 5 azalea bushes in the same bed), you currently create each from scratch. Cloning one saves re-entering name, zone, watering needs, sun preference, etc.

**Scope:**
- Add a "Clone" button to the plant detail page header actions
- Clicking it calls `openPlantModal('add')` and pre-fills all fields from the current plant
- A note " (Clone)" appended to the name by default so user can distinguish it
- No history, photos, facts, problems, or projects are copied — only the record definition
- Works within plants.js; no new Firestore writes until user clicks Save

**Effort estimate:** Small (~1–2 hours)

---

## NF-9 — Bulk Activity Logging
**Status:** COMPLETE

**What it does:**
Allows logging a single activity against **multiple plants or zones at once**. For example: "I fertilized all 8 rose bushes today" — instead of opening each plant and logging individually, you select all 8 and log once.

**Why it matters:**
Batch care events (watering a bed, treating all plants in a zone) are common but currently require one log entry per plant. This is the biggest day-to-day time saver for heavy plant coverage.

**Scope:**
- New "Log Bulk Activity" button on zone detail pages
- Opens a bulk-log modal with a checklist of all plants in that zone (and sub-zones, with a toggle)
- User selects target plants (checkboxes), fills in the standard activity fields (description, date, chemicals, notes, amount used)
- On Save: writes one `activities` document per selected plant (same content, different `targetId`)
- Option to also log against the zone itself (a single zone-level activity) instead of or in addition to individual plants
- New UI: bulk-select checkbox list with "Select All" toggle

**Effort estimate:** Medium (~4–5 hours)

---

## NF-10 — Purchase Date on Things
**Status:** PLANNED

**What it does:**
Adds an optional **Purchase Date** field to Thing records in the House section. Displayed on the Thing detail page so you have a simple reference for when an appliance, fixture, or item was acquired.

**Why it matters:**
Useful for appliances and major items — knowing when a water heater or dishwasher was purchased helps gauge expected remaining lifespan.

**Scope:**
- Add `purchaseDate` date field to the Thing add/edit modal (optional)
- Display "Purchased: [date]" on the Thing detail page when set
- Stored as an ISO date string in Firestore

**Effort estimate:** Very Small (~1 hour)

---

## NF-11 — Calendar Rollup on House Page
**Status:** PLANNED

**What it does:**
Adds an **Upcoming Events** rollup section to the House main page (`#house`), positioned between the Floors list and the Breaker Panel section. Shows the next 14 days of calendar events as a compact, read-only list. Each item links to the Calendar page.

**Why it matters:**
When you land on the House page, you can immediately see if anything is coming up on the calendar — without having to switch to the Calendar view. Useful for scheduled maintenance reminders (HVAC filter, service visits, etc.).

**Scope:**
- Query `calendarEvents` when the House page loads (reuse the same recurring-expansion logic from calendar.js)
- Filter to events occurring within the next 14 days from today
- Render as a simple compact list: date and title per event
- "View Calendar →" link at the bottom of the section navigates to `#calendar`
- Empty state: "No upcoming events in the next 14 days."
- Does NOT show overdue events (the Calendar page handles those)
- Section heading: "Upcoming (Next 14 Days)"
- Position: between the Floors list and the Breaker Panel section on the `#house` page

**Effort estimate:** Small (~2 hours)

---

## Summary Table

| ID    | Feature                          | Effort     | Status  |
|-------|----------------------------------|------------|---------|
| NF-1  | Global Search                    | Medium     | COMPLETE |
| NF-2  | Activity History Report          | Medium     | COMPLETE |
| NF-3  | Chemical Usage Log               | Small      | COMPLETE |
| NF-4  | Plant Health Status              | Small      | COMPLETE |
| NF-5  | Seasonal Care Checklists         | Large      | COMPLETE |
| NF-6  | Application Rate on Activities   | Small      | COMPLETE |
| NF-7  | Reschedule Overdue Events        | Small      | COMPLETE |
| NF-8  | Clone a Plant                    | Small      | COMPLETE |
| NF-9  | Bulk Activity Logging            | Medium     | COMPLETE |
| NF-10 | Purchase Date on Things          | Very Small | PLANNED |
| NF-11 | Calendar Rollup on House Page    | Small      | PLANNED |

---

## Deferred / Answered Items

| Original # | Feature                        | Decision                                              |
|------------|--------------------------------|-------------------------------------------------------|
| #7         | Maintenance intervals on Things| Not needed — use Calendar recurring events instead    |
| #15        | Area calculation on GPS shapes | Already shown in the GPS map feature                 |
| #16        | Link plants to GPS shapes      | Not needed — zones link both plants and shapes already|
| #19        | Browser push notifications     | Deferred — Calendar page serves as the reminder check |
