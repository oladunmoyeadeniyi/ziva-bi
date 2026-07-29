# PRD — Q1b: Cash Flow Statement (Indirect Method)

**Status:** In development  
**Mode scope:** Full ERP only  
**Migration:** `c1d2e3f4g5h6` (down_revision: `b0c1d2e3f4g5`)  
**Milestone:** Q1b  

---

## 1. Overview

Add an **indirect method Cash Flow Statement** (Statement of Cash Flows) as the third financial statement alongside the already-shipped P&L (Q1a) and Balance Sheet (Q1a).

The indirect method starts with **net profit/loss from the P&L** and works backwards to net cash movement by:
1. Adding back non-cash charges (e.g., depreciation)
2. Adjusting for working capital movements (changes in AR, AP, inventory, prepayments)
3. Showing investing cash flows (capex, disposals)
4. Showing financing cash flows (loan draws/repayments, equity, dividends)

The result: **Net change in cash = Operating + Investing + Financing**, reconciling to the opening and closing cash balances derived from the GL.

---

## 2. Why Indirect Method

- More common in practice than direct method
- Uses existing double-entry data (no separate cash receipt/payment tracking required)
- Standard in IFRS (IAS 7) and GAAP
- The existing P&L and BS data already provides everything needed — no new transaction data

---

## 3. Data Model Changes

### 3.1 Two new nullable columns on `chart_of_accounts`

| Column | Type | Description |
|---|---|---|
| `cf_category` | VARCHAR(20) NULL | `'operating'`, `'investing'`, `'financing'`, `'cash'`, or NULL |
| `cf_sub_category` | VARCHAR(100) NULL | Free-text grouping label within the section |

**`cf_category` meanings:**

| Value | Account type | What it means |
|---|---|---|
| `'cash'` | BS | Cash and cash equivalents — used to compute opening/closing balances |
| `'operating'` | BS | Working capital account — delta (closing − opening) shown in operating section |
| `'operating'` | PL | Non-cash P&L item (e.g., depreciation) — period activity shown in operating section as add-back |
| `'investing'` | BS | Long-term asset or investment account — delta shown in investing section |
| `'investing'` | PL | P&L gain/loss on investing activities (e.g., profit on disposal) |
| `'financing'` | BS | Debt, equity, or dividend account — delta shown in financing section |
| `'financing'` | PL | Interest expense treated as financing (optional; IAS 7 allows operating or financing) |
| NULL | Any | Not mapped — excluded from cash flow. Warning banner shown if unmapped BS accounts exist. |

**`cf_sub_category` examples:**

| cf_category | cf_sub_category examples |
|---|---|
| `'operating'` (PL) | `"Non-cash adjustments"`, `"Depreciation & amortisation"` |
| `'operating'` (BS) | `"Working capital changes"`, `"Trade receivables"`, `"Trade payables"` |
| `'investing'` | `"Capital expenditure"`, `"Disposal proceeds"`, `"Investments"` |
| `'financing'` | `"Loan proceeds"`, `"Loan repayments"`, `"Equity"`, `"Dividends"` |

`cf_sub_category` drives the group label within each section. Accounts without a `cf_sub_category` are grouped under `"Other"`.

### 3.2 No new tables

The two columns on `chart_of_accounts` are the only schema change.

---

## 4. Computation Logic (Indirect Method)

```
A. OPERATING ACTIVITIES
   Net Profit / (Loss)                   ← profit_and_loss(date_from, date_to).net_income
   
   Adjustments for non-cash items:
     [PL accounts with cf_category='operating', grouped by cf_sub_category]
     adjustment = -(period_amount)        ← period_amount = Σ(credit − debit) for period
     e.g. Depreciation (debit expense): amount < 0 → adjustment > 0 (add back)
   
   Changes in working capital:
     [BS accounts with cf_category='operating', grouped by cf_sub_category]
     movement = closing_balance − opening_balance
     closing_balance = Σ(credit − debit) up to date_to
     opening_balance = Σ(credit − debit) up to date_from − 1 day
     e.g. AR increase (asset grew): amount more negative → movement < 0 (cash out)
     e.g. AP increase (liability grew): amount more positive → movement > 0 (cash in)
   
   NET CASH FROM OPERATING ACTIVITIES = net_income + Σ(adjustments) + Σ(wc_movements)

B. INVESTING ACTIVITIES
   [BS accounts with cf_category='investing']
   movement = closing_balance − opening_balance
   [PL accounts with cf_category='investing']
   adjustment = -(period_amount)
   
   NET CASH USED IN INVESTING ACTIVITIES = Σ(investing movements + adjustments)

C. FINANCING ACTIVITIES
   [BS accounts with cf_category='financing']
   movement = closing_balance − opening_balance
   [PL accounts with cf_category='financing']
   adjustment = -(period_amount)
   
   NET CASH FROM FINANCING ACTIVITIES = Σ(financing movements + adjustments)

D. NET CHANGE IN CASH = A + B + C
   Opening cash = -Σ(credit−debit for cf_category='cash' accounts, cumulative to date_from − 1 day)
   Closing cash = opening_cash + net_change_in_cash
   
   Validation: -Σ(credit−debit for cf_category='cash' accounts, cumulative to date_to) should ≈ closing_cash
```

**Sign convention note:** Cash accounts are debit-normal. Their `credit - debit` is typically negative for positive cash balances. We negate to display as a positive cash figure.

---

## 5. API

### `GET /api/gl/financial-statements/cf`

**Query params:**
- `date_from` (date, optional) — period start (defaults to beginning of tenant history)
- `date_to` (date, optional) — period end (defaults to today)

**Mode guard:** Full ERP only (same as P&L and BS). Returns 403 for Lite/Connected.

**Response: `CFResponse`**

```json
{
  "sections": [
    {
      "label": "Operating Activities",
      "groups": [
        {
          "label": "Non-cash adjustments",
          "items": [
            { "gl_number": "6400", "gl_name": "Depreciation", "amount": 2500000.00 }
          ],
          "subtotal": 2500000.00
        },
        {
          "label": "Working capital changes",
          "items": [
            { "gl_number": "1100", "gl_name": "Trade Receivables", "amount": -500000.00 }
          ],
          "subtotal": -500000.00
        }
      ],
      "net_income": 8000000.00,
      "total": 10000000.00
    },
    { "label": "Investing Activities", "groups": [...], "net_income": null, "total": -3000000.00 },
    { "label": "Financing Activities", "groups": [...], "net_income": null, "total": 1000000.00 }
  ],
  "net_income": 8000000.00,
  "net_change_in_cash": 8000000.00,
  "opening_cash": 5000000.00,
  "closing_cash": 13000000.00,
  "has_unmapped": false,
  "has_untagged_bs": true,
  "date_from": "2026-01-01",
  "date_to": "2026-06-30"
}
```

`has_untagged_bs` — True if any BS account has no `cf_category` and has posted activity. Displayed as a warning banner on the frontend.

---

## 6. Frontend

### 6.1 Financial Statements page — new "Cash Flow" tab

Location: `/dashboard/business/accounting/financial-statements`  
Change: Add a third tab alongside "Profit & Loss" and "Balance Sheet".

**Layout:**
```
[Profit & Loss]  [Balance Sheet]  [Cash Flow]   ← tabs

Period from: [date]  To: [date]   [Run]

┌─────────────────────────────────────────────────┐
│ Net Profit / (Loss)                  ₦8,000,000 │
└─────────────────────────────────────────────────┘

OPERATING ACTIVITIES
  Non-cash adjustments
    6400 Depreciation & Amortisation   ₦2,500,000
    ──────────────────────────────────────────────
    Subtotal                           ₦2,500,000
  Working capital changes
    1100 Trade Receivables            (₦500,000)
    2100 Trade Payables               ₦300,000
    ──────────────────────────────────────────────
    Subtotal                          (₦200,000)
═══════════════════════════════════════════════════
Net cash from operating activities   ₦10,300,000

INVESTING ACTIVITIES
  Capital expenditure
    1500 Property, Plant & Equipment (₦3,000,000)
═══════════════════════════════════════════════════
Net cash used in investing activities (₦3,000,000)

FINANCING ACTIVITIES  
  Loan repayments
    3100 Bank Loan                   (₦1,000,000)
═══════════════════════════════════════════════════
Net cash used in financing activities (₦1,000,000)

═══════════════════════════════════════════════════
NET CHANGE IN CASH                   ₦6,300,000
Opening cash balance                 ₦5,000,000
CLOSING CASH BALANCE                ₦11,300,000
```

**Negative amounts:** displayed with parentheses `(₦500,000)` — standard accounting presentation.

### 6.2 CoA edit modal — two new fields

Add to the existing edit modal on `/dashboard/business/settings/chart-of-accounts`:
- **Cash Flow Category** dropdown: (none), Operating, Investing, Financing, Cash & Equivalents
- **Cash Flow Sub-Category** text input: free text (e.g., "Non-cash adjustments", "Working capital changes")

These fields are only relevant when `posting_mode = 'full_erp'`. Show with a note: "Used for Cash Flow Statement. Full ERP only."

---

## 7. Warning Banners

| Condition | Banner |
|---|---|
| `has_untagged_bs = true` | "Some balance sheet accounts are not mapped to a cash flow category. The statement may be incomplete. Map accounts via Settings → Chart of Accounts." |
| `has_unmapped = true` | "Some accounts could not be classified. Review your Chart of Accounts CF mapping." |
| Sections sum ≠ net_change_in_cash | (back-end validation flag; display if mismatch > ₦1) "Cash flow statement does not reconcile. Check for unmapped GL accounts." |

---

## 8. Acceptance Criteria

- [ ] Migration `c1d2e3f4g5h6` adds `cf_category`, `cf_sub_category` nullable columns on `chart_of_accounts`
- [ ] `GET /api/gl/financial-statements/cf` returns correct indirect method statement
- [ ] Net change in cash = sum of the three section totals
- [ ] Opening + net change = closing cash (within ₦1 rounding tolerance)
- [ ] Negative amounts display with parentheses on frontend
- [ ] Warning banner shown when `has_untagged_bs = true`
- [ ] Cash Flow tab only accessible in Full ERP mode (`ModeNotAvailable` for Lite/Connected)
- [ ] CoA edit modal includes `cf_category` and `cf_sub_category` fields
- [ ] `cf_category` and `cf_sub_category` are saved and returned via the existing CoA PATCH endpoint

---

## 9. Out of Scope

- Direct method cash flow (future)
- Auto-tagging accounts from templates (future — default CoA templates could pre-populate cf_category)
- Budgeted vs actual cash flow (requires M16 Budget module)
- Cash flow forecasting (M20 AI Engine)
