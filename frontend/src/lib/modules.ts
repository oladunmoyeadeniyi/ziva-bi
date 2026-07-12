/**
 * frontend/src/lib/modules.ts
 * ===========================
 * Frontend single source of truth for all Ziva BI module definitions.
 *
 * Mirrors backend/app/constants/modules.py — keep in sync when adding
 * or removing modules. Both files must be updated together.
 *
 * Usage
 * -----
 *   import { MODULE_CATALOGUE, MODULE_KEY_TO_LABEL } from "@/lib/modules";
 *
 *   // Iterate all modules:
 *   MODULE_CATALOGUE.forEach(m => console.log(m.key, m.label));
 *
 *   // Look up a label:
 *   const label = MODULE_KEY_TO_LABEL["expense"]; // "Expense Management"
 */

export interface ModuleEntry {
  key: string;
  label: string;
}

export const MODULE_CATALOGUE: ModuleEntry[] = [
  { key: "expense",         label: "Expense Management" },
  { key: "ap",              label: "Accounts Payable" },
  { key: "ar",              label: "Accounts Receivable" },
  { key: "payroll",         label: "Payroll & HR" },
  { key: "bank_recon",      label: "Bank Reconciliation" },
  { key: "budget",          label: "Budget Engine" },
  { key: "tax_engine",      label: "Tax Engine" },
  { key: "inventory",       label: "Inventory & Warehouse" },
  { key: "fixed_assets",    label: "Fixed Assets" },
  { key: "posm",            label: "POSM Management" },
  { key: "vendor_portal",   label: "Vendor Portal" },
  { key: "customer_portal", label: "Customer Portal" },
  { key: "warehouse",       label: "Warehouse / 3PL Portal" },
  { key: "reporting",       label: "Reporting & Analytics" },
];

export const MODULE_KEY_TO_LABEL: Record<string, string> = Object.fromEntries(
  MODULE_CATALOGUE.map((m) => [m.key, m.label])
);
