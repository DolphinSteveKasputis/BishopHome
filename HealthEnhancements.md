# Health Enhancements Plan

## Overview
This document tracks the planned enhancements to the My Health section.
Covers: appointment/visit type, concern/condition linking, medication
assignment flow, per-concern visit notes, concern/condition history,
condition journal, creating concerns/conditions from a visit, promoting
a concern to a condition, My Care Team tile, and People → Contacts rename.

See **Section 12 — Implementation** for the phased build plan.

---

## 1. People → Contacts (app-wide rename)

Rename the existing "People" section to "Contacts" throughout the app.
Enables medical professional and facility tracking used by health enhancements.

### Contact Categories
Every contact gets a `category` field:
- **Personal** — family, friends (existing people, default)
- **Medical Professional** — doctor, dentist, therapist, specialist
- **Medical Facility** — clinic, hospital, lab, pharmacy
- **Service Professional** — plumber, electrician, contractor (future scope)
- **Other**

### Additional Fields (new)
- `category` — one of the values above
- `specialty` — for Medical Professional (e.g., "Family Medicine", "Dermatology")
- `phone`, `address`, `email`, `website` — verify existing and fill gaps

### Route / Nav Changes
- Nav label: "People" → "Contacts"
- Route: `#people` → `#contacts`, `#person/{id}` → `#contact/{id}`
- Firestore collection stays `people` internally (no data migration needed)
- Existing person records get `category: 'Personal'` as default

---

## 2. My Care Team (new tile + page)

A new tile added at the **bottom of the My Health tile grid**.
Navigates to a dedicated Care Team page listing the user's medical contacts.

### My Health Grid Update
Add tile at end of grid:
```
[ 👨‍⚕️ My Care Team ]
```

### Care Team Page
Shows a list of role-based cards, each with provider and/or facility:
```
General Practice
  Dr. Nathan Szakal        [→ contact]
  Oconee Family Medical    [→ contact]

Dentist
  Dr. Smith                [→ contact]
  ABC Dental               [→ contact]

Dermatologist
  —
  Northside Skin Care      [→ contact]
```
- Tapping a contact name/facility opens that contact's detail page
  (phone, address, email, website all accessible there)
- **"+ Add Member"** button to add a new care team entry
- Each entry has an Edit and Remove button

### Care Team Data Model
- Single document: `userCol('healthCareTeam').doc('default')`
- Field: `members[]` — `{ role, providerContactId, facilityContactId }`
- `role` is free-text (user types "Dermatologist", "Dentist", etc.)

### Add / Edit Member Modal
- Role (free text)
- Provider — searchable contact picker filtered to Medical Professional
  (optional — you might only know the facility)
- Facility — searchable contact picker filtered to Medical Facility (optional)
- Can add new contacts directly from this picker if they don't exist yet

---

## 3. Appointment Modal Changes

### Type Dropdown (shared with visits)
- Dr. Visit
- Specialist
- Follow-up
- Physical / Annual
- Urgent Care
- Emergency
- Dental
- Eye Exam
- Lab / Test
- Procedure

Type is set at appointment creation and carries forward to the visit on convert.

### Facility & Provider Fields
Replace plain `provider` text field with:
- **Facility** — searchable contact picker (Medical Facility) + plain text fallback
  Facility is the primary link since you always know where you're going
- **Provider** — searchable contact picker (Medical Professional) + plain text fallback
  Optional — leave blank if you don't know who you'll see until day-of

On the appointment card:
- Facility shown as tappable link → contact detail (phone, address)
- Provider shown as tappable link if set

### Link to Concerns & Conditions
Single multi-select list of open concerns AND active/managed conditions, tagged:
```
[ ⚠️ Concern ] Sinus Infection
[ 📋 Condition ] Hypertension
```

### Appointment Card Display
Facility link, provider (if set), type badge, concern/condition tags.

### Read-Only After Completion
Once converted to a visit, appointment becomes read-only.

---

## 4. Data Model Changes

| Collection | New Fields |
|---|---|
| `appointments` | `concernIds[]`, `conditionIds[]`, `type`, `facilityContactId`, `providerContactId` |
| `healthVisits` | `concernIds[]`, `conditionIds[]`, `type`, `facilityContactId`, `providerContactId` |
| `medications` | `concernIds[]`, `conditionIds[]` |
| `healthCareTeam` | **NEW** — single doc, `members[{role, providerContactId, facilityContactId}]` |
| `healthConcernLogs` | add `visitId` (optional), `type` ('manual'/'system'/'visit-note') |
| `healthConditionLogs` | **NEW** — `conditionId`, `date`, `note`, `type`, `visitId` (optional) |
| `people` (contacts) | add `category`, `specialty` |

**Note on existing `provider` / `providerType` text fields on visits:**
- `providerType` is replaced by the shared `type` field
- `provider` (text) stays as fallback when no contact is linked
- New `facilityContactId` / `providerContactId` fields are additive

---

## 5. Mark Done — 2-Step Conversion Flow

### Step 1 (enhanced)
Visit details form — pre-filled from appointment where possible:
- **Type** — pre-filled from appointment type
- **Facility** — pre-filled from appointment facilityContactId (tappable)
- **Provider** — pre-filled if set, OR "Who did you see?" field to fill in now
- Date, what was done, outcome, cost, **overall visit notes**

Saving creates the visit record with `concernIds[]` / `conditionIds[]` copied
from the appointment.

### Step 2 — Per-Concern/Condition Notes & Prescriptions
Single accordion list, each item tagged as Concern or Condition:

```
Visit saved ✓  — Step 2: Notes & Prescriptions

[ ⚠️ Concern ] Sinus Infection                    ▼ (expanded)
  Notes for this concern:
  ┌─────────────────────────────────────┐
  │ Prescribed Amoxicillin for 7 days   │
  └─────────────────────────────────────┘
  Medications:
  • Amoxicillin 500mg   [✕]
  [+ Add Med]

[ ⚠️ Concern ] Right Knee Pain                    ▶ (collapsed)
[ 📋 Condition ] Hypertension                     ▶ (collapsed)

[+ Create New Concern]
[+ Create New Condition]

                                          [Done → My Health]
```

**Rules:**
- Per-concern/condition notes saved as `visit-note` log entries with `visitId`.
- Meds get `prescribedAtVisitId` set automatically.
- A med can link to multiple concerns/conditions.
- Done navigates to **My Health main page**.
- Hitting Done without notes or meds is valid.

### Create New Concern / Condition from Visit
Lightweight inline form. On save, new record appears in accordion immediately.
New id added to visit's `concernIds[]` or `conditionIds[]`.

---

## 6. Med Picker (new overlay)

- ALL medications (active + historical, alphabetical).
- Checkboxes — pre-checked if already linked to current concern/condition.
- **"+ Add New"** → medication modal (Scan Rx) → returns auto-checked.
- **Confirm** → updates `concernIds`/`conditionIds`, auto-logs activity.
- No search for now — scrolling acceptable.

---

## 7. Concern Detail Page (collapsible sections)

All sections collapsible. **Journal starts expanded; all others collapsed.**
Summary pinned at top, always visible.

Sections:
1. **Summary** — title, body area, start date, status (pinned, always visible)
2. **Journal** *(starts expanded)* — manual + system + visit-note entries.
   Visit-notes tagged "From visit: [facility, date]", editable after save.
3. **Medications** *(collapsed)* — linked meds, "+ Add Med", remove with logging
4. **Appointments & Visits** *(collapsed)* — reverse-chron; tap to open visit detail
5. **Photos** *(collapsed)* — existing
6. **Facts** *(collapsed)* — **add** (for URLs, reference links, key info)
7. **[Promote to Condition]** button — bottom of page

No Problems section (redundant). No Projects section.

---

## 8. Condition Detail Page (collapsible sections)

All sections collapsible. **Journal starts expanded; all others collapsed.**
Summary pinned at top, always visible.

Sections:
1. **Summary** — name, category, diagnosed date, status (pinned, always visible)
2. **Journal** *(starts expanded)* — manual + system + visit-note entries.
   Visit-notes tagged "From visit: [facility, date]", editable after save.
3. **Medications** *(collapsed)* — linked meds, "+ Add Med", remove with logging
4. **Appointments & Visits** *(collapsed)* — reverse-chron; tap to open visit detail
5. **Photos** *(collapsed)* — add (targetType: 'condition')
6. **Facts** *(collapsed)* — add (for URLs, reference links, ICD codes, etc.)
7. **Projects** *(collapsed)* — add (e.g., "Research second opinion", "Set up refill")

No Problems section (redundant).

---

## 9. Visit Detail Page (enhanced)

### Header
Shows type prominently: **"Dr. Visit — Apr 7, 2026"** or **"Specialist — Apr 7, 2026"**

### Facility & Provider (new)
- Facility: tappable link → contact (phone, address, directions)
- Provider: tappable link → contact (if set)

### Concerns & Conditions (new)
```
This visit covered:
  [ ⚠️ Concern ] Sinus Infection   →
  [ 📋 Condition ] Hypertension    →
```
Tapping navigates to that concern/condition detail page.

### Existing sections stay
Overall notes, what was done, outcome, cost, meds prescribed, photos.

---

## 10. Promote Concern → Condition

| Data | Action |
|---|---|
| Journal entries | Copied to `healthConditionLogs`, tagged "Imported from concern: [title]" |
| Linked medications | `conditionId` added to `conditionIds[]`; `concernId` stays for history |
| Linked appointments | `conditionId` added to `conditionIds[]`; `concernId` stays |
| Linked visits | Same |
| Photos | Re-pointed to `targetType: 'condition'` |
| Concern record | `status: 'promoted'`, `promotedToConditionId` set, shown as archived |

**UI flow:**
- "Promote to Condition" button at bottom of concern detail page
- Confirm dialog explains what will happen
- Minimal form pre-filled: concern title → condition name, body area → category
- User reviews/edits name — if a condition with the same name already exists, ask:
  **"A condition named '[name]' already exists. Create a new one or merge into it?"**
  - **Create New** — proceeds as normal, creates a second condition record
  - **Merge** — appends all journal entries, links all meds/appts/visits/photos to the existing condition; concern archived with link to that condition
- After: concern shows archived with link to the condition (new or merged)
- Condition journal opens with: *"Promoted from concern: [title] on [date]."* (or appended if merged)

---

## 11. Decisions Log

| # | Question | Answer |
|---|---|---|
| A | Appointment type list | Confirmed — section 3 |
| B | Edit appointment after conversion? | Read-only after Mark Done |
| C | "+ Add Med" — same Med Picker everywhere? | Yes |
| D | Conditions have journal? | No today — add healthConditionLogs |
| E | One med to multiple concerns? | Yes |
| E2 | "General" bucket? | Removed — Create New Concern/Condition instead |
| F | Where after Step 2 Done? | My Health main page |
| G | Promote — carry everything? | Yes, all data |
| H | Concern viewable after promotion? | Yes, archived with link |
| I | Step 2 UI — single tagged accordion list? | Yes |
| J | Per-concern/condition notes stored as? | visit-note in concern/condition log |
| K | Concern/condition history shows appts & visits? | Yes, tappable |
| L | Appointment type carries to visit? | Yes, pre-filled on convert |
| M | Med picker search? | Not now |
| N | Promote — pre-fill condition from concern? | Yes — name + category, editable |
| O | Concern/condition page layout? | Collapsible sections |
| P | providerType on visits? | Replaced by shared `type` + contact fields |
| Q | Visit type display? | Prominently in visit card header |
| R | My Care Team placement? | New tile at bottom of health grid → own page |
| S | People → Contacts: when? | Decided in phase planning |
| T | Service professional tracking detail? | Out of scope — see FutureEnhancements.md |
| U | Collapsible sections default state? | First section (Journal) expanded; rest collapsed |
| V | Contact picker UX? | Searchable text field filtering as you type |
| W | Care Team — create contact from picker? | Yes, can create new contact inline |
| X | Concerns: which sections? | Journal, Medications, Appts/Visits, Photos (existing), Facts (add). No Problems/Projects. |
| X2 | Conditions: which sections? | Journal, Medications, Appts/Visits, Photos (add), Facts (add), Projects (add). No Problems. |
| Y | Visit-note entries editable after save? | Yes, editable |
| Z3 | Visit type badge on visits list page? | Yes — show type badge on each visit card in the list |
| Z4 | Promote — what if condition with same name exists? | Ask user: "Create New" or "Merge into existing"; if merge, append journal entries and link all data to existing condition |

---

## Open Questions

*(none)*

---

## 12. Implementation

Phases are ordered by dependency: each phase only requires what prior phases have already built.

---

### Phase 1 — People → Contacts + Contact Categories + ContactPicker Component

**Goal:** Rename People → Contacts app-wide, add category/specialty fields, and build the reusable ContactPicker UI component that all later phases depend on.

**Files:** `index.html`, `js/people.js` (rename to `contacts.js`), `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**
1. Rename `js/people.js` → `js/contacts.js`. Update all internal references.
2. Update `index.html`:
   - Script tag: `people.js` → `contacts.js`
   - Nav label: "People" → "Contacts"
   - Page section id/headings for people → contacts
   - All modal ids, button labels, and form field labels that say "Person"/"People"
3. Update `js/app.js` routing:
   - Add cases for `#contacts` and `#contact/{id}`; keep `#people`/`#person/{id}` as aliases that redirect
   - `showPage('contacts-page')` etc.
4. In `contacts.js` (formerly people.js):
   - Add `category` dropdown to add/edit modal: Personal (default) / Medical Professional / Medical Facility / Service Professional / Other
   - Add `specialty` field (text input, shown only when category = "Medical Professional")
   - When loading a contact record that has no `category`, treat it as `Personal`
   - Show category badge on contact list cards
   - Show specialty line on Medical Professional cards
5. Build **ContactPicker** — a reusable inline component (function + HTML pattern):
   - `buildContactPicker(containerId, options)` — renders a search input + dropdown inside `containerId`
   - `options.filterCategory` — if set, only shows contacts of that category
   - `options.onSelect(contactId, contactName)` — callback when user picks a contact
   - `options.allowCreate` — if true, shows "+ Create new contact" at bottom of dropdown
   - Filters live as user types (case-insensitive match on name)
   - Selecting clears the search field and stores the contactId on a hidden input
   - Clearing the field resets the selection
   - CSS classes: `.contact-picker-wrap`, `.contact-picker-input`, `.contact-picker-dropdown`, `.contact-picker-item`, `.contact-picker-create`
6. Bump cache-busting version on all script and CSS tags.

**Data:** No Firestore migration needed. `category` defaults to `'Personal'` in JS when missing.

---

### Phase 2 — My Care Team Tile + Page

**Goal:** New "My Care Team" tile on the My Health grid; full care team page with role-based member cards and add/edit modal using the ContactPicker from Phase 1.

**Files:** `index.html`, `js/health.js`, `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**
1. Add **My Care Team** tile at the bottom of `#healthFeatureGrid` in `index.html`.
2. Add `#health-care-team` route in `js/app.js` → calls `loadCareTeam()`.
3. Add care team page section in `index.html`:
   - Page heading "My Care Team"
   - Back button → `#health`
   - "+ Add Member" button → opens `careTeamModal`
   - `#careTeamList` container
4. Care team member card layout:
   ```
   Role (e.g., "General Practice")
     Provider: [Dr. Name]    → tappable link → #contact/{id}
     Facility: [Clinic Name] → tappable link → #contact/{id}
   [Edit]  [Remove]
   ```
   If provider or facility not set, show "—".
5. Add/Edit Member modal (`careTeamModal`):
   - Role — free text input
   - Provider — ContactPicker (filterCategory: 'Medical Professional', allowCreate: true)
   - Facility — ContactPicker (filterCategory: 'Medical Facility', allowCreate: true)
   - Both provider and facility are optional
   - Save / Cancel buttons
6. `loadCareTeam()` — reads `userCol('healthCareTeam').doc('default')`, renders members sorted by role.
7. `saveCareTeamMember(data)` — upserts member in `members[]` array on the single doc.
8. `removeCareTeamMember(index)` — confirm dialog, removes by index, saves doc.
9. Bump version.

**Data:** `userCol('healthCareTeam').doc('default')` — `{ members: [{role, providerContactId, facilityContactId}] }`

---

### Phase 3 — Appointment Modal Enhancements

**Goal:** Add type dropdown, facility/provider contact pickers, concern/condition linking, updated card display, and read-only state after conversion.

**Files:** `index.html`, `js/health.js`, `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**
1. Add **Type** dropdown to appointment add/edit modal:
   ```
   Dr. Visit / Specialist / Follow-up / Physical or Annual /
   Urgent Care / Emergency / Dental / Eye Exam / Lab or Test / Procedure
   ```
2. Replace plain `provider` text field with two fields:
   - **Facility** — ContactPicker (filterCategory: 'Medical Facility', allowCreate: true) + plain text fallback (`facilityText`) shown if no contactId set
   - **Provider** — ContactPicker (filterCategory: 'Medical Professional', allowCreate: true) + plain text fallback (`providerText`), optional
3. Add **Concerns & Conditions** multi-select section:
   - Query `healthConcerns` where `status == 'open'` and `healthConditions` where `status in ['active','managed']`
   - Render as a tagged checkbox list:
     ```
     [ ⚠️ ] Sinus Infection       (concern)
     [ 📋 ] Hypertension          (condition)
     ```
   - Store selected ids in `concernIds[]` and `conditionIds[]` on the appointment
4. Update appointment card display:
   - Show type as a small badge
   - Show facility as tappable link (if contactId set) or plain text
   - Show provider if set (tappable link or plain text)
   - Show concern/condition tags below
5. After **Mark Done** conversion: set `status: 'converted'` and render card as read-only (no Edit button; show "Converted to visit" label with link to visit).
6. Save new fields: `type`, `facilityContactId`, `facilityText`, `providerContactId`, `providerText`, `concernIds[]`, `conditionIds[]`.
7. Bump version.

**Data:** Additive new fields on `appointments` collection.

---

### Phase 4 — Visit Detail Page + Visit Type on List

**Goal:** Show type prominently on visit detail and on the visits list; add facility/provider tappable links and a concerns/conditions section on the detail page.

**Files:** `index.html`, `js/health.js`, `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**
1. Visit detail page header: change from "Visit — [date]" to **"[Type] — [date]"** (e.g., "Dr. Visit — Apr 7, 2026"). If no type set on older records, fall back to "Visit — [date]".
2. Add **Facility** line:
   - If `facilityContactId` set: tappable link → `#contact/{id}` (shows contact's name)
   - Else if `facilityText` set: plain text
   - Else: omit
3. Add **Provider** line (same pattern, optional).
4. Add **"This visit covered:"** section:
   - Load concerns by `concernIds[]` and conditions by `conditionIds[]`
   - Render as tappable tags:
     ```
     [ ⚠️ Concern ] Sinus Infection   →  #health-concern/{id}
     [ 📋 Condition ] Hypertension    →  #health-condition/{id}
     ```
   - If no IDs: section is hidden
5. Visit list page (`#health-visits`) — each visit card:
   - Add type badge (e.g., `[Dr. Visit]`) in the card header, right-aligned or below date
   - If no type on record: omit badge
6. Bump version.

**Data:** No new fields — reads `type`, `facilityContactId`, `providerContactId`, `concernIds[]`, `conditionIds[]` that Phase 3 already writes.

---

### Phase 5 — Concern Detail Page Overhaul + Med Picker

**Goal:** Rebuild the concern detail page as collapsible sections. Build the reusable Med Picker overlay (used here and in Phases 6 and 8).

**Files:** `index.html`, `js/health.js`, `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**

**Med Picker overlay (built here, reused everywhere):**
1. Add `medPickerModal` overlay in `index.html`:
   - Title: "Add Medication"
   - Scrollable checkbox list of all medications (active + historical, alphabetical)
   - Pre-checked if medication's `concernIds[]` already contains current concern/condition id
   - "+ Add New" button → opens medication modal; on save returns and auto-checks new med
   - Confirm button → updates `concernIds[]` or `conditionIds[]` on each changed medication; logs activity entry ("Linked to [concern/condition name]" or "Removed from [concern/condition name]")
   - Cancel button
2. `openMedPicker(targetType, targetId)` — loads all meds, pre-checks linked ones, opens modal.
3. `saveMedPickerSelection(targetType, targetId, checkedIds, previousIds)` — diffs old vs new, updates Firestore on changed meds, logs activity for each change.

**Concern detail page — collapsible sections:**
4. Replace current concern detail layout with collapsible section pattern:
   - Each section: header bar (tappable to expand/collapse), chevron icon, content area
   - CSS: `.collapsible-section`, `.collapsible-header`, `.collapsible-body` (hidden when collapsed)
   - JS: `toggleSection(sectionEl)` utility
5. **Section 1 — Summary** (pinned, never collapses):
   - Concern title (editable inline or via Edit button), body area, start date, status badge
   - Edit and status-change controls
6. **Section 2 — Journal** (starts expanded):
   - Existing manual log entries
   - System entries (status changes, med links/unlinks, promotion)
   - Visit-note entries — tagged "From visit: [facility name, date]", with edit pencil
   - "+ Add Note" button → inline textarea → saves as `type: 'manual'` log entry
   - Edit any note inline; save/cancel
7. **Section 3 — Medications** (starts collapsed):
   - List of linked medications (name, dosage)
   - Each med: tappable → `#health-medications` (or med detail); [✕] remove button (confirm → logs removal)
   - "+ Add Med" button → `openMedPicker('concern', id)`
8. **Section 4 — Appointments & Visits** (starts collapsed):
   - Query `appointments` where `concernIds array-contains id`
   - Query `healthVisits` where `concernIds array-contains id`
   - Merge, sort reverse-chron, render as list with date + type + facility/provider
   - Tapping an appointment → `#health-appointment/{id}` (read-only view)
   - Tapping a visit → `#health-visit/{id}`
9. **Section 5 — Photos** (starts collapsed):
   - Existing photo functionality, wrapped in collapsible section
10. **Section 6 — Facts** (starts collapsed):
    - Existing facts functionality (targetType: 'concern'), wrapped in collapsible section
    - URL values render as clickable links (already implemented in facts.js)
11. **"Promote to Condition"** button at bottom of page:
    - Stub for now — shows button, clicking shows "Coming soon" or is wired in Phase 7
12. Bump version.

---

### Phase 6 — Condition Detail Page + Condition Journal

**Goal:** Build `healthConditionLogs` collection and rebuild the condition detail page as collapsible sections, mirroring the concern page.

**Files:** `index.html`, `js/health.js`, `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**
1. Create `healthConditionLogs` Firestore collection:
   - Fields: `conditionId`, `date`, `note`, `type` ('manual'/'system'/'visit-note'), `visitId` (optional), `createdAt`
   - Helper functions: `addConditionLog(conditionId, note, type, visitId?)`, `loadConditionLogs(conditionId)`
2. Rebuild condition detail page with same collapsible section pattern as concerns:
3. **Section 1 — Summary** (pinned):
   - Condition name, category (e.g., "Cardiovascular"), diagnosed date, status badge
   - Edit controls
4. **Section 2 — Journal** (starts expanded):
   - Reads from `healthConditionLogs` where `conditionId == id`
   - Same rendering as concern journal (manual, system, visit-note entries)
   - Visit-note entries tagged "From visit: [facility, date]", editable
   - "+ Add Note" → saves `type: 'manual'` log entry
5. **Section 3 — Medications** (starts collapsed):
   - Same as concern: linked meds, [✕] remove with log, "+ Add Med" → `openMedPicker('condition', id)`
6. **Section 4 — Appointments & Visits** (starts collapsed):
   - Query `appointments` and `healthVisits` where `conditionIds array-contains id`
   - Same rendering as concern version
7. **Section 5 — Photos** (starts collapsed):
   - Photo support for `targetType: 'condition'` (may already exist; verify and wire up)
8. **Section 6 — Facts** (starts collapsed):
   - Facts for `targetType: 'condition'`
9. **Section 7 — Projects** (starts collapsed):
   - Projects for `targetType: 'condition'` (reuse existing projects component)
10. Bump version.

---

### Phase 7 — Promote Concern → Condition

**Goal:** Wire up the "Promote to Condition" button with full data migration, conflict detection, and UI feedback.

**Files:** `index.html`, `js/health.js`, `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**
1. "Promote to Condition" button on concern detail page → opens `promoteModal`.
2. `promoteModal`:
   - Confirm dialog explaining what will happen ("All journal entries, medications, appointments, visits, and photos will be linked to the new condition.")
   - Pre-filled form: concern title → Condition Name (editable), body area → Category (editable dropdown)
   - Confirm / Cancel buttons
3. On Confirm — check for name conflict:
   - Query `healthConditions` where `name == enteredName` (case-insensitive)
   - If match found: show inline choice:
     ```
     A condition named "[name]" already exists.
     [ Create New ]   [ Merge into existing ]
     ```
4. **Create New path** (`promoteToNewCondition(concernId, formData)`):
   - Create new condition record in `healthConditions`
   - Copy all `healthConcernLogs` for this concern → new `healthConditionLogs` entries, `note` prefixed with "Imported from concern: [title] — "
   - For each medication where `concernIds contains concernId`: add `conditionId` to `conditionIds[]`
   - For each appointment where `concernIds contains concernId`: add `conditionId` to `conditionIds[]`
   - For each healthVisit where `concernIds contains concernId`: add `conditionId` to `conditionIds[]`
   - For each photo where `targetType == 'concern' && targetId == concernId`: update to `targetType: 'condition', targetId: newConditionId`
   - Update concern record: `status: 'promoted'`, `promotedToConditionId: newConditionId`
   - Add journal entry to new condition: "Promoted from concern: [title] on [date]."
5. **Merge path** (`promoteToExistingCondition(concernId, existingConditionId)`):
   - Same steps as Create New but targets the existing condition record (no new record created)
   - Appends journal entries rather than creating new condition
   - Add journal entry to existing condition: "Merged from concern: [title] on [date]."
6. After promotion:
   - Navigate to new/target condition detail page
   - Concern detail page (if navigated back to) shows: "This concern was promoted to a condition on [date]." with link to condition. No edit controls shown — read-only archived view.
7. Bump version.

---

### Phase 8 — Mark Done 2-Step Conversion Flow

**Goal:** Enhance the Mark Done flow to pre-fill from appointment data (Step 1) and add the per-concern/condition notes & prescriptions step (Step 2).

**Files:** `index.html`, `js/health.js`, `css/styles.css`, `MyLife-Functional-Spec.md`

**Work:**

**Step 1 — Enhanced Mark Done form:**
1. Pre-fill the existing Mark Done modal with appointment data:
   - Type dropdown — pre-filled from `appointment.type`
   - Facility — pre-filled from `appointment.facilityContactId` (shown as tappable name) or `facilityText`
   - Provider — pre-filled from `appointment.providerContactId` or show "Who did you see?" field if blank
   - Date — pre-filled to today
   - Existing fields (what was done, outcome, cost) remain
   - Add **Overall Visit Notes** textarea (saved to visit record as `notes`)
2. On save: create visit record with all fields including `concernIds[]` and `conditionIds[]` copied from appointment; set `type`, `facilityContactId`, `providerContactId`.
3. After save, do NOT close and navigate away — instead transition to Step 2.

**Step 2 — Per-Concern/Condition Notes & Prescriptions:**
4. Replace modal content (or navigate to a new full-screen page `#health-visit-step2/{visitId}`):
   ```
   Visit saved ✓  — Step 2: Notes & Prescriptions
   ```
5. Build accordion list from visit's `concernIds[]` + `conditionIds[]`:
   - Each item: tagged header `[ ⚠️ Concern ] Sinus Infection` or `[ 📋 Condition ] Hypertension`
   - Click header → expand/collapse
   - Expanded body:
     - Notes textarea: "Notes for this concern/condition:"
     - Medications sub-section: list of already-linked meds; "[✕]" to unlink; "+ Add Med" → Med Picker (reuse from Phase 5)
6. "+ Create New Concern" button:
   - Inline mini-form: Title (required), Body Area (optional)
   - On save: creates concern record, adds id to visit's `concernIds[]`, adds new item to accordion
7. "+ Create New Condition" button — same pattern for conditions.
8. "Done → My Health" button:
   - Save all per-concern/condition notes as `healthConcernLog` / `healthConditionLog` entries with `type: 'visit-note'` and `visitId` set
   - For each medication assigned during Step 2: set `prescribedAtVisitId` on med
   - Navigate to `#health`
   - Skipping notes/meds entirely and tapping Done is valid (no validation required)
9. Bump version.

---

### Phase Summary

| Phase | What Gets Built | Depends On |
|---|---|---|
| 1 | People → Contacts rename + category/specialty fields + ContactPicker component | — |
| 2 | My Care Team tile, page, data model, add/edit member modal | Phase 1 (ContactPicker) |
| 3 | Appointment: type, facility/provider pickers, concern/condition linking, card updates | Phase 1 (ContactPicker) |
| 4 | Visit detail: type header, facility/provider links, concern/condition section; visit list type badge | Phase 3 (data fields) |
| 5 | Concern detail page overhaul (collapsible) + Med Picker overlay | Phase 3 (appt/visit links) |
| 6 | Condition detail page (collapsible) + healthConditionLogs collection | Phase 5 (same pattern) |
| 7 | Promote Concern → Condition (full data migration, conflict detection) | Phases 5 + 6 |
| 8 | Mark Done 2-step flow (Step 1 pre-fill, Step 2 notes + prescriptions) | Phases 3 + 5 + 6 |
