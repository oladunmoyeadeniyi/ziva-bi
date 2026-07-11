"""
ZivaBI — Demo seed script for trial tenants.

Populates a trial tenant with realistic demo data so SA consultants can
immediately show a working system to prospects without manual setup.

What it seeds (idempotent — safe to re-run):
  - TenantOrgConfig: legal name, currency, company type, fiscal year
  - OrgStructureNodes: 4 departments / cost centres
  - ApprovalRoles: 7-level role hierarchy
  - Employees: 12 staff across all departments
  - ChartOfAccounts: 24 accounts (P&L + BS)
  - ExpenseReports: 6 reports in DRAFT / SUBMITTED / APPROVED / REJECTED

Skips any entity that already exists (matched by name/number) so it is safe
to run repeatedly — it will only add what is missing.

Usage (from backend/, with venv active and .env populated):
    python scripts/seed_demo_tenant.py --tenant-slug <slug>   # dry run
    python scripts/seed_demo_tenant.py --tenant-slug <slug> --apply

    # List all trial tenants:
    python scripts/seed_demo_tenant.py --list-trials
"""

import argparse
import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv  # noqa: E402
load_dotenv(backend_dir / ".env")

import asyncpg  # noqa: E402

# ── Helpers ───────────────────────────────────────────────────────────────────

def _dsn() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("ERROR: DATABASE_URL not set in backend/.env")
        sys.exit(1)
    return url.replace("postgresql+asyncpg://", "postgresql://")


def uid() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Demo data definitions ──────────────────────────────────────────────────────

DEMO_ORG = {
    "legal_name": "Acme Manufacturing Limited",
    "company_type": "Private Limited Company",
    "functional_currency": "NGN",
    "reporting_currency": "USD",
    "tin": "12345678-0001",
    "rc_number": "RC-0987654",
    "country": "Nigeria",
    "registered_address": "12 Commerce Road, Victoria Island, Lagos",
    "company_phone": "+234 800 000 0001",
    "company_email": "finance@acme-demo.ng",
    "industry": "Manufacturing",
    "first_fiscal_year_end": date(2024, 12, 31),
    "fiscal_year_start_month": 1,
    "fiscal_year_start_day": 1,
    "fiscal_year_name_format": "CY{YYYY}",
    "period_closing_frequency": "monthly",
    "posting_mode": "full_erp",
}

DEMO_DEPARTMENTS = [
    {"name": "Finance & Accounts",    "code": "FIN", "node_type": "department"},
    {"name": "Operations",             "code": "OPS", "node_type": "department"},
    {"name": "Sales & Marketing",      "code": "SAL", "node_type": "department"},
    {"name": "Administration & HR",    "code": "ADM", "node_type": "department"},
]

DEMO_ROLES = [
    {"name": "Chief Executive Officer",  "code": "CEO",  "grade": "E1", "dept": "ADM", "order": 1},
    {"name": "Finance Director",         "code": "FD",   "grade": "D1", "dept": "FIN", "order": 2},
    {"name": "Finance Manager",          "code": "FM",   "grade": "M1", "dept": "FIN", "order": 3},
    {"name": "Senior Accountant",        "code": "SA",   "grade": "S2", "dept": "FIN", "order": 4},
    {"name": "Operations Manager",       "code": "OM",   "grade": "M2", "dept": "OPS", "order": 5},
    {"name": "Sales Manager",            "code": "SM",   "grade": "M3", "dept": "SAL", "order": 6},
    {"name": "HR Manager",               "code": "HRM",  "grade": "M4", "dept": "ADM", "order": 7},
]

DEMO_EMPLOYEES = [
    {"first_name": "Chidi",    "last_name": "Okonkwo",    "email": "c.okonkwo@acme-demo.ng",   "employee_code": "EMP-001", "role_code": "CEO", "dept": "ADM"},
    {"first_name": "Amaka",    "last_name": "Nwachukwu",  "email": "a.nwachukwu@acme-demo.ng", "employee_code": "EMP-002", "role_code": "FD",  "dept": "FIN"},
    {"first_name": "Emeka",    "last_name": "Obi",        "email": "e.obi@acme-demo.ng",        "employee_code": "EMP-003", "role_code": "FM",  "dept": "FIN"},
    {"first_name": "Ngozi",    "last_name": "Eze",        "email": "n.eze@acme-demo.ng",        "employee_code": "EMP-004", "role_code": "SA",  "dept": "FIN"},
    {"first_name": "Tunde",    "last_name": "Adeyemi",    "email": "t.adeyemi@acme-demo.ng",    "employee_code": "EMP-005", "role_code": "SA",  "dept": "FIN"},
    {"first_name": "Kelechi",  "last_name": "Ike",        "email": "k.ike@acme-demo.ng",        "employee_code": "EMP-006", "role_code": "OM",  "dept": "OPS"},
    {"first_name": "Bola",     "last_name": "Afolabi",    "email": "b.afolabi@acme-demo.ng",    "employee_code": "EMP-007", "role_code": None,  "dept": "OPS"},
    {"first_name": "Yemi",     "last_name": "Adeola",     "email": "y.adeola@acme-demo.ng",     "employee_code": "EMP-008", "role_code": None,  "dept": "OPS"},
    {"first_name": "Folake",   "last_name": "Alabi",      "email": "f.alabi@acme-demo.ng",      "employee_code": "EMP-009", "role_code": "SM",  "dept": "SAL"},
    {"first_name": "Seun",     "last_name": "Olawale",    "email": "s.olawale@acme-demo.ng",    "employee_code": "EMP-010", "role_code": None,  "dept": "SAL"},
    {"first_name": "Dami",     "last_name": "Adesanya",   "email": "d.adesanya@acme-demo.ng",   "employee_code": "EMP-011", "role_code": None,  "dept": "SAL"},
    {"first_name": "Chioma",   "last_name": "Okafor",     "email": "c.okafor@acme-demo.ng",     "employee_code": "EMP-012", "role_code": "HRM", "dept": "ADM"},
]

# account_type: 'PL' = P&L/SOCI, 'BS' = Balance Sheet/SOFP
DEMO_COA = [
    # P&L — Revenue
    {"gl_number": "4001", "gl_name": "Product Sales",            "account_type": "PL"},
    {"gl_number": "4002", "gl_name": "Service Revenue",          "account_type": "PL"},
    # P&L — COGS
    {"gl_number": "5001", "gl_name": "Cost of Goods Sold",       "account_type": "PL"},
    {"gl_number": "5002", "gl_name": "Direct Labour",            "account_type": "PL"},
    # P&L — Operating Expenses
    {"gl_number": "6001", "gl_name": "Salaries & Wages",         "account_type": "PL"},
    {"gl_number": "6002", "gl_name": "Travel & Transportation",  "account_type": "PL"},
    {"gl_number": "6003", "gl_name": "Office Supplies",          "account_type": "PL"},
    {"gl_number": "6004", "gl_name": "Vehicle & Fuel Expenses",  "account_type": "PL"},
    {"gl_number": "6005", "gl_name": "Staff Training & Dev.",    "account_type": "PL"},
    {"gl_number": "6006", "gl_name": "Staff Welfare",            "account_type": "PL"},
    {"gl_number": "6007", "gl_name": "Entertainment & Meals",    "account_type": "PL"},
    {"gl_number": "6008", "gl_name": "Repairs & Maintenance",    "account_type": "PL"},
    {"gl_number": "6009", "gl_name": "Utilities",                "account_type": "PL"},
    {"gl_number": "6010", "gl_name": "Rent & Rates",             "account_type": "PL"},
    {"gl_number": "6011", "gl_name": "Bank Charges",             "account_type": "PL"},
    {"gl_number": "6012", "gl_name": "Depreciation",             "account_type": "PL"},
    # BS — Assets
    {"gl_number": "1001", "gl_name": "Cash & Bank",              "account_type": "BS"},
    {"gl_number": "1002", "gl_name": "Accounts Receivable",      "account_type": "BS"},
    {"gl_number": "1003", "gl_name": "Inventory",                "account_type": "BS"},
    {"gl_number": "1501", "gl_name": "Property, Plant & Equipment", "account_type": "BS"},
    # BS — Liabilities
    {"gl_number": "2001", "gl_name": "Accounts Payable",         "account_type": "BS"},
    {"gl_number": "2002", "gl_name": "Staff Payable",            "account_type": "BS"},
    {"gl_number": "2003", "gl_name": "VAT Payable",              "account_type": "BS"},
    # BS — Equity
    {"gl_number": "3001", "gl_name": "Share Capital",            "account_type": "BS"},
]

# (employee_code, title, status, report_date, lines)
DEMO_REPORTS = [
    {
        "submitter_code": "EMP-004",
        "title": "Q4 Field Trip Expenses",
        "status": "DRAFT",
        "report_date": date(2025, 10, 15),
        "lines": [
            {"description": "Flight Lagos-Abuja return", "gl_number": "6002", "amount": 85000},
            {"description": "Hotel (3 nights)",          "gl_number": "6002", "amount": 45000},
        ],
    },
    {
        "submitter_code": "EMP-007",
        "title": "Office Stationery — October",
        "status": "DRAFT",
        "report_date": date(2025, 10, 22),
        "lines": [
            {"description": "Printer paper (5 reams)",   "gl_number": "6003", "amount": 12500},
            {"description": "Pens, folders, tape",       "gl_number": "6003", "amount": 7800},
        ],
    },
    {
        "submitter_code": "EMP-006",
        "title": "Fleet Vehicle Service — Oct",
        "status": "SUBMITTED",
        "report_date": date(2025, 10, 28),
        "lines": [
            {"description": "Service — Truck A (KJA-001)", "gl_number": "6004", "amount": 65000},
            {"description": "Tyre replacement (x2)",        "gl_number": "6004", "amount": 120000},
            {"description": "Fuel purchases October",       "gl_number": "6004", "amount": 38500},
        ],
    },
    {
        "submitter_code": "EMP-003",
        "title": "ICAN CPD Workshop — Nov",
        "status": "SUBMITTED",
        "report_date": date(2025, 11, 5),
        "lines": [
            {"description": "Workshop registration fee",   "gl_number": "6005", "amount": 55000},
            {"description": "Study materials",             "gl_number": "6005", "amount": 18000},
            {"description": "Transport to venue",          "gl_number": "6002", "amount": 9500},
        ],
    },
    {
        "submitter_code": "EMP-009",
        "title": "Sales Team Welfare Q4",
        "status": "APPROVED",
        "report_date": date(2025, 11, 12),
        "lines": [
            {"description": "Team lunch (10 pax)",         "gl_number": "6006", "amount": 75000},
            {"description": "Gift hampers (5 pax)",        "gl_number": "6006", "amount": 50000},
        ],
    },
    {
        "submitter_code": "EMP-010",
        "title": "Client Entertainment — VIP Dinner",
        "status": "REJECTED",
        "report_date": date(2025, 11, 18),
        "lines": [
            {"description": "Restaurant bill (12 pax)", "gl_number": "6007", "amount": 320000},
            {"description": "Wine & beverages",         "gl_number": "6007", "amount": 95000},
        ],
    },
]


# ── Seeding logic ─────────────────────────────────────────────────────────────

async def seed(conn: asyncpg.Connection, tenant_id: str, apply: bool) -> None:
    """Seed all demo data for the given tenant_id."""
    print(f"\n{'[DRY RUN] ' if not apply else ''}Seeding tenant {tenant_id}")
    print("=" * 60)

    # ── 1. TenantOrgConfig ────────────────────────────────────────
    print("\n[1/6] Org config...")
    existing_cfg = await conn.fetchrow(
        "SELECT id FROM tenant_org_config WHERE tenant_id = $1", uuid.UUID(tenant_id)
    )
    if existing_cfg:
        if apply:
            await conn.execute("""
                UPDATE tenant_org_config SET
                    legal_name = $2, company_type = $3, functional_currency = $4,
                    reporting_currency = $5, tin = $6, rc_number = $7, country = $8,
                    registered_address = $9, company_phone = $10, company_email = $11,
                    industry = $12, first_fiscal_year_end = $13,
                    fiscal_year_start_month = $14, fiscal_year_start_day = $15,
                    fiscal_year_name_format = $16, period_closing_frequency = $17,
                    posting_mode = $18
                WHERE tenant_id = $1
            """,
                uuid.UUID(tenant_id),
                DEMO_ORG["legal_name"], DEMO_ORG["company_type"],
                DEMO_ORG["functional_currency"], DEMO_ORG["reporting_currency"],
                DEMO_ORG["tin"], DEMO_ORG["rc_number"], DEMO_ORG["country"],
                DEMO_ORG["registered_address"], DEMO_ORG["company_phone"],
                DEMO_ORG["company_email"], DEMO_ORG["industry"],
                DEMO_ORG["first_fiscal_year_end"],
                DEMO_ORG["fiscal_year_start_month"], DEMO_ORG["fiscal_year_start_day"],
                DEMO_ORG["fiscal_year_name_format"], DEMO_ORG["period_closing_frequency"],
                DEMO_ORG["posting_mode"],
            )
        print(f"  {'UPDATED' if apply else 'WOULD UPDATE'} org config")
    else:
        cfg_id = uid()
        if apply:
            await conn.execute("""
                INSERT INTO tenant_org_config (
                    id, tenant_id, legal_name, company_type, functional_currency,
                    reporting_currency, tin, rc_number, country, registered_address,
                    company_phone, company_email, industry, first_fiscal_year_end,
                    fiscal_year_start_month, fiscal_year_start_day,
                    fiscal_year_name_format, period_closing_frequency, posting_mode
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
            """,
                uuid.UUID(cfg_id), uuid.UUID(tenant_id),
                DEMO_ORG["legal_name"], DEMO_ORG["company_type"],
                DEMO_ORG["functional_currency"], DEMO_ORG["reporting_currency"],
                DEMO_ORG["tin"], DEMO_ORG["rc_number"], DEMO_ORG["country"],
                DEMO_ORG["registered_address"], DEMO_ORG["company_phone"],
                DEMO_ORG["company_email"], DEMO_ORG["industry"],
                DEMO_ORG["first_fiscal_year_end"],
                DEMO_ORG["fiscal_year_start_month"], DEMO_ORG["fiscal_year_start_day"],
                DEMO_ORG["fiscal_year_name_format"], DEMO_ORG["period_closing_frequency"],
                DEMO_ORG["posting_mode"],
            )
        print(f"  {'CREATED' if apply else 'WOULD CREATE'} org config")

    # ── 2. Departments / cost centres ────────────────────────────
    print("\n[2/6] Departments...")
    dept_ids: dict[str, str] = {}  # code -> node id
    for dept in DEMO_DEPARTMENTS:
        existing = await conn.fetchrow(
            "SELECT id FROM org_structure WHERE tenant_id=$1 AND code=$2",
            uuid.UUID(tenant_id), dept["code"],
        )
        if existing:
            dept_ids[dept["code"]] = str(existing["id"])
            print(f"  SKIP dept {dept['code']} (exists)")
        else:
            node_id = uid()
            dept_ids[dept["code"]] = node_id
            if apply:
                await conn.execute("""
                    INSERT INTO org_structure
                        (id, tenant_id, node_type, name, code, parent_id, is_active, created_at)
                    VALUES ($1,$2,$3,$4,$5,NULL,true,$6)
                """,
                    uuid.UUID(node_id), uuid.UUID(tenant_id),
                    dept["node_type"], dept["name"], dept["code"], datetime.now(timezone.utc),
                )
            print(f"  {'CREATED' if apply else 'WOULD CREATE'} dept {dept['code']} — {dept['name']}")

    # ── 3. Approval roles ─────────────────────────────────────────
    print("\n[3/6] Approval roles...")
    role_ids: dict[str, str] = {}  # code -> approval_role id
    for role in DEMO_ROLES:
        existing = await conn.fetchrow(
            "SELECT id FROM approval_roles WHERE tenant_id=$1 AND code=$2",
            uuid.UUID(tenant_id), role["code"],
        )
        if existing:
            role_ids[role["code"]] = str(existing["id"])
            print(f"  SKIP role {role['code']} (exists)")
        else:
            role_id = uid()
            role_ids[role["code"]] = role_id
            dept_id = dept_ids.get(role["dept"])
            if apply:
                await conn.execute("""
                    INSERT INTO approval_roles
                        (id, tenant_id, name, code, grade, cost_center_id, display_order, is_active, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)
                """,
                    uuid.UUID(role_id), uuid.UUID(tenant_id),
                    role["name"], role["code"], role["grade"],
                    uuid.UUID(dept_id) if dept_id else None,
                    role["order"], datetime.now(timezone.utc),
                )
            print(f"  {'CREATED' if apply else 'WOULD CREATE'} role {role['code']} — {role['name']}")

    # ── 4. Chart of Accounts ──────────────────────────────────────
    print("\n[4/6] Chart of accounts...")
    coa_ids: dict[str, str] = {}  # gl_number -> coa id
    for acct in DEMO_COA:
        existing = await conn.fetchrow(
            "SELECT id FROM chart_of_accounts WHERE tenant_id=$1 AND gl_number=$2",
            uuid.UUID(tenant_id), acct["gl_number"],
        )
        if existing:
            coa_ids[acct["gl_number"]] = str(existing["id"])
            print(f"  SKIP {acct['gl_number']} (exists)")
        else:
            coa_id = uid()
            coa_ids[acct["gl_number"]] = coa_id
            if apply:
                await conn.execute("""
                    INSERT INTO chart_of_accounts
                        (id, tenant_id, gl_number, gl_name, account_type, is_active, created_at)
                    VALUES ($1,$2,$3,$4,$5,true,$6)
                """,
                    uuid.UUID(coa_id), uuid.UUID(tenant_id),
                    acct["gl_number"], acct["gl_name"], acct["account_type"],
                    datetime.now(timezone.utc),
                )
            print(f"  {'CREATED' if apply else 'WOULD CREATE'} {acct['gl_number']} {acct['gl_name']}")

    # ── 5. Employees ──────────────────────────────────────────────
    print("\n[5/6] Employees...")
    emp_ids: dict[str, str] = {}  # employee_code -> employee id
    for emp in DEMO_EMPLOYEES:
        existing = await conn.fetchrow(
            "SELECT id FROM employees WHERE tenant_id=$1 AND employee_code=$2",
            uuid.UUID(tenant_id), emp["employee_code"],
        )
        if existing:
            emp_ids[emp["employee_code"]] = str(existing["id"])
            print(f"  SKIP {emp['employee_code']} {emp['first_name']} {emp['last_name']} (exists)")
        else:
            emp_id = uid()
            emp_ids[emp["employee_code"]] = emp_id
            dept_id = dept_ids.get(emp["dept"])
            role_id = role_ids.get(emp["role_code"]) if emp["role_code"] else None
            if apply:
                await conn.execute("""
                    INSERT INTO employees (
                        id, tenant_id, first_name, last_name, email,
                        employee_code, cost_center_id, approval_role_id,
                        resumption_date, is_active, created_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
                """,
                    uuid.UUID(emp_id), uuid.UUID(tenant_id),
                    emp["first_name"], emp["last_name"], emp["email"],
                    emp["employee_code"],
                    uuid.UUID(dept_id) if dept_id else None,
                    uuid.UUID(role_id) if role_id else None,
                    date(2022, 1, 10),  # resumption_date
                    datetime.now(timezone.utc),
                )
            print(f"  {'CREATED' if apply else 'WOULD CREATE'} {emp['employee_code']} {emp['first_name']} {emp['last_name']}")

    # ── 6. Expense reports ────────────────────────────────────────
    print("\n[6/6] Expense reports...")
    # Need a user_id for each employee submitter — look up via email on users table
    # Demo employees don't have user accounts, so we use a placeholder UUID for employee_id.
    # In a real trial, the SA will create user accounts; for the seed we just need the report rows.
    # We store employee_id = NULL-safe placeholder = the tenant owner's user id (first admin).
    tenant_owner = await conn.fetchrow("""
        SELECT ut.user_id FROM user_tenants ut
        WHERE ut.tenant_id = $1 AND ut.is_active = true
        ORDER BY ut.created_at ASC LIMIT 1
    """, uuid.UUID(tenant_id))
    owner_user_id = str(tenant_owner["user_id"]) if tenant_owner else None

    if not owner_user_id:
        print("  SKIP expense reports — no active user found for this tenant")
    else:
        report_seq: dict[int, int] = {}  # year -> last seq used

        def _next_report_number(report_date: date) -> str:
            yr = report_date.year
            report_seq[yr] = report_seq.get(yr, 0) + 1
            return f"EXP-{yr}-{report_seq[yr]:04d}"

        for rpt in DEMO_REPORTS:
            report_number = _next_report_number(rpt["report_date"])

            # Check if a report with same title already exists
            existing_rpt = await conn.fetchrow(
                "SELECT id FROM expense_reports WHERE tenant_id=$1 AND report_number=$2",
                uuid.UUID(tenant_id), report_number,
            )
            if existing_rpt:
                print(f"  SKIP {report_number} (exists)")
                continue

            report_id = uid()
            total = sum(ln["amount"] for ln in rpt["lines"])
            submitted_at = datetime.now(timezone.utc) if rpt["status"] in ("SUBMITTED", "APPROVED", "REJECTED") else None

            if apply:
                await conn.execute("""
                    INSERT INTO expense_reports (
                        id, tenant_id, report_number, employee_id,
                        report_date, status, currency, total_amount,
                        submitted_at, current_approval_level,
                        rejection_comment, created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,'NGN',$7,$8,$9,$10,$11,$11)
                """,
                    uuid.UUID(report_id), uuid.UUID(tenant_id), report_number,
                    uuid.UUID(owner_user_id),
                    rpt["report_date"], rpt["status"],
                    total, submitted_at,
                    1 if rpt["status"] in ("SUBMITTED", "APPROVED") else None,
                    "Exceeds entertainment policy limit. Please resubmit within ₦50,000." if rpt["status"] == "REJECTED" else None,
                    datetime.now(timezone.utc),
                )

                for i, ln in enumerate(rpt["lines"], start=1):
                    gl_id = coa_ids.get(ln["gl_number"])
                    await conn.execute("""
                        INSERT INTO expense_lines (
                            id, report_id, line_number, description, amount,
                            gl_id, created_at
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7)
                    """,
                        uuid.UUID(uid()), uuid.UUID(report_id), i,
                        ln["description"], ln["amount"],
                        uuid.UUID(gl_id) if gl_id else None,
                        datetime.now(timezone.utc),
                    )

            status_tag = f"[{rpt['status']}]"
            print(f"  {'CREATED' if apply else 'WOULD CREATE'} {report_number} {status_tag} {rpt['title']} — ₦{total:,.0f}")

    print("\n" + "=" * 60)
    print(f"{'Seed complete.' if apply else 'Dry run complete — re-run with --apply to write.'}\n")


# ── CLI ───────────────────────────────────────────────────────────────────────

async def list_trials(conn: asyncpg.Connection) -> None:
    """Print all trial tenants."""
    rows = await conn.fetch("""
        SELECT slug, name, lifecycle_status, environment, created_at
        FROM tenants
        WHERE lifecycle_status = 'trial'
        ORDER BY created_at DESC
    """)
    if not rows:
        print("No trial tenants found.")
        return
    print(f"\n{'SLUG':<30} {'NAME':<40} {'ENV':<8} {'CREATED'}")
    print("-" * 95)
    for r in rows:
        created = r["created_at"].strftime("%Y-%m-%d %H:%M") if r["created_at"] else "—"
        print(f"{r['slug']:<30} {r['name']:<40} {r['environment']:<8} {created}")
    print()


async def main() -> None:
    """Entry point — parse args, connect, dispatch."""
    parser = argparse.ArgumentParser(description="Seed demo data for a trial tenant")
    parser.add_argument("--tenant-slug", help="Slug of the trial tenant to seed")
    parser.add_argument("--list-trials", action="store_true", help="List all trial tenants and exit")
    parser.add_argument("--apply", action="store_true", help="Actually write to the database (default: dry run)")
    args = parser.parse_args()

    conn = await asyncpg.connect(_dsn())
    try:
        if args.list_trials:
            await list_trials(conn)
            return

        if not args.tenant_slug:
            parser.print_help()
            print("\nERROR: --tenant-slug is required unless --list-trials is passed.")
            sys.exit(1)

        tenant = await conn.fetchrow(
            "SELECT id, name, lifecycle_status, environment FROM tenants WHERE slug=$1",
            args.tenant_slug,
        )
        if not tenant:
            print(f"ERROR: No tenant found with slug '{args.tenant_slug}'")
            sys.exit(1)

        if tenant["lifecycle_status"] not in ("trial", "in_implementation"):
            print(
                f"WARNING: Tenant '{args.tenant_slug}' has lifecycle_status="
                f"'{tenant['lifecycle_status']}' (expected 'trial' or 'in_implementation')."
            )
            print("Proceeding anyway — pass --apply to write.")

        print(f"Tenant: {tenant['name']} ({args.tenant_slug})")
        print(f"  Status: {tenant['lifecycle_status']} | Env: {tenant['environment']}")

        async with conn.transaction():
            await seed(conn, str(tenant["id"]), apply=args.apply)

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
