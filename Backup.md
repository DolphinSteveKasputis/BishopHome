# Backup & Restore Plan

## Overview

Add a Backup and Restore feature to the Settings page. Backup produces
up to two separate JSON files — one for all data, one for photos only.
Restore replaces all current data with a previously downloaded backup file.

---

## Backup Design

### Two separate files

| File | Contents | Typical use |
|---|---|---|
| `Bishop_Data_2026-03-23_1430.json` | All collections **except** photos | Monthly |
| `Bishop_Photos_2026-03-23_1430.json` | Photos collection **only** | Yearly |

Splitting them keeps the routine data backup small and fast, while the
large photo backup is done less frequently.

### Collections in each file

**Data file** (all except photos):
activities, breakerPanels, calendarEvents, chemicals, facts, floorPlans,
floors, gpsShapes, plants, problems, projects, rooms, savedActions,
settings, subThings, tags, things, weeds, zones

**Photos file:**
photos only

### Toggle behavior
- Default: toggle **off** — only the data file downloads
- Toggle **on** — both files download (one after the other)
- Each file triggers a standard browser download automatically

### File format (JSON)
Document IDs are preserved so cross-document references remain intact
after a restore.

```json
{
  "version": 1,
  "type": "data",
  "exportedAt": "2026-03-23T14:30:00.000Z",
  "appName": "Bishop",
  "collections": {
    "zones": [
      { "id": "abc123", "data": { "name": "Front Yard", ... } },
      { "id": "xyz789", "data": { ... } }
    ],
    "plants": [ ... ],
    "activities": [ ... ]
  }
}
```

Photos file uses the same structure with just the `photos` collection.

---

## Restore Design

### Two independent restore actions
Since data and photos are backed up separately, they restore separately.
You can restore data without touching photos, or restore photos without
touching data.

| Button | What it does |
|---|---|
| **Restore Data** | Reads a data JSON file, wipes all non-photo collections, writes backup data |
| **Restore Photos** | Reads a photos JSON file, wipes photos collection, writes backup photos |

### Replace behavior
- All existing documents in the affected collections are **deleted first**
- Then all documents from the backup file are written with their original IDs
- No merging — it's a clean replace

### Safety warnings
Before any restore begins, the user sees a confirmation dialog:
> "This will permanently replace all current [data / photos] with the
> backup from [date]. This cannot be undone. Are you sure?"

User must type **RESTORE** to confirm (prevents accidental taps).

### Progress display
- A progress bar / status log shows which collection is being restored
- "Restoring zones... done. Restoring plants... done." etc.
- Final "✓ Restore complete" message when finished

### Large collection handling
Firestore batches are limited to 500 operations. The restore writes in
batches of 400 (deletes and writes separately) to stay safely under the limit.

---

## Settings Page UI

```
──────────────────────────────────────────
  BACKUP

  [toggle] Create photos file also

  [ Download Backup ]

  Last backup: never  (tracked in localStorage)
──────────────────────────────────────────
  RESTORE

  ⚠ Restore replaces ALL current data with
    the selected backup file. Cannot be undone.

  [ Restore Data... ]    ← opens file picker
  [ Restore Photos... ]  ← opens file picker

  (progress/status area shown during restore)
──────────────────────────────────────────
```

"Last backup" timestamp is stored in localStorage (not Firestore) and
updates each time a backup is successfully downloaded.

---

## Implementation Phases

### Phase BK-1 — Backup feature
**Who:** Claude
**Effort:** ~1 hour

- Add Backup section HTML to the Settings page
- Add backup logic to `settings.js`:
  - Read all data collections from `/users/{uid}/...`
  - Serialize to JSON with version/type/date metadata
  - Trigger browser file download
  - If toggle on, repeat for photos collection
  - Update "last backup" timestamp in localStorage

### Phase BK-2 — Restore feature
**Who:** Claude
**Effort:** ~1.5 hours

- Add Restore section HTML to the Settings page
- Add restore logic to `settings.js`:
  - File picker opens on button click
  - Read and parse JSON file
  - Validate: check `version` and `type` fields match expected format
  - Confirm dialog with "type RESTORE to confirm"
  - Delete existing documents in affected collections (batched)
  - Write backup documents back with original IDs (batched)
  - Show progress and completion message

---

## Risk & Safety Notes

- **No data is touched during backup** — read-only, completely safe
- **Restore is destructive** — the confirmation dialog + typing "RESTORE"
  prevents accidental use
- **Browser download limits** — a 25MB+ photos file will download fine
  in modern browsers; no server needed
- **Firestore read cost** — a full backup reads every document once.
  On the free tier (50,000 reads/day) this is fine for occasional use
- **Restore read cost** — deletes + writes count against daily limits.
  A restore of 1,000 documents uses ~2,000 operations (1k deletes + 1k writes).
  Well within free tier limits for occasional use.
- **Document ID preservation** — critical for restore correctness.
  All cross-references (e.g. a plant's `zoneId`, a fact's `targetId`)
  point to specific document IDs. Preserving IDs on restore ensures
  all relationships stay intact.
