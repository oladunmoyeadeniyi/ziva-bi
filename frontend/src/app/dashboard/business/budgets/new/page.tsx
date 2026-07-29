"use client";

/**
 * New Budget Period form — M16 Budget & Planning.
 *
 * Creates a budget period (name, fiscal year, date range).
 * Lines are added from the detail page after creation.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

export default function NewBudgetPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [name, setName] = useState(`FY ${currentYear} Annual Budget`);
  const [fiscalYear, setFiscalYear] = useState<number>(currentYear);
  const [periodStart, setPeriodStart] = useState(`${currentYear}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(`${currentYear}-12-31`);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await apiFetch<{ id: string }>("/api/budgets", {
        method: "POST",
        body: JSON.stringify({
          name,
          fiscal_year: fiscalYear,
          period_start: periodStart,
          period_end: periodEnd,
          description: description || null,
        }),
      });
      router.push(`/dashboard/business/budgets/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create budget.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeading title="New Budget Period" subtitle="Define the budget envelope. Add line allocations after creation." />

      <div className="max-w-2xl mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. FY 2025 Annual Budget"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year *</label>
              <input
                type="number"
                required
                value={fiscalYear}
                onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                min={2000}
                max={2100}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start *</label>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End *</label>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="Optional context or narrative for this budget..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create Budget"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/dashboard/business/budgets")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
