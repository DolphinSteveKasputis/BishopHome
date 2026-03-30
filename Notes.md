# Notes Feature Plan

## Overview
Add a **Notes** card to the Life landing page. Notes are organized into user-created **Notebooks**. Each notebook contains timestamped entries (notes) with optional photos. Includes a natural-language SecondBrain action and search across all notebooks and within a single notebook.

---

## User Flow

### 1. Life Landing Page
- Add a **Notes** tile to the `lifeFeatureGrid` alongside Journal, People, My Health
- Tapping it navigates to `#notes`

### 2. Notebooks List Page (`#notes`)
- **On entry**: check if a notebook named "Default" exists; if not, create it silently before rendering
- Shows all notebooks as color tiles (same `landing-tile` pattern as the Life landing grid)
- Each tile displays: notebook name, note count, last updated date
- **Add Notebook** button → modal with name field + color picker
- Tap a tile → navigate to `#notebook/{id}`
- **Global search bar** at top — searches body text across ALL notebooks (client-side, see Search section)

### 3. Notebook Detail Page (`#notebook/{id}`)
- Header: notebook name, Edit (rename/recolor) and Delete buttons
- **Notebook-level search bar** — filters displayed notes client-side
- **Add Note** button → sets `window.currentNote = null`, navigates to `#note/new`
- Notes listed chronologically, **oldest at top**, newest at bottom
- Each note card shows:
  - Timestamp (e.g. "March 30, 2026 · 2:14 PM")
  - Body text — truncated to ~3 lines with a "Read more" link that navigates to `#note/{id}`
  - Thumbnail strip if photos are attached
  - Edit (pencil) icon → navigates to `#note/{id}` in edit mode
  - Delete (trash) icon → confirmation, then delete

### 4. Note Page (`#note/{id}` and `#note/new`) — Two Modes
**View mode** (default when opening an existing note):
- Displays full body text
- Displays attached photos below text
- Edit button → switches to edit mode
- Back button → returns to `#notebook/{id}` (via `window.currentNotebook`)
- Delete button with confirmation

**Edit mode** (new notes open directly in edit mode):
- Large textarea pre-filled with existing body (blank for new notes)
- Photo section at bottom:
  - Row of already-attached photos with individual delete
  - "Add Photo" button (same camera/gallery flow as rest of app)
- Save / Cancel buttons
- New note: `createdAt` set to now, not user-editable
- Edited note: `createdAt` preserved; `updatedAt` set silently

### 5. Note Deletion
- Confirmation: "Delete this note? This cannot be undone."
- On confirm: delete the note document and all its photos, decrement `noteCount` on the notebook

### 6. Notebook Deletion
- Cannot delete the "Default" notebook
- If notebook has notes: "This notebook contains X notes. Deleting it will permanently remove all notes and photos. Continue?"
- If empty: simpler confirm
- On confirm: delete all notes (and their photos), then the notebook document

---

## SecondBrain Action: ADD_NOTE

### Trigger phrases
"add a note", "jot down", "note that", "write a note", "add a [X] note about ..."

### What gets sent to the LLM
Along with the standard SecondBrain context payload, include:
- `notebookNames`: array of all current notebook names (e.g. `["Default", "Financial", "Garden Ideas"]`)
- The user's raw utterance

The LLM does **not** receive note body contents — just notebook names.

### LLM returned JSON
```json
{
  "action": "ADD_NOTE",
  "notebook": "Financial",
  "notebookRequested": "financial",
  "note": "Pay my taxes"
}
```
- `notebook`: the resolved notebook name from `notebookNames`, or `"Default"` if no match
- `notebookRequested`: the term the user implied, or `null` if no notebook was implied (plain "add a note")
- `note`: the extracted note body text

### Matching rules
- No notebook implied → `notebook: "Default"`, `notebookRequested: null`
- Notebook implied, match found → `notebook: "Financial"`, `notebookRequested: "financial"`
- Notebook implied, no match → `notebook: "Default"`, `notebookRequested: "finances"` (original term preserved)

### Confirmation UI
- Always shows: resolved notebook name, note body text
- If `notebookRequested` is not null **and** `notebook === "Default"` (i.e. fallback triggered):
  - Yellow warning banner: "Notebook 'finances' not found — will add to Default"
  - `<select>` dropdown pre-populated with all notebook names so user can redirect before confirming
- If `notebookRequested` is null or a match was found: no warning, no dropdown

### Fallback guarantee
- "Default" notebook always exists (created on first visit to `#notes`)
- SecondBrain never creates notebooks — only resolves to existing ones

### Checklist (same-commit rule applies)
Must update in the same commit: `SB_ICONS`, `SB_LABELS`, `SB_HELP_ACTIONS`, `_sbWrite()`, `_sbRenderConfirmFields()`

---

## Search Behavior

### Global search (`#notes` page)
- Firestore has no native full-text search — all notes are loaded into memory and filtered client-side
- Acceptable for personal use (low note volume)
- Search triggers on input (debounced ~300ms)
- Results shown as a flat list below the search bar: `[Notebook Name] · March 30, 2026 · 2:14 PM`
- Body text truncated to ~100 chars
- Clicking a result navigates to `#note/{id}` (full note page)

### Notebook-level search (`#notebook/{id}`)
- Notes for the open notebook are already loaded — filter in memory as user types
- Clears when input is emptied, restoring full list

---

## Firestore Data Model

### `notebooks` collection
| Field | Type | Notes |
|-------|------|-------|
| `name` | string | User-defined |
| `color` | string | CSS gradient key or hex, chosen on creation |
| `noteCount` | number | Denormalized — increment/decrement on note add/delete |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | Refreshed on any note add/edit/delete |

### `notes` collection
| Field | Type | Notes |
|-------|------|-------|
| `notebookId` | string | FK to `notebooks` |
| `body` | string | Full note text |
| `createdAt` | timestamp | Set once on creation; never changed |
| `updatedAt` | timestamp | Set on edits; null if never edited |

### Photos
- Use existing `photos` collection with `targetType: 'note'`, `targetId: {noteId}`
- Register `'note'` as a valid target type in `photos.js` container map

---

## Global State
| Variable | Set when | Used for |
|----------|----------|----------|
| `window.currentNotebook` | Entering `#notebook/{id}` | Back navigation from note page; "Add Note" target |
| `window.currentNote` | Entering `#note/{id}` or `#note/new` | Note page rendering and save logic |

---

## New File: `js/notes.js`
- Notebooks CRUD (create, rename, recolor, delete)
- Default notebook auto-creation on `#notes` entry
- Notes CRUD (add, view, edit, delete)
- Photo attachment (delegates to `photos.js`)
- Global search (load all notes, client-side filter)
- Notebook-level search (client-side filter on loaded notes)
- SecondBrain `ADD_NOTE` write handler

---

## HTML Sections Needed (`index.html`)
1. **Notes tile** in `#page-life` landing grid
2. **`#page-notes`** — notebooks list: global search bar + notebook tile grid
3. **`#page-notebook`** — notebook detail: header, search bar, note card list
4. **`#page-note`** — note page: view mode (body + photos + Edit/Delete/Back) and edit mode (textarea + photo section + Save/Cancel)
5. **Add/Edit Notebook modal** — name field + color picker swatches + save/cancel

---

## Navigation Routes (`app.js`)
| Hash | Page | Global state set |
|------|------|-----------------|
| `#notes` | Notebooks list | — |
| `#notebook/{id}` | Notebook detail | `window.currentNotebook` |
| `#note/{id}` | Note view/edit | `window.currentNote` |
| `#note/new` | New note (edit mode) | `window.currentNote = null` |

---

## Life Nav
- Add **"Notes"** link to `#lifeNav` alongside Journal, People, Chat, Settings

---

## CSS
- **Notes tile** (Life landing): indigo/purple gradient `linear-gradient(135deg, #6366f1, #a5b4fc)`
- **Notebook tiles**: color driven by the `color` field chosen at creation; use same `landing-tile` base class with an inline style override for the gradient
- **Note cards**: timestamp in muted text, body text with line clamp, thumbnail strip below
- **Note page**: clean reading layout, textarea fills available height in edit mode
- **Color picker swatches**: small colored circles in the Add Notebook modal (6–8 preset gradients to choose from)

---

## Decisions
| Question | Decision |
|----------|----------|
| Note editor UI | Full page — `#note/{id}` (view + edit modes) and `#note/new` |
| Notebook display | Tiles (`landing-tile` pattern) |
| Notebook tile color | User picks from preset swatches on creation; can recolor on edit |
| Default notebook | Named "Default"; auto-created on first visit; cannot be deleted |
| SecondBrain fallback | Falls back to "Default"; shows warning + notebook dropdown in confirmation if fallback was triggered by a failed match |
| LLM notebook resolution | Notebook names sent in context payload; LLM returns `notebook` + `notebookRequested` fields |
| Global search implementation | Client-side (load all notes, filter in memory) — acceptable at personal-use scale |

---

## Implementation Phases

### Phase N-1 — Data Layer & notes.js Scaffold
- Create `js/notes.js` with Firestore CRUD for `notebooks` and `notes`
- Default notebook auto-creation logic (called on `#notes` entry)
- `noteCount` increment/decrement helpers
- `window.currentNotebook` and `window.currentNote` state management
- Register `'note'` target type in `photos.js`

### Phase N-2 — HTML Structure & CSS
- Notes tile in `#page-life`
- `#page-notes`, `#page-notebook`, `#page-note` HTML sections
- Add/Edit Notebook modal with color picker swatches
- Life nav "Notes" link
- All CSS: tile colors, note cards, note page layout, color swatches

### Phase N-3 — Routing & Navigation
- Add `#notes`, `#notebook/{id}`, `#note/{id}`, `#note/new` routes to `app.js`
- Wire Life nav link
- Back navigation from note page → notebook page

### Phase N-4 — Notebooks CRUD
- Render notebook tiles on `#notes` page with note count + last updated
- Add Notebook (modal → Firestore write → tile appears)
- Edit Notebook (rename + recolor)
- Delete Notebook (with warning, blocks on Default)

### Phase N-5 — Notes CRUD
- Render note cards on `#notebook/{id}` (oldest first)
- Add Note (navigates to `#note/new`, saves to Firestore, updates notebook metadata)
- View Note (`#note/{id}` view mode)
- Edit Note (switches to edit mode, saves, returns to view mode)
- Delete Note (confirmation, deletes note + photos, decrements count)

### Phase N-6 — Photo Attachment
- Photo section on note page (view + edit modes)
- "Add Photo" using existing camera/gallery flow with `targetType: 'note'`
- Thumbnail strip on note cards in notebook detail
- Individual photo delete on note page

### Phase N-7 — Search
- Notebook-level search bar (client-side filter on loaded notes)
- Global search bar on `#notes` page (load all notes, client-side filter, results list)

### Phase N-8 — SecondBrain ADD_NOTE
- Add `notebookNames` to the SecondBrain LLM context payload
- Implement `ADD_NOTE` action: `SB_ICONS`, `SB_LABELS`, `SB_HELP_ACTIONS`, `_sbWrite()`, `_sbRenderConfirmFields()`
- Confirmation UI with optional warning banner + notebook redirect dropdown
