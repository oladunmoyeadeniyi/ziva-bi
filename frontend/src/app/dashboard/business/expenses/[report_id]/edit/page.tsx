"use client";

/**
 * Edit expense retirement — /dashboard/business/expenses/{report_id}/edit
 *
 * M7: Fetches /api/expense-config/form-config on load and applies the same
 * GL coding mode logic as the new expense page (see new/page.tsx for detail).
 *
 * Auto-saves in the background on field blur and line add/remove.
 * Uses PATCH for existing lines (preserving document attachment links) and
 * POST for newly added lines. Pending removes are tracked and sent on the
 * next save so document-linked lines are deleted cleanly.
 *
 * M4 — Submit flow uses approver selection modal.
 * M6 — Per-line and report-level document attachment.
 * M7 — Form config integration; category/subcategory fields on lines.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface LineState {
  localId: string;
  backendId: string | null;
  gl_account: string;
  pl_group: string;
  io_dimension: string;
  cost_center: string;
  location: string;
  invoice_date: string;
  invoice_number: string;
  description: string;
  amount: string;
  category_id: string;
  subcategory_id: string;
}

interface ExpenseReportDetail {
  id: string;
  report_number: string;
  employee_function: string | null;
  report_date: string;
  status: string;
  total_amount: string;
  rejection_comment: string | null;
  lines: Array<{
    id: string;
    line_number: number;
    gl_account: string | null;
    pl_group: string | null;
    io_dimension: string | null;
    cost_center: string | null;
    location: string | null;
    invoice_date: string | null;
    invoice_number: string | null;
    description: string;
    amount: string;
    category_id: string | null;
    subcategory_id: string | null;
  }>;
}

interface ApiLine {
  id: string;
  line_number: number;
}

interface ApiReport {
  id: string;
  lines: ApiLine[];
}

interface ApprovalMatrix {
  levels: number;
  level1_role: string;
  level2_role: string | null;
  level3_role: string | null;
  amount_threshold_l2: string | null;
  amount_threshold_l3: string | null;
}

interface TenantUser {
  id: string;
  full_name: string;
  email: string;
}

interface DocumentRecord {
  id: string;
  report_id: string;
  line_id: string | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  signed_url: string | null;
  created_at: string;
}

interface FormCategory {
  id: string;
  name: string;
  code: string | null;
  gl_account_suggestion: string | null;
  subcategories: { id: string; name: string }[];
}

interface FormConfig {
  gl_coding_mode: string;
  require_category: boolean;
  require_subcategory: boolean;
  allow_free_text_description: boolean;
  categories: FormCategory[];
}

const DEFAULT_FORM_CONFIG: FormConfig = {
  gl_coding_mode: "employee",
  require_category: false,
  require_subcategory: false,
  allow_free_text_description: true,
  categories: [],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") return <span className="text-red-500 font-bold text-xs">PDF</span>;
  if (mimeType.startsWith("image/")) return <span className="text-blue-500 font-bold text-xs">IMG</span>;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <span className="text-green-600 font-bold text-xs">XLS</span>;
  if (mimeType.includes("word") || mimeType.includes("document")) return <span className="text-blue-700 font-bold text-xs">DOC</span>;
  return <span className="text-gray-500 font-bold text-xs">FILE</span>;
}

function newLine(): LineState {
  return {
    localId: Math.random().toString(36).slice(2),
    backendId: null,
    gl_account: "",
    pl_group: "",
    io_dimension: "",
    cost_center: "",
    location: "",
    invoice_date: "",
    invoice_number: "",
    description: "",
    amount: "",
    category_id: "",
    subcategory_id: "",
  };
}

function calcTotal(lines: LineState[]): number {
  return lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
}

function formatNGN(n: number): string {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function linePayload(l: LineState, mode: string) {
  return {
    gl_account: mode === "finance" ? null : (l.gl_account.trim() || null),
    pl_group: l.pl_group.trim() || null,
    io_dimension: l.io_dimension.trim() || null,
    cost_center: l.cost_center.trim() || null,
    location: l.location.trim() || null,
    invoice_date: l.invoice_date || null,
    invoice_number: l.invoice_number.trim() || null,
    description: l.description.trim(),
    amount: parseFloat(l.amount),
    category_id: l.category_id || null,
    subcategory_id: l.subcategory_id || null,
  };
}

export default function EditExpensePage() {
  const { report_id } = useParams<{ report_id: string }>();
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [reportNumber, setReportNumber] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [employeeFunction, setEmployeeFunction] = useState("");
  const [lines, setLines] = useState<LineState[]>([newLine()]);
  const [rejectionBanner, setRejectionBanner] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string>("DRAFT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // M7 form config
  const [formConfig, setFormConfig] = useState<FormConfig>(DEFAULT_FORM_CONFIG);

  // M6 — document attachments
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Approval matrix + approver selection modal
  const [showApproverModal, setShowApproverModal] = useState(false);
  const [matrix, setMatrix] = useState<ApprovalMatrix | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [l1Approver, setL1Approver] = useState("");
  const [l2Approver, setL2Approver] = useState("");
  const [l3Approver, setL3Approver] = useState("");
  const [approverError, setApproverError] = useState<string | null>(null);

  // Refs for async save callbacks
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveCallbackRef = useRef<() => Promise<void>>(async () => {});
  const linesRef = useRef(lines);
  const formConfigRef = useRef(formConfig);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { formConfigRef.current = formConfig; }, [formConfig]);

  // Load form config (M7)
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<FormConfig>("/api/expense-config/form-config", { token: accessToken })
      .then((cfg) => setFormConfig(cfg))
      .catch(() => {});
  }, [accessToken]);

  // Load existing report
  useEffect(() => {
    if (!accessToken || !report_id) return;

    const fetchReport = async () => {
      try {
        const data = await apiFetch<ExpenseReportDetail>(
          `/api/expenses/reports/${report_id}`,
          { token: accessToken }
        );

        if (data.status !== "DRAFT" && data.status !== "REJECTED" && data.status !== "REFERRED_TO_REQUESTOR") {
          router.replace(`/dashboard/business/expenses/${report_id}`);
          return;
        }

        setOriginalStatus(data.status);
        setReportNumber(data.report_number);
        setReportDate(data.report_date);
        setEmployeeFunction(data.employee_function ?? "");
        setRejectionBanner(data.status !== "DRAFT" ? (data.rejection_comment ?? null) : null);
        setLines(
          data.lines.length > 0
            ? data.lines.map((l) => ({
                localId: Math.random().toString(36).slice(2),
                backendId: l.id,
                gl_account: l.gl_account ?? "",
                pl_group: l.pl_group ?? "",
                io_dimension: l.io_dimension ?? "",
                cost_center: l.cost_center ?? "",
                location: l.location ?? "",
                invoice_date: l.invoice_date ?? "",
                invoice_number: l.invoice_number ?? "",
                description: l.description,
                amount: l.amount,
                category_id: l.category_id ?? "",
                subcategory_id: l.subcategory_id ?? "",
              }))
            : [newLine()]
        );

        try {
          const docs = await apiFetch<DocumentRecord[]>(
            `/api/documents/reports/${report_id}`,
            { token: accessToken }
          );
          setDocuments(docs);
        } catch { /* Non-fatal */ }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load report.";
        setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
      } finally {
        setIsLoadingReport(false);
      }
    };

    fetchReport();
  }, [accessToken, report_id, router]);

  // ── Line management ───────────────────────────────────────────────────────

  const updateLine = (localId: string, field: keyof LineState, value: string) => {
    setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, [field]: value } : l)));
  };

  const handleCategoryChange = (localId: string, categoryId: string) => {
    const cat = formConfig.categories.find((c) => c.id === categoryId);
    setLines((prev) =>
      prev.map((l) =>
        l.localId === localId
          ? {
              ...l,
              category_id: categoryId,
              subcategory_id: "",
              gl_account: formConfig.gl_coding_mode === "category_mapped"
                ? (cat?.gl_account_suggestion ?? l.gl_account)
                : l.gl_account,
            }
          : l
      )
    );
    scheduleAutoSave();
  };

  const removeLine = (localId: string) => {
    setLines((prev) => {
      const line = prev.find((l) => l.localId === localId);
      if (line?.backendId) pendingDeleteIdsRef.current.add(line.backendId);
      return prev.filter((l) => l.localId !== localId);
    });
    scheduleAutoSave();
  };

  const addLine = () => {
    setLines((prev) => [...prev, newLine()]);
    scheduleAutoSave();
  };

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const runAutoSave = async () => {
    if (!accessToken || !reportDate) return;
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    setSaveStatus("saving");
    const mode = formConfigRef.current.gl_coding_mode;

    try {
      await apiFetch(`/api/expenses/reports/${report_id}`, {
        method: "PATCH",
        token: accessToken,
        body: JSON.stringify({ report_date: reportDate, employee_function: employeeFunction || null }),
      });

      for (const bid of pendingDeleteIdsRef.current) {
        try {
          await apiFetch(`/api/expenses/reports/${report_id}/lines/${bid}`, {
            method: "DELETE", token: accessToken,
          });
        } catch { /* non-fatal */ }
      }
      pendingDeleteIdsRef.current.clear();

      const currentLines = linesRef.current;
      const knownIds = new Set<string>(
        currentLines.filter((l) => l.backendId).map((l) => l.backendId!)
      );
      const updatedLines = [...currentLines];

      for (let i = 0; i < updatedLines.length; i++) {
        const l = updatedLines[i];
        if (!l.description.trim() || !(parseFloat(l.amount) > 0)) continue;
        if (mode !== "finance" && !l.gl_account.trim()) continue;

        if (l.backendId) {
          try {
            await apiFetch(`/api/expenses/reports/${report_id}/lines/${l.backendId}`, {
              method: "PATCH", token: accessToken, body: JSON.stringify(linePayload(l, mode)),
            });
          } catch { /* non-fatal */ }
        } else {
          try {
            const resp = await apiFetch<ApiReport>(
              `/api/expenses/reports/${report_id}/lines`,
              { method: "POST", token: accessToken, body: JSON.stringify(linePayload(l, mode)) }
            );
            const nl = resp.lines.find((rl) => !knownIds.has(rl.id));
            if (nl) {
              updatedLines[i] = { ...updatedLines[i], backendId: nl.id };
              knownIds.add(nl.id);
            }
          } catch { /* non-fatal */ }
        }
      }

      const hasUpdates = updatedLines.some((l, i) => l.backendId !== currentLines[i].backendId);
      if (hasUpdates) setLines(updatedLines);

      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      isSavingRef.current = false;
    }
  };

  autoSaveCallbackRef.current = runAutoSave;

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => autoSaveCallbackRef.current(), 800);
  }, []);

  // ── Manual save ───────────────────────────────────────────────────────────

  const saveHeaderAndLines = async () => {
    const mode = formConfig.gl_coding_mode;

    await apiFetch(`/api/expenses/reports/${report_id}`, {
      method: "PATCH",
      token: accessToken!,
      body: JSON.stringify({ report_date: reportDate, employee_function: employeeFunction || null }),
    });

    for (const bid of pendingDeleteIdsRef.current) {
      try {
        await apiFetch(`/api/expenses/reports/${report_id}/lines/${bid}`, {
          method: "DELETE", token: accessToken!,
        });
      } catch { /* ignore */ }
    }
    pendingDeleteIdsRef.current.clear();

    for (const l of lines) {
      if (l.backendId) {
        await apiFetch(`/api/expenses/reports/${report_id}/lines/${l.backendId}`, {
          method: "PATCH", token: accessToken!, body: JSON.stringify(linePayload(l, mode)),
        });
      } else {
        await apiFetch(`/api/expenses/reports/${report_id}/lines`, {
          method: "POST", token: accessToken!, body: JSON.stringify(linePayload(l, mode)),
        });
      }
    }
  };

  // ── File upload handlers ──────────────────────────────────────────────────

  const triggerUpload = (target: string) => {
    uploadTargetRef.current = target;
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetRef.current || !accessToken) return;
    e.target.value = "";
    setUploadingFor(uploadTargetRef.current);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    const target = uploadTargetRef.current;
    if (target !== "report") formData.append("line_id", target);
    try {
      const doc = await apiFetch<DocumentRecord>(
        `/api/documents/reports/${report_id}/upload`,
        { method: "POST", token: accessToken, body: formData, isFormData: true }
      );
      setDocuments((prev) => [...prev, doc]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingFor(null);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/documents/${docId}`, { method: "DELETE", token: accessToken });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    const mode = formConfig.gl_coding_mode;
    if (!reportDate) return "Report date is required.";
    if (lines.length === 0) return "At least one expense line is required.";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (mode === "employee" && !l.gl_account.trim())
        return `Line ${i + 1}: GL Account is required.`;
      if (formConfig.require_category && !l.category_id)
        return `Line ${i + 1}: Category is required.`;
      if (formConfig.require_subcategory && formConfig.require_category && !l.subcategory_id)
        return `Line ${i + 1}: Subcategory is required.`;
      if (!l.description.trim()) return `Line ${i + 1}: Description is required.`;
      const amount = parseFloat(l.amount);
      if (!l.amount || isNaN(amount) || amount <= 0)
        return `Line ${i + 1}: Amount must be a positive number.`;
    }
    return null;
  };

  // ── Button handlers ───────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      await saveHeaderAndLines();
      router.push("/dashboard/business/expenses");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save report.";
      setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openApproverModal = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);

    try {
      const [existingApprovals, matrixData] = await Promise.all([
        apiFetch<{ id: string }[]>(`/api/approvals/reports/${report_id}`, { token: accessToken! }),
        apiFetch<ApprovalMatrix | null>("/api/approvals/matrix", { token: accessToken! }),
      ]);

      if (!matrixData) {
        setError("Your company has not configured an approval matrix. Contact your administrator.");
        return;
      }

      if (existingApprovals.length > 0) {
        setIsSubmitting(true);
        try {
          await saveHeaderAndLines();
          await apiFetch(`/api/approvals/reports/${report_id}/submit`, {
            method: "POST", token: accessToken!, body: JSON.stringify({}),
          });
          router.push("/dashboard/business/expenses");
        } catch (submitErr) {
          const msg = submitErr instanceof Error ? submitErr.message : "Failed to submit report.";
          setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      const usersData = await apiFetch<TenantUser[]>("/api/users/tenant", { token: accessToken! });
      setMatrix(matrixData);
      setTenantUsers(usersData.filter((u) => u.id !== user?.id));
      setL1Approver(""); setL2Approver(""); setL3Approver("");
      setApproverError(null);
      setShowApproverModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load approval settings.";
      setError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
    }
  };

  const handleSubmitWithApprovers = async () => {
    if (!matrix) return;
    setApproverError(null);

    const total = calcTotal(lines);
    const needsL2 = matrix.levels >= 2 && (matrix.amount_threshold_l2 === null || total > parseFloat(matrix.amount_threshold_l2));
    const needsL3 = matrix.levels >= 3 && (matrix.amount_threshold_l3 === null || total > parseFloat(matrix.amount_threshold_l3));

    if (!l1Approver) { setApproverError("Please select a Level 1 approver."); return; }
    if (needsL2 && !l2Approver) { setApproverError("Please select a Level 2 approver."); return; }
    if (needsL3 && !l3Approver) { setApproverError("Please select a Level 3 approver."); return; }

    setIsSubmitting(true);
    try {
      await saveHeaderAndLines();
      await apiFetch(`/api/approvals/reports/${report_id}/submit`, {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({
          level1_approver_id: l1Approver,
          level2_approver_id: needsL2 ? l2Approver : null,
          level3_approver_id: needsL3 ? l3Approver : null,
        }),
      });
      router.push("/dashboard/business/expenses");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit report.";
      setApproverError(msg === "Failed to fetch" ? "Cannot reach the backend server." : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingReport) {
    return (
      <div className="px-6 py-8 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const total = calcTotal(lines);
  const needsL2 = matrix ? matrix.levels >= 2 && (matrix.amount_threshold_l2 === null || total > parseFloat(matrix.amount_threshold_l2)) : false;
  const needsL3 = matrix ? matrix.levels >= 3 && (matrix.amount_threshold_l3 === null || total > parseFloat(matrix.amount_threshold_l3)) : false;
  const mode = formConfig.gl_coding_mode;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto">
      {/* Approver selection modal */}
      {showApproverModal && matrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Select Approvers</h2>
            <p className="text-sm text-gray-500 mb-4">Choose who should review this report at each level.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {matrix.level1_role} <span className="text-red-500">*</span>
                </label>
                <select value={l1Approver} onChange={(e) => setL1Approver(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select approver…</option>
                  {tenantUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                </select>
              </div>
              {needsL2 && matrix.level2_role && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {matrix.level2_role} <span className="text-red-500">*</span>
                  </label>
                  <select value={l2Approver} onChange={(e) => setL2Approver(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select approver…</option>
                    {tenantUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                  </select>
                </div>
              )}
              {needsL3 && matrix.level3_role && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {matrix.level3_role} <span className="text-red-500">*</span>
                  </label>
                  <select value={l3Approver} onChange={(e) => setL3Approver(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select approver…</option>
                    {tenantUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                  </select>
                </div>
              )}
            </div>
            {approverError && <p className="mt-3 text-xs text-red-600">{approverError}</p>}
            <div className="flex gap-3 justify-end mt-6">
              <button type="button" onClick={() => { setShowApproverModal(false); setApproverError(null); }}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={handleSubmitWithApprovers} disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {isSubmitting ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Edit Expense Retirement</h1>
            <span className="text-sm text-gray-500 font-mono">{reportNumber}</span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">Edit header fields, add or remove lines, then save or submit.</p>
        </div>
        <div className="mt-8 shrink-0">
          {saveStatus === "saving" && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === "saved" && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
          {saveStatus === "error" && <span className="text-xs text-red-500">Not saved</span>}
        </div>
      </div>

      {/* Return banner */}
      {rejectionBanner && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${
          originalStatus === "REFERRED_TO_REQUESTOR"
            ? "bg-orange-50 border border-orange-200 text-orange-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          <span className="font-semibold">
            {originalStatus === "REFERRED_TO_REQUESTOR" ? "Referred back for revision:" : "This report was rejected:"}
          </span>{" "}
          {rejectionBanner}
        </div>
      )}

      {/* Finance mode banner */}
      {mode === "finance" && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          GL coding will be assigned by Finance during review. You do not need to enter GL accounts.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}
            className="shrink-0 text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
        </div>
      )}

      {/* Section 1 — Report Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide">Report Header</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">{user?.full_name ?? "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Code</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 italic">Not set on profile</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Employee Function <span className="text-gray-400">(optional)</span>
            </label>
            <input type="text" value={employeeFunction}
              onChange={(e) => setEmployeeFunction(e.target.value)}
              onBlur={scheduleAutoSave}
              placeholder="e.g. Marketing, Finance, Operations"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Report Date <span className="text-red-500">*</span>
            </label>
            <input type="date" value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              onBlur={scheduleAutoSave}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Section 2 — Expense Lines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Expense Lines</h2>
          <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            + Add Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">#</th>
                {(mode === "finance" || mode === "category_mapped") && formConfig.categories.length > 0 && (
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    Category{formConfig.require_category && <span className="text-red-500"> *</span>}
                  </th>
                )}
                {(mode === "finance" || mode === "category_mapped") && formConfig.require_subcategory && (
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    Subcategory<span className="text-red-500"> *</span>
                  </th>
                )}
                {mode !== "finance" && (
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    GL Account{mode === "employee" && <span className="text-red-500"> *</span>}
                  </th>
                )}
                {mode === "employee" && (
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">P/L Group</th>
                )}
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">IO / Dimension</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Cost Center</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Location</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Invoice Date</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Invoice No.</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Description <span className="text-red-500">*</span></th>
                <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">Amount (NGN) <span className="text-red-500">*</span></th>
                <th className="pb-2 text-right text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, idx) => {
                const selectedCat = formConfig.categories.find((c) => c.id === line.category_id);
                const availableSubs = selectedCat?.subcategories ?? [];
                return (
                  <tr key={line.localId}>
                    <td className="py-2 pr-3 text-gray-400">{idx + 1}</td>

                    {(mode === "finance" || mode === "category_mapped") && formConfig.categories.length > 0 && (
                      <td className="py-2 pr-3">
                        <select
                          value={line.category_id}
                          onChange={(e) => handleCategoryChange(line.localId, e.target.value)}
                          className="w-36 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select…</option>
                          {formConfig.categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                    )}

                    {(mode === "finance" || mode === "category_mapped") && formConfig.require_subcategory && (
                      <td className="py-2 pr-3">
                        <select
                          value={line.subcategory_id}
                          onChange={(e) => { updateLine(line.localId, "subcategory_id", e.target.value); scheduleAutoSave(); }}
                          disabled={availableSubs.length === 0}
                          className="w-36 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          <option value="">{availableSubs.length === 0 ? "—" : "Select…"}</option>
                          {availableSubs.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </td>
                    )}

                    {mode !== "finance" && (
                      <td className="py-2 pr-3">
                        <input type="text" value={line.gl_account}
                          onChange={(e) => updateLine(line.localId, "gl_account", e.target.value)}
                          onBlur={scheduleAutoSave}
                          placeholder="e.g. 733060"
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                    )}
                    {mode === "employee" && (
                      <td className="py-2 pr-3">
                        <input type="text" value={line.pl_group}
                          onChange={(e) => updateLine(line.localId, "pl_group", e.target.value)}
                          onBlur={scheduleAutoSave}
                          placeholder="e.g. PL4"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                    )}

                    <td className="py-2 pr-3"><input type="text" value={line.io_dimension} onChange={(e) => updateLine(line.localId, "io_dimension", e.target.value)} onBlur={scheduleAutoSave} placeholder="IO" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="py-2 pr-3"><input type="text" value={line.cost_center} onChange={(e) => updateLine(line.localId, "cost_center", e.target.value)} onBlur={scheduleAutoSave} placeholder="CC" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="py-2 pr-3"><input type="text" value={line.location} onChange={(e) => updateLine(line.localId, "location", e.target.value)} onBlur={scheduleAutoSave} placeholder="e.g. Lagos" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="py-2 pr-3"><input type="date" value={line.invoice_date} onChange={(e) => updateLine(line.localId, "invoice_date", e.target.value)} onBlur={scheduleAutoSave} className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="py-2 pr-3"><input type="text" value={line.invoice_number} onChange={(e) => updateLine(line.localId, "invoice_number", e.target.value)} onBlur={scheduleAutoSave} placeholder="Inv #" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="py-2 pr-3"><input type="text" value={line.description} onChange={(e) => updateLine(line.localId, "description", e.target.value)} onBlur={scheduleAutoSave} placeholder="Description" className="w-48 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="py-2 pr-3 text-right"><input type="number" min="0.01" step="0.01" value={line.amount} onChange={(e) => updateLine(line.localId, "amount", e.target.value)} onBlur={scheduleAutoSave} placeholder="0.00" className="w-28 px-2 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => removeLine(line.localId)} disabled={lines.length === 1}
                        className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-300 font-medium">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
          <div className="text-right">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-4">Grand Total</span>
            <span className="text-lg font-bold text-gray-900">{formatNGN(total)}</span>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc"
        onChange={handleFileSelected} />

      {/* M6 — Per-line documents */}
      {lines.some((l) => l.backendId) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-1">Line Attachments</h2>
          <p className="text-xs text-gray-400 mb-4">
            Attach receipts or invoices to individual expense lines. Accepted: PDF, JPG, PNG, Excel, Word (max 10 MB).
          </p>
          {uploadError && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="ml-2 text-red-400 hover:text-red-600 font-bold">×</button>
            </div>
          )}
          <div className="space-y-4">
            {lines.filter((l) => l.backendId).map((line, idx) => {
              const lineDocs = documents.filter((d) => d.line_id === line.backendId);
              const isUploading = uploadingFor === line.backendId;
              return (
                <div key={line.localId} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Line {idx + 1} — {line.description || line.gl_account || "(new line)"}
                  </p>
                  {lineDocs.length > 0 && (
                    <ul className="mb-2 space-y-1">
                      {lineDocs.map((doc) => (
                        <li key={doc.id} className="flex items-center gap-2 text-xs text-gray-700">
                          <FileTypeIcon mimeType={doc.mime_type} />
                          <span className="flex-1 truncate">{doc.file_name}</span>
                          <span className="text-gray-400 shrink-0">{formatBytes(doc.file_size)}</span>
                          {doc.signed_url && (
                            <a href={doc.signed_url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 shrink-0">View</a>
                          )}
                          <button type="button" onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-400 hover:text-red-600 shrink-0 font-medium">Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" disabled={isUploading || !line.backendId}
                    onClick={() => line.backendId && triggerUpload(line.backendId)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-300">
                    {isUploading ? "Uploading…" : "+ Attach Document"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* M6 — Report-level documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-1">Report Documents</h2>
        <p className="text-xs text-gray-400 mb-4">Documents that apply to the report as a whole, not a specific line.</p>
        {(() => {
          const reportDocs = documents.filter((d) => d.line_id === null);
          const isUploading = uploadingFor === "report";
          return (
            <>
              {reportDocs.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {reportDocs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 text-xs text-gray-700">
                      <FileTypeIcon mimeType={doc.mime_type} />
                      <span className="flex-1 truncate">{doc.file_name}</span>
                      <span className="text-gray-400 shrink-0">{formatBytes(doc.file_size)}</span>
                      {doc.signed_url && (
                        <a href={doc.signed_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 shrink-0">View</a>
                      )}
                      <button type="button" onClick={() => handleDeleteDocument(doc.id)}
                        className="text-red-400 hover:text-red-600 shrink-0 font-medium">Remove</button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" disabled={isUploading} onClick={() => triggerUpload("report")}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-300">
                {isUploading ? "Uploading…" : "+ Attach Document"}
              </button>
            </>
          );
        })()}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="button" onClick={handleSaveDraft} disabled={isSubmitting || !!error}
          className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-800 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-60">
          {isSubmitting ? "Saving…" : "Save Draft"}
        </button>
        <button type="button" onClick={openApproverModal} disabled={isSubmitting || !!error}
          className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
          Submit for Approval
        </button>
      </div>
    </div>
  );
}
