"""Paystack Transfers API service.

What this module does:
  Wraps the Paystack Transfers API so that the rest of the codebase never
  sees Paystack-specific details. All errors are caught here and re-raised
  as generic HTTPException(503) so tenants never see the payment provider name.

Security rules (enforced here):
  - API keys are passed in at call time (fetched decrypted by the router)
  - No keys are logged or stored in this module
  - Paystack brand name never appears in user-facing error messages
  - Webhook signature verification (X-Paystack-Signature) is done here

Encryption:
  Keys are encrypted with Fernet (PAYMENT_ENCRYPTION_KEY env var) before
  being stored in the DB and decrypted just-in-time for API calls.

Usage (from router):
    ps = PaystackService(secret_key)
    recipient = await ps.create_recipient(...)
    transfer  = await ps.initiate_transfer(...)
    verified  = PaystackService.verify_webhook(raw_body, signature, secret)
"""

import hashlib
import hmac
import json
import uuid
from typing import Optional

import httpx
from fastapi import HTTPException

PAYSTACK_BASE = "https://api.paystack.co"

# Lazy import cryptography only when encryption is used (avoids hard dep if unused)
def _fernet():
    from cryptography.fernet import Fernet
    return Fernet


class PaystackService:
    """Thin async wrapper around the Paystack REST API."""

    def __init__(self, secret_key: str) -> None:
        self._secret = secret_key
        self._headers = {
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/json",
        }

    # ── Encryption helpers ────────────────────────────────────────────────────

    @staticmethod
    def encrypt(plaintext: str, encryption_key: str) -> str:
        """Encrypt a secret key for storage. encryption_key must be a Fernet key."""
        F = _fernet()
        f = F(encryption_key.encode())
        return f.encrypt(plaintext.encode()).decode()

    @staticmethod
    def decrypt(ciphertext: str, encryption_key: str) -> str:
        """Decrypt a stored secret key."""
        F = _fernet()
        f = F(encryption_key.encode())
        return f.decrypt(ciphertext.encode()).decode()

    # ── Webhook verification ──────────────────────────────────────────────────

    @staticmethod
    def verify_webhook(raw_body: bytes, signature: str, secret_key: str) -> bool:
        """Verify X-Paystack-Signature header using HMAC-SHA512."""
        expected = hmac.new(secret_key.encode(), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature)

    # ── Transfer recipients ───────────────────────────────────────────────────

    async def create_recipient(
        self,
        account_name: str,
        account_number: str,
        bank_code: str,
        currency: str = "NGN",
    ) -> str:
        """Create a transfer recipient and return the recipient_code."""
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(f"{PAYSTACK_BASE}/transferrecipient", headers=self._headers, json={
                    "type": "nuban",
                    "name": account_name,
                    "account_number": account_number,
                    "bank_code": bank_code,
                    "currency": currency,
                })
                data = resp.json()
                if not data.get("status"):
                    raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")
                return data["data"]["recipient_code"]
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")

    # ── Initiate transfer ─────────────────────────────────────────────────────

    async def initiate_transfer(
        self,
        amount_kobo: int,
        recipient_code: str,
        reference: str,
        reason: str = "Expense reimbursement",
    ) -> dict:
        """Initiate a transfer. amount_kobo = amount * 100."""
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(f"{PAYSTACK_BASE}/transfer", headers=self._headers, json={
                    "source": "balance",
                    "amount": amount_kobo,
                    "recipient": recipient_code,
                    "reference": reference,
                    "reason": reason,
                })
                data = resp.json()
                if not data.get("status"):
                    raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")
                return {
                    "transfer_code": data["data"]["transfer_code"],
                    "reference": data["data"]["reference"],
                    "status": data["data"]["status"],
                }
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")

    # ── Verify account (pre-register) ─────────────────────────────────────────

    async def verify_account(self, account_number: str, bank_code: str) -> dict:
        """Resolve an account number → account name."""
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(
                    f"{PAYSTACK_BASE}/bank/resolve",
                    headers=self._headers,
                    params={"account_number": account_number, "bank_code": bank_code},
                )
                data = resp.json()
                if not data.get("status"):
                    raise HTTPException(status_code=422, detail="Could not verify bank account. Please check the account number and bank.")
                return {
                    "account_name": data["data"]["account_name"],
                    "account_number": data["data"]["account_number"],
                }
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=503, detail="Payment service is temporarily unavailable. Please try again later.")

    # ── List banks ────────────────────────────────────────────────────────────

    async def list_banks(self, country: str = "nigeria") -> list[dict]:
        """Return list of {name, code} banks."""
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.get(f"{PAYSTACK_BASE}/bank", headers=self._headers, params={"country": country, "perPage": 200})
                data = resp.json()
                if not data.get("status"):
                    return []
                return [{"name": b["name"], "code": b["code"]} for b in data.get("data", [])]
            except Exception:
                return []
