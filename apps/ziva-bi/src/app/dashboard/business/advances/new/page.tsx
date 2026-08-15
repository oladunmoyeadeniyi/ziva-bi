"use client";

/**
 * New Advance Request — /dashboard/business/advances/new
 *
 * Any authenticated employee can request an advance.
 * Saves as DRAFT. Employee then submits from the detail page.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

export default function NewAdvancePage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    advance_type: "TRAVEL",
    purpose: "",
    amount: "",
    currency: "NGN",
    request_date: new Date().toISOString().slice(0, 10),
    required_by_date: "",
    due_retirement_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!form.purpose.trim()) { setError("Purpose is required."); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Amount must be greater than zero."); return; }

    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        advance_type: form.advance_type,
        purpose:      form.purpose.trim(),
        amount:       parseFloat(form.amount),
        currency:     form.currency,
        request_date: form.request_date,
      };
      if (form.required_by_date)   body.required_by_date   = form.required_by_date;
      if (form.due_retirement_date) body.due_retirement_date = form.due_retirement_date;
      if (form.notes.trim())        body.notes              = form.notes.trim();

      const adv = await apiFetch<{ id: string }>("/api/advances", {
        method: "POST",
        token: accessToken,
        body,
      });
      router.push(`/dashboard/business/advances/${adv.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create advance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeading title="New Advance Request" subtitle="Request a cash advance for travel or operations" />

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5 mt-2">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Advance type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Advance type *</label>
          <select
            name="advance_type"
            value={form.advance_type}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="TRAVEL">Travel</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
          <textarea
            name="purpose"
            value={form.purpose}
            onChange={handleChange}
            rows={3}
            placeholder="Describe what this advance is for…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Amount + Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              type="text"
              name="currency"
              value={form.currency}
              onChange={handleChange}
              maxLength={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request date *</label>
            <input
              type="date"
              name="request_date"
              value={form.request_date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required by</label>
            <input
              type="date"
              name="required_by_date"
              value={form.required_by_date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retire by</label>
            <input
              type="date"
              name="due_retirement_date"
              value={form.due_retirement_date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Any additional context…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save as draft"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
