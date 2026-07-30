"use client";

/**
 * OcrScanModal — AI receipt/invoice scanning modal (M10).
 *
 * Opens when the user clicks the scan icon on an expense line card.
 * Accepts a JPEG/PNG/WEBP/PDF upload, calls POST /api/ai/ocr, and shows
 * the extracted fields with per-field confidence badges.
 *
 * Apply behaviour:
 *   "Apply to this line" — fills amount, description, invoice_date on the parent line.
 *   "Add as split lines" — emitted when line_items.length > 1; caller adds splits.
 *   Override recording — any edited field triggers POST /api/ai/override so the
 *   learning loop receives the correction.
 *
 * Confidence badge colours:
 *   ≥ 0.90 → green  "High"
 *   0.70–0.89 → amber "Medium"
 *   < 0.70  → red    "Low — verify"
 */

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OcrLineItem {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  confidence: number;
}

interface OcrResult {
  prediction_id: string;
  vendor_name: string | null;
  vendor_name_confidence: number;
  date: string | null;
  date_confidence: number;
  total_amount: number | null;
  total_amount_confidence: number;
  currency: string | null;
  currency_confidence: number;
  description: string | null;
  description_confidence: number;
  tax_amount: number | null;
  tax_type: string | null;
  line_items: OcrLineItem[];
  parse_error: boolean;
  processing_ms: number | null;
}

export interface OcrApplyData {
  amount?: number;
  description?: string;
  invoice_date?: string;   // YYYY-MM-DD
  vendor_name?: string;
  // set when user picks "Add as split lines"
  line_items?: OcrLineItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: OcrApplyData) => void;
  accessToken: string | null;
  currencyHint?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ConfBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.90) {
    return (
      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium border border-green-200">
        High
      </span>
    );
  }
  if (confidence >= 0.70) {
    return (
      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">
        Medium
      </span>
    );
  }
  if (confidence > 0) {
    return (
      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium border border-red-200">
        Low — verify
      </span>
    );
  }
  return null;
}

function fmtAmount(n: number | null): string {
  if (n === null) return "";
  return n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Component ──────────────────────────────────────────────────────────────────

type ModalState = "upload" | "scanning" | "results" | "error";

export default function OcrScanModal({ isOpen, onClose, onApply, accessToken, currencyHint }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modalState, setModalState] = useState<ModalState>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Editable extracted fields (user can change before applying)
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");

  if (!isOpen) return null;

  function handleClose() {
    setModalState("upload");
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setErrorMsg("");
    setEditAmount("");
    setEditDescription("");
    setEditDate("");
    onClose();
  }

  function handleFileSelected(selected: File | null) {
    if (!selected) return;
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelected(dropped);
  }

  async function handleScan() {
    if (!file || !accessToken) return;
    setModalState("scanning");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const url = `/api/ai/ocr${currencyHint ? `?tenant_currency=${encodeURIComponent(currencyHint)}` : ""}`;
      const data = await apiFetch<OcrResult>(url, {
        method: "POST",
        token: accessToken,
        formData,
      });

      setResult(data);
      setEditAmount(data.total_amount !== null ? String(data.total_amount) : "");
      setEditDescription(data.description ?? "");
      setEditDate(data.date ?? "");
      setModalState("results");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "OCR scan failed. Please try again.");
      setModalState("error");
    }
  }

  async function recordOverride(field: string, original: unknown, override: unknown) {
    if (!result || !accessToken) return;
    try {
      await apiFetch("/api/ai/override", {
        method: "POST",
        token: accessToken,
        body: {
          prediction_id: result.prediction_id,
          field,
          original_value: original,
          override_value: override,
        },
      });
    } catch {
      // Override recording is best-effort — don't block apply on failure
    }
  }

  async function handleApply() {
    if (!result) return;

    const parsedAmount = parseFloat(editAmount.replace(/,/g, ""));
    const applyData: OcrApplyData = {};

    if (!isNaN(parsedAmount) && parsedAmount > 0) applyData.amount = parsedAmount;
    if (editDescription.trim()) applyData.description = editDescription.trim();
    if (editDate) applyData.invoice_date = editDate;
    if (result.vendor_name) applyData.vendor_name = result.vendor_name;

    // Record overrides for any edited fields
    if (editAmount !== String(result.total_amount)) {
      await recordOverride("total_amount", result.total_amount, parsedAmount || null);
    }
    if (editDescription !== (result.description ?? "")) {
      await recordOverride("description", result.description, editDescription.trim());
    }
    if (editDate !== (result.date ?? "")) {
      await recordOverride("date", result.date, editDate);
    }

    onApply(applyData);
    handleClose();
  }

  async function handleApplySplitLines() {
    if (!result) return;
    const applyData: OcrApplyData = {
      line_items: result.line_items,
    };
    if (result.vendor_name) applyData.vendor_name = result.vendor_name;
    if (editDate) applyData.invoice_date = editDate;
    onApply(applyData);
    handleClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <i className="ti ti-scan text-blue-600" style={{ fontSize: 18 }} />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Scan Receipt</h2>
              <p className="text-xs text-gray-500">Automatic data extraction — scan and auto-fill expense fields</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── UPLOAD STATE ── */}
          {(modalState === "upload" || (modalState !== "scanning" && modalState !== "results" && modalState !== "error")) && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                  ${isDragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <i className="ti ti-camera-up text-gray-400" style={{ fontSize: 40 }} />
                <p className="mt-3 text-sm font-medium text-gray-700">
                  {file ? file.name : "Click to choose or drag & drop"}
                </p>
                <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WEBP or PDF — max 10 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
                />
              </div>

              {previewUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200 max-h-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="receipt preview" className="w-full object-contain max-h-40" />
                </div>
              )}

              {file && (
                <div className="flex justify-end">
                  <button
                    onClick={handleScan}
                    className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <i className="ti ti-sparkles" />
                    Extract Data
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SCANNING STATE ── */}
          {modalState === "scanning" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Extracting data…</p>
              <p className="text-xs text-gray-400">This usually takes 2–4 seconds</p>
            </div>
          )}

          {/* ── ERROR STATE ── */}
          {modalState === "error" && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">Scan failed</p>
                <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={() => setModalState("upload")}
                className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── RESULTS STATE ── */}
          {modalState === "results" && result && (
            <div className="space-y-4">
              {result.parse_error && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  Partial extraction — some fields could not be read. Review carefully before applying.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Image thumbnail (if available) */}
                {previewUrl && (
                  <div className="sm:col-span-2 rounded-xl overflow-hidden border border-gray-200 max-h-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="receipt" className="w-full object-contain max-h-36" />
                  </div>
                )}

                {/* Vendor */}
                {result.vendor_name && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center">
                      Vendor
                      <ConfBadge confidence={result.vendor_name_confidence} />
                    </label>
                    <p className="text-sm font-semibold text-gray-800">{result.vendor_name}</p>
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center">
                    Date
                    <ConfBadge confidence={result.date_confidence} />
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center">
                    Total Amount {result.currency && <span className="ml-1 text-gray-400">({result.currency})</span>}
                    <ConfBadge confidence={result.total_amount_confidence} />
                  </label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Description */}
                {(result.description || result.description_confidence > 0) && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center">
                      Description
                      <ConfBadge confidence={result.description_confidence} />
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Tax */}
                {result.tax_amount !== null && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {result.tax_type ?? "Tax"}
                    </label>
                    <p className="text-sm text-gray-700">{fmtAmount(result.tax_amount)}</p>
                  </div>
                )}

                {/* Line items (collapsible) */}
                {result.line_items.length > 1 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">
                      Line items ({result.line_items.length})
                    </p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Description</th>
                            <th className="px-3 py-1.5 text-right text-gray-500 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.line_items.map((li, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-3 py-1.5 text-gray-700">{li.description}</td>
                              <td className="px-3 py-1.5 text-right text-gray-700">{fmtAmount(li.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

              {result.processing_ms && (
                <p className="text-[10px] text-gray-400 text-right">
                  Extracted in {(result.processing_ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {modalState === "results" && result && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={handleClose}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              {result.line_items.length > 1 && (
                <button
                  onClick={handleApplySplitLines}
                  className="px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  ⑂ Add as {result.line_items.length} split lines
                </button>
              )}
              <button
                onClick={handleApply}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply to line
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
