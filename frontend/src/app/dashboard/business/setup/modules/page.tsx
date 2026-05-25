"use client";

/**
 * Module Activation page — M8.2 Fixes.
 *
 * Split-panel layout:
 *   Left (40%): two groups — subscribed modules (is_licensed=true) and available to add (is_licensed=false).
 *   Right (60%): module detail, key features, configure items, dependencies, and activate toggle.
 *
 * Route: /dashboard/business/setup/modules
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ModuleState {
  module_key: string;
  label: string;
  is_active: boolean;
  is_licensed: boolean;
}

interface ModulesResponse {
  modules: ModuleState[];
}

const MODULE_ICONS: Record<string, string> = {
  expense:         "receipt",
  ap:              "invoice",
  ar:              "credit-card",
  payroll:         "wallet",
  inventory:       "package",
  fixed_assets:    "chart-pie",
  posm:            "tags",
  vendor_portal:   "truck",
  customer_portal: "user-check",
  warehouse:       "building-warehouse",
  bank_recon:      "building-bank",
  budget:          "chart-bar",
  tax_engine:      "calculator",
  reporting:       "chart-dots",
};

interface ModuleDetail {
  description: string;
  features: string[];
  configure: string[];
  dependencies: string;
}

const MODULE_DETAILS: Record<string, ModuleDetail> = {
  expense: {
    description: "End-to-end employee expense retirement with multi-level approvals and AI-powered GL coding.",
    features: [
      "Multi-line expense submission",
      "GL coding with dimension mapping",
      "Approval matrix (LM → Finance)",
      "AI-powered GL suggestions",
      "Receipt OCR auto-fill (coming soon)",
      "Split lines per invoice",
      "Budget checking (coming soon)",
    ],
    configure: ["GL coding level", "Expense categories", "Approval matrix", "Expense limits per category"],
    dependencies: "Requires Chart of Accounts and Dimensions.",
  },
  ap: {
    description: "Full vendor invoice processing with WHT, VAT, PO matching and multi-level payment approvals.",
    features: [
      "Vendor onboarding workflow",
      "PO and non-PO invoice processing",
      "WHT and VAT computation",
      "Multi-level payment approvals",
      "Advance payment tracking",
      "Clearing agent processing",
    ],
    configure: ["Vendor categories", "WHT rules", "VAT rules", "PO thresholds", "Payment terms"],
    dependencies: "Requires Chart of Accounts and Dimensions.",
  },
  ar: {
    description: "Customer order management, invoicing, credit control and collections.",
    features: [
      "Customer onboarding",
      "Sales order processing",
      "Credit limit enforcement",
      "Delivery confirmation",
      "Returns workflow",
      "Customer portal access",
    ],
    configure: ["Customer categories", "Credit rules", "Payment terms", "Pricing rules"],
    dependencies: "Requires Chart of Accounts.",
  },
  payroll: {
    description: "Full payroll computation with statutory deductions, leave management and employee payslip portal.",
    features: [
      "Payroll calculation engine",
      "PAYE and statutory deductions",
      "Leave management",
      "Employee payslip portal",
      "Payroll comparison engine",
      "Outsourced staff billing",
    ],
    configure: ["Earnings and deductions", "PAYE tables", "Pension rules", "Leave types"],
    dependencies: "Requires Employees module.",
  },
  inventory: {
    description: "Multi-warehouse stock tracking with costing methods and FIFO/FEFO rotation.",
    features: [
      "Multi-warehouse tracking",
      "FIFO/FEFO stock rotation",
      "Standard and weighted average costing",
      "Expiry date tracking",
      "Stock count workflows",
      "Damaged goods handling",
    ],
    configure: ["Warehouses and locations", "Costing method", "Stock categories"],
    dependencies: "None.",
  },
  fixed_assets: {
    description: "Asset register, automated depreciation, disposal workflow and capital work in progress.",
    features: [
      "Asset register import",
      "Multi-class depreciation rules",
      "Automated depreciation engine",
      "Disposal and transfer workflow",
      "Capital work in progress tracking",
    ],
    configure: ["Asset classes", "Depreciation methods", "Useful lives"],
    dependencies: "Requires Chart of Accounts.",
  },
  posm: {
    description: "Track point-of-sale materials from procurement through issuance to return.",
    features: [
      "POSM catalogue management",
      "Issuance to outlets and staff",
      "Return tracking and reconciliation",
      "Stock position by location",
    ],
    configure: ["POSM categories", "Issuance rules", "Return policy"],
    dependencies: "None.",
  },
  vendor_portal: {
    description: "Secure online vendor onboarding, KYC document submission and invoice tracking.",
    features: [
      "Secure onboarding link (expires 30 days)",
      "Online KYC form and document upload",
      "Vendor invoice submission",
      "Invoice and payment status tracking",
      "Banking change verification workflow",
    ],
    configure: ["KYC requirements", "Onboarding workflow", "Vendor categories"],
    dependencies: "Requires Accounts Payable.",
  },
  customer_portal: {
    description: "Self-service portal for customers to track orders, deliveries and account statements.",
    features: [
      "Order tracking",
      "Delivery status updates",
      "Account statement view",
      "Return request submission",
      "Automated monthly reconciliation email",
    ],
    configure: ["Portal access rules", "Statement settings", "Notification preferences"],
    dependencies: "Requires Accounts Receivable.",
  },
  warehouse: {
    description: "Inbound shipment receiving, stock management and delivery confirmation for warehouse or 3PL partners.",
    features: [
      "Inbound shipment receiving",
      "Damaged and missing goods tracking",
      "POSM issuance and return",
      "Stock valuation by location",
      "Delivery confirmation triggering AR events",
    ],
    configure: ["Warehouse locations", "Stock rules", "Damage categories"],
    dependencies: "Requires Inventory Management.",
  },
  bank_recon: {
    description: "Upload bank statements in any format and auto-match transactions to the GL.",
    features: [
      "Multi-format statement upload (PDF, Excel, CSV)",
      "Auto-matching engine (exact and fuzzy)",
      "Exception queue management",
      "Auto-post reconciling journals",
      "Multi-bank and multi-currency support",
      "Fraud detection suggestions",
    ],
    configure: ["Bank accounts", "Matching rules", "Journal templates"],
    dependencies: "Requires Chart of Accounts.",
  },
  budget: {
    description: "Upload and manage budget versions (BP/FRE/SRE) with real-time actuals comparison.",
    features: [
      "Budget upload via Excel/CSV",
      "Multiple versions (BP, FRE, SRE)",
      "Budget vs actual dashboards",
      "Budget owner intelligence alerts",
      "Real-time budget impact checks in AP and Expenses",
    ],
    configure: ["Budget versions", "Budget owners", "GL/dimension mapping"],
    dependencies: "Requires Chart of Accounts and Dimensions.",
  },
  tax_engine: {
    description: "Corporate tax computation with capital allowances, deferred tax and multi-year tracking.",
    features: [
      "Corporate tax computation",
      "Education tax and industry levies",
      "Capital allowance calculation",
      "Allowable and disallowable expense classification",
      "Deferred tax computation",
      "Multi-year tracking and comparison",
    ],
    configure: ["Tax rules per jurisdiction", "Capital allowance classes", "Disallowable expense categories"],
    dependencies: "Requires Chart of Accounts.",
  },
  reporting: {
    description: "Real-time financial and operational dashboards with scheduled report delivery.",
    features: [
      "Financial statements (P&L, Balance Sheet, Cash Flow)",
      "Operational dashboards per module",
      "Scheduled report emails",
      "Custom report builder",
      "Export to Excel and PDF",
    ],
    configure: ["Report schedules", "Dashboard layout", "Distribution lists"],
    dependencies: "Requires Chart of Accounts.",
  },
};

const Icon = ({ name, size = 16 }: { name: string; size?: number }) => (
  <i className={`ti ti-${name}`} style={{ fontSize: size, lineHeight: 1 }} />
);

function ModuleCard({
  mod,
  selected,
  onClick,
}: {
  mod: ModuleState;
  selected: boolean;
  onClick: () => void;
}) {
  const icon = MODULE_ICONS[mod.module_key] ?? "puzzle";
  const unlicensed = !mod.is_licensed;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
        selected
          ? "bg-blue-50 border border-blue-200"
          : unlicensed
          ? "border border-dashed border-gray-200 opacity-60 hover:opacity-80 hover:border-gray-300 bg-white"
          : mod.is_active
          ? "border border-green-200 bg-green-50 hover:border-green-300"
          : "border border-gray-200 bg-white hover:border-gray-300",
      ].join(" ")}
    >
      <span className={unlicensed ? "text-gray-400" : mod.is_active ? "text-green-600" : "text-gray-500"}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex-1 text-[13px] font-medium text-gray-800 truncate">{mod.label}</span>
      {mod.is_licensed && (
        <span
          className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            mod.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {mod.is_active ? "On" : "Off"}
        </span>
      )}
    </button>
  );
}

export default function ModuleActivationPage() {
  const { accessToken } = useAuth();
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiFetch<ModulesResponse>("/api/setup/modules", { token: accessToken });
      setModules(data.modules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load modules");
    }
  }, [accessToken]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleToggle = async (mod: ModuleState) => {
    if (!mod.is_licensed) return;
    setToggling(true);
    setError(null);
    try {
      const payload: Record<string, boolean> = { [mod.module_key]: !mod.is_active };
      const data = await apiFetch<ModulesResponse>("/api/setup/modules", {
        method: "PATCH",
        token: accessToken!,
        body: { modules: payload },
      });
      setModules(data.modules);
      setSuccessMsg(mod.is_active ? `${mod.label} deactivated.` : `${mod.label} activated.`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setToggling(false);
    }
  };

  const subscribed = modules.filter((m) => m.is_licensed);
  const available = modules.filter((m) => !m.is_licensed);
  const selectedMod = modules.find((m) => m.module_key === selected) ?? null;
  const detail = selected ? MODULE_DETAILS[selected] : null;

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-[40%] border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-base font-semibold text-gray-900">Module activation</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Activate modules your organisation will use. Only active modules appear in Module Setup.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* Subscribed */}
          <div>
            <p className="px-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              Your subscribed modules
            </p>
            <div className="space-y-1">
              {subscribed.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 italic">No licensed modules yet.</p>
              ) : (
                subscribed.map((mod) => (
                  <ModuleCard
                    key={mod.module_key}
                    mod={mod}
                    selected={selected === mod.module_key}
                    onClick={() => setSelected(mod.module_key)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Available */}
          {available.length > 0 && (
            <div>
              <p className="px-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Available to add
              </p>
              <div className="space-y-1">
                {available.map((mod) => (
                  <ModuleCard
                    key={mod.module_key}
                    mod={mod}
                    selected={selected === mod.module_key}
                    onClick={() => setSelected(mod.module_key)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedMod ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Icon name="cursor-text" size={32} />
            <p className="mt-3 text-sm">Select a module to see details</p>
          </div>
        ) : (
          <div className="max-w-xl">
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <span className="text-gray-600 mt-0.5">
                <Icon name={MODULE_ICONS[selectedMod.module_key] ?? "puzzle"} size={24} />
              </span>
              <div>
                <h2 className="text-[15px] font-[500] text-gray-900">{selectedMod.label}</h2>
                {detail && <p className="text-sm text-gray-500 mt-0.5">{detail.description}</p>}
              </div>
            </div>

            {detail && (
              <>
                {/* Key features */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key features</p>
                  <ul className="space-y-1">
                    {detail.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ti ti-circle-check text-green-500 mt-0.5" style={{ fontSize: 13 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What you'll configure */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What you&apos;ll configure</p>
                  <ul className="space-y-1">
                    {detail.configure.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ti ti-settings text-gray-400 mt-0.5" style={{ fontSize: 13 }} />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Dependencies */}
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dependencies</p>
                  <p className="text-sm text-gray-600">{detail.dependencies}</p>
                </div>
              </>
            )}

            {/* Status messages */}
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            {successMsg && <p className="mb-3 text-sm text-green-600">{successMsg}</p>}

            {/* Action */}
            {selectedMod.is_licensed ? (
              <button
                type="button"
                disabled={toggling}
                onClick={() => handleToggle(selectedMod)}
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  selectedMod.is_active
                    ? "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                    : "bg-green-600 text-white hover:bg-green-700",
                  toggling ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {toggling
                  ? "Saving…"
                  : selectedMod.is_active
                  ? `Deactivate ${selectedMod.label}`
                  : `Activate ${selectedMod.label}`}
              </button>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  This module is not included in your current subscription. Contact your Ziva BI consultant or account manager to add it.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
