# Memories Feature Plan

## Overview
A new section under **Thoughts** for capturing personal memories in written form.
Goal: a memory captures **when**, **where**, **who**, and **what happened**.

---

## Navigation & Routing

- New card added to the **Thoughts landing page** (`#thoughts`) alongside "Top 10 Lists"
- Routes:
  - `#memories` — Memory list page (main view)
  - `#memory-create` — Temporary create page (title-only prompt; transitions to edit once title is saved)
  - `#memory-edit/{id}` — Edit a specific memory
- Breadcrumbs: **Thoughts → Memories** (list), **Thoughts → Memories → [Title]** (detail)

**Create flow:**
1. User clicks "+ New Memory" → navigates to `#memory-create`
2. Only the **Title** field is shown (required before anything saves)
3. On blur of the title field (if non-empty): Firestore doc is created, URL replaced with `#memory-edit/{newId}` via `history.replaceState` — user doesn't see a navigation event
4. All fields now visible; auto-save begins

**Post-save / post-cancel navigation:** both return to `#memories` list

---

## Data Model

### Firestore Collection: `memories`

| Field | Type | Notes |
|---|---|---|
| `title` | string | One-line description; shown in the list |
| `body` | string | Free-form narrative text (can be very long — 50+ paragraphs) |
| `dateText` | string | Exactly what user typed: "Fall of '87", "mid 80's", "March 1992" |
| `sortDate` | string (ISO) | Derived from dateText — used only for initial list placement |
| `sortOrder` | float | Manual drag order — drives all list rendering after initial insert |
| `location` | string | Free-form text (not linked to zones yet) |
| `tags` | array of strings | e.g. `["family", "vacation"]` — multiple allowed |
| `mentionedPersonIds` | array | IDs of @-mentioned contacts from contact list |
| `mentionedNames` | array of strings | Free-form names added via `++Name` (not in contacts) |
| *(links in `memoryLinks` collection)* | — | Bidirectional links stored separately — see memoryLinks |
| `urls` | array of objects | `{ label, url }` pairs — label optional |
| `inProgress` | boolean | Defaults to `true`; uncheck when memory is "done" |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### Firestore Collection: `memoryLinks`
| Field | Type | Notes |
|---|---|---|
| `memoryIds` | array of 2 strings | Always `[lowerSortedId, higherSortedId]` — ensures uniqueness |
| `createdAt` | timestamp | |

- Document ID: `${minId}_${maxId}` — idempotent, prevents duplicates
- Query pattern: `where('memoryIds', 'array-contains', id)` — finds all links for any memory
- Adding a link: one write. Removing: one delete. No memory documents need updating.
- Bidirectional by nature — both sides see the link from this single record

### Firestore Collection: `memoryTags`
| Field | Type | Notes |
|---|---|---|
| `name` | string | Tag name (e.g. "family", "childhood", "travel") |
| `createdAt` | timestamp | |

Tags are managed globally — created on the fly while editing, reused across memories.

---

## Sort Order — Floating Point Midpoint

**Problem:** With 200 memories, inserting at position 37 should not require updating the other 163 records.

**Solution: Float-based sparse ordering**
- Items store `sortOrder` as a float, initialized with large gaps: 10000, 20000, 30000…
- To insert between items at 20000 and 30000 → assign 25000. **Zero other records updated.**
- To insert between 20000 and 25000 → assign 22500. Still zero other records updated.
- This works ~50 levels deep at the same gap before float precision degrades
- Edge case: if a gap ever collapses, a one-time rebalance pass renumbers all items sequentially (rarely needed even with hundreds of insertions)

**New memory insertion flow:**
1. Parse `sortDate` from `dateText`
2. Compare against existing memories' `sortDate` values to find the nearest neighbor
3. Assign `sortOrder` as the midpoint float between that neighbor and the next item
4. User sees new memory appear in the correct approximate slot and can drag to fine-tune

---

## Date Entry — Free Text + Smart Sort Key

**How it works:**
- Single free-text field labeled "When". User types anything.
- On save, a parser derives a hidden `sortDate` (ISO string) used only for initial list placement.
- `dateText` is displayed exactly as typed — never reformatted.

**Parsing rules (best-effort):**

| What user types | sortDate derived |
|---|---|
| `June 15, 1990` | `1990-06-15` |
| `March 1992` | `1992-03-01` |
| `1995` | `1995-01-01` |
| `Fall of '87` / `Fall 1987` | `1987-10-01` |
| `Summer of '94` | `1994-07-01` |
| `Spring 2001` | `2001-04-01` |
| `Winter 1983` | `1983-01-01` |
| `Christmas 1988` | `1988-12-25` |
| `early 80's` / `early 80s` | `1980-01-01` |
| `mid 80's` / `mid 80s` | `1984-01-01` |
| `late 80's` / `late 80s` | `1987-01-01` |
| Unparseable | `null` — item goes to bottom of list |

---

## Auto-Save + Cancel Behavior

### Adding a new memory
- On `#memory-create`, only the Title field is shown — **no Firestore write until title is filled and blurred**
- Once title is saved, doc is created and page transitions to `#memory-edit/{newId}`
- All subsequent field changes auto-save (debounced ~1.5s after last keystroke)
- If user presses **Cancel** on `#memory-create` (before doc is created): navigate back to `#memories`, nothing saved
- If user presses **Cancel** on `#memory-edit` after doc exists: prompt "Discard this memory?" → if Yes, delete the Firestore record and navigate to `#memories`
- If user closes the browser mid-write after doc is created: draft persists in the list — user cleans it up

### Editing an existing memory
- On entering `#memory-edit/{id}`, capture the original field values in a JS variable (`_memoryOriginal`)
- Auto-save changes to Firestore as the user types (debounced ~1.5s)
- If user presses **Cancel**: prompt "Discard your changes?" → if Yes, write `_memoryOriginal` back to Firestore, then navigate to `#memories`
- If user closes the browser mid-edit: auto-saved changes persist (no rollback)

### Delete
- **Delete button on the edit page** (destructive, requires confirmation)
- On confirm: delete the memory doc, delete all `memoryLinks` docs referencing this memory's ID, navigate to `#memories`

---

## People in a Memory — Two Tracks

### Track 1: @-Mentions (existing contacts)
- Typing `@` in the body textarea opens a dropdown of matching contacts (same as journal entry behavior)
- `Enter` / `Tab` inserts the first match inline; clicking selects
- Person ID stored in `mentionedPersonIds[]`
- Chips shown in the People section below the body (clickable — navigate to contact)

### Track 2: `++Name` (non-contact people)
- Typing `++Rob` anywhere in the body:
  - Replaces `++Rob` in the text with just `Rob` (the `++` disappears, name stays inline)
  - Adds `"Rob"` to `mentionedNames[]` as a plain string
  - Chip appears in the People section (plain style, not linked, removable with ×)
- No dropdown needed — name is taken literally from what follows `++`
- **Trigger fires on:** space, comma, period, or blur (end of textarea focus) — not mid-word
- **Multi-word names:** wrap in quotes — `++"Rob Smith"` → extracts `Rob Smith`, inserts it inline, removes the `++"..."` wrapper. The space inside quotes does NOT fire the trigger.
  - Regex pattern: `\+\+(?:"([^"]+)"|(\S+))` — quoted group or single word group
- **Deduplication:** if the name (case-insensitive) is already in `mentionedNames[]`, do not add again and do not create a second chip

**Deduplication — both tracks:**
- `@mentions`: if the same contact ID already exists in `mentionedPersonIds[]`, do not add again
- `++names`: if the same name (case-insensitive) already exists in `mentionedNames[]`, do not add again

**People section (below body):**
- Contact chips: clickable, styled as linked
- Free-form name chips: plain text, removable with ×
- Both types in the same chip row

---

## URLs

- Displayed as a list of clickable links (label if set, otherwise the raw URL)
- Each entry has a **pencil icon** — clicking opens an inline edit form for that entry's label + URL
- Saving the inline form returns to the link display; × removes the entry
- **Add URL** button appends a new blank inline edit form at the bottom of the list
- Always rendered as links — no separate view/edit mode toggle needed

---

## Tags

- Multiple tags allowed per memory (e.g., "Family" + "Vacation")
- Tags created on the fly while editing — type new tag name, press Enter to create and apply
- Existing tags displayed **alphabetically** as checkboxes or pills for quick selection
- Tags stored in `memoryTags` collection (global, reused across memories)
- **Future:** filter the memory list by tag

---

## Related Memories — Bidirectional Links

- A **"Linked Memories"** section at the bottom of the memory edit page
- A button opens a **searchable popup** listing all existing memory titles (excluding the current one)
- Search bar at the top of the popup filters titles as you type
- User selects one or more to link; they appear as a list of clickable titles
- Each linked memory row has a × to remove the link
- Clicking a linked memory title navigates to that memory's edit page

**Storage — `memoryLinks` collection:**
- One document per linked pair; document ID: `${minId}_${maxId}` (sorted alphabetically)
- Each document: `{ memoryIds: [idA, idB], createdAt }`
- To load all links for a memory: query `where('memoryIds', 'array-contains', currentId)`
- Adding a link = 1 Firestore write. Removing = 1 delete. No memory documents touched.
- Auto-bidirectional: if A links to B, B automatically shows A in its Linked Memories section

---

## In Progress Toggle

- Each memory has an **"In Progress"** checkbox/toggle, checked by default
- Meaning: "I'm still working on this / haven't finished writing it"
- Uncheck when the memory feels complete
- On the **Memory List page**: a toggle **"In Progress only"** filters the list to show only `inProgress: true` items
- Default list view: shows all memories (not filtered)
- In-progress memories show a small **"In Progress"** label/tag on the **left side of the title** in the list row (inline, before the title text)

---

## Speak Button

- Same pattern as journal entries — Web Speech API (browser speech-to-text)
- Button positioned **above the body textarea** (same placement as journal)
- Pressing it starts speech recognition; spoken words are appended to the body at cursor position
- Same implementation as `journal.js` speak functionality

---

## Help Button

- A **?** or **Help** button at the top of the memory edit page
- Opens a small modal or panel explaining:
  - **Date field**: type anything — "Fall of '87", "mid 80's", "March 1992", "Christmas 1988". The app uses it to place the memory in approximate order; you drag to fine-tune.
  - **`++Name`**: type `++Rob` while writing to add Rob to the People list without stopping. The `++` disappears and Rob appears as a mention chip below.
  - **`@Name`**: type `@` to search your contacts and link a real contact to this memory.
- More tips can be added here over time.

---

## Memory List Page (`#memories`)

- Header: **Memories** with **+ New Memory** button and **In Progress only** toggle
- Breadcrumb: Thoughts → Memories
- Each row:
  - **Drag handle** (left)
  - **Title**
  - **Date text** (subdued, right side or second line)
  - Subtle in-progress indicator if `inProgress: true`
- No body preview in the list
- Clicking a row navigates to the memory edit page

---

## Memory Detail / Edit Page (always editable)

### Field layout (top to bottom)

1. **Help button** — top right, explains date syntax and `++` / `@` shortcuts
2. **Title** — one-line text input (required)
3. **In Progress** — toggle/checkbox (checked by default)
4. **When** — free-text input with placeholder: `e.g. Fall of '87, mid 80's, March 1992, Christmas 1988`
5. **Location** — one-line free-form text, e.g. "Grandma's house, Lake Wildwood"
6. **Tags** — pill/checkbox multi-select; inline "+" to create new tag
7. **Body** — large auto-expanding textarea; supports `@mention` and `++Name`; Speak button nearby
8. **People** — chips auto-populated from body mentions; contact chips clickable, free-form chips removable
9. **URLs** — list of clickable links; each has an edit icon (pencil) to edit label/URL inline; Add URL button appends a new entry
10. **Linked Memories** — list of related memory titles with ×; "Link a Memory" button opens picker popup
11. **Cancel** button (with discard prompt if changes exist)

---

## Implementation Phases

---

### Phase M1 — Scaffold: Routing, Thoughts Tile, Memory List Page

**Goal:** The Memories section exists, is navigable, and shows a working (empty) list with drag-and-drop sort order.

**`js/app.js`**
- Add route cases for `#memories`, `#memory-create`, `#memory-edit/{id}`
- Each calls the corresponding load function in `memories.js` and calls `showPage()`

**`js/thoughts.js` — `loadThoughtsPage()`**
- Query the `memories` collection (userCol); count documents
- Update the Memories tile label with the count (e.g., "Memories (12)")

**`index.html`**
- Add Memories tile to `#thoughtsFeatureGrid`:
  ```html
  <a href="#memories" class="landing-tile landing-tile--memories">
    <span class="landing-tile-icon">📖</span>
    <span class="landing-tile-label" id="memoriesCount">Memories</span>
  </a>
  ```
- Add `<section class="page hidden" id="page-memories">` containing:
  - Page header: "Memories" h2 + "+ New Memory" button (`id="addMemoryBtn"`)
  - In-progress filter toggle: checkbox/toggle labeled "In Progress only" (`id="memoriesInProgressFilter"`)
  - List container: `<div id="memoriesList"></div>`
- Add `<section class="page hidden" id="page-memory-create">` (Phase M2 will flesh this out — placeholder for now)
- Add `<section class="page hidden" id="page-memory-edit">` (Phase M2 will flesh this out — placeholder for now)

**`js/memories.js`** — create file, export/attach:
- `loadMemoriesPage()`:
  - Subscribe to `memories` collection ordered by `sortOrder` ascending
  - Render each memory as a list row inside `#memoriesList`:
    ```
    [drag-handle ⠿] [IN PROGRESS tag if inProgress] [title] [dateText subdued]
    ```
  - Clicking a row navigates to `#memory-edit/{id}`
  - "+ New Memory" button navigates to `#memory-create`
  - In-progress filter toggle: when checked, hide rows where `inProgress !== true`

- **Drag-and-drop** (touch + mouse):
  - Drag handle: `<span class="memory-drag-handle">⠿</span>`
  - On dragend/touchend: compute new `sortOrder` as float midpoint between the two neighbors in current DOM order
  - Write updated `sortOrder` to Firestore for the dragged item only — no other records touched
  - Mirror touch event handling from `top10lists.js`

**`css/styles.css`**
- `.landing-tile--memories` — tile color/icon style
- `.memory-list-row` — flex row, align-items center, padding, border-bottom
- `.memory-in-progress-tag` — small pill badge, left of title (`font-size: 0.7rem`, muted color)
- `.memory-list-title` — flex-grow, bold
- `.memory-list-date` — subdued color, `font-size: 0.85rem`, right side
- `.memory-drag-handle` — cursor grab, padding, touch-target min 44px

---

### Phase M2 — Create / Edit Page: Core Fields, Auto-Save, Cancel, Delete

**Goal:** Can create, edit, and delete a memory. All core fields work. Auto-save and cancel/discard behavior work correctly.

**`index.html` — `#page-memory-create`**
- Breadcrumb: Thoughts → Memories
- Single field: Title input (`id="memoryCreateTitle"`) with placeholder "Give this memory a title..."
- Cancel button (`id="memoryCreateCancel"`) — navigates back to `#memories` with no save
- Instructional text: "Add a title to get started"

**`index.html` — `#page-memory-edit`**
- Breadcrumb: Thoughts → Memories → `<span id="memoryEditBreadcrumbTitle"></span>`
- Help button `?` top-right (`id="memoryHelpBtn"`) — placeholder, wired in M10
- Field layout (top to bottom):
  1. Title: `<input id="memoryEditTitle">`
  2. In Progress: `<label><input type="checkbox" id="memoryEditInProgress"> In Progress</label>`
  3. When: `<input id="memoryEditDateText" placeholder="e.g. Fall of '87, mid 80's, March 1992">`
  4. Location: `<input id="memoryEditLocation" placeholder="e.g. Grandma's house, Lake Wildwood">`
  5. Tags: `<div id="memoryEditTags"></div>` — placeholder, wired in M4
  6. Speak button + Body textarea: `<button id="memorySpeakBtn">` above `<textarea id="memoryEditBody">`
  7. People chips: `<div id="memoryPeopleChips"></div>` — placeholder, wired in M5/M6
  8. URLs: `<div id="memoryEditUrls"></div>` — placeholder, wired in M7
  9. Linked Memories: `<div id="memoryLinkedList"></div>` — placeholder, wired in M9
  10. Bottom buttons: Cancel (`id="memoryEditCancel"`) | Delete (`id="memoryEditDelete"`)

**`js/memories.js`**

- `loadMemoryCreatePage()`:
  - Render `#page-memory-create`
  - On blur of `#memoryCreateTitle` (if value non-empty):
    - Create Firestore doc: `{ title, inProgress: true, sortOrder: 0, createdAt: now }`
    - `sortOrder` set to 0 temporarily — M3 will assign proper float
    - `history.replaceState(null, '', '#memory-edit/' + newId)`
    - Call `loadMemoryEditPage(newId, { isNew: true })`
  - Cancel: navigate to `#memories`

- `loadMemoryEditPage(id, opts)`:
  - Load memory doc from Firestore
  - Store original values: `_memoryOriginal = { ...doc }`
  - Populate all fields from doc data
  - Set `_memoryId = id`, `_memoryIsNew = opts.isNew || false`
  - Update breadcrumb title span
  - Wire auto-save (debounced 1500ms) on: title, dateText, location, body, inProgress checkbox
  - Each auto-save writes only changed fields via `doc.update({ field: value, updatedAt: now })`

- **Cancel handler (`#memoryEditCancel`)**:
  - If `_memoryIsNew`: confirm "Discard this memory?" → if Yes, delete doc → `#memories`
  - If existing edit: confirm "Discard your changes?" → if Yes, write `_memoryOriginal` back to Firestore → `#memories`
  - If No on either prompt: do nothing, stay on page

- **Delete handler (`#memoryEditDelete`)**:
  - Confirm "Permanently delete this memory?"
  - If Yes:
    1. Delete memory doc
    2. Query `memoryLinks` where `memoryIds array-contains id` → delete all matching docs
    3. Navigate to `#memories`

**`css/styles.css`**
- `.memory-edit-page` — max-width container, padding
- `.memory-field-group` — label + input stacked, margin-bottom
- `#memoryEditBody` — min-height: 300px, auto-expand (use `input` event to grow: `el.style.height = el.scrollHeight + 'px'`)
- `.memory-edit-actions` — bottom button row, space-between
- `.memory-delete-btn` — destructive red style

---

### Phase M3 — Date Parser + Float SortOrder Auto-Insert

**Goal:** When a new memory is saved (or dateText changes), the `sortDate` is derived and `sortOrder` is assigned to slot the memory into the correct approximate position in the list.

**`js/memories.js`**

- `_memoryParseSortDate(dateText)` → returns ISO string or `null`:
  - Normalize input: lowercase, trim, collapse whitespace
  - Try patterns in order (most specific first):
    - Full date: `June 15, 1990` → `1990-06-15`
    - Month + year: `March 1992` → `1992-03-01`
    - Year only (4 digits): `1995` → `1995-01-01`
    - Season + optional year: `Fall of '87`, `Fall 1987`, `Summer '94` → map season to month (Spring=04, Summer=07, Fall=10, Winter=01)
    - Named holiday + year: `Christmas 1988` → `1988-12-25`; `Thanksgiving 1995` → `1995-11-01` (approximate)
    - Decade prefix: `early [X]0's` → `[X]0-01-01`; `mid [X]0's` → `[X]4-01-01`; `late [X]0's` → `[X]7-01-01`
    - Two-digit year with apostrophe: `'87` → `1987-01-01` (assumes 1900s for ≤ 30, 2000s for < current year — configurable)
  - Return `null` if nothing matches

- `_memoryCalcSortOrder(sortDate, existingMemories)` → returns float:
  - `existingMemories` is array of `{ sortOrder, sortDate }` sorted by `sortOrder` ascending
  - If list is empty: return `10000`
  - If `sortDate` is null: return `(last item sortOrder) + 10000` (goes to bottom)
  - Find the insertion index: first item whose `sortDate > sortDate` (or null sortDate)
  - If inserting before first item: return `first.sortOrder / 2`
  - If inserting after last item: return `last.sortOrder + 10000`
  - Otherwise: return `(prev.sortOrder + next.sortOrder) / 2`

- Call `_memoryParseSortDate` + `_memoryCalcSortOrder` when:
  1. New memory is first created (in create flow)
  2. `dateText` field is changed and blurred on an existing memory (update `sortDate` + recalculate `sortOrder`)

- **Rebalance function** `_memoryRebalanceSortOrder()`:
  - Only called if two adjacent items' `sortOrder` values differ by less than `0.0001`
  - Reads all memories, assigns new `sortOrder` values: 10000, 20000, 30000…
  - Writes all updated docs in a batch

---

### Phase M4 — Tags

**Goal:** User can assign multiple tags to a memory. Tags are created on the fly and reused across memories. Displayed alphabetically.

**Firestore:** `memoryTags` collection — `{ name, createdAt }`

**`js/memories.js`**

- `_memoryLoadTags()` → returns array of tag objects sorted by `name` ascending
- `_memoryRenderTags(memoryTags, allTags)`:
  - Render `#memoryEditTags` as a row of pill checkboxes, alphabetical order
  - Each pill: `<label class="memory-tag-pill"><input type="checkbox"> FamilyName</label>`
  - Checked if tag name is in memory's `tags[]`
  - On checkbox change: update memory's `tags[]`, auto-save
- **Add tag inline**:
  - A small text input below the pills: `<input id="memoryNewTagInput" placeholder="Add tag...">`
  - On Enter (if non-empty, trimmed):
    1. Create doc in `memoryTags` if name doesn't already exist
    2. Add to memory's `tags[]`, auto-save
    3. Re-render tag pills
    4. Clear the input

**`css/styles.css`**
- `.memory-tag-pill` — inline pill style, checkbox hidden, checked state highlighted
- `.memory-tag-pills-row` — flex wrap, gap

---

### Phase M5 — @-Mentions (Existing Contacts)

**Goal:** Typing `@` in the body textarea opens a contact dropdown. Selecting a contact adds them to the People chips section. Deduplication enforced.

**`js/memories.js`** — mirror `journal.js` mention pattern:

- Module-level state: `_memMentionedPersonIds = new Set()`, `_memPeopleCache = []`

- `_memLoadPeopleCache()`:
  - Query contacts collection (same source as journal) — flatten all people into `_memPeopleCache`
  - Each entry: `{ id, firstName, lastName, nickname, displayName }`

- `_memInitMentions()`:
  - Attach `input` listener to `#memoryEditBody`
  - Attach `keydown` listener for Enter/Tab/Escape to handle dropdown navigation
  - Attach `blur` listener to hide dropdown

- `_memHandleBodyInput()`:
  - Extract text before cursor; test regex `/@(\w*)$/`
  - If match: filter `_memPeopleCache` by prefix → call `_memShowMentionDropdown(matches)`
  - If no match: hide dropdown

- `_memShowMentionDropdown(matches)`:
  - Render up to 7 matches in `#memoryMentionDropdown`
  - Position dropdown near cursor (or below textarea on mobile)
  - Click or Enter/Tab → call `_memSelectMention(person)`

- `_memSelectMention(person)`:
  - Replace `@prefix` in textarea with `@FirstName` (or nickname)
  - If person.id not already in `_memMentionedPersonIds`:
    - Add to set; render contact chip in `#memoryPeopleChips`
  - Auto-save `mentionedPersonIds`

- **Chip render**: `<span class="memory-chip memory-chip--linked" data-id="...">@Name <a href="#contact/id">↗</a></span>`

**`index.html`**
- Add `<div id="memoryMentionDropdown" class="mention-dropdown hidden"></div>` near body textarea
- Add `<div id="memoryPeopleChips" class="memory-people-chips"></div>` below body

**`css/styles.css`**
- `.memory-chip` — base chip style (pill shape, padding)
- `.memory-chip--linked` — colored border, clickable
- `.memory-chip--freeform` — neutral style, has × button
- `.memory-people-chips` — flex wrap, gap, margin-top

---

### Phase M6 — `++Name` Free-Form Mentions

**Goal:** Typing `++Rob` or `++"Rob Smith"` in the body extracts the name, removes the `++` prefix from the text, and adds a plain-text chip to the People section. No duplicates.

**`js/memories.js`**

- Module-level state: `_memMentionedNames = []` (array of strings, lowercase-deduped)

- `_memScanForPlusPlus(textarea)`:
  - Regex: `/\+\+(?:"([^"]+)"|(\S+))(?=[\s,.]|$)/g`
    - Group 1: quoted multi-word name (e.g. `"Rob Smith"`)
    - Group 2: single unquoted word (e.g. `Rob`)
  - For each match:
    - Extract name from group 1 or group 2
    - Replace the full match (e.g. `++Rob` or `++"Rob Smith"`) with just the extracted name in textarea value
    - Normalize cursor position after replacement
    - If name (case-insensitive) not already in `_memMentionedNames`:
      - Push to `_memMentionedNames`
      - Render freeform chip in `#memoryPeopleChips`
  - Auto-save `mentionedNames`

- Call `_memScanForPlusPlus` on:
  - `input` event (after `++` characters detected — check for `++` presence before running full scan)
  - `blur` event on the body textarea (catch anything not yet fired)

- **Chip render**: `<span class="memory-chip memory-chip--freeform">Name <button class="chip-remove">×</button></span>`
- × click: remove name from `_memMentionedNames`, remove chip, auto-save

---

### Phase M7 — URL List

**Goal:** User can add, edit, and remove URLs. Each URL is displayed as a clickable link with a pencil edit icon.

**`js/memories.js`**

- Module-level state: `_memUrls = []` (array of `{ label, url }`, mirrors Firestore)

- `_memRenderUrls()`:
  - Clear and re-render `#memoryEditUrls`
  - For each URL entry: render a row:
    ```
    [🔗 <a href="url" target="_blank">label || url</a>] [pencil btn] [× btn]
    ```
  - Pencil click: swap that row to an inline edit form (label input + URL input + Save btn + Cancel btn)
  - Save: update `_memUrls[i]`, re-render, auto-save to Firestore
  - Cancel: re-render without saving
  - × click: remove from `_memUrls`, re-render, auto-save

- "Add URL" button at bottom of URL section:
  - Appends a new blank inline edit form (same structure as pencil edit)
  - Save: push to `_memUrls`, re-render, auto-save
  - Cancel: just remove the form

**`index.html`**
- `<div id="memoryEditUrls"></div>` with "Add URL" button `id="memoryAddUrlBtn"`

**`css/styles.css`**
- `.memory-url-row` — flex row, align-items center, gap
- `.memory-url-link` — truncate long URLs, color link style
- `.memory-url-edit-form` — inline compact form row

---

### Phase M8 — Speak Button

**Goal:** Speak button above the body textarea starts speech-to-text and appends words to the body. Same implementation as journal.js.

**`js/memories.js`**

- `_memInitSpeakButton()`:
  - Check `window.SpeechRecognition || window.webkitSpeechRecognition` — hide button if unsupported
  - On button click: toggle recognition on/off
  - Recognition `onresult`: append transcript to `#memoryEditBody` at end (or cursor if determinable)
  - After appending: trigger auto-save debounce; also run `_memScanForPlusPlus` and `_memHandleBodyInput` in case speech produced `++` or `@` patterns
  - Visual feedback: button changes label/icon while listening (e.g., "🎤 Listening..." with active style)

**`index.html`**
- `<button id="memorySpeakBtn" class="memory-speak-btn">🎤 Speak</button>` — placed directly above `#memoryEditBody`

**`css/styles.css`**
- `.memory-speak-btn` — small secondary button style
- `.memory-speak-btn.active` — highlighted/pulsing style while recording

---

### Phase M9 — Linked Memories (Bidirectional)

**Goal:** A "Linked Memories" section at the bottom of the edit page shows related memories. User can link/unlink. Links are stored in `memoryLinks` collection and are auto-bidirectional.

**Firestore `memoryLinks` collection:**
- Doc ID: `${[idA, idB].sort().join('_')}` — ensures uniqueness regardless of order
- Fields: `{ memoryIds: [idA, idB], createdAt }`

**`js/memories.js`**

- `_memLoadLinkedMemories(id)`:
  - Query `memoryLinks` where `memoryIds array-contains id`
  - Collect the "other" ID from each link doc (whichever element in `memoryIds` is not `id`)
  - Fetch those memory docs to get their titles and dateText
  - Render list in `#memoryLinkedList`

- `_memRenderLinkedList(linkedMemories)`:
  - Each row: `[📖 Title — dateText] [× remove]`
  - Clicking the title navigates to `#memory-edit/{linkedId}`
  - × click: delete the `memoryLinks` doc (its composite ID), re-render

- **"Link a Memory" button** (`id="memoryLinkBtn"`):
  - Opens modal `#memoryLinkPickerModal`
  - Modal contains:
    - Search input `id="memoryLinkSearch"` — filters the list as you type
    - Scrollable list of all memories (title + dateText), excluding current memory and already-linked memories
    - Click a row to select: create `memoryLinks` doc, close modal, re-render linked list
  - `_memBuildLinkPicker()`: load all memories, filter out current + already linked, render

- **On memory delete** (in Phase M2 delete handler):
  - Query `memoryLinks` where `memoryIds array-contains id` → batch delete all matching docs

**`index.html`**
- `<div id="memoryLinkedList"></div>` + `<button id="memoryLinkBtn">Link a Memory</button>` in the edit page
- Modal: `<div id="memoryLinkPickerModal" class="modal hidden">` with search input + `<div id="memoryLinkPickerList">`

**`css/styles.css`**
- `.memory-linked-row` — flex row, link style title, × on right
- `#memoryLinkPickerModal` — standard modal styles (reuse existing modal CSS)
- `#memoryLinkPickerList` — scrollable list, max-height

---

### Phase M10 — Help Button Modal

**Goal:** A `?` button on the edit page opens a modal explaining the date field, `++Name`, and `@Name` shortcuts.

**`js/memories.js`**
- Wire `#memoryHelpBtn` click to `openModal('memoryHelpModal')`

**`index.html`** — add modal `id="memoryHelpModal"`:
```
How dates work:
  Type anything in the "When" field — the app uses it to place the memory in the right
  approximate order in your list. Examples: Fall of '87, mid 80's, March 1992,
  Christmas 1988. You can always drag to fine-tune the order.

Adding people while writing:
  @Name — type @ to search your contacts. Press Enter or Tab to insert the first match.
  ++Name — type ++Rob to add Rob to the People list without stopping. The ++ disappears
           and Rob appears as a chip below.
  ++"Full Name" — use quotes for multi-word names, e.g. ++"Rob Smith".
```

**`css/styles.css`**
- No new styles needed — reuses existing modal styles

---

### Phase M11 — Polish, Breadcrumbs, Mobile, Spec Update

**Goal:** Everything is wired, tested at 375px mobile, breadcrumbs work, spec is updated.

**Breadcrumbs**
- `#page-memories`: `<nav class="breadcrumb"><a href="#thoughts">Thoughts</a> › Memories</nav>`
- `#page-memory-create`: `<nav class="breadcrumb"><a href="#thoughts">Thoughts</a> › <a href="#memories">Memories</a> › New Memory</nav>`
- `#page-memory-edit`: `<nav class="breadcrumb"><a href="#thoughts">Thoughts</a> › <a href="#memories">Memories</a> › <span id="memoryEditBreadcrumbTitle">...</span></nav>`

**Mobile review checklist**
- [ ] Memory list rows readable at 375px — date text wraps to second line if needed
- [ ] Drag handle touch target ≥ 44px
- [ ] Edit page fields full-width, no overflow
- [ ] Body textarea starts tall, expands — no clipping on iOS
- [ ] People chip row wraps gracefully
- [ ] URL rows don't overflow — long URLs truncate with ellipsis
- [ ] Linked Memories picker modal scrollable on small screen
- [ ] In-progress tag doesn't crowd the title on small screens

**Version bump**
- Add `<script src="js/memories.js?v=N">` to `index.html`
- Bump `?v=N` on ALL other script tags and the CSS link tag

**`MyLife-Functional-Spec.md`**
- Add full Memories section covering: navigation, data model, list page behavior, edit page fields, all mention tracks, URL list, linked memories, tags, in-progress toggle, help modal, date parsing, sort order strategy

---

## Files to Create / Modify

| File | Change |
|---|---|
| `js/memories.js` | New — all memory logic |
| `index.html` | Add Memories card to Thoughts grid; add page sections |
| `css/styles.css` | Memories-specific styles |
| `js/app.js` | Add `#memories`, `#memory-create`, `#memory-edit/{id}` routes |
| `js/thoughts.js` | Update `loadThoughtsPage()` to count memories and show tile |
| `MyLife-Functional-Spec.md` | Add Memories section |

---

## Design Notes

- Body textarea should be **very tall by default** and auto-expand — memories can be 50+ paragraphs
- On mobile, full edit page scrolls naturally; no fixed-height panels
- People chips: two visual styles — **linked** (contact, tappable) vs. **unlinked** (free-form, removable)
- Date field placeholder: `e.g. Fall of '87, mid 80's, March 1992, Christmas 1988`
- `++` trigger fires when followed by a space, comma, period, or blur — not mid-word
- List row layout: `[drag handle] [IN PROGRESS tag?] [title] [date text]` — in-progress tag is small/compact
- Drag-and-drop must support **touch events** (mobile) as well as mouse — same requirement as Top 10 Lists

---

## Developer Notes

- `memories.js` must be added to `index.html` with a `?v=N` cache-busting version tag
- Bump the version counter on ALL `<script>` tags and the CSS `<link>` tag when adding this file (currently at v=355/380)
- Drag-and-drop: reuse or mirror the touch+mouse implementation from `top10lists.js`
