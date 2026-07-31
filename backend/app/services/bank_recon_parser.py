"""
PRAD — Bank Statement CSV/Excel Parser (M11c).

Parses uploaded bank statement files into a list of BankStatementLineCreate
objects that the router then bulk-inserts into bank_statement_lines.

Supported formats:
    CSV  — any delimiter (auto-detected via csv.Sniffer)
    XLSX — openpyxl (first sheet, first row = headers)

Column detection strategy (case-insensitive header match):
    date        — 'date', 'transaction date', 'txn date', 'value date', 'posting date'
    value_date  — 'value date', 'cleared date'
    description — 'description', 'narration', 'details', 'particulars', 'memo', 'transaction'
    reference   — 'reference', 'ref', 'cheque', 'check no', 'folio'
    debit       — 'debit', 'withdrawal', 'dr', 'charges', 'debit amount'
    credit      — 'credit', 'deposit', 'cr', 'receipts', 'credit amount'
    amount      — 'amount' (signed: negative = debit from bank perspective)
    balance     — 'balance', 'running balance', 'closing balance'

Amount column fallback:
    If separate debit/credit columns are not found but 'amount' is present,
    negative values → debit; positive values → credit.

Design notes:
- The parser is pure Python (no DB access); it is called from the router.
- All returned objects are BankStatementLineCreate — validation is applied by
  Pydantic before the router inserts to DB.
- Rows that fail validation are collected into warnings and skipped.
- line_number is 1-based and reflects the original file row order.
- Dates are parsed with dateutil.parser.parse for flexibility; ambiguous dates
  (e.g. 01/02/2026 — DD/MM vs MM/DD) are resolved dayfirst=True (most common
  for Nigerian / UK bank statements).
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

# Third-party (available in requirements.txt)
from dateutil import parser as dateutil_parser


# ── Column aliases ────────────────────────────────────────────────────────────

_DATE_ALIASES = {"date", "transaction date", "txn date", "posting date", "trans date", "tran date"}
_VALUE_DATE_ALIASES = {"value date", "cleared date", "val date"}
_DESC_ALIASES = {"description", "narration", "details", "particulars", "memo", "transaction", "transaction details"}
_REF_ALIASES = {"reference", "ref", "cheque", "check no", "cheque no", "folio", "chq no"}
_DEBIT_ALIASES = {"debit", "withdrawal", "withdrawals", "dr", "charges", "debit amount", "debit(ngn)", "dr amount"}
_CREDIT_ALIASES = {"credit", "deposit", "deposits", "cr", "receipts", "credit amount", "credit(ngn)", "cr amount"}
_AMOUNT_ALIASES = {"amount", "transaction amount", "txn amount"}
_BALANCE_ALIASES = {"balance", "running balance", "closing balance", "ledger balance"}


@dataclass
class ParsedLine:
    """One parsed statement line (before Pydantic validation)."""
    line_number: int
    transaction_date: date
    value_date: Optional[date]
    description: str
    reference: Optional[str]
    debit: Decimal
    credit: Decimal
    running_balance: Optional[Decimal]


@dataclass
class ParseResult:
    """Return value from parse_statement_file()."""
    lines: list[ParsedLine] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ── Main entry point ──────────────────────────────────────────────────────────

def parse_statement_file(
    content: bytes,
    filename: str,
) -> ParseResult:
    """
    Parse a bank statement file (CSV or XLSX) and return structured line data.

    Args:
        content:  Raw file bytes from the upload.
        filename: Original filename — used to determine format (.csv / .xlsx/.xls).

    Returns:
        ParseResult with .lines (valid parsed rows) and .warnings (skipped rows with reason).

    Raises:
        ValueError: If the file format is unsupported or no recognisable columns found.
    """
    lower = filename.lower()
    if lower.endswith(".csv") or lower.endswith(".txt"):
        rows, headers = _parse_csv(content)
    elif lower.endswith(".xlsx") or lower.endswith(".xls"):
        rows, headers = _parse_xlsx(content)
    else:
        raise ValueError(
            f"Unsupported file format: '{filename}'. Upload a .csv or .xlsx file."
        )

    return _process_rows(rows, headers)


# ── Format parsers ────────────────────────────────────────────────────────────

def _parse_csv(content: bytes) -> tuple[list[list[str]], list[str]]:
    """
    Parse a CSV/TXT file; auto-detect delimiter.

    Returns (rows, headers) where rows excludes the header row.
    """
    text = content.decode("utf-8-sig", errors="replace")  # strip BOM if present
    try:
        sample = text[:4096]
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t|;")
    except csv.Error:
        dialect = csv.excel  # fallback to comma

    reader = csv.reader(io.StringIO(text), dialect=dialect)
    all_rows = list(reader)

    # Skip leading blank rows / comment rows before the real header
    start = 0
    for i, row in enumerate(all_rows):
        if any(cell.strip() for cell in row):
            start = i
            break

    if not all_rows or start >= len(all_rows):
        raise ValueError("The file appears to be empty.")

    headers = [h.strip() for h in all_rows[start]]
    data_rows = all_rows[start + 1:]
    return data_rows, headers


def _parse_xlsx(content: bytes) -> tuple[list[list[str]], list[str]]:
    """
    Parse the first sheet of an .xlsx file using openpyxl.

    Returns (rows, headers) where cell values are stringified.
    """
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError as exc:
        raise ValueError(
            "openpyxl is required to parse .xlsx files. "
            "Run: pip install openpyxl"
        ) from exc

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)

    # Find the header row (first non-empty row)
    header_row: Optional[tuple] = None
    data_rows_raw: list[tuple] = []
    for row in rows_iter:
        if header_row is None and any(c is not None for c in row):
            header_row = row
        elif header_row is not None:
            data_rows_raw.append(row)
    wb.close()

    if header_row is None:
        raise ValueError("The .xlsx file appears to be empty.")

    headers = [str(h).strip() if h is not None else "" for h in header_row]
    rows = [
        [str(c).strip() if c is not None else "" for c in row]
        for row in data_rows_raw
        if any(c is not None for c in row)
    ]
    return rows, headers


# ── Row processor ─────────────────────────────────────────────────────────────

def _process_rows(
    rows: list[list[str]],
    headers: list[str],
) -> ParseResult:
    """
    Map header names to column indices and parse each data row.

    Returns ParseResult with valid ParsedLine objects and any skipped-row warnings.
    """
    col = _map_columns(headers)
    result = ParseResult()

    for row_idx, raw in enumerate(rows, start=2):  # 2 = first data row in file

        # Skip completely blank rows silently
        if not any(cell.strip() for cell in raw):
            continue

        def get(idx: Optional[int]) -> str:
            if idx is None or idx >= len(raw):
                return ""
            return raw[idx].strip()

        # ── Date ──────────────────────────────────────────────────────────────
        raw_date = get(col.get("date"))
        if not raw_date:
            result.warnings.append(f"Row {row_idx}: skipped — no transaction date.")
            continue
        try:
            txn_date = _parse_date(raw_date)
        except Exception:
            result.warnings.append(
                f"Row {row_idx}: skipped — cannot parse date '{raw_date}'."
            )
            continue

        # ── Value date ────────────────────────────────────────────────────────
        raw_val_date = get(col.get("value_date"))
        val_date: Optional[date] = None
        if raw_val_date:
            try:
                val_date = _parse_date(raw_val_date)
            except Exception:
                pass  # non-fatal; just leave it null

        # ── Description ───────────────────────────────────────────────────────
        description = get(col.get("description"))
        if not description:
            description = "(no description)"

        # ── Reference ─────────────────────────────────────────────────────────
        reference = get(col.get("reference")) or None

        # ── Amount ────────────────────────────────────────────────────────────
        if "debit" in col and "credit" in col:
            debit = _parse_amount(get(col["debit"]))
            credit = _parse_amount(get(col["credit"]))
        elif "amount" in col:
            amount = _parse_signed_amount(get(col["amount"]))
            if amount < 0:
                debit = abs(amount)
                credit = Decimal("0")
            else:
                debit = Decimal("0")
                credit = amount
        else:
            result.warnings.append(
                f"Row {row_idx}: skipped — could not find debit/credit or amount columns."
            )
            continue

        # Both zero is valid (e.g. an opening-balance memo row) but we skip it
        if debit == 0 and credit == 0:
            result.warnings.append(
                f"Row {row_idx}: skipped — both debit and credit are zero."
            )
            continue

        # Both > 0 is invalid
        if debit > 0 and credit > 0:
            result.warnings.append(
                f"Row {row_idx}: skipped — row has both debit ({debit}) and credit ({credit}) > 0."
            )
            continue

        # ── Running balance ───────────────────────────────────────────────────
        raw_bal = get(col.get("balance"))
        balance: Optional[Decimal] = None
        if raw_bal:
            try:
                balance = _parse_amount(raw_bal)
            except Exception:
                pass

        result.lines.append(
            ParsedLine(
                line_number=len(result.lines) + 1,  # sequential within this upload
                transaction_date=txn_date,
                value_date=val_date,
                description=description[:500],
                reference=reference[:255] if reference else None,
                debit=debit,
                credit=credit,
                running_balance=balance,
            )
        )

    if not result.lines and not result.warnings:
        raise ValueError("No valid transaction rows found in the file.")

    return result


# ── Column mapping ────────────────────────────────────────────────────────────

def _map_columns(headers: list[str]) -> dict[str, int]:
    """
    Return a dict mapping logical field names to column indices.

    Example: {'date': 0, 'description': 2, 'debit': 3, 'credit': 4, 'balance': 5}
    """
    col: dict[str, int] = {}
    for idx, raw_header in enumerate(headers):
        h = raw_header.lower().strip()
        if h in _DATE_ALIASES and "date" not in col:
            col["date"] = idx
        elif h in _VALUE_DATE_ALIASES and "value_date" not in col:
            col["value_date"] = idx
        elif h in _DESC_ALIASES and "description" not in col:
            col["description"] = idx
        elif h in _REF_ALIASES and "reference" not in col:
            col["reference"] = idx
        elif h in _DEBIT_ALIASES and "debit" not in col:
            col["debit"] = idx
        elif h in _CREDIT_ALIASES and "credit" not in col:
            col["credit"] = idx
        elif h in _AMOUNT_ALIASES and "amount" not in col:
            col["amount"] = idx
        elif h in _BALANCE_ALIASES and "balance" not in col:
            col["balance"] = idx

    if "date" not in col:
        raise ValueError(
            "Could not find a date column in the file. "
            "Expected a header like 'Date', 'Transaction Date', or 'Posting Date'."
        )
    if "description" not in col:
        # Tolerate — we'll use "(no description)" fallback
        pass
    if "debit" not in col and "credit" not in col and "amount" not in col:
        raise ValueError(
            "Could not find amount columns. "
            "Expected 'Debit'/'Credit' columns or a single 'Amount' column."
        )

    return col


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(raw: str) -> date:
    """Parse a date string with dayfirst=True (DD/MM/YYYY most common for NG/UK)."""
    return dateutil_parser.parse(raw, dayfirst=True).date()


def _clean_number(raw: str) -> str:
    """Strip currency symbols, spaces, and thousands separators from a number string."""
    # Remove common currency symbols and whitespace
    cleaned = re.sub(r"[₦$€£,\s]", "", raw)
    # Remove trailing CR/DR indicator (e.g. "5,000.00 DR" → "-5000.00" handled separately)
    cleaned = re.sub(r"\s*(dr|cr)$", "", cleaned, flags=re.IGNORECASE)
    return cleaned


def _parse_amount(raw: str) -> Decimal:
    """Parse a non-negative amount string; returns 0 for blank/dash."""
    if not raw or raw in {"-", "—", "–", "nil", "n/a", ""}:
        return Decimal("0")
    try:
        return abs(Decimal(_clean_number(raw)))
    except InvalidOperation:
        return Decimal("0")


def _parse_signed_amount(raw: str) -> Decimal:
    """
    Parse a signed amount (used when a single 'amount' column is present).
    Negative = outflow (debit); positive = inflow (credit).
    Handles trailing DR/CR markers by flipping sign accordingly.
    """
    if not raw or raw in {"-", "—", "–", "nil", "n/a", ""}:
        return Decimal("0")
    lower = raw.lower()
    is_dr = lower.endswith("dr")
    is_cr = lower.endswith("cr")
    cleaned = _clean_number(raw)
    try:
        val = Decimal(cleaned)
    except InvalidOperation:
        return Decimal("0")
    if is_dr:
        return -abs(val)
    if is_cr:
        return abs(val)
    return val
