# SecondBrain — Natural Language Command Interface

## Vision

A voice-first shortcut layer on the home screen. The user speaks (or types) a
plain-English command, optionally attaches photos, and the app sends everything to an
LLM. The LLM returns a single JSON object describing the action to take. A confirmation
screen lets the user review and edit before anything is written. Zero navigation required.

---

## Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Confirmation screen editable? | Yes — fields are editable inline. Goal is no editing needed long-term, but useful while tuning. |
| 2 | "Confirm & Go" destination | Navigates to the target's detail page (person, zone, plant, vehicle, etc.) — see per-action table below |
| 3 | Reusing existing write functions | Build a dedicated `_sb` write library inside `secondbrain.js` — simple direct Firestore writes, not relying on DOM form state |
| 4 | LLM provider / multimodal format | Both current providers (OpenAI + Grok) use OpenAI-compatible format. `chatCallOpenAICompat` in `chat.js` already handles text + image content blocks. SecondBrain adds a `system` message to the messages array. No new format or settings needed — photos already work app-wide. |
| 5 | Voice input trigger | Tap to start, tap to stop (same as app's current voice pattern), then press Send |
| 6 | Loading state | Spinner shown in the input modal while awaiting LLM response |
| 7 | Chemical not in list | Confirmation screen shows all known chemicals as a checklist; unknown ones are flagged with an option to confirm-add as a new chemical |
| 8 | Photos with no text | Require at least some text — show validation message if user tries to send with photos only |
| 9 | Target type scope | Expand to ALL entity types: zone, plant, weed, vehicle, floor, room, thing, subthing, garageroom, garagething, garagesubthing, structure, structurething, structuresubthing, person. LLM resolves "office" → 1st Floor / Office using the house JSON. |
| 10 | Button placement | Prominent button at the top of the home (main) screen for now. Can refine placement later. |
| 11 | Context-aware targeting (current page) | Not needed yet since button is on home screen. Future enhancement. |
| 12 | Multi-action utterances | One action at a time |
| 13 | Ambiguous targets | LLM picks best match; confirmation screen shows a dropdown (populated from context) to override the target if `ambiguous: true` or user wants to change it |
| 14 | New person not in context | Confirmation shows warning "Jake not found — confirm will create Jake as a new person." No silent auto-creation. |
| 15 | Typed input fallback | Yes — input modal has both mic and text box |

---

## "Confirm & Go" Destination Per Action

| Action | Confirm & Go Navigates To |
|---|---|
| ADD_JOURNAL_ENTRY | Journal page (#journal) |
| ADD_CALENDAR_EVENT | Calendar page (#calendar) |
| LOG_ACTIVITY | Target's detail page (zone, plant, vehicle, room, etc.) |
| ADD_PROBLEM | Target's detail page |
| ADD_IMPORTANT_DATE | Person's detail page (created if needed) |
| LOG_MILEAGE | Vehicle's detail page |
| ADD_FACT | Target's detail page |
| ADD_PROJECT | Target's detail page |
| LOG_INTERACTION | Person's detail page |
| ADD_WEED | Weed's detail page (#weed/id) |
| ADD_TRACKING_ENTRY | Journal tracking page (#journal-tracking) |
| ADD_THING | Parent room/thing detail page |
| ATTACH_PHOTOS | Target's detail page |
| UNKNOWN_ACTION | N/A — no confirm available |

---

## Flow

```
[Home Screen — top of page]
     │
     ▼
 🧠 [SecondBrain] button
     │
     ▼
 Input Modal
   ┌──────────────────────────────────────┐
   │  📷 [Camera]  🖼 [Gallery]           │
   │  ┌──────────────────────────────┐    │
   │  │  [thumb]  photo1.jpg  ×      │    │  ← attached photos (0–N, removable)
   │  │  [thumb]  photo2.jpg  ×      │    │
   │  └──────────────────────────────┘    │
   │  🎤 [Tap to Speak / Tap to Stop]     │
   │  ─── or ───                          │
   │  [ Type a command...               ] │
   │                                      │
   │  [Send]  [Cancel]                    │
   └──────────────────────────────────────┘
     │  (validation: text required)
     ▼
 [Spinner — "Thinking..."]
 Prompt Builder
   - User text (voice → text, or typed)
   - Attached photos (base64 image_url blocks if present)
   - System prompt (action list + JSON schemas)
   - Context snapshot (all entities)
   - Today's date + current time
     │
     ▼
 LLM Call
   - Reuses chatCallOpenAICompat() from chat.js
   - Adds { role: 'system', content: systemPrompt } to messages array
   - User message content: string (text-only) or array (text + image_url blocks)
     │
     ▼
 Response Parser
   - Expect raw JSON only
   - Strip accidental markdown fences if present (safety net)
   - If parse still fails → UNKNOWN_ACTION fallback
     │
     ▼
 Confirmation Modal (editable)
   ┌──────────────────────────────────────┐
   │  SecondBrain — Confirm               │
   │────────────────────────────────────│
   │  📓 Add Journal Entry               │
   │                                      │
   │  Date:   [03/27/2026        ]        │  ← editable
   │  Time:   [09:01 AM          ]        │  ← editable
   │  Entry:  [This morning I talked   ]  │  ← editable textarea
   │           [to Connie about vacation] │
   │  Mentions: Connie ✓                  │
   │  Photos:  2 attached                 │
   │                                      │
   │  [✓ Confirm & Go] [✓ Confirm & Done] │
   │  [✗ Cancel]                          │
   └──────────────────────────────────────┘
     │
     ▼
 _sb write library executes Firestore write(s)
 Photos saved to photos collection (if any)
```

---

## Context Payload Sent to LLM

Built fresh on each SecondBrain open (cached in memory for 5 minutes, invalidated after
any successful confirm). Lean format: IDs + names only.

```json
{
  "today": "2026-03-27",
  "currentTime": "09:01",
  "zones": [
    {
      "id": "abc1", "name": "Front Yard", "level": 1,
      "children": [
        { "id": "abc2", "name": "By Mailbox", "level": 2, "children": [] }
      ]
    },
    { "id": "abc3", "name": "Back Yard", "level": 1, "children": [] }
  ],
  "plants": [
    { "id": "p1", "name": "Rose Bush #1", "zoneId": "abc2", "zoneName": "By Mailbox" }
  ],
  "people": [
    { "id": "per1", "name": "Connie" },
    { "id": "per2", "name": "Jim" }
  ],
  "vehicles": [
    { "id": "v1", "label": "2018 Ford F-150", "nickname": "Truck" }
  ],
  "weeds": [
    { "id": "w1", "name": "Wild Onions" },
    { "id": "w2", "name": "Crabgrass" }
  ],
  "chemicals": [
    { "id": "c1", "name": "Round-Up" }
  ],
  "trackingCategories": [
    { "id": "tc1", "name": "Weight" },
    { "id": "tc2", "name": "Blood Pressure" }
  ],
  "house": [
    {
      "id": "fl1", "name": "1st Floor", "type": "floor",
      "rooms": [
        {
          "id": "rm1", "name": "Office", "type": "room",
          "things": [
            {
              "id": "th1", "name": "Desk", "type": "thing",
              "subthings": [
                { "id": "st1", "name": "Monitor", "type": "subthing" }
              ]
            }
          ]
        }
      ]
    }
  ],
  "garage": [
    {
      "id": "gr1", "name": "Main Garage", "type": "garageroom",
      "things": []
    }
  ],
  "structures": [
    { "id": "str1", "name": "Shed", "type": "structure", "things": [] }
  ]
}
```

---

## LLM Integration

### Provider Format
Both current providers use OpenAI-compatible format. SecondBrain reuses `chatCallOpenAICompat()`
from `chat.js` with one difference: it adds a `system` message.

```js
// Text-only call
messages = [
    { role: 'system',  content: systemPrompt },
    { role: 'user',    content: userText }
];

// Multimodal call (photos attached)
messages = [
    { role: 'system',  content: systemPrompt },
    { role: 'user',    content: [
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
        { type: 'text', text: userText }
    ]}
];
```

### Vision Support
The app already sends images to the LLM via the existing chat/photo features using
`chatCallOpenAICompat`. SecondBrain uses the exact same mechanism — no additional
settings or flags needed. If photos work elsewhere in the app, they work here.

### JSON-Only Response
The system prompt instructs the LLM to return ONLY raw JSON. As a safety net, the
response parser strips leading/trailing markdown code fences (` ```json ... ``` `)
before parsing, since some models add them regardless of instructions.

---

## LLM System Prompt

```
You are a data extraction assistant for a home, yard, and life tracking app called Bishop.

The user will give you a natural language command, and may have attached photos.
Your ONLY job is to return a single valid JSON object — nothing else.
No explanation. No markdown. No code fences. Just the raw JSON object.

Today's date is {today}. Current time is {currentTime}.

The user's existing data is below. Use it to resolve names and places to their IDs.
Pick the closest match. Set "ambiguous": true if you are not confident.
For house locations, resolve the full path (e.g. "office" → floor "1st Floor", room "Office").

{contextJSON}

Classify the command into exactly one action and return that JSON structure.
If nothing fits, return UNKNOWN_ACTION.

--- ACTIONS ---

ADD_JOURNAL_ENTRY
Use when: logging a personal journal entry, diary note, or thought.
{
  "action": "ADD_JOURNAL_ENTRY",
  "payload": {
    "date": "YYYY-MM-DD",
    "entryTime": "HH:MM",
    "entryText": "full entry text",
    "mentionedPersonIds": [],
    "mentionedPersonNames": []
  }
}

ADD_CALENDAR_EVENT
Use when: scheduling something, setting a reminder, or noting a future task.
{
  "action": "ADD_CALENDAR_EVENT",
  "payload": {
    "title": "short title",
    "date": "YYYY-MM-DD",
    "description": "",
    "recurring": null
  }
}
recurring options: null | { "type": "weekly" } | { "type": "monthly" } | { "type": "intervalDays", "intervalDays": N }

LOG_ACTIVITY
Use when: user did something physical — yard work, maintenance, painting, fixing, cleaning.
Targets can be any entity in the context (zone, plant, weed, vehicle, room, thing, etc.).
{
  "action": "LOG_ACTIVITY",
  "payload": {
    "targetType": "zone|plant|weed|vehicle|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing",
    "targetId": "id from context",
    "targetLabel": "human-readable full path (e.g. 1st Floor / Office)",
    "description": "what was done",
    "date": "YYYY-MM-DD",
    "notes": "",
    "chemicalIds": [],
    "chemicalLabels": [],
    "unknownChemicals": [],
    "ambiguous": false
  }
}

ADD_PROBLEM
Use when: user reports an issue or concern with any entity.
{
  "action": "ADD_PROBLEM",
  "payload": {
    "targetType": "zone|plant|weed|vehicle|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing",
    "targetId": "id from context",
    "targetLabel": "human-readable full path",
    "description": "problem description",
    "notes": "",
    "dateLogged": "YYYY-MM-DD",
    "ambiguous": false
  }
}

ADD_IMPORTANT_DATE
Use when: user mentions a birthday, anniversary, or important date for a person.
{
  "action": "ADD_IMPORTANT_DATE",
  "payload": {
    "personId": "id from context, or null if not found",
    "personName": "name as spoken",
    "personFound": true,
    "label": "Birthday|Anniversary|etc",
    "month": 1,
    "day": 2,
    "year": null,
    "notes": ""
  }
}

LOG_MILEAGE
Use when: user states current mileage of a vehicle.
{
  "action": "LOG_MILEAGE",
  "payload": {
    "vehicleId": "id from context",
    "vehicleLabel": "human-readable name",
    "mileage": 12345,
    "date": "YYYY-MM-DD",
    "notes": ""
  }
}

ADD_FACT
Use when: user states a factual attribute about any entity (size, date, preference, etc.).
{
  "action": "ADD_FACT",
  "payload": {
    "targetType": "zone|plant|weed|vehicle|person|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing",
    "targetId": "id from context",
    "targetLabel": "human-readable full path",
    "label": "fact label",
    "value": "fact value",
    "ambiguous": false
  }
}

ADD_PROJECT
Use when: user mentions a future improvement or task to track (not a scheduled reminder).
{
  "action": "ADD_PROJECT",
  "payload": {
    "targetType": "zone|plant|vehicle|floor|room|thing|garageroom|structure",
    "targetId": "id from context",
    "targetLabel": "human-readable full path",
    "title": "project title",
    "notes": "",
    "ambiguous": false
  }
}

LOG_INTERACTION
Use when: user describes meeting, talking to, or spending time with a person.
{
  "action": "LOG_INTERACTION",
  "payload": {
    "personId": "id from context",
    "personName": "name as spoken",
    "personFound": true,
    "date": "YYYY-MM-DD",
    "notes": "summary of interaction"
  }
}

ADD_WEED
Use when: user reports finding a weed in a specific area. If photos attached, identify the weed species.
{
  "action": "ADD_WEED",
  "payload": {
    "name": "weed name (infer from photo if possible)",
    "existingWeedId": "id if already in context, else null",
    "alreadyExists": false,
    "zoneIds": [],
    "zoneLabels": [],
    "treatmentMethod": "",
    "applicationTiming": "",
    "notes": ""
  }
}

ADD_TRACKING_ENTRY
Use when: user logs a personal metric (weight, blood pressure, sleep, etc.).
{
  "action": "ADD_TRACKING_ENTRY",
  "payload": {
    "date": "YYYY-MM-DD",
    "categoryId": "id from context, or null if new",
    "categoryName": "category name",
    "categoryExists": true,
    "value": "value as string"
  }
}

ADD_THING
Use when: user wants to add a new tracked item to a room, garage, or structure.
If photos attached, identify what the item is from the image.
{
  "action": "ADD_THING",
  "payload": {
    "parentType": "room|thing|garageroom|garagething|structure|structurething",
    "parentId": "id from context",
    "parentLabel": "human-readable full path (e.g. 1st Floor / Office / Desk)",
    "name": "item name (infer from photo if possible)",
    "notes": "",
    "hasPhotos": true,
    "ambiguous": false
  }
}

ATTACH_PHOTOS
Use when: user wants to attach photos to an existing record without creating a new one.
{
  "action": "ATTACH_PHOTOS",
  "payload": {
    "targetType": "zone|plant|vehicle|weed|person|floor|room|thing|subthing|garageroom|garagething|garagesubthing|structure|structurething|structuresubthing",
    "targetId": "id from context",
    "targetLabel": "human-readable full path",
    "caption": "optional caption from speech",
    "ambiguous": false
  }
}

UNKNOWN_ACTION
Use when: nothing above fits.
{
  "action": "UNKNOWN_ACTION",
  "payload": {
    "raw": "user's original text",
    "llmNote": "brief note on why it wasn't recognized"
  }
}

--- END ACTIONS ---

Rules:
1. Return ONLY the JSON. No other text, no markdown, no code fences.
2. Dates default to {today}. Times default to {currentTime}.
3. Resolve all entity names to IDs from context. Use closest match.
4. Set "ambiguous": true when not confident about an entity match.
5. If an entity is mentioned but not in context, set its ID to null and keep the name.
6. For house locations, always include the full path in targetLabel (e.g. "1st Floor / Office").
7. For LOG_ACTIVITY with a chemical not in context, add its name to "unknownChemicals": [].
```

---

## Defined Actions — Summary Table

| Action | Example Utterance | Target | Photos |
|---|---|---|---|
| ADD_JOURNAL_ENTRY | "This morning I talked to Connie about vacation" | None | Optional |
| ADD_CALENDAR_EVENT | "Remind me to change the oil April 15th" | Optional | No |
| LOG_ACTIVITY | "I just mowed the back yard" / "I painted the office" | Any entity | Optional |
| ADD_PROBLEM | "The rose bush has black spots on the leaves" | Any entity | Optional |
| ADD_IMPORTANT_DATE | "Jim's birthday is January 2nd" | Person | No |
| LOG_MILEAGE | "The truck is at 87,500 miles" | Vehicle | No |
| ADD_FACT | "The front garden bed is 120 square feet" | Any entity | No |
| ADD_PROJECT | "I need to install drip irrigation in the back yard" | Any entity | No |
| LOG_INTERACTION | "Had lunch with Connie, talked about the new deck" | Person | No |
| ADD_WEED | "There's crabgrass showing up in the back yard" | Zone | **Vision** |
| ADD_TRACKING_ENTRY | "My weight today is 182" | None | No |
| ADD_THING | "Add this to my office desk" | Room / Thing / Garage | **Vision** |
| ATTACH_PHOTOS | "Add these photos to the back yard" | Any entity | **Required** |
| UNKNOWN_ACTION | Anything unrecognized | N/A | N/A |

---

## Confirmation Screen — Detailed Behavior

### Editable fields
All displayed fields are editable inline before confirming. The goal long-term is that
no editing is needed, but during the early phase it's essential for catching LLM mistakes.
Field types match what they represent: date pickers for dates, text inputs for strings,
textareas for long text.

### Ambiguous target override
Target fields on the confirmation screen are always shown as a dropdown populated from
the full context (all zones, plants, vehicles, rooms, etc. as appropriate for the action
type). The LLM's best match is pre-selected. If `ambiguous: true`, the field is
highlighted in yellow to draw attention. User can accept or pick a different target
from the dropdown before confirming.

### Entity not found
**Person not found**: Warning shown — "Jake was not found in your People list. Confirming
will create Jake as a new person." Explicit confirm required.

**Zone / Plant / Vehicle / Room not found**: Warning — "'{name}' wasn't recognized —
this will be saved without a specific target." User can cancel and re-speak, or confirm.

**Chemical not found (LOG_ACTIVITY)**: Any chemicals in `unknownChemicals[]` are shown
on the confirmation screen with a checkbox: "Also add '{name}' as a new chemical?" User
opts in or not before confirming.

**New tracking category**: If `categoryExists: false`, badge shown: "New category will
be created." Auto-confirmed with the main action (no extra step needed).

### UNKNOWN_ACTION
Only Cancel available. Shows: *"SecondBrain didn't recognize this command. Try rephrasing
or use the app directly."* Raw text and LLM note are shown for context.

### LLM error / parse failure
Strip markdown fences and retry parse. If still fails, treat as UNKNOWN_ACTION with
message: *"SecondBrain got an unexpected response. Please try again."*

---

## Confirmation Screen — Fields Displayed Per Action

| Action | Fields Shown (all editable) |
|---|---|
| ADD_JOURNAL_ENTRY | Date, Time, Entry text, Mentioned people, Photo count |
| ADD_CALENDAR_EVENT | Title, Date, Recurring badge, Description |
| LOG_ACTIVITY | Target (full path), Description, Date, Chemicals checklist, Photo count |
| ADD_PROBLEM | Target (full path), Description, Date, Photo count |
| ADD_IMPORTANT_DATE | Person name, Label, Month/Day/Year, Person-not-found warning |
| LOG_MILEAGE | Vehicle, Mileage, Date |
| ADD_FACT | Target (full path), Label, Value |
| ADD_PROJECT | Target (full path), Title, Notes |
| LOG_INTERACTION | Person name, Date, Notes, Person-not-found warning |
| ADD_WEED | Weed name, Zone(s), "Already exists — add zone?" if applicable, Photo count |
| ADD_TRACKING_ENTRY | Category (+ "new" badge), Value, Date |
| ADD_THING | Parent path, Item name, Photo count |
| ATTACH_PHOTOS | Target (full path), Caption, Photo count |

---

## _sb Write Library

`secondbrain.js` contains a private `_sb` write library — simple direct Firestore writes
that do not depend on any DOM form state. Each function takes a plain data object and
returns the new document's ID (for "Confirm & Go" navigation).

```js
async function _sbAddJournalEntry(data)    // → writes to journalEntries
async function _sbAddCalendarEvent(data)   // → writes to calendarEvents
async function _sbLogActivity(data)        // → writes to activities
async function _sbAddProblem(data)         // → writes to problems
async function _sbAddImportantDate(data)   // → writes to peopleImportantDates (+creates person if needed)
async function _sbLogMileage(data)         // → writes to mileageLogs
async function _sbAddFact(data)            // → writes to facts
async function _sbAddProject(data)         // → writes to projects
async function _sbLogInteraction(data)     // → writes to peopleInteractions (+creates person if needed)
async function _sbAddWeed(data)            // → writes to weeds or updates zoneIds[]
async function _sbAddTrackingEntry(data)   // → writes to journalTrackingItems (+creates category if needed)
async function _sbAddThing(data)           // → writes to appropriate house collection
async function _sbAttachPhotos(photos, targetType, targetId, caption) // → writes to photos collection
async function _sbAddChemical(name)        // → writes to chemicals, returns new ID
async function _sbAddPerson(name)          // → writes to people, returns new ID
```

After the main write, if photos are attached, `_sbAttachPhotos()` is called with the
`targetType`/`targetId` of the newly created record.

---

## Photo Support

### Input Modal
Camera + Gallery buttons always present. 0–N photos. Thumbnails with × to remove.
Photos compressed to ~150KB client-side before sending (reuses `photos.js` compress logic).

### API Format (OpenAI-compatible)
```js
// User message content when photos are attached
content = [
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
    { type: 'text', text: userCommand }
]
```

### LLM Vision Behavior
- **ADD_WEED**: LLM identifies the weed species. `name` pre-filled in payload.
- **ADD_THING**: LLM identifies the item. `name` pre-filled in payload.
- **ADD_PROBLEM**: LLM describes what it sees in `description`.
- **LOG_ACTIVITY**: LLM may enrich `description` from image context.
- **ATTACH_PHOTOS**: LLM resolves target only; no image analysis needed.

### Vision
No special setting needed. SecondBrain reuses the same `chatCallOpenAICompat` call
the rest of the app already uses for photo analysis. If photos work elsewhere, they
work here.

### Photo Storage After Confirm
Each photo saved as a separate doc in `photos` collection:
`{ targetType, targetId, imageData (base64), caption, createdAt }`
This is identical to how the rest of the app stores photos.

---

## Technical Notes

- **LLM call**: Reuses `chatCallOpenAICompat()` from `chat.js`. SecondBrain adds
  `{ role: 'system', content: systemPrompt }` as the first message.
- **Voice**: Reuses existing `SpeechRecognition` wrapper. Tap to start, tap to stop.
- **New file**: `js/secondbrain.js` — all SecondBrain logic isolated here.
- **System prompt**: JS string constant in `secondbrain.js`. Not in Firestore.
- **Context cache**: 5-minute in-memory TTL. Invalidated after every successful confirm.
- **Token budget**: Context is IDs + names only. If plants > 100, consider sending
  only the 50 most recently created. House/garage structure is naturally bounded.
- **Markdown fence safety net**: Before JSON.parse(), strip ` ```json ``` ` wrappers
  that some models add despite instructions.

---

## Implementation Phases

### Phase A — Infrastructure
1. Prominent SecondBrain button at top of home screen
2. Create `js/secondbrain.js`
3. Input modal: Camera + Gallery, photo strip, tap-to-speak + text box, Send + Cancel
4. Client-side photo compression (reuse photos.js)
5. Context builder: queries all Firestore collections, builds context JSON, 5-min cache
6. Prompt builder: injects context + date/time into system prompt, builds messages array
7. LLM call: wraps `chatCallOpenAICompat` with system message; handles text + multimodal
8. Response parser: strip fences, JSON.parse, fallback to UNKNOWN_ACTION
9. Spinner / loading state during LLM call
10. Generic confirmation modal: renders editable fields per action type
11. Ambiguous target field uses dropdown populated from context (not free text)
12. Confirm & Go / Confirm & Done / Cancel wiring

### Phase B — First Actions
- ADD_JOURNAL_ENTRY
- ADD_CALENDAR_EVENT
- LOG_ACTIVITY — yard targets: zone, plant, weed + vehicle ("I mowed the back yard", "I washed the truck")
- LOG_MILEAGE — vehicles only ("The truck is at 92,000 miles")

### Phase C — Entity-Aware Actions (all entity types)
Targets for all actions below include: zone, plant, weed, vehicle, floor, room, thing,
subthing, garageroom, garagething, garagesubthing, structure, structurething, structuresubthing.
- ADD_PROBLEM — "The shed roof is leaking", "The truck is making a noise", "The garage door is sticking"
- ADD_FACT — "The shed is 12x16 feet", "The truck has a tow capacity of 10,000 lbs"
- ADD_PROJECT — "I want to paint the garage floor", "Replace the shed door"
- ADD_WEED — with vision identification from photo
- Expand LOG_ACTIVITY to all remaining targets:
  "I painted the office", "I cleaned out the garage", "I fixed the shed roof"

### Phase D — Inventory + Photo Attachment (all entity types)
- ADD_THING — add a tracked item to any room, garage room, or structure with optional
  vision identification: "Add this to my garage workbench", "Add this to the shed shelves",
  "Add this lamp to the office"
- ATTACH_PHOTOS — attach photos to any existing record:
  "Add these photos to the truck", "Add this to the shed", "Add these to the back yard"

### Phase E — People Actions
- ADD_IMPORTANT_DATE (+ new person auto-create)
- LOG_INTERACTION (+ new person auto-create)

### Phase F — Tracking
- ADD_TRACKING_ENTRY (+ new category auto-create)

---

## Design Notes & Future Ideas

1. **Context-aware targeting**: When on a specific record page (e.g., Rose Bush detail),
   SecondBrain could inject `window.currentPlant` as a hint so "it has aphids" targets
   automatically. Low effort, high value. Revisit after Phase B.

2. **Re-speak without cancel**: After UNKNOWN_ACTION, let the user re-speak/retype
   without fully dismissing. "Try again" button in the UNKNOWN_ACTION screen.

3. **History**: Keep a small local log of the last 10 SecondBrain commands + outcomes
   for debugging during early use.

---

## Status

- [x] Initial concept defined
- [x] All decisions resolved
- [x] Action list finalized (13 actions + UNKNOWN_ACTION)
- [x] LLM system prompt designed
- [x] Confirmation screen UX defined (editable)
- [x] _sb write library defined
- [x] "Confirm & Go" destinations defined per action
- [x] Implementation phases defined
- [ ] Phase A implementation
- [ ] Phase B implementation
- [ ] Phase C implementation
- [ ] Phase D implementation
- [ ] Phase E implementation
- [ ] Phase F implementation
