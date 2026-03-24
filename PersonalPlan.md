# PersonalPlan.md — "Life" Feature Planning Document

> **Status: PLANNING IN PROGRESS — No implementation started**
> This is a living document. Features will be added, refined, or dropped over time.

---

## Overview

A new top-level section called **"Life"** accessible from the home screen.
Think of it as a **second brain** — a place to capture personal thoughts, plans, memories,
and information that doesn't fit into the yard/house/vehicle tracking side of the app.

This section will grow organically over months or years as new needs are identified.

---

## Navigation

- Home screen gets a new **"Life"** tile alongside Yard, House, Garage, Vehicles
- The Life page shows a grid of feature buttons (same style as the home screen tiles)
- Each button navigates to a specific Life feature
- No nav bar context — navigate back via the app home

---

## Features — Planned

| Feature | Status |
|---------|--------|
| Journal | Designing |
| *(more to be added)* | Future |

---

## Feature: Journal

### Purpose
A personal journal. Write entries, reflect on days, capture thoughts.
Entries are tied to a date but multiple entries per day are allowed.

---

### Entry Fields

| Field | Details |
|-------|---------|
| `date` | Date of the entry (YYYY-MM-DD). Defaults to today but user can change it to any past or future date. |
| `entryText` | Free-form text. Could be a sentence or a multi-paragraph essay. |
| `createdAt` | Server timestamp — when the entry was actually created in the system. |
| `updatedAt` | Server timestamp — last edit time. |

> **Note:** `date` and `createdAt` are separate. The user picks the date the entry *belongs to*.
> `createdAt` is automatic and reflects when it was physically typed/saved.

---

### Adding an Entry

- **"New Entry"** button on the Journal page
- Opens a **full-page form** (not a modal — needs room for writing) with:
  - **Date picker** — defaults to today, user can change to any date
  - **Large text area** — for the entry body (native spell check enabled via `spellcheck="true"`)
  - **Voice-to-Text button** — microphone icon next to the text area
  - **Save / Cancel** buttons

---

### Voice to Text

- Uses the **browser's built-in Web Speech API** (SpeechRecognition)
- **Free, no external service needed**
- Works on: desktop Chrome, Android Chrome
- Does NOT work on: iOS Safari — acceptable since user is on Android
- Behavior: click mic button → browser listens → transcribed text appended to the text area
- User can edit the transcribed text before saving

---

### Spell Check

- **Native browser spell check** via `spellcheck="true"` on the textarea
- Red underlines on misspelled words, right-click for suggestions
- Zero code required, zero cost
- Decided: this is sufficient, no advanced AI spell check needed

---

### Editing an Entry

- Each entry has an **Edit** button
- Edit opens the same form pre-filled with current date and text
- User can change **both the date and the text**
- Saving updates `entryText`, `date`, and `updatedAt`

---

### Deleting an Entry

- Each entry has a **Delete** button with a confirmation prompt
- Deletes only that single entry
- No "delete entire day" option

---

### Display Layout

Journal entries and tracking items are **merged into a single chronological stream** under each date.
Both types are sorted by time so you see the full picture of a day in order.

```
March 24, 2026                               ← newest date at top
  7:02 AM  ⚖️  Weight: 183                   ← tracking item
  7:15 AM  📝  Woke up feeling great...      ← journal entry
  8:00 AM  🍳  Breakfast: eggs and toast     ← tracking item
 10:30 AM  🍎  Snack: apple                  ← tracking item
 12:15 PM  🥗  Lunch: salad                  ← tracking item
  3:00 PM  🍪  Snack: handful of cookies     ← tracking item (same category, different time)
  9:45 PM  📝  Long day but productive...    ← journal entry

March 22, 2026
  ...
```

- Grouped by **date**
- **Newest date at the top**
- Within each date: **chronological order oldest-to-newest** (both entries and tracking items)
- Journal entries show Edit / Delete buttons
- Tracking items show Edit / Delete buttons
- Each item shows its **time** (from `createdAt` timestamp)

---

### Date Range Filter

- **Dropdown** at the top of the Journal page controlling how much data is loaded
- Options:
  - Last 7 days *(default)*
  - Last 30 days
  - Last 60 days
  - Last 90 days
  - Custom date range *(shows a from/to date picker)*
- Selection is **sticky** — saved to `userCol('settings').doc('journal')` field `defaultDateRange`
- On page load, the saved preference is restored automatically
- Entries and tracking items outside the selected range are simply not loaded

---

### Search

- **Deferred** — will be designed in a future conversation
- Not part of the initial build

---

### Go to Date

- **"Go to Date"** date picker input on the Journal page
- User picks a date → page jumps/scrolls to that date group
- If no entries exist for that date: shows a **"No entries for [date]"** message

---

### Firestore Collection: `journalEntries`

| Field | Type | Notes |
|-------|------|-------|
| `date` | string | YYYY-MM-DD — the date the entry belongs to (user-chosen) |
| `entryText` | string | Full entry body |
| `createdAt` | timestamp | When the entry was first saved |
| `updatedAt` | timestamp | Last edit (null if never edited) |

Query pattern: `userCol('journalEntries').orderBy('date', 'desc').orderBy('createdAt', 'asc')`
(newest date first, oldest entry within each date first)

> **Firestore note:** This orderBy combination will require a composite index.

---

## Tracking Items

### Purpose
Structured daily data points attached to a **date** (not to a specific journal entry).
Used for things like weight, meals, water intake, sleep times, mood — anything the user
wants to log and later review by category over time.

Tracking items and journal entries are **displayed together** in one chronological stream
per date, interspersed by time.

---

### Adding Tracking Items

- Separate **"Add Tracking"** button on the Journal page (alongside "New Entry")
- Opens a form with:
  - **Date picker** — defaults to today, user can change
  - **Multi-row input area** — user can add as many rows as they want before saving
  - Each row: **Category** (dropdown of saved categories + "New…" option) + **Value** (free-form text)
  - **Add Row** button to keep adding more items on the same screen
  - **Save All / Cancel** buttons — saves all rows at once as individual Firestore docs

Example of one Add Tracking session:
```
Date: March 24, 2026
Row 1:  Category [Weight       ▼]   Value [183         ]
Row 2:  Category [Breakfast    ▼]   Value [eggs, toast  ]
Row 3:  Category [Water        ▼]   Value [32 oz        ]
Row 4:  Category [New...       ▼]   Value [good         ]  ← creates "Mood" category
                                                              and saves it for future use
[+ Add Row]                              [Cancel]  [Save All]
```

---

### Categories

- User-defined, saved to Firestore for reuse on future days
- Created at runtime: if user types a new category name in the "New…" option, it is saved
- Displayed as a **dropdown** in the tracking form, alphabetically sorted
- Add / rename / delete categories from a **Manage Categories** screen (accessible from the Journal page)
- Examples: Weight, Breakfast, Lunch, Dinner, Snack, Water, Mood, Wake Time, Bed Time, Exercise

---

### Editing a Tracking Item

- Each tracking item in the daily stream has an **Edit** button
- Edit opens a simple single-row form: date, category, value
- Can change date, category, or value
- Saves with updated `updatedAt`

---

### Deleting a Tracking Item

- Each tracking item has a **Delete** button with confirmation
- Deletes that single item only

---

### Viewing by Category (Deferred)

- "Show me all Weight entries over the last month" — simple list view (date + value)
- Design of the filter/report screen is **deferred to a future conversation**

---

### Firestore Collections: Tracking

**`journalTrackingItems`**

| Field | Type | Notes |
|-------|------|-------|
| `date` | string | YYYY-MM-DD — the date this item belongs to |
| `category` | string | e.g. "Weight", "Breakfast", "Mood" |
| `value` | string | Free-form text — e.g. "183", "eggs and toast", "good" |
| `createdAt` | timestamp | When the item was saved — used for time display and sort order |
| `updatedAt` | timestamp | Last edit (null if never edited) |

**`journalCategories`**

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Category name — e.g. "Weight", "Mood" |
| `createdAt` | timestamp | When the category was first created |

---

### Display: Merged Stream

Both `journalEntries` and `journalTrackingItems` are loaded for each date and merged
client-side into one list sorted by `createdAt` time. Each item renders differently:

- **Journal entry**: text block with Edit / Delete
- **Tracking item**: category label + value badge with Edit / Delete

The merged sort uses `createdAt` on both types, so everything lines up naturally by when it was recorded.

---

### Open / Deferred Decisions for Journal

- **Search** — full-text search across entries and/or tracking items — deferred to future conversation
- **Category filter / history view** — "show me Weight over the last month" — deferred to future conversation
- **Rich text** (bold, lists, etc.) vs plain text — TBD
- **Export** — ability to export journal to PDF or text file — mentioned as a future possibility
- **Photos on journal entries** — not discussed yet

---

## Things We Decided NOT to Do (Journal)

- ~~Full-day delete~~ — per-entry delete only
- ~~Advanced AI spell check~~ — native browser spell check is sufficient
- ~~iOS voice-to-text support~~ — user is on Android; browser Speech API is acceptable

---

## Future Life Features (Not Yet Designed)

These will be added to this document as conversations happen:

- *(none defined yet)*

---

### Firestore: Composite Index Required

The journal requires sorting by `date` (desc) + `createdAt` (asc) simultaneously.
Firestore needs a manually created composite index for this.

After the feature is deployed, Firebase will log an error with a **direct link** to create
the index in one click. The developer will be walked through this step at build time.

Also needed for `journalTrackingItems`: same `date` desc + `createdAt` asc index.

---

*Last updated: 2026-03-24 — all decisions finalized, ready to build*
