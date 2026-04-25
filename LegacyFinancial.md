# Legacy — Financial Accounts Plan

## Status: Planning

---

## What This Solves

When a loved one survives you, they face an overwhelming financial puzzle:
- Where is all the money? How do they access it?
- What debts exist? What needs to be paid immediately vs. can wait?
- What bills are on auto-pay? What will just stop if no one pays attention?
- Is there life insurance money coming? How do they file a claim?
- What should they actually *do* — sell investments? Keep the house? Call a financial advisor?

This section gives them a complete, organized picture — accounts, loans, bills, insurance, and a plain-English financial plan written by you.

---

## Multi-Person Architecture — DECIDED

Same pattern as Credentials (Life section): a **person switcher** at the top of the page.

- Default: yourself (no contact linked — just "Me")
- You can add other people (spouse, parent under POA, etc.) and track their full financial picture separately
- Each person's data lives in a sub-collection keyed by a person ID (`'self'` for you, or a `people` doc ID for others)
- **All persons share the same Legacy Passphrase** — simpler, and you control who has the passphrase anyway
- Encrypted fields use the same AES-GCM key derived from the single passphrase

**Firestore path pattern:**
```
userCol('legacyFinancial').doc(personId).collection('accounts')
userCol('legacyFinancial').doc(personId).collection('loans')
userCol('legacyFinancial').doc(personId).collection('bills')
userCol('legacyFinancial').doc(personId).collection('insurance')
userCol('legacyFinancial').doc(personId)  ← top-level doc: financialPlan field
```

Person IDs:
- `'self'` — always you (no contact lookup)
- A `people` doc ID — linked contact (spouse, parent, etc.); name shown from contact

---

## Sub-Sections

### 1. Accounts (Assets)

Everything you own that has a dollar value:
- Bank accounts (checking, savings) — per institution, per account
- Retirement accounts (Roth IRA, Roth 401k, Traditional 401k, Self-directed 401k)
- Brokerage accounts (individual, joint)
- HSA
- Any other investment or savings vehicle

**Per account fields:**
| Field | Encrypted? | Notes |
|-------|-----------|-------|
| Account nickname | No | e.g. "Chase Checking", "Fidelity Roth IRA" |
| Account type | No | dropdown (see types below) |
| Institution name | No | e.g. "Chase Bank", "Fidelity" |
| Account number | Yes | last 4 shown in plain text as hint |
| URL | No | login page |
| Username | Yes | |
| Password | Yes | |
| Login instructions | No | 2FA method, authenticator app, passcode, etc. |
| Joint/beneficiary | No | who else is on it, who inherits |
| What to do | No | instructions for loved one — close it, roll it over, leave it alone |
| Notes | No | anything else |
| sortOrder | No | drag to reorder |

**Account types (dropdown):**
Checking, Savings, Roth IRA, Traditional IRA, Roth 401k, Traditional 401k,
Self-directed 401k, 403b, Brokerage (individual), Brokerage (joint),
HSA, 529 College Savings, CD, Money Market, Other

---

### 2. Loans (Liabilities)

Everything you owe:
- Mortgage
- Car loans
- Credit cards (note: credit cards also show up in Bills since they're a payment method)
- Student loans
- Home equity line / HELOC
- Personal loans

**Per loan fields:**
| Field | Encrypted? | Notes |
|-------|-----------|-------|
| Nickname | No | e.g. "Chase Visa", "Toyota RAV4 Loan" |
| Loan type | No | dropdown |
| Lender / institution | No | |
| Account number | Yes | |
| Approximate balance | No | rough ballpark, not live — just context |
| URL | No | online account |
| Username | Yes | |
| Password | Yes | |
| Monthly payment | No | approx amount |
| Auto-pay? | No | yes/no |
| What to do | No | pay off, refinance, contact lender, etc. |
| Notes | No | |
| sortOrder | No | |

**Loan types:** Mortgage, Home Equity / HELOC, Car Loan, Credit Card,
Student Loan, Personal Loan, Business Loan, Other

---

### 3. Bills (Recurring Expenses)

Everything that needs to be paid regularly. The goal: loved one knows what's coming
and who to call to cancel/transfer/continue each one.

**Payment methods to track:** Bank auto-draft, Credit card auto-charge, Paper bill (mail),
Online manual pay, Payroll deduction

**Per bill fields:**
| Field | Encrypted? | Notes |
|-------|-----------|-------|
| Name | No | e.g. "Xcel Energy", "Netflix", "Home Depot credit card" |
| Category | No | dropdown (see below) |
| Payment method | No | dropdown |
| Which card/account | No | free text — "Chase Visa ending 4321" |
| Approx monthly amount | No | rough ballpark |
| Due day | No | day of month (1–31), optional |
| Phone | No | customer service |
| URL | No | account login or info page |
| Notes | No | account number hint, what to do (cancel, transfer, auto-renew) |
| sortOrder | No | |

**Bill categories:** Mortgage/Rent, Utilities, Insurance, Subscriptions,
Phone/Internet, Car/Transportation, Medical, Credit Cards, Other

---

### 4. Life Insurance

Separate enough from bank accounts to warrant its own sub-section within Financial.
(Not a separate Legacy landing tile — it belongs in the financial picture.)

**Per policy fields:**
| Field | Encrypted? | Notes |
|-------|-----------|-------|
| Insurer name | No | e.g. "Northwestern Mutual" |
| Policy type | No | Term, Whole, Universal, Group (through employer), Other |
| Policy number | Yes | |
| Coverage amount | No | death benefit |
| Beneficiary(ies) | No | who gets paid |
| Insurer phone | No | claims department |
| URL | No | login or claims page |
| Username | Yes | |
| Password | Yes | |
| Where is the paper policy | No | filing cabinet, safe, with agent |
| Agent name / phone | No | your insurance agent |
| Notes | No | how to file a claim, timing, etc. |
| sortOrder | No | |

---

### 5. Financial Plan (Narrative)

A free-form letter / set of instructions written directly to the loved one.
The "executive summary" — the human context behind all the accounts and numbers.

Could include:
- Overview of financial situation ("We're in good shape. Here's the big picture.")
- Priority order ("First: call the life insurance company. Second: don't sell the investments.")
- Who to call for help (financial advisor, accountant, attorney)
- Important context (e.g. "The Roth accounts grow tax-free — don't touch them for 10 years if you can")
- What to do with the house, cars, investments
- Timeline ("The mortgage auto-pays for 30 days — don't panic, you have time")

**Fields:** Single large textarea (rows=20), saves to the person's top-level doc as `financialPlan`.

---

## Page Layout

The page has two persistent controls at the top:
1. **Person switcher** — dropdown showing "Me" + any added contacts. "+ Add Person" option adds a contact from the people picker and creates their sub-collection entry.
2. **Tab bar** — Accounts | Loans | Bills | Insurance | Financial Plan

Each tab is an independent list with its own "+ Add" button and accordion-expand cards (same pattern as Documents — drag handle, expand on click, edit modal).

All tabs share the same person context. Switching person reloads all tabs.

---

## Encryption

Same AES-GCM / PBKDF2 setup as the rest of the gated sections (see `legacy-crypto.js`).
- Passphrase gate shown once on first visit; session stays unlocked until tab close
- Encrypted fields stored as `{ ciphertext, iv }` objects in Firestore
- Decrypted in memory only — never written back as plain text
- Fields marked "Yes" in tables above are encrypted; all others are plain text

Showing encrypted field in the UI: display `••••••` placeholder; "Reveal" button decrypts and shows for 30 seconds, then re-hides.

---

## Firestore Data Model

```
legacyFinancial/
  self/                        ← your own data
    financialPlan: "..."       ← top-level field on this doc
    accounts/                  ← subcollection
      {id}: { nickname, accountType, institution, accountNumberEnc,
               url, usernameEnc, passwordEnc, loginInstructions,
               beneficiary, whatToDo, notes, sortOrder, createdAt }
    loans/
      {id}: { nickname, loanType, lender, accountNumberEnc,
               approxBalance, url, usernameEnc, passwordEnc,
               monthlyPayment, autoPay, whatToDo, notes, sortOrder, createdAt }
    bills/
      {id}: { name, category, paymentMethod, whichAccount,
               approxAmount, phone, url, notes, sortOrder, createdAt }
    insurance/
      {id}: { insurer, policyType, policyNumberEnc, coverageAmount,
               beneficiary, phone, url, usernameEnc, passwordEnc,
               paperLocation, agentName, agentPhone, notes, sortOrder, createdAt }
  {contactPersonId}/           ← spouse, mom, etc. (same structure)
    financialPlan: "..."
    accounts/ ...
    loans/ ...
    bills/ ...
    insurance/ ...
```

---

## Decisions

**Life insurance** — DECIDED: Insurance tab inside Financial Accounts. Not a separate Legacy tile. A loved one opening Financial Accounts expects to find it there.

**Bills: due day** — DECIDED: Include due day of month (1–31) as an optional field on each bill.

**Encrypted field reveal** — DECIDED: Fields stay visible until the card is collapsed. No auto-hide timer.

**Passphrase gate** — DECIDED: Asked once per browser session. Session stays unlocked until tab is closed. This matches the existing `legacy-crypto.js` behavior — the derived key is held in memory in `_legacyCryptoKey` and is never persisted. First visit to any gated section triggers the gate; all subsequent visits in the same session go straight through.

## Deferred Questions (Decide Later)

- Should "which credit card/account" on Bills link to a Loan/Account entry, or stay as free text? *(Current plan: free text)*
- Should the Financial Plan textarea have a 🎙️ Speak (voice-to-text) button?
- Should we track approximate balances with a timestamp ("as of MM/YYYY") for rough context?

---

---

## Architecture — Investments as Canonical Account Storage — DECIDED

### The Problem
Legacy Financial and the future Investments feature both need the same account records (institution, type, credentials, etc.). Storing them twice means double maintenance and divergence.

### The Solution
**Investments owns the canonical account records. Legacy reads from them.**

- Canonical storage: `investments/{personId}/accounts/{accountId}`
- Legacy Financial reads those same docs and adds legacy-specific fields to the same doc
- Investments later adds stock allocations and snapshots as subcollections on those same account docs
- No duplication, no migration needed later

### Shared Account Fields (owned by Investments, editable from Investments editor)
`nickname`, `accountType`, `institution`, `last4`, `url`, `usernameEnc`, `passwordEnc`, `loginNotes`, `beneficiary`, `archived`, `sortOrder`, `createdAt`

### Legacy-Specific Overlay Fields (stored on same doc, editable only from Legacy)
`whatToDo`, `currentValue` (manual text, e.g. "~$45,000 as of Jan 2025"), `legacyNotes`

### Edit Flow
- **From Investments:** Edit button opens the shared account editor (all shared fields)
- **From Legacy Financial:** Edit button opens the same shared account editor. Legacy-specific fields (whatToDo, currentValue, legacyNotes) are editable inline within the Legacy expanded card — not in the shared editor

### Multi-Person
Each person's accounts live under their own personId:
- `investments/self/accounts/...` — your accounts
- `investments/{contactId}/accounts/...` — spouse, kids, etc.
- Combined view (mine + wife's) is a UI concern for later, not a storage concern

### Archive vs. Delete — DECIDED
Accounts are never hard-deleted. Set `archived: true` to close/remove from active view. Historical Investments snapshots can still reference the account ID. Legacy shows only `archived: false` accounts; archived accounts accessible via "Show Archived" toggle.

### Build Order
1. **Investments skeleton first** — Life → Investments card, person switcher, Accounts CRUD (add/edit/delete→archive). No stock tracking, no snapshots. This creates the canonical storage.
2. **Legacy Financial Accounts tab** — reads from `investments/{personId}/accounts`, displays with reveal UI for encrypted fields, adds legacy overlay fields inline.

---

## Tab 1: Accounts (Assets) — Design

### What It Is
Every financial asset: bank accounts, retirement accounts, brokerages, HSA, etc. The goal is that a loved one can locate every account, log in, and know what to do with it.

### Collapsed Card (List View)
Each row shows:
```
[⠿]  [Roth IRA]  Fidelity Roth IRA — Fidelity Investments    [▾]
```
- Drag handle (⠿) on the left
- Account type badge (e.g., "Roth IRA", "Checking")
- Nickname · em-dash · Institution name
- Expand chevron (▾) on the right

Last 4 digits of the account number shown in the header as plain text (e.g., `····4521`) — DECIDED: yes, stored as optional `last4` field. User types it in the modal if they want it; leave blank and nothing shows.

### Expanded Card (Details View)
All fields shown. Encrypted fields display `••••••` with a **Reveal** button next to them. Revealed fields stay visible until the card is collapsed.

```
Account Number    ••••••••••••  [Reveal]
URL               https://fidelity.com              (clickable link)
Username          ••••••••••    [Reveal]
Password          ••••••••••    [Reveal]
Login Notes       Use Google Authenticator on my phone. Code changes every 30s.
Joint / Beneficiary  Karen (joint owner)
What to do        Roll this into an inherited IRA. Do not cash out — huge tax hit.
                  Call Fidelity at 800-xxx-xxxx. Ask for the Inherited IRA desk.
Notes             Opened 2018. Contribution limit hit every year since.

                  [Edit]  [Delete]
```

### Shared Account Editor Fields (Investments editor — used from both Investments and Legacy)
| Field | Type | Encrypted | Required |
|-------|------|-----------|----------|
| Account Type | Dropdown | No | Yes |
| Nickname | Text | No | Yes |
| Institution | Text | No | No |
| Last 4 digits | Text (4 chars) | No | No |
| Account Number | Text | Yes | No |
| URL | Text | No | No |
| Username | Text | Yes | No |
| Password | Text | Yes | No |
| Login Notes | Textarea (3 rows) | No | No |
| Beneficiary | Text | No | No |

**Login Notes** is plain text (not a secret — describes *how* to log in, e.g. "2FA via Google Authenticator", "call to verify identity"). Sensitive values go in Username/Password.

**Beneficiary** lives on the shared doc so both Legacy and Investments have access to it from one place.

### Legacy-Only Fields (editable inline in Legacy expanded card — not in shared editor)
| Field | Type | Notes |
|-------|------|-------|
| Current Value | Text | Manual entry, e.g. "~$45,000 as of Jan 2025". Will be wired to live Investments calculation later. |
| What to do | Textarea (5 rows) | Instructions for loved one — roll over, close, leave alone, who to call |
| Legacy Notes | Textarea (3 rows) | Anything else relevant for the loved one |

### Account Type Dropdown Options
Checking, Savings, Roth IRA, Traditional IRA, Roth 401k, Traditional 401k,
Self-directed 401k, 403b, Brokerage (Individual), Brokerage (Joint),
HSA, 529 College Savings, CD, Money Market, Other

### Firestore
Collection: `investments/{personId}/accounts/{accountId}`

**Shared fields (Investments owns):**
`nickname`, `accountType`, `institution`, `last4`, `accountNumberEnc`, `url`, `usernameEnc`, `passwordEnc`, `loginNotes`, `beneficiary`, `archived`, `sortOrder`, `createdAt`

**Legacy overlay fields (on same doc, Legacy owns):**
`currentValue`, `whatToDo`, `legacyNotes`

Encrypted fields are stored as `{ ciphertext, iv }` objects.

### Encryption / Reveal UI
- Passphrase gate already unlocked by the time user reaches this tab (fired once on section entry)
- On card expand: encrypted fields decrypted in memory, displayed as `••••••`
- Reveal button toggles plain text visibility; re-masks when card collapses
- "Reveal All" button at the top of expanded card as a convenience

---

## Build Order (When Ready)

1. **Investments skeleton** — Life tile, person switcher, accounts CRUD with archive. Canonical storage established.
2. **Legacy Financial — Accounts tab** — reads from `investments/{personId}/accounts`, reveal UI, legacy overlay fields inline.
3. **Legacy Financial — Insurance tab**
4. **Legacy Financial — Loans tab**
5. **Legacy Financial — Bills tab**
6. **Legacy Financial — Financial Plan tab**

---

## Investments Skeleton — Design

### Overview
A new card under the Life landing page. For now: person switcher + account list only. Future tabs (Holdings, Snapshots, Performance) added later. The point of building this first is to establish `investments/{personId}/accounts` as the canonical account storage before Legacy reads from it.

### Life Landing Tile
- Icon: 📈
- Label: Investments
- Route: `#investments`
- Position: on the Life landing grid with other Life tiles

### File
`js/investments.js` — new file, loaded in index.html alongside other Life section scripts.

### Person Switcher
Identical pattern to Credentials:
- Enrolled person IDs stored in `userCol('settings').doc('investments')` as `enrolledPersonIds[]`
- Dropdown: **Me** (personId = `'self'`) + enrolled contacts by name
- "Manage ▾" button → dropdown menu → "Manage People" → modal to add/remove contacts from `people` collection
- On person change: reload account list for selected personId

### Page Layout
```
[← Life]  📈 Investments             [Manage ▾]
Person: [ Me ▾ ]

[+ Add Account]   [Show Archived]  (toggle, hidden by default)

─── Account Cards (drag ⠿ to reorder) ───
[⠿]  [Roth IRA]  Fidelity Roth IRA — Fidelity  ····4521  [▾]
[⠿]  [Checking]  Chase Checking — Chase Bank    ····8823  [▾]
```

### Collapsed Card
```
[⠿]  [Type Badge]  Nickname — Institution   ····last4   [▾]
```
- Institution omitted if blank; ····last4 shown only if last4 is set
- Archived cards get a "Closed" badge and muted styling

### Expanded Card
```
URL             https://fidelity.com              (clickable)
Login Notes     Use Google Authenticator on my phone. Code changes every 30s.
Beneficiary     Karen (joint owner)

  ┌─ Sensitive ─────────────────────────────────────┐
  │  Account Number  ••••••••••   [🔓 Reveal All]    │
  │  Username        ••••••                           │
  │  Password        ••••••                           │
  └─────────────────────────────────────────────────┘

[Edit]  [Archive]          (archived: [Edit]  [Restore])
```
- **Reveal All**: if `_legacyCryptoKey` set → unmask immediately. If not → passphrase prompt, then unmask. Stays unmasked until card collapses.
- Archived accounts show "Restore" instead of "Archive" (no Delete — soft delete only)

### Add / Edit Modal Fields

| Field | Notes |
|-------|-------|
| Account Type | Dropdown (required) |
| Nickname | Text (required) |
| Institution | Text |
| Last 4 digits | Text, max 4 chars |
| URL | Text |
| Login Notes | Textarea 3 rows |
| Beneficiary | Text |
| ── Sensitive fields ── | |
| Account Number | Text (decrypted if passphrase entered; masked if not) |
| Username | Text (decrypted if passphrase entered; masked if not) |
| Password | Text (decrypted if passphrase entered; masked if not) |

**Sensitive field behavior in modal:**
- `_legacyCryptoKey` already set → decrypt and show all three fields as normal editable text
- `_legacyCryptoKey` not set → show fields as •••••• with a single **🔓 Unlock to edit sensitive fields** button. Clicking it triggers the passphrase prompt. Once entered, fields decrypt and become editable.
- On save: encrypt any non-empty sensitive fields with the session key before writing to Firestore.

### Encryption
- AES-GCM via existing `legacy-crypto.js` — same `_legacyCryptoKey` shared with Legacy
- Entering passphrase in either Investments or Legacy unlocks both for the session
- Stored as `{ ciphertext, iv }` objects in Firestore

### Account Type Badge Colors
- **Bank** (Checking, Savings, Money Market, CD): blue
- **Retirement** (Roth IRA, Traditional IRA, Roth 401k, Traditional 401k, Self-directed 401k, 403b): green
- **Brokerage** (Individual, Joint): purple
- **Tax-advantaged** (HSA, 529): orange
- **Other**: gray

### Firestore
`investments/{personId}/accounts/{accountId}`

`personId` = `'self'` for logged-in user; contact doc ID for others.

Shared fields (Investments owns):
`nickname`, `accountType`, `institution`, `last4`, `url`, `loginNotes`, `beneficiary`, `accountNumberEnc`, `usernameEnc`, `passwordEnc`, `archived`, `sortOrder`, `createdAt`

Legacy overlay fields (added by Legacy Financial, same doc):
`currentValue`, `whatToDo`, `legacyNotes`
