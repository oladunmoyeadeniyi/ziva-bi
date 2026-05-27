"use client";

/**
 * Document Rules page — M8.2 Implementation Portal.
 *
 * One tab per activated module. Each tab shows document rules for that module
 * and allows adding / editing / deleting rules.
 *
 * Route: /dashboard/business/setup/documents
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ModuleState {
  module_key: string;
  label: string;
  is_active: boolean;
}

interface DocumentRule {
  id: string;
  module: string;
  transaction_type: string;
  document_name: string;
  is_required: boolean;
  track_expiry: boolean;
  ocr_template: string | null;
  max_size_mb: number;
  allowed_formats: string[] | null;
  max_files: number;
  is_active: boolean;
}

interface NewRule {
  transaction_type: string;
  document_name: string;
  is_required: boolean;
  track_expiry: boolean;
  ocr_template: string;
  max_size_mb: number;
  allowed_formats: string[];
  max_files: number;
}

const BLANK_RULE: NewRule = {
  transaction_type: "",
  document_name: "",
  is_required: true,
  track_expiry: false,
  ocr_template: "",
  max_size_mb: 10,
  allowed_formats: [],
  max_files: 0,
};

const FORMAT_OPTIONS = ["PDF", "JPG", "PNG", "XLSX", "CSV"];
const OCR_TEMPLATES = ["None", "Invoice standard", "Receipt standard", "Custom"];

export default function DocumentRulesPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [activeModule, setActiveModule] = useState<string>("");
  const [rules, setRules] = useState<DocumentRule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState<NewRule>(BLANK_RULE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch activated modules
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<{ modules: ModuleState[] }>("/api/setup/modules", { token: accessToken })
      .then((data) => {
        const active = data.modules.filter((m) => m.is_active);
        setModules(active);
        if (active.length > 0 && !activeModule) {
          setActiveModule(active[0].module_key);
        }
      })
      .catch((e) => setError(e.message));
  }, [accessToken]);

  // Fetch rules when module tab changes
  useEffect(() => {
    if (!accessToken || !activeModule) return;
    apiFetch<DocumentRule[]>(`/api/setup/documents?module=${activeModule}`, {
      token: accessToken,
    })
      .then(setRules)
      .catch((e) => setError(e.message));
  }, [accessToken, activeModule]);

  const addRule = async () => {
    if (!accessToken || !newRule.transaction_type || !newRule.document_name) return;
    setSaving(true);
    try {
      const created = await apiFetch<DocumentRule>("/api/setup/documents", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ ...newRule, module: activeModule }),
      });
      setRules((prev) => [...prev, created]);
      setNewRule(BLANK_RULE);
      setShowAdd(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/setup/documents/${id}`, {
        method: "DELETE",
        token: accessToken,
      });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete rule");
    }
  };

  const toggleFormat = (fmt: string) => {
    setNewRule((r) => ({
      ...r,
      allowed_formats: r.allowed_formats.includes(fmt)
        ? r.allowed_formats.filter((f) => f !== fmt)
        : [...r.allowed_formats, fmt],
    }));
  };

  const inputCls =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="p-8 max-w-5xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Document rules</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure required documents per module and transaction type.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {modules.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500">No modules activated yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Activate modules first, then configure document rules here.
          </p>
        </div>
      ) : (
        <>
          {/* Module tabs */}
          <div className="flex border-b border-gray-200 mb-6 gap-0.5 overflow-x-auto">
            {modules.map((m) => (
              <button
                key={m.module_key}
                type="button"
                onClick={() => setActiveModule(m.module_key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeModule === m.module_key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Rules table */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Add document rule
            </button>
          </div>

          {rules.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No rules for this module.</p>
          ) : (
            <div className="overflow-hidden border border-gray-200 rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Transaction type</th>
                    <th className="px-4 py-3 text-left">Document name</th>
                    <th className="px-4 py-3 text-center">Required</th>
                    <th className="px-4 py-3 text-center">Track expiry</th>
                    <th className="px-4 py-3 text-left">Formats</th>
                    <th className="px-4 py-3 text-center">Max MB</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{r.transaction_type}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.document_name}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.is_required ? (
                          <span className="text-xs font-medium text-red-600">Required</span>
                        ) : (
                          <span className="text-xs text-gray-400">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.track_expiry ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {r.allowed_formats?.join(", ") || "Any"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{r.max_size_mb}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => deleteRule(r.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add rule modal */}
          {showAdd && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Add document rule</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transaction type *</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. expense_report, vendor_invoice"
                      value={newRule.transaction_type}
                      onChange={(e) => setNewRule((r) => ({ ...r, transaction_type: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Document name *</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. Receipt, Purchase Order"
                      value={newRule.document_name}
                      onChange={(e) => setNewRule((r) => ({ ...r, document_name: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={newRule.is_required}
                        onChange={(e) => setNewRule((r) => ({ ...r, is_required: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      Required
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={newRule.track_expiry}
                        onChange={(e) => setNewRule((r) => ({ ...r, track_expiry: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      Track expiry
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">OCR template</label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newRule.ocr_template}
                        onChange={(e) => setNewRule((r) => ({ ...r, ocr_template: e.target.value }))}
                      >
                        {OCR_TEMPLATES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max size (MB)</label>
                      <input
                        type="number"
                        min={1}
                        className={inputCls}
                        value={newRule.max_size_mb}
                        onChange={(e) => setNewRule((r) => ({ ...r, max_size_mb: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Allowed formats</label>
                    <div className="flex gap-2 flex-wrap">
                      {FORMAT_OPTIONS.map((f) => (
                        <label key={f} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newRule.allowed_formats.includes(f)}
                            onChange={() => toggleFormat(f)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                          />
                          {f}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addRule}
                    disabled={saving || !newRule.transaction_type || !newRule.document_name}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Adding…" : "Add rule"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
