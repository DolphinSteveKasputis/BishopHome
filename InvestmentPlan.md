# Investment Tracker — Feature Plan

## Source of Truth
Analyzed from Steve's retirement spreadsheet (Google Sheets). This doc captures what he's doing in the
spreadsheet and how to mirror/improve it in Bishop.

---

## What the Spreadsheet Does (by tab)

### Tab 1: Summary New
The live dashboard. Every account feeds here.

**Top section (current):**
- Total portfolio value: overall, Steve total, Connie total
- Breakdown by category: Roth, PreTax, Brokerage, Cash, Inv Cash
- Individual account columns (each account is a column): Steve Roth (Fidelity), Steve 401k (EJ), Fid SD 401k, Roth401k, HSA, Savings, Fidelity Joint, Con Roth, Connie 401k
- Period performance rows: Current Total, Begin Day/Week/Month/Year, Gain/Loss ($), Gain/Loss (%), % of total

**Bottom section (historical snapshots manually copy-pasted):**
- Beginning Of Year rows (one per year)
- Beginning Of Month rows (one per month)
- Beginning Of Week rows (one per week)

### Tab 2: Proj Needed (Projection Needed)
What Steve needs in retirement. Heavily used for "what if" analysis.

- **SS Benefits table:** Steve and Connie's monthly SS income at ages 62, 63, 64, 65, 67 (entered manually from SSA.gov)
- **Income need:** current take-home → what's needed monthly/yearly before taxes after SS (budget lifestyle vs same lifestyle)
- **Key inputs:** inflation rate (2%), investment rate of return (6%)
- **Age projection table:** for each age 55–67, shows inflation-adjusted spending need and the total portfolio required at 6% RoR to sustain it
- Used constantly to answer: "Can I retire at 62? At 65? At which lifestyle?"

### Tab 3: RetProj (Retirement Projection)
Year-by-year table from 2008 (age 40) through future retirement.

**Historical rows (actual data):**
- Year, Steve's age, work status (full/part/full/retired), salary, 401k contributions made, actual RoR achieved, HSA contribution, starting balance, ending balance (Steve / Connie / Total)

**Projected rows (future):**
- Same structure but with assumed salary growth, assumed RoR (9.4%), projected contributions
- Work status transitions: Full → Part/Full (age 60-61) → Retired (age 62+)
- In retirement: shows spending/withdrawal rate and how the balance holds up over time

### Tab 4: All Stocks
Cross-account stock concentration rollup.

- For every unique ticker held across ALL accounts: company name, ticker, current price, previous snapshot price, % change, previous total value, current total value
- Purpose: make sure you're not over-concentrated in any single stock

### Account Tabs (RothSteve, Steve401k, Fidelity401k, Roth401k, HSA, FidelityJoint, ConRoth, Connie401k)
One tab per account. These feed the Summary and All Stocks tabs.

- Account name + institution + login URL
- "Invested" amount (approximate cost basis)
- Historical 1/1/YEAR snapshot values (manually noted)
- Holdings table: Company Name | Ticker | Shares | Current Price (from GOOGLEFINANCE()) | Current Value

---

## Accounts We're Tracking

| Owner  | Account Name       | Tax Category | Institution  |
|--------|--------------------|-------------|--------------|
| Steve  | Roth IRA           | Roth        | Fidelity     |
| Steve  | 401k               | PreTax      | Edward Jones |
| Steve  | SD 401k (Fidelity) | PreTax      | Fidelity     |
| Steve  | Roth 401k          | Roth        | Fidelity     |
| Steve  | HSA                | Roth        | (TBD)        |
| Joint  | Savings            | Cash        | (TBD)        |
| Joint  | Fidelity Joint     | Brokerage   | Fidelity     |
| Connie | Roth IRA           | Roth        | (TBD)        |
| Connie | 401k (New)         | PreTax      | (TBD)        |
| Connie | 401k (Old)         | PreTax      | (TBD)        |

**Account type → Tax category mapping** (used by summary groupings):
| Account Types | Tax Category |
|--------------|-------------|
| roth-ira, roth-401k, hsa | Roth |
| traditional-401k, self-directed-401k, traditional-ira, 403b | PreTax |
| brokerage-individual, brokerage-joint | Brokerage |
| checking, savings, money-market, cd | Cash |
| (cash balance field on any investment account) | Inv Cash |
| 529 | Excluded from tax groupings (no 529s in use) |

Owners: **Steve (self), Connie (contact), Joint (stored under self with jointOwnerId)**

---

## Proposed Bishop Screens

### Screen 1: Investments Landing Page *(new)*
The hub. Replaces the skeleton card currently on the Life home page.

**Content:**
- Total portfolio value (large, prominent) + day gain/loss
- Quick-stat row: Week | Month | YTD gain/loss
- All-Time High callout (date + value)
- Card grid linking to sub-sections:
  - Accounts
  - Portfolio Summary
  - Stock Rollup
  - Historical Snapshots
  - Retirement Planner
  - Retirement Projection

---

### Screen 2: Accounts List *(move existing + enhance)*
The current "Financial Accounts" screen gets renamed and moved here.

**Content:**
- Grouped by owner: Steve / Connie / Joint
- Each account card: name, institution, type badge (Roth/PreTax/Brokerage/Cash), current value
- Total per owner at top of each group
- Tap → Account Detail

---

### Screen 3: Account Detail
Drill into a single account.

**Content:**
- Header: account name, institution, owner, type, total current value
- Two totals shown: **Gross total** (holdings + inv cash) and **Invested total** (holdings only)
- Holdings list:
  - Company name, ticker symbol
  - Shares held
  - Current price (fetched from stock API)
  - Current value (shares × price)
  - Day change ($, %)
- **Investable cash balance** field — cash sitting uninvested in this account (user manually updates)
- Add / Edit / Delete holdings
- For bank accounts (Cash category): no holdings; just a manually-updated balance

**Holdings data entry:**
- Ticker symbol (user types)
- Shares / quantity
- Price fetched automatically from Finnhub on "Update Prices" tap
- Manual price entry as fallback

---

### Screen 4: Portfolio Summary *(mirrors Summary New)*
The live dashboard — all accounts for the selected **Group** rolled up.

**Group concept:**
- A Group is a named, saved set of people (e.g., "Our Household" = Steve + Connie)
- Summary always reflects the selected Group
- TBD: saved named groups vs. ad-hoc multi-select (to be decided — see open questions)
- **Joint account rule:** Joint accounts only appear in a group's summary when ALL parties in the joint account are members of that group. A solo view of Steve never shows joint accounts.

**Two top-line numbers (like spreadsheet B2/B3):**
- **Net Worth** (B3): grand total of all holdings + all cash + all inv cash across the group
- **Invested** (B2): Net Worth minus investable cash = actual amount in stocks/funds

**Category breakdown (spans all accounts in the group):**
| Category | What's included | Tax treatment |
|----------|----------------|---------------|
| Roth | Roth IRA, Roth 401k, HSA | Tax-free withdrawals |
| PreTax | Traditional 401k, SD 401k, Traditional IRA, 403b | Taxed as ordinary income |
| Brokerage | Individual/joint brokerage | Tax on gains only |
| Cash | Bank savings, checking, money market, CD | Freely spendable |
| Inv Cash | Uninvested cash inside investment accounts | Investable but not spendable |

**Period performance (for each category AND each account):**
- Day: Begin $ | Current $ | Gain/Loss $ | %
- Week: same
- Month: same
- YTD: same
- Begin values come from the most recent snapshot of each type

**All-Time High:** Separate ATH tracked for daily, weekly, and monthly high watermarks (highest value ever recorded at each snapshot type)

**"If I retired today" widget:**
- Est. annual income: Net Worth × `projectedRoR` (default 6%, configurable)
- Est. monthly after-tax: (annual ÷ 12) × `afterTaxPct` (default 82%, configurable)
- + SS monthly income *(placeholder — wired in when Retirement Planner is built)*
- = Total monthly take-home *(same, added later)*

**Per-account breakdown:**
- Grouped by person (Steve's accounts | Joint | Connie's accounts)
- Each account: current value, day gain/loss

**Mobile vs desktop layout:**
- Desktop/tablet: wide layout, accounts shown as columns (spreadsheet-style)
- Mobile: stacked cards — category totals at top, period performance rows, then per-account cards below
- Same data, two responsive layouts

---

### Screen 5: Historical Snapshots *(mirrors Summary New bottom section)*
Where Steve manually records portfolio values periodically.

**Content:**
- **Capture Snapshot** button → picks type (Daily / Weekly / Monthly / Yearly) → records current computed values for all accounts + category totals + group Net Worth
- Snapshot list, grouped by type with most recent first
- Each snapshot row: date, Net Worth, Invested total
- Tap a snapshot → full breakdown (per-account values, per-category values at that moment)
- Used by Portfolio Summary as the "beginning of period" baseline
- ATH updated automatically on each capture if current value exceeds stored ATH

**Daily snapshot workflow:** Open app each morning → tap "Update Prices" → tap "Capture Daily Snapshot" → baseline locked in for the day.

---

### Screen 6: Stock Rollup *(mirrors All Stocks tab)*
Cross-account concentration analysis.

**Content:**
- Header totals: total invested value, total current value, overall gain/loss %
- Table — one row per unique ticker across all accounts:
  - Company name, ticker
  - Total shares (summed across all accounts)
  - Current price
  - Current total value
  - Previous snapshot value (from last snapshot)
  - $ change + % change
  - % of total portfolio (concentration indicator — highlight if >10% or >15%)
- Sort options: by value, by % change, by ticker
- Tapping a row could show which accounts hold that ticker

---

### Screen 6.5: Social Security Benefits *(standalone sub-section)*
Dedicated data-entry and history screen for SS projected benefit numbers.

**Purpose:** Each year (typically around Jan 1), the user logs into SSA.gov and pulls the latest projected monthly benefit at each claiming age. Those numbers are recorded here as a dated snapshot. The planner always uses the most recent snapshot — older ones are kept for comparison only.

**Navigation:** Own card on the Financial hub (same tier as Accounts, Summary, Snapshots, etc.) AND linked via a "Manage SS Benefits →" button from within the Retirement Planner. It is data-entry infrastructure, not just a planner detail screen.

**Person picker:**
- SS benefits can be tracked for **any person tracked in the app** — "self" = Steve, plus any contact/person (Connie, kids, anyone)
- Same person-switcher pattern as Accounts: "self" or a contact person ID
- Each person has their own independent history of SS snapshots

**Snapshot concept:**
- A "snapshot" = a dated record of SS benefit projections for one person
- `asOfDate`: the date the SSA.gov numbers were pulled (e.g. `2026-01-01`) — always year-based, typically Jan 1
- Each snapshot contains N age/amount rows — user defines which ages they care about per snapshot
- Ages available in dropdown: 62 through 70 (whole numbers only — SSA only provides whole-year estimates)
- A snapshot can have any subset: e.g. just {65, 70} or all of {62, 63, 64, 65, 66, 67, 68, 69, 70}
- No global configuration of "which ages to show" — the ages in each snapshot are whatever the user added rows for

**Two distinct actions — "Create New Snapshot" vs "Update Current Snapshot":**
- **Create New Snapshot**: pre-fills all age rows AND amounts from the previous snapshot (convenient baseline — just update the numbers that changed). `asOfDate` defaults to today. Each pre-filled row can be deleted before saving. Can also add new age rows with "+ Add Age". Save → becomes the new "most recent" snapshot used by the planner. If no previous snapshot exists, starts blank.
- **Update Current Snapshot**: opens the existing most recent snapshot for editing. All rows are pre-filled. Allows changing amounts, adding forgotten ages, removing rows, or correcting the as-of date. Saves in-place — does not create a new record. Intended for users who don't care about year-over-year history and just keep one current set of numbers.
- Older snapshots (not the most recent) are editable via the same "Update" action, but a note clarifies they are not used in planning.
- Can delete any snapshot. If deleting the most recent, the previous one becomes the new "most recent" used by the planner (with a confirmation warning noting this).

**Snapshot list view (per person):**
- Most recent first
- Each snapshot card shows: as-of date, number of ages recorded, the age range (e.g. "Ages 62–70")
- Expand a snapshot to see the full age/amount table
- "Most Recent" badge on the newest snapshot — this is the one used for planning
- Older snapshots: read-only view; a note: "Historical — not used in planning"

**Planning rule:**
- The Retirement Planner ONLY uses the most recent snapshot for each person
- There is no way to select an older snapshot for planning — the UI does not offer it
- If no snapshot exists for a person, the planner shows a prompt to add one

---

### Screen 7: Retirement Planner *(mirrors Proj Needed)*
The "can I retire at 62?" calculator. Fully interactive.

**Content:**

**Section A — Social Security Benefits**
- Pulls from the most recent SS Benefits snapshot for each person tracked
- Shows a summary table: each tracked person → their benefit at each recorded age
- Combined household total at each age (sum of all tracked persons' benefits)
- "Manage SS Benefits →" link/button jumps to Screen 6.5
- Combined household SS uses **only people in the currently selected investment Group** — consistent with how the rest of the planner works
- Selected retirement age → selected SS amount (auto-looked-up from the snapshot for that age; flagged as "not recorded" if the exact age isn't in the snapshot — no interpolation)

**Section B — Income Needs**
- Current take-home (after tax, per year)
- Desired lifestyle in retirement:
  - Same lifestyle (= current take-home)
  - Budget lifestyle (user enters reduced %)
- Monthly/yearly income needed
- Minus SS income = investment income needed per year

**Section C — Assumptions**
- Inflation rate (default 2%) — adjustable
- Investment Rate of Return (default 6%) — adjustable
- Target retirement age — picker

**Section D — Results (computed)**
- Inflation-adjusted spending need at retirement age
- Total portfolio value needed to sustain that at chosen RoR
- Current portfolio value vs needed → gap or surplus
- "On Track" progress bar

**Section E — Age Table**
- For each age from current to 70:
  - Inflation-adjusted spend
  - Portfolio needed at 6% RoR
  - Whether current trajectory reaches it (green/red)
- Effectively: "if I waited until age X, how much would I need?"

---

### Screen 8: Retirement Projection *(mirrors RetProj)*
Year-by-year look at the portfolio from the past through future retirement.

**Content:**
- Table — one row per year:
  - Year, Steve's Age, Work Status (Full / Part / Retired)
  - Salary (entered)
  - 401k Contribution (entered for past, projected for future)
  - Rate of Return (actual for past, assumed for future)
  - Starting Balance (Steve / Connie / Total)
  - Interest Earned
  - Ending Balance

**Past rows:** user can enter actual historical data (salary, contributions, RoR)
**Future rows:** automatically calculated from assumptions (editable per year)
**Work status:** user sets per-year (Full, Part-Time, Retired)

**Configuration:**
- Assumed future salary growth rate
- Assumed future RoR (default 9.4% — can override per year)
- Retirement start age
- In retirement: spending withdrawal amount per year

**Outputs:**
- Chart / table showing ending balance trajectory
- Color coding: green = balance growing, yellow = stable, red = spending down
- Shows how long money lasts in retirement

---

## What Already Exists in investments.js

A solid account CRUD system is already built. Key things to know:

- **Route:** `#investments` and `#investments/add`, `#investments/edit/{id}`
- **Firestore path:** `userCol('investments').doc(personFilter).collection('accounts')`
  - `personFilter` = `'self'` (default) or a contact person ID (for Connie's accounts)
- **Account fields already stored:** accountType, nickname, institution, last4, url, loginNotes, beneficiary, accountNumberEnc, usernameEnc, passwordEnc, sortOrder, archived, createdAt
- **Account types already defined:** checking, savings, money-market, cd, roth-ira, traditional-ira, roth-401k, traditional-401k, self-directed-401k, 403b, brokerage-individual, brokerage-joint, hsa, 529, other
- **Person switcher:** Already supports viewing accounts per person (Steve = 'self', Connie = her contact ID)
- **Existing data:** 2 savings accounts already entered — safe, not affected by any UI changes

**What we are adding to accounts:**
- `owner` field: `'self'` / `'joint'` — distinguishes personal vs joint accounts
  - Steve's accounts: stored under `investments/self/accounts`, owner = `'self'`
  - Connie's accounts: stored under `investments/{connieContactId}/accounts`, owner = `'self'`
  - Joint accounts: stored under `investments/self/accounts`, owner = `'joint'`, plus `jointOwnerId` = Connie's contact ID
- `cashBalance` field: uninvested cash sitting in the account (contributes to Inv Cash category total)
  - For bank accounts (Cash category): the account balance IS entered as `cashBalance`; no holdings
- `primaryContactId` field (on joint accounts): the co-owner's contact ID — used for two purposes:
  1. Show joint accounts in co-owner's account list (second query: self/accounts where owner='joint' AND primaryContactId=coOwnerId)
  2. Determine if joint account appears in a group (only when ALL parties are in the group)
- Joint accounts are stored once (under 'self') but appear in BOTH owners' account lists via the second query

**New subcollection per account:**
- `holdings/{holdingId}`: `{ ticker, companyName, shares, lastPrice, lastPriceDate }`
  - `lastPrice` and `lastPriceDate` — cached from most recent Finnhub fetch
  - Deduplication: if same ticker appears in multiple accounts, Finnhub is called once; price applied to all

**What the restructure looks like:**
- Current `#investments` (account list) → moves to `#investments/accounts`
- New `#investments` → hub landing page
- All existing Firestore data stays exactly where it is

---

## Data Model (Firestore)

```
investments/                         ← existing top-level doc namespace
  {personFilter}/
    accounts/{accountId}             ← EXISTING — add: owner, cashBalance, primaryContactId (joint only)
      holdings/{holdingId}           ← NEW: { ticker, companyName, shares, lastPrice, lastPriceDate }

userCol('investmentGroups')/         ← NEW collection
  {groupId}: { name, personIds[], snapshotFrequencies[] }
  - Default "Me" group auto-created on first use: personIds=['self'], frequencies=['daily','weekly','monthly','yearly']
  - "Me" group is always present; group switcher hidden on summary if only one group exists
  - Kids' groups: frequencies=['yearly'] only

userCol('investmentConfig')/         ← NEW — single doc 'main'
  main: { projectedRoR (default 0.06), afterTaxPct (default 0.82),
          allTimeHighDaily{value,date}, allTimeHighWeekly{value,date},
          allTimeHighMonthly{value,date} }

userCol('investmentSnapshots')/      ← NEW collection
  {snapshotId}: { date, type (daily/weekly/monthly/yearly),
                  groupId, netWorth, invested,
                  perAccount{accountId→value},
                  perCategory{roth,pretax,brokerage,cash,invcash},
                  notes }

userCol('investmentScenarios')/      ← NEW collection
  {scenarioId}: { name, retirementAge, ssClaimingAge, ssMonthlySteve,
                  ssMonthlyConnie, currentIncome, lifestylePct,
                  inflationRate, investmentRoR, notes }

userCol('ssBenefits')/               ← NEW collection — Social Security projected benefits
  {snapshotId}: {
    personId,        // 'self' or contact ID (Connie, a kid, etc.)
    asOfDate,        // ISO date string, e.g. "2026-01-01"
    entries: [       // array of age/amount pairs — user defines which ages
      { age: 62, monthly: 2100 },
      { age: 65, monthly: 2450 },
      ...
    ],
    notes,           // optional free-text
    createdAt
  }
  // Queries: orderBy asOfDate desc, filtered by personId
  // Most recent per person = used by planner; older = historical/read-only

userCol('investmentRetirementConfig')/  ← NEW — single doc 'main'
  main: { currentIncome, inflationRate, investmentRoR,
          targetRetirementAge, desiredLifestylePct }
  // SS data moved out — now lives in ssBenefits collection with full history

userCol('investmentRetirementRows')/    ← NEW collection
  {rowId}: { year, steveAge, status (full/part/retired), salary,
              contributions, ror, startSteve, startConnie,
              interestSteve, interestConnie, endSteve, endConnie, notes }
```

---

## Stock Price API — Decision

**Selected: Finnhub** (finnhub.io)
- Established company, official API, free tier: 60 calls/minute
- Supports individual stocks AND mutual funds (FXAIX, RDFTX confirmed)
- Requires a free account + API key
- API key stored in Bishop's general settings (same pattern as other API keys), with setup instructions shown in the UI

**Price refresh model — all on demand, no auto-refresh:**
- **Account Detail page:** "Update Prices" button → fetches prices for holdings in that account only → updates `lastPrice`/`lastPriceDate` on each holding → refreshes account total display
- **Summary page:** "Update Prices" button → fetches prices for ALL unique tickers across ALL accounts (deduplicated — one Finnhub call per unique ticker) → updates all holding docs → refreshes full summary
- **Loading state:** Button shows spinner + "Updating..." while in flight. On completion shows "Updated X min ago" timestamp. Error state if Finnhub call fails (show which tickers failed).
- **Capture Daily Snapshot:** Separate button on Summary page. Tap after "Update Prices" to lock in today's baseline. App warns if prices haven't been refreshed recently before allowing snapshot capture.
- Prices cached in Firestore (`lastPrice`, `lastPriceDate` on each holding) so last known values always available without re-fetching.

**Non-stock holdings:**
- HSA, Fidelity Joint, RothSteve etc. → stock holdings with tickers (same as other accounts)
- Savings accounts → no holdings; user manually updates `cashBalance` field on the account periodically
- 401k mutual funds (FXAIX, RDFTX) → tracked as a single holding with ticker + shares; Finnhub supports mutual fund prices

---

## Implementation Phases — Phase 1 Feature Set

Each phase is a complete, testable chunk. Build in order — later phases depend on earlier ones.

---

### Phase 1: Route Restructure + Account Enhancements
*Move the account list, add new fields, handle joint accounts properly.*

- Move account list from `#investments` → `#investments/accounts`
- Create a minimal skeleton `#investments` landing page (just navigation links for now — filled in at Phase 9)
- Update all routing, breadcrumbs, back buttons
- Add to account **form**:
  - `owner` toggle: Personal / Joint
  - When Joint selected: contact picker for the co-owner (`primaryContactId`)
  - `cashBalance` field: "Cash / Uninvested Balance" — shown on all investment accounts, used as the sole balance entry for bank accounts
- Update account **list page**:
  - Group accounts by person: Steve | Joint | Connie
  - Joint accounts appear in co-owner's list via second query (`owner='joint'` AND `primaryContactId=coOwnerId`)
  - Each account card shows tax category badge (Roth / PreTax / Brokerage / Cash) derived from account type

---

### Phase 2: Account Detail + Holdings CRUD
*Drill into an account and manage its stock/fund positions.*

- New screen: `#investments/account/{id}`
- Holdings list: company name, ticker, shares (prices shown as "—" until fetched)
- Add / Edit / Delete holdings (ticker, company name, shares)
- For bank/cash accounts: no holdings section — just show and edit `cashBalance`
- Account total displayed as: Σ(shares × lastPrice) + cashBalance — shows partial values with whatever prices are cached; zeros for unfetched

---

### Phase 3: Finnhub Integration + Price Fetching
*Wire up live stock prices.*

- Add Finnhub API key field to the app's general settings page
  - Include setup instructions: link to finnhub.io, how to get a free key, where to paste it
  - If key is missing, "Update Prices" button shows a helpful message pointing to settings
- Add `investmentConfig` Firestore doc (`main`): `projectedRoR` (0.06), `afterTaxPct` (0.82) — editable in settings
- Finnhub fetch function: single ticker + batch (deduplicated — one call per unique ticker even if same ticker is in 3 accounts)
- **Account Detail — "Update Prices" button:**
  - Fetches prices for that account's tickers only
  - Stores `lastPrice` + `lastPriceDate` on each holding doc
  - Shows spinner + "Updating..." → "Updated X min ago" on completion
  - Error state: lists any tickers that failed to fetch
- Account Detail now shows full current values: shares × lastPrice + cashBalance = account total

---

### Phase 4: Groups
*Define who's included in a portfolio view.*

- `investmentGroups` Firestore collection
- **Auto-create "Me" group** on first load of the investments section: `{ name: 'Me', personIds: ['self'], snapshotFrequencies: ['daily','weekly','monthly','yearly'] }`
- **Manage Groups** screen (accessible via gear/settings icon on the investments landing page):
  - List of saved groups
  - Create group: name + pick people from contacts + choose snapshot frequencies (checkboxes: Daily / Weekly / Monthly / Yearly)
  - Edit / Delete group (cannot delete "Me")
  - Add / Remove people from a group
- **Group switcher component**: dropdown shown at the top of Summary and Snapshots pages; hidden entirely if only one group exists

---

### Phase 5: Portfolio Summary — Core
*The main dashboard. Shows live portfolio totals for the selected group.*

- New screen: `#investments/summary`
- Group selector at top (uses Phase 4 switcher)
- **Joint account inclusion**: only included in group totals when ALL parties of the joint are in the selected group
- **Two top-line numbers:**
  - Net Worth = Σ all holdings values + all cashBalances across group
  - Invested = Net Worth − total investable cash (cashBalance on investment accounts only)
- **"If I retired today" widget:**
  - Est. annual income: Net Worth × `projectedRoR`
  - Est. monthly after-tax: (annual ÷ 12) × `afterTaxPct`
  - SS placeholder row (wired in Phase 2 feature set)
- **Category breakdown table:** Roth | PreTax | Brokerage | Cash | Inv Cash → current value + % of Net Worth
- **Period performance rows:** Day / Week / Month / YTD — shows "—" until snapshots exist (wired in Phase 7)
- **ATH row:** shows "—" until first snapshot captured (wired in Phase 7)
- **Per-account section:** grouped Steve | Joint | Connie — each account shows current value and day change (shows "—" until snapshot)
- **"Update Prices" button:** fetches ALL unique tickers across ALL accounts in ALL groups (deduplicated), stores to Firestore, refreshes summary — spinner + timestamp feedback
- **Responsive layout:** desktop = wide category table + account columns; mobile = stacked cards

---

### Phase 6: Historical Snapshots
*Manually capture and view portfolio values over time.*

- New screen: `#investments/snapshots`
- **Capture Snapshot button:**
  - Type picker: only shows frequencies configured for the current group
  - On confirm: computes current Net Worth, Invested, perAccount values, perCategory values → saves to `investmentSnapshots`
  - ATH check: if Net Worth > stored ATH for that snapshot type, update `investmentConfig` ATH record (value + date)
- **Snapshot list:** grouped by type (Yearly / Monthly / Weekly / Daily), most recent first
  - Each row: date, Net Worth, Invested total
- **Snapshot detail view:** tap any snapshot → full breakdown at that moment (per-account + per-category)

---

### Phase 7: Summary — Period Performance + ATH
*Wire snapshots into the Summary page to complete the dashboard.*

- "Begin Day" baseline = most recent Daily snapshot for the group
- "Begin Week" = most recent Weekly snapshot
- "Begin Month" = most recent Monthly snapshot
- "Begin Year" = most recent Yearly snapshot
- Compute and display Gain/Loss $ and % for each period on the Summary page
- Display ATH on Summary: separate row for daily/weekly/monthly high watermark (value + date)
- Summary page is now fully functional end-to-end

---

### Phase 8: Stock Rollup
*Cross-account concentration analysis.*

- New screen: `#investments/stocks`
- Aggregates all unique tickers across ALL accounts (all persons, all groups)
- Table — one row per unique ticker:
  - Company name, ticker symbol
  - Total shares (summed across all accounts holding that ticker)
  - Last price
  - Current total value
  - Previous value (from most recent snapshot's perAccount data, back-calculated)
  - $ change + % change
  - % of total Invested (concentration) — highlight >10% yellow, >15% red
- Sort options: by current value (default) | by % change | by ticker
- Tap a row → expands to show which accounts hold that ticker and how many shares each

---

### Phase 9: Investments Landing Hub
*The glue screen — fills in the skeleton created in Phase 1.*

- Fills in `#investments` with the full landing page
- **Group selector** (if multiple groups)
- **Top stats card:** Net Worth, Invested, Day Gain/Loss $ and %
- **Quick-stat row:** Week | Month | YTD gain/loss
- **ATH callout:** "All-time high: $X on [date]"
- **Navigation cards:** Accounts | Summary | Stock Rollup | Snapshots | Retirement Planner *(coming soon)* | Retirement Projection *(coming soon)*

---

## Resolved Decisions

| Question | Decision |
|----------|----------|
| Stock price API | Finnhub (free, official, 60 calls/min, requires free API key) |
| Price refresh | Manual "Update Prices" button; "Capture Daily Snapshot" each morning before market |
| HSA | Has stock holdings — treated like a brokerage (Roth category for tax grouping) |
| Savings accounts | Manual cash balance update, no holdings |
| 401k holdings | FXAIX (Steve), RDFTX (Connie) — mutual fund tickers, Finnhub supports them |
| Historical RetProj | Enter data back to 2008 — multi-row table editor (not modal-per-row) |
| Named scenarios | Yes — name + retirement age, SS claiming age, projected needed $, % return, % inflation, lifestyle % |
| Existing accounts | 2 savings accounts safe; existing Firestore collection/path unchanged |
| Joint accounts | Only appear in a group's summary when ALL joint parties are in that group |
| Cash vs Inv Cash | Cash = bank accounts (spendable); Inv Cash = uninvested cash inside investment accounts |
| All screens under | Investments card only |
| Groups | Saved named groups; "Me" auto-created; switcher hidden if only one group exists |
| Snapshot frequency | Per group — household captures Daily/Weekly/Monthly/Yearly; kids' groups Yearly only |
| Cost basis | Not tracked — current value only |
| Snapshots | Fully manual — user's responsibility to capture |
| 529 accounts | No 529s in use; account type supported but excluded from tax category groupings |
| Update Prices location | Account Detail (that account only) + Summary page (all accounts) |
| Update Prices feedback | Spinner + "Updating..." → "Updated X min ago" on completion |
| Joint account storage | Stored under 'self'; appear in both owners' lists via second query on primaryContactId |

## Still to Discuss

- **Drawdown section:** Auto-calculated year-by-year table with per-row overrides, saveable as named scenarios. Design TBD — revisit after Phase 1 is working.

---

## Resolved Decisions — SS Benefits (Screen 6.5)

| Question | Decision |
|----------|----------|
| Hub card placement | Own card on Financial hub + "Manage SS Benefits →" link inside the Retirement Planner |
| Who can be tracked | Any person tracked in the app ("self" + any contact) |
| As-of date default | Today's date (the day the snapshot is taken) |
| Combined SS in planner | Only people in the active investment Group |
| Editing the current snapshot | Allowed freely — no warning needed. Two explicit actions: "Create New Snapshot" vs "Update Current Snapshot" |
| Age range | Dropdown covers 62–70 (whole numbers, SSA's full range). User picks whichever ages they want per snapshot. |
| Create New Snapshot pre-fill | Pre-fills both ages AND amounts from the previous snapshot. User updates changed amounts, deletes unwanted rows. Starts blank if no prior snapshot exists. |

## Open Questions — SS Benefits (Screen 6.5)

*(none — all decisions resolved. Ready to build.)*
