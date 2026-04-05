# Check-In & Places Feature — Plan

> **Status**: Planning — not yet implemented.
> **Last updated**: 2026-04-05

---

## Overview

Add the ability to tag a real-world **Place** to journal entries and activities. A quick **Check-In** flow (accessible from QuickLog) creates a journal entry stamped with a place, photos, and people — similar to a private Foursquare check-in. Places are stored as first-class entities so you can later click a place and see everything tied to it.

A new **Settings Hub** replaces the single settings page. It consolidates library/maintenance screens (Places, Products, Actions, Weeds) and removes clutter from all nav bars. Settings is accessible from every context nav.

---

## Part 1: Places Entity

A new `places` Firestore collection is the backbone of this feature. Every place you've ever checked into or tagged lives here. Other entities reference a place by its Firestore document ID.

### Firestore: `places`
| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Display name (e.g., "Home Depot") |
| `address` | string? | Full address — from reverse geocode, Foursquare, or manually entered |
| `lat` | number? | Latitude |
| `lng` | number? | Longitude |
| `category` | string? | Foursquare category (e.g., "Hardware Store", "Restaurant") |
| `foursquareId` | string? | Foursquare venue ID — used for dedup; if same ID found on new check-in, existing doc is reused |
| `status` | number | `1` = active, `0` = soft-deleted. All queries filter to `status == 1` |
| `createdAt` | timestamp | |

### Deduplication
- When a check-in or tag resolves to a Foursquare venue, the app queries `places` for a matching `foursquareId` before creating a new doc
- If found: reuse existing `places` doc (no duplicate created)
- If not found: create new doc
- Manually-added places (no `foursquareId`) are never auto-deduped — user manages those

### Soft Delete
- Places are never hard-deleted from Firestore
- A `status` field on each `places` doc controls visibility: `1` = active, `0` = deleted
- All queries filter to `status == 1` — deleted places are invisible to the UI
- Journal entries and activities that referenced a deleted place retain the `placeId` in their data; the place name simply won't resolve in the UI (shown as blank or omitted)
- New places default to `status: 1` on creation

### Routes
- `#places` — list of all saved places, searchable (accessed from Settings Hub)
- `#place/{id}` — place detail page (see Part 5)

---

## Part 2: Journal Entry Changes

### New field: `isCheckin`
- Type: `boolean`, default `false`
- Existing records that lack this field are treated as `false` on load (no migration needed)
- Drives the "📍 Check-In" badge in the journal feed

### New field: `placeIds[]`
- Type: `string[]` (array of `places` document IDs)
- Supports multiple places per journal entry (e.g., "went to Lowes then lunch at Smokey Bones")
- For check-ins, always a single place — but the model supports multiples for manual entries

### Updated Firestore schema for `journalEntries`
```
date, entryTime, entryText, mentionedPersonIds[], placeIds[], isCheckin,
sourceEventId?, createdAt, updatedAt
```

### UI changes to journal entry form
- Add a **Places** row below the People row
- Search box: type a place name → searches saved places first (Firestore, no API call), then optionally Foursquare by name
- "📍 Use my location" button: fires GPS → shows nearby Foursquare results to pick from
- Multiple places can be added as removable pills (same pattern as People tags)
- When writing a past entry at home: search by name — no GPS required

### Journal feed appearance
- Check-ins: show a **📍 Check-In** badge and place name(s) prominently at the top of the card
- Regular entries with a place: show place name(s) as a smaller tappable line below the entry text
- Place names are always tappable links → `#place/{id}`
- **Filter**: a toggle/button in the journal list header to show only check-ins

---

## Part 3: Quick Check-In Flow (QuickLog)

A new **📍 Check In** button in the QuickLog area starts a streamlined single-place journal entry.

### Flow
1. User taps **📍 Check In** in QuickLog
2. App requests GPS coordinates (Browser Geolocation API)
   - If GPS succeeds: Foursquare nearby search returns a list of venues to pick from
   - If GPS fails or no signal: fall through to manual place entry
3. User picks a place from the list — or types to search by name — or enters manually
4. Check-in form opens pre-populated with:
   - The selected place (single place only for check-ins)
   - Current date/time
   - `isCheckin: true`
5. User adds:
   - Comment/text (optional)
   - Photos (optional)
   - People (optional, same multi-select as journal)
6. Tap **Save** → journal entry created; place saved to `places` if new (dedup check first)

### No-Signal / Offline handling
- GPS coordinates come from the device hardware — work without cell signal
- The Foursquare lookup (venue names) requires connectivity
- Strategy: if offline, skip Foursquare, show manual place entry form; GPS lat/lng still captured
- Place saved with `foursquareId: null` if lookup was skipped

---

## Part 4: Manual "Add a Place"

Available from the Places maintenance screen (Settings Hub → Places).

### Flow
1. User taps "Add Place"
2. App captures current GPS coordinates
3. Attempts reverse geocode via **OpenStreetMap Nominatim** (free, no key required) to fill in address
4. Form shown with: Name (required), Address (pre-filled if reverse geocode succeeded, editable)
5. Save → stored in `places` with `foursquareId: null`
6. **LLM enrichment** runs automatically after save (see Part 4a)

### Part 4a: LLM Auto-Enrichment of Place Facts

After **any** new place is saved — whether from manual add, Foursquare check-in, or activity tag — the app silently calls the configured LLM in the background to enrich it with known facts. No review modal, no interruption — fully automatic.

**Trigger**: Fires once per new `places` document, regardless of source. Never re-fires on existing places unless the user manually triggers it from the place detail page (future enhancement). Silently skips if no LLM is configured.

**Timing**: Runs after the place doc is saved and the user is already moving on (non-blocking). Any returned facts appear on the place detail page the next time the user views it.

**Prompt sends**: name, address, GPS coordinates, Foursquare category (if available)

**Prompt instructs the LLM** (key framing):
> "You are enriching a place record with known factual data. Return only information you are confident is correct. It is perfectly acceptable — and preferred — to return null for any field you are unsure about. Do not guess, infer, or fabricate any values. A null is always better than a wrong answer."

**LLM asked to return** (JSON):
- `website` — official website URL (null if unknown)
- `phone` — phone number (null if unknown)
- `hours` — general hours (e.g., "Mon–Sat 9am–9pm") (null if unknown or likely stale)
- `facebook` — Facebook page URL (null if unknown)
- `google_maps` — Google Maps URL constructed from address/coordinates (null if neither available)

**After LLM responds**:
- Any non-null fields are saved automatically as Facts on the place (`targetType: 'place'`)
- If all fields null → silently skip, nothing saved
- No modal, no confirmation, no interruption to the user's flow
- Full Facts section always remains on the place detail page for manual edits/additions

---

## Part 5: Activity Changes

### New field: `placeId?`
- Type: `string?` (single place — activities are one-place)
- Optional — most activities won't have a place
- On save: if it's a new place, dedup check first, then create if needed

### UI
- Activity form gets an optional **Place** field with the same search UX (saved places first, then Foursquare text search)
- Activity detail/list view: show place name as a tappable link → `#place/{id}`

---

## Part 6: Place Detail Page (`#place/{id}`)

Clicking any place name anywhere in the app navigates here.

### Shows
- Place name, category, address
- **Interactive Leaflet map** (Leaflet.js already in the project) with a pin at the place's lat/lng
  - Supports pinch-to-zoom and pan
  - If lat/lng are null: map is hidden, address shown only
- **Edit button**: opens an edit form (see below)
- **Photos section**: same shared photo gallery used across the app (`targetType: 'place'`) — camera, gallery, paste upload; photo viewer with zoom/crop/download
- **Facts section**: same shared Facts feature (`targetType: 'place'`) — any label/value, URLs auto-render as clickable links
- **Journal entries** at this place (newest first, tappable → journal entry)
- **Activities** at this place (newest first, tappable → source entity)
- Summary line: "5 check-ins · 2 activities"

### Edit form fields
- Name (required)
- Address (optional)
- Coordinates: shown read-only; a "Re-capture GPS" button refreshes from current device location

---

## Part 7: Foursquare Integration

### API
- **Foursquare Places API v3** (free tier: 1,000 calls/day — sufficient for personal use)
- Endpoints used:
  - `GET https://api.foursquare.com/v3/places/nearby` — GPS-based nearby search
  - `GET https://api.foursquare.com/v3/places/search?query=...` — name-based search
- API key stored in `userCol('settings').doc('places')` — same pattern as LLM key storage

### One-time setup (user does this once)
1. Go to `https://foursquare.com/developer` → create a free account
2. Create a new app → copy the API key
3. In Bishop → Settings Hub → General Settings → paste the Foursquare API key
4. Done — all place searches will use it automatically

### Search priority order
| Priority | Source | When |
|----------|--------|------|
| 1st | Saved places (Firestore) | Always checked first — no API call |
| 2nd | Foursquare nearby (GPS) | Check-in flow when GPS available |
| 3rd | Foursquare text search | Typing a name in any place field |
| Fallback | Manual entry | No key, no signal, or place not found |

### Fallback
If no API key is configured, or the call fails, user can manually enter name + address. Place saved without `foursquareId`.

---

## Part 8: Settings Hub

The current single Settings page becomes a **Settings Hub** at `#settings`.

### Layout
Card-based screen (same style as the Home screen). Each card navigates to its destination.

### Cards
| Card | Route | Notes |
|------|-------|-------|
| ⚙️ General Settings | `#settings-general` | Everything currently on the Settings page (LLM config, Foursquare key, etc.) |
| 📍 Places | `#places` | New — place list, add/edit/delete |
| 🧪 Products | `#chemicals` | Moved from Yard nav |
| ⚡ Saved Actions | `#actions` | Moved from Yard nav |
| 🌿 Weeds | `#weeds` | Moved from Yard nav |

### Nav bar changes
- **Weeds, Products (chemicals), and Saved Actions are removed from ALL context nav bars** (Yard and any others they appear in)
- **Settings link added to ALL context nav bars** that don't already have it — Yard, House, Life, and any others
- Existing routes (`#chemicals`, `#actions`, `#weeds`) are unchanged — deep links still work
- The `#settings` route now loads the hub; `#settings-general` loads the current settings content

---

## Part 9: SecondBrain Action — CHECK_IN

A new `CHECK_IN` action added to SecondBrain. Must follow the full SecondBrain new-action checklist in `CLAUDE.md` (icons, labels, help screen, confirmation fields, target types, navigation).

### Example utterances
- "Check in at Smokey Bones"
- "I'm at Home Depot"
- "Check in here" (uses GPS to find nearest place)
- "Log that I'm at the dentist"

### Behavior
- LLM extracts: place name (or "here" for GPS-based lookup)
- SecondBrain resolves the place (searches saved places first, then Foursquare by name/GPS)
- Navigates directly to the **full check-in form** with the place pre-filled — same screen as the QuickLog Check In flow
- User can then add comment, photos, and people before saving
- **The place is NOT saved to `places` until the user presses Save** — if they cancel, nothing is written
- LLM enrichment fires after Save (same as all other new place saves)

---

## Part 10: Implementation Phases

---

### Phase 1 — Settings Hub + Foursquare API Key Setup
**Goal**: Clean up the nav bars, create the Settings Hub, and get the Foursquare key configured before any place lookups are needed.

**Work:**
- Create a new `#settings` hub page — card grid (same style as Home screen) with:
  - ⚙️ General Settings → `#settings-general`
  - 📍 Places → `#places` (placeholder until P2)
  - 🧪 Products → `#chemicals`
  - ⚡ Saved Actions → `#actions`
  - 🌿 Weeds → `#weeds`
- Move the current `#settings` page content to `#settings-general`
- Remove Weeds, Products, and Saved Actions from ALL nav bars across the entire app
- Add a ⚙️ Settings link to every nav bar that doesn't already have one (Yard, House, Life, etc.)
- Add a **Foursquare API Key** field to the General Settings page, stored in `userCol('settings').doc('llm')` alongside the existing LLM key
- Add a **Help** button next to the Foursquare key field — opens a modal with step-by-step instructions:
  1. Go to `https://foursquare.com/developer`
  2. Sign up for a free account (or log in)
  3. Click "Create a New App"
  4. Give it any name (e.g., "MyLife")
  5. Copy the API Key shown on the app page
  6. Paste it into the field here and tap Save
  - Modal also notes: free tier allows 1,000 lookups/day, no credit card required

**Files affected**: `app.js`, `index.html`, `styles.css`, settings JS file, all nav bar HTML sections

---

### Phase 2 — Places Collection + Maintenance Screen
**Goal**: Build the `places` data layer and give the user a way to view, add, edit, and soft-delete places.

**Work:**
- Create `places.js` — all place CRUD logic
- `#places` page: alphabetical list of active places (status == 1), search filter at top, "Add Place" button
- **Add Place flow**:
  1. Capture GPS coordinates (Browser Geolocation API)
  2. Attempt reverse geocode via OpenStreetMap Nominatim (free, no key)
  3. Show form: Name (required), Address (pre-filled if geocode succeeded, editable)
  4. Save → writes to `places` with `status: 1`, fires LLM enrichment in background (P3 prerequisite — enrichment wired in P3)
- **Edit Place**: Name and Address fields; read-only coordinate display; "Re-capture GPS" button
- **Delete Place**: Sets `status: 0` (soft delete) — no confirmation needed beyond a simple tap
- `#place/{id}` route created as a stub (full detail page built in P6)

**Files affected**: `places.js` (new), `index.html`, `styles.css`, `app.js`

---

### Phase 3 — Foursquare Integration + LLM Enrichment + Search Utilities
**Goal**: Build the shared place-search and enrichment utilities that all later phases will call.

**Work:**
- `placesSearch(query)` utility function:
  1. Searches saved `places` (Firestore) first — returns matches instantly
  2. If Foursquare key configured: calls Foursquare text search API
  3. Returns merged list, deduped by `foursquareId`
- `placesNearby(lat, lng)` utility function:
  1. Calls Foursquare nearby API with coordinates
  2. Dedup check against existing `places` docs
  3. Returns list of venue objects (name, address, category, foursquareId)
- `placesSaveNew(venueObj)` utility function:
  1. Dedup check — if `foursquareId` already in `places`, returns existing doc ID
  2. Otherwise writes new `places` doc with `status: 1`
  3. Fires `placesEnrichWithLLM()` in background (non-blocking)
- `placesEnrichWithLLM(placeId)` utility function:
  1. Loads place doc, builds enrichment prompt
  2. Calls configured LLM with null-preferring instructions
  3. Saves any non-null returned values as Facts (`targetType: 'place'`, `targetId: placeId`)
  4. Silently skips if LLM not configured or all fields null
- Wire `placesEnrichWithLLM()` into the Phase 2 "Add Place" save flow

**Files affected**: `places.js`, `firebase-config.js` (if utility helpers needed)

---

### Phase 4 — Journal Entry: Places + Check-In Flag
**Goal**: Add place tagging and the check-in distinction to journal entries.

**Work:**
- Add `placeIds[]` and `isCheckin` fields to `journalEntries` Firestore writes
- Journal entry form (`#journal-entry`):
  - Add **Places** row below People row
  - Inline search: type to search saved places + Foursquare by name
  - "📍 Use my location" button: GPS → `placesNearby()` → pick from list
  - Selected places shown as removable pills
- Journal feed (`#journal`):
  - Check-in cards: show **📍 Check-In** badge and place name(s) prominently
  - Regular entries with places: show place name(s) as tappable secondary line
  - All place names tappable → `#place/{id}`
  - Add **"Check-Ins only"** filter toggle in the journal list header
- Existing journal entries without `placeIds` or `isCheckin` default gracefully (empty array / false)

**Files affected**: `journal.js`, `index.html`, `styles.css`

---

### Phase 5 — Quick Check-In Flow (QuickLog)
**Goal**: The primary check-in entry point — fast, GPS-first, lands on a streamlined form.

**Work:**
- Add **📍 Check In** button to the QuickLog area
- Tapping it:
  1. Requests GPS coordinates
  2. If GPS succeeds: calls `placesNearby()` → shows scrollable venue list to pick from
  3. If GPS fails or no signal: shows manual place entry (name + address)
  4. User can also type to search by name at any point
- On place selection: navigate to a **Check-In form** (reuses journal entry form with `isCheckin: true` preset, single-place only, place pre-filled and locked)
- Form has: comment textarea, Photos section, People multi-select, date/time (defaults to now, editable)
- Save: calls `placesSaveNew()` (dedup + enrichment), writes journal entry with `isCheckin: true`

**Files affected**: `journal.js`, `app.js`, `index.html`, `styles.css`

---

### Phase 6 — Place Detail Page
**Goal**: Build the full `#place/{id}` page that everything links to.

**Work:**
- Upgrade the Phase 2 stub to a full detail page:
  - Place name, category, address
  - **Interactive Leaflet map** with a pin (hidden if lat/lng null)
  - Edit button → edit form (name, address, re-capture GPS)
  - **Photos section** (shared photo gallery, `targetType: 'place'`)
  - **Facts section** (shared Facts feature, `targetType: 'place'`) — LLM-enriched facts appear here
  - **Journal entries** at this place: newest first, tappable → journal entry page
  - **Activities** at this place: newest first, tappable → source entity
  - Summary line: "X check-ins · Y activities"

**Files affected**: `places.js`, `index.html`, `styles.css`

---

### Phase 7 — Activity Form: Optional Place Field
**Goal**: Let activities be tied to a place (e.g., tire shop for a vehicle service).

**Work:**
- Add optional **Place** field to the log activity modal
- Same search UX as journal (saved places first, then Foursquare text search)
- Single place only per activity
- Activity list rows: show place name as small secondary tappable line if set
- Activity detail: show place name as tappable link → `#place/{id}`
- Writes `placeId?` to `activities` Firestore doc on save; calls `placesSaveNew()` if new

**Files affected**: `activities.js`, `index.html`, `styles.css`

---

### Phase 8 — SecondBrain CHECK_IN Action
**Goal**: Voice/text shortcut that resolves the place and lands you on the check-in form.

**Work:**
- Add `CHECK_IN` to SecondBrain — full checklist from `CLAUDE.md`:
  - Handler in `_sbWrite()` switch
  - Confirmation fields in `_sbRenderConfirmFields()`
  - Entry in `SB_ICONS` and `SB_LABELS`
  - Entry in `SB_HELP_ACTIONS` (icon, label, desc, 2–4 examples)
  - Navigation case in `_sbNavigateTo()`
- LLM extracts place name from utterance (or "here" → trigger GPS)
- SecondBrain resolves place via `placesSearch()` or `placesNearby()`
- Navigates to the check-in form with place pre-filled (same form as Phase 5)
- Place is NOT written to Firestore until user presses Save on the check-in form

**Files affected**: `secondbrain.js`, `index.html`

---

### Phase 9 — Functional Spec Update
**Goal**: Keep `MyLife-Functional-Spec.md` as the source of truth.

**Work:**
- Add a new **Places** section covering: Firestore schema, routes, place detail page, soft delete, dedup logic, photos, facts, LLM enrichment
- Update **Journal** section: `placeIds[]`, `isCheckin`, check-in badge/filter in feed, place pills in entry form
- Update **Activities** section: `placeId?` field, place search in log modal
- Update **Settings** section: Settings Hub layout, card list, nav bar changes, Foursquare key field + Help button
- Update **SecondBrain** section: `CHECK_IN` action, example utterances, behavior
- Update **QuickLog** section: Check In button and flow
- Update **Firestore Data Model** table: `places` collection, updated `journalEntries` and `activities` schemas
- Update **Navigation** table: nav bar changes (Settings added, Weeds/Products/Actions removed)

---

## Resolved Decisions

- **Settings nav**: ⚙️ gear icon in all nav bars (saves space on mobile)
- **Place Facts**: Full shared Facts feature — any label/value. URLs auto-render as clickable links.
- **Place Photos**: Full shared photo gallery — same as all other entities.
- **LLM enrichment**: Fully automatic, no review modal, non-blocking. Fires after every new place save. Silently skips if all null or no LLM configured.
- **Dedup**: Foursquare ID match = reuse existing `places` doc. Manually-added places not auto-deduped.
- **Soft delete**: `status` field — `1` active, `0` deleted. All queries filter to active only. No hard deletes.
- **Map**: Interactive Leaflet map on place detail; hidden if lat/lng are null.
- **SecondBrain CHECK_IN**: Resolves the place, navigates to the full check-in form pre-filled. Place not saved until user presses Save. Enrichment fires on Save.
- **Places list**: Sorted alphabetically, search filter at top.
- **Foursquare key storage**: Stored alongside LLM key in `userCol('settings').doc('llm')` — one settings doc, multiple fields.

## Open Questions

1. **Any remaining feature ideas** — drop them here when ready to fold them in.
