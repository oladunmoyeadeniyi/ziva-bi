"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface FinanceReviewer {
  id: string;
  module: string;
  user_id: string;
  user_name: string;
  user_email: string;
  review_level: number;
  scope: string | null;
  is_active: boolean;
  created_at: string;
}

interface TenantUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

const MODULES = [
  { key: "expense_retirement", label: "Expense Retirement" },
  { key: "accounts_payable", label: "Accounts Payable" },
];

export default function FinanceReviewPage() {
  const { accessToken: token } = useAuth();
  const [activeModule, setActiveModule] = useState("expense_retirement");
  const [reviewers, setReviewers] = useState<FinanceReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    user_id: "",
    review_level: 1,
    scope: "",
  });
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editReviewer, setEditReviewer] = useState<FinanceReviewer | null>(null);
  const [editForm, setEditForm] = useState({ review_level: 1, scope: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "";

  const fetchReviewers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/hr/finance-review?module=${activeModule}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      setReviewers(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [API, token, activeModule]);

  useEffect(() => { fetchReviewers(); }, [fetchReviewers]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch {}
  }, [API, token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAdd() {
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch(`${API}/api/hr/finance-review`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          module: activeModule,
          user_id: addForm.user_id,
          review_level: addForm.review_level,
          scope: addForm.scope || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAddOpen(false);
      setAddForm({ user_id: "", review_level: 1, scope: "" });
      fetchReviewers();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setAddSaving(false);
    }
  }

  function openEdit(r: FinanceReviewer) {
    setEditReviewer(r);
    setEditForm({ review_level: r.review_level, scope: r.scope ?? "" });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editReviewer) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`${API}/api/hr/finance-review/${editReviewer.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          review_level: editForm.review_level,
          scope: editForm.scope || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditOpen(false);
      fetchReviewers();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`${API}/api/hr/finance-review/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchReviewers();
    } catch {}
    setDeleteId(null);
  }

  const moduleLabel = MODULES.find((m) => m.key === activeModule)?.label ?? activeModule;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <PageHeading title="Finance Review" subtitle="Configure finance reviewers for each module" />
        <Button variant="primary" onClick={() => { setAddError(null); setAddOpen(true); }}>
          + Add Reviewer
        </Button>
      </div>

      {/* Module tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveModule(m.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeModule === m.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-400 text-center py-10">Loading…</div>
      )}

      {!loading && reviewers.length === 0 && !error && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <div className="text-sm">No reviewers configured for {moduleLabel}</div>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            Add the first reviewer
          </button>
        </div>
      )}

      {!loading && reviewers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Level</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reviewer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Scope</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviewers.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {r.review_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.user_name}</div>
                    <div className="text-xs text-gray-400">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.scope ?? <span className="text-gray-300 italic">All</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(r.id)}
                        className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Reviewer Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Add Reviewer</h2>
            <p className="text-sm text-gray-500 mb-5">
              Add a finance reviewer for {moduleLabel}
            </p>

            {addError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                {addError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User *</label>
                <select
                  value={addForm.user_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, user_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Level *
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={addForm.review_level}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, review_level: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Lower numbers review first. Level 1 is the first reviewer in the chain.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={addForm.scope}
                  onChange={(e) => setAddForm((f) => ({ ...f, scope: e.target.value }))}
                  placeholder="e.g. department name, cost center, all"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAdd} disabled={addSaving || !addForm.user_id} loading={addSaving}>
                {addSaving ? "Adding…" : "Add Reviewer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && editReviewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Edit Reviewer</h2>
            <p className="text-sm text-gray-500 mb-5">
              {editReviewer.user_name} — {moduleLabel}
            </p>

            {editError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Level *
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={editForm.review_level}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, review_level: parseInt(e.target.value) || 1 }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editForm.scope}
                  onChange={(e) => setEditForm((f) => ({ ...f, scope: e.target.value }))}
                  placeholder="e.g. department name, cost center, all"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleEdit} disabled={editSaving} loading={editSaving}>
                {editSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Remove Reviewer?</h2>
            <p className="text-sm text-gray-500 mb-6">
              This reviewer will be removed from the {moduleLabel} finance review chain.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteId)}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
