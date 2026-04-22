# My Views — Feature Plan

## Overview
A new section under the **Thoughts** landing page that lets the user record and maintain their personal viewpoints on any subject. Views are meant to evolve over time — the user can deliberately trigger "I've Changed My View" to archive the old stance, or just edit/expand the current one at any time without creating history.

---

## Core Concepts

### View
A named topic the user has an opinion on. Examples:
- "What is wrong with politics today"
- "My stance on abortion"
- "What I believe about raising kids"
- "My take on social media"

Each View is assigned to a **major category** (required before writing) and a **subcategory** (defaults to "General"). Views with no major category are "Uncategorized."

### Viewpoint (the content of a View)
Each viewpoint has three parts:
1. **Title** — the topic name (e.g., "Abortion") — required
2. **Short version** — a brief summary of the stance; 500 character cap; optional; used in list cards and search
3. **Long version** — the full, detailed viewpoint text; no length limit; auto-saves on blur

**Title behavior**: Editing the title updates it globally — current view and all historical entries use the same title. Never versioned.

**Short + Long version behavior**: Editing in place does NOT create a history entry. History is only created via "I've Changed My View."

**`currentDate`**: Set at creation and each time "I've Changed My View" is saved. NOT updated on regular edits.

---

## Category System (Two-Level)

### Major Categories (Level 1)
Top-level groupings. Seeded list — user can add/edit/delete/reorder on the Maintenance page.

| Major Category |
|---|
| Politics & Society |
| Personal Beliefs |
| Life & Family |
| Practical |
| Other |

### Subcategories (Level 2)
Each major category has subcategories. "General" is always first and is auto-created with every major category. It is the default subcategory and cannot be deleted (only renamed).

| Major Category | Subcategories (General always first) |
|---|---|
| Politics & Society | General, Politics, Government, Culture, Society, Media |
| Personal Beliefs | General, Religion / Faith, Ethics & Morality, Philosophy |
| Life & Family | General, Parenting, Relationships, Marriage, Family |
| Practical | General, Finance & Money, Health & Medicine, Education, Career & Work, Technology |
| Other | General, Environment, Sports, Food & Lifestyle |

A view is assigned to exactly one subcategory. Views with no major category appear in **Uncategorized** at the bottom of the list.

---

## Pages & Navigation

| Route | Description |
|---|---|
| `#views` | Views list — grouped by category accordion |
| `#view/{id}` | Detail page for a single View |
| `#view-history/{id}/{historyId}` | Read-only page for one historical viewpoint |
| `#views-categories` | Maintenance page — manage major categories and subcategories |

### Breadcrumbs
| Page | Breadcrumb |
|---|---|
| `#views` | Thoughts › My Views |
| `#view/{id}` | Thoughts › My Views › [Title] |
| `#view-history/{id}/{historyId}` | Thoughts › My Views › [Title] › [Date] |
| `#views-categories` | Thoughts › My Views › Manage Categories |

### Nav Bar (Thoughts Context)
Three links added to `thoughtsNav` (shown on all thoughts-context pages):
- **Top 10 Lists** → `#top10lists`
- **Memories** → `#memories`
- **My Views** → `#views`

---

## Views List Page (`#views`)

### Layout
- Header: "My Views" with a **+ New View** button
- **Search bar** — live filter as you type; searches title and short version only
- Default display: **all accordions collapsed**
- Footer: "Manage Categories" link → `#views-categories`

### Accordion Structure
```
▶ Politics & Society  (12)   ← collapsed by default
    ▶ General  (2)            ← always first; hidden if 0 views
    ▶ Politics  (5)
    ▶ Culture  (3)
    ▶ Government  (2)
▶ Personal Beliefs  (7)       ← collapsed
...
▶ Uncategorized  (2)          ← always last; hidden if 0 views
```

- Major category header: name + total view count across all subcategories
- Subcategory header: name + count of views in that subcategory
- Empty subcategories hidden (including General if it has 0 views)
- Empty major categories hidden
- "Uncategorized" always at bottom; hidden if empty

### Search Behavior
- When search is active: **expand all accordions that have matching results**; hide accordions with no matches
- Matching is against title and short version only
- Clearing search returns to all-collapsed default state
- "No results" empty state if nothing matches

### View Card (inside accordion)
- Topic title
- Short version text (if any)
- `currentDate` (creation date or last "I've Changed My View" date)
- "X previous views" badge if history count > 0

### Tile on Thoughts Landing
- Shows total count of all views (e.g., "My Views (12)")

---

## New View Creation Flow
1. Clicking **+ New View** navigates to a blank `#view/new` detail page
2. **Title** is focused and required
3. **Major category** must also be selected before the long version unlocks
4. When a major category is selected, subcategory auto-defaults to **General**
5. **Short version** is always editable — never gated
6. **Long version** is disabled until BOTH title is saved AND a major category is selected
7. Once both conditions are met, Firestore doc is created, URL transitions to `#view/{id}`, long version unlocks
8. `currentDate` is set to the creation timestamp

---

## View Detail Page (`#view/{id}`)

### Header
- Topic title — editable text input; saving updates title globally (all history included)
- Two dropdowns side by side:
  - **Major category** — selecting one auto-sets subcategory to General
  - **Subcategory** — defaults to General; disabled/hidden until a major category is selected
- Buttons: **"I've Changed My View"** | **Delete View**

### Breadcrumb
Thoughts › My Views › [Title]

### Current Viewpoint — always editable
1. **Short version** — text area with 500 character counter; manual Save button
2. **Long version** — large text area; auto-saves on blur; manual Save button

Saving does NOT create a history entry. `updatedAt` updates on every save; `currentDate` does not change.

### Links Section
- Multiple URLs attached to a View
- Each link: **URL** (required) + **Label** (optional display text)
- Displayed as clickable links (open in new tab)
- **+ Add Link** opens inline form row; clicking existing link opens it for inline editing
- Delete button per link (no confirmation needed — consistent with Memories)
- Links are NOT versioned — they apply to the view as a whole

### "I've Changed My View" Button — Rules
The button is **disabled** (grayed out) when either condition is true:
- The view was created today (`currentDate` date = today)
- The last "I've Changed My View" save was today (`currentDate` date = today)

In other words: you can only archive your view once per calendar day.

### "I've Changed My View" Flow (when enabled)
1. Modal opens pre-filled with current **short version** and **long version** (both editable)
2. Optional **"What prompted this change?"** text box
3. On Save:
   - OLD short + long archived to `history` subcollection with `archivedAt` timestamp
   - NEW text becomes current viewpoint; `currentDate` = today
   - `historyCount` increments
   - Category assignment and links are NOT archived

### Previous Views (history list)
- List of dates below the current viewpoint, newest first
- Clicking a date → `#view-history/{id}/{historyId}`
- Delete button per row (with confirmation); `historyCount` decrements on delete

### Historical Viewpoint Page (`#view-history/{id}/{historyId}`)
- Read-only
- Breadcrumb: Thoughts › My Views › [Title] › [Date]
- Shows: current (global) title, `archivedAt` date, short version, long version, "what prompted" note
- Back button → `#view/{id}`
- Delete button (with confirmation) → removes from Firestore, decrements `historyCount`, redirects to `#view/{id}`

---

## Category Maintenance Page (`#views-categories`)

Accessible via "Manage Categories" link at the bottom of the views list page.
Breadcrumb: Thoughts › My Views › Manage Categories

### Layout
- Header: "Manage Categories" + back link → `#views`
- **+ Add Major Category** button
- List of major categories, each:
  - Drag handle — HTML5 drag-and-drop to reorder
  - Name — editable inline
  - Delete button — blocked if any subcategory has views; shows warning
  - Expand to reveal its subcategories
- Within each major category:
  - **+ Add Subcategory** button
  - Each subcategory row:
    - Drag handle — reorder within this major category only
    - Name — editable inline
    - Delete button (General row has no delete button — protected)
  - "General" row always pinned first; drag handle hidden on General row

### Behavior
- **Add major category**: user types a name, saves → major category doc created in Firestore + "General" subcategory doc auto-created beneath it (`isDefault: true`, `order: 0`)
- **Rename**: updates `name` field on the doc; all views reference by ID so no view docs need touching
- **Reorder**: drag-and-drop updates `order` field; list page accordion order reflects this immediately
- **Delete subcategory with views**: warn "X views will be moved to General. Continue?" → set affected views' `subcategoryId` to that major category's General subcategory ID, then delete the subcategory doc
- **Delete major category**: blocked unless ALL subcategories (including General) have 0 views assigned; shows warning if not
- **General subcategory**: cannot be deleted; cannot be dragged; can be renamed

---

## Firestore Data Model

### Collection: `viewCategories`
| Field | Type | Description |
|---|---|---|
| `name` | string | Major category display name |
| `order` | number | Sort order on list and maintenance pages |
| `createdAt` | timestamp | |

### Subcollection: `viewCategories/{catId}/subcategories`
| Field | Type | Description |
|---|---|---|
| `name` | string | Subcategory display name |
| `order` | number | Sort order within major category (General always order=0) |
| `isDefault` | boolean | True for "General" — protected from deletion |
| `createdAt` | timestamp | |

### Collection: `views`
| Field | Type | Description |
|---|---|---|
| `title` | string | Topic name — global across all versions |
| `shortVersion` | string | Current brief summary (≤500 chars) |
| `longVersion` | string | Current full viewpoint text |
| `urls` | array | [{label, url}] — links attached to this view |
| `categoryId` | string | Major category doc ID (null = Uncategorized) |
| `subcategoryId` | string | Subcategory doc ID (null = Uncategorized) |
| `currentDate` | timestamp | Set at creation; updated on each "I've Changed My View" save |
| `updatedAt` | timestamp | Updated on every save of any field |
| `createdAt` | timestamp | When the view was first created |
| `historyCount` | number | Cached count of historical entries |

### Subcollection: `views/{viewId}/history`
| Field | Type | Description |
|---|---|---|
| `shortVersion` | string | Archived short version text |
| `longVersion` | string | Archived long version text |
| `archivedAt` | timestamp | When it was replaced |
| `prompt` | string | Optional: "What prompted this change?" |

> Note: title, category, and links are NOT stored in history — they are always current.

### Backup
Both `views` and `viewCategories` (with their subcollections) must be added to `BACKUP_DATA_COLLECTIONS` in the same commit as the feature goes live.

---

## Implementation Notes
- New file: `js/views.js` — all views logic
- New `<script src="js/views.js?v=N">` tag added to `index.html` (bump version on all script tags)
- New routes added to `app.js`: `#views`, `#view/`, `#view-history/`, `#views-categories`
- `thoughts.js` updated to count and display views tile
- `MyLife-Functional-Spec.md` updated in same commit as each phase

---

## Decisions Log

### A. Accordion default state — DECIDED
All collapsed by default. When search is active, expand all accordions with matching results.

### B. Category assignment UI — DECIDED
Two independent dropdowns on view detail page:
- Dropdown 1: Major category
- Dropdown 2: Subcategory — disabled until major category selected; auto-defaults to General when major category chosen

### C. Reordering on Maintenance page — DECIDED
HTML5 drag-and-drop. Applies to major categories and subcategories within each major category. General subcategory is pinned and not draggable.

### D. Deleting a subcategory with views — DECIDED
Warn: "X views will be moved to General. Continue?" → move affected views to General, then delete.

### E. "General" subcategory — DECIDED
- Auto-created with every major category (`isDefault: true`)
- Always first in its major category
- Hidden in the list accordion if 0 views (consistent with all other subcategories)
- Cannot be deleted; can be renamed
- Default subcategory whenever a major category is selected

### F. `currentDate` — DECIDED
Set at view creation. Updated only on "I've Changed My View" saves. Regular edits do not change it.

### G. "I've Changed My View" availability — DECIDED
Disabled when `currentDate` (date part only) equals today. Prevents multiple archives in one calendar day.

### H. Long version gate — DECIDED
Long version unlocks only when BOTH title is saved AND a major category is selected.

### I. Search — DECIDED
Searches title and short version only. Keeps accordion structure but expands matching categories; hides non-matching ones.

---

---

## Phases

---

### Phase 1 — Foundation
**Scope:** Firestore seed data, routing, nav, landing tile. No real UI yet — just wiring everything together so the skeleton exists.
- Seed `viewCategories` collection with 5 major categories + subcategories (including General per major)
- Add routes to `app.js`: `#views`, `#view/`, `#view-history/`, `#views-categories`
- Add "My Views" tile to Thoughts landing page (count shows 0)
- Add **Top 10 Lists**, **Memories**, **My Views** links to `thoughtsNav` (all thoughts-context pages)
- Create `js/views.js` stub + versioned `<script>` tag in `index.html`

**How to test:**
- Thoughts landing tile appears, shows 0
- All three nav links in thoughtsNav navigate correctly
- Routes `#views`, `#view/test`, `#views-categories` load without JS errors (blank pages are fine)

---

### Phase 2 — Views List Page
**Scope:** The `#views` accordion list, reading from Firestore. No view creation yet — manually seed 1–2 test view docs in Firestore to verify the layout.
- Accordion structure: major category → subcategory → view cards
- All accordions collapsed by default
- Empty subcategories and major categories hidden
- "Uncategorized" section at bottom (hidden if empty)
- View card: title, short version, currentDate, history count badge
- "Manage Categories" footer link (navigates to `#views-categories`, which can be a blank page)
- Breadcrumb: Thoughts › My Views

**How to test:**
- Manually add a view doc to Firestore → appears under correct category accordion
- Accordion expands/collapses on click
- Card shows correct fields
- Empty categories hidden; Uncategorized shows if categoryId is null

---

### Phase 3 — New View Creation + Detail Page (Display)
**Scope:** Create a new view and view its detail page. Editing is read-only display for now — saving comes in Phase 4.
- "+ New View" navigates to blank `#view/new`
- Title input focused; long version disabled
- Major category dropdown; subcategory disabled until major selected; auto-defaults to General
- Saving title + selecting major category → creates Firestore doc → transitions to `#view/{id}`; long version unlocks
- Detail page displays: title, category dropdowns (read current values), short version, long version, currentDate
- Breadcrumb: Thoughts › My Views › [Title]
- Back navigation to `#views`

**How to test:**
- Create a new view end-to-end: title → pick category → long version unlocks → view appears on list
- Long version remains disabled if only title saved but no category (or vice versa)
- Navigating to `#view/{id}` of existing view shows correct data

---

### Phase 4 — View Detail Editing & Saves
**Scope:** All field editing on the detail page. No history created yet.
- Title: editable, Save button, updates globally in Firestore
- Short version: editable text area, 500 character counter, Save button
- Long version: editable, auto-saves on blur, manual Save button
- Category dropdowns: selecting major auto-sets subcategory to General; changing either saves `categoryId` + `subcategoryId` to Firestore; view moves to new accordion on list
- `updatedAt` updates on every save; `currentDate` does NOT change
- No history entry created on any save

**How to test:**
- Edit each field, save, navigate away and back — data persists
- Character counter works; cannot exceed 500
- Auto-save fires on blur for long version
- Changing category moves view to correct accordion on list page
- `currentDate` unchanged after plain edits

---

### Phase 5 — Links Section
**Scope:** Add/edit/delete clickable URLs on the detail page. Same pattern as Memories.
- Links section below long version
- "+ Add Link" shows inline form: URL (required) + Label (optional)
- Saved links render as clickable text (open in new tab)
- Clicking an existing link opens it for inline editing
- Delete button removes immediately (no confirmation)
- Links saved as `urls: [{label, url}]` array on view doc

**How to test:**
- Add a link with label → appears clickable, opens correct URL
- Add a link without label → URL used as display text
- Edit an existing link → updates correctly
- Delete a link → disappears immediately
- Links persist across page navigation

---

### Phase 6 — "I've Changed My View" Modal
**Scope:** The archive flow — the core of the historical versioning feature.
- "I've Changed My View" button on detail page header
- Button disabled (grayed, tooltip) when `currentDate` date = today
- Modal opens pre-filled with current short + long version (both editable)
- Optional "What prompted this change?" text box
- On Save: archive old short + long to `views/{id}/history` subcollection with `archivedAt`; update `currentDate` to today; increment `historyCount`
- Cancel closes without changes

**How to test:**
- Button disabled when currentDate is today; enabled when it's a past date (manually set in Firestore to test)
- Saving creates a history doc with correct fields
- `currentDate` updates to today after save
- `historyCount` increments on detail page and list card badge
- Cancel makes no changes

---

### Phase 7 — History List + Read-Only History Page
**Scope:** Viewing and deleting past viewpoints.
- History date list on detail page, below current viewpoint, newest first
- Each row: formatted date + delete button (with confirmation)
- Clicking a date navigates to `#view-history/{id}/{historyId}`
- Read-only history page: title (global), archivedAt date, short version, long version, "what prompted" note
- Breadcrumb: Thoughts › My Views › [Title] › [Date]
- Back button → `#view/{id}`
- Delete button on history page (with confirmation) → removes doc, decrements `historyCount`, redirects to `#view/{id}`
- "No previous views" message on detail page when history is empty

**How to test:**
- After Phase 6 save, history date appears on detail page
- Clicking date navigates to correct read-only page with all fields
- Delete from list works; count decrements
- Delete from history page works; redirects correctly
- "No previous views" shows when historyCount = 0

---

### Phase 8 — Search Bar
**Scope:** Live search on the views list page.
- Search input in list page header
- Filters by title and short version as you type
- Matching accordions expand automatically; non-matching accordions hidden
- "No results" empty state
- Clearing search returns to all-collapsed default

**How to test:**
- Type a word in a view title → correct accordion expands, others collapse
- Type a word only in short version → same behavior
- Type something that matches nothing → empty state shown
- Clear search → back to all collapsed

---

### Phase 9 — Category Maintenance Page (CRUD)
**Scope:** Full add/rename/delete management of categories and subcategories.
- `#views-categories` page with breadcrumb: Thoughts › My Views › Manage Categories
- List of major categories, each expandable to show subcategories
- "+ Add Major Category" → creates doc + auto-creates General subcategory beneath it
- Inline rename for major categories and subcategories (including General)
- "+ Add Subcategory" per major category
- Delete subcategory: blocked if `isDefault`; warns + moves views to General if views assigned; then deletes
- Delete major category: blocked with warning if any subcategory has views
- General row: no delete button, protected

**How to test:**
- Add a major category → General subcategory appears automatically
- Rename a major category → reflected on list page and detail dropdowns
- Add a subcategory → appears in accordion and in detail page dropdown
- Delete empty subcategory → gone
- Delete subcategory with views → warning shown; views move to General after confirm
- Delete major category with views → blocked with message
- Rename General → new name appears throughout; still protected from deletion

---

### Phase 10 — Category Maintenance (Drag-and-Drop Reorder)
**Scope:** Drag-and-drop ordering on the maintenance page.
- Drag handles on major category rows (reorder among major categories)
- Drag handles on subcategory rows (reorder within their major category)
- General subcategory pinned first — no drag handle
- On drop: update `order` field in Firestore for all affected docs
- New order reflected immediately on the list page accordion

**How to test:**
- Drag a major category to a new position → list page accordion reflects new order
- Drag a subcategory within its major → accordion reflects new order
- General stays pinned first regardless of dragging
- Reloading the page preserves the new order (persisted to Firestore)
- Mobile: drag-and-drop works or falls back gracefully

---

### Phase 11 — Backup, Spec, Mobile & Polish
**Scope:** Wrap-up — no new features, just ensuring correctness and completeness.
- Add `views` and `viewCategories` (+ subcollections) to `BACKUP_DATA_COLLECTIONS`
- Update `MyLife-Functional-Spec.md` with full My Views section
- Mobile verification at 375px across all pages
- CSS polish: card styling, accordion styling, disabled states, empty states
- Verify all breadcrumbs, nav links, and back buttons throughout the feature
- Commit, push, deploy

**How to test:**
- Run backup — both collections present in backup output
- Walk the full test plan end-to-end on mobile (375px)
- All breadcrumbs correct on every page
- No layout breakage on any page at mobile width

---

## Test Plan

### Thoughts Landing
- [ ] "My Views" tile appears on Thoughts landing page
- [ ] Tile shows correct total count of all views
- [ ] Clicking tile navigates to `#views`

### Nav Bar (Thoughts Context)
- [ ] "Top 10 Lists" link appears in `thoughtsNav` on all thoughts-context pages
- [ ] "Memories" link appears in `thoughtsNav` on all thoughts-context pages
- [ ] "My Views" link appears in `thoughtsNav` on all thoughts-context pages
- [ ] Each link navigates to its correct route

### Views List — Accordion Structure
- [ ] All accordions collapsed by default on page load
- [ ] Major categories shown in correct order
- [ ] Major category header shows total count across all subcategories
- [ ] Subcategories shown as nested accordions with their count
- [ ] Empty subcategories hidden (including General if 0 views)
- [ ] Empty major categories hidden
- [ ] "Uncategorized" shown at bottom only if uncategorized views exist
- [ ] Clicking accordion header expands/collapses it
- [ ] View cards show: title, short version, currentDate, history count badge
- [ ] Clicking a card navigates to `#view/{id}`
- [ ] "+ New View" button present in header
- [ ] "Manage Categories" link present at footer
- [ ] Breadcrumb: Thoughts › My Views

### Views List — Search
- [ ] Search bar filters by title — live as you type
- [ ] Search bar filters by short version — live as you type
- [ ] Search does NOT match long version text
- [ ] Accordions with matches expand automatically
- [ ] Accordions with no matches are hidden
- [ ] Clearing search returns to all-collapsed state
- [ ] "No results" empty state shown if nothing matches

### Create New View
- [ ] "+ New View" navigates to blank detail page
- [ ] Long version is disabled until title saved AND major category selected
- [ ] Short version always editable
- [ ] Major category dropdown present; subcategory disabled until major selected
- [ ] Selecting major category auto-selects General subcategory
- [ ] Saving title + major category creates Firestore doc, transitions to `#view/{id}`
- [ ] Long version unlocks after both conditions met
- [ ] `currentDate` set to creation timestamp

### View Detail — Display
- [ ] Breadcrumb: Thoughts › My Views › [Title]
- [ ] Title, short version, long version display correctly
- [ ] Major category and subcategory dropdowns show correct selections
- [ ] `currentDate` shown
- [ ] "No previous views" shown when history empty
- [ ] Links section shows empty state when no links

### View Detail — Edit Title
- [ ] Saving updates Firestore globally
- [ ] Reflected on list card and historical viewpoint page
- [ ] No history entry created

### View Detail — Edit Short Version
- [ ] Character counter shows remaining out of 500
- [ ] Cannot exceed 500 characters
- [ ] Manual Save saves; no history entry created

### View Detail — Edit Long Version
- [ ] Auto-save fires on blur
- [ ] Manual Save works
- [ ] `updatedAt` updates; `currentDate` does NOT change
- [ ] No history entry created

### Category Assignment
- [ ] Selecting major category auto-sets subcategory to General
- [ ] Subcategory dropdown disabled until major category selected
- [ ] Changing subcategory saves `subcategoryId` to Firestore
- [ ] View moves to correct accordion on list page after change
- [ ] Clearing major category moves view to Uncategorized

### "I've Changed My View" — Availability
- [ ] Button enabled when `currentDate` is NOT today
- [ ] Button disabled (grayed out) when `currentDate` is today
- [ ] Disabled button shown with tooltip or label explaining why

### "I've Changed My View" — Flow
- [ ] Modal opens pre-filled with current short + long version
- [ ] Both fields editable in modal
- [ ] "What prompted this change?" is optional
- [ ] Saving archives old short + long to history subcollection with `archivedAt`
- [ ] `currentDate` updates to today
- [ ] `historyCount` increments on detail page and list card
- [ ] Cancel closes without changes

### Links Section
- [ ] "+ Add Link" shows inline form
- [ ] URL required; label optional
- [ ] Saved link is clickable (opens new tab)
- [ ] Label shown if provided; URL shown if no label
- [ ] Editing existing link works inline
- [ ] Delete removes link immediately (no confirmation)
- [ ] Links persist across navigation
- [ ] Links NOT included in "I've Changed My View" archive

### Historical Viewpoint — List
- [ ] Dates listed below current viewpoint, newest first
- [ ] Clicking a date navigates to `#view-history/{id}/{historyId}`
- [ ] Delete prompts confirmation; removes from Firestore; `historyCount` decrements

### Historical Viewpoint — Read-Only Page
- [ ] Breadcrumb: Thoughts › My Views › [Title] › [Date]
- [ ] Short version, long version, archivedAt date, "what prompted" all display
- [ ] Page is read-only (no edit controls)
- [ ] Shows current (global) title
- [ ] Back button returns to `#view/{id}`
- [ ] Delete (with confirmation) redirects to `#view/{id}`; count decrements

### Category Maintenance Page
- [ ] Breadcrumb: Thoughts › My Views › Manage Categories
- [ ] Accessible via "Manage Categories" link on views list
- [ ] All major categories listed in correct order
- [ ] Subcategories listed under each, General always first
- [ ] Add major category → General subcategory auto-created beneath it
- [ ] Add subcategory under a major category works
- [ ] Rename major category reflects on list page
- [ ] Rename subcategory (including General) reflects on list and detail pages
- [ ] Drag-and-drop reorders major categories; order persists to Firestore
- [ ] Drag-and-drop reorders subcategories within major; General stays pinned
- [ ] General row has no delete button and no drag handle
- [ ] Delete subcategory with 0 views works immediately
- [ ] Delete subcategory with views: warns "X views will be moved to General. Continue?"
- [ ] After subcategory delete, affected views now show General as subcategory
- [ ] Delete major category blocked if any subcategory has views; warning shown

### Delete View
- [ ] Delete prompts confirmation
- [ ] Deletes view doc and all history subcollection entries
- [ ] Redirects to `#views`; view gone from list

### Backup
- [ ] `views` collection included in backup
- [ ] `viewCategories` collection and subcollections included in backup

### Responsive / Mobile
- [ ] Accordion list usable at 375px
- [ ] Search bar usable at 375px
- [ ] Short version counter visible on mobile
- [ ] Long version text area works with mobile keyboard
- [ ] Category dropdowns usable on mobile
- [ ] Links tappable on mobile
- [ ] "I've Changed My View" modal works on mobile
- [ ] Maintenance page drag-and-drop usable on mobile (or fallback)
