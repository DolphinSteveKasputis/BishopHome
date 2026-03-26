# Shared Household Feature Plan

## Use Case
Allow a family member to view and edit all app data **except** the Life/Journal module,
which remains private to each user.

---

## Core Challenge
All data is currently stored under `/users/{uid}/...` — each Firebase user is completely
siloed. To share data between users, it needs to live somewhere both can access.

---

## Proposed Approach — Shared Household + Private Personal Data

Split Firestore into two namespaces:

| Namespace | Path | Who Accesses It |
|-----------|------|-----------------|
| Shared household data | `/households/{householdId}/...` | All household members |
| Private personal data | `/users/{uid}/personal/...` | Owner only |

**Shared** (everything visible to family):
- Yard, Zones, Plants, Weeds
- House, Floors, Rooms, Things, SubThings
- Garage, Vehicles, Structures
- Collections, Chemicals, Activities, Calendar, etc.

**Private** (stays per-user):
- Life / Journal module
- Journal entries, tracking items, categories

---

## How Invitation Would Work
1. Owner goes to Settings → generates an invite code (or shares household ID)
2. Family member creates their own Firebase account and enters the invite code
3. Their account is linked to the owner's `householdId` in Firestore
4. App reads/writes from `/households/{householdId}/...` for all shared modules
5. Each user's journal stays under their own `/users/{uid}/...`

---

## Data Migration (The Hard Part)
All existing data lives under `/users/{yourUid}/...` and must move to
`/households/{householdId}/...`. This is a one-time migration:

- Write a migration script (can be a button in Settings → Admin)
- Script copies all collections except journal to the new household path
- Verify data, then switch the app to read from the new path
- This is the riskiest step — touches real data, needs a backup first

---

## Difficulty: Medium
- **Logic & routing**: Straightforward — swap `userCol()` helper to point at household path
- **Auth & invite flow**: ~1 day of work
- **Data migration**: Moderate risk, needs careful testing
- **Life module privacy**: Already naturally isolated (stays at uid level, no extra work)

---

## Decision Pending
Come back to this when the use case is clearer:
- **Occasional viewing** → shared login is simpler
- **Active participation / maintaining data** → household model is the right answer

---

*Noted: $(date)*
