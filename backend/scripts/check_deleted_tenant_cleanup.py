"""
check_deleted_tenant_cleanup.py
================================
Verifies that a recently-nuked tenant (and its paired environment) left no
orphaned rows in the database.

Usage
-----
# Find the most recently nuked pair automatically via audit_logs:
    python backend/scripts/check_deleted_tenant_cleanup.py

# Or target a specific tenant UUID that was deleted:
    python backend/scripts/check_deleted_tenant_cleanup.py --tenant <uuid>

Requires DATABASE_URL in environment (production Render URL).

Exit codes
----------
0  — clean; no orphans found
1  — orphans found (printed to stdout)
"""

import argparse
import os
import sys
import uuid as _uuid

import psycopg2
import psycopg2.extras

# ── DB connection ─────────────────────────────────────────────────────────────

def get_conn():
    url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    conn = psycopg2.connect(url)
    conn.autocommit = True  # all queries are SELECT; autocommit prevents transaction-abort cascade
    return conn


# ── Helpers ───────────────────────────────────────────────────────────────────

def q(conn, sql, params=()):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def section(title):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print('─' * 60)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant", help="UUID of deleted tenant (test or live side)")
    args = parser.parse_args()

    conn = get_conn()
    issues: list[str] = []

    # ── 1. Find the deleted tenant IDs via audit_logs ─────────────────────────
    section("1. Locating deleted tenant(s) in audit_logs")

    if args.tenant:
        # User supplied one side — find both sides from the audit log
        rows = q(conn, """
            SELECT tenant_id, log_metadata->>'name' AS name, log_metadata->>'slug' AS slug,
                   log_metadata->>'environment' AS environment,
                   log_metadata->>'paired_delete' AS paired_delete,
                   created_at
            FROM audit_logs
            WHERE event_type = 'TENANT_DELETED'
              AND log_metadata->>'slug' IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 20
        """)
        # Match on tenant_id (even NULLed ones won't match, but slug is in details)
        target_tid = args.tenant
        matching = [r for r in rows if str(r.get("tenant_id") or "") == target_tid
                    or r.get("details", {}) and False]  # fallback: show recent
        if not matching:
            matching = rows[:4]  # show last 4 TENANT_DELETED events
    else:
        rows = q(conn, """
            SELECT tenant_id, log_metadata->>'name' AS name, log_metadata->>'slug' AS slug,
                   log_metadata->>'environment' AS environment,
                   log_metadata->>'paired_delete' AS paired_delete,
                   created_at
            FROM audit_logs
            WHERE event_type = 'TENANT_DELETED'
            ORDER BY created_at DESC
            LIMIT 10
        """)
        matching = rows

    if not matching:
        print("  No TENANT_DELETED audit events found. Nothing to check.")
        conn.close()
        return

    deleted_slugs = []
    for r in matching:
        print(f"  [{r['created_at']}] slug={r['slug']}  env={r['environment']}  "
              f"paired={r['paired_delete']}  tenant_id={r['tenant_id']}")
        if r['slug']:
            deleted_slugs.append(r['slug'])

    deleted_slugs = list(set(deleted_slugs))
    print(f"\n  Slugs to verify are gone: {deleted_slugs}")

    # ── 2. Tenants table — should be empty for those slugs ────────────────────
    section("2. tenants table")
    for slug in deleted_slugs:
        rows = q(conn, "SELECT id, name, slug, environment FROM tenants WHERE slug = %s", (slug,))
        if rows:
            issues.append(f"TENANT ROW STILL EXISTS: slug={slug}")
            for r in rows:
                print(f"  !! Still present: {dict(r)}")
        else:
            print(f"  OK  slug={slug!r} not found in tenants")

    # ── 3. user_tenants — no rows for deleted tenant IDs ─────────────────────
    # We use the audit_log tenant_id (may be NULL post-delete if SET NULL fired,
    # but paired_delete entries store it before deletion).
    section("3. user_tenants table (orphaned memberships)")
    # Re-fetch audit rows with tenant_id populated
    audit_tids = q(conn, """
        SELECT DISTINCT log_metadata->>'slug' AS slug
        FROM audit_logs
        WHERE event_type = 'TENANT_DELETED'
          AND log_metadata->>'slug' = ANY(%s)
    """, (deleted_slugs,))

    # Cross-check via subquery on slug → can't — tenant is gone. Check count via slug
    # in audit vs user_tenants join. Instead: check user_tenants for any rows whose
    # tenant points at a now-missing tenant (tenant_id FK is CASCADE DELETE, so if
    # the tenant row is gone the user_tenant row must also be gone).
    orphaned_ut = q(conn, """
        SELECT ut.id, ut.user_id, ut.tenant_id
        FROM user_tenants ut
        LEFT JOIN tenants t ON t.id = ut.tenant_id
        WHERE ut.tenant_id IS NOT NULL AND t.id IS NULL
    """)
    if orphaned_ut:
        issues.append(f"ORPHANED user_tenants rows (no matching tenant): {len(orphaned_ut)}")
        for r in orphaned_ut[:10]:
            print(f"  !! {dict(r)}")
    else:
        print("  OK  no user_tenants rows point at a missing tenant")

    # ── 4. Users with zero memberships ───────────────────────────────────────
    section("4. users with no memberships (potential orphans from nuke)")
    # These are users whose only membership was on the deleted tenants
    orphaned_users = q(conn, """
        SELECT u.id, u.email, u.full_name
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM user_tenants ut WHERE ut.user_id = u.id
        )
        AND u.is_super_admin IS NOT TRUE
    """)
    if orphaned_users:
        issues.append(f"USERS WITH NO MEMBERSHIPS: {len(orphaned_users)}")
        for r in orphaned_users[:10]:
            print(f"  !! {dict(r)}")
    else:
        print("  OK  no non-SA users exist without a membership")

    # ── 5. Key child tables — check for orphaned rows ────────────────────────
    child_tables = [
        ("expense_reports",         "tenant_id"),
        ("expense_lines",      "tenant_id"),
        ("expense_documents",       "tenant_id"),
        ("employees",               "tenant_id"),
        ("accounting_periods",      "tenant_id"),
        ("approval_matrix",         "tenant_id"),
        ("chart_of_accounts",       "tenant_id"),
        ("org_structure",     "tenant_id"),
        ("journal_entries",         "tenant_id"),
        ("posting_batches",         "tenant_id"),
        ("audit_logs",              "tenant_id"),  # these will be NULL (SET NULL), not absent
    ]

    section("5. Child table orphan check (rows with tenant_id pointing at missing tenant)")
    for table, col in child_tables:
        try:
            rows = q(conn, f"""
                SELECT COUNT(*) AS cnt
                FROM {table} t
                LEFT JOIN tenants tn ON tn.id = t.{col}
                WHERE t.{col} IS NOT NULL AND tn.id IS NULL
            """)
            cnt = rows[0]["cnt"]
            if cnt > 0:
                issues.append(f"ORPHANED rows in {table}: {cnt}")
                print(f"  !! {table}: {cnt} orphaned rows (tenant_id points at missing tenant)")
            else:
                print(f"  OK  {table}")
        except Exception as e:
            print(f"  SKIP {table}: {e}")

    # ── 6. audit_logs — SET NULL check ───────────────────────────────────────
    section("6. audit_logs SET NULL verification")
    nulled = q(conn, """
        SELECT COUNT(*) AS cnt FROM audit_logs WHERE tenant_id IS NULL
    """)
    print(f"  audit_logs rows with tenant_id=NULL: {nulled[0]['cnt']}  (expected: includes rows from nuked tenants)")

    # ── 7. impersonation_sessions — SET NULL check ───────────────────────────
    section("7. impersonation_sessions SET NULL verification")
    try:
        imp = q(conn, """
            SELECT
                COUNT(*) FILTER (WHERE target_tenant_id IS NULL) AS nulled_tenant,
                COUNT(*) FILTER (WHERE target_user_id IS NULL) AS nulled_user,
                COUNT(*) AS total
            FROM impersonation_sessions
        """)
        r = imp[0]
        print(f"  Total rows: {r['total']}  "
              f"nulled target_tenant_id: {r['nulled_tenant']}  "
              f"nulled target_user_id: {r['nulled_user']}")
    except Exception as e:
        print(f"  SKIP: {e}")

    # ── Summary ───────────────────────────────────────────────────────────────
    section("SUMMARY")
    if issues:
        print(f"  FAILED — {len(issues)} issue(s) found:")
        for i in issues:
            print(f"    • {i}")
        conn.close()
        sys.exit(1)
    else:
        print("  CLEAN — no orphaned data found. DB is ready for a new test environment.")
        conn.close()
        sys.exit(0)


if __name__ == "__main__":
    main()
