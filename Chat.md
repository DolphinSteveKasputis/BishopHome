# Chat Feature Plan

## Overview
Add a "Chat" button to the top nav bar. Clicking it opens a chat interface where the user can post questions to an LLM (ChatGPT or Grok) and receive responses.

---

## Decisions — All Resolved ✅

| Question | Decision |
|---|---|
| API key storage | Firestore via `userCol('settings').doc('llm')` — secure behind login |
| Context | Plain chat — no garden data included. Question sent as-is. |
| Conversation style | Single Q&A. Each question is independent. No thread. |
| Persistence | Ephemeral — no chat history saved. |
| LLM providers | ChatGPT (OpenAI) + Grok (xAI). Hard-coded default models. No Anthropic (removed). |
| Default models | OpenAI → `gpt-4o-mini`, xAI → `grok-3` |
| Keyboard shortcut | Ctrl+Enter (or Cmd+Enter) sends the message |

---

## API Details

| Provider | Endpoint | Auth | CORS |
|---|---|---|---|
| OpenAI (ChatGPT) | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer <key>` | Allowed from browser |
| xAI (Grok) | `https://api.x.ai/v1/chat/completions` | `Authorization: Bearer <key>` (OpenAI-compatible) | Allowed from browser |

Both providers use the same request/response shape — one shared `chatCallOpenAICompat()` function handles both.

---

## Implementation Spec

### Files
| File | Role |
|---|---|
| `js/chat.js` | All chat send/receive logic |
| `js/settings.js` | LLM provider + API key save/load (Settings page section) |
| `index.html` | `#page-chat` section + nav link |
| `js/app.js` | `'chat'` added to `ALL_PAGES`; `#chat` route handler calls `loadChatPage()` |

### Route
`#chat` → `loadChatPage()` in `chat.js`

### HTML Sections
- `#page-chat` — main chat page
  - `#chatNoConfig` — shown when no API key is configured (links to Settings)
  - `#chatInterface` — shown when configured
    - `#chatProviderLabel` — displays active provider name
    - `#chatQuestion` — textarea for user input
    - `#chatSendBtn` — Send button
    - `#chatStatus` — loading/error status text
    - `#chatResponseArea` — wrapper (hidden until response arrives)
    - `#chatResponse` — response text display
- Settings page additions:
  - `#llmProvider` — dropdown (ChatGPT / Grok)
  - `#llmApiKey` — masked input with Show/Hide toggle (`#llmApiKeyToggle`)
  - `#llmSaveBtn` — saves to Firestore
  - `#llmSavedMsg` — "Saved!" confirmation

### Firestore
- Path: `userCol('settings').doc('llm')`
- Fields: `provider` (string: `'openai'` or `'grok'`), `apiKey` (string)

### Key Functions in chat.js
| Function | Purpose |
|---|---|
| `loadChatPage()` | Loads config; shows interface or "go to Settings" prompt |
| `chatLoadConfig()` | Reads `userCol('settings').doc('llm')`, returns `{provider, apiKey}` or null |
| `sendChatMessage()` | Reads textarea, calls API, displays response |
| `chatCallOpenAICompat(llm, apiKey, question)` | Handles OpenAI and Grok (same request shape) |

### Key Functions in settings.js
| Function | Purpose |
|---|---|
| `loadLlmSettings()` | Reads Firestore and populates form on page load |
| `saveLlmSettings()` | Validates and writes `{provider, apiKey}` to Firestore |

---

## Response Display
Responses are rendered as **formatted markdown** using `marked.js` (CDN). Bold, headers, bullet lists, code blocks, etc. all display properly. The `marked.js` script tag is loaded in index.html immediately before `chat.js`.

---

## Nav
```
[Home] [Weeds] [Calendar] [Actions] [Chemicals] [House] [Settings] [Chat] ← new
```

---

## Open Items / Risks

- **Cost**: Each API call costs money on the user's account. No rate limiting planned.
- **Key visibility**: API key is visible in browser dev tools (Network tab during a request). Acceptable for a personal home app.
- **Markdown rendering**: Responses rendered via `marked.js`. ✅

---

## Phase CH-2 — Image Attachment (Plant Identification)

### Overview
Allow the user to attach a photo to a chat message so they can ask questions like "What is this plant?" or "Is this a weed?". Both OpenAI and Grok support image inputs via their APIs using the same request format.

### How the API Works
Instead of sending `content` as a plain string, send it as an array:
```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What is this plant?" },
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
  ]
}
```
When no image is attached, `content` stays as a plain string (no change to current behavior).

### UI Changes
- Add a **📎 Attach Photo** button below the textarea (or a small camera/clip icon)
- Clicking it opens a file picker (accepts image files) OR triggers the camera on mobile
- Once an image is selected:
  - Compress it client-side using the existing `compressPhoto()` logic from `photos.js` (~100-200KB target)
  - Show a small thumbnail preview next to the textarea
  - Show an **✕ Remove** button to clear the image
- The Send button works the same — if an image is attached it's included, if not it's text-only

### Code Changes
| File | Change |
|---|---|
| `js/chat.js` | Store attached image as base64 in a module-level variable; update `sendChatMessage()` to build array content when image is present; update `chatCallOpenAICompat()` to accept content as string or array |
| `index.html` | Add attach button, hidden file input, thumbnail preview `<img>`, and remove button inside `#chatInterface` |
| `css/styles.css` | Style the thumbnail preview area |

### Key Details
- **Compression**: Reuse `compressPhoto()` from `photos.js` — already loaded on the page. Keeps image tokens low and reduces API cost.
- **Mobile**: `<input type="file" accept="image/*" capture="environment">` gives a "Take Photo" option on phones.
- **No image persistence**: The attached image is only held in memory for the current question. It is NOT saved to Firestore.
- **Cost note**: Vision calls cost more tokens than text-only. A compressed ~150KB image adds roughly the same cost as a few hundred words of text — acceptable for occasional use.
- **Both providers supported**: OpenAI (`gpt-5.4-mini`) and Grok (`grok-3`) both accept the `image_url` array format.

### HTML Elements to Add (inside `#chatInterface`)
- `#chatAttachBtn` — attach photo button
- `#chatImageInput` — hidden `<input type="file">` triggered by the button
- `#chatImagePreview` — wrapper div (hidden until image selected)
  - `#chatImageThumb` — `<img>` showing the thumbnail
  - `#chatImageRemove` — ✕ button to clear

### Status
- [x] Complete ✅

---

## Status — ✅ COMPLETE

- `js/chat.js` — fully implemented (loadChatPage, sendChatMessage, chatCallOpenAICompat)
- `js/settings.js` — LLM settings section (loadLlmSettings, saveLlmSettings)
- Firestore storage via `userCol('settings').doc('llm')`
- Ctrl+Enter keyboard shortcut
- `#page-chat` section in index.html with all required element IDs
- LLM settings section in Settings page HTML
- `'chat'` in `TOP_LEVEL_PAGES` and route handler in `app.js`
- Nav link wired up in app.js routing
