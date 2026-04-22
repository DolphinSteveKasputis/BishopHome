# HelpPlan.md — In-App Help System

## Problem Statement
No one really knows how to use this app. There is no onboarding, no tooltips,
no guidance. A new user (or the primary user returning after a gap) has no way
to figure out what a screen does or how to perform common tasks without reading
source code or plan documents.

---

## Proposed Solution (two-part)

### Part 1 — Context-Aware Help Button in Nav Bar
A single `?` help link is added to each of the app's existing section nav bars
(Yard, House, Life, Health, etc.). The button reads `window.location.hash` at
click time and navigates to `#help/screenName`, opening the correct help page
for whatever screen the user is currently on.

**Why nav bar instead of per-screen buttons:**
- One implementation point instead of dozens
- Always visible regardless of scroll position
- Keeps individual screen headers clean
- Context-aware via the hash — no per-screen wiring needed

**[skip] screens** (Settings, Change Password, Firebase Setup, Dev Notes, etc.):
`?` navigates to `#help/main` — the general "Getting Started" landing.

### Part 2 — Master Help Document (`AppHelp.md`)
Single Markdown file, checked into the repo. One source of truth.
- Covers every screen and feature
- Per-screen sections feed the Help Page display
- Full file feeds the LLM
- Updated same-commit as any feature change (no exceptions)

---

## Storage Architecture — Single File, Runtime Parse

**The core tension:** each screen's help page shows only its own content, but
the LLM needs the entire file.

**Solution: one file, sections parsed at runtime.**

### How it works

`AppHelp.md` uses a keyed section header convention:
```markdown
## screen:plant
[plant help content]

## screen:zone
[zone help content]

## screen:health-visits
[health visits help content]
```

A `js/help.js` module:
1. Fetches `AppHelp.md` once on first access and caches the full string in memory
2. Exposes `getHelpSection(screenName)` — parses out the `## screen:X` block
   matching the current route and returns just that text
3. Exposes `getAllHelp()` — returns the full cached string for LLM calls

### Why this is the right approach
- **Zero duplication** — one file, no separate JS data object to keep in sync
- **Single source of truth** — edit `AppHelp.md`, both display and LLM update automatically
- **Works on static site** — `fetch('AppHelp.md')` works fine on GitHub Pages
- **Simple runtime parsing** — split on `## screen:` headers, extract the matching block
- **LLM gets everything** — `getAllHelp()` is the full string, no concatenation needed
- **Human-readable** — the file is clean Markdown, easy to read and maintain

### What a section looks like in `AppHelp.md`
```markdown
## screen:plant

**What this screen is for:** Track an individual plant — its location, care
history, photos, problems, and metadata.

**Key concepts:**
- Each plant is a separate record (3 azalea bushes = 3 plant records)
- Activities are logged events (watering, fertilizing, pruning, etc.)
- Facts are free-form notes (bloom season, sun preference, when planted)
- Problems track open issues (pest damage, disease) and can be resolved

**Common tasks:**
- Add an activity: tap "Log Activity" and choose what was done
- Add a photo: tap "Photos" → "Add Photo"
- Edit plant name or zone: tap "Edit" at the top
- Move plant to a different zone: Edit → change the zone picker

**Tips:**
- Use Saved Actions to avoid retyping common activities (e.g., "Monthly spray")
- Problems stay open until you mark them resolved
```

### Sections that don't map 1:1 to a screen
Some concepts span multiple screens (Photos, Facts, Activities, Problems,
Quick Tasks). These get general sections:
```markdown
## screen:main
## concept:photos
## concept:activities
## concept:facts
## concept:problems
## concept:quicktasks
```

The help page router maps route names → section keys. Unmapped routes fall
back to `main`.

---

## Help Page UX

Route: `#help/screenName`

```
┌─────────────────────────────────────────┐
│  Help: [Screen Name]           [✕ Close]│
│─────────────────────────────────────────│
│  [? Ask AI ▸]  (toggles input visible) │
│                                         │
│  ── Q&A thread (newest first) ──        │
│  ┌──────────────────────────────────┐   │
│  │  Type a question...       [Send] │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Q: How do I add a plant?        │   │
│  │  A: Go to Yard → pick your zone  │   │
│  └──────────────────────────────────┘   │
│  [Show 2 earlier questions ▾]           │  ← after 3 Q&A pairs
│─────────────────────────────────────────│
│  ── Static help text (from AppHelp.md) ─│
│  What this screen is for...             │
│  Key concepts, common tasks, tips...    │
└─────────────────────────────────────────┘
```

**Behavior:**
- Static content shown immediately on load (read first, ask second)
- "Ask AI" button toggles the input row visible/hidden
- Questions search the entire `AppHelp.md` — not limited to current screen
- Q&A thread appends, newest at top
- After 3 Q&A pairs: oldest auto-collapse into "Show N earlier" toggle
- Each LLM call is stateless (full AppHelp.md + current question — no history)
- Stateless means self-contained questions work best; "tell me more" won't work
- Close / ✕ = browser back

---

## LLM Two-Stage Flow

### Entry Point 1 — Help Page "Ask AI"
Direct LLM call (bypasses SecondBrain):
- System: full `AppHelp.md` + "answer from this content only, be concise"
- User: the typed question
- Answer appends to Q&A thread on Help Page

### Entry Point 2 — SecondBrain `ASK_HELP` action
Stage 1: SecondBrain's existing classification call returns:
```json
{ "action": "ASK_HELP", "originalPrompt": "how do I add a plant" }
```
Stage 2: App fires second LLM call with full `AppHelp.md` + `originalPrompt`.
Answer displays as a styled "Help" reply inline in SecondBrain chat (distinct
background/label). User stays in SecondBrain.

Trigger is broad — implicit confusion ("I can't find my plants") routes to
`ASK_HELP` as safely as explicit "how do I" questions.

---

## Phased Delivery Plan

**Phase 1 — Yard & Garden (current)**
- Author all Yard & Garden sections in `AppHelp.md`
- Build `js/help.js` (fetch, cache, parse)
- Build `#help` route + Help Page UI (static content + Ask AI + Q&A thread)
- Add `?` to Yard nav bar
- Wire direct LLM call from Help Page
- Test end-to-end with Yard screens

**Yard screens with dedicated sections:**
- `zone` — Zone detail (hierarchy, logging at zone level)
- `plant` — Plant detail (all sub-features)
- `weeds` — Weed type list
- `weed` — Weed detail
- `chemicals` — Chemicals list
- `chemical` — Chemical detail
- `actions` — Saved Actions (concept is non-obvious)
- `calendar` — Calendar events
- `activityreport` — Activity report
- `gpsmap` — GPS map
- `yardmap` — Yard map
- `yard-problems` — Problems list
- `yard-projects` — Quick tasks
- `main` — Landing page (general orientation)

**Plus shared concept sections (used across all sections):**
- `concept:activities` — what activities are, how to log them, chemicals
- `concept:photos` — adding/viewing/deleting photos
- `concept:facts` — what facts are, add/edit/delete
- `concept:problems` — open/resolved lifecycle
- `concept:quicktasks` — tasks with checklists
- `concept:savedactions` — reusable templates

**Phase 2 — House** (after Yard is tested and approved)
**Phase 3 — Health** (after House approved)
**Phase 4 — Life, Notes, Contacts** (after Health approved)
**Phase 5 — Vehicles, Garage, Structures, Collections** (after Phase 4 approved)
**Phase 6 — SecondBrain `ASK_HELP` action** (after all content is authored)

Testing gate: user tests each phase before the next begins.

---

## Decisions Made

| # | Decision |
|---|----------|
| 1 | Single `AppHelp.md` file — one source of truth, no duplication |
| 2 | Runtime parse: `fetch` once, cache, extract sections by `## screen:X` key |
| 3 | `getAllHelp()` returns full string for LLM; `getHelpSection(name)` returns subset for display |
| 4 | Help button lives in nav bar (`?` text), reads current hash at click time |
| 5 | [skip] screens → `?` navigates to `#help/main` |
| 6 | Full-screen route `#help/screenName` |
| 7 | Static help shown first; Ask AI is supplemental |
| 8 | Q&A appends newest-first; 3+ pairs → auto-collapse older ones |
| 9 | Stateless LLM calls (full AppHelp.md + current question only) |
| 10 | SecondBrain `ASK_HELP` → styled Help reply inline in SecondBrain chat |
| 11 | Broad trigger for `ASK_HELP` — implicit confusion counts |
| 12 | Phased delivery — Yard first, user tests before next phase begins |
| 13 | Claude drafts all content; user approves |
| 14 | AppHelp.md updated same-commit as any feature change |

---

## Sync Guarantee

**The single-file architecture makes display and LLM automatically in sync —
there is no second file to drift.** The only sync risk is between the app's
features and `AppHelp.md`.

### Rule (mirrors the Functional Spec rule)
Any time a feature is added, changed, or removed:
1. Update the relevant `## screen:X` section in `AppHelp.md`
2. Include it in the **same commit** as the code change
3. Tell the user which section(s) were updated

This is enforced in `CLAUDE.md` as required behavior — same discipline as
`MyLife-Functional-Spec.md`. No exceptions for minor changes.

Shared concept sections (`## concept:activities`, `## concept:photos`, etc.)
must also be updated if the shared behavior changes.

---

## Open Questions (none blocking — ready to build Phase 1)

- None. All blocking decisions are resolved.
- Authoring order within Yard: start with the most-used screens (`plant`,
  `zone`, `calendar`) then fill in the rest.

---

## Status
- [x] Problem defined
- [x] Storage architecture decided (single file, runtime parse)
- [x] Help page UX designed
- [x] LLM flow designed (both entry points)
- [x] Phased delivery plan defined
- [x] All blocking decisions resolved
- [ ] **Phase 1: Author Yard & Garden sections in AppHelp.md**
- [ ] Phase 1: Build `js/help.js` (fetch, cache, parse)
- [ ] Phase 1: Build `#help` route + Help Page HTML/CSS
- [ ] Phase 1: Add `?` to Yard nav bar
- [ ] Phase 1: Wire direct LLM call from Help Page
- [ ] Phase 1: User tests Yard help end-to-end
- [ ] Phase 2: House
- [ ] Phase 3: Health
- [ ] Phase 4: Life, Notes, Contacts
- [ ] Phase 5: Vehicles, Garage, Structures, Collections
- [ ] Phase 6: SecondBrain `ASK_HELP` action + Stage 2 LLM call
