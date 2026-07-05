"""merge_heads_2026_07_05

Revision ID: 423f009c637b
Revises: c2d3e4f5a6b7, l9m0n1o2p3q4
Create Date: 2026-07-05 14:52:49.466363

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '423f009c637b'
down_revision: Union[str, None] = ('c2d3e4f5a6b7', 'l9m0n1o2p3q4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
