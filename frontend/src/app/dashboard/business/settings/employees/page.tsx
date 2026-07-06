"use client";

/**
 * Employees — /dashboard/business/settings/employees
 *
 * M8.1 + Brief employee_costcenter_listupgrade:
 *   - Cost center is now a real dropdown sourced from /api/hr/cost-centers/options
 *     everywhere: Add modal, Invite modal, Transfer modal, list filter.
 *   - Employee list: column-header sort, status filter, Edit modal, bulk delete.
 *   - Bulk upload template now has in-Excel CC dropdown + Head-of-Cost-Center column.
 *   - Upload result shows head_assignments count.
 *   - Matches CoA page patterns for sort / bulk delete / edit modal / status filter.
 */

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  approval_role_id: string | null;
  approval_role_name: string | null;
  // M9.3b: UUID of the linked users row; null if the employee has no portal account.
  user_id?: string | null;
}

interface ApprovalRole {
  id: string;
  name: string;
  level: number;
}

interface CostCenterOption {
  id: string;
  code: string;
  name: string;
}

interface UploadResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  head_assignments?: number;
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
  change_type: string | null;
  is_retrospective: boolean;
}

interface PositionAssignment {
  id: string;
  position_id: string;
  position_title: string;
  cost_center_name: string | null;
  effective_from: string;
  effective_to: string | null;
  assignment_type: string;
  transfer_reason: string | null;
}

interface EmployeeHistory {
  code_history: CodeHistory[];
  transfers: Transfer[];
}

type EmpTab = "add" | "list" | "transfers" | "config";
type SortEntry = { col: string; dir: "asc" | "desc" };

// ── Sort helpers (same pattern as CoA page) ───────────────────────────────────

const SORT_KEY = "ziva_employees_sort";

const loadSort = (): SortEntry[] => {
  try { const r = localStorage.getItem(SORT_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
};
const saveSort = (s: SortEntry[]) => {
  try { localStorage.setItem(SORT_KEY, JSON.stringify(s)); } catch {}
};
const toggleSort = (sort: SortEntry[], setSort: (s: SortEntry[]) => void, col: string) => {
  const existing = sort.find(s => s.col === col);
  let next: SortEntry[];
  if (!existing) next = [...sort, { col, dir: "asc" }];
  else if (existing.dir === "asc") next = sort.map(s => s.col === col ? { ...s, dir: "desc" as const } : s);
  else next = sort.filter(s => s.col !== col);
  saveSort(next);
  setSort(next);
};
const applySort = (list: Employee[], sort: SortEntry[]): Employee[] => {
  if (!sort.length) return list;
  return [...list].sort((a, b) => {
    for (const { col, dir } of sort) {
      let av = "", bv = "";
      if (col === "name")   { av = `${a.last_name} ${a.first_name}`; bv = `${b.last_name} ${b.first_name}`; }
      if (col === "code")   { av = a.employee_code ?? ""; bv = b.employee_code ?? ""; }
      if (col === "cc")     { av = a.cost_center_name ?? ""; bv = b.cost_center_name ?? ""; }
      if (col === "status") { av = a.is_active ? "active" : "inactive"; bv = b.is_active ? "active" : "inactive"; }
      const cmp = av.localeCompare(bv);
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
};

function SortIndicator({ col, sort }: { col: string; sort: SortEntry[] }) {
  const entry = sort.find(s => s.col === col);
  if (!entry) return <i className="ti ti-arrows-sort text-gray-300 ml-0.5" style={{ fontSize: 11 }} />;
  const priority = sort.indexOf(entry) + 1;
  return (
    <span className="inline-flex items-center text-blue-600 ml-0.5">
      <i className={`ti ti-sort-${entry.dir === "asc" ? "ascending" : "descending"}`} style={{ fontSize: 11 }} />
      {sort.length > 1 && <sup style={{ fontSize: 9 }}>{priority}</sup>}
    </span>
  );
}

// ── Input style helper ────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const selectCls = inputCls + " bg-white";

// ── Page ──────────────────────────────────────────────────────────────────────

function EmployeesPage() {
  const { user, accessToken, startUserImpersonation } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [activeTab, setActiveTab] = useState<EmpTab>("add");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [costCenterOptions, setCostCenterOptions] = useState<CostCenterOption[]>([]);
  const [approvalRoles, setApprovalRoles] = useState<ApprovalRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & sort — status and CC persisted to localStorage
  const _ep = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const _ew = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

  const [search, setSearch] = useState("");
  const [filterCostCenter, _setFilterCC] = useState(() => _ep("emp_cc", ""));
  const [filterStatus, _setFilterStatus] = useState<"all" | "active" | "inactive">(() => _ep("emp_status", "active") as "all" | "active" | "inactive");
  const [sort, setSort] = useState<SortEntry[]>(loadSort);

  const setFilterCostCenter = (v: string) => { _setFilterCC(v); _ew("emp_cc", v); };
  const setFilterStatus = (v: "all" | "active" | "inactive") => { _setFilterStatus(v); _ew("emp_status", v); };

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | "delete" | null>(null);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ first_name: "", last_name: "", email: "", phone: "", employee_code: "", cost_center_id: "", resumption_date: "", approval_role_id: "" });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal (matching CoA pattern)
  const [editEmpId, setEditEmpId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", other_name: "", preferred_name: "", phone: "", cost_center_id: "", resumption_date: "", approval_role_id: "" });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
  const [transferChangeType, setTransferChangeType] = useState("lateral");
  const [transferRetrospective, setTransferRetrospective] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Position assignments (shown in history drawer)
  const [positionHistory, setPositionHistory] = useState<PositionAssignment[]>([]);

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

  // M9.3b: user-level impersonation from the employee list
  const [impersonatingEmpId, setImpersonatingEmpId] = useState<string | null>(null);

  // Self-onboarding invite
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ first_name: "", last_name: "", email: "", cost_center_id: "", start_date: "" });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

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
      // Fetch all employees (active_only=false) then filter client-side for status
      const [emps, ccOpts, aroles] = await Promise.all([
        apiFetch<Employee[]>(`/api/hr/employees?active_only=false&${params}`, { token: accessToken }),
        apiFetch<CostCenterOption[]>(`/api/hr/cost-centers/options`, { token: accessToken }),
        apiFetch<ApprovalRole[]>(`/api/approvals/roles`, { token: accessToken }).catch(() => [] as ApprovalRole[]),
      ]);
      setEmployees(emps);
      setCostCenterOptions(ccOpts);
      setApprovalRoles(aroles);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side filter + sort
  const displayedEmployees = useMemo(() => {
    let list = employees;
    if (filterStatus === "active")   list = list.filter(e => e.is_active);
    if (filterStatus === "inactive") list = list.filter(e => !e.is_active);
    return applySort(list, sort);
  }, [employees, filterStatus, sort]);

  const handleAdd = async () => {
    if (!accessToken) return;
    setAdding(true); setAddError(null);
    try {
      await apiFetch("/api/hr/employees", {
        method: "POST", token: accessToken,
        body: JSON.stringify({ ...addForm, cost_center_id: addForm.cost_center_id || null, resumption_date: addForm.resumption_date || null, employee_code: addForm.employee_code || null, approval_role_id: addForm.approval_role_id || null }),
      });
      setShowAdd(false);
      setAddForm({ first_name: "", last_name: "", email: "", phone: "", employee_code: "", cost_center_id: "", resumption_date: "", approval_role_id: "" });
      await load();
    } catch (err) { setAddError(err instanceof Error ? err.message : "Failed to create employee."); }
    finally { setAdding(false); }
  };

  const handleEdit = async () => {
    if (!accessToken || !editEmpId) return;
    setEditing(true); setEditError(null);
    try {
      await apiFetch(`/api/hr/employees/${editEmpId}`, {
        method: "PATCH", token: accessToken,
        body: JSON.stringify({
          first_name: editForm.first_name || undefined,
          last_name:  editForm.last_name  || undefined,
          other_name: editForm.other_name  || null,
          preferred_name: editForm.preferred_name || null,
          phone:      editForm.phone       || null,
          cost_center_id: editForm.cost_center_id || null,
          resumption_date: editForm.resumption_date || null,
          approval_role_id: editForm.approval_role_id || null,
        }),
      });
      setEditEmpId(null);
      await load();
    } catch (err) { setEditError(err instanceof Error ? err.message : "Update failed."); }
    finally { setEditing(false); }
  };

  const openEdit = (emp: Employee) => {
    setEditEmpId(emp.id);
    setEditForm({
      first_name:     emp.first_name,
      last_name:      emp.last_name,
      other_name:     "",
      preferred_name: emp.preferred_name ?? "",
      phone:          emp.phone ?? "",
      cost_center_id: emp.cost_center_id ?? "",
      resumption_date: emp.resumption_date ?? "",
      approval_role_id: emp.approval_role_id ?? "",
    });
    setEditError(null);
  };

  const handleUpload = async (file: File) => {
    if (!accessToken) return;
    setUploading(true); setUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await apiFetch<UploadResult>("/api/hr/employees/upload", { method: "POST", token: accessToken, body: form, isFormData: true });
      setUploadResult(result);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleDownloadTemplate = async () => {
    if (!accessToken) return;
    setDownloadingTemplate(true);
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${BASE}/api/hr/employees/template`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error("Template download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "employee_template.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to download template."); }
    finally { setDownloadingTemplate(false); }
  };

  const handleDeactivate = async (id: string) => {
    if (!accessToken) return;
    try { await apiFetch(`/api/hr/employees/${id}`, { method: "DELETE", token: accessToken }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to deactivate employee."); }
  };

  const handleTransfer = async () => {
    if (!accessToken || !transferEmpId || !transferCC || !transferDate) return;
    setTransferring(true);
    try {
      await apiFetch(`/api/hr/employees/${transferEmpId}/transfer`, {
        method: "POST", token: accessToken,
        body: JSON.stringify({
          to_cost_center_id: transferCC,
          effective_date: transferDate,
          notes: transferNotes || null,
          change_type: transferChangeType,
          is_retrospective: transferRetrospective,
        }),
      });
      setTransferEmpId(null); setTransferCC(""); setTransferDate(""); setTransferNotes("");
      setTransferChangeType("lateral"); setTransferRetrospective(false);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Transfer failed."); }
    finally { setTransferring(false); }
  };

  const handleCodeUpdate = async () => {
    if (!accessToken || !codeUpdateEmpId || !newCode || !codeEffectiveDate) return;
    setUpdatingCode(true);
    try {
      await apiFetch(`/api/hr/employees/${codeUpdateEmpId}/update-code`, {
        method: "POST", token: accessToken,
        body: JSON.stringify({ new_code: newCode, change_type: codeChangeType, effective_date: codeEffectiveDate, notes: codeNotes || null }),
      });
      setCodeUpdateEmpId(null); setNewCode(""); setCodeNotes("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Code update failed."); }
    finally { setUpdatingCode(false); }
  };

  const handleViewHistory = async (empId: string) => {
    if (!accessToken) return;
    setHistoryEmpId(empId); setLoadingHistory(true); setPositionHistory([]);
    try {
      const [data, posData] = await Promise.all([
        apiFetch<EmployeeHistory>(`/api/hr/employees/${empId}/history`, { token: accessToken }),
        apiFetch<PositionAssignment[]>(`/api/hr/employees/${empId}/assignments`, { token: accessToken }).catch(() => []),
      ]);
      setHistory(data);
      setPositionHistory(posData);
    }
    catch { setHistory(null); }
    finally { setLoadingHistory(false); }
  };

  const handleBulkAction = async () => {
    if (!accessToken || !bulkAction || selectedIds.size === 0) return;
    if (bulkAction === "delete" && bulkConfirmText !== "DELETE") return;
    setBulkProcessing(true);
    try {
      if (bulkAction === "delete") {
        // Call soft-delete (deactivate) for each — matches CoA bulk delete semantics
        await Promise.all(Array.from(selectedIds).map(id =>
          apiFetch(`/api/hr/employees/${id}`, { method: "DELETE", token: accessToken })
        ));
      } else {
        await Promise.all(Array.from(selectedIds).map(id =>
          apiFetch(`/api/hr/employees/${id}`, { method: "PATCH", token: accessToken, body: JSON.stringify({ is_active: bulkAction === "activate" }) })
        ));
      }
      setBulkAction(null); setBulkConfirmText("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Bulk action failed."); }
    finally { setBulkProcessing(false); }
  };

  const handleInvite = async () => {
    if (!accessToken) return;
    setInviting(true); setInviteError(null);
    try {
      await apiFetch("/api/hr/employees/invite", {
        method: "POST", token: accessToken,
        body: JSON.stringify({ first_name: inviteForm.first_name.trim(), last_name: inviteForm.last_name.trim(), email: inviteForm.email.trim(), cost_center_id: inviteForm.cost_center_id || null, start_date: inviteForm.start_date || null }),
      });
      setInviteSuccess(`Self-onboarding link sent to ${inviteForm.email}. Check the server console for the link.`);
      setInviteForm({ first_name: "", last_name: "", email: "", cost_center_id: "", start_date: "" });
      setTimeout(() => { setInviteSuccess(null); setShowInvite(false); }, 4000);
    } catch (e) { setInviteError(e instanceof Error ? e.message : "Failed to send invite."); }
    finally { setInviting(false); }
  };

  const toggleSelect    = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(selectedIds.size === displayedEmployees.length ? new Set() : new Set(displayedEmployees.map(e => e.id)));

  if (isLoading) return (
    <div className="px-6 py-8 space-y-3">
      <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
      <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );

  const EMP_TABS: { key: EmpTab; label: string }[] = [
    { key: "add", label: "Add employees" },
    { key: "list", label: "Employee list" },
    { key: "transfers", label: "Transfers & changes" },
    { key: "config", label: "Code config" },
  ];

  const REQUIRED_COLS = ["First name *", "Last name *", "Email *"];
  const OPTIONAL_COLS = ["Employee code", "Cost center code ⬇", "Line manager email", "Other name", "Preferred name", "Phone", "Start date", "Head of Cost Center (Y/N)"];

  // ── CC dropdown helper ──────────────────────────────────────────────────────
  const CostCenterSelect = ({ value, onChange, placeholder = "— Select cost center —" }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
      <option value="">{placeholder}</option>
      {costCenterOptions.map(cc => (
        <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
      ))}
    </select>
  );

  return (
    <PageContainer maxWidth="6xl">
      <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Back
      </button>
      {returnTo && (
        <button type="button" onClick={() => router.push(decodeURIComponent(returnTo))}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-3 font-medium">
          <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
          Back to Dimensions
        </button>
      )}
      <PageHeading title="Employees" />
      <p className="text-sm text-gray-500 mb-5">Manage your employee master data. Employees can be mapped to cost centers and used as dimension values.</p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {EMP_TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <Banner variant="error" className="mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold ml-4">×</button>
        </Banner>
      )}

      {/* ── Tab 1: Add employees ─────────────────────────────────────────────── */}
      {activeTab === "add" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Bulk upload */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <i className="ti ti-upload text-gray-500" style={{ fontSize: 22 }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Bulk upload</p>
                <p className="text-xs text-gray-500 mt-1">Download the template (includes cost-center dropdown + head-of-cc column), fill all records, upload back.</p>
              </div>
              <div className="flex gap-2 mt-auto flex-wrap">
                <button type="button" onClick={handleDownloadTemplate} disabled={downloadingTemplate}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                  {downloadingTemplate ? "…" : "Download template"}
                </button>
                <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} loading={uploading}>
                  {uploading ? "Uploading…" : "Upload file"}
                </Button>
                <input type="file" ref={fileInputRef} accept=".xlsx,.csv"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden" />
              </div>
              {uploadResult && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 space-y-0.5">
                  <div>{uploadResult.imported} imported · {uploadResult.updated} updated · {uploadResult.errors.length} errors</div>
                  {(uploadResult.head_assignments ?? 0) > 0 && (
                    <div>{uploadResult.head_assignments} head-of-cost-center assignment(s) set</div>
                  )}
                  {uploadResult.errors.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {uploadResult.errors.slice(0, 5).map((e, i) => (
                        <div key={i} className="text-red-600">Row {e.row}: {e.reason}</div>
                      ))}
                      {uploadResult.errors.length > 5 && <div className="text-red-500">…and {uploadResult.errors.length - 5} more errors</div>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* HR manual entry */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <i className="ti ti-user-plus text-gray-500" style={{ fontSize: 22 }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">HR manual entry</p>
                <p className="text-xs text-gray-500 mt-1">HR fills in all details directly in the portal. Good for single new hires.</p>
              </div>
              <Button variant="primary" size="sm" className="mt-auto" onClick={() => setShowAdd(true)}>
                Add employee
              </Button>
            </div>

            {/* Self-onboarding */}
            <div className="border border-gray-200 rounded-xl p-5 bg-white flex flex-col gap-3">
              <i className="ti ti-link text-gray-500" style={{ fontSize: 22 }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Self-onboarding link</p>
                <p className="text-xs text-gray-500 mt-1">System sends a secure link to the new hire. They fill their own details. HR reviews and approves.</p>
              </div>
              <Button variant="primary" size="sm" className="mt-auto" onClick={() => setShowInvite(true)}>
                Send invite
              </Button>
            </div>
          </div>

          {/* Template columns */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Template columns</p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIRED_COLS.map(col => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{col}</span>
              ))}
              {OPTIONAL_COLS.map(col => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{col}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Transfers & changes ──────────────────────────────────────── */}
      {activeTab === "transfers" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Initiate cost center transfers per employee. Use the Employee list tab to click Transfer on a row.</p>
          <Button variant="primary" onClick={() => setActiveTab("list")}>Go to Employee list →</Button>
        </div>
      )}

      {/* ── Tab 4: Code config ──────────────────────────────────────────────── */}
      {activeTab === "config" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Update employee codes. Use the Employee list tab to click Code on a row.</p>
          <Button variant="primary" onClick={() => setActiveTab("list")}>Go to Employee list →</Button>
        </div>
      )}

      {/* ── Tab 2: Employee list ────────────────────────────────────────────── */}
      {activeTab === "list" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
              placeholder="Search name, email or code…"
              className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={filterCostCenter} onChange={e => setFilterCostCenter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All cost centers</option>
              {costCenterOptions.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.code} — {cc.name}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              {([
                { value: "active",   label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "all",      label: "All" },
              ] as { value: typeof filterStatus; label: string }[]).map(({ value, label }, i) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilterStatus(value)}
                  className={`px-3 py-2 font-medium transition-colors ${
                    filterStatus === value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  } ${i > 0 ? "border-l border-gray-300" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={load}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Search</button>
            {(search || filterCostCenter) && (
              <button type="button" onClick={() => { setSearch(""); setFilterCostCenter(""); }}
                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Clear</button>
            )}
          </div>

          {/* Bulk toolbar — matching CoA pattern */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
              <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
              <button type="button" onClick={() => setBulkAction("activate")}
                className="text-xs px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium">Activate</button>
              <button type="button" onClick={() => setBulkAction("deactivate")}
                className="text-xs px-2.5 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium">Deactivate</button>
              <button type="button" onClick={() => { setBulkAction("delete"); setBulkConfirmText(""); }}
                className="text-xs px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-medium">Delete</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-blue-500 hover:text-blue-700">Clear</button>
            </div>
          )}

          {/* Bulk confirm modal */}
          {bulkAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
                <p className="text-base font-semibold text-gray-900 mb-3 capitalize">{bulkAction} {selectedIds.size} employee(s)?</p>
                {bulkAction === "delete" && (
                  <div className="mb-4">
                    <p className="text-xs text-red-600 mb-2">This will deactivate {selectedIds.size} employee(s). Type DELETE to confirm.</p>
                    <input type="text" value={bulkConfirmText} onChange={e => setBulkConfirmText(e.target.value)}
                      placeholder="Type DELETE" className={inputCls} />
                  </div>
                )}
                <div className="flex gap-3 justify-end">
                  <Button variant="secondary" onClick={() => { setBulkAction(null); setBulkConfirmText(""); }} disabled={bulkProcessing}>Cancel</Button>
                  <Button variant="primary" onClick={handleBulkAction}
                    disabled={bulkProcessing || (bulkAction === "delete" && bulkConfirmText !== "DELETE")}
                    loading={bulkProcessing}>
                    {bulkProcessing ? "Processing…" : "Confirm"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          {displayedEmployees.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-sm font-medium text-gray-600 mb-1">No employees</p>
              <p className="text-xs text-gray-400">Try adjusting your filters or add employees from the Add tab.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox" checked={selectedIds.size === displayedEmployees.length && displayedEmployees.length > 0}
                        onChange={toggleSelectAll} className="rounded border-gray-300" />
                    </th>
                    {/* Sortable headers — matching CoA pattern */}
                    {[
                      { col: "code",   label: "Code" },
                      { col: "name",   label: "Name" },
                      { col: "cc",     label: "Cost Center" },
                      { col: "status", label: "Status" },
                    ].map(({ col, label }) => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none whitespace-nowrap"
                        onClick={() => toggleSort(sort, setSort, col)}>
                        {label}<SortIndicator col={col} sort={sort} />
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Email</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedEmployees.map(emp => (
                    <tr key={emp.id} className={`hover:bg-gray-50 ${!emp.is_active ? "opacity-60" : ""} ${selectedIds.has(emp.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-3 w-8">
                        <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)} className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">{emp.employee_code ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {emp.preferred_name ?? emp.first_name} {emp.last_name}
                        {emp.line_manager_name && <div className="text-xs text-gray-400">Manager: {emp.line_manager_name}</div>}
                        {emp.approval_role_name && <div className="text-xs text-indigo-600 mt-0.5"><i className="ti ti-shield-check" /> {emp.approval_role_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{emp.cost_center_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {emp.is_active
                          ? <span className="text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                          : <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inactive</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{emp.email}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end flex-wrap">
                          <button type="button" onClick={() => openEdit(emp)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                          <button type="button" onClick={() => { setTransferEmpId(emp.id); setTransferCC(""); setTransferDate(""); setTransferNotes(""); }}
                            className="text-xs text-gray-600 hover:text-gray-900 font-medium">Transfer</button>
                          <button type="button" onClick={() => { setCodeUpdateEmpId(emp.id); setNewCode(emp.employee_code ?? ""); setCodeEffectiveDate(""); }}
                            className="text-xs text-gray-600 hover:text-gray-900 font-medium">Code</button>
                          <button type="button" onClick={() => handleViewHistory(emp.id)}
                            className="text-xs text-gray-600 hover:text-gray-900 font-medium">History</button>
                          {emp.is_active && (
                            <button type="button" onClick={() => handleDeactivate(emp.id)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium">Deactivate</button>
                          )}
                          {user?.is_super_admin && emp.is_active && (
                            <button
                              type="button"
                              disabled={!!impersonatingEmpId || !emp.user_id}
                              title={!emp.user_id ? "No portal account — employee has not registered on Ziva" : "Impersonate this user"}
                              onClick={async () => {
                                if (!emp.user_id) return;
                                setImpersonatingEmpId(emp.id);
                                try {
                                  await startUserImpersonation(emp.user_id, "employee_list");
                                  router.push("/dashboard/business");
                                } catch {
                                  setImpersonatingEmpId(null);
                                }
                              }}
                              className={`text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                                emp.user_id
                                  ? "text-indigo-600 hover:text-indigo-800"
                                  : "text-gray-400"
                              }`}
                            >
                              {impersonatingEmpId === emp.id ? "Entering…" : "Impersonate"}
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
        </>
      )}

      {/* ── Add Employee modal ───────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Add Employee</h2>
            {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}
            <div className="grid grid-cols-2 gap-3">
              {([
                ["first_name", "First Name *", "text"],
                ["last_name",  "Last Name *",  "text"],
                ["email",      "Email *",      "email"],
                ["phone",      "Phone",        "text"],
                ["employee_code",    "Employee Code",  "text"],
                ["resumption_date",  "Resumption Date","date"],
              ] as [keyof typeof addForm, string, string][]).map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={addForm[field]}
                    onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))}
                    className={inputCls} />
                </div>
              ))}
              {/* Cost center — real dropdown */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Cost Center</label>
                <CostCenterSelect value={addForm.cost_center_id} onChange={v => setAddForm(f => ({ ...f, cost_center_id: v }))} />
              </div>
              {/* Approval Role — wires employee into the routing engine */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Approval Role</label>
                <select value={addForm.approval_role_id} onChange={e => setAddForm(f => ({ ...f, approval_role_id: e.target.value }))} className={selectCls}>
                  <option value="">— None —</option>
                  {approvalRoles.sort((a, b) => a.level - b.level).map(r => (
                    <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-0.5">Assigns this employee a role in the approval chain (e.g. Finance Director, HOD).</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => { setShowAdd(false); setAddError(null); }} disabled={adding}>Cancel</Button>
              <Button variant="primary" onClick={handleAdd}
                disabled={adding || !addForm.first_name.trim() || !addForm.last_name.trim() || !addForm.email.trim()}
                loading={adding}>
                {adding ? "Adding…" : "Add Employee"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Employee modal (matching CoA pattern) ───────────────────────── */}
      {editEmpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Edit Employee</h2>
            {editError && <p className="text-xs text-red-600 mb-3">{editError}</p>}
            <div className="grid grid-cols-2 gap-3">
              {([
                ["first_name",    "First Name",      "text"],
                ["last_name",     "Last Name",       "text"],
                ["preferred_name","Preferred Name",  "text"],
                ["other_name",    "Other Name",      "text"],
                ["phone",         "Phone",           "text"],
                ["resumption_date","Resumption Date","date"],
              ] as [keyof typeof editForm, string, string][]).map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type} value={editForm[field]}
                    onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                    className={inputCls} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Cost Center</label>
                <CostCenterSelect value={editForm.cost_center_id} onChange={v => setEditForm(f => ({ ...f, cost_center_id: v }))} />
              </div>
              {/* Approval Role — wires employee into the routing engine */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Approval Role</label>
                <select value={editForm.approval_role_id} onChange={e => setEditForm(f => ({ ...f, approval_role_id: e.target.value }))} className={selectCls}>
                  <option value="">— None —</option>
                  {approvalRoles.sort((a, b) => a.level - b.level).map(r => (
                    <option key={r.id} value={r.id}>{r.name} (Level {r.level})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-0.5">Assigns this employee a role in the approval chain (e.g. Finance Director, HOD).</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => { setEditEmpId(null); setEditError(null); }} disabled={editing}>Cancel</Button>
              <Button variant="primary" onClick={handleEdit} disabled={editing} loading={editing}>
                {editing ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer modal — CC dropdown + change type + retrospective ──────── */}
      {transferEmpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Transfer Employee</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Cost Center <span className="text-red-500">*</span></label>
                <CostCenterSelect value={transferCC} onChange={setTransferCC} placeholder="— Select cost center —" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
                  <input type="date" defaultValue={transferDate} onBlur={e => setTransferDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Change Type</label>
                  <select value={transferChangeType} onChange={e => setTransferChangeType(e.target.value)} className={selectCls}>
                    <option value="lateral">Lateral</option>
                    <option value="promotion">Promotion</option>
                    <option value="restructure">Restructure</option>
                    <option value="acting">Acting</option>
                    <option value="secondment">Secondment</option>
                    <option value="hire">Hire</option>
                    <option value="termination">Termination</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={transferNotes} onChange={e => setTransferNotes(e.target.value)} rows={2} className={inputCls} />
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transferRetrospective}
                    onChange={e => setTransferRetrospective(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <div className="text-xs font-medium text-amber-800">Retrospective change</div>
                    <div className="text-xs text-amber-700 mt-0.5">
                      Effective date is in the past. Transactions between that date and today will be
                      flagged for review. Historical GL is not auto-recoded.
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="secondary" onClick={() => setTransferEmpId(null)} disabled={transferring}>Cancel</Button>
              <Button variant="primary" onClick={handleTransfer} disabled={transferring || !transferCC || !transferDate} loading={transferring}>
                {transferring ? "Transferring…" : "Transfer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Code update modal (unchanged) ───────────────────────────────────── */}
      {codeUpdateEmpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Update Employee Code</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Code <span className="text-red-500">*</span></label>
                <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Change Type</label>
                <select value={codeChangeType} onChange={e => setCodeChangeType(e.target.value as typeof codeChangeType)} className={selectCls}>
                  <option value="progressive">Progressive</option>
                  <option value="retrospective">Retrospective</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
                <input type="date" defaultValue={codeEffectiveDate} onBlur={e => setCodeEffectiveDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={codeNotes} onChange={e => setCodeNotes(e.target.value)} rows={2} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="secondary" onClick={() => setCodeUpdateEmpId(null)} disabled={updatingCode}>Cancel</Button>
              <Button variant="primary" onClick={handleCodeUpdate} disabled={updatingCode || !newCode || !codeEffectiveDate} loading={updatingCode}>
                {updatingCode ? "Updating…" : "Update Code"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── History drawer ────────────────────────────────────────────────────── */}
      {historyEmpId && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setHistoryEmpId(null)} />
          <div className="w-96 bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Employee History</h2>
              <button onClick={() => setHistoryEmpId(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {loadingHistory ? <p className="text-sm text-gray-400">Loading…</p>
              : !history ? <p className="text-sm text-gray-400">No history found.</p>
              : (
                <>
                  {/* Position assignments */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Position Assignments</h3>
                    {positionHistory.length === 0 ? (
                      <p className="text-xs text-gray-400">No position assignments recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {positionHistory.map(pa => (
                          <div key={pa.id} className="text-xs border border-gray-200 rounded p-2">
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-medium text-gray-800">{pa.position_title}</span>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs ${
                                pa.assignment_type === "substantive" ? "bg-blue-100 text-blue-700"
                                : pa.assignment_type === "acting" ? "bg-amber-100 text-amber-700"
                                : "bg-purple-100 text-purple-700"}`}>
                                {pa.assignment_type}
                              </span>
                            </div>
                            {pa.cost_center_name && <p className="text-gray-500 mt-0.5">{pa.cost_center_name}</p>}
                            <div className="flex justify-between text-gray-400 mt-1">
                              <span>From: {pa.effective_from}</span>
                              <span>{pa.effective_to ? `To: ${pa.effective_to}` : <span className="text-green-600 font-medium">Current</span>}</span>
                            </div>
                            {pa.transfer_reason && <p className="text-gray-400 mt-0.5 capitalize">{pa.transfer_reason}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cost centre transfers */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost Centre Transfers</h3>
                    {history.transfers.length === 0 ? <p className="text-xs text-gray-400">No transfers.</p> : (
                      <div className="space-y-2">
                        {history.transfers.map(tr => (
                          <div key={tr.id} className="text-xs border border-gray-200 rounded p-2">
                                                <div className="flex justify-between">
                              <span className="font-medium text-gray-800">{tr.from_cost_center_name ?? "—"} → {tr.to_cost_center_name ?? "—"}</span>
                              <span className="text-gray-400">{tr.effective_date}</span>
                            </div>
                            <div className="flex gap-2 mt-0.5">
                              {tr.change_type && <span className="text-gray-500 capitalize">{tr.change_type}</span>}
                              {tr.is_retrospective && (
                                <span className="bg-amber-100 text-amber-700 px-1 rounded">retrospective</span>
                              )}
                            </div>
                            {tr.notes && <p className="text-gray-500 mt-0.5">{tr.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Code changes */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Code Changes</h3>
                    {history.code_history.length === 0 ? <p className="text-xs text-gray-400">No code changes.</p> : (
                      <div className="space-y-2">
                        {history.code_history.map(ch => (
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
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Invite modal — real CC dropdown ─────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4 w-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Send self-onboarding invite</h2>
            {inviteError   && <p className="text-xs text-red-600 mb-3">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600 mb-3">{inviteSuccess}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First name <span className="text-red-500">*</span></label>
                <input type="text" value={inviteForm.first_name} onChange={e => setInviteForm(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last name <span className="text-red-500">*</span></label>
                <input type="text" value={inviteForm.last_name} onChange={e => setInviteForm(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cost Center</label>
                <CostCenterSelect value={inviteForm.cost_center_id} onChange={v => setInviteForm(f => ({ ...f, cost_center_id: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                <input type="date" defaultValue={inviteForm.start_date} onBlur={e => setInviteForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <Button variant="secondary" onClick={() => { setShowInvite(false); setInviteError(null); }} disabled={inviting}>Cancel</Button>
              <Button variant="primary" onClick={handleInvite}
                disabled={inviting || !inviteForm.first_name.trim() || !inviteForm.last_name.trim() || !inviteForm.email.trim()}
                loading={inviting}>
                {inviting ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default function EmployeesPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading…</div>}>
      <EmployeesPage />
    </Suspense>
  );
}
