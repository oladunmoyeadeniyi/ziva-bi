"""Pydantic schemas for consultant lock endpoints.

Two schemas:
  ConsultantLockRead   — returned by GET /api/locks and PUT /api/locks/{key}
  ConsultantLockUpsert — body of PUT /api/locks/{key} (consultant only)
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ConsultantLockRead(BaseModel):
    """Lock state for a single section — returned to any authenticated user.

    Attributes:
        section_key:   Which section this lock applies to.
        is_locked:     True = section is currently locked by a consultant.
        lock_note:     Optional message the consultant left.
        locked_by_id:  UUID of the SA user who last set the lock (for audit).
        locked_at:     Timestamp of the last lock action.
        unlocked_at:   Timestamp of the last unlock action (None if still locked).
    """

    section_key: str
    is_locked: bool
    lock_note: str | None = None
    locked_by_id: uuid.UUID | None = None
    locked_at: datetime
    unlocked_at: datetime | None = None

    model_config = {"from_attributes": True}


class ConsultantLockUpsert(BaseModel):
    """Payload for creating or updating a lock.

    Sent by a consultant (SA in implementation mode) to lock or unlock a
    setup section.

    Attributes:
        is_locked:  True to lock, False to unlock.
        lock_note:  Optional message explaining the lock reason.
                    Pass null to clear an existing note.
    """

    is_locked: bool = Field(..., description="True = lock the section; False = unlock.")
    lock_note: str | None = Field(
        None,
        max_length=500,
        description="Optional message displayed to the client explaining the lock.",
    )


class LocksResponse(BaseModel):
    """Complete lock state for all sections — returned by GET /api/locks.

    Attributes:
        locks:  Map of section_key → lock record. Sections with no DB row
                are NOT included; the frontend treats an absent key as unlocked.
    """

    locks: dict[str, ConsultantLockRead]
