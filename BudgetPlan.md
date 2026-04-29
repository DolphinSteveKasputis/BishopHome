# BudgetPlan.md — Budgets Feature

## Location
- Lives on the **Financial** tab (currently labeled "Investments" — rename the card label to "Financial")
- New **Budgets** card on that tab — tapping it goes directly to the **default budget page**

---

## Core Concept

Multiple named budgets representing different lifestyle or life stage scenarios. One is always the **default** — that's what loads 95% of the time. Navigation between budgets is via a dropdown at the top of the budget page.

### Budget Types (examples)
- Maximum Lifestyle
- Regular Lifestyle *(default)*
- Minimal Lifestyle
- Retirement Max
- Retirement Min
- *(user-defined — any name)*

---

## Budget Landing Page

- **Opens directly to the default budget** — no list screen
- If no default exists (all budgets deleted), shows an empty state with a **"Create Your First Budget"** prompt
- **Budget selector dropdown** at the top of the page:
  - Lists all non-archived budgets by name
  - Default budget shown first (labeled "Default Budget")
  - Includes an **"+ Add New Budget"** option at the bottom of the dropdown
- Switching dropdown selection navigates to that budget's page
- Archived budgets accessible via a separate **"View Archives"** button

---

## Budget Naming
- On **"+ Add New Budget"**: name-first dialog appears — user must enter a name before proceeding
- Name **cannot be blank** at any point (validated on save)
- Budget **can be renamed** after creation
- Name must remain non-blank on save

---

## Default Budget
- **First budget created** is automatically flagged as default
- Default stored in `userCol('settings')` doc as `defaultBudgetId`
- Default budget displays a **"Default Budget"** label — no "Use as Default" button
- All other budgets show a **"Use as Default"** button
- Cannot archive the current default — must reassign default first (app prompts)
- **If the last budget is deleted**, `defaultBudgetId` is cleared — no default until a new budget is created

---

## Copy Budget
- After naming a new budget, a **"Copy From"** option is offered (skippable)
- Selecting it shows existing budgets to copy from
- Copies: all categories, all line items, and all income items — fully independent

---

## Page Layout

```
[ Budget Name ]  [ Dropdown selector ▼ ]   [ View Archives ]

[ Category: Household         $2,100 ]
  Mortgage              $2,000    due 1st   ✎ 🗑
  Internet              $100      due 15th  ✎ 🗑
  [ + Add Item ]

[ Category: Vehicles          $650  ]
  ...

[ + Add Category ]

─────────────────────────────────────
[ Income                              ]
  Monthly Take-Home     $6,500        ✎ 🗑
  [ + Add Income Line ]
  Total Income: $6,500
─────────────────────────────────────

[ Summary                             ]
  Household             $2,100
  Vehicles              $650
  Total Expenses:       $2,750
  Total Income:         $6,500
  Leftover:             $3,750  ← green / red

─────────────────────────────────────
[ Save ]  [ Discard Changes ]
[ Use as Default ]  [ Archive ]  [ Delete ]
```

- Summary scrolls with the page (not sticky)
- Categories with **$0 subtotal are hidden from the summary** (but still visible on the page for editing)

---

## Save / Discard Model

All edits are **held in memory** until the user explicitly clicks **Save**. Nothing is written to Firestore until Save is clicked.

- **Save button**: commits all pending changes to Firestore
- **Discard Changes button**: reverts all unsaved edits back to the last saved state
  - If meaningful changes have been made, show a confirmation: *"Discard all unsaved changes?"*
  - If nothing has changed, Discard is either hidden or a no-op
- **Navigating away with unsaved changes**: warn the user — *"You have unsaved changes. Save or discard before leaving."* with Save / Discard / Cancel options
- **Switching budgets via the dropdown with unsaved changes**: same warning — treat it identically to navigating away
- This model applies to: line items, income lines, category names, and budget name

### Why this model
User may be running "what if" scenarios — adjusting numbers to see how leftover changes — without intending to commit those numbers. Save is an intentional action.

---

## Inline Editing (line items & income lines)

- Tapping **"Add Item"** appends a new inline row with fields open: **Name | Amount | Due Day**
- Tapping an existing row expands it inline for editing: **Name | Amount | Due Day**
- Income rows: **Name | Amount** (no due day)
- Changes are held in local state — not saved until **Save** is clicked
- **Drag-to-reorder** within a category (also held until Save)

---

## Expense Categories

### Adding a Category
- Tap **"Add Category"** button
- Quick-pick chips: **Household, Vehicles, Loans, Other, Personal**
- Or type a custom name
- Category appears at bottom of list (add-order)
- Drag-to-reorder if straightforward to implement; otherwise add-order is fine

### Category Display
- Category name as section header with subtotal
- Line items listed below, inline-editable
- **"Add Item"** button at bottom of each category
- Delete category button — confirmation required: *"Delete [Category Name] and all its items? This cannot be undone."*

---

## Income Section (always at bottom)
- Section header: **"Income"** — always visible even when empty
- Inline row pattern: **Name | Amount**
- Drag-to-reorder
- **Total Income** shown at bottom of section

---

## Summary Section (below income, scrolls with page)
- Shows only categories with subtotal > $0
- Total Expenses, Total Income, Leftover
- Leftover: **green** if positive, **red** if negative

---

## Budget Actions
- **Use as Default** — non-default budgets only
- **Archive** — soft confirmation: *"Archive this budget? It will be removed from your active list but can be restored anytime."* Blocked if current default.
- **Delete** — hard confirmation: *"Delete [Budget Name]? This cannot be undone."* Allowed even on last budget.

---

## Archive Feature
- Archived budgets are **inactive but fully editable**
- Do **not** appear in the dropdown selector
- **"View Archives"** button opens an archived budgets list
- From archives: **Unarchive** (restores to dropdown) or **Delete**

---

## Pre-Populated Category Quick-Picks
Household, Vehicles, Loans, Other, Personal
*(User can type a custom name — no additions planned)*

---

## Data Model (Firestore)

### `userCol('settings')` doc
| Field | Type | Notes |
|---|---|---|
| defaultBudgetId | string | ID of the current default; absent if no budgets exist |

### Collection: `budgets`
| Field | Type | Notes |
|---|---|---|
| name | string | Budget name — never blank |
| isArchived | boolean | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Subcollection: `budgets/{id}/incomeItems`
| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Monthly Take-Home" |
| amount | number | Whole dollars |
| sortOrder | number | Drag-to-reorder |

### Subcollection: `budgets/{id}/categories`
| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Household", custom |
| sortOrder | number | Add-order (drag if easy) |

### Subcollection: `budgets/{id}/lineItems`
| Field | Type | Notes |
|---|---|---|
| categoryId | string | FK → categories subcollection |
| name | string | e.g., "Mortgage" |
| amount | number | Whole dollars |
| estDueDay | number | 1–31, optional |
| sortOrder | number | Drag-to-reorder within category |

---

## Build Checklist (track progress here — resume from first unchecked item)

### Step 1 — Rename tile & add hub card
- [ ] Rename landing tile label "Investments" → "Financial" in index.html (line ~6783)
- [ ] Update `loadInvestmentsPage()` breadcrumb "Investments" → "Financial" in investments.js (line ~98)
- [ ] Add Budgets nav card to `_investHubNavCards()` in investments.js (after line ~289)

### Step 2 — Routing (app.js)
- [ ] Add `'budget'` and `'budget-detail'` to `allPages` array
- [ ] Add `#budget` and `#budget/archive` route handlers calling `loadBudgetPage()` / `loadBudgetArchivePage()`

### Step 3 — HTML pages (index.html)
- [ ] Add `<section id="page-budget">` (main budget/landing page)
- [ ] Add `<section id="page-budget-archive">` (archive list page)
- [ ] Add `<script src="js/budgets.js?v=652">` tag

### Step 4 — Create js/budgets.js
- [ ] State vars: `_budgetList`, `_budgetDraft`, `_budgetOriginalIds`, `_budgetDirty`
- [ ] `loadBudgetPage()` — entry point, loads default budget or empty state
- [ ] `_budgetLoadData(budgetId)` — load budget + all 3 subcollections into draft
- [ ] `_budgetRender()` — renders full page: dropdown, categories, income, summary, actions
- [ ] `_budgetRenderDropdown()` — budget selector with "+ Add New"
- [ ] `_budgetRenderCategories()` — expense categories with inline input rows
- [ ] `_budgetRenderIncome()` — income section with inline input rows
- [ ] `_budgetRenderSummary()` — recalculates and displays totals
- [ ] `_budgetRecalc()` — recalculates subtotals + leftover, called on every field change
- [ ] `_budgetSave()` — batch write draft to Firestore, clear dirty flag
- [ ] `_budgetDiscard()` — reload from Firestore, clear dirty flag
- [ ] `_budgetCheckUnsaved(callback)` — if dirty, show warning dialog; else call callback
- [ ] `_budgetCreateNew()` — name dialog → copy-from option → create in Firestore → load
- [ ] `_budgetRename()` — inline rename, validate non-blank
- [ ] `_budgetSetDefault(budgetId)` — update settings doc, re-render
- [ ] `_budgetArchive(budgetId)` — soft confirm, set isArchived=true, redirect
- [ ] `_budgetDelete(budgetId)` — hard confirm, delete doc + subcollections, redirect
- [ ] `_budgetAddCategory()` — quick-pick chips or custom name, add to draft
- [ ] `_budgetDeleteCategory(localId)` — confirm (includes items), remove from draft
- [ ] `_budgetAddLineItem(catLocalId)` — append empty row to draft category
- [ ] `_budgetItemChanged(localId, field, value)` — update draft item, recalc
- [ ] `_budgetDeleteLineItem(localId)` — remove from draft, recalc
- [ ] `_budgetAddIncomeItem()` — append empty income row to draft
- [ ] `_budgetIncomeChanged(localId, field, value)` — update draft, recalc
- [ ] `_budgetDeleteIncomeItem(localId)` — remove from draft, recalc
- [ ] Drag-to-reorder line items within category (HTML5 drag-and-drop, updates sortOrder in draft)
- [ ] `loadBudgetArchivePage()` — list archived budgets with unarchive/delete actions

### Step 5 — CSS (styles.css)
- [ ] Budget page layout styles
- [ ] Dropdown selector styles
- [ ] Category section + header styles
- [ ] Inline item row styles (name/amount/due day inputs)
- [ ] Income section styles
- [ ] Summary section styles (green/red leftover)
- [ ] Action buttons row styles
- [ ] Empty state styles

### Step 6 — Pre-commit checklist
- [ ] Update `MyLife-Functional-Spec.md` (add Budgets section)
- [ ] Update `AppHelp.md` (add `## screen:budget` section)
- [ ] Add `budgets` to backup collections in backup script
- [ ] Bump `CACHE_NAME` in sw.js → `bishop-v187`
- [ ] Bump ALL `?v=` numbers in index.html to v=652

### Step 7 — Commit & push
- [ ] `git add` all changed files
- [ ] `git commit`
- [ ] notify + `git push`

---

## Out of Scope for Phase 1
- One-time / annual items → Phase 2
- Budget comparison → likely never
- Calendar integration from due days → FutureEnhancements.md
