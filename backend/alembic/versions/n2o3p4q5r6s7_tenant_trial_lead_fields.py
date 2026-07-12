"""tenant: add company_size and interested_modules for trial lead capture

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2026-07-12

Why
---
The public signup form now captures two additional fields to help the SA/consultant
team qualify and onboard trial leads:

  - company_size (varchar 20): bucket string chosen by the user at signup
    (e.g. "1-10", "11-50", "51-200", "200+"). Displayed in the Trials & signups page.

  - interested_modules (jsonb): list of module keys the lead indicated interest in
    during signup. Allows the consultant to pre-license the right modules before
    activating implementation mode.

Both columns are nullable — existing tenants retain NULL values; old signup path
(without new fields) continues to work.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = 'n2o3p4q5r6s7'
down_revision: Union[str, tuple] = 'm1n2o3p4q5r6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('company_size', sa.String(20), nullable=True),
    )
    op.add_column(
        'tenants',
        sa.Column('interested_modules', JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'interested_modules')
    op.drop_column('tenants', 'company_size')
