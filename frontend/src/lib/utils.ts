import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Number / money formatting ─────────────────────────────────────────────────

/**
 * Format a text-input value as a comma-separated number while the user types.
 * Preserves decimal portion as-is (no rounding during input).
 * Usage: value={fmtCommaInput(state)} onChange={e => setState(stripCommas(e.target.value))}
 */
export function fmtCommaInput(val: string): string {
  if (!val) return "";
  const clean = val.replace(/[^0-9.]/g, "");
  const [intPart, decPart] = clean.split(".");
  const formatted = parseInt(intPart || "0", 10).toLocaleString("en-NG");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

/** Strip commas before storing raw numeric string in state. */
export function stripCommas(v: string): string {
  return v.replace(/,/g, "");
}

/**
 * Format a stored numeric value (string or number) as a display money string.
 * Default symbol is ₦. Always shows 2 decimal places.
 */
export function formatMoney(value: string | number, symbol = "₦"): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return `${symbol}0.00`;
  return symbol + num.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a number (string or number) with commas, no currency symbol.
 * Useful for quantities, shares, units.
 */
export function formatNumber(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-NG");
}
