# Default-CoA Feature — Architecture Decisions + Draft Templates (FOR REVIEW)

**Status:** Draft for Adeniyi's review. Nothing here is built. Once approved/edited,
this becomes the input to a CC implementation brief (`BRIEF_default_coa_feature.md`).

---

## 1. Architecture decisions (made from reading the current codebase)

These are scoping calls made using existing code patterns and ERP norms, not
things that needed a fresh decision from you. Flagged where you might want to
weigh in anyway.

1. **Industry taxonomy — reuse what exists.** `Organisation.industry` is
   already a fixed dropdown (`INDUSTRIES` constant in
   `setup/organisation/page.tsx`): FMCG/Consumer goods, Manufacturing,
   Logistics/3PL, Professional services, Healthcare, Telecommunications,
   Banking & finance, Technology, Construction & engineering, Hospitality,
   Retail, Multinational, Other. No new taxonomy needed — the default-CoA
   template matches against this same list. Industry is captured during the
   Organisation setup step, which already runs before the CoA setup step, so
   by the time a tenant reaches CoA setup their industry is known.

2. **v1 template coverage — 3 templates, not 13.** Per your call ("different
   templates based on industry"), but authoring and reviewing 13 industry
   GL structures at once isn't a one-sitting task. v1 ships:
   - **FMCG / Consumer goods** (closest to your own domain — fastest for you
     to review rigorously)
   - **Professional services** (structurally different — no inventory/COGS,
     proves the mechanism generalises)
   - **Generic / Other** — fallback for the remaining 11 industries
     (Manufacturing, Logistics/3PL, Healthcare, Telecommunications, Banking &
     finance, Technology, Construction & engineering, Hospitality, Retail,
     Multinational, Other) until industry-specific templates are authored as
     fast-follows.

   **Flag:** tell me which industry should get a dedicated template next —
   Retail and Manufacturing are the next most likely to get real signups.

3. **Storage — new tables, seeded via Alembic, no Super Admin UI in v1.**
   `coa_templates` (industry, name, description) +
   `coa_template_accounts` (template_id FK, gl_number, gl_name, account_type,
   gl_group/subgroup, fs_head/note, tb_mapping, account_classification,
   sort_order). Seeded by migration/fixture data, the same way `posting_roles`
   is seeded today — not a live CRUD screen. Building a Super Admin editor for
   this now would mean building two unbuilt milestones at once (Super Admin
   Portal backend is milestone #40, still frontend stubs). Template edits for
   v1 happen via a new migration, same as any other reference-data change.
   A real "edit templates from the Platform portal" UI is the natural fast
   -follow once #40 is tackled.

4. **Adoption mechanism — clone rows, same pattern as `_clone_coa()`, with
   strict tenant isolation by construction (your concern, addressed).**
   `tenant_clone.py`'s `_clone_coa()` was built for tenant-to-tenant cloning
   (live→test, same org) and takes an explicit source tenant + dest tenant.
   We will **not** reuse that function directly — it's the wrong shape for
   this and reusing it as-is is exactly how a leakage bug would sneak in.
   Instead, a new `_adopt_coa_template()`:
   - Reads only from `coa_template_accounts WHERE template_id = :template_id`
     — this table has **no `tenant_id` column at all**, so there is no
     tenant to leak from. It's system-wide reference data, not owned by any
     tenant, the same way `posting_roles` isn't owned by any tenant.
   - Writes only into `chart_of_accounts` with `tenant_id` taken from the
     authenticated session (`_require_tenant(current_user)`), exactly like
     every other CoA endpoint in `config.py` already does.
   - The endpoint is `POST /coa/adopt-template {template_id}` — the request
     body has no tenant field at all, so there's no input a client could
     supply (by mistake or otherwise) that points the copy at another
     tenant's data. This holds however many tenants adopt the same template;
     each gets its own independent copy, no shared rows, no cross-tenant
     reference.
   - Gated to `coa_count == 0` — only available before any GL account
     exists, same as today's other two paths (manual add / bulk upload) are
     implicitly only relevant at that point. No mid-stream template
     switching in v1.

5. **Fully editable after adoption — no locking.** Once cloned, the accounts
   are ordinary tenant-owned `chart_of_accounts` rows. Standard practice
   (Xero, QuickBooks, Sage all ship an editable default CoA, not a locked
   one) — and confirmed safe here because `posting_roles` mapping
   (`tenant_account_mappings`) is a separate per-tenant table, not a lock on
   the GL row itself, so editing/deleting a cloned account doesn't corrupt
   anything structural; worst case a tenant has to remap a posting role.

6. **GL numbering convention** — benchmarked against the standard SAP/Sage/
   Oracle/Dynamics numeric-block convention (contiguous ranges per
   FS category, so every report/filter that buckets by leading digit keeps
   working):
   - 1000s non-current assets · 1500s current assets
   - 2000s current liabilities · 2500s non-current liabilities
   - 3000s equity
   - 4000s revenue · 5000s cost of sales/services
   - 6000s operating expenses
   - 8000s other income · 8500s finance income/cost
   - 9000s tax

7. **Posting-role coverage** *(confirmed)* — every template includes a GL line for each of
   the 26 system `posting_roles` (Employee/AP/AR/Intercompany payable
   &receivable, Output/Input VAT, WHT payable/receivable, PAYE, statutory
   deductions, default bank, cash, BDC clearing, CWIP, accumulated
   depreciation, depreciation expense, asset disposal, inventory control,
   GRNI, COGS, FX realised/unrealised, retained earnings, current year
   earnings, general suspense, rounding difference) **where applicable to
   that industry** — Professional services skips physical-inventory lines
   (no `inventory_control`/`grni` equivalent) since a services firm has
   nothing to map there; that posting role just stays unmapped for those
   tenants, same as today.

8. **Classification — 3 new canonical values added** *(confirmed)*. **Correction:**
   an earlier draft of this section named the wrong constants
   (`SOCI_CLASSIFICATIONS`/`SOFP_CLASSIFICATIONS` — these don't exist). Just
   re-read the live file: the real constants are `PL_CLASSIFICATIONS` (11
   values: Revenue, Cost of sales, Gross profit, Operating expense, EBITDA,
   Depreciation & amortisation, EBIT, Finance income, Finance cost, Tax
   expense, Other comprehensive income) and `BS_CLASSIFICATIONS` (7 values:
   Non-current asset, Current asset, Cash & cash equivalent, Non-current
   liability, Current liability, Equity, Retained earnings) — both in
   `chart-of-accounts/page.tsx` lines 120–142. They're much coarser than what
   every template below originally used (see Section 5a — that mismatch has
   now been fixed). These lists cover goods-trading businesses well but had
   no distinct label for unbilled services WIP, deferred revenue from
   retainers, or fee income vs. ordinary trading revenue. Adding three new
   values: **"Contract asset — unbilled revenue"** (→ `BS_CLASSIFICATIONS`),
   **"Contract liability — deferred revenue"** (→ `BS_CLASSIFICATIONS`),
   **"Revenue — service fees"** (→ `PL_CLASSIFICATIONS`). The 3 GLs in the
   Professional Services template that were previously marked **[FLAG]** use
   these new values directly. CC brief change to `chart-of-accounts/page.tsx`
   lines 120–142, in addition to the new tables/endpoint/migration.

---

## 2. Template: FMCG / Consumer Goods

| GL # | GL Name | Type | Classification | Group |
|---|---|---|---|---|
| 1000 | Land and Buildings | SOFP | Non-current asset | Non-current assets |
| 1010 | Plant and Machinery | SOFP | Non-current asset | Non-current assets |
| 1020 | Motor Vehicles | SOFP | Non-current asset | Non-current assets |
| 1030 | Furniture and Fittings | SOFP | Non-current asset | Non-current assets |
| 1040 | Computer and IT Equipment | SOFP | Non-current asset | Non-current assets |
| 1050 | Capital Work in Progress | SOFP | Non-current asset | Non-current assets *(→ asset_clearing_cwip)* |
| 1060 | Accumulated Depreciation | SOFP | Non-current asset | Non-current assets *(contra; → accumulated_depreciation)* |
| 1100 | Software and Licences | SOFP | Non-current asset | Non-current assets |
| 1110 | Goodwill | SOFP | Non-current asset | Non-current assets |
| 1120 | Right-of-Use Asset — Leases | SOFP | Non-current asset | Non-current assets |
| 1200 | Long-term Investments | SOFP | Non-current asset | Non-current assets |
| 1500 | Inventory — Raw Materials | SOFP | Current asset | Current assets |
| 1510 | Inventory — Packaging Materials | SOFP | Current asset | Current assets |
| 1520 | Inventory — Finished Goods | SOFP | Current asset | Current assets *(→ inventory_control)* |
| 1530 | Inventory — Goods in Transit | SOFP | Current asset | Current assets |
| 1600 | Trade Receivables — Distributors | SOFP | Current asset | Current assets *(→ accounts_receivable)* |
| 1610 | Trade Receivables — Direct Customers | SOFP | Current asset | Current assets |
| 1620 | Allowance for Doubtful Debts | SOFP | Current asset | Current assets *(contra)* |
| 1630 | Staff Advances | SOFP | Current asset | Current assets |
| 1640 | Withholding Tax Receivable | SOFP | Current asset | Current assets *(→ wht_receivable)* |
| 1650 | Input VAT Recoverable | SOFP | Current asset | Current assets *(→ input_vat)* |
| 1660 | Intercompany Receivable | SOFP | Current asset | Current assets *(→ intercompany_receivable)* |
| 1670 | Prepaid Expenses | SOFP | Current asset | Current assets |
| 1680 | Prepaid Rent | SOFP | Current asset | Current assets |
| 1690 | Advances to Suppliers | SOFP | Current asset | Current assets |
| 1700 | Cash in Hand / Petty Cash | SOFP | Cash & cash equivalent | Current assets *(→ cash)* |
| 1710 | Bank — Current Account (NGN) | SOFP | Cash & cash equivalent | Current assets *(→ default_bank)* |
| 1720 | Bank — Domiciliary Account (USD) | SOFP | Cash & cash equivalent | Current assets *(FX: USD, revalue at period end)* |
| 1730 | BDC / FX Clearing Account | SOFP | Cash & cash equivalent | Current assets *(→ bdc_clearing)* |
| 2000 | Trade Payables — Suppliers | SOFP | Current liability | Current liabilities *(→ accounts_payable)* |
| 2010 | Goods Received Not Invoiced (GRNI) | SOFP | Current liability | Current liabilities *(→ grni)* |
| 2020 | Accrued Expenses | SOFP | Current liability | Current liabilities |
| 2030 | Distributor/Customer Rebates Payable | SOFP | Current liability | Current liabilities |
| 2040 | Employee Payable — Expense Retirement | SOFP | Current liability | Current liabilities *(→ employee_payable)* |
| 2050 | Salaries and Wages Payable | SOFP | Current liability | Current liabilities |
| 2060 | Output VAT Payable | SOFP | Current liability | Current liabilities *(→ output_vat)* |
| 2070 | Withholding Tax Payable | SOFP | Current liability | Current liabilities *(→ wht_payable)* |
| 2080 | PAYE Payable | SOFP | Current liability | Current liabilities *(→ paye_payable)* |
| 2090 | Statutory Deductions Payable (Pension/NHF/NSITF) | SOFP | Current liability | Current liabilities *(→ statutory_deductions)* |
| 2100 | Company Income Tax Payable | SOFP | Current liability | Current liabilities |
| 2110 | Intercompany Payable | SOFP | Current liability | Current liabilities *(→ intercompany_payable)* |
| 2120 | Short-term Borrowing | SOFP | Current liability | Current liabilities |
| 2130 | Lease Liability — Current | SOFP | Current liability | Current liabilities |
| 2140 | General Suspense | SOFP | Current liability | Current liabilities *(→ general_suspense)* |
| 2150 | Rounding Difference | SOFP | Current liability | Current liabilities *(→ rounding_difference)* |
| 2500 | Long-term Borrowing | SOFP | Non-current liability | Non-current liabilities |
| 2510 | Lease Liability — Non-current | SOFP | Non-current liability | Non-current liabilities |
| 2520 | Deferred Tax Liability | SOFP | Non-current liability | Non-current liabilities |
| 3000 | Share Capital | SOFP | Equity | Equity |
| 3010 | Share Premium | SOFP | Equity | Equity |
| 3020 | Retained Earnings | SOFP | Retained earnings | Equity *(→ retained_earnings)* |
| 3030 | Current Year Earnings | SOFP | Retained earnings | Equity *(→ current_year_earnings)* |
| 3040 | Other Reserves | SOFP | Equity | Equity |
| 4000 | Sales — Domestic | SOCI | Revenue | Revenue |
| 4010 | Sales — Export | SOCI | Revenue | Revenue |
| 4020 | Sales Returns and Allowances | SOCI | Revenue | Revenue *(contra)* |
| 4030 | Trade Discounts Given | SOCI | Revenue | Revenue *(contra)* |
| 4040 | Distributor Incentives and Rebates | SOCI | Revenue | Revenue *(contra)* |
| 5000 | Cost of Goods Sold — Finished Goods | SOCI | Cost of sales | Cost of sales *(→ cogs)* |
| 5010 | Freight and Distribution Cost | SOCI | Cost of sales | Cost of sales |
| 5020 | Inventory Write-off / Obsolescence | SOCI | Cost of sales | Cost of sales |
| 5030 | Import Duty and Clearing Charges | SOCI | Cost of sales | Cost of sales |
| 6000 | Staff Salaries and Wages | SOCI | Operating expense | Operating expenses |
| 6010 | Staff Pension Contribution | SOCI | Operating expense | Operating expenses |
| 6020 | Staff Training and Development | SOCI | Operating expense | Operating expenses |
| 6030 | Marketing and Brand Promotion | SOCI | Operating expense | Operating expenses |
| 6040 | Trade Marketing and Merchandising | SOCI | Operating expense | Operating expenses |
| 6050 | Rent and Rates | SOCI | Operating expense | Operating expenses |
| 6060 | Utilities — Electricity, Water, Diesel | SOCI | Operating expense | Operating expenses |
| 6070 | Repairs and Maintenance | SOCI | Operating expense | Operating expenses |
| 6080 | Travel and Logistics | SOCI | Operating expense | Operating expenses |
| 6090 | Professional and Consulting Fees | SOCI | Operating expense | Operating expenses |
| 6100 | Insurance | SOCI | Operating expense | Operating expenses |
| 6110 | IT and Software Subscriptions | SOCI | Operating expense | Operating expenses |
| 6120 | Office Supplies and Consumables | SOCI | Operating expense | Operating expenses |
| 6130 | Communication and Internet | SOCI | Operating expense | Operating expenses |
| 6140 | Depreciation Expense | SOCI | Depreciation & amortisation | Operating expenses *(→ depreciation_expense)* |
| 6150 | Amortisation Expense — Intangibles | SOCI | Depreciation & amortisation | Operating expenses |
| 6160 | Bank Charges | SOCI | Operating expense | Operating expenses |
| 6170 | Bad Debt Expense | SOCI | Operating expense | Operating expenses |
| 6180 | Security Expenses | SOCI | Operating expense | Operating expenses |
| 6190 | Statutory and Regulatory Fees | SOCI | Operating expense | Operating expenses |
| 6200 | Donations and CSR | SOCI | Operating expense | Operating expenses |
| 6210 | Directors' Remuneration | SOCI | Operating expense | Operating expenses |
| 6220 | Audit and Accounting Fees | SOCI | Operating expense | Operating expenses |
| 8000 | Sundry / Other Income | SOCI | Revenue | Other income |
| 8010 | Gain/Loss on Disposal of Fixed Assets | SOCI | Revenue | Other income *(→ asset_disposal)* |
| 8500 | Interest Income | SOCI | Finance income | Finance |
| 8510 | Interest Expense | SOCI | Finance cost | Finance |
| 8520 | FX Realised Gain / Loss | SOCI | Finance income | Finance *(→ fx_realised_gain_loss)* |
| 8530 | FX Unrealised Gain / Loss | SOCI | Finance income | Finance *(→ fx_unrealised_gain_loss)* |
| 9000 | Company Income Tax Expense — Current | SOCI | Tax expense | Tax |
| 9010 | Deferred Tax Expense | SOCI | Tax expense | Tax |
| 9020 | Education Tax / Other Statutory Tax | SOCI | Tax expense | Tax |

---

## 3. Template: Professional Services

No inventory/COGS-of-goods section — replaced with unbilled WIP and
disbursements. Differences from FMCG called out inline.

| GL # | GL Name | Type | Classification | Group |
|---|---|---|---|---|
| 1000 | Leasehold Improvements | SOFP | Non-current asset | Non-current assets |
| 1010 | Office Equipment | SOFP | Non-current asset | Non-current assets |
| 1020 | Computer and IT Equipment | SOFP | Non-current asset | Non-current assets |
| 1030 | Furniture and Fittings | SOFP | Non-current asset | Non-current assets |
| 1050 | Capital Work in Progress | SOFP | Non-current asset | Non-current assets *(→ asset_clearing_cwip)* |
| 1060 | Accumulated Depreciation | SOFP | Non-current asset | Non-current assets *(contra; → accumulated_depreciation)* |
| 1100 | Software and Licences | SOFP | Non-current asset | Non-current assets |
| 1120 | Right-of-Use Asset — Leases | SOFP | Non-current asset | Non-current assets |
| 1500 | Unbilled Services (WIP) | SOFP | Contract asset — unbilled revenue | Current assets |
| 1510 | Trade Receivables — Client Fees | SOFP | Current asset | Current assets *(→ accounts_receivable)* |
| 1520 | Allowance for Doubtful Debts | SOFP | Current asset | Current assets *(contra)* |
| 1530 | Disbursements Recoverable from Clients | SOFP | Current asset | Current assets |
| 1540 | Withholding Tax Receivable | SOFP | Current asset | Current assets *(→ wht_receivable)* |
| 1550 | Input VAT Recoverable | SOFP | Current asset | Current assets *(→ input_vat)* |
| 1560 | Staff Advances | SOFP | Current asset | Current assets |
| 1570 | Prepaid Expenses | SOFP | Current asset | Current assets |
| 1580 | Prepaid Rent | SOFP | Current asset | Current assets |
| 1600 | Cash in Hand / Petty Cash | SOFP | Cash & cash equivalent | Current assets *(→ cash)* |
| 1610 | Bank — Current Account (NGN) | SOFP | Cash & cash equivalent | Current assets *(→ default_bank)* |
| 1620 | Bank — Domiciliary Account (USD) | SOFP | Cash & cash equivalent | Current assets *(FX: USD, revalue at period end)* |
| 2000 | Trade Payables — Vendors | SOFP | Current liability | Current liabilities *(→ accounts_payable)* |
| 2010 | Accrued Expenses | SOFP | Current liability | Current liabilities |
| 2020 | Deferred Revenue — Client Retainers | SOFP | Contract liability — deferred revenue | Current liabilities |
| 2030 | Employee Payable — Expense Retirement | SOFP | Current liability | Current liabilities *(→ employee_payable)* |
| 2040 | Salaries and Wages Payable | SOFP | Current liability | Current liabilities |
| 2050 | Output VAT Payable | SOFP | Current liability | Current liabilities *(→ output_vat)* |
| 2060 | Withholding Tax Payable | SOFP | Current liability | Current liabilities *(→ wht_payable)* |
| 2070 | PAYE Payable | SOFP | Current liability | Current liabilities *(→ paye_payable)* |
| 2080 | Statutory Deductions Payable | SOFP | Current liability | Current liabilities *(→ statutory_deductions)* |
| 2090 | Company Income Tax Payable | SOFP | Current liability | Current liabilities |
| 2100 | Short-term Borrowing | SOFP | Current liability | Current liabilities |
| 2110 | General Suspense | SOFP | Current liability | Current liabilities *(→ general_suspense)* |
| 2120 | Rounding Difference | SOFP | Current liability | Current liabilities *(→ rounding_difference)* |
| 2500 | Long-term Borrowing | SOFP | Non-current liability | Non-current liabilities |
| 2510 | Lease Liability — Non-current | SOFP | Non-current liability | Non-current liabilities |
| 2520 | Deferred Tax Liability | SOFP | Non-current liability | Non-current liabilities |
| 3000 | Share Capital | SOFP | Equity | Equity |
| 3020 | Retained Earnings | SOFP | Retained earnings | Equity *(→ retained_earnings)* |
| 3030 | Current Year Earnings | SOFP | Retained earnings | Equity *(→ current_year_earnings)* |
| 3040 | Other Reserves | SOFP | Equity | Equity |
| 4000 | Professional Fee Income | SOCI | Revenue — service fees | Revenue |
| 4010 | Retainer Income | SOCI | Revenue | Revenue |
| 4020 | Reimbursable Disbursements Billed | SOCI | Revenue | Revenue |
| 4030 | Fee Discounts / Write-offs | SOCI | Revenue | Revenue *(contra)* |
| 5000 | Subcontractor / Associate Consultant Fees | SOCI | Cost of sales | Cost of services *(→ cogs)* |
| 5010 | Direct Project Travel | SOCI | Cost of sales | Cost of services |
| 5020 | Direct Project Materials / Software | SOCI | Cost of sales | Cost of services |
| 6000 | Staff Salaries and Wages | SOCI | Operating expense | Operating expenses |
| 6010 | Staff Pension Contribution | SOCI | Operating expense | Operating expenses |
| 6020 | Staff Training and Development | SOCI | Operating expense | Operating expenses |
| 6030 | Marketing and Business Development | SOCI | Operating expense | Operating expenses |
| 6050 | Rent and Rates | SOCI | Operating expense | Operating expenses |
| 6060 | Utilities | SOCI | Operating expense | Operating expenses |
| 6070 | Repairs and Maintenance | SOCI | Operating expense | Operating expenses |
| 6080 | Travel (non-billable) | SOCI | Operating expense | Operating expenses |
| 6090 | Professional Indemnity Insurance | SOCI | Operating expense | Operating expenses |
| 6100 | General Insurance | SOCI | Operating expense | Operating expenses |
| 6110 | IT and Software Subscriptions | SOCI | Operating expense | Operating expenses |
| 6120 | Office Supplies and Consumables | SOCI | Operating expense | Operating expenses |
| 6130 | Communication and Internet | SOCI | Operating expense | Operating expenses |
| 6140 | Depreciation Expense | SOCI | Depreciation & amortisation | Operating expenses *(→ depreciation_expense)* |
| 6150 | Amortisation Expense — Intangibles | SOCI | Depreciation & amortisation | Operating expenses |
| 6160 | Bank Charges | SOCI | Operating expense | Operating expenses |
| 6170 | Bad Debt Expense | SOCI | Operating expense | Operating expenses |
| 6180 | Library / Research Subscriptions | SOCI | Operating expense | Operating expenses |
| 6190 | Statutory and Regulatory Fees | SOCI | Operating expense | Operating expenses |
| 6210 | Directors' / Partners' Remuneration | SOCI | Operating expense | Operating expenses |
| 6220 | Audit and Accounting Fees | SOCI | Operating expense | Operating expenses |
| 8000 | Sundry / Other Income | SOCI | Revenue | Other income |
| 8010 | Gain/Loss on Disposal of Fixed Assets | SOCI | Revenue | Other income *(→ asset_disposal)* |
| 8500 | Interest Income | SOCI | Finance income | Finance |
| 8510 | Interest Expense | SOCI | Finance cost | Finance |
| 8520 | FX Realised Gain / Loss | SOCI | Finance income | Finance *(→ fx_realised_gain_loss)* |
| 8530 | FX Unrealised Gain / Loss | SOCI | Finance income | Finance *(→ fx_unrealised_gain_loss)* |
| 9000 | Company Income Tax Expense — Current | SOCI | Tax expense | Tax |
| 9010 | Deferred Tax Expense | SOCI | Tax expense | Tax |

---

## 4. Template: Generic / Other (fallback for remaining 11 industries)

Lean universal structure — no industry flavor, covers every posting role with
a single generic line each.

| GL # | GL Name | Type | Classification | Group |
|---|---|---|---|---|
| 1000 | Property, Plant and Equipment | SOFP | Non-current asset | Non-current assets |
| 1050 | Capital Work in Progress | SOFP | Non-current asset | Non-current assets *(→ asset_clearing_cwip)* |
| 1060 | Accumulated Depreciation | SOFP | Non-current asset | Non-current assets *(contra; → accumulated_depreciation)* |
| 1100 | Intangible Assets | SOFP | Non-current asset | Non-current assets |
| 1200 | Long-term Investments | SOFP | Non-current asset | Non-current assets |
| 1500 | Inventory | SOFP | Current asset | Current assets *(→ inventory_control; leave unmapped if not applicable)* |
| 1600 | Trade Receivables | SOFP | Current asset | Current assets *(→ accounts_receivable)* |
| 1620 | Allowance for Doubtful Debts | SOFP | Current asset | Current assets *(contra)* |
| 1640 | Withholding Tax Receivable | SOFP | Current asset | Current assets *(→ wht_receivable)* |
| 1650 | Input VAT Recoverable | SOFP | Current asset | Current assets *(→ input_vat)* |
| 1670 | Prepaid Expenses | SOFP | Current asset | Current assets |
| 1700 | Cash in Hand / Petty Cash | SOFP | Cash & cash equivalent | Current assets *(→ cash)* |
| 1710 | Bank — Current Account (NGN) | SOFP | Cash & cash equivalent | Current assets *(→ default_bank)* |
| 1720 | Bank — Domiciliary Account (USD) | SOFP | Cash & cash equivalent | Current assets *(FX: USD)* |
| 2000 | Trade Payables | SOFP | Current liability | Current liabilities *(→ accounts_payable)* |
| 2010 | Goods Received Not Invoiced (GRNI) | SOFP | Current liability | Current liabilities *(→ grni; leave unmapped if not applicable)* |
| 2020 | Accrued Expenses | SOFP | Current liability | Current liabilities |
| 2040 | Employee Payable — Expense Retirement | SOFP | Current liability | Current liabilities *(→ employee_payable)* |
| 2050 | Salaries and Wages Payable | SOFP | Current liability | Current liabilities |
| 2060 | Output VAT Payable | SOFP | Current liability | Current liabilities *(→ output_vat)* |
| 2070 | Withholding Tax Payable | SOFP | Current liability | Current liabilities *(→ wht_payable)* |
| 2080 | PAYE Payable | SOFP | Current liability | Current liabilities *(→ paye_payable)* |
| 2090 | Statutory Deductions Payable | SOFP | Current liability | Current liabilities *(→ statutory_deductions)* |
| 2100 | Company Income Tax Payable | SOFP | Current liability | Current liabilities |
| 2120 | Short-term Borrowing | SOFP | Current liability | Current liabilities |
| 2140 | General Suspense | SOFP | Current liability | Current liabilities *(→ general_suspense)* |
| 2150 | Rounding Difference | SOFP | Current liability | Current liabilities *(→ rounding_difference)* |
| 2500 | Long-term Borrowing | SOFP | Non-current liability | Non-current liabilities |
| 2520 | Deferred Tax Liability | SOFP | Non-current liability | Non-current liabilities |
| 3000 | Share Capital | SOFP | Equity | Equity |
| 3020 | Retained Earnings | SOFP | Retained earnings | Equity *(→ retained_earnings)* |
| 3030 | Current Year Earnings | SOFP | Retained earnings | Equity *(→ current_year_earnings)* |
| 3040 | Other Reserves | SOFP | Equity | Equity |
| 4000 | Sales / Revenue | SOCI | Revenue | Revenue |
| 4020 | Sales Returns and Allowances | SOCI | Revenue | Revenue *(contra)* |
| 5000 | Cost of Sales | SOCI | Cost of sales | Cost of sales *(→ cogs)* |
| 6000 | Staff Salaries and Wages | SOCI | Operating expense | Operating expenses |
| 6010 | Staff Pension Contribution | SOCI | Operating expense | Operating expenses |
| 6050 | Rent and Rates | SOCI | Operating expense | Operating expenses |
| 6060 | Utilities | SOCI | Operating expense | Operating expenses |
| 6070 | Repairs and Maintenance | SOCI | Operating expense | Operating expenses |
| 6080 | Travel | SOCI | Operating expense | Operating expenses |
| 6090 | Professional Fees | SOCI | Operating expense | Operating expenses |
| 6100 | Insurance | SOCI | Operating expense | Operating expenses |
| 6110 | IT and Software Subscriptions | SOCI | Operating expense | Operating expenses |
| 6120 | Office Supplies | SOCI | Operating expense | Operating expenses |
| 6130 | Communication | SOCI | Operating expense | Operating expenses |
| 6140 | Depreciation Expense | SOCI | Depreciation & amortisation | Operating expenses *(→ depreciation_expense)* |
| 6160 | Bank Charges | SOCI | Operating expense | Operating expenses |
| 6170 | Bad Debt Expense | SOCI | Operating expense | Operating expenses |
| 6180 | Other Operating Expenses | SOCI | Operating expense | Operating expenses |
| 8000 | Sundry / Other Income | SOCI | Revenue | Other income |
| 8500 | Interest Income | SOCI | Finance income | Finance |
| 8510 | Interest Expense | SOCI | Finance cost | Finance |
| 8520 | FX Realised/Unrealised Gain/Loss | SOCI | Finance income | Finance *(→ fx_realised_gain_loss / fx_unrealised_gain_loss)* |
| 9000 | Income Tax Expense — Current | SOCI | Tax expense | Tax |
| 9010 | Deferred Tax Expense | SOCI | Tax expense | Tax |

---

## 5. Your follow-up — add-on GLs, name edits, pre-filled bulk template

Three asks, checked against actual current code (not assumed):

1. **Add a GL the default template doesn't have** — already works, no code
   change. `POST /coa` ("Add GL" modal) has no restriction tied to where a
   row came from. `locked_by_implementation` exists on the model but nothing
   in `create_coa` / `update_coa` / `upload_coa` checks it today. A tenant
   can add unlimited extra accounts after adopting a default template, same
   as on a manually-built CoA.

2. **Edit GL names (or anything else) on a cloned account** — same answer,
   already works. `PATCH /coa/{gl_id}` is unrestricted PATCH-semantics, and
   cloned rows become ordinary `chart_of_accounts` rows once copied in (see
   decision 5 above). Confirmed, no code change.

3. **Pre-fill the downloadable template with GL code + name, for
   regrouping/dimension-mapping** — this one needs a real change. Found
   while reading `download_coa_template()` (`config.py:1402`) and
   `upload_coa()` (`config.py:2066`):
   - Upload already **upserts by GL Number** — a row in the uploaded file
     that matches an existing GL Number updates that row instead of
     duplicating it. Re-uploading an edited, pre-filled template already
     does the right thing; nothing to fix on the upload side.
   - For most columns (GL Group, FS Head, TB Mapping, Classification, etc.)
     a **blank cell on upload preserves the existing value** rather than
     wiping it (`gl_obj.gl_group = s1get(...) or gl_obj.gl_group`). A
     tenant only has to type into cells they're actually changing.
   - **Exception — and why I'm prefilling more than just code + name:**
     dimension requirement columns don't follow that rule. A blank
     dimension cell defaults to "Optional" on upload (`config.py:2380-2384`),
     which would silently downgrade an already-set "Required" back to
     Optional on a second round-trip. Dimension requirements are
     tenant-specific and can't be seeded by the default template itself
     (the tenant's dimensions don't exist yet at template-seed time), so
     this download is the *only* bulk way to set them post-adoption —
     worth getting right.
   - **The actual gap:** `download_coa_template()` always generates a blank
     Sheet 1 today (rows 4+ empty), regardless of whether the tenant
     already has accounts.

   **Planned fix:** when the tenant already has `chart_of_accounts` rows
   (true post-adoption, but also true for any tenant editing an existing
   CoA), `download_coa_template()` writes one row per existing account into
   Sheet 1, pre-filled with **every column currently on the sheet** — GL
   Number, GL Name, Account Type, Group/Subgroup/Sub-subgroup, FS Head/Note,
   TB Mapping, Classification, Category/Subcategory — plus each dimension
   column set to that account's *current* requirement (defaulting to
   Optional only where no requirement row exists yet, same default as
   today). Tenants with zero accounts still get today's blank template,
   unchanged. Rows added below the prefilled ones (new GL numbers) get
   created as new accounts on re-upload — add-on GLs in bulk, same
   mechanism as the modal.

   This widens prefill beyond literally "code and name" to the full row —
   otherwise regrouping is done blind (can't decide what to change to if
   you can't see what's already there), and leaving dimension columns blank
   would silently corrupt previously-set requirements on a second cycle.
   Flag if you'd rather keep this narrower (code + name only, rest blank).

   One-function change to an existing endpoint — no new table, no new
   endpoint, no frontend change (the existing "Download Template" button
   already calls this endpoint). Folding into the same CC brief as
   Default-CoA since it's required for the adoption flow to be usable,
   though the fix itself is general-purpose — any tenant editing an
   existing CoA gets a smarter download.

---

## 6. Correction — the Classification column was wrong, now fixed

Caught this myself while re-reading the live frontend file just before writing
the CC brief, not flagged by you — disclosing it because it would have shipped
silently otherwise.

**What was wrong:** every row in the three templates above used a
fine-grained classification scheme (`"Fixed asset — tangible"`,
`"Trade receivable"`, `"Tax payable — current"`, `"Borrowing"`, etc.) that
does not exist anywhere in the codebase. The real dropdown — `PL_CLASSIFICATIONS`
/ `BS_CLASSIFICATIONS` in `chart-of-accounts/page.tsx` (confirmed by reading
the file directly, not memory) — only has 11 + 7 coarse values (see decision 8
above for the full lists). Had this shipped as drafted, every default-template
account would have carried a classification value the Edit-GL dropdown
wouldn't recognise.

**What I did:** remapped every row's Classification column to the real
values — mechanical 1:1 mapping in almost all cases (e.g. `"Trade receivable"`
→ `"Current asset"`, `"Cash and bank"` → `"Cash & cash equivalent"`). No
backend logic branches on `account_classification` today (checked — it's
display/filter only), so nothing functional depended on the old fine-grained
labels; this is a correctness fix, not a behaviour change. Two judgment calls
made along the way, both reversible by editing one cell:

1. **Depreciation Expense / Amortisation Expense rows** — moved from generic
   `"Operating expense"` to the more precise `"Depreciation & amortisation"`
   bucket, since that exact value already exists in `PL_CLASSIFICATIONS` and
   is the obviously-correct fit. Pure improvement, not a new value.
2. **Open gap — "Sundry/Other Income" and "Gain/Loss on Disposal of Fixed
   Assets"** (rows 8000/8010 in every template, plus 4020 in Professional
   Services) have no clean home in either real list — `PL_CLASSIFICATIONS`
   has no "other/non-operating income" bucket distinct from `"Revenue"`.
   Every benchmarked ERP (SAP, Oracle, Dynamics, Sage) carries this as a
   separate line from trading revenue. **Defaulted these to `"Revenue"`** as
   the closest existing fit so the brief isn't blocked — flagging for you:
   add a 4th new value (`"Other income"`, alongside the 3 already approved in
   decision 8) or leave as `"Revenue"`? Either way is a one-line change later.

---

## 7. Explicitly out of scope for v1

- Super Admin Portal UI to manage templates (defer to milestone #40)
- Industry-specific templates for the other 11 industries
- Mid-stream template switching/merging for a tenant who already has GL
  accounts
- Locking/protecting cloned accounts post-adoption

---

## 8. What I need from you

1. ~~Sanity-check the FMCG list against real Red Bull Nigeria practice~~ —
   **confirmed as drafted.**
2. ~~Reuse existing classifications, or add 3 new values~~ — **confirmed:
   add the 3 new values.**
3. ~~Confirm GL numbering convention and group labels~~ — **confirmed as
   drafted.**
4. ~~Confirm priority order for the next industry-specific templates~~ —
   **confirmed: Retail, then Manufacturing.**
5. **New, from the Section 6 correction** — add a 4th new classification
   value `"Other income"` for Sundry Income / Disposal Gains, or leave them
   as `"Revenue"`? Not blocking — ships as `"Revenue"` if you don't weigh in.

All blocking questions resolved. Writing the CC implementation brief now.
