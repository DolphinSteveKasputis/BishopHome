# PWPlan.md — Credentials Feature

## Overview

A new **Credentials** card on the Life screen for storing passwords and other sensitive info. No encryption — the app login is security enough.

Navigates to a Credentials page structured as:
- **Person filter** at the top (dropdown, defaults to "Me")
- **Categories as outer accordions** (in user-defined order, with a count badge and a "+" add button)
- **Individual credentials as inner accordions** inside each category (drag to reorder within category)
- An **"Uncategorized"** virtual category catches anything not assigned a category (always last, cannot be deleted)

---

## Life Page Card

Simple tile labeled **"Credentials"** — no counts or extras.

---

## Page Layout

```
[Credentials]                 [+ Add]  [Manage ▼]

Person: [Me ▼]

🔍 [Search name or URL...                    ]

▼ Financial (4)                              [+]
    ▼ Chase Online
        URL: https://chase.com
        Username: skasputi    [📋 Copy]
        Password: ••••••••    [👁]  [📋 Copy]
        Email: skasputi@gmail.com
        Last Updated: 3/15/2026
        Previous: ••••••••    [👁]
        Notes: —
        Secret Q&A: —
                              [Edit]  [Delete]
    ► Vanguard
    ► PayPal
    ► TurboTax

▼ Streaming (3)                              [+]
    ► Netflix
    ► Disney+
    ► YouTube TV

▼ Uncategorized (1)                          [+]
    ► Old WiFi Code
```

**[Manage ▼]** is a small dropdown with two options:
- **Manage Categories** → navigates to `#credentials/categories`
- **Manage People** → opens a modal (no dedicated page needed for this one)

---

## Individual Credential Fields

No fields are required.

| # | Field | Notes |
|---|---|---|
| 1 | **Name** | Shown as the inner accordion header |
| 2 | **URL** | Displayed as a clickable link (opens new tab) |
| 3 | **Username** | Shown with 📋 Copy button |
| 4 | **Credential Type** | Dropdown: Password, API Key, Client Secret, Social Security Number, Code |
| 5 | **Credential Value** | The actual secret — masked (••••••••) with 👁 Reveal and 📋 Copy buttons |
| 6 | **Last Updated** | Auto-populated when credential value changes — never manually entered |
| 7 | **Previous Credential** | Auto-filled from old value when credential value is saved as changed; also masked with 👁 |
| 8 | **Notes** | Free-form text |
| 9 | **Secret Q&A** | Free-form textarea — user types Q&A pairs however they like, no structure |
| 10 | **Email** | The email address this credential is tied to |
| 11 | **Person** | Which person this credential belongs to — defaults to current page filter person |
| 12 | **Category** | Picked from category list, or new category typed and created on the fly |

---

## People (Person Segmentation)

- A **Person** dropdown at the top of the Credentials page filters all accordions by person
- **"Me"** is always the default and first option — not linked to a contact record (sentinel: `personId: null`)
- Additional people are pulled from your **Contacts** list via the existing `buildContactPicker` component
- Enrolled contacts stored in `userCol('settings').doc('credentials')` → `{ enrolledPersonIds: [contactId, ...] }`
- Dropdown order: Me first, then alphabetically by name
- **Adding people**: via Manage → Manage People → modal with ContactPicker
- **Removing a person**: removes from enrolled list and deletes all their credentials (rare — no special recovery flow)
- When you add/edit a credential, the Person field defaults to whoever is currently selected in the page filter

---

## Categories

- Categories apply across **all people** — not person-specific
- Examples: Streaming, Sports, Financial, Social Media, Work, etc.
- Categories can be **added on the fly** from the Add/Edit credential page (type a new name → created and selected)
- Category **display order** is user-defined via the Category Management screen
- **Deleting a category**: moves all its credentials to Uncategorized (confirmation: "Move N credentials to Uncategorized?"), then deletes the category doc
- **Uncategorized** is a virtual category (`categoryId: null`). Always shown last. Cannot be deleted. Has a [+] button.
- Empty categories **are shown** — the [+] button is still useful on an empty category
- The credential count badge on each category header reflects only the **currently selected person**

---

## Category Management Screen (`#credentials/categories`)

- Drag-to-reorder list of all real categories (Uncategorized pinned at the bottom, not draggable, no delete button)
- **Rename** each category — click name to edit inline, save on blur or Enter
- **Delete** button per category — confirmation prompt: "Move N credentials to Uncategorized and delete this category?"
- **Add new category** — text input at the bottom of the list
- Order saved as `order` field on each `credentialCategories` doc
- Back button returns to `#credentials`

---

## Accordion Behavior

### Outer accordion (Category)
- Header: Category name + count badge (current person only) + **[+]** button (right side)
- Click header to expand/collapse; [+] does NOT toggle the accordion — it goes straight to add page
- Collapsed by default; state does not persist (resets on page load)
- Credentials within a category are **drag-to-reorder** (touch-friendly drag handles)

### Inner accordion (Individual Credential)
- Header: Credential name only (clean — type is visible when expanded)
- Click to expand/collapse
- When expanded, fields that are empty/unset are **hidden** (no blank rows)
- Visible fields when expanded:
  - URL (clickable link, opens new tab)
  - Email
  - Username + 📋 Copy
  - Credential Type label + masked value + 👁 + 📋 Copy
  - Last Updated date
  - Previous Credential (masked) + 👁
  - Secret Q&A
  - Notes
  - **[Edit]** and **[Delete]** buttons at the bottom

---

## Copy Button Behavior

- Clicking 📋 Copy copies the value to clipboard
- Button label changes to **"Copied!"** for 2 seconds, then reverts
- Clipboard auto-cleared after **60 seconds** (setTimeout overwrites with empty string)

---

## Add / Edit Credential (Dedicated Page)

### Routes
| Hash | Page |
|---|---|
| `#credentials/add` | Add new credential |
| `#credentials/add?cat={categoryId}` | Add new, pre-filled with a specific category |
| `#credentials/edit/{id}` | Edit existing credential |

### Navigation
- **[+ Add]** button at top of list → `#credentials/add` (person defaults to current filter)
- Category **[+]** button → `#credentials/add?cat={categoryId}` (category pre-filled, person defaults to current filter)
- **[Edit]** in expanded accordion → `#credentials/edit/{id}`
- Back button on add/edit page → returns to `#credentials`

### Page layout
- Full-page form with all fields
- **Name** (text input)
- **URL** (text input)
- **Email** (text input)
- **Username** (text input)
- **Credential Type** (dropdown: Password, API Key, Client Secret, Social Security Number, Code)
- **Credential Value** (text input — shown unmasked on both add and edit; no masking in the form)
- **Notes** (textarea)
- **Secret Q&A** (textarea — free-form, no structure)
- **Person** (dropdown: Me + enrolled contacts; defaults to current page filter person)
- **Category** (dropdown showing all categories in order + "Add new category…" option at the bottom)
- **[Save]** and **[Cancel]** buttons

### Auto-behaviors on save
- If Credential Value changed (or was set for the first time) → old value auto-moves to `previousCredential`; `updatedAt` set to today
- If Credential Value unchanged on edit → `updatedAt` not touched
- New credential `order` initialized to the count of existing credentials in that person+category (appends to end)

### Delete
- **[Delete]** button is on the **view accordion** (not the edit page) — requires confirmation before deleting
- Confirmation: "Delete [Name]? This cannot be undone."

---

## Search

- A search box sits between the Person filter and the category accordions
- Searches **name** and **URL** fields — case-insensitive, matches anywhere in the string
- Filters apply on top of the current person filter (searches only the selected person's credentials)
- While search is active:
  - Categories with no matching credentials are **hidden**
  - Categories with matches are shown expanded with only the matching credentials visible
  - The count badge updates to reflect match count (e.g., "Financial (2 of 4)")
- Clearing the search restores the full accordion view
- Search is client-side only — no Firestore queries triggered

---

## Empty States

| Scenario | Display |
|---|---|
| No credentials at all | "No credentials yet. Tap + Add to get started." |
| Selected person has no credentials | "No credentials for [Name] yet. Tap + Add to add one." |
| Category expanded, no credentials for current person | *(empty — just the [+] button is there)* |
| Search returns no matches | "No credentials match your search." (all categories hidden) |

---

## Firestore Collections

| Collection | Key Fields |
|---|---|
| `credentials` | `personId` (null = "Me"), `categoryId` (null = Uncategorized), `name`, `url`, `username`, `credentialType`, `credentialValue`, `previousCredential`, `email`, `notes`, `secretQA`, `order`, `updatedAt`, `createdAt` |
| `credentialCategories` | `name`, `order`, `createdAt` |

**Settings doc** (enrolled people): `userCol('settings').doc('credentials')` → `{ enrolledPersonIds: [contactId, ...] }`

---

## Routing

| Hash | Page |
|---|---|
| `#credentials` | Credentials list (person filter + category accordions) |
| `#credentials/add` | Add new credential |
| `#credentials/add?cat={categoryId}` | Add new, category pre-filled |
| `#credentials/edit/{id}` | Edit existing credential |
| `#credentials/categories` | Category management (reorder, rename, delete) |

---

## Backup

`credentials` and `credentialCategories` must be added to `BACKUP_DATA_COLLECTIONS` in `backup.js` in the same commit as the feature. (Per project requirement: new collections always added to backup.)

---

## Implementation

### Phase 1 — Core Feature
Files to create:
- `js/credentials.js` — full CRUD, accordion rendering, copy+mask logic, drag-to-reorder (credentials + categories), category and people management

Files to modify:
- `index.html` — add `#credentials-page`, `#credentials-add-page`, `#credentials-edit-page`, `#credentials-categories-page`; add Credentials card on Life page; script tag for credentials.js
- `css/styles.css` — outer/inner accordion styles, masked value display, copy button "Copied!" state, drag handle, credential form page layout
- `js/app.js` — add route handlers for all 5 credential routes
- `js/backup.js` — add `credentials` and `credentialCategories` to `BACKUP_DATA_COLLECTIONS`
- `sw.js` — bump `CACHE_NAME`
- `MyLife-Functional-Spec.md` — add Credentials section
- `AppHelp.md` — add `## screen:credentials` section

---

## Decisions Log

| # | Question | Answer |
|---|---|---|
| — | Encryption | None — app login is sufficient security |
| — | Life card | Simple tile "Credentials" — no counts |
| — | Credential masking | Masked by default, 👁 Reveal toggle (both current and previous credential) |
| — | Copy behavior | Shows "Copied!" for 2s; clipboard auto-cleared after 60s |
| — | Credential type in collapsed header | Not shown — only visible when expanded (clean look) |
| — | Removing enrolled person | Removes from enrolled list and deletes their credentials |
| — | Deleting a category | Moves all credentials to Uncategorized with confirmation, then deletes |
| — | Uncategorized | Virtual (null categoryId), always last, cannot be deleted |
| — | Empty categories | Shown (useful for the [+] button) |
| — | Category [+] button | Opens Add page with category pre-filled |
| — | Category order | User-defined via Category Management screen (drag to reorder) |
| — | Credential sort | Drag to reorder within each category |
| — | Add/Edit pattern | Dedicated pages — not modals |
| — | Search | Searches name + URL; client-side; hides non-matching categories; updates count badge |
| — | Credential value on edit page | Shown unmasked — no masking in the form |
| — | Delete button location | On the expanded accordion view, not on the edit page |
| — | Last Updated | Auto-populated on credential value change only |
| — | Previous Credential | Auto-filled from old value when credential value changes |
| — | Categories scope | Cross-person — same category list for everyone |
| — | People scope | Enrolled contacts via ContactPicker; "Me" is sentinel (personId: null) |
| — | Backup | credentials + credentialCategories added to BACKUP_DATA_COLLECTIONS |

---

## Status
- [x] All questions answered
- [ ] Plan approved
- [ ] Phase 1 implementation
