# People Feature Plan

## Overview
A personal contacts/relationship tracker. Stores people you know with contact info,
family connections, photos, facts, and a running log of interactions — including
automatic linking from journal entries via @mentions.
Lives under the **Life** module alongside Journal.

---

## Core Person Record — Dedicated Fields

| Field | Notes |
|-------|-------|
| Name | Full name |
| Nickname | Optional; used for @mention autocomplete (e.g. @Jim instead of @James) |
| How do you know them | Short text — "college roommate", "neighbor since 2019", etc. |
| Phone | One number |
| Email | One address |
| Address | Home address |
| Birthdate | Optional; **always** rolls up to Life page calendar |
| Facebook URL | Clickable link |
| Category | Expandable list — see below |
| Notes | Free-form general notes |
| Profile photo | Selected from their photo collection; shown on list card |
| createdAt | Firestore timestamp |

---

## Categories
Predefined starting list with the ability to add custom values.
Custom values are saved and available for future people (list grows over time).

**Default categories:** Family, Friend, Neighbor, Coworker, Acquaintance

User can type a new category when adding/editing a person — it's saved to a
`peopleCategories` collection and appears in the dropdown going forward.

---

## Important Dates
A sub-list of special dates attached to a person.
Each entry has:
- **Label** — e.g. "Anniversary", "Graduation", "Work Anniversary"
- **Date** — the date (month/day, optionally with year)
- **Roll up to Life calendar** — flag per date; user decides which ones appear on calendar

Birthdate is separate (always rolls up). Important dates are opt-in per entry.

---

## Facts (Flexible Key-Value)
Same Facts system used elsewhere in the app. Handles anything not covered
by dedicated fields:
- Occupation / Employer
- Interests / Hobbies
- Gift ideas
- Additional URLs (LinkedIn, Instagram, etc.)
- Anything else

---

## Photos
- Attach multiple photos (same pattern as plants/zones/weeds)
- Select one as **profile picture** — shown as thumbnail on people list cards
- Full gallery viewer (newest-first, caption, delete)
- Sub-people have their own photos

---

## Family Members (Sub-People — One Level Deep)
- A main person can have sub-people linked to them (spouse, kids, etc.)
- Sub-people are **full Person records** — same fields, photos, facts, interactions, important dates
- Sub-people **cannot have sub-people of their own** (one level max)
- Sub-people birthdays and flagged important dates roll up to Life calendar
- Journal entries can be @linked directly to sub-people
- @mentions of a sub-person appear in **both** the sub-person's interactions
  and the parent person's interactions

---

## Interactions Log
A unified chronological list on each person's page. Two sources:

1. **Direct interactions** — entered on the person's page
   - Simple: date + free-form text
   - Speech-to-text supported (same as journal)

2. **Journal @mentions** — when a journal entry references @Name,
   the **full entry text** appears in that person's interaction log

Both display together in one list, sorted newest first.
Sub-people have their own interaction list with the same behavior.

---

## Journal @Mention Linking

Typing `@` in a journal entry triggers an **autocomplete dropdown**
from the People list (main people and sub-people, matched by name or nickname).

- Selected person stored as a linked reference in the journal entry
- On save, a reference (with full entry text) is added to that person's interaction log
- Multiple people can be @mentioned in one entry
- @mentioning a sub-person also adds the reference to the parent person's log

*Note: Autocomplete is medium complexity — built in Phase 4.
Phase 1–3 work without it.*

---

## Life Page Calendar
The Life landing page gets a calendar section (same pattern as Yard and House).

Rolls up:
- **Birthdays** for all people and sub-people (always)
- **Important dates** that have the roll-up flag set (user decides per date)

---

## People List Cards
Each card shows:
- Profile photo thumbnail (placeholder avatar if none set)
- Name
- Category badge
- Last interaction date (auto-stamped on any interaction)

---

## Navigation
- Life landing page gets a **People** tile alongside Journal
- Life nav bar gets a **People** link
- People list → Person detail page → Sub-people accessible from person detail

---

## Firestore Collections

| Collection | Key Fields |
|------------|-----------|
| people | name, nickname, howKnown, phone, email, address, birthdate, facebookUrl, profilePhotoId, category, notes, parentPersonId (null=main, set=sub-person), createdAt |
| peopleImportantDates | personId, label, date, rollUpToCalendar |
| peopleInteractions | personId, date, text, sourceType ('direct'/'journal'), journalEntryId, createdAt |
| peopleCategories | name (the category label) — grows as user adds new ones |
| facts | targetType='person', targetId, label, value (reuses existing facts system) |
| photos | targetType='person', targetId, imageData, caption, isProfile, createdAt |

*Sub-people are just Person records with parentPersonId set — no separate collection needed.*

---

## Build Phases

| Phase | What |
|-------|------|
| 1 | Person CRUD, all core fields, categories (expandable), photos, profile pic, list cards |
| 2 | Sub-people (family members) — one level deep, same functionality |
| 3 | Important dates with calendar roll-up flag; Facts section |
| 4 | Direct interaction log with speech-to-text |
| 5 | Journal @mention linking + autocomplete |
| 6 | Life page calendar with birthday + important date roll-up |

---

*Status: Plan complete — ready to build*
