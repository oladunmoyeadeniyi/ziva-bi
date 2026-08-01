"use client";

/**
 * Create new consolidation group — IxE.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

export default function NewConsolidationGroupPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    currency: "NGN",
    ic_match_tolerance: "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError("");
    try {
      const group = await apiFetch<{ id: string }>("/api/consolidation/groups", {
        token: accessToken,
        method: "POST",
        body: {
          ...form,
          ic_match_tolerance: parseFloat(form.ic_match_tolerance) || 0,
        },
      });
      router.push(`/dashboard/business/consolidation/groups/${group.id}/members`);
    } catch {
      setError("Failed to create group. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeading
        title="New Consolidation Group"
        subtitle="Define the consolidation perimeter for a group of entities"
        backHref="/dashboard/business/consolidation"
      />

      <div className="max-w-lg bg-white border border-gray-200 rounded-lg p-6">
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Group Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Red Bull Nigeria Group"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="label">Presentation Currency *</label>
            <input
              className="input"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              maxLength={3}
              required
              placeholder="NGN"
            />
            <p className="text-xs text-gray-400 mt-1">ISO 4217 code (e.g. NGN, USD, GBP)</p>
          </div>
          <div>
            <label className="label">IC Match Tolerance</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.ic_match_tolerance}
              onChange={(e) => setForm({ ...form, ic_match_tolerance: e.target.value })}
              placeholder="0"
            />
            <p className="text-xs text-gray-400 mt-1">
              Maximum difference (in currency units) between matched IC positions. 0 = exact match only.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create Group"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
