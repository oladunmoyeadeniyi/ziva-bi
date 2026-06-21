"""
ZivaBI — Bank Account Pydantic schemas.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class BankAccountCreate(BaseModel):
    """Body for POST /api/setup/bank-accounts."""

    bank_name: str
    account_name: str
    account_number: str
    currency: str        # ISO 3-letter code, e.g. "NGN"
    gl_account_id: UUID
    is_default: bool = False

    @field_validator("currency")
    @classmethod
    def upper_currency(cls, v: str) -> str:
        return v.strip().upper()


class BankAccountUpdate(BaseModel):
    """Body for PUT /api/setup/bank-accounts/{id}. All fields optional."""

    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    currency: Optional[str] = None
    gl_account_id: Optional[UUID] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None

    @field_validator("currency")
    @classmethod
    def upper_currency(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else v


class BankAccountResponse(BaseModel):
    """One bank account row returned by GET/POST/PUT."""

    id: str
    bank_name: str
    account_name: str
    account_number: str
    currency: str
    gl_account_id: str
    gl_number: str
    gl_name: str
    gl_account_type: str
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
