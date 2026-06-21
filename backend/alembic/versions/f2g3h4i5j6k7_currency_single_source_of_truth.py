"""Currency single source of truth — consolidate to tenant_org_config

Revision ID: f2g3h4i5j6k7
Revises: e1f2g3h4i5j6
Create Date: 2026-06-20

Principle: ONE source of truth for which currencies a tenant transacts in.
tenant_org_config gains enabled_currencies (JSONB list of ISO codes).
tenant_fx_config loses functional_currency, additional_currencies, and
reporting_currency (reporting_currency already existed on tenant_org_config
and is now the sole copy).

Migration steps:
  1. Add enabled_currencies JSONB to tenant_org_config.
  2. Sync tenant_org_config.reporting_currency from tenant_fx_config
     for any tenant whose org row has no reporting_currency yet.
  3. Backfill enabled_currencies by UNION-ing four sources so no tenant
     loses a currency:
       a. tenant_org_config.functional_currency
       b. tenant_fx_config.reporting_currency (before drop)
       c. active codes in tenant_fx_config.additional_currencies
       d. distinct tenant bank_accounts.currency in use
  4. Drop functional_currency, additional_currencies, reporting_currency
     from tenant_fx_config (all now redundant).

Downgrade re-adds the three columns and reconstructs them from org_config.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "f2g3h4i5j6k7"
down_revision = "e1f2g3h4i5j6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Add enabled_currencies to tenant_org_config ────────────────────────
    op.add_column(
        "tenant_org_config",
        sa.Column("enabled_currencies", JSONB, nullable=True),
    )

    # ── 2. Sync reporting_currency into org_config where it is still null ─────
    # The Currencies & FX tab historically wrote reporting_currency to fx_config,
    # while the Organisation tab wrote it to org_config. Reconcile before the
    # fx_config column is dropped.
    op.execute("""
        UPDATE tenant_org_config AS toc
        SET    reporting_currency = tfx.reporting_currency
        FROM   tenant_fx_config tfx
        WHERE  tfx.tenant_id         = toc.tenant_id
          AND  toc.reporting_currency IS NULL
          AND  tfx.reporting_currency IS NOT NULL
          AND  tfx.reporting_currency != ''
    """)

    # ── 3. Backfill enabled_currencies ────────────────────────────────────────
    # For each org_config row, merge all currency sources and produce a sorted,
    # de-duplicated JSONB array of ISO codes.
    op.execute("""
        UPDATE tenant_org_config AS toc
        SET    enabled_currencies = (
            SELECT jsonb_agg(curr ORDER BY curr)
            FROM (
                SELECT DISTINCT curr
                FROM (
                    -- a) functional currency from org_config itself
                    SELECT toc.functional_currency AS curr
                    WHERE  toc.functional_currency IS NOT NULL
                       AND toc.functional_currency != ''

                    UNION ALL

                    -- b) reporting_currency from fx_config (before drop)
                    SELECT tfx.reporting_currency
                    FROM   tenant_fx_config tfx
                    WHERE  tfx.tenant_id         = toc.tenant_id
                      AND  tfx.reporting_currency IS NOT NULL
                      AND  tfx.reporting_currency != ''

                    UNION ALL

                    -- c) active additional_currencies from fx_config
                    -- Guard: additional_currencies may be stored as the JSONB literal
                    -- 'null' (not SQL NULL) when the column was never populated.
                    -- COALESCE does not catch JSON-null; jsonb_typeof does.
                    SELECT elem->>'code'
                    FROM   tenant_fx_config tfx,
                           jsonb_array_elements(
                               CASE WHEN jsonb_typeof(tfx.additional_currencies) = 'array'
                                    THEN tfx.additional_currencies
                                    ELSE '[]'::jsonb
                               END
                           ) AS elem
                    WHERE  tfx.tenant_id       = toc.tenant_id
                      AND  (elem->>'is_active') = 'true'
                      AND  (elem->>'code')      IS NOT NULL
                      AND  (elem->>'code')      != ''

                    UNION ALL

                    -- d) currencies in active use from bank_accounts
                    SELECT ba.currency
                    FROM   bank_accounts ba
                    WHERE  ba.tenant_id = toc.tenant_id
                      AND  ba.currency  IS NOT NULL
                      AND  ba.currency  != ''
                ) src(curr)
                WHERE curr IS NOT NULL AND curr != ''
            ) deduped(curr)
        )
    """)

    # ── 4. Drop redundant columns from tenant_fx_config ───────────────────────
    # functional_currency: authority is tenant_org_config.functional_currency.
    # additional_currencies: replaced by tenant_org_config.enabled_currencies.
    # reporting_currency: authority is tenant_org_config.reporting_currency.
    op.drop_column("tenant_fx_config", "functional_currency")
    op.drop_column("tenant_fx_config", "additional_currencies")
    op.drop_column("tenant_fx_config", "reporting_currency")


def downgrade() -> None:
    # Re-add the three columns to tenant_fx_config, then reconstruct them
    # from tenant_org_config so a downgrade leaves the tables consistent.

    op.add_column(
        "tenant_fx_config",
        sa.Column("reporting_currency", sa.String(3), nullable=True),
    )
    op.add_column(
        "tenant_fx_config",
        sa.Column("additional_currencies", JSONB, nullable=True),
    )
    op.add_column(
        "tenant_fx_config",
        sa.Column("functional_currency", sa.String(3), nullable=True),
    )

    # Restore functional_currency and reporting_currency from org_config
    op.execute("""
        UPDATE tenant_fx_config AS tfx
        SET    functional_currency = toc.functional_currency,
               reporting_currency  = toc.reporting_currency
        FROM   tenant_org_config toc
        WHERE  toc.tenant_id = tfx.tenant_id
    """)

    # Reconstruct additional_currencies from enabled_currencies, excluding
    # the functional currency (it was never in additional_currencies).
    op.execute("""
        UPDATE tenant_fx_config AS tfx
        SET    additional_currencies = (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'code',         curr,
                    'name',         curr,
                    'symbol',       '',
                    'is_active',    true
                )
                ORDER BY curr
            )
            FROM (
                SELECT elem::text AS curr
                FROM   jsonb_array_elements_text(
                           CASE WHEN jsonb_typeof(toc.enabled_currencies) = 'array'
                                THEN toc.enabled_currencies
                                ELSE '[]'::jsonb
                           END
                       ) AS elem
                WHERE  elem IS DISTINCT FROM toc.functional_currency
            ) t
        )
        FROM   tenant_org_config toc
        WHERE  toc.tenant_id            = tfx.tenant_id
          AND  toc.enabled_currencies   IS NOT NULL
    """)

    # Remove the column added in upgrade
    op.drop_column("tenant_org_config", "enabled_currencies")
