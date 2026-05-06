# Ask LLM — Investment Analysis Feature Plan

## Overview

Add an "Ask AI" button to the investments hub and summary pages. Clicking it navigates to a dedicated AI Analysis page that assembles a structured JSON snapshot of the user's financial picture, sends it to an LLM for a plain-English analysis, and displays the result. The user can also type a specific follow-up question. The last analysis is cached in Firestore so it can be re-read without re-running.

---

## Status: Planning / Discussion

---

## Decisions Made

| # | Decision |
|---|----------|
| 1 | Send holdings per account **and** a group-level rollup |
| 2 | Send budget **category totals** only (not line items) |
| 3 | Always run a full analysis **plus** an optional specific question the user can type |
| 4 | "Ask AI" button appears on **both** the hub page and the summary page |
| 5 | Response displays on a **dedicated AI Analysis page** with a Back button |
| 6 | Cache the last result in Firestore; provide a way to view the last response |

---

## What Gets Sent to the LLM

### Accounts & Holdings

Send **both** a group-level rollup and per-account detail:
- **Rollup** — total by category (Roth, Pre-Tax, Brokerage, Cash, Investment Cash) and top holdings by ticker across all accounts
- **Per-account** — account name, type, owner, cash balance, and holdings list

**Fields to include per account:**
- `nickname`, `accountType`, `ownerType`, `cashBalance`
- Holdings: `ticker`, `companyName`, `shares`, `lastPrice`, computed `value`

**Fields to omit (sensitive / unnecessary):**
- Account numbers, encrypted credentials, institution URL, login notes, last4, beneficiary

---

### Social Security

- All SS breakpoints per person (not just the retirement-age one — all of 62, 67, 70, etc.)
- Person's display label (not raw Firestore contact ID)

---

### Ages & Retirement Config

- Current age, configured retirement age, and years-to-retirement per person
- `projectedRoR` and `afterTaxPct` from `investmentConfig` so the LLM uses the same assumptions as the app

---

### Budgets

- All non-archived budgets by name, monthly total, annual total
- Category-level breakdown per budget (Housing, Food, Transport, etc.)
- Flag which one is the default/current-lifestyle budget

---

### What We Do NOT Send

- All-time highs
- Historical snapshots
- Encrypted fields (account numbers, usernames, passwords)
- Photo data
- Institution login URLs / notes

---

## Payload Structure (Draft JSON Schema)

```json
{
  "asOfDate": "2026-05-06",
  "group": {
    "name": "Me & Jane",
    "members": [
      { "label": "Me", "currentAge": 52, "retirementAge": 67, "yearsToRetirement": 15 },
      { "label": "Jane", "currentAge": 50, "retirementAge": 65, "yearsToRetirement": 15 }
    ]
  },
  "socialSecurity": [
    {
      "person": "Me",
      "benefits": [
        { "claimAge": 62, "monthly": 2100 },
        { "claimAge": 67, "monthly": 2900 },
        { "claimAge": 70, "monthly": 3600 }
      ]
    },
    {
      "person": "Jane",
      "benefits": [
        { "claimAge": 62, "monthly": 1400 },
        { "claimAge": 67, "monthly": 1950 },
        { "claimAge": 70, "monthly": 2400 }
      ]
    }
  ],
  "portfolioSummary": {
    "totalValue": 850000,
    "byCategory": {
      "roth": 220000,
      "preTax": 310000,
      "brokerage": 180000,
      "cash": 90000,
      "investmentCash": 50000
    },
    "topHoldingsByValue": [
      { "ticker": "FXAIX", "totalValue": 210000, "pctOfPortfolio": 24.7 },
      { "ticker": "VTI", "totalValue": 130000, "pctOfPortfolio": 15.3 }
    ]
  },
  "accounts": [
    {
      "name": "My Roth IRA",
      "type": "Roth IRA",
      "owner": "Me",
      "cashBalance": 1200,
      "holdings": [
        { "ticker": "FXAIX", "companyName": "Fidelity 500 Index", "shares": 42.5, "lastPrice": 195.00, "value": 8287.50 }
      ]
    }
  ],
  "budgets": [
    {
      "name": "Current Lifestyle",
      "monthlyTotal": 6800,
      "annualTotal": 81600,
      "isDefault": true,
      "categories": [
        { "name": "Housing", "monthly": 2200 },
        { "name": "Food", "monthly": 900 }
      ]
    },
    {
      "name": "Minimum Retirement",
      "monthlyTotal": 4200,
      "annualTotal": 50400,
      "isDefault": false,
      "categories": [
        { "name": "Housing", "monthly": 1800 },
        { "name": "Food", "monthly": 700 }
      ]
    }
  ],
  "investmentConfig": {
    "projectedRoR": 0.06,
    "afterTaxPct": 0.82
  }
}
```

---

## Prompt Design

### Call 1 — Full Analysis

**System prompt** (sent once, defines tone and structure):

> You are a personal financial analysis assistant. The user will provide a JSON snapshot of their household financial picture. Your job is to analyze that data and produce a clear, honest, plain-English assessment — written like a knowledgeable friend who happens to understand retirement planning, not like a formal financial advisor.
>
> Be direct. If something looks good, say so. If something looks concerning, say that too. Do not hedge every sentence with disclaimers. One brief disclaimer at the very end of your response is sufficient.
>
> Use dollar amounts, percentages, and ages from the data — show your math in plain terms when it adds clarity. Use the `projectedRoR` value from the JSON as the expected annual return — do not substitute the 4% rule or any other default. Do not make up numbers that aren't in the data.
>
> Structure your response exactly as follows:
>
> **Summary**
> Two to four sentences. The big picture — are they in good shape, behind, or somewhere in between? What's the most important thing to know?
>
> ---
>
> **1. Retirement Readiness**
> Using the configured return rate and after-tax percentage from the JSON, project whether the portfolio is on track to support retirement at each person's configured retirement age. Work through the math briefly: what will the portfolio likely be worth at retirement, what does the configured withdrawal rate generate annually, and how does that compare to their budget scenarios? Call out if the math works or doesn't, and at what budget level.
>
> **2. Budget Gap Analysis**
> For each budget listed, calculate the projected income gap or surplus at retirement. Income sources: Social Security (at each person's configured retirement age) plus portfolio withdrawals using the configured RoR. Show the gap per budget scenario so they can see which lifestyle is feasible and which isn't.
>
> **3. Social Security Strategy**
> Look at the SS breakpoints for each person. Does waiting from 62 to 67 or 67 to 70 make a meaningful difference given their ages and portfolio size? Flag if early claiming is a reasonable hedge or if delayed claiming is clearly better given the data.
>
> **4. Portfolio Composition**
> Comment on the Roth vs. Pre-Tax vs. Brokerage vs. Cash split. Is the mix appropriate for their age and timeline? Are there obvious tax diversification gaps (e.g., heavily pre-tax with no Roth, meaning all withdrawals will be taxed)?
>
> **5. Concentration Risk**
> Look at the holdings rollup. Is a large percentage of the portfolio in a single ticker or a small number of tickers? Flag any position that represents more than ~15–20% of total portfolio value. Also note if accounts are overly concentrated in one person's name.
>
> **6. Cash Position**
> How much of the portfolio is in cash or investment cash (pending deployment)? Is that appropriate as a buffer, or does it look excessive relative to their spending and portfolio size?
>
> **7. Key Observations**
> Anything else worth flagging that doesn't fit neatly in the above sections. Skip this section if nothing stands out.
>
> ---
>
> *Brief disclaimer: This is an automated analysis based on the data provided. It is not professional financial advice. Consult a licensed advisor for decisions with significant consequences.*

**User message** (the actual call):

> Here is my financial data:
> ```json
> [JSON payload]
> ```
> [If user typed a specific question, append:]
> In addition to your general analysis, please specifically address: [user's question]

---

### Call 2 — Follow-Up Question

When the user asks a follow-up question after reading the analysis, a **separate LLM call** is made. No new analysis is generated — just an answer to the question.

**System prompt:**

> You are a personal financial analysis assistant. You previously analyzed a household's financial data and produced a written analysis. The user now has a follow-up question. Answer their question directly and concisely, drawing on both the financial data and your prior analysis. Do not repeat or re-summarize the full analysis. One brief disclaimer at the end if needed.

**User message:**

> Here is my financial data:
> ```json
> [same JSON payload]
> ```
>
> Here is the analysis you previously provided:
> [full prior analysis text]
>
> My follow-up question: [user's follow-up question]

---

### Notes on Prompt Design

- `projectedRoR` is used explicitly — the 4% rule is intentionally excluded since research supports higher sustainable withdrawal rates and the user has their own expectation (currently 6%)
- Follow-up calls send the JSON again so the LLM has full context without relying on conversation memory (stateless API calls)
- The prior analysis is re-sent verbatim so the follow-up response can reference specific points from it
- Follow-up responses are NOT cached — only the full analysis is cached per group

### User Question (initial, optional — appended to Call 1)

If the user types a specific question before running the analysis, it is appended to the Call 1 user message. If blank, only the standard full analysis is requested.

---

## UI Plan

### "Ask AI" Entry Points

- Button on the **investments hub page** (near the Retire Estimate accordion or as a standalone card)
- Button on the **investments summary page** (similar placement)
- Both buttons navigate to `#investments/ai-analysis`

### AI Analysis Page (`#investments/ai-analysis`)

**Header:**
- Back button (returns to wherever the user came from — hub or summary)
- Title: "AI Investment Analysis"
- Group name shown (so it's clear which group is being analyzed)

**Initial question input (shown before / instead of a cached result):**
- Optional text area: "Ask a specific question (optional)"
- Placeholder: e.g., "Should I move more into Roth? Am I on track to retire at 65?"
- "Ask AI" button — runs Call 1 (full analysis)

**Analysis result area:**
- Shows cached result on load if one exists, with "as of [date/time]" label and a "Re-run" button
- Rendered as formatted markdown
- "Copy" button for the full text

**Follow-up section (shown below the analysis result, once a result exists):**
- Text area: "Ask a follow-up question"
- "Ask" button — runs Call 2 (follow-up only, no re-analysis)
- Follow-up response rendered below in a visually distinct block (e.g., slightly different background)
- Follow-up response is NOT cached — disappears if the user navigates away or re-runs the analysis

**States:**
- Empty (no cache): show the question input + "Ask AI" button, prompt user to run their first analysis
- Loading (Call 1): spinner + "Analyzing your portfolio..."
- Loading (Call 2): spinner + "Thinking..."
- Result: rendered markdown analysis + follow-up section
- Error: friendly error message with retry option

---

## Caching

- Cache stored **per group** in Firestore: `userCol('investmentConfig').doc('aiAnalysis_{groupId}')`
- One doc per group — switching groups on the investments page shows that group's last analysis
- Fields stored per doc:
  - `responseText` — the full LLM markdown response
  - `question` — the specific question asked (or empty string)
  - `groupId` — which group was analyzed
  - `groupName` — display name of the group (for the header)
  - `asOfDate` — date the data was pulled (YYYY-MM-DD)
  - `runAt` — server timestamp of when the LLM was called
- On page load, the cached doc for the **current group** is fetched and displayed immediately if it exists
- After a fresh run, that group's cache doc is overwritten with the new result

**Viewing the last result:**
- The AI Analysis page loads the current group's cached result automatically
- No separate "view last" screen needed — the page itself is the viewer
- The "as of" timestamp and a "Re-run" button make it clear whether the result is fresh
- Switching groups (via the group selector elsewhere) and returning to this page shows that group's cached result

---

## Decisions Made (continued)

| # | Decision |
|---|----------|
| 7 | All 7 analysis sections are in — brief summary at top, then detailed sections below |
| 8 | Always analyze the **currently-selected group** — switch groups to get a different analysis |
| 9 | "Ask AI" button lives **near the Retire Estimate accordion** on hub and summary pages |
| 10 | Cache is **per group** — each group has its own stored last-analysis result |
| 11 | No cost warning before re-run — just run it |

## Open Questions / Decisions Needed

None at this time. Ready to implement.

---

## Implementation Notes (Future)

- New route: `#investments/ai-analysis` handled in `app.js`
- New section in `index.html`: `<section id="investments-ai-page">`
- New helper in `investments.js` (or a new `investments-ai.js`): `_buildInvestmentAnalysisPayload(groupId)`
- Reuse existing LLM call pattern from `secondbrain.js`
- Reuse existing markdown renderer from SecondBrain for displaying the response
- No new Firestore collections needed — cache lives in existing `investmentConfig` or `settings`

---

## What's NOT in Scope (For Now)

- Comparing analyses over time (history of past runs)
- Letting the LLM write back to Firestore (read-only)
- Per-ticker commentary
- Tax optimization advice
- Exporting or sharing the analysis
