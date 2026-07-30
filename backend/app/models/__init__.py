"""
ZivaBI models package.

Import every model module here so that Alembic's autogenerate can detect
all tables when it inspects Base.metadata. The alembic/env.py file imports
this package, so any model not imported here will be invisible to migrations.
"""

import app.models.auth             # noqa: F401  — registers auth tables with Base.metadata
import app.models.expenses         # noqa: F401  — registers expense tables with Base.metadata
import app.models.approvals        # noqa: F401  — registers approval workflow tables with Base.metadata
import app.models.documents        # noqa: F401  — registers expense_documents table with Base.metadata
import app.models.master_data      # noqa: F401  — registers CoA, dimensions, employees with Base.metadata
import app.models.setup            # noqa: F401  — registers periods, org config, checklists with Base.metadata
import app.models.gl               # noqa: F401  — registers journal_entries, journal_lines with Base.metadata
import app.models.account_mapping  # noqa: F401  — registers posting_roles, tenant_account_mappings with Base.metadata
import app.models.bank_account     # noqa: F401  — registers bank_accounts with Base.metadata
import app.models.tenant_management  # noqa: F401  — registers tenant_invitations + related tables with Base.metadata
import app.models.platform_config    # noqa: F401  — registers platform_config table with Base.metadata
import app.models.ap                 # noqa: F401  — registers vendors, ap_invoices, ap_invoice_lines, ap_approvals, ap_invoice_snapshots
import app.models.po                 # noqa: F401  — registers purchase_orders, grn, ap_invoice_po_matches, po_tolerance_config
import app.models.bank_recon          # noqa: F401  — registers bank_statements, bank_statement_lines, bank_recon_matches
import app.models.ai                  # noqa: F401  — registers ai_predictions, ai_learning_overrides, ai_insights
import app.models.ar                  # noqa: F401  — registers customers, ar_invoices, ar_invoice_lines, ar_approvals, ar_invoice_snapshots
import app.models.budget               # noqa: F401  — registers budget_periods, budget_lines
import app.models.billing              # noqa: F401  — registers pricing_plans, tenant_subscriptions, billing_events
import app.models.tax_engine           # noqa: F401  — registers tax_returns, wht_certificates
import app.models.payroll              # noqa: F401  — registers salary_structures, payroll_runs, payroll_lines, payslips, leave_types, leave_requests, leave_balances
import app.models.fixed_assets         # noqa: F401  — registers asset_categories, assets, asset_depreciation_schedules, asset_disposals
import app.models.inventory             # noqa: F401  — registers inventory_categories, inventory_locations, inventory_items, stock_movements
import app.models.ice                  # noqa: F401  — registers ice_tenant_config, ice_predictions, ice_feedback, ice_audit_log, vendor/employee profiles
