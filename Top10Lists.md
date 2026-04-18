# Thoughts Section — Feature Plan

## Overview
A new top-level section called "Thoughts" added to the main page alongside Life/House/Yard.
Designed to hold personal ideas and lists. First feature: Top 10 Lists.

---

## Section: Thoughts (main page card)
- Main page becomes a **2×2 grid**: Life | House | Yard | Thoughts
- Thoughts card navigates to `#thoughts`
- Will host multiple idea/list features over time (Top 10 Lists is first)

---

## Page: Thoughts (`#thoughts`)
- Shows a grid of cards (like Life page)
- First card: **Top 10 Lists (x)** — x = count of created lists
- Breadcrumb: Home → Thoughts
- Thoughts gets its **own nav bar context** (no nav links for now — just the bar)
- Future: "Thoughts Settings" page likely as features grow

---

## Page: Top 10 Lists (`#top10lists`)
- Breadcrumb: Home → Thoughts → Top 10 Lists
- Header: "Top 10 Lists" + "+ New Top 10 List" button
- **Sort control:** dropdown + "Sort" button
  - Options: Newest First | Oldest First | A–Z | By Category
  - Default: Newest First
  - **Sticky:** saved to `userCol('settings').doc('thoughts')` → field `top10SortPref`
  - Persists across all browsers/devices for the logged-in user

### Flat mode (Newest / Oldest / A–Z):
- Flat accordion of all lists
- **Collapsed:** list name + category badge (gray "None" if no category)
- **Expanded:**
  - Category badge
  - Description (below name, above ranked items)
  - Top 10 items (ranks 1–10, read-only)
  - **Edit** button

### Nested mode (By Category):
- **Outer accordion** = each category; **collapsed by default**
- Outer collapsed: category name + count of lists (e.g., "Movies (3)")
- Outer expanded: shows inner list accordions
- **"None" group** (uncategorized lists) appears at the **top**
- Inner accordion: same collapsed/expanded behavior as flat mode

### Return from create/edit:
- The list that was just saved is **auto-expanded** in the accordion
- In By Category mode: the outer category accordion is also auto-expanded so the list is visible

- Footer: **"Manage Categories"** text link → inline panel expands below

---

## Manage Categories (inline panel on `#top10lists`)
- Triggered by "Manage Categories" footer link
- Expands an inline panel (no modal, no page nav)
- Editable inline list:
  - Each row: category name (click to edit inline) + Delete button
  - Add new: text input + Save (or Enter)
- **Delete:** confirm dialog; affected lists have category cleared to null (shows "None" badge)
- Seed on first run (detected via `categoriesSeeded` flag in settings doc): Books, Movies, Music

---

## Page: Create / Edit Top 10 List (`#top10list-create` / `#top10list-edit/id`)
- Breadcrumb: Home → Thoughts → Top 10 Lists → New List (or list name)
- **Fields:**
  - Name (text input, required)
  - Category (combo/select):
    - Default: "None"
    - Options: None | Books | Movies | Music | … | **+ Add New**
    - Selecting "+ Add New": text field appears → type name → Enter or blur saves immediately to Firestore
  - Description (textarea, optional)
- **The List — 20 ranked slots (always visible, max 20):**
  - **Drag-and-drop reorderable** via SortableJS (works on touch/mobile)
  - Each item: rank number (auto from position) + title text input
  - **Note icon** per row:
    - **Gray** = no notes saved
    - **Green** = notes exist
    - Click → expands an inline textarea **below that row** (multi-line)
    - **Save button** closes and saves the note (shown always — works on desktop and mobile)
    - **Escape** cancels without saving
  - Visual **"Runners Up" separator** between slot 10 and slot 11 (positional — always between index 9 and 10; items can be dragged across it freely)
  - Empty slots are OK; title can be blank
- **Delete List** button (with confirm dialog) — edit mode only; returns to `#top10lists`
- **Save / Cancel** → returns to `#top10lists`; saved list auto-expands in accordion

---

## Data Model (Firestore)

### Collection: `top10categories`
| Field     | Type      | Notes                   |
|-----------|-----------|-------------------------|
| name      | string    | e.g., "Books", "Movies" |
| createdAt | timestamp |                         |

**Seed on first run** (guarded by `categoriesSeeded` flag): Books, Movies, Music

### Collection: `top10lists`
| Field       | Type      | Notes                            |
|-------------|-----------|----------------------------------|
| title       | string    | List name (required)             |
| categoryId  | string    | FK → top10categories, or null    |
| description | string    | Optional                         |
| items       | array     | Ordered array of 20 item objects |
| createdAt   | timestamp |                                  |
| updatedAt   | timestamp |                                  |

### Item object (always 20 elements in `items` array):
| Field | Type   | Notes                             |
|-------|--------|-----------------------------------|
| title | string | Item name (blank = empty slot)    |
| notes | string | Optional multi-line notes         |

Rank = array index + 1. Not stored.

### User Settings (Firestore):
- `userCol('settings').doc('thoughts')` → `{ top10SortPref: 'newest'|'oldest'|'az'|'category', categoriesSeeded: true }`

---

## Routing
- `thoughts` → `TOP_LEVEL_PAGES` + new `THOUGHTS_PAGES` array
- `top10lists`, `top10list-create`, `top10list-edit` → `ALL_PAGES`
- New `THOUGHTS_PAGES` in app.js (like `LIFE_PAGES`, `HOUSE_PAGES`)

---

## Files to Create / Modify
| File | Change |
|------|--------|
| `js/thoughts.js` | Thoughts landing page |
| `js/top10lists.js` | Accordion (flat + nested), sort, create/edit, inline category manager, SortableJS drag |
| `index.html` | New page sections + script tags |
| `css/styles.css` | 2×2 grid, nested accordion, drag handle, separator, note icon states (gray/green) |
| `js/app.js` | Routing + THOUGHTS_PAGES context |
| `MyLife-Functional-Spec.md` | Spec update required |

---

## Tasks
- [ ] Add Thoughts card to main page (2×2 grid)
- [ ] Build Thoughts nav context in app.js
- [ ] Build `#thoughts` landing page
- [ ] Build `#top10lists` (sort control, flat + nested accordion, return-expanded behavior)
- [ ] Build `#top10list-create` / `#top10list-edit` (SortableJS, note icons gray/green, Save button, separator)
- [ ] Build inline Manage Categories panel + seeding logic
- [ ] Wire up Firestore CRUD (top10lists + top10categories + settings/thoughts)
- [ ] Update `MyLife-Functional-Spec.md`

---

## Phases to Implement

### Phase 1 — Foundation
Establish the Thoughts section as a navigable destination before building any features inside it.
- Add Thoughts card to the main page (2×2 grid alongside Life / House / Yard)
- Add `THOUGHTS_PAGES` context array to `app.js`; register `thoughts` in `TOP_LEVEL_PAGES`
- Wire Thoughts nav bar (no links yet — just the context)
- Build `#thoughts` landing page with a single "Top 10 Lists (0)" card
- Breadcrumbs: Home → Thoughts
- New files: `js/thoughts.js`; new section in `index.html`

### Phase 2 — Top 10 Lists Page (flat accordion)
Build the list-browsing experience for the three non-category sort modes.
- Register `top10lists` route in `ALL_PAGES`; breadcrumb: Home → Thoughts → Top 10 Lists
- Sort control: dropdown (Newest First / Oldest First / A–Z / By Category) + Sort button
- Render flat accordion from Firestore `top10lists` collection
  - Collapsed: list name + category badge ("None" if null)
  - Expanded: category badge, description, top 10 items (ranks 1–10, read-only), Edit button
- Empty state: "No lists yet — create your first one"
- "+ New Top 10 List" button navigates to `#top10list-create`
- Edit button navigates to `#top10list-edit/id`
- New file: `js/top10lists.js`

### Phase 3 — Create / Edit Page
Build the full list authoring experience.
- Register `top10list-create` and `top10list-edit` routes; breadcrumbs wired
- Fields: Name (required), Description
- 20 ranked slots — always visible, max 20, no adding beyond
- SortableJS drag-and-drop (reuse existing CDN load); drag handle per row
- "Runners Up" visual separator fixed between slots 10 and 11
- Note icon per row: gray (no notes) / green (notes exist)
  - Click → inline textarea expands below the row (multi-line)
  - Save button closes and saves; Escape cancels
- Save → writes to Firestore, returns to `#top10lists` with that list auto-expanded
- Cancel → returns to `#top10lists` (no save)
- Delete button (edit mode only) → confirm dialog → deletes from Firestore → returns to `#top10lists`
- Validation: block Save if Name is empty

### Phase 4 — Categories
Add category assignment to lists and the category management panel.
- Seed Books / Movies / Music on first run (guarded by `categoriesSeeded` flag in settings doc)
- Category combo on create/edit page:
  - Options: None | [all categories] | + Add New
  - "+ Add New": inline text field → Enter/blur saves new category to Firestore immediately
  - Default: None
- Category badge renders correctly on accordion (gray "None" if null)
- "Manage Categories" footer link on `#top10lists` → inline panel expands below list
  - Inline editable list: click name to edit, Delete button per row
  - Add new row at bottom
  - Delete: confirm dialog; affected lists cleared to null (show "None")

### Phase 5 — Nested (By Category) Accordion Mode
Add the nested accordion view when sort = "By Category".
- Outer accordion = each category (collapsed by default)
  - Collapsed: category name + list count (e.g., "Movies (3)")
  - Expanded: inner list accordions (same as flat mode)
- "None" group (uncategorized) rendered at the top
- On return from create/edit: auto-expand the correct outer category accordion AND the inner list accordion

### Phase 6 — Sort Persistence
Make the sort preference sticky across all devices.
- On Sort button press: save `top10SortPref` to `userCol('settings').doc('thoughts')`
- On page load: read setting and apply before rendering
- Fall back to "Newest First" if no setting exists yet

### Phase 7 — Polish & Spec
Final pass before shipping.
- Mobile testing: verify drag-and-drop, note Save button, accordion touch interactions at 375px
- Version bump: increment `?v=N` on all script tags and CSS link in `index.html`
- Update `MyLife-Functional-Spec.md` with Thoughts section, Top 10 Lists, all pages and data model
- Smoke test full flow: create list → assign category → reorder items → add notes → save → edit → delete
