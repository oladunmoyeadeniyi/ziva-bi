"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import PageHeading from "@/components/PageHeading";

interface CostCenterConfig {
  id: string;
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  head_employee_id: string | null;
  head_employee_name: string | null;
  head_employee_email: string | null;
  head_employee_code: string | null;
  // M9.3b: resolved from the head's email → user_id by the backend batch lookup.
  // null when head is unset or has no Ziva portal account yet.
  head_user_id: string | null;
}

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
}

export default function CostCentersPage() {
  const { accessToken: token, user, startUserImpersonation } = useAuth();
  const router = useRouter();
  const [impersonatingCCId, setImpersonatingCCId] = useState<string | null>(null);
  const [costCenters, setCostCenters] = useState<CostCenterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set Head modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCC, setModalCC] = useState<CostCenterConfig | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL ?? "";

  const fetchCostCenters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/hr/cost-centers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setCostCenters(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load cost centers");
    } finally {
      setLoading(false);
    }
  }, [API, token]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  const searchEmployees = useCallback(async (q: string) => {
    if (!q.trim()) { setEmployees([]); return; }
    setEmpLoading(true);
    try {
      const res = await fetch(
        `${API}/api/hr/employees?search=${encodeURIComponent(q)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setEmployees(await res.json());
    } finally {
      setEmpLoading(false);
    }
  }, [API, token]);

  useEffect(() => {
    const t = setTimeout(() => searchEmployees(employeeSearch), 300);
    return () => clearTimeout(t);
  }, [employeeSearch, searchEmployees]);

  function openSetHead(cc: CostCenterConfig) {
    setModalCC(cc);
    setSelectedEmp(null);
    setEmployeeSearch("");
    setEmployees([]);
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSaveHead() {
    if (!modalCC) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, string | null> = {
        head_employee_id: selectedEmp ? selectedEmp.id : null,
      };
      const res = await fetch(`${API}/api/hr/cost-centers/${modalCC.cost_center_id}/head`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setModalOpen(false);
      fetchCostCenters();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveHead(cc: CostCenterConfig) {
    try {
      await fetch(`${API}/api/hr/cost-centers/${cc.cost_center_id}/head`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ head_employee_id: null }),
      });
      fetchCostCenters();
    } catch {}
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <PageHeading title="Cost Centers" subtitle="Assign department heads to cost centers" />
      </div>

      {loading && (
        <div className="text-sm text-gray-500 py-10 text-center">Loading…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {!loading && costCenters.length === 0 && !error && (
        <div className="text-sm text-gray-400 text-center py-10">
          No cost centers found. Add cost centers via Chart of Accounts upload.
        </div>
      )}

      {!loading && costCenters.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Head</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costCenters.map((cc) => (
                <tr key={cc.cost_center_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {cc.cost_center_code}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {cc.cost_center_name}
                  </td>
                  <td className="px-4 py-3">
                    {cc.head_employee_name ? (
                      <div>
                        <div className="text-gray-900 font-medium">{cc.head_employee_name}</div>
                        <div className="text-xs text-gray-400">
                          {cc.head_employee_code} · {cc.head_employee_email}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-xs">No head assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openSetHead(cc)}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {cc.head_employee_id ? "Change Head" : "Set Head"}
                      </button>
                      {cc.head_employee_id && (
                        <button
                          onClick={() => handleRemoveHead(cc)}
                          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                      {/* M9.3b: Impersonate the cost center head — SA only. */}
                      {user?.is_super_admin && cc.head_employee_id && (
                        <button
                          type="button"
                          disabled={!!impersonatingCCId || !cc.head_user_id}
                          title={!cc.head_user_id ? "No portal account — head has not registered on Ziva" : "Impersonate cost center head"}
                          onClick={async () => {
                            if (!cc.head_user_id) return;
                            setImpersonatingCCId(cc.cost_center_id);
                            try {
                              await startUserImpersonation(cc.head_user_id, "employee_list");
                              router.push("/dashboard/business");
                            } catch {
                              setImpersonatingCCId(null);
                            }
                          }}
                          className={`text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                            cc.head_user_id
                              ? "text-indigo-600 hover:text-indigo-800"
                              : "text-gray-400"
                          }`}
                        >
                          {impersonatingCCId === cc.cost_center_id ? "Entering…" : "Impersonate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Set Head Modal */}
      {modalOpen && modalCC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Set Head — {modalCC.cost_center_name}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Search and select an employee to assign as cost center head
            </p>

            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
                {saveError}
              </div>
            )}

            {/* Current head */}
            {modalCC.head_employee_name && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
                <span className="text-gray-500">Current head: </span>
                <span className="font-medium text-gray-900">{modalCC.head_employee_name}</span>
                <span className="text-gray-400"> ({modalCC.head_employee_code})</span>
              </div>
            )}

            {/* Employee search */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Employee
              </label>
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Type name, code, or email…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Search results */}
            {empLoading && (
              <div className="text-xs text-gray-400 py-3 text-center">Searching…</div>
            )}
            {!empLoading && employees.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto mb-4">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmp(emp);
                      setEmployeeSearch(
                        (emp.preferred_name ?? emp.first_name) + " " + emp.last_name
                      );
                      setEmployees([]);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                      selectedEmp?.id === emp.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {emp.preferred_name ?? emp.first_name} {emp.last_name}
                    </div>
            