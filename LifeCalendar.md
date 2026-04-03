# Life Calendar — Feature Plan

**Status:** Plan Complete — Ready for Phase Breakdown
**Last Updated:** 2026-04-03

---

## Problem Statement

The user has personal life events — races, concerts, travel, golf trips, sports events, etc. — that need a home beyond a Google doc or mental note. Each event has a lifecycle:

1. **Planning stage** — sign up, prep notes, links, logistics
2. **Active stage** — mini log entries added over time as things develop
3. **Completion stage** — Attended vs. Didn't Go, with outcome notes

Mini log entries flow into the journal timeline in real time. One or more compiled journal entries can be generated from all event data at any point. Architecture must support future reminders.

---

## Core Requirements (All Confirmed)

### Life Page
- Add a **Calendar** card to the Life page tile grid → `#life-calendar`

### Calendar Page — Layout & Controls
- **Month grid** (default on desktop/tablet)
  - Multi-day events display as a **color bar** spanning all their days
  - Each day cell shows up to **2 events**; overflow shows "+ N more" link
  - **Today's date** is circled/highlighted
  - **Clicking a day with 1+ events** → Day Detail view (event cards + "Add" card)
  - **Clicking an empty day** → Create Event, date pre-filled
  - "Didn't Go" events show a small **✗ badge** on their bar
  - Previous / Next month navigation + "Today" button
- **List / agenda view** — checkbox toggle; **mobile defaults to list view**
  - Add button in list view prompts for date selection
- Controls on the calendar page:
  - View toggle (grid / list)
  - **Status filter dropdown**: Upcoming | Upcoming + Attended | Attended | Missed | All — default: Upcoming
  - **Category filter**: All Categories | [each user category]
  - **Search bar**: filters by event title or location
- **Category management** also on this page (add / edit / delete categories)

### Day Detail View
- Cards for each event on that day: **Title, Category color, Status, Date range**
- Plus an **"Add" card** to create a new event on that date
- Tapping an event card → event detail page

### Categories
- User-created; managed on the Life Calendar page
- Each has: **name + color swatch** (same palette as notebooks)
- Starting set: Races, Concerts, Golf, Travel, Sports Events
- One category per event
- Each may have a **template** unlocking category-specific fields

**Future wish (not in v1):** When editing a category, allow the user to drag-reorder which sections appear on event detail pages for that category. Noted for later — keep section rendering driven by an ordered list so this can be added without restructuring.

### Category Templates

| Category | Template | Extra Fields |
|----------|----------|-------------|
| Races | `race` | Distance, Finish Time |
| Concerts | `concert` | Acts / Performers (list), Section & Seat |
| Golf | `golf` | Course(s), Score(s) |
| Sports Events | `sports` | Sport (Baseball/Football/Basketball/Hockey/Other — fill in), Teams Playing, Final Score, Section & Seat |
| Travel | `travel` | *(shared fields + links + mini log cover it)* |
| User-created | none | *(shared fields only)* |

### Event Detail Page (Always Editable)
- Always in edit mode — no view/edit toggle
- **Explicit Save button**
- **Dirty flag**: on any field change, set dirty. If user navigates away with unsaved changes → "You have unsaved changes. Leave anyway?"

**Section order (per event, top to bottom):**
1. Header fields: Title, Category, Start/End date, Location, Cost, Status
2. General description
3. Category-specific fields (if template applies)
4. People — "Who went with"
5. Links
6. Outcome summary (+ Didn't Go reason if applicable)
7. Mini Log
8. Photos
9. "Create Journal Entry" button

### Links (1 or More per Event)
- "Add Link" button → label + URL input row → confirm adds to list
- Each link: clickable label (opens URL), edit button, delete button
- No limit on number of links

### People ("Who Went With") — Event Level
- Text box; type a name (no `@`) → filtered dropdown from People list appears
- Click a name to add; if exactly **one match** exists, **Enter accepts** even on partial name typed
- Added people shown as **chips**: name (clickable → People detail page) + ✕ to remove
- Available on all event types

### Mini Log (per Event)
- Timestamped entries — free-form text, no tags (re-evaluate after use)
- **Date + time**: defaults to right now; user can override to backdate
- Uses **`@mention`** for people (same pattern as journal entries)
- Entries are **editable** after saving (timestamp preserved)
- Entries can be **deleted**
- Displayed **chronologically (oldest first)** on event detail page

### Journal Integration
- Mini log entries appear **scattered in the journal timeline** at their exact timestamps
- Each mini log in the journal shows:
  - Event title badge
  - Log body text (with @mentions rendered as clickable links → People page)
  - **"Go to Event" button** at the bottom (same style as "Go to Person")
- **"Show Event Notes" toggle** on journal page — hides/shows mini logs (default: on, localStorage)

### Compiled Journal Entry
- **"Create Journal Entry" button** on event detail page (bottom of page)
- Can be pressed **multiple times** — each press creates a new compiled entry as a snapshot
- **Default journal entry date = event's start date** (user can change it on the edit page)
- Auto-generates a structured draft:
  ```
  [Title] — [Start – End Date if multi-day] — [Location]
  Category: Races | Cost: $85

  Description:
  [general description]

  Notes:
  • [mini log entry 1 — date/time]
  • [mini log entry 2 — date/time]
  • ...

  Outcome:
  [outcome summary]

  [Category-specific fields, e.g.:]
  Distance: Half Marathon
  Finish Time: 2:14:32

  People: @John Smith @Jane Doe    ← @mention markup → renders as clickable links

  Links:
  • Race Site — https://...
  • Training Plan — https://...
  ```
- Opens directly in the **journal entry edit page** — user reviews and presses Save
- Saved entry is a real journal entry (not hidden by the mini log toggle)
- Each compiled entry has a **"Go to Event" button** at the bottom
- Event stores an **array** of `journalEntryIds` (one per compilation)

### People Page — New "Shared Events" Section
Kept **separate from Interactions** (rationale: interactions are a flat chronological contact log; life events are structured records with categories, date ranges, status, costs — conceptually distinct and worth their own section).

- New section on Person detail page: **"Shared Events"**
- Queries `lifeEvents` where `peopleIds` contains this person's ID
- Each item shows: event title, category color chip, date(s), status badge
- Clickable → navigates to `#life-event/{id}`
- Sorted newest first
- Shows all statuses (upcoming, attended, didn't go)

*(Existing Interactions section already surfaces journal entries that @mention this person via `sourceType: 'journal'` — no change needed there.)*

---

## Technical Design (Finalized)

### Firestore Collections (all via `userCol()`)

**`lifeCategories`**
```
name      : string
color     : string (CSS gradient)
template  : 'race'|'concert'|'golf'|'sports'|'travel'|null
sortOrder : number
createdAt : timestamp
```

**`lifeEvents`**
```
categoryId      : string
title           : string
startDate       : string (ISO)
endDate         : string | null
location        : string
cost            : number | null
description     : string
status          : 'upcoming' | 'attended' | 'didnt-go'
didntGoReason   : string | null
outcomeSummary  : string | null
links           : [ { label: string, url: string } ]
peopleIds       : [ string ]
reminderDate    : string | null       ← reserved for future reminders feature
journalEntryIds : [ string ]          ← array; grows with each compilation
typeFields      : {
  distance?    : string               // race
  finishTime?  : string               // race
  acts?        : string[]             // concert
  sectionSeat? : string               // concert + sports
  courses?     : string[]             // golf
  scores?      : string[]             // golf
  sport?       : string               // sports: 'baseball'|'football'|'basketball'|'hockey'|'other'
  sportOther?  : string               // sports: fill-in when sport === 'other'
  teams?       : string               // sports
  finalScore?  : string               // sports
}
createdAt       : timestamp
updatedAt       : timestamp
```

**`lifeEventLogs`**
```
eventId   : string
body      : string           ← may contain @mention markup
createdAt : timestamp        ← user-settable (defaults to now, overridable)
updatedAt : timestamp | null
```

**Photos**: existing `photos` collection — `targetType: 'lifeEvent'`, `targetId: {eventId}`

**Journal entries** (`journalEntries` collection): add `sourceEventId: string | null` field
- Set to the event's ID when a compiled entry is created from an event
- null for all normal journal entries
- Journal page checks this field to render a "Go to Event" button on compiled entries

### Routing
```
#life-calendar         — calendar page (grid/list, controls, category mgmt)
#life-event/new        — create event
#life-event/{id}       — event detail (always editable)
```

**Pre-filling date for new events**: use `window._newEventDate = 'YYYY-MM-DD'` before navigating to `#life-event/new` — consistent with existing app patterns (e.g., `window._noteOpenInEditMode`). `loadNewEventPage()` reads and clears this value.

**Day Detail view**: implemented as a **modal overlay** on the calendar page — no separate route needed. Clicking a day opens the modal showing event cards + Add card. Tapping an event card closes the modal and navigates to the event. Tapping Add closes the modal, sets `window._newEventDate`, navigates to `#life-event/new`.

### Breadcrumbs
Life › Calendar › [Event Title]

### Journal Page Changes
- On load: query `lifeEventLogs` for the visible date range; merge + sort with journal entries
- Mini logs render with event badge (title + category color), body text, "Go to Event" button
  - Badge data: join `lifeEventLogs` → `lifeEvents` at read time (by unique eventIds in the result set — one batch fetch)
- Compiled journal entries: if `sourceEventId` is set, render a "Go to Event" button at the bottom
- @mention links in mini log bodies are clickable → People page
- "Show Event Notes" toggle in journal controls (localStorage)

### People Page Changes
- New **"Shared Events"** section (separate from Interactions)
- Query `lifeEvents` where `peopleIds` contains the person's ID
- Display: title, category color chip, date(s), status badge — clickable → event

### Delete Event
- Confirm dialog: "Delete this event? This will also remove all its notes and photos. Any journal entries created from this event will be kept."
- On confirm: delete `lifeEvents` doc, all `lifeEventLogs` where `eventId` matches, all `photos` where `targetType: 'lifeEvent'` + `targetId` matches
- Journal entries with `sourceEventId` pointing to this event are left intact; their "Go to Event" button gracefully shows as disabled/hidden if the event no longer exists

### Delete Category (with events)
- Check for events using this category before deleting
- If any exist: show warning with count + a dropdown/list of all events in that category — user selects a replacement category and confirms
- All events are moved to the replacement category in a single batch update, then the category is deleted
- If no events use it: simple confirm and delete

### Category Auto-Seeding
- On first navigation to `#life-calendar`, check if `lifeCategories` is empty
- If empty, auto-create the 5 starting categories (Races, Concerts, Golf, Travel, Sports Events) with their templates and default colors
- Same pattern as the Default notebook auto-creation

### "Create Journal Entry" — Save Requirement
- Button checks `_lifeEventDirty` before proceeding
- If dirty: alert "Please save your changes before creating a journal entry." — does not proceed
- If clean: generate and open the draft

### Dirty Flag Implementation
- `_lifeEventDirty` boolean on event detail page
- Set true on any field change
- On hash change (navigate away): if dirty → `confirm('You have unsaved changes. Leave anyway?')`
- Clear on successful Save

### Future-Ready: Reminders
- `reminderDate` on `lifeEvents` — null in v1
- Future: on app load, check events where `reminderDate <= today` and surface a banner

### Future-Ready: Reorderable Category Sections
- Section rendering driven by an ordered config array (e.g., `['header','description','typeFields','people','links','outcome','minilog','photos']`)
- When reordering is built, `lifeCategories` gets a `sectionOrder: []` field and the detail page renders accordingly

---

## Decisions Log (Complete)

| Decision | Choice |
|----------|--------|
| Firestore collections | `lifeCategories` + `lifeEvents` + `lifeEventLogs` |
| Calendar views | Month grid (default desktop) + list (default mobile) |
| Multi-day bars | Google Calendar style |
| Today on grid | Circled date |
| Day click — has events | Day Detail: cards (title, category, status, date range) + Add card |
| Day click — empty | Create Event, date pre-filled |
| Grid overflow | 2 shown, "+ N more" |
| Didn't Go on grid | Small ✗ badge |
| Status filter | Dropdown — default: Upcoming |
| Category filter | Yes |
| Search bar | Yes (title + location) |
| Category management | On Life Calendar page |
| Categories | User-defined, color-coded, one per event |
| Category templates | Predefined for known types; future: user-defined field order |
| Event status | Upcoming / Attended / Didn't Go |
| Didn't Go reason | Free-form |
| Links | 1 or more — label + URL |
| People picker (event) | Text box, filtered list, Enter on single match, chip display |
| @mention in mini logs | Yes, same as journal |
| Section & Seat | Concerts and Sports Events |
| Sports sport field | Baseball/Football/Basketball/Hockey/Other (fill in) |
| Event detail page | Always editable, explicit Save, dirty flag warning |
| Mini log timestamp | Date + time, default now, user-overridable |
| Mini log editing | Yes, text editable; timestamp preserved |
| Mini log order | Chronological, oldest first |
| Photos | Yes |
| Cost | Single total |
| Journal mini logs | Scattered in timeline, "Go to Event" button |
| Journal toggle | "Show Event Notes," default on |
| Compiled entry | Auto-generated draft → edit page → Save |
| Compiled entry date | Defaults to event start date |
| Multiple compiled entries | Yes — each is a snapshot |
| journalEntryIds | Array on event |
| People in compiled entry | @mention markup → clickable in journal |
| "Go to Event" button | On mini logs + compiled entries (like "Go to Person") |
| People page | New "Shared Events" section, separate from Interactions |
| Life page Calendar card | Yes |
| Reminders | Future — `reminderDate` reserved |
| Section reordering | Future — architecture supports it via ordered config array |
| SecondBrain command | `ADD_PERSONAL_EVENT` |
| Date resolution | Future-roll partial dates; month-only → 1st of month, endDate null |
| Venue extraction | "at [venue]" → location field |
| Cost extraction | Yes — number extracted from utterance |
| People extraction | Yes — resolved from people context; ambiguous → confirm screen |
| typeFields extraction | Yes — LLM infers based on matched category template |
| Category mismatch | Closest-match dropdown on confirm screen; user can change |
| Context additions | `lifeCategories` (id/name/template) + `sportTypes` enum |
| Post-confirm nav | `#life-event/{newId}` |
| Personal vs yard rule | Experiential/attendance = personal event; task/reminder = calendar |
| Delete event | Warn, cascade logs + photos, leave journal entries intact |
| Delete category with events | Warn + event list, user picks replacement category, batch move then delete |
| Journal entry → event link | `sourceEventId` field on `journalEntries`; null for normal entries |
| Mini log badge data | Join at read time: batch-fetch lifeEvents for unique eventIds in result |
| Category auto-seed | Yes — 5 starting categories created on first visit to #life-calendar |
| Create Journal Entry + dirty | Block with alert if unsaved changes; require save first |
| Day Detail view | Modal overlay on calendar page — no separate route |
| Date pre-fill for new event | `window._newEventDate` set before navigating to #life-event/new |

---

## Build Phases (Suggested Order)

1. **Life page** — add Calendar card
2. **Life Calendar page** — month grid, list view, controls, category management
3. **Create / Edit Event** — all shared fields, links, people picker, dirty flag
4. **Category-specific fields** — per template type
5. **Mini Log** — add / edit / delete entries on event detail, @mentions, backdating
6. **Photos** on events
7. **Journal integration** — mini logs in timeline, toggle, "Go to Event"
8. **Compiled Journal Entry** — generate draft dated to event start, open in journal edit
9. **People page** — new Shared Events section
10. **Day Detail view** — day-click flow from calendar grid
11. **SecondBrain: ADD_PERSONAL_EVENT** — quick log command (see section below)

---

## SecondBrain Integration — ADD_PERSONAL_EVENT

### Command Name
`ADD_PERSONAL_EVENT` — follows existing ALL_CAPS_UNDERSCORE convention.
Distinct from the existing `ADD_CALENDAR_EVENT` (which targets the yard/house calendar).

### Trigger Phrases
- "I'm going to the AC/DC concert on Sept 26"
- "Signed up for the half marathon in October"
- "Golf trip to Scottsdale next March with John and Dave"
- "Taking a trip to Vegas June 3rd through 7th"
- "I got tickets to the Cubs game on August 12"

### Date Resolution Rules (LLM instructions)
This is the key logic baked into the system prompt:

> **For ADD_PERSONAL_EVENT, always resolve partial dates (month + day only) to the nearest future occurrence:**
> - If the named date (e.g., Sept 26) has NOT yet occurred this calendar year → use this year
> - If the named date has ALREADY passed this calendar year → use next year
> - If a year is explicitly stated by the user → use that year verbatim
> - If only a month is named (e.g., "in October") → use the 1st of that month, rolled forward by the same rule; set endDate: null
> - If a range is stated ("June 3rd through 7th", "for a week starting June 3") → set both startDate and endDate; apply future-rolling to both
> - If duration is vague ("golf trip next March", "a few days in Vegas") → set startDate only, endDate: null; let user fill in
> - Always populate `dateNote` explaining the resolution so the user can catch errors on the confirm screen

### Proposed JSON Schema

```json
{
  "action": "ADD_PERSONAL_EVENT",
  "payload": {
    "title": "AC/DC Concert",
    "categoryName": "Concerts",
    "categoryId": "id or null",
    "categoryFound": true,
    "startDate": "2026-08-05",
    "endDate": null,
    "location": "Chastain",
    "description": "Going to see AC/DC at Chastain",
    "cost": null,
    "peopleIds": [],
    "peopleNames": [],
    "peopleAmbiguous": [],
    "typeFields": {
      "acts": ["AC/DC"]
    },
    "ambiguous": false,
    "dateNote": "Aug 5 not yet passed — resolved to 2026-08-05"
  }
}
```

**Field-by-field notes:**

| Field | Notes |
|-------|-------|
| `title` | Short event title extracted from utterance |
| `categoryName` | Best-match category name from the user's `lifeCategories` list |
| `categoryId` | Resolved ID from context; null if no match found |
| `categoryFound` | true if matched; false if guessed or unmatched |
| `startDate` | Always full YYYY-MM-DD — resolved using future-rolling rules |
| `endDate` | null unless user explicitly states a range ("June 3rd through 7th"); null if only a month is given (use 1st of that month for startDate, endDate null) |
| `location` | Extracted from "at [venue]" phrases — e.g., "at Chastain" → "Chastain" |
| `description` | The full or lightly cleaned-up utterance |
| `cost` | Extracted if mentioned ("paid $85", "tickets were $150") — number only |
| `peopleIds` | Resolved from people context — only when unambiguous |
| `peopleNames` | Display names of resolved people |
| `peopleAmbiguous` | Names mentioned but matched to multiple people — user resolves on confirm screen |
| `typeFields` | Category-specific extras the LLM can infer (see below) |
| `ambiguous` | true if top-level event details are unclear |
| `dateNote` | Always present — explains the date resolution so user can catch errors |

**typeFields extraction by template:**
- **race** template: `{ distance: "Half Marathon", finishTime: null }` — distance if mentioned; finishTime always null (not known yet)
- **concert** template: `{ acts: ["AC/DC"], sectionSeat: null }` — acts extracted from utterance; sectionSeat null
- **golf** template: `{ courses: ["TPC Scottsdale"], scores: [] }` — course name if mentioned
- **sports** template: `{ sport: "baseball", sportOther: null, teams: "Cubs vs Cardinals", finalScore: null, sectionSeat: null }` — sport matched against `["baseball","football","basketball","hockey","other"]`; teams if mentioned
- **travel** / no template: `typeFields: {}` — nothing to extract

### Context Additions Required
The `_sbBuildSystemPrompt` function needs these additions to the context JSON:

```js
// Life categories — for category name → ID resolution
lifeCategories: (ctx.lifeCategories || []).map(function(c) {
    return { id: c.id, name: c.name, template: c.template };
}),

// Sports types — fixed enum for sports template matching
sportTypes: ['baseball', 'football', 'basketball', 'hockey', 'other']
```

The LLM uses `lifeCategories` to:
1. Match the user's utterance to a category name (e.g., "concert" → category "Concerts")
2. Once matched, know the `template` type → know which `typeFields` to attempt to extract
3. Resolve to a `categoryId`

**People resolution** (already in context as `people`) uses the same logic as `LOG_INTERACTION`:
- Match by first name if unambiguous (only one person with that first name)
- If multiple matches → add to `peopleAmbiguous[]`, let user pick on confirm screen
- If not found → add name to `peopleNames[]` with `peopleFound: false` note

### Confirmation Screen Fields
On the SecondBrain confirmation card, show:
- Action badge: 📅 Add Personal Event
- Title (editable)
- Category (dropdown from user's lifeCategories)
- Date(s)
- Location
- Description
- dateNote explanation (so user can catch date misresolutions)
- Warning if `categoryFound: false` — "Category not found — will use closest match or create new"

### Post-Confirm Navigation
After confirming, create the `lifeEvents` document and navigate to:
`#life-event/{newId}` — so the user lands on the event detail page to fill in remaining fields (people, links, type-specific fields, etc.)

### Help Screen Entry (SB_HELP_ACTIONS — required)
```js
{
    action: 'ADD_PERSONAL_EVENT',
    icon: '🗓️',
    label: 'Add Personal Event',
    desc: 'Add a life event (concert, race, trip, golf, etc.) to your personal calendar. Resolves partial dates to the nearest future occurrence.',
    examples: [
        "I'm going to the AC/DC concert on Sept 26",
        "Signed up for the Chicago Half Marathon in October",
        "Golf trip to Scottsdale next March",
        "Taking a trip to Vegas June 3rd through 7th"
    ]
}
```

### Disambiguation: ADD_PERSONAL_EVENT vs. ADD_CALENDAR_EVENT
System prompt rule:
> "Use ADD_PERSONAL_EVENT when the user is planning to attend or participate in a personal life experience — concerts, races, trips, golf, sporting events, shows, tournaments, or any outing. Use ADD_CALENDAR_EVENT for yard/house reminders, chores, maintenance tasks, and recurring task scheduling. When in doubt, derive from the nature of the activity: experiential/attendance = personal event; task/reminder = calendar event."

### Confirmation Screen
- Category: dropdown pre-filled with closest name match from `lifeCategories`; user can change
- Warning shown if `categoryFound: false`
- `dateNote` displayed so user can verify date resolution
- Ambiguous people listed so user can resolve before confirming

---

## Open Items Before Development

- None. Plan is complete and ready for phase breakdown.

---

## Build Phases (High-Level Summary)

1. Foundation & Routing
2. Category Management
3. Event Core (shared fields, save, delete)
4. Event — People Picker & Links
5. Category-Specific Fields (typeFields)
6. Mini Log
7. Photos on Events
8. Calendar List View & Controls
9. Calendar Grid View
10. Journal Integration — Mini Logs
11. Compiled Journal Entry
12. People Page — Shared Events Section
13. SecondBrain — ADD_PERSONAL_EVENT

---

## Implementing Changes in Phases

> Each phase is a self-contained unit of work that can be built, tested, and committed independently.
> The current cache-bust version is `?v=289` — each phase increments it.
> All JS lives in `js/lifecalendar.js` (new file) unless noted.
> All Firestore writes use `userCol()` from `firebase-config.js`.

---

### Phase LC-1 — Foundation & Routing ✅ COMPLETE (v=290)

**Delivered:** Calendar tile on Life landing page (blue gradient). Routes `#life-calendar`, `#life-event/new`, `#life-event/{id}` wired in app.js. `js/lifecalendar.js` created with stub loaders. `page-life-calendar` and `page-life-event` skeleton sections added to index.html. CSS for `.landing-tile--life-calendar`.

**Goal:** Get the skeleton in place. Nothing works yet, but the routes exist and the Life page has a Calendar card.

**Files touched:** `index.html`, `js/app.js`, `js/lifecalendar.js` (new), `css/styles.css`

**Work:**
1. **Life page HTML** (`index.html`): Add a Calendar tile to `#lifeFeatureGrid`:
   ```html
   <a href="#life-calendar" class="landing-tile landing-tile--life-calendar">
       <span class="landing-tile-icon">🗓️</span>
       <span class="landing-tile-label">Calendar</span>
   </a>
   ```
2. **Life Calendar page HTML**: Add `<section class="page hidden" id="page-life-calendar">` with skeleton structure (header, controls placeholder, grid/list container, category management area).
3. **Event detail page HTML**: Add `<section class="page hidden" id="page-life-event">` with skeleton structure.
4. **app.js**: Add `'life-calendar'` to `TOP_LEVEL_PAGES`, `ALL_PAGES`, `LIFE_PAGES`. Add `'life-event'` to `ALL_PAGES` and `LIFE_PAGES`. Add route handlers:
   ```js
   } else if (page === 'life-calendar') {
       showPage('life-calendar');
       loadLifeCalendarPage();
   } else if (page === 'life-event' && id === 'new') {
       showPage('life-event');
       loadNewLifeEventPage();
   } else if (page === 'life-event' && id) {
       showPage('life-event');
       loadLifeEventPage(id);
   }
   ```
5. **js/lifecalendar.js** (new file): Create with stub functions: `loadLifeCalendarPage()`, `loadNewLifeEventPage()`, `loadLifeEventPage(id)`. Add module-level state vars: `window.currentLifeEvent`, `window._newEventDate`.
6. **index.html**: Add `<script src="js/lifecalendar.js?v=290">`.
7. **css/styles.css**: Add `.landing-tile--life-calendar` color style.
8. Bump all versions to `v=290`.

**Done when:** Clicking Calendar on the Life page navigates to `#life-calendar` without errors. Clicking a day or an Add button will navigate to `#life-event/new` (stub page, blank for now).

---

### Phase LC-2 — Category Management ✅ COMPLETE (v=291)

**Delivered:** `lcLoadCategories`, `lcAddCategory`, `lcUpdateCategory`, `lcDeleteCategory`. Auto-seed of 5 default categories (Races/teal, Concerts/rose, Golf/green, Travel/sky, Sports Events/amber) on first visit. Color-coded category tile grid with Edit/Delete buttons. Add/Edit modal with 8-color swatch picker. Delete flow: if events exist, shows reassignment modal with batch-update before delete. CSS: `.lc-category-tile`, `.lc-tile-btn`, `.lc-delete-event-list`.

**Goal:** User can create, edit, and delete categories with names and colors. 5 starting categories auto-seeded on first visit.

**Files touched:** `js/lifecalendar.js`, `index.html`, `css/styles.css`

**Work:**
1. **Firestore CRUD** in `lifecalendar.js`:
   - `lcLoadCategories()` — query `lifeCategories` ordered by `sortOrder`
   - `lcAddCategory(name, color, template)` — add doc
   - `lcUpdateCategory(id, name, color)` — update doc
   - `lcDeleteCategory(id)` — check for events first (see below), then delete
2. **Auto-seed**: In `loadLifeCalendarPage()`, check if `lifeCategories` is empty; if so, create the 5 starting categories (Races/`race`, Concerts/`concert`, Golf/`golf`, Travel/`travel`, Sports Events/`sports`) with preset colors and `sortOrder` 1–5.
3. **Category list UI**: Render categories on `#page-life-calendar` as color-coded tiles (reuse `.notebook-tile` pattern). Each has Edit and Delete buttons.
4. **Add/Edit modal** (in `index.html`): Modal with name input + color swatches (same 8-swatch pattern as notebooks). Save button calls `lcAddCategory` or `lcUpdateCategory`.
5. **Delete with event check**: `lcDeleteCategory(id)` first queries `lifeEvents` where `categoryId == id`. If any exist, show a modal listing those events and a dropdown to pick a replacement category. On confirm, batch-update all events to the new category, then delete. If no events, simple confirm.
6. **CSS**: `.lc-category-tile`, delete/edit button positioning.

**Done when:** User can see the 5 seeded categories on the Life Calendar page, add a new one, edit name/color, and delete (with reassignment flow if events exist).

---

### Phase LC-3 — Event Core (Shared Fields, Save, Delete) ✅ COMPLETE (v=292)

**Delivered:** `lcAddEvent`, `lcUpdateEvent`, `lcDeleteEvent` (cascade-deletes logs + photos, leaves journal entries). Full event form: title, category dropdown, start/end dates, location, cost, status radios (Upcoming/Attended/Didn't Go) with conditional reason field, description, outcome. `loadNewLifeEventPage` pre-fills date from `window._newEventDate`. `loadLifeEventPage` loads from Firestore and populates all fields. Save: new event navigates to detail; edit shows "Saved ✓". Delete: confirm dialog + cascade + navigate. Dirty flag (`_lcEventDirty`) with hashchange guard (capture phase, `stopImmediatePropagation` + hash restore on cancel). CSS: `.lc-event-form-wrap`, `.lc-date-row`, `.lc-status-row`, `.lc-didnt-go-reason`, `.lc-event-form-actions`.

**Goal:** User can create and edit a life event with all shared fields. Save, dirty flag, and delete work.

**Files touched:** `js/lifecalendar.js`, `index.html`, `css/styles.css`

**Work:**
1. **Firestore CRUD**:
   - `lcAddEvent(data)` — add to `lifeEvents`, return new ID
   - `lcUpdateEvent(id, data)` — update doc
   - `lcDeleteEvent(id)` — cascade delete `lifeEventLogs` + `photos` for this event; leave journal entries intact
2. **`loadNewLifeEventPage()`**: Clear all fields, set default status to `upcoming`, set category dropdown from seeded categories, pre-fill `startDate` from `window._newEventDate` if set (then clear it), show edit mode, wire Save/Cancel.
3. **`loadLifeEventPage(id)`**: Load event doc, populate all fields, wire Save/Delete/Cancel.
4. **HTML** — `#page-life-event` fields (in the existing skeleton):
   - Title (text input)
   - Category (select dropdown — populated from `lifeCategories`)
   - Start date / End date (date inputs; end date optional)
   - Location (text input)
   - Cost (number input)
   - Status (radio or select: Upcoming / Attended / Didn't Go)
   - "Didn't Go" reason (textarea — hidden unless status = Didn't Go)
   - General description (textarea)
   - Outcome summary (textarea)
5. **Dirty flag**: `_lcEventDirty` boolean. Set on any field `input`/`change` event. Clear on save. On `hashchange` if dirty → `confirm('You have unsaved changes. Leave anyway?')`.
6. **Save**: Reads all fields, calls `lcAddEvent` or `lcUpdateEvent`, clears dirty flag, shows success feedback.
7. **Delete**: Confirm dialog ("Delete this event? Notes and photos will also be deleted. Journal entries will be kept.") → `lcDeleteEvent(id)` → navigate to `#life-calendar`.
8. **Breadcrumb**: `Life › Calendar › [Event Title]` (or "New Event" for new).
9. **CSS**: `.lc-event-form`, `.lc-status-row`, `.lc-didnt-go-reason` (show/hide).

**Done when:** User can create a new event, fill in all shared fields, save it to Firestore, navigate away and back (data persists), edit it, and delete it.

---

### Phase LC-4 — Event Detail: People Picker & Links ✅ COMPLETE (v=293)

**Delivered:** `lcLoadPeople()` loads people sorted by name. People picker: text search with dropdown autocomplete, Enter adds single match, chips show person name (clickable → `#person/{id}`) with ✕ remove button, stored as `peopleIds[]`. Links: inline add/edit form (label + URL inputs), rendered list with Edit (pre-fills form) and Delete, stored as `links[]`. Both fields saved to Firestore via `_lcReadEventForm`.

**Goal:** Add the People "Who went with" picker and the Links list to the event detail page.

**Files touched:** `js/lifecalendar.js`, `index.html`, `css/styles.css`

**Work:**
1. **People picker**:
   - Load people list from Firestore once on page load (`lcLoadPeople()`)
   - Text input: on `input`, filter people list and show dropdown of matches
   - Click a match → add to `peopleIds[]` array, render as chip
   - If exactly 1 match and user presses Enter → add that person
   - Chip displays name (clickable → `#person/{id}`) + ✕ button to remove
   - People stored in event as `peopleIds: [string]`
2. **Links section**:
   - "Add Link" button → reveals inline form: Label input + URL input + Confirm button
   - On confirm → add to `links[]` array, render as list item
   - Each link: clickable label (opens URL in new tab), Edit (re-opens inline form pre-filled), Delete
   - Links stored in event as `links: [{label, url}]`
3. **HTML**: Add people picker and links sections to `#page-life-event` within the skeleton.
4. **CSS**: `.lc-people-chips`, `.lc-person-chip`, `.lc-links-list`, `.lc-link-item`.

**Done when:** User can search for people by typing, add them as chips, remove them, click a chip to navigate to the person. Can add multiple links with labels and URLs, edit and delete them.

---

### Phase LC-5 — Category-Specific Fields (typeFields) ✅ COMPLETE (v=294)

**Delivered:** `LC_TEMPLATE_KEYS` + `_lcGetTemplateForCategory()` resolve template from `_lcAllCategories`. Four typeFields sections: race (distance, finish time), concert (acts tag-list, section/seat), golf (courses + scores tag-lists), sports (sport select with Other text, teams, final score, seat). `_lcShowTypeFields()` shows/hides and populates from `event.typeFields`. Category dropdown change re-triggers show/hide. Tag-list inputs use Enter-to-add with ✕ remove chips. `_lcReadTypeFields()` reads visible section. `typeFields` saved and loaded via Firestore. CSS: `.lc-type-fields`, `.lc-tag-chip`.

**Goal:** When a category with a known template is selected, extra fields appear on the event detail page.

**Files touched:** `js/lifecalendar.js`, `index.html`, `css/styles.css`

**Work:**
1. **Template detection**: When the category dropdown changes, read the selected category's `template` field. Show/hide the appropriate `typeFields` section.
2. **HTML sections** (all hidden by default, shown based on template):
   - **`race`**: Distance (text), Finish Time (text)
   - **`concert`**: Acts/Performers (tag-style list — type name, press Enter to add each), Section & Seat (text)
   - **`golf`**: Courses (same tag-list pattern), Scores (same tag-list pattern)
   - **`sports`**: Sport (select: Baseball/Football/Basketball/Hockey/Other), Sport Other (text — shown if Other selected), Teams Playing (text), Final Score (text), Section & Seat (text)
   - **`travel`**: No extra fields — this template is a marker only
3. **Save/load**: `typeFields` is read from the event doc on load and saved back on Save. Only fields relevant to the template are written.
4. **CSS**: `.lc-type-fields`, `.lc-tag-input`, `.lc-tag-chip`.

**Done when:** Selecting "Concerts" shows the acts list and section/seat fields. Selecting "Races" shows distance and finish time. Switching category hides old fields and shows new ones.

---

### Phase LC-6 — Mini Log ✅ COMPLETE (v=295)

**Delivered:** `lcAddLog`, `lcUpdateLog`, `lcDeleteLog`, `lcLoadLogs` (single-field filter + client-side sort to avoid composite index). Mini log section below event form (edit mode only). Add entry form with date/time inputs (default = now). Entries show date/time, body with @name→link rendering, Edit (inline textarea) and Delete. `_lcInitLogMention` wires @mention autocomplete on any textarea using `_lcAllPeople`. `_lcRenderLogBody` converts @name tokens to `#person/{id}` links via `mentionedPersonIds`. CSS: `.lc-mini-log-section`, `.lc-log-entry`, `.lc-log-meta`, `.lc-log-body`, `.lc-log-mention-dropdown`.

**Goal:** User can add, edit, and delete timestamped mini log entries on an event. @mentions work.

**Files touched:** `js/lifecalendar.js`, `index.html`, `css/styles.css`

**Work:**
1. **Firestore CRUD**:
   - `lcAddLog(eventId, body, createdAt)` — add to `lifeEventLogs`
   - `lcUpdateLog(logId, body)` — update `body`, set `updatedAt`
   - `lcDeleteLog(logId)` — delete doc
   - `lcLoadLogs(eventId)` — query where `eventId ==`, sort by `createdAt` asc
2. **UI on event detail page**:
   - Mini log section with list of existing entries (oldest first)
   - "Add Entry" form: textarea + date/time inputs (default to now, user-overridable)
   - Each entry shows: formatted date/time, body text, Edit and Delete buttons
   - Edit: inline — replace text with editable textarea, Save/Cancel buttons; timestamp preserved
   - Delete: confirm then remove
3. **@mention support**: Reuse the `@`-trigger autocomplete pattern from `journal.js`. On `@` keypress in the mini log textarea, show a people dropdown; selecting inserts `@personId` markup. Render stored `@personId` as linked names when displaying entries.
4. **Load on event page**: `lcLoadLogs(eventId)` called after event loads; results rendered in `.lc-mini-log-list`.
5. **CSS**: `.lc-mini-log-list`, `.lc-log-entry`, `.lc-log-meta`, `.lc-log-body`.

**Done when:** User can add a log entry with custom date/time, @mention a person, edit and delete entries, and all entries display in chronological order.

---

### Phase LC-7 — Photos on Events ✅ COMPLETE (v=296)

**Delivered:** Photo section added to event detail page (hidden on new events). Camera, Gallery, and Paste buttons wired. `loadPhotos('lifeEvent', id, ...)` called on page load. `lifeEvent` added to `_getPasteEntity` map in photos.js so paste delegation works. Delete cascade for photos already handled by existing `lcDeleteEvent`.

**Goal:** Photos can be attached to life events using the existing photos system.

**Files touched:** `js/lifecalendar.js`, `index.html`

**Work:**
1. **Wire existing photo functions** on the event detail page:
   - Camera button → `triggerCameraUpload('lifeEvent', eventId)`
   - Gallery button → `triggerGalleryUpload('lifeEvent', eventId)`
   - Paste → existing paste handler with `targetType: 'lifeEvent'`
2. **Load photos**: Call `loadPhotos('lifeEvent', eventId, 'lcPhotoContainer', 'lcPhotoEmpty')` after event loads.
3. **HTML**: Add photo section to `#page-life-event` (buttons + container + empty state). Hidden for new unsaved events (same pattern as notes).
4. **New event guard**: Photo section hidden until event has been saved and has an ID (same pattern as `#note/new`).

**Done when:** User can attach photos to a saved life event via camera, gallery, or paste. Gallery viewer works. Photos are deleted when the event is deleted (existing cascade in `lcDeleteEvent`).

---

### Phase LC-8 — Calendar List View & Controls ✅ COMPLETE (v=297)

**Delivered:** Event list with live client-side filtering (status, category, search). Event cards show category color bar, title, dates, location, status badge. Chronological sort (ascending for upcoming, descending for past-only views). Category management collapsed into a `<details>` panel at bottom. Filter state persisted in module vars so it survives category modal round-trips. Mobile wraps controls to two rows.

**Goal:** The Life Calendar page shows a usable list of events with status filter, category filter, and search. Mobile works.

**Files touched:** `js/lifecalendar.js`, `index.html`, `css/styles.css`

**Work:**
1. **Load and render events** in `loadLifeCalendarPage()`:
   - Query `lifeEvents` (all, client-side filter)
   - Apply status filter (default: `upcoming`)
   - Apply category filter
   - Apply search query (title + location)
   - Sort chronologically
   - Render as list: each event is a card showing title, category color bar, date(s), status badge
2. **Controls HTML** (within `#page-life-calendar`):
   - Status filter `<select>`: Upcoming | Upcoming + Attended | Attended | Missed | All
   - Category filter `<select>`: All Categories | [each category]
   - Search `<input>` (filters on input event, client-side)
   - View toggle checkbox: "Grid View" (grid is Phase LC-9; for now the toggle is disabled or hidden)
   - "+ Add Event" button → sets `window._newEventDate = null`, navigates to `#life-event/new`
3. **Mobile detection**: On `loadLifeCalendarPage()`, if `window.innerWidth < 768`, default to list view; otherwise grid (grid will render as list until LC-9 builds it).
4. **Event list card** — each card:
   - Category color left-border or top-bar (using category's color gradient)
   - Title, date range, location (if set), status badge
   - Click → navigate to `#life-event/{id}`
5. **CSS**: `.lc-event-list`, `.lc-event-list-card`, `.lc-category-bar`, `.lc-status-badge`, `.lc-controls-row`.

**Done when:** Events appear in a scrollable list. Status/category/search filters work live. Clicking a card opens the event. "+ Add Event" creates a new one. Works on mobile.

---

### Phase LC-9 — Calendar Grid View ✅ COMPLETE (v=298)

**Delivered:** 7-column month grid with event bars (colored by category, ✗ badge for Didn't Go), today circled, Prev/Next/Today navigation. Day click → day modal (event cards + Add Event card); empty day → goes straight to new event form. Grid/List toggle button in controls row. Desktop defaults to grid, mobile defaults to list (≤599px hides grid). Filter state (status/category/search) applies to both views. `#lcDayModal` added to index.html.

**Goal:** Full month grid with multi-day event bars, today circled, day-click modal, navigation, and overflow.

**Files touched:** `js/lifecalendar.js`, `index.html`, `css/styles.css`

**Work:**
1. **Month grid rendering** (`_lcRenderGrid(year, month, events)`):
   - 7-column CSS grid with day-of-week headers (Sun–Sat)
   - Leading/trailing blank cells for days outside the current month
   - Each day cell: date number (circled if today), up to 2 event bars, "+ N more" link if overflow
2. **Multi-day event bars**:
   - For each event, determine which cells it spans (`startDate` to `endDate` or same-day)
   - Render a colored bar (using category color) that spans across day cells
   - Multi-day spanning uses absolute positioning within a grid row, or a per-row bar approach
   - ✗ badge on "Didn't Go" events
3. **Navigation**: Previous month `<` button, Next month `>` button, "Today" button — each re-calls `_lcRenderGrid` with updated month/year.
4. **View toggle**: Wire the checkbox from LC-8 to switch between `_lcRenderGrid` and `_lcRenderList`.
5. **Day-click modal** (`#lcDayModal` in `index.html`):
   - Clicking any day cell (with or without events) opens a modal
   - Modal shows: date heading, cards for each event on that day (title, category color, status, date range), plus an "Add Event" card
   - Clicking an event card → close modal, navigate to `#life-event/{id}`
   - Clicking "Add Event" → set `window._newEventDate`, close modal, navigate to `#life-event/new`
   - If day has 0 events, skip the modal and go straight to Create Event
6. **CSS**: `.lc-grid`, `.lc-grid-header`, `.lc-grid-cell`, `.lc-grid-day-num`, `.lc-grid-day-num--today`, `.lc-event-bar`, `.lc-event-bar--didnt-go`, `.lc-overflow-link`.

**Done when:** Month grid renders with event bars spanning their days. Today is circled. Clicking a day opens the modal. Prev/Next/Today navigation works. Grid/list toggle works. Mobile falls back to list automatically.

---

### Phase LC-10 — Journal Integration: Mini Logs ✅ COMPLETE (v=299)

**Delivered:** `loadJournalData()` now queries `lifeEventLogs` in the date range (single-field range query, no composite index needed). Batch-fetches referenced lifeEvents + lifeCategories. Mini logs merged into feed as `type: 'lifeLog'` items. `_renderLifeLogCard()` renders category color bar, event title badge, log body with @mention links, "Go to Event →" button. "Show Event Notes" checkbox in journal toolbar — localStorage-persisted, toggles `journal-feed--hide-logs` class for instant hide/show without re-render.

**Goal:** Mini log entries appear in the journal timeline. "Show Event Notes" toggle works.

**Files touched:** `js/journal.js`, `index.html`, `css/styles.css`

**Work:**
1. **Load mini logs in `loadJournalData()`** (`journal.js`):
   - After fetching journal entries for the date range, also query `lifeEventLogs` where `createdAt` falls within the same range
   - Collect unique `eventId` values from results; batch-fetch those `lifeEvents` docs to get title + `categoryId`
   - Batch-fetch `lifeCategories` to get color for each categoryId (or load once and cache)
   - Merge mini logs into the same flat array as journal entries; each gets a synthetic `type: 'lifeLog'` field
2. **Render mini log entries** in `renderJournalFeed()`:
   - New renderer: `_renderLifeLogCard(log, event, category)`
   - Shows: category color left-bar, event title badge, log body (with @mention links rendered), "Go to Event" button at bottom
   - Uses a distinct visual style (different border color from journal entries and tracking items)
3. **"Show Event Notes" toggle**:
   - Add a checkbox to the journal toolbar: "Show Event Notes" (default checked)
   - State stored in `localStorage` under key `'bishop_journal_showEventNotes'`
   - When unchecked: hide all `.journal-item--life-log` items (or re-render without them)
4. **CSS**: `.journal-item--life-log` (border color distinct from entry/tracking), `.lc-event-badge`, `.lc-go-to-event-btn`.

**Done when:** Journal shows mini log entries inline with journal entries. Toggle hides/shows them. @mentions are clickable. "Go to Event" button navigates to the event.

---

### Phase LC-11 — Compiled Journal Entry ✅ COMPLETE (v=300)

**Delivered:** "📓 Create Journal Entry" button at bottom of saved event pages. `lcCreateCompiledEntry(eventId)` loads mini logs, builds structured draft (title/dates/location, category/cost, description, bulleted notes, outcome, type fields, people @mentions, links), saves to `journalEntries` with `sourceEventId` field, updates event's `journalEntryIds` array, then opens entry in journal editor. `_renderEntryCard()` in journal.js shows "Go to Event →" link on compiled entries.

**Goal:** "Create Journal Entry" button generates a structured draft, opens journal edit page pre-filled, and saves a link back to the event.

**Files touched:** `js/lifecalendar.js`, `js/journal.js`, `index.html`, `css/styles.css`

**Work:**
1. **"Create Journal Entry" button** on event detail page (bottom):
   - Checks `_lcEventDirty` — if dirty, alert "Please save your changes first." and stop
   - Calls `lcCreateCompiledEntry(eventId)`
2. **`lcCreateCompiledEntry(eventId)`** in `lifecalendar.js`:
   - Reads current event + its mini logs (already loaded on page)
   - Builds the structured draft text (title, dates, location, description, logs bulleted, outcome, typeFields, people @mentions, links)
   - Creates a new `journalEntries` doc with:
     - `date`: event's `startDate`
     - `entryText`: the structured draft
     - `entryTime`: current time (HH:MM)
     - `sourceEventId`: the event's ID  ← **new field on journalEntries**
     - `mentionedPersonIds`: people from the event's `peopleIds`
   - Pushes the new entry ID into the event's `journalEntryIds` array (saves to Firestore)
   - Sets `window._lcCompiledEntryId = newEntryId`
   - Navigates to `#journal-entry/{newEntryId}` (the journal edit page — user reviews and saves)
3. **Journal edit page** (`journal.js`): When `loadJournalEntryPage(id)` is called for a `sourceEventId`-bearing entry, no special behavior needed — the text is already pre-filled; user edits and saves normally.
4. **"Go to Event" button on compiled entries** in the journal feed:
   - In `_renderEntryCard()` in `journal.js`, check if `entry.sourceEventId` is set
   - If so, render a "Go to Event" button below the entry text (same style as "Go to Person")
   - Button navigates to `#life-event/{sourceEventId}`
5. **Firestore schema update**: Note in code comments that `journalEntries` now has an optional `sourceEventId: string | null` field.

**Done when:** Pressing "Create Journal Entry" on a saved event opens the journal editor with a pre-structured draft. Saving it creates a real journal entry. The compiled entry in the journal feed has a "Go to Event" button. Multiple compilations are allowed (each creates a new entry).

---

### Phase LC-12 — People Page: Shared Events Section ✅ COMPLETE (v=301)

**Delivered:** `loadSharedEvents(personId)` queries `lifeEvents` where `peopleIds` array-contains the person's ID, batch-fetches categories for colors, sorts newest-first. Renders clickable event cards (category color bar, title, dates, location, status badge) reusing existing LC-8 card CSS. "No shared events yet." empty state. Section placed between Photos and Interactions on person detail page.

**Goal:** Each person's detail page shows a "Shared Events" section listing life events they're attached to.

**Files touched:** `js/people.js`, `index.html`, `css/styles.css`

**Work:**
1. **Query in `renderPersonDetail()`** (`people.js`):
   - After loading the person, query `lifeEvents` where `peopleIds` array contains this person's ID
   - Also batch-fetch `lifeCategories` to resolve category colors
   - Sort results newest-first by `startDate`
2. **Render "Shared Events" section**:
   - New function `_renderSharedEvents(events, categories)` in `people.js`
   - Each item: category color chip + title + date(s) + status badge — full row is clickable → `#life-event/{id}`
   - Empty state: "No shared events yet."
   - Section placed **between Photos and Interactions** in the person detail layout
3. **HTML**: Add "Shared Events" section skeleton to `#page-person` in `index.html` (header + container + empty state).
4. **CSS**: `.lc-shared-event-item`, `.lc-shared-event-category-chip`.

**Done when:** Navigating to a person who is on life events shows a "Shared Events" section. Each event is clickable. People with no events show the empty state.

---

### Phase LC-13 — SecondBrain: ADD_PERSONAL_EVENT ✅ COMPLETE

**Goal:** "I'm going to the AC/DC concert on Aug 5 at Chastain" creates a life event via quick log.

**Delivered:** `lifeCategories` (id/name/template) + `sportTypes` enum added to context; `ADD_PERSONAL_EVENT` action block added to system prompt with full date-resolution rules and disambiguation vs `ADD_CALENDAR_EVENT`; `SB_ICONS`, `SB_LABELS`, `_sbRenderConfirmFields` case, `_sbWrite` case, `_sbNavigateTo` case, and `SB_HELP_ACTIONS` entry all added. Version v=302.

**Files touched:** `js/secondbrain.js`, `index.html`

**Work:**
1. **Context loading** (`_sbBuildContext()`):
   - Add `userCol('lifeCategories').get()` to the parallel fetch array
   - Add to context object:
     ```js
     lifeCategories: lifeCategories.map(c => ({ id: c.id, name: c.name, template: c.template })),
     sportTypes: ['baseball','football','basketball','hockey','other']
     ```
2. **System prompt** (`_sbBuildSystemPrompt()`): Add the `ADD_PERSONAL_EVENT` action block with:
   - Trigger description
   - Date resolution rules (future-rolling, month-only → 1st, vague duration → null endDate)
   - Full JSON schema with all fields and notes
   - Disambiguation rule vs. `ADD_CALENDAR_EVENT`
3. **`SB_ICONS` + `SB_LABELS`**: Add `ADD_PERSONAL_EVENT: '🗓️'` and `ADD_PERSONAL_EVENT: 'Add Personal Event'`
4. **`_sbRenderConfirmFields()`**: Add `case 'ADD_PERSONAL_EVENT'` — renders:
   - Title (editable text input)
   - Category (dropdown from `lifeCategories`, pre-selected to `categoryId`; warning if `categoryFound: false`)
   - Start date / End date
   - Location
   - Description
   - `dateNote` (read-only explanation text)
   - Ambiguous people notice (if `peopleAmbiguous[]` is non-empty)
5. **`_sbWrite()`**: Add `case 'ADD_PERSONAL_EVENT'` — creates `lifeEvents` doc from payload, returns new ID
6. **`_sbNavigateTo()`**: Add `case 'ADD_PERSONAL_EVENT'` → `hash = '#life-event/' + newId`
7. **`SB_HELP_ACTIONS`**: Add entry with icon, label, desc, and 4 example utterances
8. **Cache invalidation**: `lifeCategories` is added to the invalidation set so context refreshes when categories change

**Done when:** Saying "I'm going to the AC/DC concert Aug 5 at Chastain" in SecondBrain produces a confirmation card showing the event details. Confirming creates the event and navigates to its detail page. The action appears in the help screen.

---

### Dependencies Summary

```
LC-1 (routing)
  └── LC-2 (categories)
        └── LC-3 (event core)
              ├── LC-4 (people picker + links)
              ├── LC-5 (type-specific fields)
              ├── LC-6 (mini log)
              │     └── LC-10 (journal integration)
              │           └── LC-11 (compiled entry)
              ├── LC-7 (photos)
              ├── LC-8 (list view + controls)
              │     └── LC-9 (grid view)
              ├── LC-12 (people page shared events)
              └── LC-13 (SecondBrain) ← also needs LC-2
```

Phases LC-4 through LC-13 can all start from LC-3 and are largely independent of each other. LC-10 needs LC-6 (mini logs must exist to surface in journal). LC-11 needs LC-10 (for the toggle context). LC-9 needs LC-8 (controls already built).
