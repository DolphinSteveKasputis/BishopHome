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

**Content depth requirement:** `### Details` sections must be exhaustive. Include
every button, every field, every edge case, every tip, every shortcut. The richer
AppHelp.md is, the better the AI can answer nuanced follow-up questions. When in
doubt, write more — never truncate because a detail seems obvious.

---

## Storage Architecture — Single File, Runtime Parse

`AppHelp.md` uses a keyed section header convention:
```markdown
## screen:plant
[plant help content]

## screen:zone
[zone help content]

## concept:photos
[concept content]
```

`js/help.js`:
1. Fetches `AppHelp.md` once on first access and caches the full string in memory
2. `_helpParseSection(fullText, key)` — extracts the `## screen:X` or `## concept:X` block
3. Full file is injected as system context for every LLM call

**Why single file:** Zero duplication. Edit `AppHelp.md` once and both the
per-screen display and the LLM automatically see the update.

---

## Help Page UX — Implemented

Route: `#help/{screenName}` — handled by `app.js` router, calls `loadHelpPage(screenName)`.

### Page Header
```
┌────────────────────────────────────────────────────┐
│  Help: [Screen Name]    [☰ Topics]  [? Ask AI]     │
└────────────────────────────────────────────────────┘
```
- **☰ Topics** — navigates to the section-specific topic index (see below)
- **? Ask AI** — toggles the Q&A input panel open/closed; redirects to
  `#help/settings` if no LLM is configured (instead of showing an error)

### Content Layout — Quick Help / Details Split
Each screen's `AppHelp.md` section uses three optional sub-sections:

```markdown
### Quick Help
- Scannable bullet summary of what this screen is for
- Key things you can do here
- One shortcut or power-user tip

### Details
[Exhaustive content — every field, every button, every edge case, every workflow.
The Details section should leave nothing out. Users who click "Show more" want
the full picture, not a medium-length answer.]

### See Also
- [Related Screen](#help/related-screen)
- [Another Topic](#help/other-topic)
```

**Rendering:**
- `### Quick Help` — always visible immediately on page load
- `### Details` — hidden behind a **"Show more ▾"** toggle button. Clicking
  expands in-place. Clicking again collapses ("Show less ▴"). The intent is
  that the quick bullets let you get oriented fast, and Details is there when
  you need depth.
- `### See Also` — rendered as a styled blue-tinted link box at the bottom of
  the static content area. Clicking a See Also link navigates within the help
  system (changes the hash, triggers the router, loads the new help page).

### Q&A Thread (Ask AI)
- Q&A pairs append below the input, newest first
- After 3 visible pairs, older ones collapse into "Show N earlier questions ▾"
- Each LLM call includes the full prior conversation as history (user/assistant
  turns), so follow-up questions like "where exactly is that?" work correctly
- Error responses are excluded from history so they don't confuse the model
- Enter key sends; Shift+Enter inserts a newline

### LLM Configuration Check
- When "? Ask AI" is clicked, `_helpCheckLlm()` does a one-time Firestore check
  for a saved API key
- If not configured → navigates to `#help/settings` instead of opening the panel
- `helpSendQuestion()` has the same redirect as a safety net
- The check result is cached per page visit (`_helpLlmConfigured`), reset on
  each `loadHelpPage()` call so a user who just saved their key picks it up

---

## Topics Index — Context-Aware (PLANNED — not yet built)

### Current behavior (Phase 1 implementation)
`☰ Topics` navigates to `#help/main`, which renders a full grid of every topic
across all app sections (Yard, House, Life, Health, etc.).

### Desired behavior
**The Topics page should show only the topics for the major section the user
is currently in.** If you're in a yard screen (zone detail, plant, weeds, etc.)
and tap Topics, you see Yard & Garden topics. If you're in a house screen, you
see House topics.

**Cross-section navigation:** At the top or bottom of each section topics page,
show links to the other major sections' topic pages, so the user can jump across
if they need help from a different area.

**Proposed routing:**
- `#help/topics-yard` — Yard & Garden topics only + cross-section links
- `#help/topics-house` — House topics only + cross-section links
- `#help/topics-life` — Life topics only + cross-section links
- `#help/topics-health` — Health topics only + cross-section links
- `#help/topics-vehicles` — Vehicles/Garage/Structures topics only + links
- etc.

**How the Topics button determines the section:**
The `openHelpForCurrentScreen()` function already reads the current hash. A
helper `_helpMajorSection(screenName)` maps screen names to their major section
and the Topics button calls the section-specific topics route.

Example mapping:
- `zone`, `plant`, `zones`, `weeds`, `weed`, `chemicals`, `chemical`, `actions`,
  `calendar`, `activityreport`, `yard-problems`, `yard-projects` → `topics-yard`
- `house`, `floor`, `room`, `thing`, `floorplan` → `topics-house`
- `journal`, `contacts`, `notes`, `life`, `lifecalendar` → `topics-life`
- `health`, ... → `topics-health`
- `vehicles`, `garage`, `structures` → `topics-vehicles`

**Cross-section link placement:** To be decided during implementation. Candidates:
- Top: breadcrumb-style "▸ Also: House | Life | Health" bar
- Bottom: "Browse other sections:" grid of section cards
- Likely answer: a compact row at the top (faster to see) + small footer links

**`#help/main`** is the launch point for all major sections — shows each major
section (Yard, House, Life, Health, Vehicles, etc.) as a clickable card or link.
Clicking a section navigates to its section-specific topics page (`#help/topics-yard`,
etc.). The Getting Started content remains below the section cards as before.

---

## LLM Call Architecture

### Entry Point 1 — Help Page "Ask AI"
- System prompt: full `AppHelp.md` + "answer from this content only, be concise"
- Messages: system + all prior answered Q&A pairs + current question
- Providers: OpenAI (`gpt-4o`) and Grok (`grok-3`); config from `userCol('settings').doc('llm')`
- Always uses `max_completion_tokens` — never `max_tokens`

### Entry Point 2 — SecondBrain `ASK_HELP` action (Phase 6 — not yet built)
Stage 1: SecondBrain's existing classification call returns:
```json
{ "action": "ASK_HELP", "originalPrompt": "how do I add a plant" }
```
Stage 2: App fires second LLM call with full `AppHelp.md` + `originalPrompt`.
Answer displays as a styled "Help" reply inline in SecondBrain chat.
Trigger is broad — implicit confusion ("I can't find my plants") routes to
`ASK_HELP` as safely as explicit "how do I" questions.

---

## AppHelp.md — Content Guidelines

**Depth rule:** `### Details` sections must be exhaustive. Never cut a detail
because it seems obvious. The LLM can only answer questions it has context for —
thin content = thin answers. Guidelines for each screen's Details:
- Every button and what it does
- Every field and what it accepts
- Every workflow (create → edit → delete lifecycle)
- Edge cases (what can't you delete? what happens when you resolve a problem?)
- How this screen relates to others (rollup data, shared concepts)
- Tips that a new user would not discover on their own
- Shortcuts and power features (QuickLog, AI identification flows, etc.)
- Mobile-specific behavior where it differs

**Concept sections** (`## concept:X`) should explain the concept as if to someone
who has never used the app, covering the full lifecycle and all screens where the
concept appears.

**Maintenance rule:** `AppHelp.md` is updated in the same commit as any feature
change. No exceptions. Even small changes (renamed button, new field) must be
reflected. The spec and the help file are updated together.

---

## Section Map — Screens and Their Section Keys

### Yard & Garden (complete)
| Screen | Key | Status |
|--------|-----|--------|
| Yard Home / Zones | `zones` | ✅ |
| Zone Detail | `zone` | ✅ |
| Plant Detail | `plant` | ✅ |
| Weeds List | `weeds` | ✅ |
| Weed Detail | `weed` | ✅ |
| Chemicals List | `chemicals` | ✅ |
| Chemical Detail | `chemical` | ✅ |
| Saved Actions | `actions` | ✅ |
| Calendar Events | `calendar` | ✅ |
| Activity Report | `activityreport` | ✅ |
| GPS Map | `gpsmap` | ✅ (stub) |
| Yard Map | `yardmap` | ✅ (stub) |
| Yard Problems | `yard-problems` | ✅ |
| Yard Quick Tasks | `yard-projects` | ✅ |
| Getting Started / Main | `main` | ✅ |
| Settings & AI Setup | `settings` | ✅ |

### Shared Concepts (complete)
| Concept | Key | Status |
|---------|-----|--------|
| Activities | `concept:activities` | ✅ |
| Photos | `concept:photos` | ✅ |
| Facts | `concept:facts` | ✅ |
| Problems | `concept:problems` | ✅ |
| Quick Tasks | `concept:quicktasks` | ✅ |

### House (Phase 2 — not started)
- `house`, `floor`, `room`, `thing`, `floorplan`, `floorplanitem`

### Health (Phase 3 — not started)
- `health`, `health-vitals`, `health-medications`, `health-visits`,
  `health-conditions`, `health-bloodwork`, `health-insurance`

### Life (Phase 4 — complete)
| Screen | Key | Status |
|--------|-----|--------|
| Life Home | `life` | ✅ |
| Journal | `journal` | ✅ |
| Contacts | `contacts` | ✅ |
| Notes | `notes` | ✅ |
| Life Calendar | `lifecalendar` | ✅ |

### Vehicles / Garage / Structures / Collections (Phase 5 — complete)
| Screen | Key | Status |
|--------|-----|--------|
| Vehicles | `vehicles` | ✅ |
| Garage | `garage` | ✅ |
| Structures | `structures` | ✅ |
| Collections | `collections` | ✅ |

---

## Phased Delivery Plan

**Phase 1 — Yard & Garden ✅ COMPLETE**
- [x] Author all Yard & Garden sections in `AppHelp.md`
- [x] Build `js/help.js` (fetch, cache, parse, `_helpParseSection`)
- [x] Build `#help` route + Help Page HTML/CSS
- [x] Add `?` to all desktop and mobile nav bars (Yard, House, Life, Thoughts)
- [x] Wire direct LLM call from Help Page (stateful — conversation history passed)
- [x] Quick Help / Details split with Show more ▾ toggle
- [x] See Also links parsed from `### See Also` sub-section, rendered as styled box
- [x] Topics index at `#help/main` — full-app grid of clickable topic links
- [x] `☰ Topics` button in help page header
- [x] LLM config check — redirects to `#help/settings` when key not saved
- [x] `#help/settings` content page authored (LLM setup guide)
- [x] Concept section aliases (`concept-activities` → `concept:activities`)
- [x] Enter key sends; Shift+Enter inserts newline
- [x] `MyLife-Functional-Spec.md` updated with Part 12a (In-App Help System)
- [x] `CLAUDE.md` updated with AppHelp.md maintenance rule

**Phase 1b — Context-Aware Topics Index (PLANNED — next to build)**
- [ ] Add `_helpMajorSection(screenName)` mapping helper
- [ ] Add section-specific topic routes (`topics-yard`, `topics-house`, etc.)
- [ ] Update `☰ Topics` button to navigate to the correct section topics page
- [ ] Add cross-section breadcrumb links to each topics page (other major sections)
- [ ] Decide: top bar vs. bottom links for cross-section nav (decide at build time)
- [ ] Update `HELP_TOPIC_MAP` to organize by section for per-section rendering

**Phase 2 — House** (after Phase 1b approved)
- Author `## screen:` sections for all House screens
- Add House screens to `HELP_TOPIC_MAP`
- Test end-to-end with House nav

**Phase 3 — Health ✅ COMPLETE**
- health, health-appointments, health-visits, health-concerns, health-concern,
  health-conditions, health-condition, health-medications, health-supplements,
  health-bloodwork, health-vitals, health-insurance, health-emergency,
  health-allergies, health-vaccinations, health-eye, health-care-team

**Phase 4 — Life, Notes, Contacts ✅ COMPLETE**
- life, journal, contacts, notes, lifecalendar

**Phase 5 — Vehicles, Garage, Structures, Collections ✅ COMPLETE**
- vehicles, garage, structures, collections

**Phase 6 — SecondBrain `ASK_HELP` action** (after all content is authored)
- Add `ASK_HELP` to SecondBrain classification
- Wire Stage 2 LLM call using full `AppHelp.md`
- Display Help reply inline in SB chat with distinct styling
- Update `SB_HELP_ACTIONS` array (required behavior)

---

## Decisions Made

| # | Decision |
|---|----------|
| 1 | Single `AppHelp.md` file — one source of truth, no duplication |
| 2 | Runtime parse: `fetch` once, cache, extract sections by `## screen:X` key |
| 3 | Full `AppHelp.md` string injected as LLM system context |
| 4 | Help button lives in nav bar (`?` text), reads current hash at click time |
| 5 | [skip] screens → `?` navigates to `#help/main` |
| 6 | Full-screen route `#help/screenName` |
| 7 | Static help shown first; Ask AI is supplemental |
| 8 | Q&A appends newest-first; 3+ pairs → auto-collapse older ones |
| 9 | **Stateful LLM calls** — full conversation history (Q&A pairs) passed as user/assistant turns; error responses excluded from history |
| 10 | SecondBrain `ASK_HELP` → styled Help reply inline in SecondBrain chat |
| 11 | Broad trigger for `ASK_HELP` — implicit confusion counts |
| 12 | Phased delivery — Yard first, user tests before next phase begins |
| 13 | Claude drafts all content; user approves |
| 14 | AppHelp.md updated same-commit as any feature change |
| 15 | Quick Help always visible; Details behind Show more ▾ toggle |
| 16 | Details sections must be exhaustive — thin content = thin AI answers |
| 17 | See Also links in styled box at bottom of each screen's content |
| 18 | Topics index is context-aware — shows only the current major section's topics |
| 19 | Cross-section links on each topics page so user can navigate to other sections |
| 20 | `? Ask AI` redirects to `#help/settings` when LLM not configured |
| 21 | Enter sends in the AI input; Shift+Enter inserts newline |
| 22 | Cross-section links on topics pages go at the **bottom** ("didn't find it here? try these") |
| 23 | `#help/main` is the major-section launcher — shows Yard/House/Life/Health/etc. as clickable cards leading to each section's topics page; Getting Started content remains below |

---

## Open Questions

None blocking. All decisions resolved.
