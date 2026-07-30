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
 *   import { MODULE_CATALOGUE, MODULE_KEY_TO_LABEL, MODULE_MODE_AVAILABILITY } from "@/lib/modules";
 *
 *   // Iterate all modules:
 *   MODULE_CATALOGUE.forEach(m => console.log(m.key, m.label));
 *
 *   // Look up a label:
 *   const label = MODULE_KEY_TO_LABEL["expense"]; // "Expense Management"
 *
 *   // Check if a module is available for a given posting mode:
 *   const available = (MODULE_MODE_AVAILABILITY["payroll"] ?? []).includes("lite"); // false
 */

export interface ModuleEntry {
  key: string;
  label: string;
}

export const MODULE_CATALOGUE: ModuleEntry[] = [
  { key: "expense",         label: "Expense Management" },
  { key: "ap",              label: "Accounts Payable (P2P)" },
  { key: "ar",              label: "Accounts Receivable (O2C)" },
  { key: "payroll",         label: "Payroll & HR" },
  { key: "bank_recon",      label: "Bank Reconciliation" },
  { key: "budget",          label: "Budget & Planning" },
  { key: "tax_engine",      label: "Tax & Compliance" },
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

/**
 * Which posting modes each module is available in.
 * Lite supports only the 5 approval/cost-tracking modules.
 * Connected and Full ERP unlock all 14 modules.
 *
 * Mirrors the allowlist enforced in backend/app/constants/modules.py and
 * in frontend/src/app/dashboard/business/setup/modules/page.tsx.
 */
export const MODULE_MODE_AVAILABILITY: Record<string, string[]> = {
  expense:         ["lite", "connected", "full_erp"],
  ap:              ["lite", "connected", "full_erp"],
  ar:              ["lite", "connected", "full_erp"],
  tax_engine:      ["lite", "connected", "full_erp"],
  reporting:       ["lite", "connected", "full_erp"],
  payroll:         ["connected", "full_erp"],
  bank_recon:      ["connected", "full_erp"],
  budget:          ["connected", "full_erp"],
  inventory:       ["connected", "full_erp"],
  fixed_assets:    ["connected", "full_erp"],
  posm:            ["connected", "full_erp"],
  vendor_portal:   ["connected", "full_erp"],
  customer_portal: ["connected", "full_erp"],
  warehouse:       ["connected", "full_erp"],
};
