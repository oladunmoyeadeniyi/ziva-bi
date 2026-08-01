"""IxE — Inter-Company Eliminations (Group Consolidation).

Six new tables for group consolidation in Full ERP mode:
  consolidation_groups          — named group of entities under a parent tenant
  consolidation_members         — entity memberships + ownership percentage
  ic_account_mappings           — tags GL accounts with intercompany roles
  ic_matches                    — matched IC positions between entities
  elimination_journals          — group-level elimination journals (immutable)
  elimination_journal_lines     — lines within elimination journals

Three more tables for FX dedicated storage:
  tenant_currencies             — enabled currencies per tenant
  tenant_fx_rates               — historical exchange rates per tenant

Two more tables for Redis-like DB caching of approval inbox:
  (none — inbox uses existing tables)

One migration also adds the unified inbox endpoint support
(no new tables needed — reads existing approval tables).

Revision ID: r1s2t3u4v5w6
Chains from:  p9q0r1s2t3u4 (ICE)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "r1s2t3u4v5w6"
down_revision = "q0r1s2t3u4v5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── consolidation_groups ─────────────────────────────────────────────────
    op.create_table(
        "consolidation_groups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("parent_tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="NGN"),
        sa.Column("ic_match_tolerance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("parent_tenant_id", "name", name="uq_consolidation_groups_parent_name"),
    )

    # ── consolidation_members ────────────────────────────────────────────────
    op.create_table(
        "consolidation_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ownership_pct", sa.Numeric(5, 2), nullable=False, server_default="100.00"),
        sa.Column("joined_at", sa.Date, nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("left_at", sa.Date, nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("group_id", "member_tenant_id", name="uq_consolidation_members_group_tenant"),
    )
    op.create_index("ix_consolidation_members_group_id", "consolidation_members", ["group_id"])

    # ── ic_account_mappings ──────────────────────────────────────────────────
    op.create_table(
        "ic_account_mappings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("gl_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "ic_role", sa.String(20), nullable=False,
            # RECEIVABLE | PAYABLE | REVENUE | EXPENSE | LOAN_ASSET | LOAN_LIABILITY
        ),
        sa.Column("counterparty_tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("group_id", "member_tenant_id", "gl_account_id", name="uq_ic_account_mappings"),
        sa.CheckConstraint(
            "ic_role IN ('RECEIVABLE','PAYABLE','REVENUE','EXPENSE','LOAN_ASSET','LOAN_LIABILITY')",
            name="chk_ic_role",
        ),
    )
    op.create_index("ix_ic_account_mappings_group_member", "ic_account_mappings", ["group_id", "member_tenant_id"])

    # ── ic_matches ───────────────────────────────────────────────────────────
    op.create_table(
        "ic_matches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("accounting_periods.id"), nullable=False),
        sa.Column("debit_tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("debit_journal_line_id", UUID(as_uuid=True), sa.ForeignKey("journal_lines.id"), nullable=False),
        sa.Column("credit_tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("credit_journal_line_id", UUID(as_uuid=True), sa.ForeignKey("journal_lines.id"), nullable=False),
        sa.Column("matched_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="PROPOSED"),
        sa.Column("match_type", sa.String(10), nullable=False, server_default="AUTO"),
        sa.Column("matched_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("confirmed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("confirmed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("disputed_reason", sa.Text, nullable=True),
        sa.CheckConstraint("debit_tenant_id <> credit_tenant_id", name="chk_ic_matches_different_tenants"),
        sa.CheckConstraint("status IN ('PROPOSED','CONFIRMED','DISPUTED')", name="chk_ic_match_status"),
        sa.CheckConstraint("match_type IN ('AUTO','MANUAL')", name="chk_ic_match_type"),
    )
    op.create_index("ix_ic_matches_group_period_status", "ic_matches", ["group_id", "period_id", "status"])

    # ── elimination_journals ─────────────────────────────────────────────────
    op.create_table(
        "elimination_journals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("consolidation_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("accounting_periods.id"), nullable=False),
        sa.Column("reference", sa.String(60), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("total_dr", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_cr", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="POSTED"),
        sa.Column("reversed_by", UUID(as_uuid=True), sa.ForeignKey("elimination_journals.id"), nullable=True),
        sa.Column("posted_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("posted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.CheckConstraint("status IN ('POSTED','REVERSED')", name="chk_elimination_journal_status"),
    )
    op.create_index("ix_elimination_journals_group_period", "elimination_journals", ["group_id", "period_id"])

    # ── elimination_journal_lines ────────────────────────────────────────────
    op.create_table(
        "elimination_journal_lines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("elimination_journal_id", UUID(as_uuid=True), sa.ForeignKey("elimination_journals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ic_match_id", UUID(as_uuid=True), sa.ForeignKey("ic_matches.id"), nullable=True),
        sa.Column("member_tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("gl_account_id", UUID(as_uuid=True), sa.ForeignKey("chart_of_accounts.id"), nullable=False),
        sa.Column("debit", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("credit", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("narrative", sa.Text, nullable=True),
    )
    op.create_index("ix_elimination_journal_lines_journal_id", "elimination_journal_lines", ["elimination_journal_id"])

    # ── tenant_currencies ────────────────────────────────────────────────────
    op.create_table(
        "tenant_currencies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("is_functional", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_reporting", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("tenant_id", "currency", name="uq_tenant_currencies_tenant_currency"),
    )
    op.create_index("ix_tenant_currencies_tenant_id", "tenant_currencies", ["tenant_id"])

    # ── tenant_fx_rates ──────────────────────────────────────────────────────
    op.create_table(
        "tenant_fx_rates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_currency", sa.String(3), nullable=False),
        sa.Column("to_currency", sa.String(3), nullable=False),
        sa.Column("rate", sa.Numeric(20, 6), nullable=False),
        sa.Column("rate_type", sa.String(20), nullable=False, server_default="SPOT"),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="MANUAL"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("rate_type IN ('SPOT','CLOSING','AVERAGE','BUDGET')", name="chk_fx_rate_type"),
        sa.CheckConstraint("rate > 0", name="chk_fx_rate_positive"),
    )
    op.create_index(
        "ix_tenant_fx_rates_lookup",
        "tenant_fx_rates",
        ["tenant_id", "from_currency", "to_currency", "effective_date"],
    )


def downgrade() -> None:
    op.drop_table("tenant_fx_rates")
    op.drop_table("tenant_currencies")
    op.drop_table("elimination_journal_lines")
    op.drop_table("elimination_journals")
    op.drop_table("ic_matches")
    op.drop_table("ic_account_mappings")
    op.drop_table("consolidation_members")
    op.drop_table("consolidation_groups")
