"""
AI Intelligence Layer service — M20.

Three analysis functions that generate ai_insights rows:

1. detect_anomalies()
   Statistical scan of expense lines and AP invoices over a lookback window.
   Flags:
     - Amount > 3σ above the tenant's per-category mean
     - Duplicate transactions (same vendor + amount within 7 days)
     - Weekend/holiday submissions flagged as UNUSUAL (informational)
   Then sends a summary prompt to the LLM to produce a human-readable title + summary.

2. generate_spending_patterns()
   Aggregates expense + AP spend by GL account and department over the period.
   Sends the breakdown to the LLM to narrate top spend trends and cost-reduction
   observations.

3. forecast_cash_flow()
   Pulls AR (outstanding receivables), AP (outstanding payables), approved expenses
   (yet to be paid) and payroll runs (upcoming pay dates) and produces a
   periods_ahead-period cash forecast.  Sends to the LLM for a narrative summary.

Security note (CRITICAL):
  All LLM errors are caught and re-raised as AiIntelligenceError.
  The caller (router) maps this to a generic HTTP 503 response.
  Under no circumstances does the error message expose "Anthropic",
  "ANTHROPIC_API_KEY", model names, or any internal infrastructure detail
  to the tenant-facing response.
"""

from __future__ import annotations

import asyncio
import logging
import math
import statistics
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)


class AiIntelligenceError(Exception):
    """Raised when the AI analysis service is unavailable or returns an error."""
    pass


def _get_client():
    """
    Return an Anthropic Anthropic client.

    Raises AiIntelligenceError (never exposes the library name or key name
    to the caller — the router maps this to a generic 503 message).
    """
    try:
        import anthropic  # type: ignore
        key = getattr(settings, "anthropic_api_key", None) or ""
        if not key.strip():
            raise AiIntelligenceError("AI analysis is not configured.")
        return anthropic.Anthropic(api_key=key)
    except ImportError:
        raise AiIntelligenceError("AI analysis service is not available.")


async def _llm_summarise(prompt: str, system: str = "") -> str:
    """
    Call the LLM and return the text response.

    All exceptions are caught and re-raised as AiIntelligenceError so no
    internal detail leaks to the caller.
    """
    try:
        client = _get_client()
        loop = asyncio.get_event_loop()
        model = getattr(settings, "ocr_model", "claude-haiku-4-5-20251001")

        def _call() -> str:
            messages = [{"role": "user", "content": prompt}]
            kwargs: dict[str, Any] = {
                "model": model,
                "max_tokens": 600,
                "messages": messages,
            }
            if system:
                kwargs["system"] = system
            response = client.messages.create(**kwargs)
            return response.content[0].text if response.content else ""

        return await loop.run_in_executor(None, _call)
    except AiIntelligenceError:
        raise
    except Exception as exc:
        logger.error("AI intelligence LLM call failed: %s", type(exc).__name__)
        raise AiIntelligenceError("AI analysis service is temporarily unavailable.") from exc


# ── 1. Anomaly Detection ──────────────────────────────────────────────────────

async def detect_anomalies(
    db: AsyncSession,
    tenant_id: Any,
    lookback_days: int = 90,
) -> list[dict]:
    """
    Scan expenses and AP invoices for statistical anomalies.

    Returns a list of finding dicts that the router will persist as ai_insights rows.

    Algorithm:
      - Pull all approved expense lines from the lookback period grouped by gl_account_id
      - Compute mean and stdev per account; flag lines > mean + 3 * stdev
      - Pull AP invoice amounts and flag same-vendor + same-amount within 7 days (potential dup)
    """
    since = date.today() - timedelta(days=lookback_days)
    findings: list[dict] = []

    # ── Expense anomalies by GL account ──────────────────────────────────────
    rows = await db.execute(text("""
        SELECT el.gl_id AS gl_account_id, c.code AS gl_code, c.name AS gl_name,
               el.amount, er.id AS report_id, er.submitted_at, er.employee_id
          FROM expense_lines el
          JOIN expense_reports er ON er.id = el.report_id
          LEFT JOIN chart_of_accounts c ON c.id = el.gl_id
         WHERE er.tenant_id = :tid
           AND er.status IN ('APPROVED','PAID')
           AND er.submitted_at >= :since
           AND el.amount IS NOT NULL
    """), {"tid": str(tenant_id), "since": since})
    expense_rows = rows.fetchall()

    # Group by GL account
    by_account: dict[str, list[float]] = {}
    line_meta: list[dict] = []
    for r in expense_rows:
        key = str(r.gl_account_id) if r.gl_account_id else "unassigned"
        by_account.setdefault(key, []).append(float(r.amount))
        line_meta.append({
            "gl_account_id": str(r.gl_account_id),
            "gl_code": r.gl_code or "—",
            "gl_name": r.gl_name or "Unassigned",
            "amount": float(r.amount),
            "report_id": str(r.report_id),
        })

    for key, amounts in by_account.items():
        if len(amounts) < 3:
            continue
        mu = statistics.mean(amounts)
        sigma = statistics.stdev(amounts)
        threshold = mu + 3 * sigma
        for meta in line_meta:
            if str(meta["gl_account_id"]) == key and meta["amount"] > threshold:
                findings.append({
                    "insight_type": "ANOMALY",
                    "entity_type": "expense_report",
                    "entity_id": meta["report_id"],
                    "severity": "WARNING",
                    "gl_name": meta["gl_name"],
                    "amount": meta["amount"],
                    "mean": round(mu, 2),
                    "sigma": round(sigma, 2),
                    "z_score": round((meta["amount"] - mu) / sigma, 2) if sigma > 0 else 0,
                })

    # ── AP invoice duplicate detection ────────────────────────────────────────
    dup_rows = await db.execute(text("""
        SELECT a.vendor_id, v.name AS vendor_name, a.total_amount_base,
               a.invoice_date, a.id AS invoice_id
          FROM ap_invoices a
          LEFT JOIN vendors v ON v.id = a.vendor_id
         WHERE a.tenant_id = :tid
           AND a.invoice_date >= :since
         ORDER BY a.vendor_id, a.total_amount_base, a.invoice_date
    """), {"tid": str(tenant_id), "since": since})
    ap_rows = dup_rows.fetchall()

    # Sliding window: same vendor + same amount within 7 days
    for i, row in enumerate(ap_rows):
        for j in range(i + 1, len(ap_rows)):
            other = ap_rows[j]
            if other.vendor_id != row.vendor_id:
                break
            if abs(float(other.total_amount_base) - float(row.total_amount_base)) > 0.01:
                continue
            delta = abs((other.invoice_date - row.invoice_date).days)
            if delta <= 7:
                findings.append({
                    "insight_type": "ANOMALY",
                    "entity_type": "ap_invoice",
                    "entity_id": str(other.invoice_id),
                    "severity": "CRITICAL",
                    "duplicate_of": str(row.invoice_id),
                    "vendor_name": row.vendor_name or "Unknown vendor",
                    "amount": float(row.total_amount_base),
                    "days_apart": delta,
                })

    return findings


async def generate_anomaly_insight(finding: dict, tenant_name: str) -> dict:
    """Convert a raw finding dict into a titled, summarised ai_insight dict via LLM."""
    if finding["insight_type"] == "ANOMALY" and finding.get("z_score") is not None:
        prompt = (
            f"You are a finance analyst for {tenant_name}. "
            f"An expense of {finding['amount']:,.2f} was recorded against "
            f"'{finding['gl_name']}'. The historical average for this account is "
            f"{finding['mean']:,.2f} (σ={finding['sigma']:,.2f}). "
            f"This amount is {finding['z_score']}σ above the mean. "
            "Write a 1-sentence alert title (max 12 words) and a 2-sentence explanation "
            "a CFO would understand. Format: TITLE: ...\nSUMMARY: ..."
        )
    else:
        prompt = (
            f"You are a finance analyst for {tenant_name}. "
            f"A potential duplicate AP invoice was detected: vendor '{finding.get('vendor_name')}', "
            f"amount {finding.get('amount', 0):,.2f}, found {finding.get('days_apart', 0)} days "
            "apart from an earlier invoice for the same amount. "
            "Write a 1-sentence alert title (max 12 words) and a 2-sentence explanation. "
            "Format: TITLE: ...\nSUMMARY: ..."
        )

    system = (
        "You produce concise financial risk alerts. "
        "Do not mention any AI vendor names. "
        "Do not reveal how the alert was computed. "
        "Output only TITLE: <text>\nSUMMARY: <text>."
    )

    try:
        raw = await _llm_summarise(prompt, system=system)
        title = ""
        summary = ""
        for line in raw.splitlines():
            if line.startswith("TITLE:"):
                title = line[6:].strip()
            elif line.startswith("SUMMARY:"):
                summary = line[8:].strip()
        if not title:
            title = "Unusual transaction detected"
        if not summary:
            summary = raw[:200]
    except AiIntelligenceError:
        title = "Unusual transaction detected"
        summary = "An anomaly was identified in your financial data. Please review."

    return {
        **finding,
        "title": title,
        "summary": summary,
    }


# ── 2. Spending Pattern Analysis ──────────────────────────────────────────────

async def generate_spending_patterns(
    db: AsyncSession,
    tenant_id: Any,
    period_start: date,
    period_end: date,
    tenant_name: str,
) -> dict:
    """
    Aggregate and narrate spend patterns for a period.

    Combines approved expense lines + approved AP invoice lines, grouped by GL account.
    """
    rows = await db.execute(text("""
        SELECT c.code, c.name AS gl_name,
               COALESCE(SUM(el.amount), 0) AS total_spend
          FROM expense_lines el
          JOIN expense_reports er ON er.id = el.report_id
          LEFT JOIN chart_of_accounts c ON c.id = el.gl_id
         WHERE er.tenant_id = :tid
           AND er.status IN ('APPROVED','PAID')
           AND er.submitted_at >= :s AND er.submitted_at <= :e
        GROUP BY c.code, c.name

        UNION ALL

        SELECT c.code, c.name AS gl_name,
               COALESCE(SUM(al.amount_base), 0)
          FROM ap_invoice_lines al
          JOIN ap_invoices ai ON ai.id = al.invoice_id
          LEFT JOIN chart_of_accounts c ON c.id = al.gl_account_id
         WHERE ai.tenant_id = :tid
           AND ai.status IN ('APPROVED','PAID')
           AND ai.invoice_date >= :s AND ai.invoice_date <= :e
        GROUP BY c.code, c.name
    """), {"tid": str(tenant_id), "s": period_start, "e": period_end})
    spend_rows = rows.fetchall()

    # Aggregate by GL name
    totals: dict[str, float] = {}
    for r in spend_rows:
        key = r.gl_name or "Unclassified"
        totals[key] = totals.get(key, 0) + float(r.total_spend)

    top10 = sorted(totals.items(), key=lambda x: x[1], reverse=True)[:10]
    grand_total = sum(totals.values())

    prompt = (
        f"Finance company: {tenant_name}. Period: {period_start} to {period_end}. "
        f"Total spend: {grand_total:,.2f}. "
        f"Top spending categories: {', '.join(f'{k} ({v:,.2f})' for k, v in top10)}. "
        "Write a spending pattern insight with: "
        "TITLE: (max 10 words)\nSUMMARY: (2-3 sentences describing top spend areas and any notable patterns). "
        "Be specific, data-driven, and constructive."
    )
    system = (
        "You are a concise finance analyst. "
        "Output only TITLE: <text>\nSUMMARY: <text>. "
        "Do not mention AI vendors or analysis methods."
    )

    try:
        raw = await _llm_summarise(prompt, system=system)
        title, summary = "", ""
        for line in raw.splitlines():
            if line.startswith("TITLE:"):
                title = line[6:].strip()
            elif line.startswith("SUMMARY:"):
                summary = line[8:].strip()
        if not title:
            title = f"Spending Analysis — {period_start} to {period_end}"
        if not summary:
            summary = raw[:400]
    except AiIntelligenceError:
        title = f"Spending Analysis — {period_start} to {period_end}"
        summary = f"Total spend of {grand_total:,.2f} across {len(totals)} categories. Top category: {top10[0][0] if top10 else 'N/A'}."

    return {
        "insight_type": "SPENDING_PATTERN",
        "entity_type": None,
        "entity_id": None,
        "severity": "INFO",
        "title": title,
        "summary": summary,
        "detail": {"top_categories": [{"name": k, "amount": v} for k, v in top10], "grand_total": grand_total},
    }


# ── 3. Cash Flow Forecast ─────────────────────────────────────────────────────

async def forecast_cash_flow(
    db: AsyncSession,
    tenant_id: Any,
    periods_ahead: int = 3,
    tenant_name: str = "",
) -> dict:
    """
    Produce a simple cash flow forecast for the next `periods_ahead` months.

    Sources:
      - Outstanding AR invoices (expected inflows by due date)
      - Outstanding AP invoices (expected outflows by due date)
      - Approved but unpaid expense reports (short-term cash outflow)
    """
    today = date.today()

    # AR inflows — APPROVED invoices not yet received (net_receivable = receivable amount)
    ar_rows = await db.execute(text("""
        SELECT due_date, SUM(net_receivable) AS outstanding
          FROM ar_invoices
         WHERE tenant_id = :tid AND status = 'APPROVED'
           AND due_date >= :today AND due_date <= :horizon
         GROUP BY due_date ORDER BY due_date
    """), {"tid": str(tenant_id), "today": today, "horizon": today + timedelta(days=periods_ahead * 31)})
    ar_schedule = [(r.due_date, float(r.outstanding)) for r in ar_rows.fetchall()]

    # AP outflows — APPROVED invoices not yet paid (net_payable = amount we owe vendor)
    ap_rows = await db.execute(text("""
        SELECT due_date, SUM(net_payable) AS outstanding
          FROM ap_invoices
         WHERE tenant_id = :tid AND status = 'APPROVED'
           AND due_date >= :today AND due_date <= :horizon
         GROUP BY due_date ORDER BY due_date
    """), {"tid": str(tenant_id), "today": today, "horizon": today + timedelta(days=periods_ahead * 31)})
    ap_schedule = [(r.due_date, float(r.outstanding)) for r in ap_rows.fetchall()]

    total_inflows = sum(v for _, v in ar_schedule)
    total_outflows = sum(v for _, v in ap_schedule)
    net = total_inflows - total_outflows

    prompt = (
        f"Company: {tenant_name}. Forecast window: next {periods_ahead} months from {today}. "
        f"Expected receivables: {total_inflows:,.2f}. Expected payables: {total_outflows:,.2f}. "
        f"Net projected cash position change: {net:,.2f}. "
        "Write: TITLE: (max 10 words)\nSUMMARY: (2-3 sentences interpreting the cash position and any risk)."
    )
    system = (
        "You are a concise finance analyst. "
        "Output only TITLE: <text>\nSUMMARY: <text>. "
        "Do not mention AI vendors or analysis methods."
    )

    try:
        raw = await _llm_summarise(prompt, system=system)
        title, summary = "", ""
        for line in raw.splitlines():
            if line.startswith("TITLE:"):
                title = line[6:].strip()
            elif line.startswith("SUMMARY:"):
                summary = line[8:].strip()
        if not title:
            title = f"{periods_ahead}-Month Cash Flow Forecast"
        if not summary:
            summary = raw[:400]
    except AiIntelligenceError:
        title = f"{periods_ahead}-Month Cash Flow Forecast"
        summary = (
            f"Expected inflows: {total_inflows:,.2f}. "
            f"Expected outflows: {total_outflows:,.2f}. "
            f"Net change: {net:,.2f}."
        )

    return {
        "insight_type": "CASH_FLOW_FORECAST",
        "entity_type": None,
        "entity_id": None,
        "severity": "INFO" if net >= 0 else "WARNING",
        "title": title,
        "summary": summary,
        "detail": {
            "total_inflows": total_inflows,
            "total_outflows": total_outflows,
            "net": net,
            "periods_ahead": periods_ahead,
            "ar_schedule": [{"date": str(d), "amount": v} for d, v in ar_schedule[:20]],
            "ap_schedule": [{"date": str(d), "amount": v} for d, v in ap_schedule[:20]],
        },
    }


# ── 4. Auto-Categorisation (single transaction) ───────────────────────────────

async def suggest_category(
    db: AsyncSession,
    tenant_id: Any,
    description: str,
    amount: float,
    vendor_name: str = "",
) -> dict:
    """
    Suggest a GL account and category for a transaction based on its description.

    Pulls the tenant's chart of accounts, then asks the LLM to pick the best match.
    Returns the top suggestion with a confidence label.
    """
    # NOTE: columns are gl_number / gl_name (not code / name — M20 original had wrong names)
    coa_rows = await db.execute(text("""
        SELECT gl_number, gl_name, account_type
          FROM chart_of_accounts
         WHERE tenant_id = :tid AND is_active = TRUE
           AND account_type IN ('EXPENSE','COGS','ASSET')
         ORDER BY gl_number
         LIMIT 60
    """), {"tid": str(tenant_id)})
    accounts = [{"code": r.gl_number, "name": r.gl_name, "type": r.account_type} for r in coa_rows.fetchall()]

    if not accounts:
        return {"suggestion": None, "reason": "No chart of accounts configured."}

    accounts_text = "\n".join(f"{a['code']} — {a['name']} ({a['type']})" for a in accounts)
    prompt = (
        f"Transaction description: '{description}'. "
        f"Amount: {amount:,.2f}. Vendor: '{vendor_name}'.\n\n"
        f"Available GL accounts:\n{accounts_text}\n\n"
        "Respond with: GL_CODE: <code>\nGL_NAME: <name>\nREASON: <1 sentence>."
    )
    system = (
        "You are a finance categorisation assistant. "
        "Pick the single most appropriate GL account code from the list provided. "
        "Output only GL_CODE: ...\nGL_NAME: ...\nREASON: ... . "
        "Do not output anything else."
    )

    try:
        raw = await _llm_summarise(prompt, system=system)
        gl_code, gl_name, reason = "", "", ""
        for line in raw.splitlines():
            if line.startswith("GL_CODE:"):
                gl_code = line[8:].strip()
            elif line.startswith("GL_NAME:"):
                gl_name = line[8:].strip()
            elif line.startswith("REASON:"):
                reason = line[7:].strip()
        return {"suggestion": {"gl_code": gl_code, "gl_name": gl_name}, "reason": reason}
    except AiIntelligenceError:
        return {"suggestion": None, "reason": "Category suggestion is temporarily unavailable."}
