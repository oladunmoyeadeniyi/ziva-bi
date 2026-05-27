"use client";

/**
 * Employees — /dashboard/business/settings/employees
 *
 * M8.1: Employee master data management.
 * Table with search, filter, bulk actions, add/edit/upload/transfer/code-update modals.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface Employee {
  id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  phone: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  line_manager_id: string | null;
  line_manager_name: string | null;
  is_active: boolean;
  resumption_date: string | null;
}

interface DimensionValue {
  id: string;
  code: string;
  name: string;
}

interface UploadResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

interface CodeHistory {
  id: string;
  old_code: string | null;
  new_code: string;
  change_type: string | null;
  effective_date: string;
  notes: string | null;
}

interface Transfer {
  id: string;
  from_cost_center_name: string | null;
  to_cost_center_name: string | null;
  effective_date: string;
  notes: string | null;
}

interface EmployeeHistory {
  code_history: CodeHistory[];
  transfers: Transfer[];
}

type EmpTab = "add" | "list" | "transfers" | "config";

export default function EmployeesPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<EmpTab>("add");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [costCenters, setCostCenters] = useState<DimensionValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCostCenter, setFilterCostCenter] = useState("");

  // Self-onboarding invite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ first_name: "", last_name: "", email: "", cost_center_id: "", start_date: "" });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ first_name: "", last_name: "", email: "", phone: "", employee_code: "", cost_center_id: "", resumption_date: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Transfer modal
  const [transferEmpId, setTransferEmpId] = useState<string | null>(null);
  const [transferCC, setTransferCC] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Code update modal
  const [codeUpdateEmpId, setCodeUpdateEmpId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [codeChangeType, setCodeChangeType] = useState<"progressive" | "retrospective">("progressive");
  const [codeEffectiveDate, setCodeEffectiveDate] = useState("");
  const [codeNotes, setCodeNotes] = useState("");
  const [updatingCode, setUpdatingCode] = useState(false);

  // History drawer
  const [historyEmpId, setHistoryEmpId] = useState<string | null>(null);
  const [history, setHistory] = useState<EmployeeHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) router.replace("/dashboard/business");
  }, [user, router]);

  const load = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCostCenter) params.set("cost_center_id", filterCostCenter);
      const [emps, dims] = await Promise.all([
        apiFetch<Employee[]>(`/api/hr/employees?active_only=false&${params}`, { token: accessToken }),
        apiFetch<DimensionValue[]>(`/api/config/dimensions`, { token: accessToken }),
      ]);
      setEmployees(emps);
      setSelectedIds(new Set());
      // For cost center filter: load all dimension values (simplified — load all dims)
      // In practice you'd filter to a CC dimension. For now load from existing employees.
      const ccIds = new Set(emps.map((e) => e.cost_center_id).filter(Boolean));
      const ccOptions: DimensionValue[] = emps
        .filter((e) => e.cost_center_id && e.cost_center_name)
        .reduce<DimensionValue[]>((acc, e) => {
          if (e.cost_center_id && !acc.find((x) => x.id === e.cost_center_id)) {
            acc.push({ id: e.cost_center_id!, code: "", name: e.cost_center_name! });
          }
          return acc;
        }, []);
      setCostCenters(ccOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!accessToken) return;
    setAdding(true);
    setAddError(null);
    try {
      await apiFetch("/api/hr/employees", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          ...addForm,
          cost_center_id: addForm.cost_center_id || null,
          resumption_date: addForm.resumption_date || null,
          employee_code: addForm.employee_code || null,
        }),
      });
      setShowAdd(false);
      setAddForm({ first_name: "", last_name: "", email: "", phone: "", employee_code: "", cost_center_id: "", resumption_date: "" });
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create employee.");
    } finally {
      setAdding(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!accessToken) return;
    setUploading(true);
    setUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await apiFetch<UploadResult>("/api/hr/employees/upload", {
        method: "POST",
        token: accessToken,
        body: form,
        isFormData: true,
      });
      setUploadResult(result);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = async () => {
    if (!accessToken) return;
    setDownloadingTemplate(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${BASE}/api/hr/employees/template`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Template download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "employee_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download template.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/hr/employees/${id}`, { method: "DELETE", token: accessToken });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate employee.");
    }
  };

  const handleTransfer = async () => {
    if (!accessToken || !transferEmpId || !transferCC || !transferDate) return;
    setTransferring(true);
    try {
      await apiFetch(`/api/hr/employees/${transferEmpId}/transfer`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ to_cost_center_id: transferCC, effective_date: transferDate, notes: transferNotes || null }),
      });
      setTransferEmpId(null);
      setTransferCC(""); setTransferDate(""); setTransferNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed.");
    } finally {
      setTransferring(false);
    }
  };

  const handleCodeUpdate = async () => {
    if (!accessToken || !codeUpdateEmpId || !newCode || !codeEffectiveDate) return;
    setUpdatingCode(true);
    try {
      await apiFetch(`/api/hr/employees/${codeUpdateEmpId}/update-code`, {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({ new_code: newCode, change_type: codeChangeType, effective_date: codeEffectiveDate, notes: codeNotes || null }),
      });
      setCodeUpdateEmpId(null);
      setNewCode(""); setCodeNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code update failed.");
    } finally {
      setUpdatingCode(false);
    }
  };

  const handleViewHistory = async (empId: string) => {
    if (!accessToken) return;
    setHistoryEmpId(empId);
    setLoadingHistory(true);
    try {
      const data = await apiFetch<EmployeeHistory>(`/api/hr/employees/${empId}/history`, { token: accessToken });
      setHistory(data);
    } catch {
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Bulk deactivate
  const handleBulkAction = async () => {
    if (!accessToken || !bulkAction || selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          apiFetch(`/api/hr/employees/${id}`, {
            method: "PATCH",
            token: accessToken,
            body: JSON.stringify({ is_active: bulkAction === "activate" }),
          })
        )
      );
      setBulkAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleInvite = async () => {
    if (!accessToken) return;
    setInviting(true);
    setInviteError(null);
    try {
      await apiFetch("/api/hr/employees/invite", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          first_name: inviteForm.first_name.trim(),
          last_name: inviteForm.last_name.trim(),
          email: inviteForm.email.trim(),
          cost_center_id: inviteForm.cost_center_id || null,
          start_date: inviteForm.start_date || null,
        }),
      });
      setInviteSuccess(`Self-onboarding link sent to ${inviteForm.email}. Check the server console for the link.`);
      setInviteForm({ first_name: "", last_name: "", email: "", cost_center_id: "", start_date: "" });
      setTimeout(() => { setInviteSuccess(null); setShowInvite(false); }, 4000);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === employees.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(employees.map((e) => e.id)));
  };

  if (isLoading) {
    return (
      <div className="px-6 py-8 space-y-3">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const EMP_TABS: { key: EmpTab; label: string }[] = [
    { key: "add", label: "Add employees" },
    { key: "list", label: "Employee list" },
    { key: "transfers", label: "Transfers & changes" },
    { key: "config", label: "Code config" },
  ];

  const REQUIRED_COLS = ["First name *", "Last name *", "Email *"];
  const OPTIONAL_COLS = ["Employee code", "Cost center code", "Line manager email", "Other name", "Preferred name", "Phone", "Start date", "Date of birth", "Gender", "NIN", "Bank name", "Bank account number", "BVN", "Emergency contact name", "Emergency contact phone", "Residential address"];

  return (
    <div className="px-6 py-8 max-w-6xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Employees</h1>
      <p className="text-sm text-gray-500 mb-5">
        Manage your employee master data. Employees can be mapped to cost centers and used as dimension values.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {EMP_TABS.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold ml-4">×</button>
        </div>
      )}

      {/* ── Tab 1: Add employees ───────────────────────────────────────────────── */}
      {activeTab === "add" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Bulk upload */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <i className="ti ti-upload text-gray-500" style={{ fontSize: 22 }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Bulk upload</p>
                <p className="text-xs text-gray-500 mt-1">Download the template, fill all employee records, upload back. Best for initial mass onboarding.</p>
              </div>
              <div className="flex gap-2 mt-auto">
                <button type="button" onClick={handleDownloadTemplate} disabled={downloadingTemplate}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                  {downloadingTemplate ? "…" : "Download template"}
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {uploading ? "Uploading…" : "Upload file"}
                </button>
                <input type="file" ref={fileInputRef} accept=".xlsx,.csv"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden" />
              </div>
              {uploadResult && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                  {uploadResult.imported} imported · {uploadResult.updated} updated · {uploadResult.errors.length} errors
                </div>
              )}
            </div>

            {/* HR manual entry */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <i className="ti ti-user-plus text-gray-500" style={{ fontSize: 22 }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">HR manual entry</p>
                <p className="text-xs text-gray-500 mt-1">HR fills in all details directly in the portal. Good for single new hires where HR has all the information.</p>
              </div>
              <button type="button" onClick={() => setShowAdd(true)}
                className="mt-auto px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Add employee
              </button>
            </div>

            {/* Self-onboarding */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <i className="ti ti-link text-gray-500" style={{ fontSize: 22 }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Self-onboarding link</p>
                <p className="text-xs text-gray-500 mt-1">HR creates a basic record. System sends a secure link to the new hire. They fill their own details. HR reviews and approves.</p>
              </div>
              <button type="button" onClick={() => setShowInvite(true)}
                className="mt-auto px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Send invite
              </button>
            </div>
          </div>

          {/* Template columns */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Template columns</p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIRED_COLS.map((col) => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{col}</span>
              ))}
              {OPTIONAL_COLS.map((col) => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{col}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Transfers & changes ─────────────────────────────────────────── */}
      {activeTab === "transfers" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Initiate cost center transfers or line manager changes per employee. Use the Employee list tab to select an employee and click Transfer.
          </p>
          <button type="button" onClick={() => setActiveTab("list")}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Go to Employee list →
          </button>
        </div>
      )}

      {/* ── Tab 4: Code config ─────────────────────────────────────────────────── */}
      {activeTab === "config" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Update employee codes (progressive or retrospective). Use the Employee list tab to select an employee and click Code.
          </p>
          <button type="button" onClick={() => setActiveTab("list")}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Go to Employee list →
          </button>
        </div>
      )}

      {/* ── Tab 2: Employee list ───────────────────────────────────────────────── */}
      {activeTab === "list" && (
        <>
          {/* Search + filter */}
          <div className="flex gap-2 mb-4">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search name, email or employee code…"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={load}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Search
            </button>
            {search && (
              <button type="button" onClick={() => { setSearch(""); setFilterCostCenter(""); load(); }}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                Clear
              </button>
            )}
          </div>

          {/* Bulk toolbar */}
          {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <button type="button" onClick={() => setBulkAction("activate")}
            className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium">Activate</button>
          <button type="button" onClick={() => setBulkAction("deactivate")}
            className="text-xs px-2.5 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium">Deactivate</button>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-500 hover:text-blue-700">Clear</button>
        </div>
      )}

      {bulkAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <p className="text-base font-semibold text-gray-900 mb-4 capitalize">{bulkAction} {selectedIds.size} employees?</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setBulkAction(null)} disabled={bulkProcessing}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={handleBulkAction} disabled={bulkProcessing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {bulkProcessing ? "Processing…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Employee modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Add Employee</h2>
            {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}
            <div className="grid grid-cols-2 gap-3">
              {([
                ["first_name", "First Name *", "text"],
                ["last_name", "Last Name *", "text"],
                ["email", "Email *", "email"],
                ["phone", "Phone", "text"],
                ["employee_code", "Employee Code", "text"],
                ["resumption_date", "Resumption Date", "date"],
              ] as [keyof typeof addForm, string, string][]).map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={addForm[field]}
                    onChange={(e) => setAddForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button type="button" onClick={() => { setShowAdd(false); setAddError(null); }} disabled={adding}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={handleAdd}
                disabled={adding || !addForm.first_name.trim() || !addForm.last_name.trim() || !addForm.email.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {adding ? "Adding…" : "Add Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferEmpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Transfer Employee</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Cost Center ID <span className="text-red-500">*</span></label>
                <input type="text" value={transferCC} onChange={(e) => setTransferCC(e.target.value)} placeholder="Cost center UUID"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
                <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button type="button" onClick={() => setTransferEmpId(null)} disabled={transferring}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={handleTransfer} disabled={transferring || !transferCC || !transferDate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {transferring ? "Transferring…" : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code update modal */}
      {codeUpdateEmpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Update Employee Code</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Code <span className="text-red-500">*</span></label>
                <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Change Type</label>
                <select value={codeChangeType} onChange={(e) => setCodeChangeType(e.target.value as "progressive" | "retrospective")}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="progressive">Progressive</option>
                  <option value="retrospective">Retrospective</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
                <input type="date" value={codeEffectiveDate} onChange={(e) => setCodeEffectiveDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={codeNotes} onChange={(e) => setCodeNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button type="button" onClick={() => setCodeUpdateEmpId(null)} disabled={updatingCode}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={handleCodeUpdate} disabled={updatingCode || !newCode || !codeEffectiveDate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {updatingCode ? "Updating…" : "Update Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History drawer */}
      {historyEmpId && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setHistoryEmpId(null)} />
          <div className="w-96 bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Employee History</h2>
              <button onClick={() => setHistoryEmpId(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingHistory ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : !history ? (
                <p className="text-sm text-gray-400">No history found.</p>
              ) : (
                <>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Code Changes</h3>
                  {history.code_history.length === 0 ? (
                    <p className="text-xs text-gray-400 mb-4">No code changes.</p>
                  ) : (
                    <div className="space-y-2 mb-5">
                      {history.code_history.map((ch) => (
                        <div key={ch.id} className="text-xs border border-gray-200 rounded p-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-800">{ch.old_code ?? "—"} → {ch.new_code}</span>
                            <span className="text-gray-400">{ch.effective_date}</span>
                          </div>
                          {ch.change_type && <span className="text-gray-400 capitalize">{ch.change_type}</span>}
                          {ch.notes && <p className="text-gray-500 mt-0.5">{ch.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transfers</h3>
                  {history.transfers.length === 0 ? (
                    <p className="text-xs text-gray-400">No transfers.</p>
                  ) : (
                    <div className="space-y-2">
                      {history.transfers.map((tr) => (
                        <div key={tr.id} className="text-xs border border-gray-200 rounded p-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-800">
                              {tr.from_cost_center_name ?? "—"} → {tr.to_cost_center_name ?? "—"}
                            </span>
                            <span className="text-gray-400">{tr.effective_date}</span>
                          </div>
                          {tr.notes && <p className="text-gray-500 mt-0.5">{tr.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {employees.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-1">No employees yet</p>
          <p className="text-xs text-gray-400">Add employees manually or upload from the template.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={selectedIds.size === employees.length && employees.length > 0}
                    onChange={toggleSelectAll} className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Cost Center</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => (
                <tr key={emp.id} className={`hover:bg-gray-50 ${!emp.is_active ? "opacity-50" : ""} ${selectedIds.has(emp.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3 w-8">
                    <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)}
                      className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{emp.employee_code ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {emp.preferred_name ?? emp.first_name} {emp.last_name}
                    {emp.line_manager_name && (
                      <div className="text-xs text-gray-400">Manager: {emp.line_manager_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{emp.email}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{emp.cost_center_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {emp.is_active
                      ? <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                      : <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inactive</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <button type="button" onClick={() => { setTransferEmpId(emp.id); setTransferCC(""); setTransferDate(""); setTransferNotes(""); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium">Transfer</button>
                      <button type="button" onClick={() => { setCodeUpdateEmpId(emp.id); setNewCode(emp.employee_code ?? ""); setCodeEffectiveDate(""); }}
                        className="text-xs text-gray-600 hover:text-gray-900 font-medium">Code</button>
                      <button type="button" onClick={() => handleViewHistory(emp.id)}
                        className="text-xs text-gray-600 hover:text-gray-900 font-medium">History</button>
                      {emp.is_active && (
                        <button type="button" onClick={() => handleDeactivate(emp.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium">Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Send self-onboarding invite</h2>
            {inviteError && <p className="text-xs text-red-600 mb-3">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600 mb-3">{inviteSuccess}</p>}
            <div className="grid grid-cols-2 gap-3">
              {([
                ["first_name", "First name *", "text"],
                ["last_name", "Last name *", "text"],
                ["email", "Email *", "email"],
                ["cost_center_id", "Cost center ID", "text"],
                ["start_date", "Start date", "date"],
              ] as [keyof typeof inviteForm, string, string][]).map(([field, label, type]) => (
                <div key={field} className={field === "email" ? "col-span-2" : ""}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={inviteForm[field]}
                    onChange={(e) => setInviteForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button type="button" onClick={() => { setShowInvite(false); setInviteError(null); }} disabled={inviting}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={handleInvite}
                disabled={inviting || !inviteForm.first_name.trim() || !inviteForm.last_name.trim() || !inviteForm.email.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {inviting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
