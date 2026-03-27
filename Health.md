# Health.md — "My Health" Feature Planning Document

> **Status: PLAN FINALIZED — Ready for implementation**
> This section lives under **Life → My Health** in the app.

---

## Overview

A personal health tracking hub. Covers medical visits, medications, lab work, symptoms/concerns,
known conditions, insurance, vitals, supplements, vaccinations, eye prescriptions, emergency info,
and upcoming appointments. Everything in one place, private and self-hosted.

The long-term vision includes exporting your full health history as JSON and feeding it into an
LLM for holistic analysis and insight. (Phase 3+)

---

## Navigation

- **Life** page gets a **"My Health"** tile
- My Health page shows a **flat 2-column grid** of sub-feature tiles:

```
┌──────────────────┬──────────────────┐
│  🏥 Health       │  💊 Medications  │
│     Visits       │                  │
├──────────────────┼──────────────────┤
│  🩸 Blood Work   │  ⚠️  Concerns    │
├──────────────────┼──────────────────┤
│  📋 Conditions   │  💓 Vitals       │
├──────────────────┼──────────────────┤
│  🌿 Supplements  │  💉 Vaccinations │
├──────────────────┼──────────────────┤
│  👁️  Eye/Glasses │  🚨 Allergies    │
├──────────────────┼──────────────────┤
│  🛡️  Insurance   │  🆘 Emergency    │
│                  │     Info         │
└──────────────────┴──────────────────┘
```

*(Appointments added to grid in Phase 2)*

- Navigate back via Life → Home

---

## Feature 1: Health Visits

### Purpose
A log of every medical/dental/specialist visit — what happened, outcome, out-of-pocket cost,
linked concern (if any), and photos (x-rays, etc.).

---

### Visit Fields

| Field | Details |
|-------|---------|
| `date` | Date of visit (YYYY-MM-DD) |
| `provider` | Doctor/dentist/specialist name — free text |
| `providerType` | Dropdown: Primary Care, Dentist, Optometrist, Specialist, Urgent Care, ER, Other |
| `concernId` | Optional — link to an existing Concern this visit addressed |
| `reason` | Why you went — free text (used when no concern is linked, or for extra context) |
| `whatWasDone` | Procedures, diagnoses, treatments — free text |
| `outcome` | Result / next steps — free text |
| `cost` | Dollar amount — **out-of-pocket only** (what you actually paid) |
| `notes` | Anything else worth noting |
| `createdAt` | Server timestamp |

---

### Linking a Visit to a Concern
- Optional **"Related Concern"** dropdown on the visit form
- Lists **all** concerns (open and resolved) — user may be following up on a resolved concern
- If selected, the visit appears in that concern's history timeline automatically
- If the reason for going isn't tracked as a concern (e.g., a cold), leave blank and use `reason`

---

### Photos on Visits
- X-rays, wound photos, pathology results, referral letters, etc.
- Base64-in-Firestore, same pattern used throughout the app
- Gallery on the visit detail page (newest first, caption + delete)
- `photos` collection: `targetType: 'healthVisit'`, `targetId: visitId`

---

### Display
- List view: sorted newest first, grouped by year
- Each card: date, provider, provider type, reason or linked concern title
- Tap → full detail page with all fields + medications prescribed at this visit + photo gallery
- **Filter** by provider type (All / Primary Care / Dentist / etc.)

---

### Decided
- Track **out-of-pocket cost only** — not billed amount or what insurance paid
- Provider is **free text** — no managed list
- No PDF document upload — photos only (Base64)
- Concern dropdown shows **all concerns** (open and resolved), not just open ones

---

## Feature 2: Medications

### Purpose
Full medication history — current and past. Two types: short-term courses (antibiotics) and
indefinite ongoing meds (statins). No medication is ever deleted — completed ones move to history.

---

### Medication Fields

| Field | Details |
|-------|---------|
| `name` | Medication name — free text |
| `dosage` | e.g., "10mg", "500mg twice daily" — free text |
| `purpose` | What it's for — free text |
| `prescribedBy` | Doctor name — free text (optional) |
| `prescribedAtVisitId` | Optional — link to the Health Visit where this was prescribed |
| `startDate` | YYYY-MM-DD |
| `endDate` | YYYY-MM-DD or null (ongoing) |
| `status` | `active` or `completed` |
| `type` | Dropdown: **Ongoing** (indefinite, auto-refill), **Short-term** (finite course), **As-needed** |
| `notes` | Side effects, pharmacy notes, etc. |
| `createdAt` | Server timestamp |

---

### Active vs. History
- **Active medications**: `status === 'active'` — shown at top of the page
- **Medication history**: `status === 'completed'` — collapsed section below, expandable
- **"Mark as Done"** button on active meds → prompts for end date → moves to history
- History is never deleted — always viewable, sorted by end date descending

---

### Medication ↔ Visit Link
- Optional **"Prescribed at Visit"** dropdown on the medication form — lists past health visits as "2026-01-15 — Dr. Smith"
- Visit detail page shows a **"Medications Prescribed"** section listing any meds linked to it
- Medication card/detail shows the linked visit as a clickable reference

---

### Decided
- No refill tracking or "runs out soon" reminders
- Short-term meds get marked done when the course ends

---

### Display
- Two sections: **Current Medications** and **Medication History**
- Current: cards showing name, dosage, purpose, start date, type badge
- History: compact rows — name, purpose, start → end date

---

## Feature 3: Blood Work

### Purpose
Track lab panels over time. See trends in cholesterol, glucose, thyroid, CBC, and any other markers
your doctor orders. Feed a PDF or screen copy of the report into the LLM to get structured data back.

---

### Blood Work Record Fields

| Field | Details |
|-------|---------|
| `date` | Date of the blood draw (YYYY-MM-DD) |
| `lab` | Lab name — free text (optional, e.g., "Quest Diagnostics") |
| `orderedBy` | Doctor who ordered it — free text (optional) |
| `orderedAtVisitId` | Optional — link to the Health Visit that ordered this blood work |
| `notes` | Overall notes, doctor's comments, etc. |
| `markers` | Array of `{ name, value, unit, referenceRange, flagged }` |
| `createdAt` | Server timestamp |

---

### Common Markers (Pre-populated Suggestions)
The app suggests a standard panel, but the user can add any custom marker:

**Lipid Panel**: LDL, HDL, Total Cholesterol, Triglycerides
**Metabolic**: Glucose, HbA1c (A1c), eGFR, BUN, Creatinine
**Liver**: ALT, AST, Alkaline Phosphatase, Total Bilirubin
**Thyroid**: TSH, Free T4, Free T3
**CBC**: WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV
**Other**: Vitamin D, Vitamin B12, Ferritin, Iron, PSA, Uric Acid

---

### LLM-Assisted Import

User pastes text from a lab report (screen copy, copy-from-PDF, patient portal text) and the
LLM returns structured JSON. Same LLM config stored in `userCol('settings').doc('llm')`.

**Workflow:**
1. Open "Add Blood Work" → fill date, lab, linked visit (optional), notes
2. Click **"Import from Report"** button
3. Text area appears: "Paste your lab report text here"
4. LLM is called with a structured extraction prompt
5. Returns JSON → app renders an editable preview of all parsed markers
6. User reviews, edits any mistakes, then saves

**Target JSON format returned by LLM:**
```json
{
  "markers": [
    { "name": "LDL",   "value": "112", "unit": "mg/dL", "referenceRange": "<100", "flagged": true },
    { "name": "HDL",   "value": "58",  "unit": "mg/dL", "referenceRange": ">40",  "flagged": false },
    { "name": "HbA1c", "value": "5.7", "unit": "%",     "referenceRange": "<5.7", "flagged": false }
  ]
}
```

> User may paste plain text from a PDF viewer, OCR'd screenshot, or patient portal.
> The LLM prompt will be written to handle messy, inconsistently formatted lab text.
> If the LLM parse fails or returns garbage, manual marker entry is always available as fallback.

---

### Trend View
- Pick any **marker name** → see all recorded values across all blood work records, sorted by date
- Table: Date | Value | Unit | Ref Range | Flagged?
- Flagged values highlighted in red
- Line chart (Phase 2 — Chart.js, free, no backend needed)

---

### Display
- List of records, newest first
- Each card: date, lab, linked visit (if any), count of markers
- Tap → full detail with all markers in a table, flagged ones highlighted
- **"View Trends"** button → marker picker → trend table

---

### Decided
- No photo attachment of lab reports — text paste + LLM import is the mechanism
- Table-only trend view first; chart deferred to Phase 2
- No flagged-marker alerts or notifications
- Blood work can optionally link back to the visit that ordered it via `orderedAtVisitId`

---

## Feature 4: Concerns

### Purpose
Track an **unknown or evolving** symptom or physical finding — something you noticed but haven't
been diagnosed with. Journal its progression over time. Attach photos for visual tracking.

> **Distinct from Known Conditions (Feature 5):**
> Concerns are investigative — "I have a bump, I don't know what it is."
> Conditions are diagnosed — "I have sleep apnea, confirmed by a sleep study."

---

### Concern Fields

| Field | Details |
|-------|---------|
| `title` | Short label — e.g., "Bump on left forearm", "Lower back ache" |
| `bodyArea` | Optional — free text (e.g., "Left forearm", "Lower back") |
| `startDate` | When you first noticed it (YYYY-MM-DD) |
| `status` | `open` or `resolved` |
| `resolvedDate` | YYYY-MM-DD or null |
| `summary` | Free text — description and running notes |
| `createdAt` | Server timestamp |

---

### Concern Journal Entries
Each concern has its own **history log** — dated updates:

| Field | Details |
|-------|---------|
| `concernId` | Parent concern |
| `date` | YYYY-MM-DD |
| `note` | Free text — "Getting bigger", "Resolved after antibiotics", etc. |
| `painScale` | Optional integer 1–10 — track severity over time (omit if not applicable) |
| `createdAt` | Timestamp |

---

### Concern Detail Page
- Shows: summary, journal history (newest first), linked health visits, photo gallery
- Buttons: **Add Update**, **Add Photo**, **Mark Resolved**
- Linked visits section: lists any health visits that reference this concern (date, provider, outcome)

---

### Photos on Concerns
- `targetType: 'concern'`, `targetId: concernId`
- Great for: skin lesions, bruises, swelling — track visual change over time

---

### Display
- Two sections: **Open Concerns** and **Resolved Concerns** (collapsed, expandable)
- Each card: title, body area, start date, count of journal entries, count of linked visits

---

### Decided
- Concern ↔ Visit link is one-directional from the visit side (visit picks a concern)
- Pain scale (1–10) is optional per journal entry
- Removed the redundant top-level `notes` field — `summary` serves as the main description

---

## Feature 5: Known Conditions

### Purpose
Track **diagnosed, named health conditions** — things a doctor has confirmed. These are stable
reference records, not evolving investigations. Examples: Sleep Apnea, Hypertension, Type 2
Diabetes, Hearing Loss, GERD, Arthritis.

> **Distinct from Concerns (Feature 4):**
> Conditions are known and named. Concerns are uncertain and under investigation.
> A concern might *become* a condition once diagnosed.

---

### Condition Fields

| Field | Details |
|-------|---------|
| `name` | Condition name — free text (e.g., "Sleep Apnea", "Hypertension") |
| `category` | Dropdown: Cardiovascular, Metabolic, Respiratory, Neurological, Musculoskeletal, Mental Health, Dental, Sensory, Other |
| `diagnosedDate` | YYYY-MM-DD (can be approximate) |
| `diagnosedBy` | Doctor who diagnosed it — free text (optional) |
| `diagnosedAtVisitId` | Optional — link to the Health Visit where this was diagnosed |
| `status` | `active`, `managed`, `resolved` |
| `managementNotes` | How it's being treated/managed — free text (e.g., "CPAP nightly", "Lisinopril 10mg") |
| `notes` | Any other notes |
| `createdAt` | Server timestamp |

**Status meanings:**
- `active` — ongoing, not fully controlled
- `managed` — ongoing but well-controlled with treatment
- `resolved` — no longer present (e.g., cured, grew out of it)

---

### Condition ↔ Visit Link
- Like medications, a condition can be linked to the visit where it was diagnosed via `diagnosedAtVisitId`
- Visit detail page shows a **"Conditions Diagnosed"** section if any conditions reference it

---

### Display
- Two sections: **Active / Managed Conditions** and **Resolved Conditions** (collapsed)
- Each card: condition name, category badge, diagnosed date, status badge
- Tap → detail page with full info and linked visit

---

### Connection to Emergency Info Card
- The Emergency Info Card's **Critical Conditions** section auto-pulls all `active` and `managed`
  conditions as a read-only summary — no manual re-entry needed

---

## Feature 6: Vitals

### Purpose
Track home-measured clinical vitals over time — blood pressure, heart rate, O2 sat, blood glucose,
temperature. Separate from blood work (lab-ordered) and Journal (lifestyle tracking).

---

### Vitals Fields (per entry)

| Field | Details |
|-------|---------|
| `date` | YYYY-MM-DD |
| `time` | HH:MM (optional — useful for BP which varies by time of day) |
| `type` | Dropdown: Blood Pressure, Heart Rate, O2 Sat, Blood Glucose, Temperature, Other |
| `value1` | Primary value — e.g., systolic BP, heart rate reading |
| `value2` | Secondary value — e.g., diastolic BP (null for single-value types) |
| `unit` | Auto-filled by type: mmHg, bpm, %, mg/dL, °F |
| `notes` | Optional context — e.g., "after exercise", "morning fasting" |
| `createdAt` | Timestamp |

**Blood pressure example:** value1=122, value2=78, unit=mmHg → displayed as "122/78 mmHg"

---

### Weight in Vitals
- **Weight is tracked in Journal** (daily tracking items, `category === 'Weight'`)
- The Vitals trend view can **surface Journal weight entries** alongside other vitals
  by reading from `journalTrackingItems where category == 'Weight'` — no duplicate storage
- Weight is **not** an entry type in the Vitals form

---

### Display
- Filter by **type** (show all BP entries, all heart rate entries, etc.)
- Chronological list of readings, newest first
- Date range filter (same pattern as Journal — 7/30/60/90 days or custom)
- Trend table per type (same pattern as blood work trends)
- Chart (Phase 2)

---

## Feature 7: Supplements

### Purpose
Track what supplements you're currently taking — what they are, why you take them, and how often.
Not daily logging — just an inventory of current and past supplements.
Separate from Medications (no prescription required).

---

### Supplement Fields

| Field | Details |
|-------|---------|
| `name` | e.g., "Fish Oil", "Vitamin D3", "Magnesium" |
| `dosage` | e.g., "1000mg", "5000 IU" — free text |
| `brand` | Optional — brand name |
| `reason` | Why you take it — free text (e.g., "Heart health", "Low D in blood work") |
| `frequency` | Free text — e.g., "Daily", "With dinner", "3x per week" |
| `startDate` | YYYY-MM-DD |
| `endDate` | YYYY-MM-DD or null |
| `status` | `active` or `stopped` |
| `notes` | Any other notes |
| `createdAt` | Timestamp |

---

### Display
- Two sections: **Current Supplements** and **Past Supplements** (collapsed)
- "Stop Taking" button → sets end date, moves to history
- No daily usage tracking — inventory only

---

## Feature 8: Vaccinations

### Purpose
A record of vaccinations received. Add what you know now and build the list over time.
Approximate dates are fine.

---

### Vaccination Fields

| Field | Details |
|-------|---------|
| `name` | e.g., "Flu Shot", "COVID-19 Booster", "Tetanus/Tdap", "Shingrix" |
| `date` | Date received (YYYY-MM-DD) |
| `dateApproximate` | Boolean — true if you're estimating the date |
| `provider` | Where you got it — free text (e.g., "CVS", "Dr. Smith") |
| `lotNumber` | Optional — vaccine lot number |
| `nextDueDate` | Optional — when the next dose/booster is due |
| `notes` | Free text |
| `createdAt` | Timestamp |

> Vaccinations with a `nextDueDate` will feed into the Phase 2 Appointments feature
> as suggested upcoming appointments.

---

### Display
- List sorted by date descending
- Cards show: vaccine name, date ("~" prefix if approximate), next due date badge if set
- Simple add/edit/delete

---

## Feature 9: Eye / Glasses Prescriptions

### Purpose
Track when your eye prescription changes. Two lens types: **Distance** (everyday glasses) and
**Reading** (readers). Only log when numbers change — not every exam visit.

---

### Prescription Record Fields

| Field | Details |
|-------|---------|
| `date` | Date of the prescription (YYYY-MM-DD) |
| `type` | Dropdown: **Distance**, **Reading** |
| `rightEye` | Object: `{ sphere, cylinder, axis, add }` — all optional strings |
| `leftEye` | Object: `{ sphere, cylinder, axis, add }` — all optional strings |
| `pd` | Pupillary distance — free text (e.g., "64" or "32/32") handles mono or binocular PD |
| `provider` | Eye doctor name — free text (optional) |
| `notes` | e.g., "Switched to progressive lenses", "First time needing readers" |
| `createdAt` | Timestamp |

**Field reference:**
- `sphere` (SPH): focusing power, e.g., "-1.50", "+0.75"
- `cylinder` (CYL): astigmatism correction, e.g., "-0.50"
- `axis`: astigmatism angle, 1–180
- `add`: reading addition (for bifocals/progressives/readers), e.g., "+2.00"
- `pd`: needed for ordering glasses online — can be a single binocular value or "right/left" pair

---

### Display
- Two tabs or sections: **Distance** and **Reading**
- Within each: chronological list, newest first
- Each card shows the full Rx for both eyes
- Only record when numbers change — no need to log "no change" exams

---

## Feature 10: Allergies

### Purpose
A simple reference list of known allergies and reactions.
Useful at new doctor visits, ER visits, or when filling out intake forms.

---

### Allergy Fields

| Field | Details |
|-------|---------|
| `allergen` | e.g., "Penicillin", "Shellfish", "Latex", "Pollen" |
| `type` | Dropdown: Medication, Food, Environmental, Insect, Other |
| `reaction` | What happens — free text (e.g., "Hives", "Anaphylaxis", "Rash") |
| `severity` | Dropdown: Mild, Moderate, Severe |
| `dateDiscovered` | YYYY-MM-DD or null |
| `notes` | Free text |

---

### Display
- Simple list, sorted by severity (Severe first)
- Add / edit / delete

---

## Feature 11: Emergency Info Card

### Purpose
A single page with your most critical health information — for emergencies, new doctors,
or for a family member to reference. Mix of auto-pulled live data and manually entered fields.

---

### Emergency Info Fields

| Field | Type | Details |
|-------|------|---------|
| `bloodType` | Manual | e.g., "O+" |
| `organDonor` | Manual | Yes / No / Unknown |
| `primaryCareDoctor` | Manual | Name + phone — free text |
| `emergencyContacts` | Manual | Array of `{ name, relationship, phone }` |
| `criticalConditions` | **Auto-pulled** | Reads active/managed conditions from Feature 5 — no manual entry |
| `criticalMedications` | **Linked** | User picks from active Medications list — stored as array of `medicationIds` |
| `criticalAllergies` | Manual | Free text — quick summary of most dangerous allergies (e.g., "Penicillin — anaphylaxis") |
| `notes` | Manual | Any other critical info |

**Why this split:**
- Conditions auto-pull because you always want the current list without re-typing
- Medications are linked (not auto-pulled) because not every medication is "critical" — user chooses which ones to flag
- Allergies stay free text — quick to type, and the full Allergies list (Feature 10) is the authoritative record

---

### Display
- Single card / page layout, clean and readable
- **"Edit"** button opens a form
- No delete — this record is always present (empty until filled in)

---

## Feature 12: Insurance

### Purpose
A reference record of all insurance policies — medical, dental, vision, disability, life.
Not a claims tracker — just "where is my card, what's my plan, who do I call."

---

### Insurance Policy Fields

| Field | Details |
|-------|---------|
| `type` | Dropdown: Medical, Dental, Vision, Short-term Disability, Long-term Disability, Life Insurance, Other |
| `carrier` | Insurance company name |
| `planName` | e.g., "BlueCross PPO Gold" |
| `memberId` | Member/policy ID number |
| `groupNumber` | Group number (for employer plans) |
| `policyNumber` | Policy number (life/disability) |
| `startDate` | Coverage start date |
| `endDate` | Coverage end date (null if ongoing) |
| `premiumAmount` | Monthly premium (optional) |
| `deductible` | Annual deductible (optional) |
| `outOfPocketMax` | Annual OOP max (optional) |
| `beneficiaries` | Free text — for life/disability policies |
| `customerServicePhone` | Phone number |
| `website` | URL |
| `notes` | Broker info, employer vs. personal, etc. |
| `status` | `active` or `inactive` |

---

### Photos on Insurance Policies
- Front and back of insurance cards
- `targetType: 'insurancePolicy'`, `targetId: policyId`

---

### Display
- Grouped by type: Medical, Dental, Vision, etc.
- Active policies shown prominently; inactive collapsed
- Each card: carrier, plan name, member ID
- Tap → full detail page with photo gallery
- No delete — just mark inactive

---

## Feature 13: Appointments / Health Calendar *(Phase 2)*

### Purpose
Track upcoming health-related appointments. Standalone for now —
not yet connected to a master Life calendar.

---

### Appointment Fields

| Field | Details |
|-------|---------|
| `date` | YYYY-MM-DD |
| `time` | HH:MM (optional) |
| `provider` | Doctor/dentist/specialist |
| `type` | Dropdown: Physical, Follow-up, Dental Cleaning, Specialist, Lab Work, Eye Exam, Other |
| `notes` | Prep instructions, what to bring, questions to ask |
| `status` | `scheduled`, `completed`, `cancelled` |
| `linkedVisitId` | After the visit, link to the resulting Health Visit record |

---

### Appointment → Visit Conversion
When marking an appointment as done:
- Pre-fills a new Health Visit form with: `date`, `provider`, `providerType` (mapped from appointment type)
- Appointment `notes` do **not** carry over — those are pre-visit prep notes, not visit notes
- After saving the visit, `linkedVisitId` is set on the appointment

---

### Phase 2 Items
- Integration with a master Life calendar
- Recurring appointment reminders (annual physical, 6-month cleanings)
- Vaccinations with `nextDueDate` surface as suggested appointments

---

## Long-term Vision: Full Health Export *(Phase 3+)*

Export your entire health history as a single JSON document and feed it into an LLM
(e.g., OpenAI GPT-4) for analysis, pattern detection, and health insights.

Includes all collections: visits, meds, blood work, concerns, conditions, vitals,
supplements, vaccinations, eye prescriptions, allergies, and emergency info.

Design deferred until core features are built.

---

## Data Model (Firestore Collections)

| Collection | Key Fields |
|------------|------------|
| `healthVisits` | date, provider, providerType, concernId, reason, whatWasDone, outcome, cost, notes, createdAt |
| `medications` | name, dosage, purpose, prescribedBy, prescribedAtVisitId, startDate, endDate, status, type, notes, createdAt |
| `bloodWorkRecords` | date, lab, orderedBy, orderedAtVisitId, notes, markers[], createdAt |
| `concerns` | title, bodyArea, startDate, status, resolvedDate, summary, createdAt |
| `concernUpdates` | concernId, date, note, painScale, createdAt |
| `conditions` | name, category, diagnosedDate, diagnosedBy, diagnosedAtVisitId, status, managementNotes, notes, createdAt |
| `vitals` | date, time, type, value1, value2, unit, notes, createdAt |
| `supplements` | name, dosage, brand, reason, frequency, startDate, endDate, status, notes, createdAt |
| `vaccinations` | name, date, dateApproximate, provider, lotNumber, nextDueDate, notes, createdAt |
| `eyePrescriptions` | date, type, rightEye{}, leftEye{}, pd, provider, notes, createdAt |
| `allergies` | allergen, type, reaction, severity, dateDiscovered, notes |
| `emergencyInfo` | (single doc) bloodType, organDonor, primaryCareDoctor, emergencyContacts[], criticalMedicationIds[], criticalAllergies, notes |
| `insurancePolicies` | type, carrier, planName, memberId, groupNumber, policyNumber, startDate, endDate, status, premiumAmount, deductible, outOfPocketMax, beneficiaries, customerServicePhone, website, notes |
| `healthAppointments` | date, time, provider, type, notes, status, linkedVisitId *(Phase 2)* |

Photos reuse the existing `photos` collection with `targetType` values:
`healthVisit`, `concern`, `insurancePolicy`

Cross-collection queries needed:
- Visits linked to a concern: `healthVisits where concernId == id`
- Meds prescribed at a visit: `medications where prescribedAtVisitId == id`
- Conditions diagnosed at a visit: `conditions where diagnosedAtVisitId == id`
- Blood work ordered at a visit: `bloodWorkRecords where orderedAtVisitId == id`

---

## Decided / Closed

| Decision | Choice |
|----------|--------|
| Visit cost | Out-of-pocket only |
| Providers | Free text — no managed list |
| Medications | No refill tracking or reminders |
| Blood work import | Text paste + LLM → structured JSON |
| Blood work trends | Table first, chart in Phase 2 (Chart.js) |
| Lab report photos | Not stored — text paste is the mechanism |
| Visit ↔ Concern | Set on the visit; dropdown shows all concerns (open and resolved) |
| Medication ↔ Visit | `prescribedAtVisitId` on medication; visit shows prescribed meds |
| Blood work ↔ Visit | `orderedAtVisitId` on blood work record; visit shows linked labs |
| Condition ↔ Visit | `diagnosedAtVisitId` on condition; visit shows diagnosed conditions |
| Weight tracking | Journal is primary; Vitals surfaces it from Journal (no duplicate entry) |
| Pain scale | Optional 1–10 on concern journal entries |
| Supplements | Separate feature from Medications |
| Eye prescriptions | Only log when numbers change; PD is free text to handle mono/binocular |
| Vaccinations | Approximate dates allowed |
| Insurance card photos | Yes — front and back |
| Concerns vs. Conditions | Separate features: Concerns = unknown/evolving, Conditions = diagnosed/named |
| Emergency Card — conditions | Auto-pulled from active/managed Conditions (no manual entry) |
| Emergency Card — medications | User picks from active Medications list (not all, just critical ones) |
| Emergency Card — allergies | Free text — full allergy list is authoritative, card is a quick summary |
| My Health home screen | Flat 2-column grid |
| Dental specifics | Live in visit notes — no separate tooth-level tracking |
| Optometrist | Added to providerType dropdown |
| Contact lenses | Does not wear contacts — Eye/Glasses feature covers Distance and Reading only |

---

## Still Open

- When and how to build the **full health export to JSON** (Phase 3+)

---

## Out of Scope

- ~~Integration with Apple Health, Google Fit, or wearables~~ — manual entry only
- ~~HIPAA compliance / encryption at rest~~ — self-hosted personal use
- ~~PDF document upload~~ — photos only (Base64)
- ~~Claims tracking~~ — not in scope for Insurance
- ~~Family member health tracking~~ — personal only for now
- ~~Daily supplement usage logging~~ — inventory only
- ~~Tooth-level dental tracking~~ — dental specifics live in visit notes

---

## Implementation Phases

Build is done in prompted phases — you tell me when to start each one.

| Phase | Features | Notes |
|-------|----------|-------|
| **H1** | Hub page + Allergies + Supplements + Vaccinations + Eye/Glasses | Simple reference lists, no cross-feature links. Good first chunk. |
| **H2** | Health Visits | The anchor feature — everything else links back to it. Needs to exist before H3. |
| **H3** | Medications + Conditions + Concerns | All three link to Visits. Emergency Card will be able to auto-pull Conditions after this. |
| **H4** | Blood Work | Most complex: LLM import, editable marker preview, trend view. Isolated enough to be its own phase. |
| **H5** | Vitals + Insurance + Emergency Info Card | Completes Phase 1 of My Health. Emergency Card ties together Conditions and Medications. |
| **H6** | Appointments *(Phase 2 feature)* | Future — not needed for initial launch. |

---

*Last updated: 2026-03-27 — Plan finalized*

---

## Test Plan — My Health Module

> **Scope:** All H1–H6 features. Tests cover CRUD operations, cross-feature links, navigation,
> edge cases, validation, and responsive layout. Run against the test account
> (`skasputi@pattersoncompanies.com`) on the local preview server (http://localhost:8080).

---

### General / Navigation

| # | Test | Expected |
|---|------|----------|
| G-1 | Navigate to Life → My Health from landing page | Health hub shows 2-column tile grid with all 12 tiles |
| G-2 | Tap each tile | Navigates to the correct page; back button returns to My Health hub |
| G-3 | Use browser back button from any health sub-page | Returns to My Health hub |
| G-4 | Use browser back button while a modal is open | Closes modal, stays on current page (does NOT navigate away) |
| G-5 | Refresh page while on a health sub-page (e.g. `#health-visits`) | Page reloads and shows the correct content (routing works on direct load) |
| G-6 | All pages show Life nav bar (not Yard or House nav) | Life nav is visible; yard/house navs are hidden |

---

### H1 — Allergies

| # | Test | Expected |
|---|------|----------|
| A-1 | Add an allergy (all fields filled) | Appears in list; Severe sorts before Moderate before Mild |
| A-2 | Add a second allergy with Severe severity | Appears at top of list |
| A-3 | Edit an existing allergy | Changes saved; list reflects update |
| A-4 | Delete an allergy | Removed from list; no orphaned data |
| A-5 | Add allergy with only required fields (allergen + type) | Saves successfully; optional fields shown as blank |
| A-6 | Submit with empty allergen field | Validation prevents save; alert shown |

---

### H1 — Supplements

| # | Test | Expected |
|---|------|----------|
| S-1 | Add an active supplement (all fields) | Appears in "Current Supplements" section |
| S-2 | Add a second supplement | Both visible in current section |
| S-3 | "Stop Taking" a supplement | Prompts for end date; moves to "Past Supplements" section |
| S-4 | Expand "Past Supplements" section | Collapsed by default; expands to show stopped supplements |
| S-5 | Edit a supplement | Changes saved correctly |
| S-6 | Delete a supplement | Removed from list |

---

### H1 — Vaccinations

| # | Test | Expected |
|---|------|----------|
| V-1 | Add a vaccination (all fields) | Appears in list sorted by date descending |
| V-2 | Add vaccination with approximate date checked | Date displays with "~" prefix |
| V-3 | Add vaccination with nextDueDate set | "Next due" badge visible on card |
| V-4 | Edit a vaccination | Changes saved |
| V-5 | Delete a vaccination | Removed from list |

---

### H1 — Eye / Glasses Prescriptions

| # | Test | Expected |
|---|------|----------|
| E-1 | Add a Distance prescription (all fields including PD) | Appears in Distance section, newest first |
| E-2 | Add a Reading prescription | Appears in Reading section |
| E-3 | Add prescription with only a few fields filled | Saves; blank fields shown as "—" |
| E-4 | Edit a prescription | Changes saved |
| E-5 | Delete a prescription | Removed from list |

---

### H2 — Health Visits

| # | Test | Expected |
|---|------|----------|
| HV-1 | Add a visit (all fields, no linked concern) | Appears in list newest-first; grouped by year |
| HV-2 | Add a visit linked to a concern | Concern name shown on visit card; visit appears on concern detail page under "Linked Visits" |
| HV-3 | Filter visit list by provider type | Only matching visits shown |
| HV-4 | Tap a visit card | Navigates to visit detail page |
| HV-5 | Visit detail shows all fields correctly | Date, provider, type, reason, what was done, outcome, cost, notes all correct |
| HV-6 | Add a photo to a visit | Photo appears in gallery on detail page |
| HV-7 | Delete a photo | Removed from gallery |
| HV-8 | Edit a visit | Modal pre-fills all fields; changes saved; navigates back to detail page |
| HV-9 | Delete a visit | Removed from list; navigates back to visits list |
| HV-10 | Visit detail shows "Medications Prescribed" for linked meds | Any medication with prescribedAtVisitId pointing here is listed |
| HV-11 | Visit detail shows "Conditions Diagnosed" for linked conditions | Any condition with diagnosedAtVisitId pointing here is listed |
| HV-12 | Visit detail shows "Blood Work Ordered" for linked blood work | Any blood work record with orderedAtVisitId pointing here is listed and clickable |
| HV-13 | Submit visit with no date | Validation prevents save |

---

### H3 — Medications

| # | Test | Expected |
|---|------|----------|
| M-1 | Add an active medication (all fields, linked to a visit) | Appears in "Current Medications"; linked visit shown on detail |
| M-2 | Add an Ongoing-type medication | "Ongoing" badge on card |
| M-3 | Add a Short-term medication | "Short-term" badge on card |
| M-4 | Add an As-needed medication | "As-needed" badge on card |
| M-5 | "Mark as Done" on an active medication | Prompts for end date; moves to "Medication History" |
| M-6 | Medication history section collapsed by default | Expands on tap; shows completed meds |
| M-7 | Edit a medication | Changes saved |
| M-8 | Delete a medication | Removed from list |
| M-9 | Add medication with no name | Validation prevents save |

---

### H3 — Conditions

| # | Test | Expected |
|---|------|----------|
| C-1 | Add a condition (all fields, linked to a visit) | Appears in "Active / Managed" section |
| C-2 | Add condition with status = managed | "Managed" badge on card |
| C-3 | Add condition with status = resolved | Appears in "Resolved Conditions" section |
| C-4 | Edit a condition | Changes saved |
| C-5 | Delete a condition | Removed from list |
| C-6 | Active/Managed conditions auto-appear on Emergency Info Card | Emergency card's "Critical Conditions" section reflects these without manual entry |

---

### H3 — Concerns

| # | Test | Expected |
|---|------|----------|
| CN-1 | Add an open concern (all fields) | Appears in "Open Concerns" section |
| CN-2 | Tap a concern card | Navigates to concern detail page |
| CN-3 | Add a journal update to a concern | Appears in journal timeline on detail page, newest first |
| CN-4 | Add a journal update with pain scale | Pain scale value shows on journal entry |
| CN-5 | Add a photo to a concern | Photo gallery appears on detail page |
| CN-6 | "Mark Resolved" on a concern | Prompts for resolved date; moves to "Resolved Concerns"; resolved date shown |
| CN-7 | Resolved concerns section collapsed by default | Expands on tap |
| CN-8 | Visit linked to a concern shows that visit on concern detail | "Linked Visits" section on concern detail shows the visit |
| CN-9 | Edit a concern | Changes saved; navigates back to detail |
| CN-10 | Delete a concern | Removed from list |

---

### H4 — Blood Work

| # | Test | Expected |
|---|------|----------|
| BW-1 | Add a blood work record manually (date + markers) | Appears in list, newest first; marker count shown on card |
| BW-2 | Add markers via the marker table in the modal | Each row has name, value, unit, ref range, flagged checkbox |
| BW-3 | Mark a marker as flagged | Row highlights red in detail view |
| BW-4 | Tap a blood work card | Navigates to detail page showing all markers in a table |
| BW-5 | Edit a blood work record | Modal pre-fills all fields and markers; changes saved |
| BW-6 | Delete a blood work record | Removed from list |
| BW-7 | Link blood work to a visit via orderedAtVisitId | Linked visit shows on blood work detail; visit detail shows blood work under "Blood Work Ordered" |
| BW-8 | LLM Import — open import modal, paste sample lab text, parse | Returns structured markers; editable preview shown |
| BW-9 | LLM Import — apply imported markers | Markers populate the blood work modal's marker table |
| BW-10 | Trends modal — select a marker name | Table shows all recorded values for that marker across all records, sorted by date |
| BW-11 | Flagged values in trend table | Highlighted red in trend table |
| BW-12 | Add blood work with no date | Validation prevents save |

---

### H5 — Vitals

| # | Test | Expected |
|---|------|----------|
| VT-1 | Add a Blood Pressure vital (value1 + value2) | Displayed as "122/78 mmHg"; unit auto-set |
| VT-2 | Add a Heart Rate vital (single value) | Value2 row hidden; displays "72 bpm" |
| VT-3 | Add O2 Sat, Blood Glucose, Temperature vitals | Each auto-sets correct unit; displayed correctly |
| VT-4 | Filter vitals by type | Only selected type shown |
| VT-5 | Trend modal — select type | Table shows all values for that type sorted by date |
| VT-6 | Edit a vital | Changes saved |
| VT-7 | Delete a vital | Removed from list |
| VT-8 | Changing type in add modal updates unit and shows/hides value2 | BP shows two value inputs; single-value types hide value2 |

---

### H5 — Insurance

| # | Test | Expected |
|---|------|----------|
| IN-1 | Add an insurance policy (all fields) | Appears on list page grouped by type |
| IN-2 | Tap a policy card | Navigates to policy detail page |
| IN-3 | Policy detail shows all fields | Carrier, plan, member ID, dates, premium, deductible, OOP max, beneficiaries, phone, website, notes |
| IN-4 | Add a photo to an insurance policy | Photo appears in gallery on detail page |
| IN-5 | Edit a policy | Modal pre-fills all fields; changes saved; navigates back to detail |
| IN-6 | Deactivate a policy | Status changes to inactive; "Reactivate" button appears |
| IN-7 | Reactivate a policy | Status returns to active; "Deactivate" button appears |
| IN-8 | Inactive policies shown collapsed / de-emphasized on list | Active policies prominent; inactive separated or subdued |
| IN-9 | No delete button on insurance policies | Only deactivate/reactivate — no way to hard-delete |

---

### H5 — Emergency Info Card

| # | Test | Expected |
|---|------|----------|
| EM-1 | Navigate to Emergency Info on empty state | Page shows "Tap Edit" prompt |
| EM-2 | Open Edit modal | All fields present: blood type, organ donor, doctor, contacts, medications, allergies, notes |
| EM-3 | Add emergency contacts via + Add Contact | Each row has name, relationship, phone inputs |
| EM-4 | Remove a contact row | Row removed |
| EM-5 | Select critical medications from the checklist | Only active medications appear; selected ones saved |
| EM-6 | Save emergency info | Card renders with all entered data |
| EM-7 | Active/managed conditions auto-appear in "Critical Conditions" section | Reflects conditions without manual entry |
| EM-8 | Edit again — previously saved data pre-fills | All fields restore from Firestore |
| EM-9 | Emergency contacts with phone numbers | Phone shown as a tappable `tel:` link on the card |

---

### H6 — Appointments

| # | Test | Expected |
|---|------|----------|
| AP-1 | Add a scheduled appointment (all fields) | Appears in "Upcoming" section with "Scheduled" badge |
| AP-2 | Add an appointment in the past (date before today) | Appears in "Overdue" section with red "Overdue" badge |
| AP-3 | Add appointment with no time | Saves; date shown without time |
| AP-4 | Edit an appointment | Modal pre-fills all fields; changes saved |
| AP-5 | Cancel an appointment | Confirm prompt shown; moves to "Past Appointments" with "Cancelled" badge |
| AP-6 | Delete an appointment | Removed from list |
| AP-7 | Mark Done — open convert modal | Form pre-fills date, provider, and provider type from appointment; reason/notes blank |
| AP-8 | Mark Done — save the visit | New Health Visit created; appointment status = completed; "View Visit" button appears on appointment card |
| AP-9 | "View Visit" button | Navigates to the newly created Health Visit detail page |
| AP-10 | Completed appointment shows linked visit | Visit date and provider shown via "View Visit" link |
| AP-11 | Add appointment with no date | Validation prevents save |

---

### Cross-Feature Links

| # | Test | Expected |
|---|------|----------|
| XF-1 | Visit → Concern link | Visit detail shows concern name; concern detail shows the visit under "Linked Visits" |
| XF-2 | Visit → Medication link | Visit detail shows medications prescribed at that visit |
| XF-3 | Visit → Condition link | Visit detail shows conditions diagnosed at that visit |
| XF-4 | Visit → Blood Work link | Visit detail shows blood work ordered at that visit; each is clickable |
| XF-5 | Appointment → Visit conversion | Appointment marked complete; visit created; both sides linked |
| XF-6 | Emergency Info → Conditions auto-pull | Active/managed conditions appear on emergency card without manual re-entry |
| XF-7 | Emergency Info → Medications checklist | Only active medications appear; selected ones shown on card |

---

### Responsive / Mobile Layout

| # | Test | Expected |
|---|------|----------|
| R-1 | Health hub tile grid at 375px width | Tiles wrap to 1-column or remain readable 2-column |
| R-2 | All list pages at 375px | Cards stack cleanly; no horizontal overflow |
| R-3 | All modals at 375px | Modals fill screen width; inputs usable; buttons reachable |
| R-4 | Blood work marker table in modal at 375px | Table scrolls horizontally inside modal; does not break layout |
| R-5 | Emergency contact row grid at 375px | Contact inputs stack to 2-column grid (per CSS breakpoint) |
| R-6 | Visit detail grid at 375px | Label/value rows stack vertically |
| R-7 | All "page-header" bars at 375px | Title + buttons fit; no overflow or overlap |
| R-8 | Insurance detail grid at 375px | Fields readable; no truncation |

---

### Edge Cases

| # | Test | Expected |
|---|------|----------|
| EC-1 | Open any add modal, press Cancel | No data saved; modal closes cleanly |
| EC-2 | Open edit modal, change a field, press Cancel | Original data unchanged |
| EC-3 | Delete last item in any list | "No items" empty state shown |
| EC-4 | Navigate directly to a detail URL (e.g. `#health-visit/badid`) | Graceful error or empty state — no JS crash |
| EC-5 | Blood work with zero markers | Saves; detail page shows "No markers" message |
| EC-6 | LLM import with no API key configured | Error message shown in import modal; does not crash |
| EC-7 | Emergency info with no active medications | Medication checklist shows "No active medications" |
| EC-8 | Concern with no journal entries | Detail page shows empty state for journal section |
