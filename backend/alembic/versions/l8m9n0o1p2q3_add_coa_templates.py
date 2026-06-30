"""add_coa_templates

Creates coa_templates and coa_template_accounts tables and seeds three starter
Chart of Accounts templates (FMCG/Consumer Goods, Professional Services,
Generic/Other). These are system-wide reference rows — no tenant_id column —
making cross-tenant leakage structurally impossible.

Revision ID: l8m9n0o1p2q3
Revises: k7l8m9n0o1p2
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "l8m9n0o1p2q3"
down_revision = "k7l8m9n0o1p2"
branch_labels = None
depends_on = None

# Fixed UUIDs for the three templates so up/down/re-up is deterministic.
_FMCG_ID     = "f1c00001-0001-0001-0001-000000000001"
_PROFSERV_ID = "f1c00002-0002-0002-0002-000000000002"
_GENERIC_ID  = "f1c00003-0003-0003-0003-000000000003"


# ---------------------------------------------------------------------------
# Seed data helpers
# ---------------------------------------------------------------------------

def _row(gl_number, gl_name, account_type, classification, gl_group,
         is_fx=False, fx_code=None, revalue=False):
    """Build a coa_template_accounts value dict from keyword args."""
    return {
        "gl_number": gl_number,
        "gl_name": gl_name,
        "account_type": account_type,   # 'BS' or 'PL'
        "account_classification": classification,
        "gl_group": gl_group,
        "gl_subgroup": None,
        "gl_sub_subgroup": None,
        "fs_head": None,
        "fs_note": None,
        "tb_mapping": None,
        "is_foreign_currency": is_fx,
        "foreign_currency_code": fx_code,
        "revalue_at_period_end": revalue,
    }


# ---------------------------------------------------------------------------
# Template 1: FMCG / Consumer Goods
# ---------------------------------------------------------------------------
_FMCG_ACCOUNTS = [
    _row("1000",  "Land and Buildings",                            "BS", "Non-current asset",           "Non-current assets"),
    _row("1010",  "Plant and Machinery",                           "BS", "Non-current asset",           "Non-current assets"),
    _row("1020",  "Motor Vehicles",                                "BS", "Non-current asset",           "Non-current assets"),
    _row("1030",  "Furniture and Fittings",                        "BS", "Non-current asset",           "Non-current assets"),
    _row("1040",  "Computer and IT Equipment",                     "BS", "Non-current asset",           "Non-current assets"),
    _row("1050",  "Capital Work in Progress",                      "BS", "Non-current asset",           "Non-current assets"),
    _row("1060",  "Accumulated Depreciation",                      "BS", "Non-current asset",           "Non-current assets"),
    _row("1100",  "Software and Licences",                         "BS", "Non-current asset",           "Non-current assets"),
    _row("1110",  "Goodwill",                                      "BS", "Non-current asset",           "Non-current assets"),
    _row("1120",  "Right-of-Use Asset — Leases",                   "BS", "Non-current asset",           "Non-current assets"),
    _row("1200",  "Long-term Investments",                         "BS", "Non-current asset",           "Non-current assets"),
    _row("1500",  "Inventory — Raw Materials",                     "BS", "Current asset",               "Current assets"),
    _row("1510",  "Inventory — Packaging Materials",               "BS", "Current asset",               "Current assets"),
    _row("1520",  "Inventory — Finished Goods",                    "BS", "Current asset",               "Current assets"),
    _row("1530",  "Inventory — Goods in Transit",                  "BS", "Current asset",               "Current assets"),
    _row("1600",  "Trade Receivables — Distributors",              "BS", "Current asset",               "Current assets"),
    _row("1610",  "Trade Receivables — Direct Customers",          "BS", "Current asset",               "Current assets"),
    _row("1620",  "Allowance for Doubtful Debts",                  "BS", "Current asset",               "Current assets"),
    _row("1630",  "Staff Advances",                                "BS", "Current asset",               "Current assets"),
    _row("1640",  "Withholding Tax Receivable",                    "BS", "Current asset",               "Current assets"),
    _row("1650",  "Input VAT Recoverable",                         "BS", "Current asset",               "Current assets"),
    _row("1660",  "Intercompany Receivable",                       "BS", "Current asset",               "Current assets"),
    _row("1670",  "Prepaid Expenses",                              "BS", "Current asset",               "Current assets"),
    _row("1680",  "Prepaid Rent",                                  "BS", "Current asset",               "Current assets"),
    _row("1690",  "Advances to Suppliers",                         "BS", "Current asset",               "Current assets"),
    _row("1700",  "Cash in Hand / Petty Cash",                     "BS", "Cash & cash equivalent",      "Current assets"),
    _row("1710",  "Bank — Current Account (NGN)",                  "BS", "Cash & cash equivalent",      "Current assets"),
    _row("1720",  "Bank — Domiciliary Account (USD)",              "BS", "Cash & cash equivalent",      "Current assets",
         is_fx=True, fx_code="USD", revalue=True),
    _row("1730",  "BDC / FX Clearing Account",                     "BS", "Cash & cash equivalent",      "Current assets"),
    _row("2000",  "Trade Payables — Suppliers",                    "BS", "Current liability",           "Current liabilities"),
    _row("2010",  "Goods Received Not Invoiced (GRNI)",            "BS", "Current liability",           "Current liabilities"),
    _row("2020",  "Accrued Expenses",                              "BS", "Current liability",           "Current liabilities"),
    _row("2030",  "Distributor/Customer Rebates Payable",          "BS", "Current liability",           "Current liabilities"),
    _row("2040",  "Employee Payable — Expense Retirement",         "BS", "Current liability",           "Current liabilities"),
    _row("2050",  "Salaries and Wages Payable",                    "BS", "Current liability",           "Current liabilities"),
    _row("2060",  "Output VAT Payable",                            "BS", "Current liability",           "Current liabilities"),
    _row("2070",  "Withholding Tax Payable",                       "BS", "Current liability",           "Current liabilities"),
    _row("2080",  "PAYE Payable",                                  "BS", "Current liability",           "Current liabilities"),
    _row("2090",  "Statutory Deductions Payable (Pension/NHF/NSITF)", "BS", "Current liability",       "Current liabilities"),
    _row("2100",  "Company Income Tax Payable",                    "BS", "Current liability",           "Current liabilities"),
    _row("2110",  "Intercompany Payable",                          "BS", "Current liability",           "Current liabilities"),
    _row("2120",  "Short-term Borrowing",                          "BS", "Current liability",           "Current liabilities"),
    _row("2130",  "Lease Liability — Current",                     "BS", "Current liability",           "Current liabilities"),
    _row("2140",  "General Suspense",                              "BS", "Current liability",           "Current liabilities"),
    _row("2150",  "Rounding Difference",                           "BS", "Current liability",           "Current liabilities"),
    _row("2500",  "Long-term Borrowing",                           "BS", "Non-current liability",       "Non-current liabilities"),
    _row("2510",  "Lease Liability — Non-current",                 "BS", "Non-current liability",       "Non-current liabilities"),
    _row("2520",  "Deferred Tax Liability",                        "BS", "Non-current liability",       "Non-current liabilities"),
    _row("3000",  "Share Capital",                                 "BS", "Equity",                      "Equity"),
    _row("3010",  "Share Premium",                                 "BS", "Equity",                      "Equity"),
    _row("3020",  "Retained Earnings",                             "BS", "Retained earnings",           "Equity"),
    _row("3030",  "Current Year Earnings",                         "BS", "Retained earnings",           "Equity"),
    _row("3040",  "Other Reserves",                                "BS", "Equity",                      "Equity"),
    _row("4000",  "Sales — Domestic",                              "PL", "Revenue",                     "Revenue"),
    _row("4010",  "Sales — Export",                                "PL", "Revenue",                     "Revenue"),
    _row("4020",  "Sales Returns and Allowances",                  "PL", "Revenue",                     "Revenue"),
    _row("4030",  "Trade Discounts Given",                         "PL", "Revenue",                     "Revenue"),
    _row("4040",  "Distributor Incentives and Rebates",            "PL", "Revenue",                     "Revenue"),
    _row("5000",  "Cost of Goods Sold — Finished Goods",          "PL", "Cost of sales",               "Cost of sales"),
    _row("5010",  "Freight and Distribution Cost",                 "PL", "Cost of sales",               "Cost of sales"),
    _row("5020",  "Inventory Write-off / Obsolescence",            "PL", "Cost of sales",               "Cost of sales"),
    _row("5030",  "Import Duty and Clearing Charges",              "PL", "Cost of sales",               "Cost of sales"),
    _row("6000",  "Staff Salaries and Wages",                      "PL", "Operating expense",           "Operating expenses"),
    _row("6010",  "Staff Pension Contribution",                    "PL", "Operating expense",           "Operating expenses"),
    _row("6020",  "Staff Training and Development",                "PL", "Operating expense",           "Operating expenses"),
    _row("6030",  "Marketing and Brand Promotion",                 "PL", "Operating expense",           "Operating expenses"),
    _row("6040",  "Trade Marketing and Merchandising",             "PL", "Operating expense",           "Operating expenses"),
    _row("6050",  "Rent and Rates",                                "PL", "Operating expense",           "Operating expenses"),
    _row("6060",  "Utilities — Electricity, Water, Diesel",        "PL", "Operating expense",           "Operating expenses"),
    _row("6070",  "Repairs and Maintenance",                       "PL", "Operating expense",           "Operating expenses"),
    _row("6080",  "Travel and Logistics",                          "PL", "Operating expense",           "Operating expenses"),
    _row("6090",  "Professional and Consulting Fees",              "PL", "Operating expense",           "Operating expenses"),
    _row("6100",  "Insurance",                                     "PL", "Operating expense",           "Operating expenses"),
    _row("6110",  "IT and Software Subscriptions",                 "PL", "Operating expense",           "Operating expenses"),
    _row("6120",  "Office Supplies and Consumables",               "PL", "Operating expense",           "Operating expenses"),
    _row("6130",  "Communication and Internet",                    "PL", "Operating expense",           "Operating expenses"),
    _row("6140",  "Depreciation Expense",                          "PL", "Depreciation & amortisation", "Operating expenses"),
    _row("6150",  "Amortisation Expense — Intangibles",            "PL", "Depreciation & amortisation", "Operating expenses"),
    _row("6160",  "Bank Charges",                                  "PL", "Operating expense",           "Operating expenses"),
    _row("6170",  "Bad Debt Expense",                              "PL", "Operating expense",           "Operating expenses"),
    _row("6180",  "Security Expenses",                             "PL", "Operating expense",           "Operating expenses"),
    _row("6190",  "Statutory and Regulatory Fees",                 "PL", "Operating expense",           "Operating expenses"),
    _row("6200",  "Donations and CSR",                             "PL", "Operating expense",           "Operating expenses"),
    _row("6210",  "Directors' Remuneration",                       "PL", "Operating expense",           "Operating expenses"),
    _row("6220",  "Audit and Accounting Fees",                     "PL", "Operating expense",           "Operating expenses"),
    _row("8000",  "Sundry / Other Income",                         "PL", "Revenue",                     "Other income"),
    _row("8010",  "Gain/Loss on Disposal of Fixed Assets",         "PL", "Revenue",                     "Other income"),
    _row("8500",  "Interest Income",                               "PL", "Finance income",              "Finance"),
    _row("8510",  "Interest Expense",                              "PL", "Finance cost",                "Finance"),
    _row("8520",  "FX Realised Gain / Loss",                       "PL", "Finance income",              "Finance"),
    _row("8530",  "FX Unrealised Gain / Loss",                     "PL", "Finance income",              "Finance"),
    _row("9000",  "Company Income Tax Expense — Current",          "PL", "Tax expense",                 "Tax"),
    _row("9010",  "Deferred Tax Expense",                          "PL", "Tax expense",                 "Tax"),
    _row("9020",  "Education Tax / Other Statutory Tax",           "PL", "Tax expense",                 "Tax"),
]  # 94 rows


# ---------------------------------------------------------------------------
# Template 2: Professional Services
# ---------------------------------------------------------------------------
_PROFSERV_ACCOUNTS = [
    _row("1000",  "Leasehold Improvements",                        "BS", "Non-current asset",               "Non-current assets"),
    _row("1010",  "Office Equipment",                              "BS", "Non-current asset",               "Non-current assets"),
    _row("1020",  "Computer and IT Equipment",                     "BS", "Non-current asset",               "Non-current assets"),
    _row("1030",  "Furniture and Fittings",                        "BS", "Non-current asset",               "Non-current assets"),
    _row("1050",  "Capital Work in Progress",                      "BS", "Non-current asset",               "Non-current assets"),
    _row("1060",  "Accumulated Depreciation",                      "BS", "Non-current asset",               "Non-current assets"),
    _row("1100",  "Software and Licences",                         "BS", "Non-current asset",               "Non-current assets"),
    _row("1120",  "Right-of-Use Asset — Leases",                   "BS", "Non-current asset",               "Non-current assets"),
    _row("1500",  "Unbilled Services (WIP)",                       "BS", "Contract asset — unbilled revenue", "Current assets"),
    _row("1510",  "Trade Receivables — Client Fees",               "BS", "Current asset",                   "Current assets"),
    _row("1520",  "Allowance for Doubtful Debts",                  "BS", "Current asset",                   "Current assets"),
    _row("1530",  "Disbursements Recoverable from Clients",        "BS", "Current asset",                   "Current assets"),
    _row("1540",  "Withholding Tax Receivable",                    "BS", "Current asset",                   "Current assets"),
    _row("1550",  "Input VAT Recoverable",                         "BS", "Current asset",                   "Current assets"),
    _row("1560",  "Staff Advances",                                "BS", "Current asset",                   "Current assets"),
    _row("1570",  "Prepaid Expenses",                              "BS", "Current asset",                   "Current assets"),
    _row("1580",  "Prepaid Rent",                                  "BS", "Current asset",                   "Current assets"),
    _row("1600",  "Cash in Hand / Petty Cash",                     "BS", "Cash & cash equivalent",          "Current assets"),
    _row("1610",  "Bank — Current Account (NGN)",                  "BS", "Cash & cash equivalent",          "Current assets"),
    _row("1620",  "Bank — Domiciliary Account (USD)",              "BS", "Cash & cash equivalent",          "Current assets",
         is_fx=True, fx_code="USD", revalue=True),
    _row("2000",  "Trade Payables — Vendors",                      "BS", "Current liability",               "Current liabilities"),
    _row("2010",  "Accrued Expenses",                              "BS", "Current liability",               "Current liabilities"),
    _row("2020",  "Deferred Revenue — Client Retainers",           "BS", "Contract liability — deferred revenue", "Current liabilities"),
    _row("2030",  "Employee Payable — Expense Retirement",         "BS", "Current liability",               "Current liabilities"),
    _row("2040",  "Salaries and Wages Payable",                    "BS", "Current liability",               "Current liabilities"),
    _row("2050",  "Output VAT Payable",                            "BS", "Current liability",               "Current liabilities"),
    _row("2060",  "Withholding Tax Payable",                       "BS", "Current liability",               "Current liabilities"),
    _row("2070",  "PAYE Payable",                                  "BS", "Current liability",               "Current liabilities"),
    _row("2080",  "Statutory Deductions Payable",                  "BS", "Current liability",               "Current liabilities"),
    _row("2090",  "Company Income Tax Payable",                    "BS", "Current liability",               "Current liabilities"),
    _row("2100",  "Short-term Borrowing",                          "BS", "Current liability",               "Current liabilities"),
    _row("2110",  "General Suspense",                              "BS", "Current liability",               "Current liabilities"),
    _row("2120",  "Rounding Difference",                           "BS", "Current liability",               "Current liabilities"),
    _row("2500",  "Long-term Borrowing",                           "BS", "Non-current liability",           "Non-current liabilities"),
    _row("2510",  "Lease Liability — Non-current",                 "BS", "Non-current liability",           "Non-current liabilities"),
    _row("2520",  "Deferred Tax Liability",                        "BS", "Non-current liability",           "Non-current liabilities"),
    _row("3000",  "Share Capital",                                 "BS", "Equity",                          "Equity"),
    _row("3020",  "Retained Earnings",                             "BS", "Retained earnings",               "Equity"),
    _row("3030",  "Current Year Earnings",                         "BS", "Retained earnings",               "Equity"),
    _row("3040",  "Other Reserves",                                "BS", "Equity",                          "Equity"),
    _row("4000",  "Professional Fee Income",                       "PL", "Revenue — service fees",          "Revenue"),
    _row("4010",  "Retainer Income",                               "PL", "Revenue",                         "Revenue"),
    _row("4020",  "Reimbursable Disbursements Billed",             "PL", "Revenue",                         "Revenue"),
    _row("4030",  "Fee Discounts / Write-offs",                    "PL", "Revenue",                         "Revenue"),
    _row("5000",  "Subcontractor / Associate Consultant Fees",     "PL", "Cost of sales",                   "Cost of services"),
    _row("5010",  "Direct Project Travel",                         "PL", "Cost of sales",                   "Cost of services"),
    _row("5020",  "Direct Project Materials / Software",           "PL", "Cost of sales",                   "Cost of services"),
    _row("6000",  "Staff Salaries and Wages",                      "PL", "Operating expense",               "Operating expenses"),
    _row("6010",  "Staff Pension Contribution",                    "PL", "Operating expense",               "Operating expenses"),
    _row("6020",  "Staff Training and Development",                "PL", "Operating expense",               "Operating expenses"),
    _row("6030",  "Marketing and Business Development",            "PL", "Operating expense",               "Operating expenses"),
    _row("6050",  "Rent and Rates",                                "PL", "Operating expense",               "Operating expenses"),
    _row("6060",  "Utilities",                                     "PL", "Operating expense",               "Operating expenses"),
    _row("6070",  "Repairs and Maintenance",                       "PL", "Operating expense",               "Operating expenses"),
    _row("6080",  "Travel (non-billable)",                         "PL", "Operating expense",               "Operating expenses"),
    _row("6090",  "Professional Indemnity Insurance",              "PL", "Operating expense",               "Operating expenses"),
    _row("6100",  "General Insurance",                             "PL", "Operating expense",               "Operating expenses"),
    _row("6110",  "IT and Software Subscriptions",                 "PL", "Operating expense",               "Operating expenses"),
    _row("6120",  "Office Supplies and Consumables",               "PL", "Operating expense",               "Operating expenses"),
    _row("6130",  "Communication and Internet",                    "PL", "Operating expense",               "Operating expenses"),
    _row("6140",  "Depreciation Expense",                          "PL", "Depreciation & amortisation",     "Operating expenses"),
    _row("6150",  "Amortisation Expense — Intangibles",            "PL", "Depreciation & amortisation",     "Operating expenses"),
    _row("6160",  "Bank Charges",                                  "PL", "Operating expense",               "Operating expenses"),
    _row("6170",  "Bad Debt Expense",                              "PL", "Operating expense",               "Operating expenses"),
    _row("6180",  "Library / Research Subscriptions",              "PL", "Operating expense",               "Operating expenses"),
    _row("6190",  "Statutory and Regulatory Fees",                 "PL", "Operating expense",               "Operating expenses"),
    _row("6210",  "Directors' / Partners' Remuneration",           "PL", "Operating expense",               "Operating expenses"),
    _row("6220",  "Audit and Accounting Fees",                     "PL", "Operating expense",               "Operating expenses"),
    _row("8000",  "Sundry / Other Income",                         "PL", "Revenue",                         "Other income"),
    _row("8010",  "Gain/Loss on Disposal of Fixed Assets",         "PL", "Revenue",                         "Other income"),
    _row("8500",  "Interest Income",                               "PL", "Finance income",                  "Finance"),
    _row("8510",  "Interest Expense",                              "PL", "Finance cost",                    "Finance"),
    _row("8520",  "FX Realised Gain / Loss",                       "PL", "Finance income",                  "Finance"),
    _row("8530",  "FX Unrealised Gain / Loss",                     "PL", "Finance income",                  "Finance"),
    _row("9000",  "Company Income Tax Expense — Current",          "PL", "Tax expense",                     "Tax"),
    _row("9010",  "Deferred Tax Expense",                          "PL", "Tax expense",                     "Tax"),
]  # 76 rows


# ---------------------------------------------------------------------------
# Template 3: Generic / Other (fallback for remaining 11 industries)
# ---------------------------------------------------------------------------
_GENERIC_ACCOUNTS = [
    _row("1000",  "Property, Plant and Equipment",                 "BS", "Non-current asset",           "Non-current assets"),
    _row("1050",  "Capital Work in Progress",                      "BS", "Non-current asset",           "Non-current assets"),
    _row("1060",  "Accumulated Depreciation",                      "BS", "Non-current asset",           "Non-current assets"),
    _row("1100",  "Intangible Assets",                             "BS", "Non-current asset",           "Non-current assets"),
    _row("1200",  "Long-term Investments",                         "BS", "Non-current asset",           "Non-current assets"),
    _row("1500",  "Inventory",                                     "BS", "Current asset",               "Current assets"),
    _row("1600",  "Trade Receivables",                             "BS", "Current asset",               "Current assets"),
    _row("1620",  "Allowance for Doubtful Debts",                  "BS", "Current asset",               "Current assets"),
    _row("1640",  "Withholding Tax Receivable",                    "BS", "Current asset",               "Current assets"),
    _row("1650",  "Input VAT Recoverable",                         "BS", "Current asset",               "Current assets"),
    _row("1670",  "Prepaid Expenses",                              "BS", "Current asset",               "Current assets"),
    _row("1700",  "Cash in Hand / Petty Cash",                     "BS", "Cash & cash equivalent",      "Current assets"),
    _row("1710",  "Bank — Current Account (NGN)",                  "BS", "Cash & cash equivalent",      "Current assets"),
    _row("1720",  "Bank — Domiciliary Account (USD)",              "BS", "Cash & cash equivalent",      "Current assets",
         is_fx=True, fx_code="USD", revalue=False),
    _row("2000",  "Trade Payables",                                "BS", "Current liability",           "Current liabilities"),
    _row("2010",  "Goods Received Not Invoiced (GRNI)",            "BS", "Current liability",           "Current liabilities"),
    _row("2020",  "Accrued Expenses",                              "BS", "Current liability",           "Current liabilities"),
    _row("2040",  "Employee Payable — Expense Retirement",         "BS", "Current liability",           "Current liabilities"),
    _row("2050",  "Salaries and Wages Payable",                    "BS", "Current liability",           "Current liabilities"),
    _row("2060",  "Output VAT Payable",                            "BS", "Current liability",           "Current liabilities"),
    _row("2070",  "Withholding Tax Payable",                       "BS", "Current liability",           "Current liabilities"),
    _row("2080",  "PAYE Payable",                                  "BS", "Current liability",           "Current liabilities"),
    _row("2090",  "Statutory Deductions Payable",                  "BS", "Current liability",           "Current liabilities"),
    _row("2100",  "Company Income Tax Payable",                    "BS", "Current liability",           "Current liabilities"),
    _row("2120",  "Short-term Borrowing",                          "BS", "Current liability",           "Current liabilities"),
    _row("2140",  "General Suspense",                              "BS", "Current liability",           "Current liabilities"),
    _row("2150",  "Rounding Difference",                           "BS", "Current liability",           "Current liabilities"),
    _row("2500",  "Long-term Borrowing",                           "BS", "Non-current liability",       "Non-current liabilities"),
    _row("2520",  "Deferred Tax Liability",                        "BS", "Non-current liability",       "Non-current liabilities"),
    _row("3000",  "Share Capital",                                 "BS", "Equity",                      "Equity"),
    _row("3020",  "Retained Earnings",                             "BS", "Retained earnings",           "Equity"),
    _row("3030",  "Current Year Earnings",                         "BS", "Retained earnings",           "Equity"),
    _row("3040",  "Other Reserves",                                "BS", "Equity",                      "Equity"),
    _row("4000",  "Sales / Revenue",                               "PL", "Revenue",                     "Revenue"),
    _row("4020",  "Sales Returns and Allowances",                  "PL", "Revenue",                     "Revenue"),
    _row("5000",  "Cost of Sales",                                 "PL", "Cost of sales",               "Cost of sales"),
    _row("6000",  "Staff Salaries and Wages",                      "PL", "Operating expense",           "Operating expenses"),
    _row("6010",  "Staff Pension Contribution",                    "PL", "Operating expense",           "Operating expenses"),
    _row("6050",  "Rent and Rates",                                "PL", "Operating expense",           "Operating expenses"),
    _row("6060",  "Utilities",                                     "PL", "Operating expense",           "Operating expenses"),
    _row("6070",  "Repairs and Maintenance",                       "PL", "Operating expense",           "Operating expenses"),
    _row("6080",  "Travel",                                        "PL", "Operating expense",           "Operating expenses"),
    _row("6090",  "Professional Fees",                             "PL", "Operating expense",           "Operating expenses"),
    _row("6100",  "Insurance",                                     "PL", "Operating expense",           "Operating expenses"),
    _row("6110",  "IT and Software Subscriptions",                 "PL", "Operating expense",           "Operating expenses"),
    _row("6120",  "Office Supplies",                               "PL", "Operating expense",           "Operating expenses"),
    _row("6130",  "Communication",                                 "PL", "Operating expense",           "Operating expenses"),
    _row("6140",  "Depreciation Expense",                          "PL", "Depreciation & amortisation", "Operating expenses"),
    _row("6160",  "Bank Charges",                                  "PL", "Operating expense",           "Operating expenses"),
    _row("6170",  "Bad Debt Expense",                              "PL", "Operating expense",           "Operating expenses"),
    _row("6180",  "Other Operating Expenses",                      "PL", "Operating expense",           "Operating expenses"),
    _row("8000",  "Sundry / Other Income",                         "PL", "Revenue",                     "Other income"),
    _row("8500",  "Interest Income",                               "PL", "Finance income",              "Finance"),
    _row("8510",  "Interest Expense",                              "PL", "Finance cost",                "Finance"),
    _row("8520",  "FX Realised/Unrealised Gain/Loss",              "PL", "Finance income",              "Finance"),
    _row("9000",  "Income Tax Expense — Current",                  "PL", "Tax expense",                 "Tax"),
    _row("9010",  "Deferred Tax Expense",                          "PL", "Tax expense",                 "Tax"),
]  # 57 rows


# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------

def upgrade() -> None:
    """Create coa_templates + coa_template_accounts and seed 3 starter templates."""
    op.create_table(
        "coa_templates",
        sa.Column("id",          sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("industry",    sa.String(100),  nullable=True),
        sa.Column("name",        sa.String(200),  nullable=False),
        sa.Column("description", sa.Text(),        nullable=False, server_default=""),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "coa_template_accounts",
        sa.Column("id",                   sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id",          sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("coa_templates.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("gl_number",            sa.String(50),  nullable=False),
        sa.Column("gl_name",              sa.String(255), nullable=False),
        sa.Column("account_type",         sa.String(20),  nullable=False),  # 'PL' or 'BS'
        sa.Column("gl_group",             sa.String(100), nullable=True),
        sa.Column("gl_subgroup",          sa.String(100), nullable=True),
        sa.Column("gl_sub_subgroup",      sa.String(100), nullable=True),
        sa.Column("fs_head",              sa.String(100), nullable=True),
        sa.Column("fs_note",              sa.String(100), nullable=True),
        sa.Column("tb_mapping",           sa.String(100), nullable=True),
        sa.Column("account_classification", sa.String(100), nullable=True),
        sa.Column("is_foreign_currency",  sa.Boolean(),   nullable=False, server_default="false"),
        sa.Column("foreign_currency_code", sa.String(10), nullable=True),
        sa.Column("revalue_at_period_end", sa.Boolean(),  nullable=False, server_default="false"),
        sa.Column("sort_order",           sa.Integer(),   nullable=False, server_default="0"),
    )

    # Seed the three templates
    conn = op.get_bind()

    conn.execute(sa.text(
        "INSERT INTO coa_templates (id, industry, name, description) VALUES "
        "(:fmcg_id, 'FMCG / Consumer goods', 'FMCG / Consumer Goods', "
        " 'Starter Chart of Accounts for FMCG and consumer goods businesses. Covers inventory, distribution, trade receivables/payables, all posting roles.'),"
        "(:ps_id,   'Professional services', 'Professional Services', "
        " 'Starter Chart of Accounts for professional services firms. Covers unbilled WIP, client fee income, retainer deferred revenue, disbursements — no physical inventory lines.'),"
        "(:gen_id,  NULL,                    'Generic / Other', "
        " 'Universal fallback Chart of Accounts for industries without a dedicated template. Lean structure covering all posting roles with a single generic line each.')"
    ), {"fmcg_id": _FMCG_ID, "ps_id": _PROFSERV_ID, "gen_id": _GENERIC_ID})

    # Seed accounts for each template
    import uuid as _uuid

    def _seed_accounts(template_id: str, rows: list[dict]) -> None:
        for sort_order, r in enumerate(rows):
            conn.execute(sa.text(
                "INSERT INTO coa_template_accounts "
                "(id, template_id, gl_number, gl_name, account_type, gl_group, "
                " gl_subgroup, gl_sub_subgroup, fs_head, fs_note, tb_mapping, "
                " account_classification, is_foreign_currency, foreign_currency_code, "
                " revalue_at_period_end, sort_order) "
                "VALUES (:id, :template_id, :gl_number, :gl_name, :account_type, :gl_group, "
                " :gl_subgroup, :gl_sub_subgroup, :fs_head, :fs_note, :tb_mapping, "
                " :account_classification, :is_foreign_currency, :foreign_currency_code, "
                " :revalue_at_period_end, :sort_order)"
            ), {
                "id": str(_uuid.uuid4()),
                "template_id": template_id,
                "sort_order": sort_order,
                **r,
            })

    _seed_accounts(_FMCG_ID,     _FMCG_ACCOUNTS)
    _seed_accounts(_PROFSERV_ID, _PROFSERV_ACCOUNTS)
    _seed_accounts(_GENERIC_ID,  _GENERIC_ACCOUNTS)


def downgrade() -> None:
    """Drop coa_template_accounts first (FK constraint), then coa_templates."""
    op.drop_table("coa_template_accounts")
    op.drop_table("coa_templates")
