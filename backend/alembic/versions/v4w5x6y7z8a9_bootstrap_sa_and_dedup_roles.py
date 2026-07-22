"""Bootstrap super-admin account and deduplicate system roles.

Why this migration exists:
  Production DB accumulated duplicate system roles (e.g. two 'tenant_admin' rows
  with tenant_id IS NULL) because _ensure_system_roles() ran multiple times before
  a dedup guard was in place. This migration:
  1. Deduplicates all system roles (safe, idempotent — no-op if already clean).
  2. Promotes the platform owner email to is_super_admin = true.

This is a one-time data migration. It makes no schema changes.

Revision ID: v4w5x6y7z8a9
Revises: u3v4w5x6y7z8
"""

from __future__ import annotations

import logging

from alembic import op

# revision identifiers, used by Alembic.
revision = "v4w5x6y7z8a9"
down_revision = "u3v4w5x6y7z8"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    """
    1. Dedup system roles: for each role name with tenant_id IS NULL,
       keep the oldest row, re-point user_roles + role_permissions to it,
       then delete the duplicates.
    2. Promote platform owner email to is_super_admin = true.
    """

    # ── 1. Deduplicate system roles ─────────────────────────────────────────
    op.execute(
        """
        DO $$
        DECLARE
            rname TEXT;
            keeper_id UUID;
        BEGIN
            FOR rname IN
                SELECT name
                FROM roles
                WHERE tenant_id IS NULL
                GROUP BY name
                HAVING COUNT(*) > 1
            LOOP
                -- Pick the earliest-created row as the canonical one
                SELECT id INTO keeper_id
                FROM roles
                WHERE name = rname AND tenant_id IS NULL
                ORDER BY created_at
                LIMIT 1;

                -- Re-point user_roles away from duplicates
                UPDATE user_roles
                SET role_id = keeper_id
                WHERE role_id IN (
                    SELECT id FROM roles
                    WHERE name = rname AND tenant_id IS NULL AND id <> keeper_id
                );

                -- Re-point role_permissions away from duplicates
                UPDATE role_permissions
                SET role_id = keeper_id
                WHERE role_id IN (
                    SELECT id FROM roles
                    WHERE name = rname AND tenant_id IS NULL AND id <> keeper_id
                );

                -- Delete the duplicates
                DELETE FROM roles
                WHERE name = rname AND tenant_id IS NULL AND id <> keeper_id;

                RAISE NOTICE 'Deduped system role: %', rname;
            END LOOP;
        END $$;
        """
    )

    # ── 2. Promote platform owner to super-admin ────────────────────────────
    op.execute(
        """
        UPDATE users
        SET is_super_admin = true
        WHERE email = 'adeniyioladunmoye@gmail.com'
        AND is_super_admin = false;
        """
    )


def downgrade() -> None:
    """
    Downgrade is intentionally a no-op:
    - Role dedup cannot be safely reversed (we don't know which rows were deleted).
    - Removing SA flag would lock the owner out; must be done manually if needed.
    """
    pass
