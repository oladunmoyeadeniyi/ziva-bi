"""
ZivaBI — Posting Batch Pydantic schemas.

Used by: backend/app/routers/posting_batches.py

PostingBatch rows are created when tenant_org_config.posting_mode = 'connected'.
Instead of writing to journal_entries (Full ERP path), approved transactions are
serialised to JSONB and stored here as an export queue.

The finance team downloads batches as CSV/Excel and imports them into their external ERP.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


# ── Individual journal line within a batch transaction ────────────────────────


class PostingJournalLine(BaseModel):
    """One DR or CR line within a posting transaction.

    Exactly one of debit / credit is > 0; the other is 0.
    Invariant: Σdebit == Σcredit across all lines in a transaction (enforced by
    the posting service that creates the batch, same as for journal_entries).
    """

    gl_code: str
    gl_name: str
    debit: float = 0.0
    credit: float = 0.0
    description: Optional[str] = None
    dimensions: dict[str, Any] = {}


class PostingTransaction(BaseModel):
    """One logical transaction (e.g. one approved expense report) within a batch.

    A batch may contain multiple transactions (one per approved report/invoice).
    entry_date is the approval date.
    source_module: 'expense' | 'ap' | 'ar' etc.
    source_id: the UUID of the source document (expense_report.id, ap_invoice.id …).
    """

    entry_date: str          # ISO 8601 date string "YYYY-MM-DD"
    description: str
    source_module: str
    source_id: str
    lines: list[PostingJournalLine]


# ── List / detail responses ───────────────────────────────────────────────────


class PostingBatchSummary(BaseModel):
    """Lightweight batch row for list views (no transactions payload)."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    batch_ref: str
    module: str
    status: str              # pending | exported | synced
    transaction_count: int   # computed from len(transactions)
    created_at: datetime
    exported_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PostingBatchDetail(BaseModel):
    """Full batch detail including all transactions JSONB."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    batch_ref: str
    module: str
    status: str
    transactions: list[PostingTransaction]
    created_at: datetime
    exported_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── SA portal consultant config ───────────────────────────────────────────────


class TenantSystemConfig(BaseModel):
    """PATCH /api/platform/tenants/{id}/config — SA portal only.

    Consultant-only settings that are never exposed in tenant implementation pages.
    posting_mode controls which GL path all modules use for this tenant.
    module_licensing updates is_licensed per module_key.
    integration_erp is stored in tenant_org_config.org_configuration['integration_erp'].
    implementation_notes stored in tenants.implementation_notes (pending column).
    """

    posting_mode: Optional[str] = None           # 'lite' | 'connected' | 'full_erp'
    module_licensing: Optional[dict[str, bool]] = None   # {module_key: is_licensed}
    integration_erp: Optional[str] = None        # 'quickbooks' | 'xero' | 'sage' | 'sap' | 'other'
    implementation_notes: Optional[str] = None


class TenantSystemConfigResponse(BaseModel):
    """Response for GET /api/platform/tenants/{id}/config."""

    posting_mode: str
    module_licensing: dict[str, bool]
    integration_erp: Optional[str] = None
    implementation_notes: Optional[str] = None

    class Config:
        from_attributes = True
