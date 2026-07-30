"use client";

/**
 * New Bank Statement — /dashboard/business/bank-recon/new
 *
 * Two-step form:
 *   Step 1 — Create statement header (bank account, date, balances)
 *   Step 2 — Upload CSV / XLSX statement file; shows parse summary + warnings
 *
 * On success redirects to the matching workspace (/bank-recon/{id}).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { fmtCommaInput, stripCommas } from "@/lib/utils";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
}

interface UploadResult {
  lines_parsed: number;
  lines_created: number;
  warnings: string[];
}

export default function NewBankStatementPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  // Step 1 state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [statementDate, setStatementDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [step1Error, setStep1Error] = useState("");

  // Step 2 state (after statement header created)
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch("/api/setup/bank-accounts", { token: accessToken })
      .then((data: unknown) => setBankAccounts(
        (Array.isArray(data) ? data : []).filter((a: BankAccount) => a.is_active)
      ))
      .catch(() => {});
  }, [accessToken]);

  const selectedAccount = bankAccounts.find(a => a.id === bankAccountId);

  async function handleCreateStatement(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setStep1Error("");
    setSaving(true);
    try {
      const body = {
        bank_account_id: bankAccountId,
        statement_date: statementDate,
        period_start: periodStart || null,
        opening_balance: parseFloat(stripCommas(openingBalance)),
        closing_balance: parseFloat(stripCommas(closingBalance)),
        currency: selectedAccount?.currency ?? "NGN",
        notes: notes || null,
      };
      const data = await apiFetch<{ id: string }>("/api/bank-recon/statements", {
        method: "POST",
        token: accessToken,
        body,
      });
      setCreatedId(data.id);
    } catch (e: unknown) {
      setStep1Error(e instanceof Error ? e.message : "Failed to create statement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !createdId || !file) return;
    setUploadError("");
    setUploadResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch(`/api/bank-recon/statements/${createdId}/upload`, {
        method: "POST",
        token: accessToken,
        formData,
      });
      setUploadResult(data as UploadResult);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleProceed() {
    router.push(`/dashboard/business/bank-recon/${createdId}`);
  }

  return (
    <PageContainer>
      <PageHeading title="New Bank Statement" subtitle="Import a bank statement for reconciliation." />

      {/* Step 1 — Statement header */}
      <div className={`bg-white border border-gray-200 rounded-xl p-6 mt-6 ${createdId ? "opacity-60 pointer-events-none" : ""}`}>
        <div className="flex items-center gap-2 mb-5">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${createdId ? "bg-green-500 text-white" : "bg-blue-600 text-white"}`}>
            {createdId ? <i className="ti ti-check" /> : "1"}
          </span>
          <h2 className="font-semibold text-gray-800">Statement details</h2>
        </div>

        <form onSubmit={handleCreateStatement} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank account *</label>
              <select
                required
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select bank account —</option>
                {bankAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.bank_name} — {a.account_name} ({a.currency}) · {a.account_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statement date (closing date) *</label>
              <input
                type="date"
                required
                value={statementDate}
                onChange={e => setStatementDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period start (optional)</label>
              <input
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening balance *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {selectedAccount?.currency ?? ""}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(fmtCommaInput(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pl-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Closing balance *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {selectedAccount?.currency ?? ""}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={closingBalance}
                  onChange={e => setClosingBalance(fmtCommaInput(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pl-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. June 2026 NGN main account"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {step1Error && (
            <p className="text-sm text-red-600">{step1Error}</p>
          )}

          {!createdId && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create statement"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Step 2 — Upload file */}
      {createdId && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
          <div className="flex items-center gap-2 mb-5">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${uploadResult ? "bg-green-500 text-white" : "bg-blue-600 text-white"}`}>
              {uploadResult ? <i className="ti ti-check" /> : "2"}
            </span>
            <h2 className="font-semibold text-gray-800">Upload statement file</h2>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Upload a CSV or XLSX file exported from your bank. Supported columns: Date, Description,
            Reference, Debit, Credit (or a single Amount column). First row must be headers.
          </p>

          {!uploadResult ? (
            <form onSubmit={handleUpload} className="space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => document.getElementById("stmt-file-input")?.click()}
              >
                <i className="ti ti-file-spreadsheet text-gray-400" style={{ fontSize: 36 }} />
                <p className="mt-2 text-sm text-gray-600">
                  {file ? file.name : "Click to choose a file or drag & drop"}
                </p>
                <p className="text-xs text-gray-400 mt-1">.csv or .xlsx — max 10 MB</p>
                <input
                  id="stmt-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleProceed}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Skip (add lines manually later)
                </button>
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : "Upload & parse"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{uploadResult.lines_created}</p>
                  <p className="text-xs text-green-600 mt-0.5">Lines imported</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{uploadResult.warnings.length}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Rows skipped</p>
                </div>
              </div>

              {uploadResult.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">Parse warnings</p>
                  <ul className="space-y-0.5">
                    {uploadResult.warnings.slice(0, 10).map((w, i) => (
                      <li key={i} className="text-xs text-amber-700">{w}</li>
                    ))}
                    {uploadResult.warnings.length > 10 && (
                      <li className="text-xs text-amber-600">+ {uploadResult.warnings.length - 10} more…</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleProceed}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  Start reconciling →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
