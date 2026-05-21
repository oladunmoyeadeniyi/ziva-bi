"use client";

/**
 * New expense retirement form — /dashboard/business/expenses/new
 *
 * Two-section layout:
 *   Section 1 — Report Header (employee info + function + date)
 *   Section 2 — Expense Lines table (add/remove lines, running total)
 *
 * Submit flow (M4/M5):
 *   1. POST /api/expenses/reports  → creates the DRAFT report
 *   2. POST each line individually
 *   3. GET /api/approvals/matrix + GET /api/users/tenant → fetch config + approvers
 *   4. Show approver selection modal
 *   5. POST /api/approvals/reports/{id}/submit with selected approver IDs
 *      → report moves to PENDING_APPROVAL and enters the approval queue
 *
 * Save Draft skips steps 3–5.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface LineState {
  localId: string;
  gl_account: string;
  pl_group: string;
  io_dimension: string;
  cost_center: string;
  location: string;
  invoice_date: string;
  invoice_number: string;
  description: string;
  amount: string;
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

function newLine(): LineState {
  return {
    localId: Math.random().toString(36).slice(2),
    gl_account: "",
    pl_group: "",
    io_dimension: "",
    cost_center: "",
    location: "",
    invoice_date: "",
    invoice_number: "",
    description: "",
    amount: "",
  };
}

function calcTotal(lines: LineState[]): number {
  return lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
}

function formatTotal(lines: LineState[]): string {
  const total = calcTotal(lines);
  return "₦" + total.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const today = () => new Date().toISOString().slice(0, 10);

export default function NewExpensePage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [reportDate, setReportDate] = useState<string>(today());
  const [employeeFunction, setEmployeeFunction] = useState<string>("");
  const [lines, setLines] = useState<LineState[]>([newLine()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Approver selection modal state
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [showApproverModal, setShowApproverModal] = useState(false);
  const [matrix, setMatrix] = useState<ApprovalMatrix | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [l1Approver, setL1Approver] = useState("");
  const [l2Approver, setL2Approver] = useState("");
  const [l3Approver, setL3Approver] = useState("");
  const [approverError, setApproverError] = useState<string | null>(null);

  const updateLine = (localId: string, field: keyof LineState, value: string) => {
    setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, [field]: value } : l)));
  };
  const removeLine = (localId: string) => setLines((prev) => prev.filter((l) => l.localId !== localId));
  const addLine = () => setLines((prev) => [...prev, newLine()]);

  const validate = (): string | null => {
    if (!reportDate) return "Report date is required.";
    if (lines.length === 0) return "At least one expense line is required.";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.gl_account.trim()) return `Line ${i + 1}: GL Account is required.`;
      if (!l.description.trim()) return `Line ${i + 1}: Description is required.`;
      const amount = parseFloat(l.amount);
      if (!l.amount || isNaN(amount) || amount <= 0)
        return `Line ${i + 1}: Amount must be a positive number.`;
    }
    return null;
  };

  const createReportAndLines = async (): Promise<string> => {
    const report = await apiFetch<{ id: string }>("/api/expenses/reports", {
      method: "POST",
      token: accessToken!,
      body: JSON.stringify({ report_date: reportDate, employee_function: employeeFunction || null }),
    });
    for (const l of lines) {
      await apiFetch(`/api/expenses/reports/${report.id}/lines`, {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({
          gl_account: l.gl_account.trim(),
          pl_group: l.pl_group.trim() || null,
          io_dimension: l.io_dimension.trim() || null,
          cost_center: l.cost_center.trim() || null,
          location: l.location.trim() || null,
          invoice_date: l.invoice_date || null,
          invoice_number: l.invoice_number.trim() || null,
          description: l.description.trim(),
          amount: parseFloat(l.amount),
        }),
      });
    }
    return report.id;
  };

  const handleSaveDraft = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      await createReportAndLines();
      router.push("/dashboard/business/expenses");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save report.";
      setError(msg === "Failed to fetch" ? "Cannot reach the backend server. Make sure uvicorn is running on http://localhost:8000." : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Creates the report + lines, fetches matrix + users, then opens the approver modal
  const handleOpenApproverModal = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setIsSubmitting(true);

    try {
      const reportId = await createReportAndLines();
      setCreatedReportId(reportId);

      const [matrixData, usersData] = await Promise.all([
        apiFetch<ApprovalMatrix | null>("/api/approvals/matrix", { token: accessToken! }),
        apiFetch<TenantUser[]>("/api/users/tenant", { token: accessToken! }),
      ]);

      if (!matrixData) {
        // No matrix configured — delete the draft and show an error
        await apiFetch(`/api/expenses/reports/${reportId}`, { method: "DELETE", token: accessToken! });
        setCreatedReportId(null);
        setError("Your company has not configured an approval matrix. Contact your administrator.");
        return;
      }

      setMatrix(matrixData);
      // Exclude the current user — an approver cannot be the same person as the requestor
      setTenantUsers(usersData.filter((u) => u.id !== user?.id));
      setL1Approver("");
      setL2Approver("");
      setL3Approver("");
      setApproverError(null);
      setShowApproverModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to prepare submission.";
      setError(msg === "Failed to fetch" ? "Cannot reach the backend server. Make sure uvicorn is running on http://localhost:8000." : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitWithApprovers = async () => {
    if (!matrix || !createdReportId) return;
    setApproverError(null);

    const total = calcTotal(lines);
    const needsL2 = matrix.levels >= 2 && (matrix.amount_threshold_l2 === null || total > parseFloat(matrix.amount_threshold_l2));
    const needsL3 = matrix.levels >= 3 && (matrix.amount_threshold_l3 === null || total > parseFloat(matrix.amount_threshold_l3));

    if (!l1Approver) { setApproverError("Please select a Level 1 approver."); return; }
    if (needsL2 && !l2Approver) { setApproverError("Please select a Level 2 approver."); return; }
    if (needsL3 && !l3Approver) { setApproverError("Please select a Level 3 approver."); return; }

    setIsSubmitting(true);
    try {
      await apiFetch(`/api/approvals/reports/${createdReportId}/submit`, {
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

  const total = calcTotal(lines);
  const needsL2 = matrix ? matrix.levels >= 2 && (matrix.amount_threshold_l2 === null || total > parseFloat(matrix.amount_threshold_l2)) : false;
  const needsL3 = matrix ? matrix.levels >= 3 && (matrix.amount_threshold_l3 === null || total > parseFloat(matrix.amount_threshold_l3)) : false;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      {/* Approver selection modal */}
      {showApproverModal && matrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Select Approvers</h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose who should review this report at each level.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {matrix.level1_role} <span className="text-red-500">*</span>
                </label>
                <select
                  value={l1Approver}
                  onChange={(e) => setL1Approver(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select approver…</option>
                  {tenantUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>

              {needsL2 && matrix.level2_role && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {matrix.level2_role} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={l2Approver}
                    onChange={(e) => setL2Approver(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select approver…</option>
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {needsL3 && matrix.level3_role && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {matrix.level3_role} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={l3Approver}
                    onChange={(e) => setL3Approver(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select approver…</option>
                    {tenantUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {approverError && (
              <p className="mt-3 text-xs text-red-600">{approverError}</p>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => { setShowApproverModal(false); setApproverError(null); }}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitWithApprovers}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Expense Retirement</h1>
        <p className="mt-0.5 text-sm text-gray-500">Fill in all required fields, then save or submit.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 text-red-400 hover:text-red-600 font-bold text-lg leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Section 1 — Report Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide">
          Report Header
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              {user?.full_name ?? "—"}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Code</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 italic">
              Not set on profile
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Employee Function <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={employeeFunction}
              onChange={(e) => setEmployeeFunction(e.target.value)}
              placeholder="e.g. Marketing, Finance, Operations"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Report Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Section 2 — Expense Lines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Expense Lines
          </h2>
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">#</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">GL Account *</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">P/L Group</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">IO / Dimension</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Cost Center</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Location</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Invoice Date</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Invoice No.</th>
                <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Description *</th>
                <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">Amount (NGN) *</th>
                <th className="pb-2 text-right text-xs font-semibold text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line, idx) => (
                <tr key={line.localId}>
                  <td className="py-2 pr-3 text-gray-400">{idx + 1}</td>
                  <td className="py-2 pr-3"><input type="text" value={line.gl_account} onChange={(e) => updateLine(line.localId, "gl_account", e.target.value)} placeholder="e.g. 733060" className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3"><input type="text" value={line.pl_group} onChange={(e) => updateLine(line.localId, "pl_group", e.target.value)} placeholder="e.g. PL4" className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3"><input type="text" value={line.io_dimension} onChange={(e) => updateLine(line.localId, "io_dimension", e.target.value)} placeholder="IO" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3"><input type="text" value={line.cost_center} onChange={(e) => updateLine(line.localId, "cost_center", e.target.value)} placeholder="CC" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3"><input type="text" value={line.location} onChange={(e) => updateLine(line.localId, "location", e.target.value)} placeholder="e.g. Lagos" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3"><input type="date" value={line.invoice_date} onChange={(e) => updateLine(line.localId, "invoice_date", e.target.value)} className="w-32 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3"><input type="text" value={line.invoice_number} onChange={(e) => updateLine(line.localId, "invoice_number", e.target.value)} placeholder="Inv #" className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3"><input type="text" value={line.description} onChange={(e) => updateLine(line.localId, "description", e.target.value)} placeholder="Description" className="w-48 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 pr-3 text-right"><input type="number" min="0.01" step="0.01" value={line.amount} onChange={(e) => updateLine(line.localId, "amount", e.target.value)} placeholder="0.00" className="w-28 px-2 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500" /></td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => removeLine(line.localId)} disabled={lines.length === 1} className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-300 font-medium">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
          <div className="text-right">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-4">Grand Total</span>
            <span className="text-lg font-bold text-gray-900">{formatTotal(lines)}</span>
          </div>
        </div>
      </div>

      {/* M6 — Document attachment hint (docs available after saving draft) */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-700">
        <span className="font-medium">Attaching receipts or documents?</span> Save as draft first, then open the edit page to attach files to each line.
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSubmitting || !!error}
          className="px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={handleOpenApproverModal}
          disabled={isSubmitting || !!error}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {isSubmitting ? "Preparing…" : "Submit for Approval"}
        </button>
      </div>
    </div>
  );
}
