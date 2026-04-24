# PrivatePlan.md — Private Vault Feature

## Overview
A "Private" card on the Life screen that holds encrypted personal data that the user never wants accessible to anyone — even someone who has their app login credentials. The encryption passphrase is known only to the user and dies with them.

---

## Firebase Storage & Test Credentials — Answered

**Q: Does enabling Firebase Storage work for both my account and the test account, or do I need separate setup?**

One-time setup covers everyone. Firebase Storage is enabled at the **project level** (`bishop-62d43`). Both your account and the test account are authenticated users of the same project. Storage security rules use `request.auth.uid` to scope access — your files live at `/users/your-uid/...` and test files live at `/users/test-uid/...`. Completely separate paths. No separate setup needed for testing.

---

## Core Concept

### Passphrase Protection
- A **separate passphrase** from legacy/financials — not shared in any letter or document
- On **first access (activation)**: user types passphrase twice to confirm → encrypt sentinel → store in Firestore
- On **subsequent access**: attempt to decrypt sentinel with entered passphrase → if it matches, grant access
- Sentinel: fixed string `"PRIVATE_VAULT_OK"` encrypted with AES-256-GCM, stored at `userCol('privateVault').doc('auth')`
- If decryption fails → "Incorrect passphrase" — no hints, no recovery, no reset

### Changing the Passphrase
- User **cannot simply overwrite** the passphrase — old encrypted data becomes permanently unreadable
- **"Convert to New Passcode"** (future enhancement): re-encrypts every document, photo, and bookmark with new passphrase — punted to FutureEnhancements.md

### Encryption Technology — Implementation Details
- **Web Crypto API** (built into all modern browsers — no library needed)
- **AES-256-GCM** symmetric encryption
- **PBKDF2** key derivation: passphrase + salt → 256-bit CryptoKey
- **Salt**: random 16-byte value generated at activation. Stored **plaintext** in Firestore `privateVault/auth.salt`. This is correct and intentional — salt is not secret, it prevents rainbow table attacks. Only the ciphertext is secret.
- **IV (Initialization Vector)**: a fresh random 12-byte IV is generated for every single encryption operation. The IV is **prepended to the ciphertext** before Base64 encoding: `Base64(IV + ciphertext)`. On decryption: split first 12 bytes as IV, remainder as ciphertext.
- **In-memory key**: after passphrase entry, the raw passphrase string is discarded. Only the derived `CryptoKey` object is held in memory. A CryptoKey cannot be reversed to recover the passphrase.
- **Bookmark encryption**: rather than encrypting each field separately (name, url, notes = 3 IVs per node), the sensitive fields are combined into a single JSON object and encrypted once: `encrypt(JSON.stringify({name, url, notes}))`. One IV per node. Simpler and faster.
- All encryption/decryption happens **client-side only** — Firestore and Firebase Storage store only ciphertext

### Session Behavior
- **Private card is hidden entirely** until the vault has been activated
- Once activated, the Private card is visible on the Life screen
- **Entering the Private card always prompts for the passphrase** — no bypass
- After correct passphrase entry, vault stays unlocked; derived CryptoKey held in memory
- **Auto-lock after 60 minutes of inactivity** — any mouse click or keypress anywhere in the app resets the timer
- When timer expires: CryptoKey cleared from memory → if user is on any `#private/*` page, redirect to `#private` (passphrase gate) immediately
- If an upload is in progress when the timer fires: complete the upload, then lock
- Navigating away and back within the 60-min window does **not** re-prompt
- Page reload always requires re-entry regardless of timer

---

## Settings Page — "Setup Private Storage" Card

### Placement
- New card on Settings: **"Setup Private Storage"**
- Always visible on Settings (even before activation)
- Shows **green "Active" badge** once successfully activated
- No deactivation option

### Help Walkthrough Button
- Opens a step-by-step modal with two sections:

**Step 1 — Enable Firebase Storage:**
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Select project **bishop-62d43**
3. Click **"Storage"** in the left nav
4. Click **"Get Started"**
5. Choose region **us-central1** (recommended — same as Firestore)
6. Click **Done**

**Step 2 — Secure Storage Rules (required):**
1. In the Storage section, click the **"Rules"** tab
2. Replace the default rules with:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
3. Click **"Publish"**

*(The default rules allow any logged-in user to read any other user's files. The rules above restrict each user to their own folder only.)*

### "Activate Private Data" Button
- Shown only if not yet activated
- Flow:
  1. Prompt for passphrase + confirm passphrase (must match — no recovery if wrong)
  2. Derive CryptoKey from passphrase using PBKDF2
  3. Test Firebase Storage: encrypt a tiny test string → upload to `/users/{uid}/test/activation-check` → download it back → decrypt → verify it matches original string → delete test file
  4. If Storage test fails → error: *"Firebase Storage not ready — complete Setup steps first, including the Rules update"*
  5. If Storage passes: encrypt sentinel `"PRIVATE_VAULT_OK"` → store `{salt, encryptedSentinel}` in Firestore `privateVault/auth`
  6. On success: green "Active" badge appears; **Private card becomes visible on Life screen**

---

## Life Screen Placement
- **Private card hidden until activation is complete** — checked by whether `privateVault/auth` exists in Firestore (cached on app load, not re-fetched on every nav)
- Clicking it always prompts for passphrase
- Once unlocked, shows vault home with 3 sub-cards: Bookmarks, Documents, Photos

---

## Three Sub-Features

### 1. Private Bookmarks
- URL bookmarks invisible to Chrome or any browser sync
- **Tree view** with a single root node labeled **"Bookmarks"** (hardcoded, not encrypted)
- Up to **5 levels deep** below root (hardcoded max)
- Each node: **folder** or **bookmark** (url + display name + optional notes)
- Clicking a bookmark opens URL in a new tab
- **Encryption per node**: sensitive fields (name, url, notes) combined as JSON, encrypted once → single `encryptedData` field per Firestore doc
- **Drag-to-reorder with cross-folder drag** — like Chrome's "Manage Bookmarks"
  - Drag onto folder → moves inside it
  - Drag between siblings → reorders within same parent
  - Visual: line indicator between items, folder highlight on hover
  - Depth check on drop: block if drop would exceed 5 levels
- **Folder deletion**: confirm → delete folder and all contents recursively (depth-first)
- CRUD: add folder, add bookmark, edit, delete
- Stored: `userCol('privateBookmarks')` — one doc per node
  - Fields: `{parentId, type ('folder'|'bookmark'), encryptedData, order, depth}`
  - `encryptedData` decrypts to `{name, url, notes}`

### 2. Private Documents
- Personal stories and writings (book manuscript ~6MB) — moving out of Google Docs
- Format: **.docx files** — preserves all formatting
- **Original filename stored at upload time** (encrypted); used for download and backup export

#### Storage Architecture
- **Firestore** `userCol('privateDocuments')`: `{encryptedTitle, encryptedOriginalFileName, storageRef, createdAt, updatedAt, fileSizeBytes}`
- **Firebase Storage** `/users/{uid}/privateDocuments/{docId}`: encrypted binary blob
- `storageRef` and `fileSizeBytes` stored unencrypted (reveal nothing about content)

#### Workflows
- **Upload:**
  1. Click "Add Document" → enter title → pick .docx file
  2. Show progress indicator (spinner + "Encrypting…" then "Uploading…")
  3. Encrypt file client-side → upload encrypted blob to Firebase Storage
  4. On Storage success: save metadata to Firestore
  5. If Storage upload fails: show error, do NOT save Firestore record
- **Edit:**
  1. Click "Edit" → download encrypted blob from Storage → decrypt in-browser
  2. Trigger browser download of .docx with original filename → Word opens it automatically
  3. User edits and saves in Word
  4. Click "Re-upload" next to document → pick saved .docx → re-encrypt → overwrite Storage → update `updatedAt` in Firestore
- **Open (read-only):** same as Edit, labeled "Open"
- **Delete:** confirm → delete Firestore record AND Storage file (both)

#### Document List Display
- Title (decrypted on page load once vault is unlocked)
- Last updated date

### 3. Private Photos
- Personal/private photos — encrypted so raw data reveals nothing
- **Upload from device only** (no camera capture)
- **Original filename stored at upload time** (encrypted; fallback name in backup export)
- **Album organization** — 1 level of albums (not nested)
- **"Uncategorized"** is a **virtual album** — photos with `albumId: null`. It appears as the first album in the list if any unassigned photos exist. It cannot be renamed or deleted (it's not a real Firestore doc). Route: `#private/photos/album/uncategorized`
- Navigation: Albums list → click album → photo gallery
- Compression target ~100–200KB **before** encryption
- Gallery: newest-first, Newer/Older navigation within album
- **Full-size photo viewer**: clicking a photo opens a full-size modal (same pattern as existing photos.js viewer)
- **Album deletion**: confirm → delete album and all its photos (Firestore records + Storage files)
- CRUD: add album, rename album, delete album (+all contents), add photo, edit caption, move photo to different album, delete photo

#### Storage Architecture
- **Firestore** `userCol('privatePhotoAlbums')`: `{encryptedName, order, createdAt}`
- **Firestore** `userCol('privatePhotos')`: `{albumId, encryptedCaption, encryptedOriginalFileName, storageRef, createdAt}`
- **Firebase Storage** `/users/{uid}/privatePhotos/{photoId}`: encrypted image blob
- `albumId` and `storageRef` stored unencrypted (no content revealed)
- Delete always cleans up both Firestore record and Storage file

---

## Backup — Private Data Export

### Trigger
- On the **Backup page**, if Private is activated → **"Backup Private Data"** button appears (separate from main backup button)
- Requires passphrase entry before export begins

### Export Process
1. Prompt for passphrase → derive CryptoKey
2. Show progress: "Decrypting bookmarks… Downloading documents… Downloading photos…"
3. Decrypt all private data in-browser:
   - All bookmark nodes → reconstruct full tree
   - All document blobs → download from Storage, decrypt each
   - All photo blobs → download from Storage, decrypt each
4. Build zip file containing:
   - `bookmarks.html` — Chrome-compatible Netscape Bookmark File format (importable into Chrome/Firefox)
   - `bookmarks.json` — full tree as JSON (human-readable)
   - `documents/` — decrypted .docx files named by **original filename**
   - `photos/{album-name}/` — photos organized by album subfolder, named by **caption** (sanitized for filesystem); if caption is empty → **original upload filename**; if both missing → `photo-{YYYY-MM-DD}-{n}.jpg`
   - `metadata.json` — export date, document count, photo count, album list
5. **AES-256 password-protect the zip** with the private passphrase
6. Browser downloads as **`private-backup-{YYYY-MM-DD}.zip`**

### Zip Library
- **`@zip.js/zip.js`** via CDN — supports AES-256 zip encryption (WinZip-compatible)
- Openable by **7-Zip**, **WinZip**, or any AES-256 zip tool using the passphrase
- Real AES-256 — not weak legacy ZipCrypto

### Notes
- Entirely local — no data sent anywhere new; just downloading from Firebase and packaging client-side
- File is useless without the passphrase (intentional)
- Date-stamped filename → each backup is distinct, old ones not overwritten

---

## Implementation Phases

---

### PHASE 1 — Settings Card, Firebase Storage Setup & Vault Activation

**Goal**: User can open Settings, follow the Firebase Storage setup walkthrough, then activate the Private vault with a passphrase. On success, a green "Active" badge appears on the Settings card, and the Private card becomes visible on the Life screen. No vault content yet — just the gate.

**Files to create:**
- `js/private.js` — stub file establishing the module; implement encryption utilities and activation logic only

**Files to modify:**
- `index.html` — add "Setup Private Storage" settings card, add activation modal (passphrase × 2 + confirm), add help walkthrough modal, add Firebase Storage SDK CDN tag, add `js/private.js` script tag, add `#private-page` shell (passphrase gate only — not navigable yet)
- `js/firebase-config.js` — initialize `firebase.storage()` alongside existing Firestore init; export `storage` reference
- `js/app.js` — on app load, check if `userCol('privateVault').doc('auth')` exists → set `window.privateActivated = true/false`; show/hide Private card on Life screen accordingly
- `css/styles.css` — styles for the new Settings card, green Active badge, activation modal
- `sw.js` — bump `CACHE_NAME`
- `MyLife-Functional-Spec.md` — add Private Vault section (Settings card, activation flow)
- `AppHelp.md` — add/update `## screen:settings` for the new Setup Private Storage card

**`js/private.js` must implement (Phase 1 scope only):**
```
// Encryption utilities
- privateGenerateSalt()                    // 16-byte random Uint8Array
- privateDeriveKey(passphrase, salt)       // PBKDF2 → CryptoKey (AES-256-GCM)
- privateEncrypt(cryptoKey, plaintext)     // → Base64(IV + ciphertext)
- privateDecrypt(cryptoKey, base64)        // splits IV, decrypts → plaintext string

// Activation
- privateCheckActivated()                  // checks privateVault/auth exists in Firestore
- privateActivate(passphrase)              // full activation flow:
    1. generate salt
    2. derive CryptoKey
    3. Firebase Storage connectivity test (upload/download/decrypt/delete tiny blob)
    4. encrypt sentinel
    5. save {salt, encryptedSentinel} to privateVault/auth
    6. set window.privateActivated = true

// Session state (stub — wired up in Phase 2)
- window.privateCryptoKey = null           // holds derived CryptoKey when unlocked
- window.privateActivated = false          // set on app load
```

**Activation modal fields:**
- Passphrase (password input, no show/hide needed)
- Confirm passphrase (password input)
- [Activate] button
- Error message area (wrong match, Storage not ready, etc.)

**Help modal content:** Both Firebase Storage enable steps AND the Security Rules update steps (exact rules text included, copyable).

**Validation:**
- Passphrases must match before attempting activation
- Passphrase must be more than 3 characters (no other length requirement)

**Cache / versions:**
- Bump `?v=N` on ALL `<script>` and `<link>` tags in index.html
- Bump `CACHE_NAME` in `sw.js`

**Acceptance criteria:**
- Settings page shows "Setup Private Storage" card with Help button and Activate button
- Help modal shows both Firebase enable steps and security rules steps
- Activate prompts for passphrase × 2, validates match
- Storage connectivity test runs; clear error if Storage not ready
- On success: green Active badge on Settings card
- Life screen Private card appears only after activation
- Life screen Private card hidden before activation
- Reload preserves activated state (reads from Firestore)

---

### PHASE 2 — Vault Home & Passphrase Gate

**Goal**: The Private card on Life navigates to a passphrase gate. Correct entry unlocks the vault and shows the vault home page (3 sub-cards: Bookmarks, Documents, Photos). Auto-lock after 60 min of inactivity anywhere in the app.

**Files to modify:**
- `index.html` — add `#private-page` (passphrase gate form + vault home with 3 cards, shown/hidden based on lock state)
- `js/private.js` — implement gate, unlock, auto-lock timer
- `js/app.js` — add `#private` route handler; block if not activated
- `css/styles.css` — vault home card styles, gate form styles
- `sw.js` — bump `CACHE_NAME`
- `MyLife-Functional-Spec.md` — update Private section with gate + vault home
- `AppHelp.md` — add `## screen:private` section

**`js/private.js` additions (Phase 2 scope):**
```
// Gate
- privateShowGate()                        // render passphrase input on #private-page
- privateUnlock(passphrase)                // derive CryptoKey, verify sentinel, store in window.privateCryptoKey
- privateLock()                            // clear window.privateCryptoKey, redirect to #private gate

// Auto-lock timer
- privateResetTimer()                      // resets 60-min inactivity countdown
- privateStartTimer()                      // starts timer; on expiry calls privateLock()
- document.addEventListener('click', ...)  // anywhere in app resets timer if vault is unlocked
- document.addEventListener('keypress', ...)

// Upload-in-progress guard
- window.privateUploadInProgress = false   // set true during uploads; lock deferred until false
```

**Gate behavior:**
- If vault already unlocked (`window.privateCryptoKey !== null`) → skip gate, show vault home directly
- If locked → show passphrase input form; on submit call `privateUnlock()`; on success show vault home, start timer
- Wrong passphrase → "Incorrect passphrase" inline error, input cleared

**Vault home page:**
- Three cards: Bookmarks, Documents, Photos
- Each card shows icon, label, and brief description
- Clicking navigates to respective `#private/bookmarks`, `#private/documents`, `#private/photos`

**Acceptance criteria:**
- Entering Private card when locked shows passphrase prompt
- Wrong passphrase shows error
- Correct passphrase shows vault home with 3 cards
- Navigating away and back within 60 min skips gate
- After 60 min idle, navigating to any `#private/*` page shows gate again
- Page reload always shows gate

---

### PHASE 3 — Private Bookmarks

**Goal**: Full bookmark tree manager inside the vault. Add folders and bookmarks, drag to reorder and move across folders, edit, delete (recursive for folders). All data encrypted.

**Files to modify:**
- `index.html` — add `#private-bookmarks-page`, add/edit bookmark modal, add folder modal
- `js/private.js` — bookmark tree logic
- `css/styles.css` — tree styles, drag-and-drop visual indicators (drop line, folder highlight)
- `sw.js` — bump `CACHE_NAME`
- `MyLife-Functional-Spec.md` — add Bookmarks sub-section
- `AppHelp.md` — add bookmarks to `## screen:private`

**`js/private.js` additions (Phase 3 scope):**
```
// Data
- privateLoadBookmarks()        // fetch all docs from privateBookmarks, build in-memory tree
- privateEncryptNode(data)      // encrypt {name, url, notes} as single JSON blob
- privateDecryptNode(doc)       // decrypt encryptedData → {name, url, notes}
- privateSaveBookmark(node)     // add/update Firestore doc
- privateDeleteBookmark(id)     // recursive delete: find all descendants, batch delete

// Tree rendering
- privateRenderTree(parentId, depth)  // recursive render; root parentId = null
- Each node rendered as <div class="bm-node"> with drag handle, icon, label, action buttons

// Drag and drop (HTML5 DnD API)
- dragstart, dragover, dragend, drop handlers
- Drop targets: between items (show line) and on folders (show highlight)
- On drop: update parentId and order fields in Firestore; re-render
- Depth guard: calculate resulting depth before allowing drop; block if > 5

// CRUD modals
- privateOpenAddFolderModal(parentId)
- privateOpenAddBookmarkModal(parentId)
- privateOpenEditModal(nodeId)
- privateDeleteNode(nodeId)     // confirm → recursive delete
```

**Firestore structure per node:**
- `{parentId, type, encryptedData, order, depth, createdAt}`
- Root node: `parentId: null, type: 'root'` — one doc, name "Bookmarks" not encrypted

**Acceptance criteria:**
- Tree renders correctly with nested folders
- Add folder and add bookmark work at any depth ≤ 5
- Edit renames/updates node
- Delete folder recursively removes all descendants after confirmation
- Delete bookmark removes single node
- Drag within same folder reorders correctly
- Drag to different folder moves node; tree updates
- Drag that would exceed depth 5 is blocked with a visual cue
- All data is encrypted in Firestore (verify in Firebase console — only Base64 blobs visible)

---

### PHASE 4 — Private Documents

**Goal**: Upload .docx files (encrypted to Firebase Storage), list with title and last-updated date, download-to-edit workflow, re-upload, delete.

**Files to modify:**
- `index.html` — add `#private-documents-page`, add document modal, re-upload modal
- `js/private.js` — document logic
- `css/styles.css` — document list styles, upload progress indicator
- `sw.js` — bump `CACHE_NAME`
- `MyLife-Functional-Spec.md` — add Documents sub-section
- `AppHelp.md` — add documents to `## screen:private`

**`js/private.js` additions (Phase 4 scope):**
```
// Upload
- privateUploadDocument(title, file)
    1. set window.privateUploadInProgress = true
    2. read file as ArrayBuffer
    3. encrypt ArrayBuffer → encrypted Uint8Array
    4. upload to Firebase Storage at /users/{uid}/privateDocuments/{newId}
    5. on success: save Firestore metadata {encryptedTitle, encryptedOriginalFileName, storageRef, fileSizeBytes, createdAt, updatedAt}
    6. on failure: show error, do NOT write Firestore
    7. set window.privateUploadInProgress = false

// Download / Edit
- privateDownloadDocument(docId)
    1. fetch encrypted blob from Firebase Storage
    2. decrypt → ArrayBuffer
    3. trigger browser download as Blob with original filename
    4. Word opens automatically via OS file association

// Re-upload
- privateReuploadDocument(docId, file)
    // same as upload but overwrites existing Storage file and updates Firestore updatedAt

// Delete
- privateDeleteDocument(docId)
    1. confirm dialog
    2. delete Firebase Storage file
    3. delete Firestore record

// List
- privateLoadDocuments()        // fetch all, decrypt titles, sort by updatedAt desc
```

**UI details:**
- Progress indicator during upload: spinner + status text ("Encrypting…" → "Uploading…" → "Done")
- File size shown in list (e.g., "4.2 MB") — unencrypted metadata
- Buttons per row: Open, Edit, Re-upload, Delete

**Acceptance criteria:**
- Upload encrypts file client-side before any network call
- Progress indicator shows during encrypt + upload
- File list shows decrypted title and last-updated date
- Open/Edit downloads the decrypted .docx; Word opens it
- Re-upload overwrites storage + updates timestamp
- Delete removes both Storage file and Firestore record
- Firestore console shows only encrypted Base64 blobs — no readable content
- Firebase Storage console shows only encrypted blobs — no readable content

---

### PHASE 5 — Private Photos

**Goal**: Upload photos to albums (encrypted to Firebase Storage). View in gallery per album. Full-size modal viewer. Edit caption, move between albums, delete.

**Files to modify:**
- `index.html` — add `#private-photos-page` (album list + gallery view), add album modal, add photo modal, add photo viewer modal
- `js/private.js` — photo logic
- `css/styles.css` — album grid, photo gallery styles
- `sw.js` — bump `CACHE_NAME`
- `MyLife-Functional-Spec.md` — add Photos sub-section
- `AppHelp.md` — add photos to `## screen:private`

**`js/private.js` additions (Phase 5 scope):**
```
// Albums
- privateLoadAlbums()                  // fetch privatePhotoAlbums, decrypt names, sort by order
- privateCreateAlbum(name)
- privateRenameAlbum(albumId, name)
- privateDeleteAlbum(albumId)          // confirm → delete all photos in album (Storage + Firestore) → delete album doc

// Photos
- privateUploadPhoto(albumId, file)    // compress → encrypt → Storage → Firestore
- privateLoadPhotos(albumId)           // null albumId = Uncategorized (albumId: null)
- privateOpenPhoto(photoId)            // download from Storage, decrypt, display in full-size modal viewer
- privateEditCaption(photoId, caption)
- privateMovePhoto(photoId, newAlbumId)
- privateDeletePhoto(photoId)          // confirm → Storage delete + Firestore delete

// Gallery navigation
- privatePrevPhoto() / privateNextPhoto()   // Newer/Older within current album's photo list
```

**"Uncategorized" album:**
- Not a real Firestore doc — virtual
- Shows in album list if any photos have `albumId: null`
- Label: "Uncategorized"
- Cannot be renamed or deleted (no delete button shown)
- Route: `#private/photos/album/uncategorized`

**Photo viewer modal:**
- Full-size decrypted image displayed
- Caption (editable inline)
- Newer / Older navigation buttons
- Delete button (confirm)
- Close button

**Acceptance criteria:**
- Album list shows all albums + Uncategorized (if applicable)
- Add/rename/delete albums work correctly
- Delete album with photos: confirm → deletes all photos from Storage + Firestore + album doc
- Upload compresses photo, encrypts, stores in Storage
- Gallery shows thumbnails (decrypted on load for current album only)
- Full-size viewer works with Newer/Older navigation
- Move photo to different album works
- Caption edit saves correctly
- Firestore and Storage contain no readable photo data

---

### PHASE 6 — Private Backup

**Goal**: "Backup Private Data" button on the Backup page. Decrypts all private data in-browser, builds an AES-256 password-protected zip, downloads it locally. Openable with 7-Zip or WinZip using the passphrase.

**Files to modify:**
- `index.html` — add `@zip.js/zip.js` CDN tag; add "Backup Private Data" button to backup page (conditionally shown); add passphrase prompt modal for backup
- `js/private.js` — backup logic
- `js/backup.js` (or wherever backup logic lives) — hook for showing "Backup Private Data" button if activated
- `css/styles.css` — backup button styling, progress indicator
- `sw.js` — bump `CACHE_NAME`
- `MyLife-Functional-Spec.md` — add Private Backup sub-section
- `AppHelp.md` — update `## screen:backup` with Private Data button

**`js/private.js` additions (Phase 6 scope):**
```
- privateExportBackup(passphrase)
    1. derive CryptoKey from passphrase
    2. verify sentinel (confirm correct passphrase before doing all that work)
    3. show progress: "Decrypting bookmarks… Downloading documents (N)… Downloading photos (N)…"
    4. decrypt all bookmark nodes → build tree
    5. generate bookmarks.html (Netscape Bookmark File format)
    6. generate bookmarks.json (full tree as JSON)
    7. download + decrypt each document from Storage → {originalFilename, ArrayBuffer}
    8. download + decrypt each photo from Storage → {album, captionOrFilename, ArrayBuffer}
    9. build zip using zip.js with AES-256 password = passphrase:
         bookmarks.html
         bookmarks.json
         documents/{originalFilename}.docx
         photos/{albumName}/{photoFilename}.jpg
         metadata.json
    10. trigger download as private-backup-{YYYY-MM-DD}.zip

- privateSanitizeFilename(str)     // strip/replace chars invalid in filenames
```

**Photo filename logic in zip:**
- Use caption (sanitized) if non-empty
- Else use original upload filename (sanitized)
- Else use `photo-{YYYY-MM-DD}-{n}.jpg`
- If duplicates within album after sanitizing: append `-2`, `-3`, etc.

**Firestore backup:**
- Add `privateVault`, `privateBookmarks`, `privateDocuments`, `privatePhotoAlbums`, `privatePhotos` to the existing Firestore backup collection list
- These export as ciphertext — useless without passphrase, but useful for disaster recovery of the Firestore structure

**Acceptance criteria:**
- "Backup Private Data" button only visible on Backup page when vault is activated
- Button prompts for passphrase before starting
- Wrong passphrase: clear error, no export
- Progress indicator updates through stages
- Downloaded zip is AES-256 encrypted
- Zip opens in 7-Zip with correct passphrase
- Zip contents: both bookmark files, all documents with correct filenames, photos organized by album
- metadata.json present with accurate counts and export date
- Firestore backup (main backup) now includes all private collections as ciphertext

---

## Firestore Collections (Final)

| Collection | Key Fields |
|---|---|
| `privateVault` | `{salt (plaintext), encryptedSentinel}` — single doc `auth` |
| `privateBookmarks` | `{parentId, type, encryptedData, order, depth, createdAt}` |
| `privateDocuments` | `{encryptedTitle, encryptedOriginalFileName, storageRef, createdAt, updatedAt, fileSizeBytes}` |
| `privatePhotoAlbums` | `{encryptedName, order, createdAt}` |
| `privatePhotos` | `{albumId, encryptedCaption, encryptedOriginalFileName, storageRef, createdAt}` |

## Firebase Storage Paths (Final)

| Path | Contents |
|---|---|
| `/users/{uid}/test/activation-check` | Temporary test blob (deleted after activation test) |
| `/users/{uid}/privateDocuments/{docId}` | Encrypted .docx blob |
| `/users/{uid}/privatePhotos/{photoId}` | Encrypted image blob |

## Routing (Final)

| Hash | Page |
|---|---|
| `#private` | Passphrase gate → vault home |
| `#private/bookmarks` | Bookmark tree |
| `#private/documents` | Document list |
| `#private/photos` | Album list |
| `#private/photos/album/{albumId}` | Photo gallery |
| `#private/photos/album/uncategorized` | Uncategorized photos (virtual album) |

---

## Open Question Before Phase 1 Starts

**Q25 — Passphrase minimum length?**
Should the activation form enforce a minimum length (e.g., 8 or 12 characters), or is any non-empty passphrase accepted? Given there's no recovery, a longer passphrase is safer but it's your call.

---

## Future Enhancements (punted)
- **Convert to New Passcode**: re-encrypt all private data under a new passphrase
- **Firebase Storage in main backup**: include Storage blobs in standard backup export

---

## Decisions Log
| # | Decision | Answer |
|---|---|---|
| Q1 | Document storage format | Upload .docx, encrypt client-side, store in Firebase Storage |
| Q2 | Passphrase recovery | No recovery — gone forever if forgotten |
| Q3 | Session duration | Unlocked for session, auto-lock after 60 min inactivity |
| Q4 | Bookmark reorder | Drag-to-reorder, cross-folder (like Chrome Manage Bookmarks) |
| Q5 | Photo capture method | Upload from device only |
| Q6 | Doc file size | 6MB largest — Firebase Storage handles it |
| Q7 | Bookmark drag scope | Cross-folder drag, like Chrome |
| Q8 | Inactivity definition | Any click/keypress anywhere in app resets timer |
| Q9 | Unencrypted metadata | createdAt, fileSizeBytes, storageRef, albumId OK unencrypted |
| Q10 | Photo organization | Album organization (1 level) |
| Q11 | Firebase Storage | Yes — free on Spark plan; encrypt before upload |
| Q12 | Delete album with photos | Confirm → delete album and all photos |
| Q13 | Document list fields | Title + last updated date |
| Q14 | Bookmark root level | Single root node labeled "Bookmarks" |
| Q15 | Change passphrase | No simple overwrite; Convert feature punted to future |
| Q16 | Deactivate vault | No deactivation; individual delete per item |
| Q17 | Bookmark folder delete | Confirm → delete recursively |
| Q18 | Convert passcode in v1 | No — future enhancement |
| Q19 | Private backup | Separate button; AES-256 password-protected zip download |
| Q20 | Bookmark export format | Both HTML (Chrome-compatible) AND JSON in the zip |
| Q21 | Photo filenames in backup | Caption → original filename → date+sequence |
| Q22 | Document filenames in backup | Original .docx filename (stored at upload time) |
| Q23 | Backup zip filename | `private-backup-{YYYY-MM-DD}.zip` |
| Q24 | Private card visibility | Hidden until activated; always prompts passphrase on entry |
| Firebase/Test | Storage test credentials | One setup covers all users; paths scoped by uid |
| Gaps fixed | IV strategy | Prepend 12-byte IV to ciphertext before Base64 |
| Gaps fixed | In-memory key | Store CryptoKey, not raw passphrase |
| Gaps fixed | Bookmark encryption | Single JSON blob per node, one IV |
| Gaps fixed | Uncategorized album | Virtual (albumId: null), not a Firestore doc |
| Gaps fixed | Upload progress | Spinner with status text during encrypt + upload |
| Gaps fixed | Auto-lock redirect | Redirect to #private gate when timer fires on private page |
| Gaps fixed | Storage rules | Included in Help walkthrough; scoped to /users/{uid}/... |
| Q25 | Passphrase min length | Must be > 3 characters; no other enforcement — user's responsibility |

---

## Status
- [x] All design questions answered (Q1–Q25)
- [x] Gaps reviewed and resolved
- [x] Firebase Storage question answered
- [x] Implementation phases written (Phase 1–6)
- [x] Plan approved
- [ ] Phase 1 in progress
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6
