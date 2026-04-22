# AskGPT — Planning Document

## Status: PLANNING — No code changes yet

---

## Understanding the Existing SecondBrain Feature

Before designing AskGPT, here is how the existing SecondBrain "quick log" works. This is critical context because AskGPT will follow the same LLM integration pattern.

### How SecondBrain Works (End to End)

1. **User opens the modal** via a floating button ("SecondBrain"). The modal has a text input and an optional photo strip.

2. **Context is built** (`_sbBuildContext`): Before calling the LLM, the app queries every Firestore collection (zones, plants, weeds, chemicals, vehicles, rooms, things, etc.) and assembles a lean JSON snapshot — IDs and names only. This is cached for 5 minutes.

3. **System prompt is constructed** (`_sbBuildSystemPrompt`): A large system prompt is built that:
   - Includes the full context JSON
   - Defines every possible action and its exact expected JSON response shape
   - Injects today's date and current time
   - Optionally injects the current page context (e.g. "user is viewing plant Azalea #3")

4. **LLM is called** (`_sbCallLLM`): Reads the user's LLM settings (provider, API key, model) from `userCol('settings').doc('llm')` in Firestore. Supports OpenAI and Grok. Sends a `messages` array with the system prompt and the user's text (plus any photo data URLs as vision content).

5. **LLM responds with a single JSON object** — no explanation, no markdown, just raw JSON. The action is one of ~18 defined types (LOG_ACTIVITY, ADD_PLANT, ADD_CALENDAR_EVENT, etc.), each with a specific payload shape. Example:
   ```json
   { "action": "LOG_ACTIVITY", "payload": { "targetType": "plant", "targetId": "abc123", "targetLabel": "Azalea #3", "description": "fertilized", "date": "2026-04-01", ... } }
   ```

6. **Response is parsed** (`_sbParseResponse`): Strips any accidental markdown fences, then `JSON.parse`s. Falls back to `UNKNOWN_ACTION` if parsing fails.

7. **Confirmation screen is shown** (`_sbRenderConfirmFields`): The parsed result is rendered into a confirmation modal with human-readable fields. The user can edit values (target, description, date, etc.) before confirming.

8. **Write is executed** (`_sbWrite`): On confirm, dispatches to the correct Firestore write based on `action`. Saves to command history (localStorage).

### Key Design Points
- The LLM's only job is **data extraction and routing** — it returns a structured JSON command, not conversational text.
- The app provides the LLM with full context (all entity names/IDs) so it can resolve "my Azalea" → `{id: "abc123"}`.
- The user always sees a confirmation step before any data is written.
- Page context awareness: if you open SecondBrain while viewing a plant, "it has a bug problem" will target that plant automatically.

---

## AskGPT — New Feature Concept

### What It Is
A natural language query interface. The user asks a question about their data ("when did I go to Philadelphia?", "when did I last mow the lawn?", "what chemicals have I used on the front yard?") and gets a plain-English answer back. Read-only — no writes.

### Scope
- Works across ALL data: activities, journal entries, facts, problems, projects, calendar events, photos (captions), weeds, plants, zones, tracking entries, mileage logs, interactions
- Single question → single answer (no back-and-forth conversation for now)
- Uses OpenAI (same provider already configured in settings)

---

## Architecture Decision: Embeddings vs. Two-Stage Index

### Why NOT embeddings (for now)

Your friend's idea is real and powerful, but it introduces significant complexity for Bishop's scale:

- Each record would need an embedding vector (~1,500 floats ≈ 6KB) stored in Firestore
- You'd need to generate embeddings via a separate OpenAI API call every time you add/edit a record
- At query time, you'd download ALL vectors to the browser and compute similarity in JavaScript
- At 2,000 records × 6KB = 12MB download per query — too slow on mobile
- Grok (your fallback provider) has no embeddings API — creates a dependency on OpenAI specifically
- If you forget to generate an embedding when saving a record, that record becomes invisible to queries

Embeddings are the right answer at very large scale (50,000+ records). Bishop won't hit that.

### Recommended Approach: Two-Stage Index

This achieves the same goal without embeddings. Here's how it works:

**Stage 1 — Find the relevant records**

Build a "search index": a compact one-liner per record across all collections. Example:
```
[ACT] 2025-08-14 | zone: Front Yard | "mowed the lawn" | id:abc123
[JRN] 2025-07-04 | "Drove to Philadelphia for the weekend, stayed at..." | id:def456
[FACT] plant: Azalea #3 | "planted in spring 2023" | id:ghi789
```

Send this index + the user's question to GPT. GPT returns a JSON list of the IDs that are likely relevant. This is a tiny, fast call — no full record body text is included yet.

**Stage 2 — Answer the question**

Fetch the full records for only those IDs. Send the full text (journal body, activity notes, etc.) + the original question to GPT. GPT returns a plain-English answer.

### Why This Works Well for Bishop

| Concern | Reality |
|---|---|
| Index size after 2 years | ~2,000 records × ~80 chars = ~160KB — well within GPT-4o's 128K token window |
| Index size after 5 years | ~5,000 records × ~80 chars = ~400KB — still fine |
| Journal entries too long? | Stage 1 only sends the first line/title — full body fetched only in Stage 2 |
| Cost | Two small API calls per query — fractions of a cent |
| Complexity | No embedding API, no vector math, no extra Firestore fields |
| New records automatically searchable? | Yes — no extra work needed when saving |

The ceiling is real but far away. If Bishop someday has 20,000+ records, we revisit embeddings then.

---

## Data Collections to Index

Every collection that contains user-recorded content:

| Collection | What to include in Stage 1 index |
|---|---|
| `activities` | date, targetType+targetLabel, description |
| `journalEntries` | date, first ~100 chars of entryText |
| `facts` | targetType+targetLabel, label, value |
| `problems` | date, targetType+targetLabel, description |
| `projects` | targetType+targetLabel, title |
| `calendarEvents` | date, title |
| `trackingEntries` | date, categoryName, value |
| `mileageLogs` | date, vehicleLabel, mileage |
| `interactions` | date, personName, first ~80 chars of notes |
| `photos` | targetType+targetLabel, caption (if set) |
| `weeds` | name, treatmentMethod |
| `plants` | name, zoneName |
| `savedActions` | name, description |
| `notes` (notebooks) | notebook name, first ~100 chars |

Collections to **exclude** (not user content — just configuration):
- `zones`, `rooms`, `floors`, `things` (structural, not event data — but names are embedded in other records already)
- `chemicals` (product definitions — but referenced in activities)
- `people`, `vehicles` (entity definitions — referenced in activities/interactions)
- `settings` (config)

---

## UI Design

- **Entry point**: A new button in the nav bar or on the home screen, labeled "Ask" (or similar)
- **Modal**: Simple — a text input, a "Ask" button, and a results area
- **Loading state**: "Searching your data..." while Stage 1 runs, "Thinking..." while Stage 2 runs
- **Answer display**: Plain text paragraph. Optionally show which records were referenced (e.g. "Based on 3 journal entries").
- **No confirmation step** needed — this is read-only, nothing is written
- **No history needed** for v1 — but easy to add later

---

## LLM Call Design

### Stage 1 Prompt (find relevant records)
```
System: You are a search assistant. Given the user's question and a compact index of records,
return ONLY a JSON array of record IDs that are relevant to answering the question.
Return [] if nothing is relevant. No explanation. Just the JSON array.

Index:
[ACT] 2025-08-14 | zone: Front Yard | "mowed the lawn" | id:abc123
[JRN] 2025-07-04 | "Drove to Philadelphia..." | id:def456
...

User: when did I last mow the lawn?
```
GPT returns: `["abc123"]`

### Stage 2 Prompt (answer the question)
```
System: You are a personal assistant helping the user query their life and home tracking data.
Answer the user's question using ONLY the records provided. Be concise and specific.
If the answer isn't in the records, say so.

Records:
[ACTIVITY] id:abc123 | 2025-08-14 | Front Yard | "mowed the lawn" | notes: "used the riding mower"

User: when did I last mow the lawn?
```
GPT returns: `"You last mowed the lawn on August 14, 2025 in the Front Yard. You used the riding mower."`

---

## Handling Long Records (e.g. Journal Entries)

The Stage 1 index only needs to be long enough for GPT to judge relevance — it does NOT need the full text. For journal entries, Stage 1 gets the first ~150 characters:

```
[JRN] 2025-07-04 | "Drove to Philadelphia for the weekend, stayed at the Marriott..." | id:def456
```

That's enough for GPT to say "yes, this entry is probably about Philadelphia" and include the ID. Then in Stage 2, the app fetches the **full journal entry text** — all paragraphs — and GPT reads the complete content to form the answer.

**Known limitation:** If the relevant detail is buried deep in an entry (e.g. paragraph 1 is about groceries, paragraph 4 mentions Philadelphia), Stage 1 might not flag it. This is an acceptable tradeoff — most journal entries lead with their main topic. Worth noting in the UI ("Results are based on the beginning of each entry and may occasionally miss deeply buried details").

The same truncation logic applies to any long free-text field (activity notes, project notes, etc.) — first 150 chars for Stage 1, full text in Stage 2.

---

## Decisions (Resolved)

| Question | Decision |
|---|---|
| Feature name | "Ask me a question?" |
| Entry point | Under "Quick Log" section on the main/home screen |
| Source record links | Yes — each referenced record links to its detail page (plant, zone, journal entry, etc.) |
| Stage 1 match cap | 50 IDs maximum |
| "List all" queries | Yes, answer can be a bulleted list |
| Error handling | TBD during build |

---

## Navigation Targets for Source Links

When GPT references a record in its answer, the app needs to know where to link. Map by collection:

| Collection | Route |
|---|---|
| activities | `#zone/{targetId}` or `#plant/{targetId}` depending on targetType |
| journalEntries | `#journal/{id}` (or journal page scrolled to entry) |
| plants | `#plant/{id}` |
| zones | `#zone/{id}` |
| weeds | `#weed/{id}` |
| chemicals | `#chemical/{id}` |
| vehicles | `#vehicle/{id}` |
| people | `#person/{id}` |
| rooms/things | `#house` (house page) |
| calendarEvents | `#calendar` |
| trackingEntries | `#tracking` |
| notes | `#notebook/{notebookId}` |

Stage 2 response JSON will need to include enough info (collection + id) for the app to generate these links.

---

## Open Questions / Still To Decide

1. **Error handling**: What to show if Stage 1 returns 0 matches? ("I couldn't find anything related to that in your data.") What if Stage 2 can't form an answer from the matched records?
2. **Stage 2 response format**: Should GPT return plain text, or a structured JSON with `{ answer: "...", sources: [{collection, id, label}] }`? Structured is more work but enables clickable source links cleanly.
3. **Index build timing**: Build the full index fresh on every query (simple, always current) or cache it like SecondBrain does (faster, 5-min stale)? Given query is less frequent than quick-log, fresh each time is probably fine.

