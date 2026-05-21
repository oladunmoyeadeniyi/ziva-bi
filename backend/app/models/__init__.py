"""
ZivaBI models package.

Import every model module here so that Alembic's autogenerate can detect
all tables when it inspects Base.metadata. The alembic/env.py file imports
this package, so any model not imported here will be invisible to migrations.
"""

import app.models.auth      # noqa: F401  — registers auth tables with Base.metadata
import app.models.expenses  # noqa: F401  — registers expense tables with Base.metadata
import app.models.approvals # noqa: F401  — registers approval workflow tables with Base.metadata
import app.models.documents # noqa: F401  — registers expense_documents table with Base.metadata
