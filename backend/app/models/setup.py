"""
ZivaBI — M8.2/M8.3 Implementation Portal ORM models.

Tables:
    implementation_locks         — consultant-locked sections per tenant
    tenant_modules               — activated modules per tenant
    document_rules               — required documents per module / transaction type
    tenant_tax_config            — tax configuration (VAT, WHT, PAYE, other statutory) as JSONB
    tenant_fx_config             — FX rates, currency list, revaluation rules as JSONB
    tenant_org_config            — organisation identity, org structure, branding, fiscal year
    org_structure                — hierarchical org nodes (M8.2 fixes)
    accounting_periods           — period state machine (M8.3 Brief 1 — replaces fiscal_periods)
    employee_onboarding_tokens   — secure self-onboarding tokens for new hires (M8.2 fixes)

All tables are tenant-scoped via tenant_id FK → tenants(id).

Period status values (accounting_periods.status):
    FUTURE      — month hasn't started yet; no posting allowed
    OPEN        — calendar-current month; posting allowed
    SOFT_CLOSED — month ended but not hard-closed; posting still allowed (Brief 2 refines this)
    OVERDUE     — informational flag: grace expired without hard-close (Brief 2 sets this)
    HARD_CLOSED — manually hard-closed; no posting allowed
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ImplementationLock(Base):
    """
    Records which portal sections a consultant has locked for a tenant.

    Each row represents one locked section. The frontend checks this table
    to decide whether to show a field as editable or locked (with the
    "Contact your Ziva BI consultant" message).

    section examples: 'organisation', 'coa', 'dimensions', 'employees'
    """

    __tablename__ = "implementation_locks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section: Mapped[str] = mapped_column(String(100), nullable=False)
    locked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    locked_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class TenantModule(Base):
    """
    Tracks which modules are activated for a tenant.

    Only activated modules appear in the Module Setup section of the sidebar
    and in the go-live readiness checklist.

    module_key values: expense, ap, ar, payroll, inventory, fixed_assets,
                       posm, vendor_portal, customer_portal, warehouse,
                       bank_recon, budget, tax_engine, reporting
    """

    __tablename__ = "tenant_modules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module_key: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # M8.2 fixes: licensed modules can be activated; unlicensed show "contact consultant"
    is_licensed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    activated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    activated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "module_key", name="uq_tenant_modules_tenant_module"
        ),
    )


class DocumentRule(Base):
    """
    Per-tenant document requirement for a given module and transaction type.

    Examples:
      module='expense', transaction_type='expense_report' → receipt required
      module='ap', transaction_type='vendor_invoice'      → invoice + PO required
    """

    __tablename__ = "document_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(100), nullable=False)
    document_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    track_expiry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ocr_template: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    max_size_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    allowed_formats: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    max_files: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TenantTaxConfig(Base):
    """
    Tenant-level tax configuration stored as JSONB blobs per tax type.

    One row per tenant (enforced by UNIQUE on tenant_id).
    JSON structures for each tax type are defined by the frontend form and
    validated at the schema layer — the model is intentionally schema-less
    so new tax rules can be added without migrations.

    vat_config: { vat_registered, standard_rate, vat_gl, input_vat_gl, ... }
    wht_config: { categories: [...], non_resident_rate, wht_gl }
    paye_config: { bands: [...], employee_pension_rate, employer_pension_rate, ... }
    other_statutory: { levies: [...] }
    """

    __tablename__ = "tenant_tax_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    vat_config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    wht_config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    paye_config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    other_statutory: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantFxConfig(Base):
    """
    Tenant-level foreign exchange configuration.

    One row per tenant (enforced by UNIQUE on tenant_id).

    additional_currencies: [{ code, name, symbol, is_active }]
    fx_rates: [{ from_currency, to_currency, rate, source, effective_date }]
    revaluation_rules: { realized_gl, unrealized_gl, month_end_revaluation, ... }
    """

    __tablename__ = "tenant_fx_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    functional_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True
    )
    reporting_currency: Mapped[Optional[str]] = mapped_column(
        String(3), nullable=True
    )
    additional_currencies: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    fx_rates: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    revaluation_rules: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantOrgConfig(Base):
    """
    Organisation identity, structure, branding, and fiscal year configuration.

    One row per tenant (enforced by UNIQUE on tenant_id).

    org_structure: tree of nodes { id, node_type, name, code, parent_code,
                                   cost_center_code, children: [...] }
    branding: { logo_url, primary_colour, button_style }
    """

    __tablename__ = "tenant_org_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    # Identity — Legal & registration
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rc_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    date_of_registration: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    commencement_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    company_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tin: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    vat_reg_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Identity — Contact & address
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    registered_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    operating_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    company_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    external_auditor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Identity — Group & currency
    group_structure: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    parent_company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    functional_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    reporting_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    authorised_share_capital: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 2), nullable=True)
    # Fiscal year
    fiscal_year_start_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fiscal_year_start_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fiscal_year_name_format: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    period_closing_frequency: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # Branding stored as JSONB
    branding: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Configuration tab — financial features, tax applicability, governance
    org_configuration: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class OrgStructureNode(Base):
    """
    Hierarchical org node (legal entity, division, department, or cost center).

    Self-referencing: parent_id → org_structure.id
    code must be unique within the tenant.
    The tree is rendered in the Organisation → Structure tab.
    """

    __tablename__ = "org_structure"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("org_structure.id"),
        nullable=True,
    )
    node_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    cost_center_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # entity_code: used for Legal entity nodes — stores the ERP profit centre or
    # entity code (e.g. Sage X3 profit centre).
    entity_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_org_structure_tenant_code"),
    )


class AccountingPeriod(Base):
    """
    An accounting period for a tenant (M8.3 Brief 1 — replaces FiscalPeriod).

    Generated by POST /api/setup/periods/generate.
    Status transitions: FUTURE → OPEN → SOFT_CLOSED → HARD_CLOSED.
    OVERDUE is a sub-state flag (Brief 2 will compute grace; it's a placeholder here).

    Unique on (tenant_id, fiscal_year, period_no) so the same ordinal can't exist twice
    for a given FY. period_no is 1-based (1–12 for monthly fiscal years).
    """

    __tablename__ = "accounting_periods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fiscal_year: Mapped[str] = mapped_column(String(20), nullable=False)
    period_no: Mapped[int] = mapped_column(Integer, nullable=False)
    period_name: Mapped[str] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Status enum values documented in module docstring above.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="FUTURE")
    hard_closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    hard_closed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Brief 2 extension points — columns added now to avoid migration churn later.
    soft_closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    grace_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Brief 4 / reopen flow — tracks how many times this period has been reopened.
    reopened_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "fiscal_year", "period_no",
            name="uq_accounting_periods_tenant_year_no"
        ),
    )


class EmployeeOnboardingToken(Base):
    """
    Secure token for new hire self-onboarding.

    HR sends an invite → system creates a pending employee record + this token.
    New hire visits /onboard/{token} to fill their details.
    HR then approves → employee becomes active from their start date.
    Token expires after 30 days and can only be used once.
    """

    __tablename__ = "employee_onboarding_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
