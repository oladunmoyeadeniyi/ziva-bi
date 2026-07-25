"""
Purchase Order 3-Way Match Engine — M11b.

Pure functions for computing match variance and match_status. No DB access.
Called by the PO router when recording invoice ↔ GRN matches.

Match status logic:
  MATCHED          — price and qty within tolerance (or exact)
  PRICE_VARIANCE   — invoice unit price differs from PO unit price by > price_tolerance_pct
  QTY_VARIANCE     — matched_quantity differs from grn_line.quantity_received by > qty_tolerance_pct
  OVER_INVOICED    — matched_quantity > grn_line.quantity_received (regardless of tolerance)
  UNDER_INVOICED   — matched_quantity < grn_line.quantity_received AND match_status not yet MATCHED
  MANUAL_OVERRIDE  — finance has overridden the computed status

Tolerance is applied in order: OVER_INVOICED check first (hard guard), then PRICE_VARIANCE,
then QTY_VARIANCE, then MATCHED. auto_approve_within_tolerance collapses PRICE_VARIANCE /
QTY_VARIANCE to MATCHED when both are within tolerance bounds.
"""

from dataclasses import dataclass
from decimal import Decimal


_ZERO = Decimal("0")
_ONE = Decimal("1")


@dataclass(frozen=True)
class MatchResult:
    """
    Output of compute_match_status().

    All Decimal fields are ready to persist into ap_invoice_po_matches.
    """
    price_variance: Decimal          # invoice unit_price − po unit_price (absolute, signed)
    price_variance_pct: Decimal      # price_variance / po_unit_price (fraction, signed)
    qty_variance: Decimal            # matched_quantity − grn_line.quantity_received (signed)
    match_status: str                # one of the six statuses
    matched_amount_base: Decimal     # matched_quantity × po_unit_price × exchange_rate


def compute_match_status(
    *,
    invoice_unit_price: Decimal,
    po_unit_price: Decimal,
    matched_quantity: Decimal,
    grn_line_quantity: Decimal,
    exchange_rate: Decimal,
    price_tolerance_pct: Decimal,
    qty_tolerance_pct: Decimal,
    auto_approve_within_tolerance: bool,
) -> MatchResult:
    """
    Compute price/qty variance and determine match_status for one match record.

    Parameters:
        invoice_unit_price           — unit price on the AP invoice line (foreign currency)
        po_unit_price                — unit price on the PO line (foreign currency, locked at GRN)
        matched_quantity             — quantity being matched in this record
        grn_line_quantity            — total quantity on the GRN line
        exchange_rate                — PO exchange rate for base-currency conversion
        price_tolerance_pct          — e.g. Decimal("0.02") for 2%
        qty_tolerance_pct            — e.g. Decimal("0.05") for 5%
        auto_approve_within_tolerance — if True, variances within tolerance → MATCHED

    Returns:
        MatchResult with all computed fields.

    Example:
        result = compute_match_status(
            invoice_unit_price=Decimal("105"),
            po_unit_price=Decimal("100"),
            matched_quantity=Decimal("10"),
            grn_line_quantity=Decimal("10"),
            exchange_rate=Decimal("1"),
            price_tolerance_pct=Decimal("0.02"),
            qty_tolerance_pct=Decimal("0.05"),
            auto_approve_within_tolerance=False,
        )
        # result.match_status == "PRICE_VARIANCE"  (5% > 2% tolerance)
        # result.price_variance_pct == Decimal("0.05")
    """
    safe_po_price = po_unit_price if po_unit_price != _ZERO else _ONE

    price_variance = invoice_unit_price - po_unit_price
    price_variance_pct = price_variance / safe_po_price
    qty_variance = matched_quantity - grn_line_quantity

    # Base amount uses PO unit price (not invoice price) for GRNI valuation consistency
    matched_amount_base = matched_quantity * po_unit_price * exchange_rate

    # ── Status determination ──────────────────────────────────────────────────

    # Hard over-invoiced check — matched_quantity strictly > grn_line_quantity
    if matched_quantity > grn_line_quantity:
        return MatchResult(
            price_variance=price_variance,
            price_variance_pct=price_variance_pct,
            qty_variance=qty_variance,
            match_status="OVER_INVOICED",
            matched_amount_base=matched_amount_base,
        )

    price_in_tolerance = abs(price_variance_pct) <= price_tolerance_pct
    qty_in_tolerance = abs(qty_variance) <= grn_line_quantity * qty_tolerance_pct

    has_price_variance = not price_in_tolerance
    has_qty_variance = abs(qty_variance) > _ZERO and not qty_in_tolerance
    is_under_invoiced = matched_quantity < grn_line_quantity

    # Auto-approve collapses within-tolerance variances to MATCHED
    if auto_approve_within_tolerance:
        if price_in_tolerance and (qty_in_tolerance or not is_under_invoiced):
            return MatchResult(
                price_variance=price_variance,
                price_variance_pct=price_variance_pct,
                qty_variance=qty_variance,
                match_status="MATCHED",
                matched_amount_base=matched_amount_base,
            )

    if has_price_variance:
        status = "PRICE_VARIANCE"
    elif has_qty_variance:
        status = "QTY_VARIANCE"
    elif is_under_invoiced:
        status = "UNDER_INVOICED"
    else:
        status = "MATCHED"

    return MatchResult(
        price_variance=price_variance,
        price_variance_pct=price_variance_pct,
        qty_variance=qty_variance,
        match_status=status,
        matched_amount_base=matched_amount_base,
    )


def invoice_payment_blocked(
    match_statuses: list[str],
    block_payment_on_variance: bool,
) -> bool:
    """
    Return True if AP invoice payment should be blocked based on match statuses.

    Parameters:
        match_statuses           — list of match_status values across all match records
                                   for the invoice
        block_payment_on_variance — from tenant's po_tolerance_config

    Blocking statuses: PRICE_VARIANCE, QTY_VARIANCE, OVER_INVOICED, UNDER_INVOICED.
    MATCHED and MANUAL_OVERRIDE never block.
    """
    if not block_payment_on_variance:
        return False
    blocking = {"PRICE_VARIANCE", "QTY_VARIANCE", "OVER_INVOICED", "UNDER_INVOICED"}
    return any(s in blocking for s in match_statuses)
