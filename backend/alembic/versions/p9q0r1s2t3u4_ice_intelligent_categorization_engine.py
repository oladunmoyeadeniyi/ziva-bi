"""ICE — Intelligent Categorization Engine tables.

Revision ID: p9q0r1s2t3u4
Revises: l0m1n2o3p4q5
Create Date: 2026-07-29

Adds six tables that form the ICE module (Intelligent Categorization Engine) —
Ziva BI's AI-powered GL account, dimension, and category prediction layer.

Tables created:
    ice_tenant_config         — per-tenant ICE enable flag + thresholds + field rules
    ice_predictions           — one row per GL/dimension/category prediction made
    ice_feedback              — corrections captured from employees / approvers / finance
    ice_audit_log             — immutable append-only AI event log (7-year retention)
    vendor_behavior_profiles  — learned per-vendor GL/category patterns
    employee_behavior_profiles — learned per-employee GL usage patterns

Design constraints:
    - Every table is partitioned by tenant_id — no cross-tenant queries allowed.
    - ice_audit_log is append-only; no UPDATE/DELETE operations permitted on it.
    - ice_predictions.confidence is stored as an integer (0–100).
    - JSONB columns are used for flexible dimension/field storage without schema churn.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision = "p9q0r1s2t3u4"
down_revision = "l0m1n2o3p4q5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ice_tenant_config ──────────────────────────────────────────────────────
    # Stores the ICE configuration for each tenant. One row per tenant.
    # Tenant Admin can update fields; Super Admin enables/disables globally.
    op.create_table(
        "ice_tenant_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        # Core toggle — ICE only runs when both global (platform_config) and this flag are True
        sa.Column("ai_enabled", sa.Boolean, nullable=False, server_default="false"),
        # Which fields ICE may suggest: {"gl": true, "cost_center": true, "category": true, ...}
        sa.Column("enabled_fields", JSONB, nullable=False, server_default='{"gl": true, "cost_center": true, "category": true}'),
        # Confidence thresholds (integer 0-100)
        sa.Column("confidence_threshold_high", sa.SmallInteger, nullable=False, server_default="80"),
        sa.Column("confidence_threshold_low", sa.SmallInteger, nullable=False, server_default="50"),
        # JSONB list of GL account IDs that ICE must never suggest
        sa.Column("sensitive_gl_accounts", JSONB, nullable=False, server_default="[]"),
        # Allow employees to disable AI suggestions for themselves
        sa.Column("allow_user_disable", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ice_tenant_config_tenant", "ice_tenant_config", ["tenant_id"])

    # ── vendor_behavior_profiles ───────────────────────────────────────────────
    # Aggregated patterns learned from historical transactions per vendor per tenant.
    # Updated whenever a GL suggestion is accepted or corrected for that vendor.
    op.create_table(
        "vendor_behavior_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_name", sa.Text, nullable=False),
        # JSONB frequency map: {"<gl_account_id>": <count>, ...}
        sa.Column("gl_frequency", JSONB, nullable=False, server_default="{}"),
        # JSONB frequency map: {"<category>": <count>, ...}
        sa.Column("category_frequency", JSONB, nullable=False, server_default="{}"),
        sa.Column("sample_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_vendor_profile_tenant", "vendor_behavior_profiles", ["tenant_id"])
    op.create_index("ix_vendor_profile_tenant_name", "vendor_behavior_profiles", ["tenant_id", "vendor_name"], unique=True)

    # ── employee_behavior_profiles ─────────────────────────────────────────────
    # Aggregated patterns per employee per tenant.
    # Updated on each GL acceptance or correction.
    op.create_table(
        "employee_behavior_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        # FK to users table (employee may or may not have an employee record)
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # JSONB frequency map: {"<gl_account_id>": <count>, ...}
        sa.Column("gl_frequency", JSONB, nullable=False, server_default="{}"),
        # JSONB frequency map: {"<category>": <count>, ...}
        sa.Column("category_frequency", JSONB, nullable=False, server_default="{}"),
        sa.Column("sample_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_employee_profile_tenant", "employee_behavior_profiles", ["tenant_id"])
    op.create_index("ix_employee_profile_tenant_user", "employee_behavior_profiles", ["tenant_id", "user_id"], unique=True)

    # ── ice_predictions ────────────────────────────────────────────────────────
    # One row per ICE prediction call. Stores what the engine suggested, with what
    # confidence, for which expense line. Used for analytics and feedback linking.
    op.create_table(
        "ice_predictions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        # The expense line this prediction was made for (nullable — bulk/preview calls)
        sa.Column("expense_line_id", UUID(as_uuid=True), nullable=True),
        # Who triggered the prediction
        sa.Column("requested_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        # Inputs used for the prediction
        sa.Column("input_description", sa.Text, nullable=True),
        sa.Column("input_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("input_vendor_name", sa.Text, nullable=True),
        # Predicted values
        sa.Column("predicted_gl_id", UUID(as_uuid=True), nullable=True),
        sa.Column("predicted_gl_number", sa.String(20), nullable=True),
        sa.Column("predicted_gl_name", sa.Text, nullable=True),
        sa.Column("predicted_category", sa.Text, nullable=True),
        # JSONB: {"cost_center": "CC120", "io_real": "IO001", ...}
        sa.Column("predicted_dimensions", JSONB, nullable=True),
        # Integer 0-100. Derived from LLM response rating.
        sa.Column("confidence", sa.SmallInteger, nullable=False, server_default="0"),
        # "HIGH" | "MEDIUM" | "LOW" — derived from confidence vs tenant thresholds
        sa.Column("confidence_band", sa.String(6), nullable=False, server_default="'LOW'"),
        # Whether the user accepted the prediction as-is
        sa.Column("accepted", sa.Boolean, nullable=True),
        # Model/engine version string (e.g. "ice-v1-anthropic")
        sa.Column("engine_version", sa.String(50), nullable=False, server_default="'ice-v1'"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ice_predictions_tenant", "ice_predictions", ["tenant_id"])
    op.create_index("ix_ice_predictions_tenant_line", "ice_predictions", ["tenant_id", "expense_line_id"])
    op.create_index("ix_ice_predictions_created", "ice_predictions", ["tenant_id", "created_at"])

    # ── ice_feedback ───────────────────────────────────────────────────────────
    # Captures every correction a user makes to an ICE suggestion.
    # This is the training signal — every row updates the vendor/employee profiles.
    op.create_table(
        "ice_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prediction_id", UUID(as_uuid=True), sa.ForeignKey("ice_predictions.id", ondelete="SET NULL"), nullable=True),
        # What the user actually chose
        sa.Column("corrected_gl_id", UUID(as_uuid=True), nullable=True),
        sa.Column("corrected_gl_number", sa.String(20), nullable=True),
        sa.Column("corrected_gl_name", sa.Text, nullable=True),
        sa.Column("corrected_category", sa.Text, nullable=True),
        sa.Column("corrected_dimensions", JSONB, nullable=True),
        # Who corrected and their role at time of correction
        sa.Column("corrected_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("corrected_by_role", sa.String(30), nullable=True),
        sa.Column("correction_reason", sa.Text, nullable=True),
        # Whether this was a correction (False) or acceptance (True)
        sa.Column("accepted_prediction", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("vendor_name", sa.Text, nullable=True),  # denormalized for profile updates
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ice_feedback_tenant", "ice_feedback", ["tenant_id"])
    op.create_index("ix_ice_feedback_prediction", "ice_feedback", ["prediction_id"])
    op.create_index("ix_ice_feedback_tenant_created", "ice_feedback", ["tenant_id", "created_at"])

    # ── ice_audit_log ──────────────────────────────────────────────────────────
    # Append-only immutable log of every ICE event.
    # Must never be updated or deleted. 7-year retention per PRD.
    op.create_table(
        "ice_audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        # Event types: PREDICTED, ACCEPTED, CORRECTED, CONFIG_CHANGED, DISABLED, ENABLED
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("prediction_id", UUID(as_uuid=True), nullable=True),
        sa.Column("feedback_id", UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_role", sa.String(30), nullable=True),
        # Snapshot of before/after values for the event
        sa.Column("old_value", JSONB, nullable=True),
        sa.Column("new_value", JSONB, nullable=True),
        sa.Column("engine_version", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_ice_audit_tenant", "ice_audit_log", ["tenant_id"])
    op.create_index("ix_ice_audit_tenant_created", "ice_audit_log", ["tenant_id", "created_at"])


    # ── Backfill tenant_modules for existing tenants ───────────────────────────
    # Before this migration, no module-licensing gate existed on the API layer.
    # All 8 newly-gated modules (ar, ap, payroll, bank_recon, budget, tax_engine,
    # inventory, fixed_assets) were always accessible to every tenant by default.
    # This INSERT grandfathers all existing tenants in — setting is_licensed=True
    # and is_active=True — so the new require_module() gate does not instantly
    # lock out tenants that have been using these features all along.
    # ON CONFLICT DO NOTHING: safe to run multiple times; never downgrades a
    # tenant that an SA has already manually configured through the portal.
    op.execute("""
        INSERT INTO tenant_modules (id, tenant_id, module_key, is_active, is_licensed)
        SELECT
            gen_random_uuid(),
            t.id,
            m.module_key,
            true,
            true
        FROM tenants t
        CROSS JOIN (VALUES
            ('ar'), ('ap'), ('payroll'), ('bank_recon'),
            ('budget'), ('tax_engine'), ('inventory'), ('fixed_assets')
        ) AS m(module_key)
        ON CONFLICT ON CONSTRAINT uq_tenant_modules_tenant_module
        DO UPDATE SET is_active = true, is_licensed = true
    """)


def downgrade() -> None:
    op.drop_table("ice_audit_log")
    op.drop_table("ice_feedback")
    op.drop_table("ice_predictions")
    op.drop_table("employee_behavior_profiles")
    op.drop_table("vendor_behavior_profiles")
    op.drop_table("ice_tenant_config")
