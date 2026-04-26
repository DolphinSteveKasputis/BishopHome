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
- Mortgage, car loans, credit cards, student loans, HELOC, personal loans, furniture loans, etc.

**Collapsed card (list view) — show only filled-in fields, skip blanks:**
```
[⠿]  [Car Loan]  Nissan Rogue — Nissan Motor Acceptance   $389/mo  [Auto Pay]  [▾]
```
- Drag handle · Type badge · Nickname · em-dash · Lender · monthly payment (if set) · payment method badge (if set) · expand chevron
- Payoff date shown if set: `Payoff: Jun 2028`
- Whose name shown if set: `(Karen)`
- Payment method badge: "Auto Pay" (for either auto-pay type) or "Pay Manually" (for ebill/paper) — small muted badge
- Archived loans: muted styling + "Archived" badge; hidden by default, shown via "Show Archived" checkbox toggle

**Expanded card — all fields:**

| Field | Encrypted? | Notes |
|-------|-----------|-------|
| Nickname | No | e.g. "Nissan Rogue", "Home Mortgage" |
| Loan type | No | **Combo dropdown** — predefined list + free-text for custom types |
| Lender (formal name) | No | e.g. "Nissan Motor Acceptance Corp" |
| In whose name | No | e.g. "Steve", "Karen", "Joint" |
| Payment address | No | where to send a check |
| Phone | No | lender customer service |
| Monthly payment | No | exact or approximate |
| Interest rate | No | % APR |
| How it's paid | No | dropdown (see options below) |
| Payoff date | No | estimated if no extra payments |
| Months left | — | **Calculated read-only**: whole months from today → payoff date (0 if past) |
| Estimated remaining | — | **Calculated read-only**: months left × monthly payment. Tooltip: "Includes principal + interest. Not an exact payoff quote — call the lender for that." |
| Loan start date | No | optional — when the loan originated |
| Account number | Yes | encrypted |
| URL | No | plain text |
| Username | Yes | encrypted |
| Password | Yes | encrypted |
| What to do upon my death | No | textarea — instructions for loved one |
| Notes | No | anything else |
| sortOrder | No | drag to reorder |

**Loan type combo dropdown — predefined options (user can also type a custom value):**
Mortgage, Home Equity / HELOC, Car Loan, Credit Card, Student Loan, Personal Loan, Business Loan, Furniture, Other

**How it's paid — dropdown:**
- Auto Pay – Bank
- Auto Pay – Credit Card
- Ebill – Pay Manually
- Paper Bill – Pay Manually
- Other

**Calculated fields logic (client-side, not stored):**
- `monthsLeft`: count whole calendar months from today through payoff date. If payoff date is in the past or not set: show "—".
- `estimatedRemaining`: `monthsLeft × monthlyPayment`. If either is missing: show "—".
- Tooltip on "Estimated remaining": *"Includes principal + interest. Not an exact payoff quote — call the lender for that."*

**Add/Edit:** Full-screen form page (`#legacy/accounts/loans/add`, `#legacy/accounts/loans/edit/:id`) — not a modal. Same reason as Investments: passphrase prompt would go invisible behind a modal.

**Delete/Archive:** Soft delete only — `archived: true`. No hard delete. "Show Archived" checkbox below the "+ Add Loan" button. Archived cards show an "Archived" badge and a "Restore" button instead of "Archive".

**Person switcher:** Shares `_legacyFinPersonFilter` state already in legacy.js. No new state variable.

**Encrypted field display in expanded card:** `••••••` placeholder with individual Reveal buttons (same pattern as Accounts). Session is already unlocked by the time user is on this page.

**Badge color:** Amber/orange — visually distinguishes liabilities from assets.

**Firestore:** `legacyFinancial/{personId}/loans/{loanId}`

Fields: `nickname`, `loanType`, `lender`, `inWhoseName`, `paymentAddress`, `phone`, `monthlyPayment`, `interestRate`, `howItsPaid`, `startDate`, `payoffDate`, `accountNumberEnc`, `url`, `usernameEnc`, `passwordEnc`, `whatToDo`, `notes`, `archived`, `sortOrder`, `createdAt`

Encrypted fields: `accountNumberEnc`, `usernameEnc`, `passwordEnc` (stored as `{ ciphertext, iv }` objects). URL is plain text.

---

### 3. Bills (Recurring Expenses)

Everything that needs to be paid regularly. The goal: loved one knows what's coming,
how much it costs, how it's being paid, and what to do with each one.

**Collapsed card (list view) — show only filled-in fields, skip blanks:**
```
[⠿]  [Utilities]  Xcel Energy   $180/mo  [Auto Pay]  Due: 15th  [▾]
```
- Drag handle · Category badge · Name · amount · payment badge · due day · expand chevron

**Per bill fields:**
| Field | Encrypted? | Notes |
|-------|-----------|-------|
| Name | No | e.g. "Xcel Energy", "Netflix", "Home Mortgage" |
| Category | No | **Combo dropdown** — predefined list + free-text |
| In whose name | No | e.g. "Steve", "Karen", "Joint" |
| Estimated amount | No | rough cost per billing cycle |
| Frequency | No | dropdown — Monthly, Annual, Quarterly, Other |
| Address | No | where to send a check if needed |
| Phone | No | customer service |
| Account number | Yes | encrypted |
| How it's paid | No | same dropdown as Loans |
| Which card / account | No | plain text — e.g. "Chase Visa ending 4321" |
| Due date | No | free-form text — e.g. "15th", "March each year", "1st of month" |
| URL | No | account login page |
| Username | Yes | encrypted |
| Password | Yes | encrypted |
| What to do upon my death | No | textarea — cancel, transfer, keep paying, etc. |
| Notes | No | anything else |
| sortOrder | No | drag to reorder |

**Category combo dropdown — predefined options (user can also type a custom value):**
Utilities, Insurance, Subscriptions, Phone / Internet, Medical, Mortgage / Rent,
Car / Transportation, Credit Card, Other

**Frequency dropdown:**
Monthly, Annual, Quarterly, Semi-Annual, Other

**How it's paid — same dropdown as Loans:**
Auto Pay – Bank, Auto Pay – Credit Card, Ebill – Pay Manually, Paper Bill – Pay Manually, Other

**Collapsed card** — name, category badge, key at-a-glance info (filled fields only):
```
[⠿]  [Utilities]  Xcel Energy   $180/mo · Monthly  [Auto Pay]  Chase Visa 4321  Due: 15th  [▾]
```

**Expanded accordion** — shows operational info a loved one needs without opening Edit:
- In whose name, estimated amount, frequency, how it's paid, which card/account, due date, phone, what to do upon my death, notes
- Edit + Archive buttons

**NOT shown in expanded card — only accessible via Edit:**
URL, username, password, account number, address
(Sensitive/logistical details — loved one doesn't need them at a glance; they'd open Edit to find them)

**Encrypted fields:** `accountNumberEnc`, `usernameEnc`, `passwordEnc`

**Add/Edit:** Full-screen form page (`#legacy/accounts/bills/add`, `/edit/:id`) — not a modal.

**Delete/Archive:** Same as Loans — soft delete, "Show Archived" checkbox.

**Person switcher:** Shares `_legacyFinPersonFilter` state, same as Loans.

**Firestore:** `legacyFinancial/{personId}/bills/{billId}`

Fields: `name`, `category`, `inWhoseName`, `estimatedAmount`, `frequency`, `address`, `phone`, `accountNumberEnc`, `howItsPaid`, `whichCard`, `dueDate`, `url`, `usernameEnc`, `passwordEnc`, `whatToDo`, `notes`, `archived`, `sortOrder`, `createdAt`

**Backup:** Add `'bills'` to `PERSON_SCOPED_COLLECTIONS['legacyFinancial']` in `settings.js` — same commit as the feature.

---

### 4. Life Insurance

**Collapsed card:** policy type badge, company name, coverage amount
**Expanded card:** policy number, beneficiary, agent name + phone, where paper policy is, claims phone, premium + frequency, what to do — URL/username/password/address are Edit-only

**Per policy fields:**
| Field | Encrypted? | Notes |
|-------|-----------|-------|
| Company name | No | e.g. "Northwestern Mutual" |
| Policy type | No | combo dropdown |
| Policy number | No | shown in expanded card — needed for phone calls |
| Coverage amount | No | death benefit, e.g. "$500,000" |
| Beneficiary(ies) | No | who gets paid |
| Agent name | No | your personal insurance agent |
| Agent phone | No | agent direct line |
| Phone | No | general claims department |
| Address | No | mailing address — Edit-only |
| Where is the paper policy | No | e.g. "Filing cabinet, folder labeled Insurance" |
| Premium amount | No | e.g. "$120" |
| Premium frequency | No | same dropdown as Bills |
| URL | No | online portal — Edit-only |
| Username | Yes | encrypted — Edit-only |
| Password | Yes | encrypted — Edit-only |
| What to do / how to file a claim | No | textarea |
| Notes | No | anything else |
| sortOrder | No | |

**Policy type combo dropdown:** Term Life, Whole Life, Universal Life, Group / Employer, Other

**Firestore:** `legacyFinancial/{personId}/insurance/{policyId}`

Fields: `companyName`, `policyType`, `policyNumber`, `coverageAmount`, `beneficiary`, `agentName`, `agentPhone`, `phone`, `address`, `paperLocation`, `premiumAmount`, `premiumFrequency`, `url`, `usernameEnc`, `passwordEnc`, `whatToDo`, `notes`, `archived`, `sortOrder`, `createdAt`

**Backup:** Add `'insurance'` to `PERSON_SCOPED_COLLECTIONS['legacyFinancial']` — same commit as feature.

---

### 5. Financial Plan (Narrative)

**Context (from user discussion, 2026-04-26):**

The Legacy section serves a sequenced purpose for a surviving loved one:
- **Days 1–3:** Burial, service, obituary, who to call/notify — handled by the main Legacy hub (Read Me First, Final Message, Burial, Service, Notify)
- **Week 2:** Household Instructions (coming) — knowledge handoff on maintaining the house/yard; can point to the Bishop app itself
- **Week 2–4:** Bills, loans, insurance claims — handled by the Financial Accounts sub-tabs
- **Ongoing:** The Documents tab covers where the will is; contacts/advisors can be referenced via existing writing (Read Me First, Final Message, People to Notify, Letters)

The **Financial Plan** tab is the strategic big-picture layer that sits above all the individual account/loan/bill records. Each account already has a "what to do" field for tactical per-account instructions. What's missing is the executive summary — the human narrative that gives context to all those individual records.

**Life-stage awareness:** Financial planning means different things at different life stages. A 30-something with a young family has very different priorities than a 60-something near retirement. The plan must work for both. Single large textarea doesn't solve this well — people don't know what to write without prompts.

**Rename decision:** "Financial Accounts" → "Financial" — the current name implies investments-only. Rename the hub tile and hub page to "Financial" to better represent its true scope (accounts, loans, bills, insurance, plan).

**Design decision — prompted sections:**
Rather than one blank textarea, use a small set of predefined sections each with a guiding prompt. The prompt tells the user what to write; the loved one can scan sections to find what they need. Sections auto-save on blur. Voice-to-text (🎙️) button on the larger sections.

**Sections:**

| # | Section Title | Guiding prompt shown to user |
|---|--------------|------------------------------|
| 1 | The Big Picture | What does the loved one need to know about the overall financial situation? Are you in good shape? Any major concerns or complications? |
| 2 | First Things — What to Do | In the first few weeks, what should they focus on? What auto-pays? What will stop? Who should they call before making any decisions? |
| 3 | Key People to Call | Financial advisor, accountant, attorney, mortgage servicer, HR department? Names, firms, why to call them. (Can also reference Contacts or People to Notify.) |
| 4 | Investments & Retirement | What should they know about the investment accounts? What to do — or not do — with them? Any tax or rollover guidance? |
| 5 | My Wishes for the Money | How do you want the money used? House: sell or keep? Kids/grandkids? Charitable giving? Big picture intent. |
| 6 | Anything Else | Open free-form text for whatever doesn't fit above. |

**Firestore:** Sections stored as fields on the person's top-level `legacyFinancial/{personId}` doc:
`planBigPicture`, `planFirstThings`, `planKeyPeople`, `planInvestments`, `planWishes`, `planOther`

**Person-scoped:** Yes — same person switcher as other tabs. A plan exists per enrolled person.

**Encryption:** No — this is narrative text, not credentials. Plain Firestore storage under the passphrase gate (gate is already active for the whole Financial section).

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
