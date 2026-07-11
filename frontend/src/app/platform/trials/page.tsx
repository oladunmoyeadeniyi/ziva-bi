"use client";

/**
 * Platform — Trials & signups page.
 *
 * Lead management queue for inbound trial tenants. Consultants track
 * outreach progress (new → contacted → qualified → activated) and add
 * implementation notes before activating a tenant into in_implementation.
 *
 * Data sources:
 *   GET  /api/platform/trials                — list trial tenants
 *   PATCH /api/platform/trials/{id}          — update lead_status / notes
 *   PATCH /api/platform/tenants/{id}/lifecycle — activate (→ in_implementation)
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface TrialTenant {
  id: string;
  name: string;
  slug: string;
  country: string;
  environment: string;
  lifecycle_status: string;
  lead_status: "new" | "contacted" | "qualified" | "disqualified";
  implementation_notes: string | null;
  industry: string | null;
  company_email: string | null;
  user_count: number;
  created_at: string;
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  disqualified: "Disqualified",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-yellow-50 text-yellow-700 border-yellow-200",
  qualified: "bg-green-50 text-green-700 border-green-200",
  disqualified: "bg-gray-50 text-gray-500 border-gray-200",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function NotesCell({
  trial,
  onSave,
}: {
  trial: TrialTenant;
  onSave: (id: string, notes: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(trial.implementation_notes ?? "");
  const [saving, setSaving] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) taRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    setSaving(true);
    await onSave(trial.id, draft);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-1 group min-w-[140px]">
        <span className="text-xs text-gray-600 leading-relaxed line-clamp-2">
          {trial.implementation_notes || (
            <span className="text-gray-300 italic">No notes</span>
          )}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
          title="Edit notes"
        >
          <i className="ti ti-pencil text-gray-400 text-xs" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[200px]">
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        className="w-full text-xs border border-indigo-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
        placeholder="Add implementation notes…"
      />
      <div className="flex gap-2 mt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => { setDraft(trial.implementation_notes ?? ""); setEditing(false); }}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PlatformTrialsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [trials, setTrials] = useState<TrialTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activating, setActivating] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<TrialTenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TrialTenant[]>("/api/platform/trials", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setTrials(data);
    } catch {
      setError("Failed to load trials.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  // ── Update lead status ──────────────────────────────────────────────────────
  async function handleLeadStatusChange(id: string, status: string) {
    try {
      const updated = await apiFetch<TrialTenant>(`/api/platform/trials/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { lead_status: status },
      });
      setTrials((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      setError("Failed to update lead status.");
    }
  }

  // ── Save notes ──────────────────────────────────────────────────────────────
  async function handleSaveNotes(id: string, notes: string) {
    const updated = await apiFetch<TrialTenant>(`/api/platform/trials/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { implementation_notes: notes },
    });
    setTrials((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  // ── Activate ────────────────────────────────────────────────────────────────
  async function handleActivate(trial: TrialTenant) {
    setActivating(trial.id);
    setConfirmActivate(null);
    try {
      await apiFetch(`/api/platform/tenants/${trial.id}/lifecycle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { status: "in_implementation" },
      });
      // Also set lead_status to qualified if still 'new' or 'contacted'
      if (trial.lead_status === "new" || trial.lead_status === "contacted") {
        await apiFetch(`/api/platform/trials/${trial.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: { lead_status: "qualified" },
        });
      }
      // Remove from trials list (no longer 'trial' lifecycle)
      setTrials((prev) => prev.filter((t) => t.id !== trial.id));
    } catch {
      setError("Failed to activate tenant.");
    } finally {
      setActivating(null);
    }
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const stats = {
    total: trials.length,
    new: trials.filter((t) => t.lead_status === "new").length,
    contacted: trials.filter((t) => t.lead_status === "contacted").length,
    qualified: trials.filter((t) => t.lead_status === "qualified").length,
  };

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = trials.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.company_email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || t.lead_status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <PageContainer maxWidth="7xl">
      <PageHeading
        title="Trials & signups"
        subtitle="Manage inbound trial accounts and activate implementation"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total trials" value={stats.total} accent="text-gray-800" />
        <StatCard label="New" value={stats.new} accent="text-blue-600" />
        <StatCard label="Contacted" value={stats.contacted} accent="text-yellow-600" />
        <StatCard label="Qualified" value={stats.qualified} accent="text-green-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search company, slug or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 w-72"
        />
        <div className="flex gap-1">
          {["all", "new", "contacted", "qualified", "disqualified"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                filterStatus === s
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}
            >
              {s === "all" ? "All" : LEAD_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <i className="ti ti-rocket text-gray-200 text-5xl block mb-3" />
            <p className="text-sm text-gray-500">
              {trials.length === 0
                ? "No trial tenants yet. New signups appear here automatically."
                : "No trials match the current filter."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Company", "Country / Industry", "Contact", "Signed up", "Lead status", "Notes", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((trial) => (
                <tr
                  key={trial.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    trial.lead_status === "disqualified" ? "opacity-50" : ""
                  }`}
                >
                  {/* Company */}
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-800">{trial.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{trial.slug}</p>
                  </td>

                  {/* Country / Industry */}
                  <td className="py-3 px-4">
                    <p className="text-gray-700">{trial.country}</p>
                    {trial.industry && (
                      <p className="text-xs text-gray-400 mt-0.5">{trial.industry}</p>
                    )}
                  </td>

                  {/* Contact */}
                  <td className="py-3 px-4">
                    {trial.company_email ? (
                      <a
                        href={`mailto:${trial.company_email}`}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {trial.company_email}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {trial.user_count} user{trial.user_count !== 1 ? "s" : ""}
                    </p>
                  </td>

                  {/* Signed up */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <p className="text-gray-700">{fmtDate(trial.created_at)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {daysSince(trial.created_at)}d ago
                    </p>
                  </td>

                  {/* Lead status */}
                  <td className="py-3 px-4">
                    <select
                      value={trial.lead_status}
                      onChange={(e) => handleLeadStatusChange(trial.id, e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-1 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                        LEAD_STATUS_COLORS[trial.lead_status]
                      }`}
                    >
                      {Object.entries(LEAD_STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Notes */}
                  <td className="py-3 px-4 max-w-[220px]">
                    <NotesCell trial={trial} onSave={handleSaveNotes} />
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {trial.lead_status !== "disqualified" && (
                        <button
                          onClick={() => setConfirmActivate(trial)}
                          disabled={activating === trial.id}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 whitespace-nowrap"
                        >
                          {activating === trial.id ? "Activating…" : "Activate"}
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/platform/tenants/${trial.id}`)}
                        className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Activate confirm modal */}
      {confirmActivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmActivate(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              Activate implementation?
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{confirmActivate.name}</strong> will move from{" "}
              <span className="font-medium text-blue-600">Trial</span> to{" "}
              <span className="font-medium text-indigo-600">In implementation</span>.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              The tenant user will be able to start the guided setup process. Make sure you have
              set the posting mode and licensed the correct modules before activating.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmActivate(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => handleActivate(confirmActivate)}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg"
              >
                Yes, activate
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
