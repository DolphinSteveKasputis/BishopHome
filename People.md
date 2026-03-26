# People Feature Plan

## Overview
A personal contacts/relationship tracker. Stores people you know with contact info,
family connections, photos, and a running log of interactions — including automatic
linking from journal entries via @mentions.
Lives under the **Life** module alongside Journal.

---

## Core Data — Person Record

| Field | Notes |
|-------|-------|
| Name | Full name |
| Phone | One phone number |
| Email | One email address |
| Address | Home address |
| Birthdate | Optional; rolls up to Life page calendar |
| Facebook URL | Profile page link (clickable) |
| Profile photo | Selected from their photo collection; shown on list card |
| Category | Family / Friend / Neighbor / Coworker / etc. — see Q1 |
| Notes | General free-form notes |
| createdAt | Firestore timestamp |

---

## Categories
User can tag each person with a category for filtering the list.

**Open Question Q1 — Predefined or free-form categories?**
- **Predefined**: Family, Friend, Neighbor, Coworker, Acquaintance (you pick from a list)
- **Free-form**: You type whatever you want (like tags)
- **Hybrid**: Predefined defaults + ability to add your own

---

## Social Media
- Facebook URL — stored as a clickable link (same as URL facts elsewhere in the app)

---

## Family Members (one level deep)

- A main person can have sub-people linked to them (spouse, kids, etc.)
- Sub-people are **full Person records** — same fields, photos, interactions, bdays
- Sub-people appear under their main person and **cannot have sub-people of their own**
- Sub-people birthdays also roll up to the Life page calendar
- Journal entries can be @linked to sub-people directly

**Open Question Q2 — @mention sub-people roll-up**
When you @mention Susan (Jim's wife, a sub-person) in a journal entry —
does that entry show in:
- Susan's interactions only?
- Susan's interactions **AND** Jim's interactions (since she's his family member)?

---

## Photos
- Attach multiple photos to a person (same pattern as plants/zones)
- Select one as the **profile picture** — shown as thumbnail on people list cards
- Full photo gallery viewer (newest-first, caption, delete)
- Sub-people have their own photos too

---

## Interactions Log

A chronological list of entries about a person. Two sources:

1. **Direct interactions** — entered on the person's page (like a mini journal with speech-to-text)
   - Fields: date, text — simple, no types needed
2. **Journal @mentions** — when a journal entry references @Name, the **full entry text**
   appears in that person's interaction log

Both show in one unified chronological list on the person's page.
Sub-people have their own interaction list that works the same way.

---

## Journal @Mention Linking

When writing a journal entry, typing `@` triggers an **autocomplete dropdown**
from the People list (both main people and sub-people).

- Selected person is stored as a linked reference in the journal entry
- On save, a copy/reference of the full entry text is added to that person's interaction log
- Multiple people can be @mentioned in one journal entry (Jim, Susan, etc.)

**Note on autocomplete complexity**: This is a medium-effort feature.
Can be built in Phase 4 — not required for the initial release.
If autocomplete is too complex initially, Phase 1 can do plain `@Name` text
with a manual "link to person" button instead.

---

## Life Page Calendar

The Life page gets a calendar section (same pattern as Yard and House pages).
This calendar shows:
- **Birthdays** for all people (main and sub-people) as recurring annual events
- Potentially other Life-related calendar events (TBD)

**Open Question Q3 — Life calendar scope**
Should the Life page calendar show:
- Birthdays only?
- Or also pull in regular calendarEvents that are linked to people/journal?

---

## People List (Main View)

Each person card shows:
- Profile photo thumbnail (or placeholder avatar if none)
- Name
- Category badge
- Last interaction date (auto-stamped when any interaction is logged)

**Open Question Q4 — What else on the card?**
Any other quick info you'd want to see without opening the person?
e.g., phone number, city, birthday coming up soon?

---

## Navigation Under Life Module

Life landing page gets a **People tile** alongside Journal.
People list → Person detail → (sub-people inline or navigable)

Life nav bar gets a **People** link.

---

## Firestore Collections

| Collection | Key Fields |
|------------|-----------|
| people | name, phone, email, address, birthdate, facebookUrl, profilePhotoId, notes, category, parentPersonId (null for main, set for sub-people), createdAt |
| peopleInteractions | personId, date, text, sourceType ('direct' or 'journal'), journalEntryId (if from journal), createdAt |
| photos | targetType='person', targetId, imageData, caption, isProfile, createdAt |

*Note: No separate peopleFamily collection needed — sub-people are just Person records
with parentPersonId set. This keeps the data model simple.*

---

## Build Phases

| Phase | What |
|-------|------|
| 1 | Person CRUD, contact info, categories, photos, profile pic, list view with cards |
| 2 | Family members (sub-people) — linked Person records, one level deep |
| 3 | Direct interaction log with speech-to-text |
| 4 | Journal @mention linking + autocomplete |
| 5 | Life page calendar with birthday roll-up |

---

## Remaining Open Questions

- **Q1** — Categories: predefined list, free-form, or hybrid?
- **Q2** — Sub-person @mention: show in sub-person's list only, or also roll up to parent?
- **Q3** — Life calendar: birthdays only, or broader?
- **Q4** — People list card: any other quick-info fields to show?

---

*Status: Planning — awaiting answers to Q1–Q4*
