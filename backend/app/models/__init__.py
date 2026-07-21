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
