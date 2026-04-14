# ModifyProjects.md — Rethinking Projects

## Status: Planning / Discussion Phase

---

## What We Have Today

The current `projects` feature is simple and lightweight:

**Firestore fields:**
- `targetType` / `targetId` — attaches to a zone, plant, room, thing, vehicle, etc.
- `title` — project name
- `notes` — a single free-form text block
- `status` — active | completed
- `completedAt`
- `items[]` — flat checklist array, each item has:
  - `text` — the item label
  - `done` — boolean
  - `completedAt`
  - `notes` — a single note on the item

**What it can do:**
- Simple checklist with per-item notes
- Mark items done, mark whole project complete
- Attach to anything (zone, room, plant, vehicle, etc.)
- Collapse/expand card

**What it can't do:**
- Store links/URLs with labels
- Organize items into phases or sections
- Track a day-by-day itinerary
- Have any kind of budget awareness
- Hold multiple separate notes or a running journal

---

## The Core Design Problem

Different projects in real life have fundamentally different structures. A checklist is the right tool for some, but badly wrong for others.

| Project Type | What it actually needs |
|---|---|
| "Clean out the garage" | Simple checklist — that's it |
| "Plan vacation to Paris" | Day-by-day itinerary, links to hotels/flights/events, per-day task lists |
| "Build a raised garden bed" | Phases (Design → Materials → Build → Plant), materials list, measurements/notes |
| "Home renovation" | Contractor contacts, budget tracking, phases, permit docs |
| "Research a car purchase" | Links to listings, comparison notes, pros/cons per option |
| "Christmas gift planning" | Per-person list with status and budget |

The question is: do we try to build one system that handles all of these, or do we pick a sweet spot and accept that edge cases won't be perfect?

---

## Real-World Project Management Patterns

When people manage personal projects outside of apps, here's what they actually do:

### 1. The Notebook Method (most common)
- A page per project, with a title at the top
- Free-form sections separated by drawn lines or headings
- Checkboxes for action items, regular text for notes and info
- URLs scribbled in the margin or highlighted separately
- Often has a "brain dump" area and a "next steps" area

### 2. The Planning Doc (for complex projects)
- Structured like: Overview → Goals → Resources/Links → Phases → Notes
- Each phase has its own task list
- Running notes at the bottom (like a journal/log)
- Common tool: Google Docs or Notion

### 3. The Itinerary (for travel)
- Organized by date/day
- Each day has: time, activity, location/address, booking confirmation, cost
- A "logistics" section at the top: flights, car rental, hotel
- A packing list somewhere
- Links to every booking

### 4. The Kanban Board (for builds/renovations)
- Columns: To Do → In Progress → Done
- Each card is a task; can move between columns
- Usually combined with phases

### 5. The Spreadsheet (for budget-heavy projects)
- Line items, estimated cost, actual cost
- Running total, "over/under"
- Vendors/sources

---

## What This App Probably Needs

We don't need to build Notion. We need to cover the 80% case well with a clean mobile-friendly UI. Here's what seems worth adding:

### Option A: Minimal Enhancement (low effort, high value)
Keep the flat checklist but add:
- **Links section** — a list of URL + label pairs stored on the project (not on individual items)
- **Target date** — optional due date for the project
- **Category/tag** — optional label (Travel, Home, Hobby, etc.) for filtering

*Good for: garage cleanout, simple to-do projects*
*Not good for: travel planning, phased builds*

### Option B: Sections (medium effort)
Allow a project to have named **sections**, each with its own checklist.
- Default: one unnamed section (looks identical to today)
- User can add more sections with names like "Day 1", "Phase 2: Framing", "Research"
- Each section has: title + checklist items
- Links could live at the project level or inside a section

*Good for: anything with phases or days*
*Not good for: true day-by-day itinerary with dates*

### Option C: Typed Sections (higher effort)
Sections with a **type** that controls their layout:
- `checklist` — current behavior (tasks with checkboxes and optional notes)
- `notes` — a rich text block (markdown or just free text)
- `links` — a list of URL + label pairs
- `itinerary` — a date + time + task list for travel-style planning

This is the most powerful but also the most complex to build and use.

---

## Key Questions to Decide

1. **Where does the "Life" project card live?**
   - Is it a standalone section like "Contacts" or "Journal"?
   - Or does it use the same `targetType/targetId` pattern with `targetType: 'life'`?
   - Should Life projects be separate from the yard/house/vehicle project system, or unified?

2. **Should all project targets (yard, house, life) share the same enhanced features?**
   - Could enhance everything at once since they share `projects.js` and `createProjectCard()`
   - Or just add Life projects with richer fields and leave the others simpler

3. **What's the minimum useful enhancement?**
   - Even just adding a **links list** at the project level would make vacation planning dramatically better
   - Adding named **sections** (each with a checklist) would handle most phased projects

4. **Do we need itinerary/day planning?**
   - For vacation planning: list of days, each day a mini checklist of activities
   - Could model this as: sections named "Day 1 — [date]", "Day 2 — [date]", etc.
   - Or we could have a true date-aware itinerary sub-system

5. **Budget tracking — yes or no?**
   - Even a simple "estimated cost" per item + total would be useful
   - Full budget with actual vs. estimated is more complex

---

## Candidate Feature List (parking lot, unranked)

- [ ] Target date / due date on a project
- [ ] Category/tag for filtering (Travel, Home, Hobby, etc.)
- [ ] Priority flag (low/medium/high)
- [ ] Links section — URL + label + optional description
- [ ] Named sections within a project (each with a checklist)
- [ ] Section type: checklist / notes / links / itinerary-day
- [ ] Budget line items (estimated / actual cost per item)
- [ ] Project description (separate from notes — a persistent "what is this?" field)
- [ ] Running journal / log (timestamped notes, newest first)
- [ ] Quick "brain dump" text area at the project level
- [ ] Progress indicator (X of Y items done, shown on collapsed card)
- [ ] Reorder checklist items via drag or up/down arrows
- [ ] Attach photos directly to a project
- [ ] Move project between targets (e.g., from a room to a zone to Life)
- [ ] Export/share a project as plain text

---

---

## Direction Decided

- **Rename** current "Projects" / "Future Projects" everywhere to **"Quick Task List"** — same code, just label changes
- **Build a new "Projects" system** starting in the Life section only, then decide later if/how to expand to other targets
- Quick Task List and Projects coexist — different tools for different purposes

---

## Deep Analysis: 3 Real Trip Planning Documents

Analyzed all three trip docs (Alaska Cruise 2022, Lincoln Caribbean Cruise 2025, Wyoming-Montana Road Trip 2024). Here are the patterns.

### Universal Structure Across All 3 Trips

Every trip doc follows the same basic skeleton, regardless of trip type:

1. **Header / Trip Overview**
   - Title, dates, who's going
   - Map link (Google Maps custom map or route)
   - Key reference numbers (reservation #s, confirmation #s)

2. **To-Do List** (pre-trip tasks)
   - Flat checklist: book flights, pay balance, pack, verify reservations, etc.
   - Some items have sub-notes with context

3. **Day-by-Day Itinerary** (THE CORE — 70%+ of every doc)
   - Each day: date + day label + location
   - Under each day, a mix of:
     - **Confirmed activities** with time, name, cost, confirmation #, contact info, links
     - **Possible/research activities** — ideas being explored, multiple options compared
     - **"Not doing"** — ideas that were considered and rejected (with reasoning)
     - **Logistics** — drive times, arrival times, "leave by X", "be back by Y"
     - **Food plans** — restaurants, breweries, with links/notes
     - **Free-form notes** — tips, reminders, fun facts
     - **Links** — inline everywhere: booking pages, YouTube research, attraction sites, Google maps

4. **Packing List**
   - Categorized: Clothes, Electronics/Camera, Documents, Other
   - Detailed and trip-specific

5. **Booking / Cost Info** (scattered throughout, not centralized)
   - Hotels: name, address, phone, confirmation #, cost, payment status
   - Flights: departure/arrival times, airline
   - Car rental: confirmation #, pickup location, cost
   - Excursions: booked ones with confirmation, cost, vendor contact

6. **Reference Info**
   - Weather per location
   - Distance/drive times between stops
   - Phone numbers for vendors
   - "Fun facts" about destinations

### Key Patterns by Trip Type

**Cruise (Alaska, Caribbean)**
- Days are organized by PORT — "Day 6 — Juneau"
- Ship info section: ship name, deck, cabin, what's included
- Each port day: arrive time, excursions, food, "be back on boat by X"
- Sea days: exercise, ship activities
- Extensive excursion research with per-port links collections
- Vendor contact info critical (phone numbers for excursion companies)

**Road Trip (Wyoming-Montana)**
- Days organized by LOCATION and LODGING — "Stay at Canyon Lodge Sun and Mon night"
- Distance/drive time calculations between stops are central to planning
- Multiple lodging types (Under Canvas, Tipi, Lodge, Motel, Inn) each with full booking details
- Hiking details: trail names, distances, round trip times
- More flexible/less scheduled than cruise — "if time allows", "possible"

### What Items Inside a Day Actually Look Like

An "item" in a day isn't just a task. It's more like a **mini-card** with several optional fields:

```
Name/Title:     "Eagle Preserve Rafting Float Adventure"
Time:           8:30am
Duration:       4.25 hours ("done by 12:45")
Cost:           $169 each
Status:         Booked / Possible / Research / Not Doing
Confirmation:   (link or number)
Contact:        Phone number, email
Links:          [booking page, youtube review, vendor site]
Notes:          Multi-line free text (description, tips, reasoning)
```

Not every item has all fields. A restaurant might just be name + notes. A major excursion has all of them.

### The "Not Doing" Pattern

This is significant and appears in ALL three docs. During planning, you research multiple options, then narrow down. The rejected options stay in the doc with reasoning:

- Alaska: "Not doing: 4x4 ride 299 each", "Not doing: train ride" (with explanation why)
- Wyoming: "Possible canoe", "Possible horseback ride"
- Caribbean: Extensive per-island research where only some items get promoted to "the plan"

This maps directly to the **Planning vs. Travel mode** idea:
- **Planning mode**: see everything — research, possible, not doing, confirmed
- **Travel mode**: see only confirmed/planned items with the critical details (time, address, phone, confirmation #)

### How Bookings Are Tracked

Booking info is scattered throughout but always includes:
- **Where you're staying**: name, address, phone, confirmation #, cost, payment status, check-in details
- **Transportation**: flight times, car rental confirmation, pickup/dropoff details
- **Excursions**: vendor name, time, cost, confirmation, what to expect, contact info

This info needs to be both:
1. In the day it belongs to (for travel-day reference)
2. Findable as a list (for pre-trip verification: "do I have all my confirmations?")

---

## All Decisions Final

---

## Design: Travel Project (Vacation Template)

### Navigation Flow

```
Life Home Screen
  └─ "Projects" card (new)
       └─ Project List page
            │  Shows all projects as cards: title, dates, status badge, template icon, description
            │  "+ New Project" button → FIRST step: pick template type (locked after creation)
            │  Toggle: "Show archived" (archived projects hidden by default)
            │  Link at bottom: "Manage Booking Types"
            └─ Project Detail page (tapping a project)
                 │  Header: title, dates, status, mode toggle (Planning/Travel), Archive button
                 │  Scrollable accordion — all sections on one page, each collapsible:
                 │    - Trip Info / People
                 │    - Bookings
                 │    - To-Do
                 │    - Itinerary (days)
                 │    - Packing List (button → opens dedicated modal)
                 │    - Notes (journal)
```

### Creating a New Project

1. Tap "+ New Project"
2. **First step: select template type** (Vacation / Build a Thing / General)
   - Template type is **permanently locked** after creation — cannot be changed
   - To switch types, delete and create a new project
3. Fill in title, description, dates
4. If dates are set, prompt: "Create days for [start]–[end]? Add days before/after?"
   - Default: suggest 2 days before + 1 day after (adjustable)
5. Project created with template starter content

### Project-Level Fields

| Field | Notes |
|---|---|
| `title` | "2025 Caribbean Cruise" |
| `description` | Optional — short summary |
| `template` | vacation / build / general — **locked after creation** |
| `status` | planning / active / on-hold / done |
| `startDate` | Trip start (optional) |
| `endDate` | Trip end (optional) |
| `mode` | planning / travel (current view mode) |
| `archived` | boolean — hides from default list view |
| `people[]` | Array of { name, contactId, notes } |
| `bookingTypes[]` | User-managed list, starts with defaults |
| `createdAt, updatedAt` | |
| `targetType` | 'life' for now — future: 'zone', 'room', 'vehicle', etc. |
| `targetId` | null for now — future: the entity's doc ID |

### People List

Linked to the Contacts system:

| Field | Notes |
|---|---|
| `name` | Display name — "Connie", "Danielle" |
| `contactId` | Optional — link to a contact record for full details |
| `notes` | Optional — "flying in separately", "arriving Fri instead of Thur" |

### Bookings Section

Each booking is a structured card:

| Field | Required? | Notes |
|---|---|---|
| `name` | Yes | "Canyon Lodge", "Delta Flight ATL→BZN" |
| `type` | Yes | Dropdown from bookingTypes list, with "Add new..." at bottom |
| `startDate` | No | The date (or check-in date) |
| `multiDay` | No | Boolean toggle — "spans more than one day" |
| `endDate` | No | Only shown if multiDay is true |
| `startTime` | No | "3:00 PM" (hotel check-in), "2:00 PM" (excursion start) |
| `endTime` | No | Optional end time |
| `confirmation` | No | Confirmation # or reference code |
| `cost` | No | Number (for rollup) |
| `costNote` | No | "each", "total", "deposit paid", etc. |
| `paymentStatus` | No | paid / deposit / balance-owed |
| `contact` | No | Phone, email |
| `address` | No | Physical address |
| `link` | No | Booking page URL |
| `notes` | No | Free-form (check-in instructions, what's included, etc.) |
| `screenshots` | No | Photos via `bookingPhotos` subcollection |

**Booking type dropdown**: populated from project's `bookingTypes[]`. Last item is always "Add new..." which prompts for a name and adds it to the list.

**Default booking types** (populated on first project creation if empty): Lodging, Flight, Car Rental, Excursion, Sports Event

**Manage Booking Types**: link at bottom of the project list page. Simple list management — add, rename, delete, reorder. Defaults populated first time.

**In travel mode**: bookings with screenshots are front-and-center. Tap → see confirmation screenshot immediately.

### The Day as First-Class Concept

Each day in the itinerary:

| Field | Notes |
|---|---|
| `date` | Actual calendar date (ISO string) |
| `label` | "Day 6 — Juneau" or "Sat — Yellowstone" |
| `location` | Where you are that day |
| `sortOrder` | Integer for reordering |
| `items[]` | Ordered list of activities/notes |

**Day auto-generation**:
- When user sets start/end dates, prompt: "Create days for Sept 20–28? Add extra days before/after?"
- Default: 2 days before + 1 day after (adjustable spinners)
- Auto-labels: "Pre-Trip — Wed Sept 18", "Day 1 — Fri Sept 20", ..., "Post-Trip — Mon Sept 29"
- "+ Add Day" button for manual additions

### Item Structure Inside a Day

Each item is a flexible mini-card. **Inline editing** (expand in place on click). Title + status always visible; optional fields expand below.

| Field | Required? | Notes |
|---|---|---|
| `id` | Yes | Unique ID within the items array |
| `title` | Yes | Activity name or short note |
| `time` | No | Free text: "8:30am", "leave by 7am" |
| `status` | Yes | `confirmed` / `maybe` / `idea` / `nope` |
| `cost` | No | Number (for rollup) |
| `costNote` | No | "each", "for 2", "total" |
| `notes` | No | Free-form text (multi-line) |
| `links[]` | No | Array of { url, label } |
| `confirmation` | No | Booking confirmation # or reference |
| `contact` | No | Phone number, email |
| `duration` | No | Free text: "4.25 hours", "90 min" |
| `bookingRef` | No | Booking doc ID → shows badge in day view |
| `dayId` | — | Which day this item belongs to (for move-between-days) |
| `sortOrder` | Yes | Integer for ordering within the day |
| `showOnCalendar` | No | Boolean — if true, shows on the app's calendar view |

**Item move between days**: each item has a day dropdown that can be quickly changed to reassign it to a different day. This needs to be fast and easy — it's a common planning action.

**Reorder**: drag-and-drop preferred, up/down arrows as fallback.

**Status colors/badges**:
- `confirmed` — solid/green, always visible in travel mode
- `maybe` — yellow/amber, visible in planning mode
- `idea` — light/grey, visible in planning mode
- `nope` — strikethrough/dimmed, visible in planning mode only

**Photos on items**: stored in the existing app-wide `photos` collection using `targetType: 'dayItem'`, `targetId: '{dayDocId}_{itemId}'`. NOT embedded in the day doc.

### To-Do Section

Pre-trip checklist. Each item:

| Field | Notes |
|---|---|
| `text` | The task |
| `done` | Boolean |
| `notes` | Optional — can contain URLs, clarifications, sub-details (like facts) |
| `sortOrder` | Integer |

### Packing List

**Dedicated modal** — button on project detail page opens it. Not inline on the accordion.

Each item:

| Field | Notes |
|---|---|
| `text` | Item name |
| `done` | Boolean (checked = packed) |
| `notes` | Optional clarification ("some beaches are rocky, bring water shoes") |
| `category` | "Clothes", "Toiletries", "Electronics", "Documents", "Gear / Other" |
| `sortOrder` | Integer (within category) |

**Default categories** (hardcoded for now, "Other" as catch-all):
- Clothes
- Toiletries
- Electronics
- Documents
- Gear / Other

**Default starter items per category**: (see packing list section below)

### Notes Section (Journal)

Each note is a journal entry:

| Field | Notes |
|---|---|
| `title` | Heading — "Weather Info", "Drive Times", "Day 3 Research" |
| `text` | The note content (multi-line) |
| `createdAt` | Timestamp — displayed, sorted newest first |
| `sortOrder` | Integer (for manual reordering if needed) |

### Top-Level Sections (Accordion)

| Section | Collapsed Summary | Content |
|---|---|---|
| **Trip Info** | Dates shown | Dates, description, map link, general reference |
| **People** | "3 people" | Who's going — name, contact link, notes |
| **Bookings** | "4 bookings" | Structured cards with screenshots |
| **To-Do** | "3/7 done" | Checklist with notes |
| **Itinerary** | "9 days" | Day-by-day — the core |
| **Packing List** | "12/38 packed" | Button → opens dedicated modal |
| **Notes** | "5 entries" | Journal entries, newest first |

### Planning Mode vs. Travel Mode

Toggle at the top of the project detail page.

| Aspect | Planning Mode | Travel Mode |
|---|---|---|
| Day items | ALL statuses shown | Only `confirmed` items |
| `nope` items | Shown (dimmed/strikethrough) | Hidden |
| `idea` items | Shown (grey) | Hidden |
| `maybe` items | Shown (amber) | Hidden |
| Booking screenshots | Available | **Prominent — tap to view** |
| Confirmation #s | Shown | **Large and prominent** |
| Phone/contact info | Shown | **Prominent — tap to call** |
| Cost details | Shown | Hidden |
| Research links | Shown | Hidden |
| Notes | Full | Collapsed (tap to expand) |
| Editing | Full edit capability | Read-only (or locked with override) |
| To-Do section | Shown | Hidden (trip already started) |
| Packing List | Shown | Shown (may still be packing) |

### Cost Rollup

- Auto-total all numeric `cost` fields from bookings + day items
- Display in Trip Info section: "Total Trip Cost: $X,XXX"
- Simple sum — costNote is display-only, not factored into math

### Booking ↔ Day Linking

- Items in a day reference a booking via `bookingRef` (the booking's doc ID)
- Day view renders a compact badge: type icon + booking name (e.g., "🏨 Canyon Lodge")
- Tapping the badge scrolls to / navigates to the full booking card
- No `dayRefs` on bookings — linking is one-directional (item → booking). Booking dates tell you which days it covers.

### Calendar Integration

- Day items have a `showOnCalendar` boolean
- When checked, the item appears on the app's main calendar view
- User picks and chooses what's important enough to show on the calendar
- Not everything shows — just the items you want reminders for

### Archive

- Project detail page has an "Archive" button
- Archived projects hidden from default project list
- Project list has a "Show archived" toggle to see them
- Archive is soft — not deleted, just hidden

---

## Packing List — Default Categories and Starter Items

Hardcoded categories for now. "Gear / Other" is the catch-all.

**Clothes**
- Underwear
- Socks
- Jeans / Pants
- Shorts
- T-shirts
- Long sleeve shirts
- Light jacket
- Heavy coat
- Swimsuit / Swim shorts
- Hat(s)
- Gloves
- Comfortable walking shoes
- Dress shoes (optional)
- Pajamas
- Belt

**Toiletries**
- Toothbrush / Toothpaste
- Deodorant
- Shampoo / Conditioner
- Sunscreen
- Lip balm
- Medications / Prescriptions
- First aid basics (band-aids, ibuprofen)
- Contact lenses / Solution
- Glasses

**Electronics**
- Phone + charger
- Camera + charger / batteries
- Extra memory cards
- Portable battery pack
- Headphones / Earbuds
- Laptop / Tablet + charger
- Power strip (no surge protector for cruises)
- Adapters if international

**Documents**
- Passport
- Driver's license
- Credit cards
- Insurance cards
- Printed confirmations / Itinerary
- Emergency contact info

**Gear / Other**
- Backpack / Day bag
- Sunglasses
- Umbrella
- Reusable water bottle
- Snacks
- Binoculars
- Waterproof bag / Dry bag
- Rain jacket / Poncho
- Hand warmers (cold weather trips)

---

## Vacation Template (starter content)

When creating a new project with "Vacation" template:
- **Trip Info**: empty, ready to fill
- **People**: empty list
- **Bookings**: empty, booking types initialized to defaults
- **To-Do**: starter items — "Book flights", "Book hotel", "Book car rental", "Verify reservations", "Pack"
- **Itinerary**: auto-generated from dates if provided, else empty
- **Packing List**: pre-populated with all default items above
- **Notes**: empty

---

### Firestore Structure: Subcollections

**Collection**: `lifeProjects` (user-scoped via `userCol()`)

**Project doc** — metadata only, no heavy content:
```
{
  title, description,
  template,                     // 'vacation'|'build'|'general' — LOCKED after creation
  status: planning|active|on-hold|done,
  mode: planning|travel,
  archived: false,
  startDate, endDate,
  targetType: 'life',           // future: 'zone', 'room', 'vehicle', etc.
  targetId: null,                // future: the entity's doc ID
  people: [{ name, contactId, notes }],
  bookingTypes: ['Lodging', 'Flight', 'Car Rental', 'Excursion', 'Sports Event'],
  createdAt, updatedAt
}
```

**Subcollections under each project doc:**

`days` — one doc per day:
```
{
  date,                          // ISO date string "2024-09-20"
  label,                         // "Day 1 — Fri Sept 20"
  location,                      // "Yellowstone"
  sortOrder,                     // integer for reordering
  items: [{                      // embedded array
    id,                          // unique ID within the array
    title,
    time,                        // free text: "8:30am"
    status: confirmed|maybe|idea|nope,
    cost,                        // number (nullable)
    costNote,                    // free text: "each", "for 2"
    notes,                       // multi-line free text
    links: [{ url, label }],
    confirmation,                // text
    contact,                     // text (phone, email)
    duration,                    // free text: "4.25 hours"
    bookingRef,                  // booking doc ID (shows badge)
    sortOrder,                   // integer for ordering
    showOnCalendar               // boolean
  }]
}
```

`bookings` — one doc per booking:
```
{
  name,                          // "Canyon Lodge"
  type,                          // from bookingTypes list
  startDate,                     // ISO date string (always captured)
  multiDay: false,               // boolean toggle
  endDate,                       // ISO date string (only if multiDay)
  startTime,                     // free text: "3:00 PM"
  endTime,                       // free text: "5:30 PM"
  confirmation,                  // text
  cost,                          // number (nullable)
  costNote,                      // "each", "total", "deposit", etc.
  paymentStatus: paid|deposit|balance-owed,
  contact,                       // phone, email
  address,                       // physical address
  link,                          // booking page URL
  notes,                         // free text
  sortOrder
}
```

`bookingPhotos` — screenshots (separate for doc size):
```
{
  bookingId,                     // references booking doc
  imageData,                     // Base64 string (compressed, 100-200KB)
  caption,
  createdAt
}
```

`todoItems` — pre-trip checklist:
```
{
  text,
  done: boolean,
  notes,                         // optional — can contain URLs, details
  sortOrder
}
```

`packingItems` — packing list:
```
{
  text,
  done: boolean,
  notes,                         // optional clarification
  category,                      // "Clothes", "Electronics", etc.
  sortOrder                      // within category
}
```

`projectNotes` — journal entries:
```
{
  title,                         // heading
  text,                          // note content
  createdAt,                     // timestamp — displayed, sorted newest first
  sortOrder                      // for manual reorder
}
```

**Photos on day items**: stored in existing app-wide `photos` collection using `targetType: 'dayItem'`, `targetId: '{dayDocId}_{itemId}'`.

**Photos on bookings**: stored in `bookingPhotos` subcollection under the project, linked by `bookingId`.

---

## Rename: "Projects" → "Quick Task List"

- All UI labels, button text, section headings, page titles that say "Projects" or "Future Projects" → "Quick Task List"
- Firestore collection name `projects` stays the same — no data migration
- New projects system uses different collection name (`lifeProjects`) — no conflict
- Must update the functional spec (`MyLife-Functional-Spec.md`) with the rename and the new Projects system

---

## Delete Behavior

**All deletions require confirmation prompt.** Cascading:

| Delete target | What gets cascade-deleted |
|---|---|
| Project | All subcollections: days, bookings, bookingPhotos, todoItems, packingItems, projectNotes, plus any photos in the app-wide photos collection targeting this project's items |
| Day | The day doc + any photos targeting its items |
| Item (in a day) | Remove from items array + any photos targeting it |
| Booking | The booking doc + its bookingPhotos + remove bookingRef from any day items that reference it |
| Todo item | The doc |
| Packing item | The doc |
| Note | The doc |

---

## Phases to Implement (later)

These are noted and will be built as a final polish phase:

- [ ] **Drag-and-drop reorder** for items within a day (up/down arrows as fallback)
- [ ] **Move items between days** — day dropdown on the item for quick reassignment
- [ ] **All delete flows** with confirmation + cascade
- [ ] **Booking type management** — manage page linked from project list
- [ ] **Calendar integration** — `showOnCalendar` flag on items
- [ ] **Search** — generic text box, shows all matching targets and sub-targets

---

## Implementation Phases

### Phase 1: Rename + Scaffolding
- Rename all "Projects" / "Future Projects" UI labels → "Quick Task List" across the entire app (headings, buttons, empty states, page titles)
- Do NOT rename Firestore collection or JS variable names — just user-facing strings
- Add "Projects" card to the Life home screen (navigates to new project list page)
- Create empty project list page (`#life-projects`) with back button, title, and "+ New Project" button (no functionality yet)
- Create new JS file: `js/life-projects.js`
- Add route in `app.js`
- Update functional spec and bump versions

### Phase 2: Project CRUD + List
- Create New Project flow: template picker (Vacation only for now, others disabled/grayed), title, description, dates
- Template type locked after creation
- Save to Firestore `lifeProjects` collection via `userCol()`
- Project list page: render project cards (title, dates, status badge, template icon, description)
- Tap card → navigate to project detail page (empty shell for now)
- Edit project metadata (title, description, dates, status)
- Archive project + "Show archived" toggle on list page
- Delete project with confirmation (cascade subcollections — build the cascade delete utility now)

### Phase 3: Project Detail Page — Accordion Shell + Trip Info + People
- Build scrollable accordion component (collapsible sections with summary counts)
- Trip Info section: display/edit dates, description, map link field, general reference notes
- People section: add/edit/remove people (name, contactId picker from Contacts, notes)
- Planning/Travel mode toggle in header (just stores the mode for now, filtering comes later)

### Phase 4: To-Do Section
- To-Do accordion section with checklist
- Add/edit/delete todo items (text, notes with URL support, done checkbox)
- Vacation template auto-populates starter items on project creation
- Sortable (sortOrder field)

### Phase 5: Itinerary — Days + Items (Core)
- Day auto-generation when dates are set (prompt for pre/post days)
- "+ Add Day" button for manual day creation
- Day cards in accordion: date, label, location (editable)
- Add items to a day — inline editing: title + status always visible, optional fields expand below (time, cost, costNote, duration, notes, confirmation, contact, links)
- Item status badges with colors (confirmed/maybe/idea/nope)
- Delete day (with confirmation), delete item (with confirmation)

### Phase 6: Bookings
- Bookings accordion section
- Add/edit/delete bookings: name, type dropdown (with "Add new..." at bottom), startDate, multiDay toggle + endDate, startTime, endTime, confirmation, cost, costNote, paymentStatus, contact, address, link, notes
- Default booking types populated on first project creation
- Booking screenshots: capture/upload photos into `bookingPhotos` subcollection, view gallery
- Booking badge on day items: when item has `bookingRef`, show icon + name badge that scrolls to the booking

### Phase 7: Packing List
- Dedicated modal (button on project detail page opens it)
- Items grouped by category with category headers
- Add/edit/delete packing items (text, notes, category dropdown, done checkbox)
- Vacation template pre-populates all default starter items
- Check/uncheck items (packed indicator)
- Accordion summary shows "12/38 packed"

### Phase 8: Notes (Journal)
- Notes accordion section
- Add/edit/delete journal entries (title, text, createdAt auto-set)
- Display newest first
- Sortable

### Phase 9: Cost Rollup
- Calculate total from all booking costs + all day item costs (numeric fields only)
- Display in Trip Info section: "Total Trip Cost: $X,XXX"
- Auto-updates as costs are added/changed

### Phase 10: Planning vs. Travel Mode
- Toggle in project header switches mode
- Planning mode: show all items regardless of status
- Travel mode: hide `maybe`, `idea`, `nope` items; hide costs; hide research links; collapse notes; hide To-Do section; make confirmations and contact info prominent; booking screenshots front-and-center
- Accordion auto-expand/collapse behavior per mode

### Phase 11: Polish — Reorder, Move, UX
- Drag-and-drop reorder for items within a day (up/down arrows as fallback)
- Move items between days — day dropdown on the item
- Reorder days (drag or up/down)
- Booking type management page (linked from project list)
- Photos on day items (using existing photos collection with composite targetType/targetId)

### Phase 12: Calendar Integration + Search
- `showOnCalendar` checkbox on day items
- Items with flag appear on the app's main calendar view
- Generic search text box on project detail — matches across all sections and sub-items

### Phase 13: Final Cleanup
- Full functional spec update for the entire Projects system
- Responsive testing on mobile
- Edge cases: empty states, long text handling, many days/items performance
- Verify all delete cascades work correctly

---

## Testing Plan

### T1: Project List Page
- T1.1: Navigate to `#life-projects` — page loads with heading "Projects" and "+ New Project" button
- T1.2: Empty state shows "No projects yet" message
- T1.3: Create a new Vacation project ("Test Vacation") with title, description, start/end dates
- T1.4: Project card appears on list with correct title, date range, status badge, template icon
- T1.5: "Show archived" checkbox — toggle on/off filters archived projects
- T1.6: Edit project metadata (title, description, dates, status) via ✏️ button on card
- T1.7: Verify edited fields persist after page reload

### T2: Project Detail — Accordion Layout
- T2.1: Click project card → navigates to detail page with correct title and date range
- T2.2: All 7 accordion sections present: Trip Info, People, To-Do, Itinerary, Bookings, Packing, Notes
- T2.3: Trip Info auto-expanded, others collapsed
- T2.4: Click accordion header → toggles open/close with arrow rotation
- T2.5: Lazy loading — section content loads on first expand
- T2.6: Search box present at top of detail page

### T3: Trip Info & Cost Rollup
- T3.1: Trip Info shows date range and description
- T3.2: Cost rollup shows $0 or hidden when no costs exist
- T3.3: After adding bookings/items with costs, Trip Info cost rollup updates correctly

### T4: People
- T4.1: Add a person (name + notes)
- T4.2: Person appears in list
- T4.3: Edit person name/notes
- T4.4: Remove person (confirm dialog)
- T4.5: People summary in accordion header updates count

### T5: To-Do List
- T5.1: Vacation template pre-populates ~10 starter to-do items
- T5.2: Toggle done checkbox on a to-do item
- T5.3: Add new to-do item
- T5.4: Edit to-do text and notes
- T5.5: Delete a to-do item (confirm dialog)
- T5.6: Accordion summary shows done/total count (e.g., "2/11")
- T5.7: Drag-and-drop reorder (SortableJS)

### T6: Itinerary — Days
- T6.1: Auto-generate days from project date range (button visible when no days exist)
- T6.2: Correct number of days generated matching date range
- T6.3: Add a day manually (label, date, location)
- T6.4: Edit day label/date/location
- T6.5: Delete a day (confirm dialog — also deletes embedded items)
- T6.6: Drag-and-drop reorder days

### T7: Itinerary — Items
- T7.1: Add item to a day (title, status, time, cost, notes)
- T7.2: Item appears in day card with correct status badge color
- T7.3: Edit item — all fields editable (title, status, time, duration, cost, costNote, confirmation, contact, notes, links)
- T7.4: Delete item (confirm dialog)
- T7.5: Move item to a different day via edit dialog
- T7.6: Item detail panel expands/collapses on click
- T7.7: showOnCalendar toggle — 📅 icon appears on item row when enabled
- T7.8: Booking link — select a booking in edit, badge appears and scrolls to booking card on click
- T7.9: Drag-and-drop reorder items within a day

### T8: Bookings
- T8.1: Add booking via modal (name, type, dates, times, confirmation #, cost, payment status, notes)
- T8.2: Booking card appears with correct fields displayed
- T8.3: Edit booking — all fields update
- T8.4: Add new booking type via "Add new..." dropdown option
- T8.5: Upload screenshot to booking → image appears in gallery
- T8.6: Delete screenshot from booking
- T8.7: Delete booking (confirm dialog)
- T8.8: Drag-and-drop reorder bookings
- T8.9: Booking badge on day item scrolls to correct booking card

### T9: Packing List
- T9.1: "Populate Default List" button appears on empty packing section
- T9.2: Click populate — ~47 default items appear grouped by category
- T9.3: Toggle packed checkbox on items
- T9.4: Add new packing item (name, category)
- T9.5: Edit packing item
- T9.6: Delete packing item
- T9.7: Accordion summary shows packed/total count
- T9.8: Category headers show per-category packed counts

### T10: Notes
- T10.1: Add a note (title, text)
- T10.2: Note card appears with title, text, and timestamp
- T10.3: Edit note title/text
- T10.4: Delete note (confirm dialog)
- T10.5: Notes displayed newest-first
- T10.6: Accordion summary shows note count

### T11: Planning/Travel Mode
- T11.1: Mode toggle button shows current mode ("📝 Planning" or "✈️ Travel")
- T11.2: Switch to Travel mode — To-Do and Notes sections hidden
- T11.3: Travel mode — maybe/idea/nope items hidden from itinerary
- T11.4: Travel mode — Itinerary and Bookings auto-expanded
- T11.5: Switch back to Planning — all sections and items visible again

### T12: Search
- T12.1: Type in search box — matching day cards stay visible, non-matching hidden
- T12.2: Search filters bookings, to-dos, packing items, notes
- T12.3: Clear search — all items reappear
- T12.4: Packing groups hide when all items in group are filtered out

### T13: Delete Cascade
- T13.1: Create a project with data in every section (days, items, bookings, screenshots, todos, packing, notes, people)
- T13.2: Delete the project from list page (confirm dialog)
- T13.3: Project removed from list
- T13.4: Verify no orphaned subcollection documents remain

### T14: Archive
- T14.1: Archive a project — disappears from default list
- T14.2: Check "Show archived" — archived project appears with archive badge
- T14.3: Unarchive — project returns to default list

### T15: Edge Cases
- T15.1: Long title/description text wraps properly on project card and detail page
- T15.2: Empty sections show appropriate empty state messages
- T15.3: Project with no dates — Trip Info handles gracefully
- T15.4: Responsive — detail page usable at mobile width (375px)
