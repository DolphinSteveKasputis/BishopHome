# My Legacy Feature Plan

## Status: Planning — Not Started

---

## Name: DECIDED — "My Legacy"
Icon: 🕊️ | Route: `#legacy` | Tile style: `landing-tile--legacy`

---

## The Problem This Solves

> "If I die, my wife/kids/family need to know everything — accounts, wishes, instructions, letters — and they need to be able to find it all in one place without hunting."

The app is already behind login. The user leaves the login credentials + Legacy Passphrase in a physical envelope. The survivor logs in, opens My Legacy, enters the passphrase, and sees everything.

The "who gets this when I pass away" field on Things is an existing related seed.

---

## Password Encryption Strategy — DECIDED

### Approach: Separate Legacy Passphrase + Web Crypto API

**The passphrase is never stored.** Not in Firestore, not in localStorage, nowhere.

What IS stored in Firestore:
- A random **PBKDF2 salt** (non-sensitive — just a random string to make brute-forcing impractical)

How it works:
1. **First time** user opens My Legacy → prompted to create a Legacy Passphrase + confirm it. Warning shown: "This cannot be recovered. Write it down."
2. **Every session** when user navigates to `#legacy` → passphrase prompt appears. User types it → key derived in memory → section unlocks.
3. The in-memory key is used to decrypt/encrypt sensitive fields. It is cleared when the user navigates away.
4. **If passphrase is forgotten**: encrypted data is unrecoverable by design. User must delete and re-enter sensitive fields.

Why a separate passphrase (not the app login password):
- Using the app password as the key means you can never change your app password — that's unacceptable.
- The separate passphrase can be kept physically (in a safe or sealed envelope) and only needs to be changed if compromised.

### What Gets Encrypted — DECIDED
Only financially sensitive fields:
- `passwordEnc` — login passwords for financial and digital accounts
- `accountNumberEnc` — full account/policy/card numbers
- `ssnEnc` — Social Security Number(s)
- `pinEnc` — phone PIN, safe combo, etc.

What does NOT get encrypted:
- Institution names, URLs, account types, usernames, notes
- Letters (body text is plain — not sensitive enough to encrypt)
- Obituary, service wishes, burial preferences, final message
- Document locations, people-to-notify list

**Encrypted field naming convention**: suffix `Enc` on any Firestore field storing AES-GCM ciphertext.

---

## Sections

### 1. Burial & Remains Preferences
- Remains type: Cremation / Burial / Body donation / Other
- If cremation: what to do with ashes (scatter / keep urn / bury urn / split — multiple choice)
- Preferred location(s) for scattering or burial
- Organ & tissue donation: yes / no / specific restrictions
- Pre-arranged funeral: yes/no, with whom, paid in full?
- Free-form additional notes

### 2. Funeral / Memorial Service Wishes
- Service type: Traditional funeral / Graveside only / Celebration of life / No service / Memorial later / Other
- Preferred location (church, funeral home, backyard, park, no preference)
- Preferred officiant or speaker (link to Contact or free-form)
- Songs list: title, artist, context (entry / during / closing / reception) — add/remove rows
- Readings or passages: text or description, who should read it
- Tone/vibe note ("I want people to laugh and remember the good times")
- Flowers: yes / no / donations instead / specific flowers
- Dress code preference
- Guest scope: open to all / family only / close friends and family
- Free-form additional wishes

### 3. My Obituary
Two parallel tracks — fill one or both:
- **Write it myself**: full freeform draft (rich text)
- **Fact sheet** (for a survivor or AI to assemble):
  - Full legal name, preferred name/nickname
  - Date & place of birth; hometown(s)
  - Spouse: name, years married
  - Children & grandchildren (list)
  - Parents & siblings (survivors and predeceased)
  - Career / profession highlights
  - Accomplishments, awards, notable moments
  - Hobbies, passions, what you loved doing
  - Organizations, clubs, faith community
  - What you want to be remembered for
  - Preferred tone: funny / heartfelt / brief / formal / mix

### 4. Social Media & Digital Memorial Preferences
Per platform: platform name, username/profile URL, what to do after death
- Action options: Memorialize / Delete / Leave as-is / Transfer to someone (name who)
- Notes per platform ("my photos are in Google Photos — download them first before deleting")
- Platforms to prompt: Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, Reddit, etc.
- **Facebook Legacy Contact**: note that Facebook has a formal process — document who the legacy contact should be
- Phone PIN/passcode (encrypted) — so family can access the phone for photos, contacts, etc.
- Password manager entry: which app, where to find it, master password (encrypted)

### 5. Financial & Account Access
Each entry: institution, account type, URL, username, password (encrypted), account number (encrypted), beneficiary, notes, contact/phone

#### 5a. Bank & Credit Accounts
Types: Checking, Savings, Money Market, CD, Credit Card, HELOC, Other

#### 5b. Investment & Retirement Accounts
Types: 401(k), IRA, Roth IRA, Pension, Brokerage, HSA, 529, Other
Extra fields: beneficiary on file, how to access/withdraw instructions

#### 5c. Life Insurance
Extra fields: policy number (encrypted), face value, beneficiary, agent contact, where paper policy is kept

#### 5d. Debts & Loans
Types: Mortgage, Car loan, Student loan, Personal loan, Credit card (balance), Other
Extra fields: monthly payment, auto-pay yes/no

#### 5e. Other Financial & Personal Info
- Social Security Number (encrypted) — yours and spouse's (separate entries or same form?)
- Safe deposit box: bank, box number, what's inside, where the key is
- Physical cash: location, approximate amount
- Tax preparer: name, contact info
- Business interests, partnerships, side income (free-form)

#### 5f. Retirement & Investment Instructions for Spouse
Free-form rich text: withdrawal strategy, RMDs, Social Security timing, who to call, philosophy
- Link to financial advisor Contact

### 6. Important Documents & Where to Find Them
For each: exists (yes/no/unknown), physical location, digital location, notes
Fixed list (checkable) + free-form extras:
- Will / Last Will & Testament
- Trust documents
- Healthcare directive / Living will
- DNR order
- Durable Power of Attorney (financial)
- Healthcare proxy / Medical POA
- Birth certificate
- Marriage certificate
- Social Security card
- Passport
- Car title(s)
- House deed / mortgage documents
- Homeowner's insurance policy
- Tax returns (last 3 years)
- Free-form "other documents" entries

### 7. Medical Wishes / Healthcare Directives
- Resuscitation (CPR): yes / no / depends on circumstances
- Mechanical ventilation: yes / no / time-limited trial
- Feeding tube: yes / no / short-term only
- Hospitalization vs. hospice: prefer hospital / prefer home / prefer hospice / let family decide
- Organ & tissue donation (links to Section 1)
- Preferred hospital (if applicable)
- Healthcare proxy / medical POA (link to Contact)
- Free-form notes ("I want to die at home if at all possible")

### 8. Practical Household Instructions
- Utilities: per utility (gas, electric, water, internet, phone) — provider, account #, how to pay, auto-pay
- HOA: contact, dues, portal login
- Home security system: company, code(s) (encrypted), contact
- Recurring services: lawn, pest control, cleaning, pool, etc.
- Car maintenance: per car — shop, schedule, quirks
- Appliances & manuals location
- Home service contacts (link to Contacts — plumber, electrician, HVAC)
- Free-form "things to know about this house"

### 9. Pets
*Included for all users — fill in if applicable.*
Per pet: name, species, breed, age, vet contact, food/medications, special needs
- Who should take this pet (link to Contact or free-form name)
- Free-form care notes

### 10. People to Notify
When I pass, these people should be contacted:
Per person: name (link to Contact or free-form), relationship, phone, email, notes
- Priority order — sortable list
- Note field per person ("tell her before it goes public")

### 11. Letters to People
- Pick a recipient from Contacts or type a name
- Write a personal letter (rich text, no length limit)
- Letters are NOT encrypted (plain text in Firestore — not considered sensitive)
- List view: recipient name, date written, last edited
- Add / edit / delete
- **Print button** per letter — prints just the letter with clean formatting, no app chrome (good for physical delivery or PDF)

### 12. Final Message
A single open message to whoever reads this. No structure — just say what you want to say.
- Rich text, no length limit
- Not encrypted
- Toggle: "Show this first when someone opens My Legacy"

---

## Legacy Landing Page (`#legacy`) — DECIDED: Tile Grid

Same style as the Life main page — a grid of tiles, one per section.

| Tile | Icon | Route |
|------|------|-------|
| Burial & Remains | ⚱️ | `#legacy/burial` |
| Service Wishes | 🕊️ | `#legacy/service` |
| My Obituary | 📜 | `#legacy/obituary` |
| Social Media | 📱 | `#legacy/social` |
| Financial Accounts | 💰 | `#legacy/accounts` |
| Documents | 📁 | `#legacy/documents` |
| Medical Wishes | 🏥 | `#legacy/medical` |
| Household | 🏠 | `#legacy/household` |
| Pets | 🐾 | `#legacy/pets` |
| People to Notify | 📞 | `#legacy/notify` |
| Letters | ✉️ | `#legacy/letters` |
| Final Message | 💬 | `#legacy/message` |

3-column grid, flat (no grouping). Sort order to be decided later — user will prompt a re-sort.

Page header note: *"This information is private and intended for your loved ones. Keep your Legacy Passphrase stored safely alongside your app login."*

---

## Passphrase UX Flow — DECIDED: Only on Financial Section

The passphrase gate only appears when navigating to `#legacy/accounts` (Financial) and `#legacy/social` (which contains phone PIN and password manager — both encrypted). All other sections (burial, service, obituary, letters, etc.) open freely — no gate.

**Flow for gated sections:**
1. User navigates to `#legacy/accounts` or `#legacy/social`
2. Passphrase prompt modal:
   - **First time**: "Create your Legacy Passphrase" + confirm field + warning ("Write this down — it cannot be recovered")
   - **Returning**: "Enter your Legacy Passphrase to view financial info"
3. Passphrase derives the in-memory key via PBKDF2 + stored salt
4. Section unlocks for the session; key stays in memory as long as the user is on `#legacy/*` routes
5. On navigating away from Legacy entirely: key cleared from memory
6. "Forgot passphrase?" link: "Encrypted data cannot be recovered without this passphrase. You will need to delete and re-enter all financial login and account info."

**Sections that require the passphrase**: Financial Accounts (`#legacy/accounts`), Social Media & Digital (`#legacy/social`)
**Sections that are freely accessible**: Everything else

---

## Data Model (Proposed Firestore)

All under `userCol()`.

| Collection | Key Fields |
|------------|------------|
| `legacyMeta` | (single doc) `passphraseSetup` (bool), `pbkdf2Salt` (hex), `burialPrefs{}`, `servicePrefs{}`, `obituaryDraft`, `obituaryFacts{}`, `finalMessage`, `showFinalMessageFirst` (bool), `medicalWishes{}`, `householdNotes`, `retirementInstructions`, `lastUpdatedAt` |
| `legacyAccounts` | `category`, `name`, `accountType`, `url`, `username`, `passwordEnc`, `accountNumberEnc`, `beneficiary`, `notes`, `sortOrder`, `createdAt` |
| `legacyPersonalIds` | (single doc or small collection) `ssnEnc`, `spouseSsnEnc`, `notes` |
| `legacyDocuments` | `docType`, `exists`, `locationPhysical`, `locationDigital`, `notes` |
| `legacyLetters` | `contactId?`, `recipientName`, `body` (plain text), `createdAt`, `updatedAt` |
| `legacyNotifyList` | `contactId?`, `name`, `relationship`, `phone?`, `email?`, `notes`, `sortOrder` |
| `legacyPets` | `name`, `species`, `breed?`, `age?`, `vetContactId?`, `vetName?`, `food`, `medications?`, `guardianContactId?`, `guardianName?`, `notes` |

---

## Routing

| Route | Page |
|-------|------|
| `#legacy` | Landing tile grid + passphrase gate |
| `#legacy/burial` | Burial & Remains |
| `#legacy/service` | Funeral / Service Wishes |
| `#legacy/obituary` | My Obituary |
| `#legacy/social` | Social Media & Digital Memorial |
| `#legacy/accounts` | Financial & Account Access |
| `#legacy/documents` | Important Documents |
| `#legacy/medical` | Medical Wishes |
| `#legacy/household` | Household Instructions |
| `#legacy/pets` | Pets |
| `#legacy/notify` | People to Notify |
| `#legacy/letters` | Letters list |
| `#legacy/letter/{id}` | Letter detail / edit |
| `#legacy/message` | Final Message |

---

## Printable Access Card — DECIDED: Yes

A button on the Legacy landing page (or in Settings) that generates a clean printable page:
- App URL
- "Log in with your email and password"
- "Navigate to Life → My Legacy"
- "Enter your Legacy Passphrase: _______________"
- Space to handwrite the passphrase before sealing in envelope

---

## UX & Design Notes

- Slightly muted/dignified color palette — different feel from the rest of the app
- No pressure to complete any section — empty = "not started", not broken
- Auto-save pattern same as rest of app
- Password fields: show/hide 👁 toggle
- All encrypted fields show a 🔒 icon to indicate they are protected
- Mobile-first — a survivor may access this on their phone in a difficult moment
- Print stylesheet for letters (clean single-column output)

---

## Decisions Log
| Decision | Choice |
|----------|--------|
| Feature name | My Legacy |
| Encryption key | Separate Legacy Passphrase, never stored |
| Key derivation | PBKDF2 + random salt stored in Firestore |
| Encryption algo | AES-GCM 256-bit via Web Crypto API |
| Encrypted fields | Passwords, account numbers, SSN, PINs only |
| Letters encrypted? | No — plain text |
| Landing page style | Tile grid (same as Life page) |
| Printable access card | Yes |
| Print button on letters | Yes |
| Veteran benefits section | Not included |
| Pets section | Included (for other users) |
| Landing grid | 3-column flat; sort order TBD (user will prompt) |
| SSN placement | Inside Financial section (5e) |
| Passphrase gate scope | Financial + Social sections only |
| Passphrase session | Unlocked once per browser session |

---

## Questions — Overall — ALL DECIDED ✅

| Question | Decision |
|----------|----------|
| Landing grid layout | 3-column flat tile grid; sort order deferred (user will prompt later) |
| SSN placement | Inside Financial section (Section 5e) |
| Passphrase session scope | Stays unlocked for the entire browser session once entered |

---

## Questions — Per Section (Ask When Building Each One)

### Section 1: Burial & Remains
- Any specific scattering locations you want to pre-fill as examples?
- "Pre-arranged funeral" — just a yes/no note, or a full account entry with funeral home contact and payment details?

### Section 2: Service Wishes
- Songs list — structured rows (title + artist + context) or just a free-form text area?
- Officiant — link to Contacts, or plain text name is fine?

### Section 3: Obituary
- Should the fact sheet have an "AI Draft" button that sends the facts to OpenAI and generates a draft obituary? (SecondBrain-style action)
- Formatted rich text for the freeform draft, or plain textarea?

### Section 4: Social Media
- Do you have a password manager (1Password, iCloud Keychain, etc.)? If so, we'll add a specific "Password Manager" entry type with master password field (encrypted).
- Phone PIN — store here under Social/Digital, or in Financial > Other?

### Section 5: Financial Accounts
- Account numbers — full number encrypted, or last-4 plain + full encrypted? (Last-4 plain lets you identify the account without unlocking.)
- Should the Financial section have a "Retirement Instructions" as a big free-form text area, or structured fields?

### Section 6: Documents
- Fixed checklist + free-form extras (as planned), or all free-form?
- Photo attachment per document (scan of the actual doc)? Uses Base64 pattern — adds Firestore doc size.

### Section 7: Medical Wishes
- Do you already have a Healthcare Directive on file somewhere? Helps us know if the "where is it located" field matters.

### Section 8: Household Instructions
- Utilities — structured per-utility entries (with encrypted account numbers), or free-form text?
- Should this pull from your existing House/Zone data in any way, or stand alone?

### Section 9: Pets
- Do you have pets? (Just for testing purposes — feature is generic for other users.)

### Section 10: People to Notify
- Flat list or priority tiers ("notify immediately" vs. "notify within a week")?

### Section 11: Letters
- One letter per person, or multiple letters to the same person allowed?
- Letter type tag (e.g., "love letter", "life advice", "thank you") or no categorization?

### Section 12: Final Message
- Plain textarea or formatted rich text?
- "Show this first" toggle — include it?

---

## Build Order (When Ready)

1. `js/legacy-crypto.js` — Web Crypto API utility (PBKDF2 key derivation, AES-GCM encrypt/decrypt)
2. Legacy routing skeleton + passphrase gate modal
3. Life main page tile ("My Legacy")
4. Section: Burial & Remains
5. Section: Service Wishes
6. Section: Obituary
7. Section: Financial Accounts (most complex)
8. Section: Documents
9. Section: Social Media & Digital
10. Section: Medical Wishes
11. Section: Household Instructions
12. Section: Pets
13. Section: People to Notify
14. Section: Letters + print stylesheet
15. Section: Final Message
16. Printable access card page
17. Spec + AppHelp + cache bump — final commit

---

## Related Files
- `MyLife-Functional-Spec.md` — update when implemented
- `AppHelp.md` — add `## screen:legacy*` sections when implemented
