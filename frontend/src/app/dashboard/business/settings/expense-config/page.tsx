"use client";

/**
 * Expense Config settings — /dashboard/business/settings/expense-config
 *
 * Tenant Admin only. Sections:
 *   1. Coding Level — 5 cards (0–4) replacing the old GL Coding Mode radio buttons
 *   2. Expense Categories — require_category / require_subcategory toggles
 *   3. Form Fields — show/require location field
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";

interface ExpenseConfig {
  coding_level: number;
  require_category: boolean;
  require_subcategory: boolean;
  allow_free_text_description: boolean;
  show_location: boolean;
  require_location: boolean;
}

const CODING_LEVELS = [
  {
    level: 0,
    name: "Finance codes everything",
    description: "No GL fields visible to employees. Finance assigns GL codes during review.",
  },
  {
    level: 1,
    name: "Category only",
    description: "Employee picks a category and subcategory. GL is auto-assigned from mapping — hidden from employee.",
  },
  {
    level: 2,
    name: "Category + GL confirmation",
    description: "Employee picks category/subcategory and sees the suggested GL (read-only). Can flag if incorrect.",
  },
  {
    level: 3,
    name: "Guided GL selection",
    description: "Employee picks category/subcategory, then selects final GL from a filtered shortlist.",
  },
  {
    level: 4,
    name: "Full GL coding",
    description: "Employee types or searches the GL account directly — no category guidance.",
  },
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ExpenseConfigPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postingMode, setPostingMode] = useState<'lite' | 'connected' | 'full_erp' | null>(null);

  const [codingLevel, setCodingLevel] = useState(0);
  const [requireCategory, setRequireCategory] = useState(false);
  const [requireSubcategory, setRequireSubcategory] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [requireLocation, setRequireLocation] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) {
      router.replace("/dashboard/business");
    }
  }, [user, router]);

  useEffect(() => {
    if (!accessToken) return;
    // Fetch posting mode for coding level lock in Lite
    apiFetch<{ posting_mode?: string }>("/api/setup/org", { token: accessToken })
      .then((d) => { if (d.posting_mode) setPostingMode(d.posting_mode as 'lite' | 'connected' | 'full_erp'); })
      .catch(() => {});
    apiFetch<ExpenseConfig>("/api/expense-config", { token: accessToken })
      .then((cfg) => {
        setCodingLevel(cfg.coding_level ?? 0);
        setRequireCategory(cfg.require_category);
        setRequireSubcategory(cfg.require_subcategory);
        setShowLocation(cfg.show_location ?? true);
        setRequireLocation(cfg.require_location ?? false);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  const handleSave = async () => {
    if (!accessToken) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await apiFetch("/api/expense-config", {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({
          coding_level: codingLevel,
          require_category: requireCategory,
          require_subcategory: requireCategory ? requireSubcategory : false,
          show_location: showLocation,
          require_location: showLocation ? requireLocation : false,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <PageContainer maxWidth="3xl">
      <PageHeading title="Expense Form Config" />
      <p className="text-sm text-gray-500 mb-8">
        Control how much GL responsibility employees carry when submitting expenses.
      </p>

      {error && (
        <Banner variant="error" className="mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold ml-2">×</button>
        </Banner>
      )}

      {/* ── Section 1: Coding Level ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-1">
          Coding Level
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          How much GL involvement does the employee have when submitting an expense?
        </p>

        {/* Lite mode: GL coding not applicable — lock all coding level cards */}
        {postingMode === 'lite' && (
          <Banner variant="warning" className="mb-4">
            GL coding is not available in Lite mode. Expenses will be approved and exported without
            GL account coding. To enable GL coding, upgrade to Connected or Full ERP mode.
            {codingLevel > 0 && (
              <span className="block mt-1 text-xs">
                Your current coding level will be ignored in Lite mode.
              </span>
            )}
          </Banner>
        )}

        <div className={`grid grid-cols-1 gap-3 ${postingMode === 'lite' ? "opacity-50 pointer-events-none select-none" : ""}`}>
          {CODING_LEVELS.map(({ level, name, description }) => (
            <button
              key={level}
              type="button"
              onClick={() => setCodingLevel(level)}
              disabled={postingMode === 'lite'}
              className={`text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-colors ${
                codingLevel === level
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <span
                className={`mt-0.5 w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                  codingLevel === level
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {level}
              </span>
              <div>
                <p className={`text-sm font-semibold ${codingLevel === level ? "text-blue-800" : "text-gray-800"}`}>
                  {name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 2: Expense Categories ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">
          Expense Categories
        </h2>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Require expense category</p>
            <p className="text-xs text-gray-500">Employees must select a category on each expense line.</p>
          </div>
          <Toggle
            checked={requireCategory}
            onChange={() => { setRequireCategory((v) => !v); if (requireCategory) setRequireSubcategory(false); }}
          />
        </div>

        {requireCategory && (
          <div className="flex items-center justify-between pl-4 border-l-2 border-blue-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Require subcategory</p>
              <p className="text-xs text-gray-500">Employees must also select a subcategory.</p>
            </div>
            <Toggle checked={requireSubcategory} onChange={() => setRequireSubcategory((v) => !v)} />
          </div>
        )}
      </div>

      {/* ── Section 3: Form Fields ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">
          Form Fields
        </h2>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Show Location field</p>
            <p className="text-xs text-gray-500">Display the Location field on each expense line.</p>
          </div>
          <Toggle
            checked={showLocation}
            onChange={() => { setShowLocation((v) => !v); if (showLocation) setRequireLocation(false); }}
          />
        </div>

        {showLocation && (
          <div className="flex items-center justify-between pl-4 border-l-2 border-blue-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Require Location</p>
              <p className="text-xs text-gray-500">Employees must fill in a location on each line.</p>
            </div>
            <Toggle checked={requireLocation} onChange={() => setRequireLocation((v) => !v)} />
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} disabled={isSaving} loading={isSaving}>
          {isSaving ? "Saving…" : "Save Configuration"}
        </Button>
        {saveSuccess && (
          <span className="text-sm text-green-600 font-medium">Saved successfully</span>
        )}
      </div>
    </PageContainer>
  );
}
