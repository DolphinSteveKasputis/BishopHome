# People Feature Plan

## Overview
A personal contacts/relationship tracker. Stores people you know with contact info,
family connections, photos, and a running log of interactions — including automatic
linking from journal entries via @mentions.

---

## Core Data — Person Record

| Field | Notes |
|-------|-------|
| Name | Full name |
| Phone | See Q1 — one or multiple? |
| Email | See Q1 — one or multiple? |
| Address | Home address |
| Birthdate | Optional; see Q2 re: calendar integration |
| Facebook URL | Profile page link |
| Profile photo | Selected from their photo collection; shown on list card |
| Notes | General free-form notes about the person |
| Category/Group | See Q3 |

**Open Question Q1 — Multiple contact methods?**
Do you want one phone/email per person, or multiple with labels
(e.g., "Cell", "Work", "Home")? Most people have 2-3 numbers.

**Open Question Q2 — Birthdays on calendar?**
Should a person's birthdate automatically appear on the Calendar page
as a recurring annual event?

**Open Question Q3 — Categories / Groups?**
Do you want to tag or group people — e.g., Family, Friend, Neighbor,
Coworker, etc.? This would let you filter the list.

---

## Social Media

- Facebook page URL (clickable link)

**Open Question Q4 — Other social platforms?**
Instagram, LinkedIn, X (Twitter)? Or just Facebook for now and add others later?

---

## Family Members (one level deep)

A person can have a sub-list of family members attached to them.

**Open Question Q5 — Linked vs. standalone family members?**
Two options:
- **Linked**: Family members are other people already in your People list
  (e.g., Jim's wife Susan is also her own full Person record you track)
- **Standalone**: Just names/roles listed on Jim's record for reference
  (e.g., "Wife: Susan", "Son: Tyler") — not full tracked people

Which fits your use case better? Could be a mix — some family members
are in your list, some are just reference names.

---

## Photos

- Attach multiple photos to a person (same pattern as plants/zones)
- Select one photo as the **profile picture**
- Profile picture shown as thumbnail on the people list card
- Full photo gallery viewer (newest-first, caption, delete)

---

## Interactions Log

A chronological list of notes about a person. Two sources feed this list:

1. **Direct interactions** — entries logged specifically on Jim's page
2. **Journal @mentions** — when a journal entry references @Jim,
   that entry (or a reference to it) appears in Jim's interaction log

**Open Question Q6 — What does a direct interaction look like?**
Options:
- Simple: just a date + text note (like a mini journal entry)
- Structured: date + type (Phone Call, Visit, Text, Email, etc.) + notes

Which feels more natural for how you'd use it?

**Open Question Q7 — Journal @mention display**
When a journal entry mentions @Jim, what should show in Jim's log?
- Option A: The **full journal entry text** shows inline in Jim's list
- Option B: A **reference card** — "Mentioned in journal on [date]" — clickable to open the full journal entry
- Option A is more convenient; Option B keeps journal entries private
  if you ever share the People list with someone else

**Open Question Q8 — @mention mechanics in the journal**
When typing @Jim in a journal entry:
- Should it **autocomplete** from your people list as you type?
- Or just recognize @Name after the fact when saving?
Autocomplete is slicker but more work to build.

---

## Navigation / Location in App

**Open Question Q9 — Where does People live?**
- Under the **Life** module (alongside Journal) — makes sense since it's personal
- Its own **top-level tile** on the main landing page
- Under Life makes more sense if you want it private (same as journal);
  top-level makes sense if family members might use it too

---

## Other Things Worth Considering

These aren't in your list yet — worth a quick yes/no:

- **Last contacted date** — auto-stamped when you log an interaction,
  shown on the list card so you can see "haven't talked to Jim in 6 months"
- **Important dates** — beyond birthday: anniversary, graduation, etc.
- **Tags** — freeform tags beyond categories (e.g., "golf buddy", "college friend")
- **Mailing list flag** — simple checkbox "send Christmas card" type of thing
- **Linked to a zone or house location** — e.g., neighbor Jim lives next door;
  link him to a zone on the map
- **Export to contacts** — push to phone contacts? Probably overkill but worth noting

---

## Firestore Collections (Draft)

| Collection | Key Fields |
|------------|-----------|
| people | name, phone, email, address, birthdate, facebookUrl, profilePhotoId, notes, category, createdAt |
| peopleFamily | personId, name, relationship (label only, not a full person link) |
| peopleInteractions | personId, date, text, sourceType (direct/journal), journalEntryId (if from journal) |
| photos | targetType='person', targetId, imageData, caption, isProfile, createdAt |

---

## Build Phases (Draft)

- **Phase 1**: Person CRUD, contact info, photos, profile pic selection, list view with cards
- **Phase 2**: Family members sub-list
- **Phase 3**: Direct interaction log
- **Phase 4**: Journal @mention linking (most complex — depends on Q6-Q8 answers)
- **Phase 5**: Calendar integration for birthdays

---

*Status: Planning — awaiting answers to Q1–Q9 above*
