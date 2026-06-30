"use client";

/**
 * Edit expense retirement — M9 rewrite.
 *
 * Same M9 card-based layout as new/page.tsx with one key difference:
 * the report and its lines are loaded on mount and pre-populated into state.
 * Split sub-lines (split_parent_id set) are nested under their parent line.
 *
 * Auto-save, GL picker, AI suggestions, dimension fields, and split lines work
 * identically to new/page.tsx. The report ID is known from the URL so no
 * redirect occurs after Save Draft — instead "Saved ✓" is shown inline.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import ExpenseItemPicker, {
  type CategoryForForm,
  type GLSearchResult,
  type PickerResult,
} from "@/components/expenses/ExpenseItemPicker";
import SplitLinePanel, {
  type DimensionForForm,
  type SplitLineState,
} from "@/components/expenses/SplitLinePanel";
import { Banner } from "@/components/Banner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DimReq { dimension_id: string; requirement: string; }

interface LineState {
  localId: string;
  backendId: string | null;
  gl_id: string | null;
  gl_number: string;
  gl_name: string;
  category_id: string | null;
  category_name: string;
  subcategory_id: string | null;
  subcategory_name: string;
  dimension_requirements: DimReq[];
  dimension_values: Record<string, string>;
  amount: string;
  invoice_date: string;
  invoice_number: string;
  description: string;
  location: string;
  flag_incorrect: boolean;
  flag_comment: string;
  split_lines: SplitLineState[];
  is_expanded: boolean;
}

interface FormConfig {
  coding_level: number;
  gl_coding_mode: string;
  require_category: boolean;
  require_subcategory: boolean;
  allow_free_text_description: boolean;
  show_location: boolean;
  require_location: boolean;
  categories: CategoryForForm[];
  dimensions: DimensionForForm[];
}

interface ExistingLine {
  id: string;
  line_number: number;
  gl_account: string | null;
  gl_id: string | null;
  location: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  description: string;
  amount: string;
  category_id: string | null;
  subcategory_id: string | null;
  dimension_values: Record<string, string> | null;
  flag_incorrect: boolean;
  flag_comment: string | null;
  is_split_parent: boolean;
  split_parent_id: string | null;
}

interface ExistingReport {
  id: string;
  report_number: string;
  employee_function: string | null;
  report_date: string;
  status: string;
  rejection_comment: string | null;
  lines: ExistingLine[];
}

interface DimSuggestion { value_id: string; confidence: number; }
interface SuggestionResponse { description: string | null; dimensions: Record<string, DimSuggestion>; }

interface ApprovalMatrix {
  levels: number;
  level1_role: string;
  level2_role: string | null;
  level3_role: string | null;
  amount_threshold_l2: string | null;
  amount_threshold_l3: string | null;
}

interface TenantUser { id: string; full_name: string; email: string; }

interface DocumentRecord {
  id: string; report_id: string; line_id: string | null; file_name: string;
  file_size: number; mime_type: string; storage_path: string;
  signed_url: string | null; created_at: string;
}

interface ApiLine { id: string; line_number: number; }
interface ApiReport { id: string; lines: ApiLine[]; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLine(): LineState {
  return {
    localId: Math.random().toString(36).slice(2),
    backendId: null, gl_id: null, gl_number: "", gl_name: "",
    category_id: null, category_name: "", subcategory_id: null, subcategory_name: "",
    dimension_requirements: [], dimension_values: {},
    amount: "", invoice_date: "", invoice_number: "", description: "",
    location: "", flag_incorrect: false, flag_comment: "",
    split_lines: [], is_expanded: true,
  };
}

function makeSplit(): SplitLineState {
  return {
    localId: Math.random().toString(36).slice(2),
    backendId: null, gl_id: null, gl_number: "", gl_name: "",
    amount: "", dimension_values: {}, dimension_requirements: [],
  };
}

function lineFromApi(apiLine: ExistingLine, categories: CategoryForForm[]): LineState {
  let glName = "";
  let dimRequirements: DimReq[] = [];
  for (const cat of categories) {
    for (const sub of cat.subcategories) {
      for (const m of sub.gl_mappings) {
        if (m.gl_id === apiLine.gl_id || (m.gl_number && m.gl_number === apiLine.gl_account)) {
          glName = m.gl_name;
          dimRequirements = m.dimension_requirements;
          break;
        }
      }
    }
  }
  let catName = "", subName = "";
  for (const cat of categories) {
    if (cat.id === apiLine.category_id) catName = cat.name;
    for (const sub of cat.subcategories) {
      if (sub.id === apiLine.subcategory_id) subName = sub.name;
    }
  }
  return {
    localId: Math.random().toString(36).slice(2),
    backendId: apiLine.id,
    gl_id: apiLine.gl_id || null,
    gl_number: apiLine.gl_account || "",
    gl_name: glName,
    category_id: apiLine.category_id || null,
    category_name: catName,
    subcategory_id: apiLine.subcategory_id || null,
    subcategory_name: subName,
    dimension_requirements: dimRequirements,
    dimension_values: apiLine.dimension_values || {},
    amount: apiLine.amount,
    invoice_date: apiLine.invoice_date || "",
    invoice_number: apiLine.invoice_number || "",
    description: apiLine.description,
    location: apiLine.location || "",
    flag_incorrect: apiLine.flag_incorrect || false,
    flag_comment: apiLine.flag_comment || "",
    split_lines: [],
    is_expanded: false,
  };
}

function splitFromApi(apiLine: ExistingLine): SplitLineState {
  return {
    localId: Math.random().toString(36).slice(2),
    backendId: apiLine.id,
    gl_id: apiLine.gl_id || null,
    gl_number: apiLine.gl_account || "",
    gl_name: "",
    amount: apiLine.amount,
    dimension_values: apiLine.dimension_values || {},
    dimension_requirements: [],
  };
}

function isComplete(l: LineState, cfg: FormConfig): boolean {
  if (!l.amount || parseFloat(l.amount) <= 0) return false;
  if (!l.invoice_date) return false;
  if (!l.invoice_number.trim()) return false;
  if (!l.description.trim()) return false;
  if (cfg.coding_level === 1 && !l.subcategory_id) return false;
  if (cfg.coding_level >= 2 && !l.gl_id) return false;
  if (cfg.show_location && cfg.require_location && !l.location.trim()) return false;
  for (const r of l.dimension_requirements) {
    if (r.requirement === "required" && !l.dimension_values[r.dimension_id]) return false;
  }
  if (l.split_lines.length > 0) {
    const tot = l.split_lines.reduce((s, sl) => s + (parseFloat(sl.amount) || 0), 0);
    if (Math.abs(parseFloat(l.amount) - tot) >= 0.005) return false;
  }
  return true;
}

function glChip(l: LineState, level: number): string {
  if (level === 1) {
    if (l.subcategory_name) return `${l.category_name} / ${l.subcategory_name}`;
    if (l.category_name) return l.category_name;
    return "Select Expense Type";
  }
  if (l.gl_number) return `${l.gl_number}${l.gl_name ? ` — ${l.gl_name}` : ""}`;
  if (l.category_name) return `${l.category_name}${l.subcategory_name ? ` / ${l.subcategory_name}` : ""}`;
  return "Select GL Account";
}

function mainPayload(l: LineState) {
  return {
    gl_account: l.gl_number || null,
    gl_id: l.gl_id || null,
    pl_group: null, io_dimension: null, cost_center: null,
    location: l.location.trim() || null,
    invoice_date: l.invoice_date || null,
    invoice_number: l.invoice_number.trim() || null,
    description: l.description.trim() || "Expense",
    amount: parseFloat(l.amount),
    category_id: l.category_id || null,
    subcategory_id: l.subcategory_id || null,
    dimension_values: Object.keys(l.dimension_values).length ? l.dimension_values : null,
    flag_incorrect: l.flag_incorrect,
    flag_comment: l.flag_comment.trim() || null,
    is_split_parent: l.split_lines.length > 0,
  };
}

function splitPayload(s: SplitLineState, parentId: string, desc: string) {
  return {
    gl_account: s.gl_number || null,
    gl_id: s.gl_id || null,
    description: desc || "Split allocation",
    amount: parseFloat(s.amount) || 0,
    split_parent_id: parentId,
    dimension_values: Object.keys(s.dimension_values).length ? s.dimension_values : null,
  };
}

function calcTotal(lines: LineState[]) {
  return lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
}

function fmtTotal(lines: LineState[]) {
  return "₦" + calcTotal(lines).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a raw numeric string with comma separators for display. */
function fmtCommaInput(val: string): string {
  if (!val) return "";
  const clean = val.replace(/[^0-9.]/g, "");
  const [intPart, decPart] = clean.split(".");
  const formatted = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

/** Strip commas from a formatted amount string before storing. */
function stripCommas(v: string): string {
  return v.replace(/,/g, "");
}

function FileIcon({ mime }: { mime: string }) {
  if (mime === "application/pdf") return <span className="text-red-500 font-bold text-xs">PDF</span>;
  if (mime.startsWith("image/")) return <span className="text-blue-500 font-bold text-xs">IMG</span>;
  return <span className="text-gray-500 font-bold text-xs">FILE</span>;
}

const DEFAULT_CFG: FormConfig = {
  coding_level: 0, gl_coding_mode: "finance",
  require_category: false, require_subcategory: false,
  allow_free_text_description: true, show_location: true, require_location: false,
  categories: [], dimensions: [],
};

// ── Page component ────────────────────────────────────────────────────────────

export default function EditExpensePage() {
  const { report_id } = useParams<{ report_id: string }>();
  const { user, accessToken } = useAuth();
  const router = useRouter();

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [reportNumber, setReportNumber] = useState("");
  const [originalStatus, setOriginalStatus] = useState("DRAFT");
  const [rejectionBanner, setRejectionBanner] = useState<string | null>(null);

  // Form state
  const [reportDate, setReportDate] = useState("");
  const [employeeFunction, setEmployeeFunction] = useState("");
  const [lines, setLines] = useState<LineState[]>([makeLine()]);
  const [formConfig, setFormConfig] = useState<FormConfig>(DEFAULT_CFG);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // GL picker
  const [pickerFor, setPickerFor] = useState<{ lineLocalId: string; splitLocalId?: string } | null>(null);

  // AI suggestions per line
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionResponse>>({});

  // Document attachments
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOverFor, setDragOverFor] = useState<string | null>(null);

  // Approver modal
  const [showApproverModal, setShowApproverModal] = useState(false);
  const [matrix, setMatrix] = useState<ApprovalMatrix | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [l1Approver, setL1Approver] = useState("");
  const [l2Approver, setL2Approver] = useState("");
  const [l3Approver, setL3Approver] = useState("");
  const [approverError, setApproverError] = useState<string | null>(null);

  // Refs
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveCallbackRef = useRef<() => Promise<void>>(async () => {});
  const currentSavePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const linesRef = useRef(lines);
  const formConfigRef = useRef(formConfig);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { formConfigRef.current = formConfig; }, [formConfig]);

  // ── Load report + form config on mount ───────────────────────────────────

  useEffect(() => {
    if (!accessToken || !report_id) return;

    const load = async () => {
      try {
        const [report, cfg, docs] = await Promise.all([
          apiFetch<ExistingReport>(`/api/expenses/reports/${report_id}`, { token: accessToken }),
          apiFetch<FormConfig>("/api/expense-config/form-config", { token: accessToken }),
          apiFetch<DocumentRecord[]>(`/api/documents/reports/${report_id}`, { token: accessToken }).catch(() => [] as DocumentRecord[]),
        ]);

        setFormConfig(cfg);
        setReportNumber(report.report_number);
        setOriginalStatus(report.status);
        setReportDate(report.report_date);
        setEmployeeFunction(report.employee_function || "");
        if (report.rejection_comment) setRejectionBanner(report.rejection_comment);
        setDocuments(docs);

        const parentLines = report.lines.filter((l) => !l.split_parent_id);
        const splitLines = report.lines.filter((l) => !!l.split_parent_id);

        const mappedLines: LineState[] = parentLines.map((pl) => {
          const ls = lineFromApi(pl, cfg.categories);
          ls.split_lines = splitLines
            .filter((sl) => sl.split_parent_id === pl.id)
            .map((sl) => splitFromApi(sl));
          return ls;
        });

        setLines(mappedLines.length > 0 ? mappedLines : [makeLine()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [accessToken, report_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GL search for Level 4 ─────────────────────────────────────────────────

  const doSearchGL = useCallback(async (q: string): Promise<GLSearchResult[]> => {
    if (!accessToken) return [];
    try {
      return await apiFetch<GLSearchResult[]>(
        `/api/config/gl/search?q=${encodeURIComponent(q)}&limit=20`,
        { token: accessToken }
      );
    } catch { return []; }
  }, [accessToken]);

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const runAutoSave = async () => {
    if (!accessToken || !reportDate || !report_id) return;
    const currentLines = linesRef.current;
    const hasValid = currentLines.some((l) => l.description.trim() && parseFloat(l.amount) > 0);
    if (!hasValid || isSavingRef.current) return;

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      await apiFetch(`/api/expenses/reports/${report_id}`, {
        method: "PATCH", token: accessToken,
        body: JSON.stringify({ report_date: reportDate, employee_function: employeeFunction || null }),
      });

      for (const bid of pendingDeleteIdsRef.current) {
        try {
          await apiFetch(`/api/expenses/reports/${report_id}/lines/${bid}`, { method: "DELETE", token: accessToken });
        } catch { /* non-fatal */ }
      }
      pendingDeleteIdsRef.current.clear();

      const knownIds = new Set<string>(currentLines.flatMap((l) => [l.backendId, ...l.split_lines.map((s) => s.backendId)]).filter(Boolean) as string[]);
      const updatedLines = currentLines.map((l) => ({ ...l, split_lines: [...l.split_lines] }));

      for (let i = 0; i < updatedLines.length; i++) {
        const l = updatedLines[i];
        if (!l.description.trim() || !(parseFloat(l.amount) > 0)) continue;

        if (l.backendId) {
          try {
            await apiFetch(`/api/expenses/reports/${report_id}/lines/${l.backendId}`, {
              method: "PATCH", token: accessToken, body: JSON.stringify(mainPayload(l)),
            });
          } catch { /* non-fatal */ }
        } else {
          try {
            const resp = await apiFetch<ApiReport>(`/api/expenses/reports/${report_id}/lines`, {
              method: "POST", token: accessToken, body: JSON.stringify(mainPayload(l)),
            });
            const nl = resp.lines.find((rl) => !knownIds.has(rl.id));
            if (nl) { updatedLines[i] = { ...updatedLines[i], backendId: nl.id }; knownIds.add(nl.id); }
          } catch { /* non-fatal */ }
        }

        const parentId = updatedLines[i].backendId;
        if (parentId) {
          for (let j = 0; j < updatedLines[i].split_lines.length; j++) {
            const sp = updatedLines[i].split_lines[j];
            if (!(parseFloat(sp.amount) > 0)) continue;
            if (sp.backendId) {
              try {
                await apiFetch(`/api/expenses/reports/${report_id}/lines/${sp.backendId}`, {
                  method: "PATCH", token: accessToken,
                  body: JSON.stringify({ ...splitPayload(sp, parentId, l.description), split_parent_id: parentId }),
                });
              } catch { /* non-fatal */ }
            } else {
              try {
                const sr = await apiFetch<ApiReport>(`/api/expenses/reports/${report_id}/lines`, {
                  method: "POST", token: accessToken,
                  body: JSON.stringify(splitPayload(sp, parentId, l.description)),
                });
                const ns = sr.lines.find((rl) => !knownIds.has(rl.id));
                if (ns) { updatedLines[i].split_lines[j] = { ...sp, backendId: ns.id }; knownIds.add(ns.id); }
              } catch { /* non-fatal */ }
            }
          }
        }
      }

      const hasUpdates = updatedLines.some((l, i) => l.backendId !== currentLines[i].backendId);
      if (hasUpdates) setLines(updatedLines);
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
    finally { isSavingRef.current = false; }
  };

  autoSaveCallbackRef.current = runAutoSave;

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      currentSavePromiseRef.current = autoSaveCallbackRef.current();
    }, 800);
  }, []);

  // ── Line management ───────────────────────────────────────────────────────

  const updateLine = (localId: string, patch: Partial<LineState>) => {
    setLines((prev) => prev.map((l) => {
      if (l.localId !== localId) return l;
      const updated = { ...l, ...patch };
      // Auto-collapse when line becomes complete (skip if patch explicitly sets is_expanded)
      if (!("is_expanded" in patch) && l.is_expanded && isComplete(updated, formConfigRef.current)) {
        return { ...updated, is_expanded: false };
      }
      return updated;
    }));
  };

  const toggleExpand = (localId: string) => {
    setLines((prev) => prev.map((l) => l.localId === localId ? { ...l, is_expanded: !l.is_expanded } : l));
  };

  const removeLine = (localId: string) => {
    setLines((prev) => {
      const line = prev.find((l) => l.localId === localId);
      if (line?.backendId) pendingDeleteIdsRef.current.add(line.backendId);
      line?.split_lines.forEach((s) => { if (s.backendId) pendingDeleteIdsRef.current.add(s.backendId); });
      return prev.filter((l) => l.localId !== localId);
    });
    scheduleAutoSave();
  };

  const addLine = () => { setLines((prev) => [...prev, makeLine()]); scheduleAutoSave(); };

  const addSplitLine = (lineLocalId: string) => {
    setLines((prev) => prev.map((l) =>
      l.localId === lineLocalId ? { ...l, split_lines: [...l.split_lines, makeSplit()], is_expanded: true } : l
    ));
    scheduleAutoSave();
  };

  const updateSplitLine = (lineLocalId: string, splitLocalId: string, updates: Partial<SplitLineState>) => {
    setLines((prev) => prev.map((l) =>
      l.localId !== lineLocalId ? l : {
        ...l, split_lines: l.split_lines.map((s) => s.localId === splitLocalId ? { ...s, ...updates } : s),
      }
    ));
    scheduleAutoSave();
  };

  const removeSplitLine = (lineLocalId: string, splitLocalId: string) => {
    setLines((prev) => prev.map((l) => {
      if (l.localId !== lineLocalId) return l;
      const sp = l.split_lines.find((s) => s.localId === splitLocalId);
      if (sp?.backendId) pendingDeleteIdsRef.current.add(sp.backendId);
      return { ...l, split_lines: l.split_lines.filter((s) => s.localId !== splitLocalId) };
    }));
    scheduleAutoSave();
  };

  // ── Picker selection ──────────────────────────────────────────────────────

  const handlePickerSelect = async (result: PickerResult) => {
    const ctx = pickerFor;
    if (!ctx) return;
    setPickerFor(null);

    if (ctx.splitLocalId) {
      setLines((prev) => prev.map((l) =>
        l.localId !== ctx.lineLocalId ? l : {
          ...l,
          split_lines: l.split_lines.map((s) =>
            s.localId !== ctx.splitLocalId ? s : {
              ...s, gl_id: result.gl_id, gl_number: result.gl_number, gl_name: result.gl_name,
              dimension_requirements: result.dimension_requirements,
            }
          ),
        }
      ));
      scheduleAutoSave();
      return;
    }

    setLines((prev) => prev.map((l) =>
      l.localId !== ctx.lineLocalId ? l : {
        ...l,
        gl_id: result.gl_id, gl_number: result.gl_number, gl_name: result.gl_name,
        category_id: result.category_id, category_name: result.category_name,
        subcategory_id: result.subcategory_id, subcategory_name: result.subcategory_name,
        dimension_requirements: result.dimension_requirements,
        flag_incorrect: result.flag_incorrect,
        dimension_values: {},
      }
    ));

    if (result.gl_id && accessToken) {
      try {
        const sugg = await apiFetch<SuggestionResponse>(
          `/api/expenses/suggestions?gl_id=${result.gl_id}`,
          { token: accessToken }
        );
        setSuggestions((prev) => ({ ...prev, [ctx.lineLocalId]: sugg }));
        setLines((prev) => prev.map((l) => {
          if (l.localId !== ctx.lineLocalId) return l;
          const dimVals = { ...l.dimension_values };
          for (const [dimId, s] of Object.entries(sugg.dimensions)) {
            if (s.confidence >= 0.80 && !dimVals[dimId]) dimVals[dimId] = s.value_id;
          }
          const desc = !l.description.trim() && sugg.description ? sugg.description : l.description;
          return { ...l, description: desc, dimension_values: dimVals };
        }));
      } catch { /* non-fatal */ }
    }

    scheduleAutoSave();
  };

  // ── File uploads ──────────────────────────────────────────────────────────

  const triggerUpload = (target: string) => {
    uploadTargetRef.current = target;
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const uploadFiles = async (files: File[], target: string) => {
    if (!files.length || !accessToken || !report_id) return;
    const lineId = target !== "report" ? target : null;
    setUploadingFor(target);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      if (lineId) fd.append("line_id", lineId);
      try {
        const doc = await apiFetch<DocumentRecord>(
          `/api/documents/reports/${report_id}/upload`,
          { method: "POST", token: accessToken, body: fd, isFormData: true }
        );
        setDocuments((prev) => [...prev, doc]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      }
    }
    setUploadingFor(null);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !uploadTargetRef.current) return;
    e.target.value = "";
    await uploadFiles(files, uploadTargetRef.current);
  };

  const handleFileDrop = async (e: React.DragEvent, lineId: string | null) => {
    e.preventDefault();
    setDragOverFor(null);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files, lineId || "report");
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/api/documents/${docId}`, { method: "DELETE", token: accessToken });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) { setUploadError(err instanceof Error ? err.message : "Delete failed."); }
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!reportDate) return "Report date is required.";
    if (lines.length === 0) return "At least one expense line is required.";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.description.trim()) return `Line ${i + 1}: Description is required.`;
      if (!l.amount || parseFloat(l.amount) <= 0) return `Line ${i + 1}: Amount must be greater than zero.`;
      if (!l.invoice_date) return `Line ${i + 1}: Invoice date is required.`;
      if (!l.invoice_number.trim()) return `Line ${i + 1}: Invoice number is required.`;
      if (formConfig.coding_level === 1 && !l.subcategory_id) return `Line ${i + 1}: Category and subcategory are required.`;
      if (formConfig.coding_level >= 2 && !l.gl_id) return `Line ${i + 1}: GL account is required.`;
      if (formConfig.show_location && formConfig.require_location && !l.location.trim()) return `Line ${i + 1}: Location is required.`;
      if (l.split_lines.length > 0) {
        const tot = l.split_lines.reduce((s, sl) => s + (parseFloat(sl.amount) || 0), 0);
        if (Math.abs(parseFloat(l.amount) - tot) >= 0.005) return `Line ${i + 1}: Split amounts must equal the line total.`;
      }
    }
    return null;
  };

  // ── Final save helper ─────────────────────────────────────────────────────

  const saveAll = async () => {
    await apiFetch(`/api/expenses/reports/${report_id}`, {
      method: "PATCH", token: accessToken!,
      body: JSON.stringify({ report_date: reportDate, employee_function: employeeFunction || null }),
    });
    for (const bid of pendingDeleteIdsRef.current) {
      try { await apiFetch(`/api/expenses/reports/${report_id}/lines/${bid}`, { method: "DELETE", token: accessToken! }); } catch { /* ignore */ }
    }
    pendingDeleteIdsRef.current.clear();
    for (const l of lines) {
      if (l.backendId) {
        await apiFetch(`/api/expenses/reports/${report_id}/lines/${l.backendId}`, {
          method: "PATCH", token: accessToken!, body: JSON.stringify(mainPayload(l)),
        });
        for (const sp of l.split_lines) {
          if (!(parseFloat(sp.amount) > 0)) continue;
          if (sp.backendId) {
            await apiFetch(`/api/expenses/reports/${report_id}/lines/${sp.backendId}`, {
              method: "PATCH", token: accessToken!,
              body: JSON.stringify({ ...splitPayload(sp, l.backendId, l.description), split_parent_id: l.backendId }),
            });
          } else {
            await apiFetch(`/api/expenses/reports/${report_id}/lines`, {
              method: "POST", token: accessToken!, body: JSON.stringify(splitPayload(sp, l.backendId, l.description)),
            });
          }
        }
      } else {
        const resp = await apiFetch<ApiReport>(`/api/expenses/reports/${report_id}/lines`, {
          method: "POST", token: accessToken!, body: JSON.stringify(mainPayload(l)),
        });
        const saved = resp.lines[resp.lines.length - 1];
        for (const sp of l.split_lines) {
          if (!(parseFloat(sp.amount) > 0)) continue;
          await apiFetch(`/api/expenses/reports/${report_id}/lines`, {
            method: "POST", token: accessToken!, body: JSON.stringify(splitPayload(sp, saved.id, l.description)),
          });
        }
      }
    }
  };

  // ── Button handlers ───────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    const ve = validate();
    if (ve) { setError(ve); return; }
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    await currentSavePromiseRef.current;
    setIsSubmitting(true);
    setError(null);
    try {
      await saveAll();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => s === "saved" ? "idle" : s), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      setError(msg === "Failed to fetch" ? "Cannot reach the server." : msg);
    } finally { setIsSubmitting(false); }
  };

  const handleOpenApproverModal = async () => {
    if (incompleteCount > 0) {
      setSubmitAttempted(true);
      const firstIdx = lines.findIndex((l) => !isComplete(l, formConfig));
      if (firstIdx >= 0) {
        setLines((prev) => prev.map((l, i) => i === firstIdx ? { ...l, is_expanded: true } : l));
        setTimeout(() => {
          document.getElementById(`line-card-${lines[firstIdx].localId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
      return;
    }
    const ve = validate();
    if (ve) { setError(ve); return; }
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    await currentSavePromiseRef.current;
    setError(null);
    setIsSubmitting(true);
    try {
      await saveAll();
      const [matrixData, usersData] = await Promise.all([
        apiFetch<ApprovalMatrix | null>("/api/approvals/matrix", { token: accessToken! }),
        apiFetch<TenantUser[]>("/api/users/tenant", { token: accessToken! }),
      ]);
      if (!matrixData) { setError("Approval matrix not configured. Contact your administrator."); return; }
      setMatrix(matrixData);
      setTenantUsers(usersData.filter((u) => u.id !== user?.id));
      setL1Approver(""); setL2Approver(""); setL3Approver("");
      setApproverError(null);
      setShowApproverModal(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to prepare submission.";
      setError(msg === "Failed to fetch" ? "Cannot reach the server." : msg);
    } finally { setIsSubmitting(false); }
  };

  const handleSubmitWithApprovers = async () => {
    if (!matrix) return;
    setApproverError(null);
    const total = calcTotal(lines);
    const needsL2 = matrix.levels >= 2 && (matrix.amount_threshold_l2 === null || total > parseFloat(matrix.amount_threshold_l2));
    const needsL3 = matrix.levels >= 3 && (matrix.amount_threshold_l3 === null || total > parseFloat(matrix.amount_threshold_l3));
    if (!l1Approver) { setApproverError("Select a Level 1 approver."); return; }
    if (needsL2 && !l2Approver) { setApproverError("Select a Level 2 approver."); return; }
    if (needsL3 && !l3Approver) { setApproverError("Select a Level 3 approver."); return; }
    setIsSubmitting(true);
    try {
      await apiFetch(`/api/approvals/reports/${report_id}/submit`, {
        method: "POST", token: accessToken!,
        body: JSON.stringify({
          level1_approver_id: l1Approver,
          level2_approver_id: needsL2 ? l2Approver : null,
          level3_approver_id: needsL3 ? l3Approver : null,
        }),
      });
      router.push("/dashboard/business/expenses");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit.";
      setApproverError(msg === "Failed to fetch" ? "Cannot reach the server." : msg);
    } finally { setIsSubmitting(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const total = calcTotal(lines);
  const needsL2 = matrix ? matrix.levels >= 2 && (matrix.amount_threshold_l2 === null || total > parseFloat(matrix.amount_threshold_l2)) : false;
  const needsL3 = matrix ? matrix.levels >= 3 && (matrix.amount_threshold_l3 === null || total > parseFloat(matrix.amount_threshold_l3)) : false;
  const incompleteCount = lines.filter((l) => !isComplete(l, formConfig)).length;
  const incompleteLinesIndices = lines.map((l, i) => !isComplete(l, formConfig) ? i + 1 : 0).filter(Boolean);
  const cfg = formConfig;
  const canEdit = ["DRAFT", "REJECTED", "REFERRED_TO_REQUESTOR"].includes(originalStatus);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-sm text-gray-400">Loading report…</div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainer maxWidth="5xl">

      {/* GL Picker */}
      {pickerFor && cfg.coding_level > 0 && (
        <ExpenseItemPicker
          codingLevel={cfg.coding_level}
          categories={cfg.categories}
          onSelect={handlePickerSelect}
          onClose={() => setPickerFor(null)}
          searchGL={doSearchGL}
        />
      )}

      {/* Approver modal */}
      {showApproverModal && matrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Select Approvers</h2>
            <p className="text-sm text-gray-500 mb-4">Choose who should review this report at each level.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{matrix.level1_role} <span className="text-red-500">*</span></label>
                <select value={l1Approver} onChange={(e) => setL1Approver(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select approver…</option>
                  {tenantUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                </select>
              </div>
              {needsL2 && matrix.level2_role && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{matrix.level2_role} <span className="text-red-500">*</span></label>
                  <select value={l2Approver} onChange={(e) => setL2Approver(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select approver…</option>
                    {tenantUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                  </select>
                </div>
              )}
              {needsL3 && matrix.level3_role && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{matrix.level3_role} <span className="text-red-500">*</span></label>
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
              <Button variant="secondary" onClick={() => { setShowApproverModal(false); setApproverError(null); }} disabled={isSubmitting}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmitWithApprovers} disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? "Submitting…" : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">← Back</button>
          <PageHeading title={reportNumber ? `Edit ${reportNumber}` : "Edit Expense Report"} />
          {!canEdit && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              This report is in {originalStatus.replace(/_/g, " ")} status and cannot be edited.
            </p>
          )}
        </div>
        <div className="mt-8 shrink-0 text-right">
          {saveStatus === "saving" && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === "saved" && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
          {saveStatus === "error" && <span className="text-xs text-red-500">Save failed</span>}
        </div>
      </div>

      {/* Rejection banner */}
      {rejectionBanner && (
        <Banner variant="error" className="mb-4">
          <strong>Rejected:</strong> {rejectionBanner}
        </Banner>
      )}

      {error && (
        <Banner variant="error" className="mb-4 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
        </Banner>
      )}

      {uploadError && (
        <Banner variant="error" className="mb-4 flex items-start justify-between gap-3">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="shrink-0 text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
        </Banner>
      )}

      {cfg.coding_level === 0 && (
        <Banner variant="info" className="mb-4">
          GL coding will be assigned by Finance during the approval review.
        </Banner>
      )}

      {/* Report header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Report Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">{user?.full_name ?? "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Function <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={employeeFunction} onChange={(e) => setEmployeeFunction(e.target.value)} onBlur={scheduleAutoSave}
              disabled={!canEdit} placeholder="e.g. Marketing, Finance"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Report Date <span className="text-red-500">*</span></label>
            <input type="date" defaultValue={reportDate} onBlur={(e) => { setReportDate(e.target.value); scheduleAutoSave(); }}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600" />
          </div>
        </div>
      </div>

      {/* Expense lines */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expense Lines</h2>
            {submitAttempted && incompleteLinesIndices.length > 0 && (
              <div className="mt-1 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {incompleteLinesIndices.length} line{incompleteLinesIndices.length !== 1 ? "s" : ""} incomplete — please fill all required fields before submitting
                <br />
                <span className="font-semibold">
                  Line{incompleteLinesIndices.length !== 1 ? "s" : ""} {incompleteLinesIndices.join(", ")}
                </span>
              </div>
            )}
            {!submitAttempted && incompleteCount > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">{incompleteCount} line{incompleteCount !== 1 ? "s" : ""} incomplete</p>
            )}
          </div>
          {canEdit && (
            <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Line</button>
          )}
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const complete = isComplete(line, cfg);
            const activeDims = line.dimension_requirements.filter((r) => r.requirement !== "na");
            const lineSugg = suggestions[line.localId];
            const chipSelected = cfg.coding_level === 1 ? !!line.subcategory_id : !!line.gl_id;
            const hasSplits = line.split_lines.length > 0;
            const lineDocs = documents.filter((d) => d.line_id === line.backendId);
            const hasLineDocs = lineDocs.length > 0;
            // Fix 2: guard against null === null being true before report is saved
            const isUploading = !!line.backendId && uploadingFor === line.backendId;
            const isIncomplete = submitAttempted && !complete;

            return (
              <div key={line.localId} id={`line-card-${line.localId}`}
                className={`rounded-xl border border-gray-200 overflow-hidden ${complete ? "border-l-4 border-l-green-400" : "border-l-4 border-l-amber-400"}`}>

                {/* Card header — compact info row, click to expand/collapse */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white cursor-pointer"
                  onClick={() => toggleExpand(line.localId)}>
                  <span className="text-xs font-bold text-gray-400 shrink-0 w-5">#{idx + 1}</span>

                  {/* Fix 3: GL display (informational only — picker lives in expanded body) */}
                  <div className="flex-1 min-w-0 truncate">
                    {cfg.coding_level === 0 ? (
                      <span className="text-xs text-gray-400 italic">Finance assigns GL</span>
                    ) : hasSplits ? (
                      <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        ⑂ Split ({line.split_lines.length})
                      </span>
                    ) : chipSelected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 truncate max-w-full">
                        <span className="font-mono shrink-0">{line.gl_number}</span>
                        {line.gl_name && <span className="text-blue-500 truncate">— {line.gl_name}</span>}
                        {line.flag_incorrect && <span className="shrink-0 text-amber-500">⚑</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No GL selected</span>
                    )}
                  </div>

                  {/* Amount */}
                  <span className="text-sm font-semibold text-gray-700 shrink-0">
                    {line.amount ? `₦${(parseFloat(line.amount) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "—"}
                  </span>

                  {/* Fix 3: Dimension value pills (hidden on mobile to keep row compact) */}
                  {!hasSplits && activeDims.some((r) => line.dimension_values[r.dimension_id]) && (
                    <div className="hidden sm:flex items-center gap-1 shrink-0 overflow-hidden max-w-28">
                      {activeDims
                        .filter((r) => line.dimension_values[r.dimension_id])
                        .slice(0, 2)
                        .map((r) => {
                          const dim = cfg.dimensions.find((d) => d.id === r.dimension_id);
                          const val = dim?.values.find((v) => v.id === line.dimension_values[r.dimension_id]);
                          return val ? (
                            <span key={r.dimension_id} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {val.code}
                            </span>
                          ) : null;
                        })}
                    </div>
                  )}

                  {/* Paperclip indicator */}
                  <span className={`text-sm shrink-0 ${hasLineDocs ? "text-green-500" : "text-gray-300"}`}
                    title={hasLineDocs ? `${lineDocs.length} document(s) attached` : "No documents"}>
                    📎
                  </span>

                  {/* Expand toggle */}
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleExpand(line.localId); }}
                    className="text-gray-400 hover:text-gray-600 text-xs shrink-0 w-5 text-center">
                    {line.is_expanded ? "▲" : "▼"}
                  </button>
                </div>

                {/* Collapsed summary — description only */}
                {!line.is_expanded && line.description && (
                  <div className="px-9 pb-1.5 text-xs text-gray-500 truncate">
                    {line.description.slice(0, 80)}
                  </div>
                )}

                {/* Expanded body */}
                {line.is_expanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                    <div className="space-y-2.5 mt-2.5">

                      {/* Fix 1 + Fix 4: GL picker in body — hidden when splits exist */}
                      {cfg.coding_level > 0 && !hasSplits && (
                        <div onClick={(e) => e.stopPropagation()}>
                          {chipSelected ? (
                            <div className="flex items-center gap-2">
                              <button type="button"
                                onClick={() => canEdit && setPickerFor({ lineLocalId: line.localId })}
                                disabled={!canEdit}
                                className="flex items-center gap-1.5 px-2.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors truncate flex-1 min-w-0 disabled:opacity-70 disabled:cursor-default"
                                style={{ height: "28px" }}>
                                <span className="truncate">{glChip(line, cfg.coding_level)}</span>
                                {line.flag_incorrect && <span className="shrink-0 text-yellow-300">⚑</span>}
                              </button>
                              {canEdit && (
                                <button type="button" onClick={() => setPickerFor({ lineLocalId: line.localId })}
                                  className="text-xs text-blue-500 hover:text-blue-700 shrink-0">
                                  change
                                </button>
                              )}
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => canEdit && setPickerFor({ lineLocalId: line.localId })}
                              disabled={!canEdit}
                              style={{ height: "36px" }}
                              className={`w-full flex items-center gap-2 px-3 rounded-lg text-[13px] border transition-colors disabled:opacity-70 disabled:cursor-default ${isIncomplete ? "border-red-400 text-red-600 hover:bg-red-50" : "border-blue-400 text-blue-600 hover:bg-blue-50"}`}>
                              🔍 {cfg.coding_level === 1 ? "Select Expense Type" : "Select GL Account"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Amount / Invoice Date / Invoice No */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className={`block text-[11px] font-medium mb-1 ${isIncomplete && (!line.amount || parseFloat(line.amount) <= 0) ? "text-red-600" : "text-gray-600"}`}>
                            Amount (NGN) <span className="text-red-500">*</span>
                          </label>
                          <input type="text" inputMode="decimal"
                            value={fmtCommaInput(line.amount)}
                            disabled={!canEdit}
                            onChange={(e) => {
                              const raw = stripCommas(e.target.value.replace(/[^0-9.,]/g, ""));
                              updateLine(line.localId, { amount: raw });
                              scheduleAutoSave();
                            }}
                            placeholder="0.00"
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 ${isIncomplete && (!line.amount || parseFloat(line.amount) <= 0) ? "border-red-400" : "border-gray-300"}`} />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-medium mb-1 ${isIncomplete && !line.invoice_date ? "text-red-600" : "text-gray-600"}`}>
                            Invoice Date <span className="text-red-500">*</span>
                          </label>
                          <input type="date" defaultValue={line.invoice_date} disabled={!canEdit}
                            onBlur={(e) => { updateLine(line.localId, { invoice_date: e.target.value }); scheduleAutoSave(); }}
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${isIncomplete && !line.invoice_date ? "border-red-400" : "border-gray-300"}`} />
                        </div>
                        <div>
                          <label className={`block text-[11px] font-medium mb-1 ${isIncomplete && !line.invoice_number.trim() ? "text-red-600" : "text-gray-600"}`}>
                            Invoice No. <span className="text-red-500">*</span>
                          </label>
                          <input type="text" value={line.invoice_number} disabled={!canEdit}
                            onChange={(e) => { updateLine(line.localId, { invoice_number: e.target.value }); scheduleAutoSave(); }}
                            placeholder="INV-001"
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${isIncomplete && !line.invoice_number.trim() ? "border-red-400" : "border-gray-300"}`} />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className={`block text-[11px] font-medium mb-1 ${isIncomplete && !line.description.trim() ? "text-red-600" : "text-gray-600"}`}>
                          Description <span className="text-red-500">*</span>
                        </label>
                        <input type="text" value={line.description} disabled={!canEdit}
                          onChange={(e) => { updateLine(line.localId, { description: e.target.value }); scheduleAutoSave(); }}
                          placeholder="What was this expense for?"
                          className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 ${isIncomplete && !line.description.trim() ? "border-red-400" : "border-gray-300"}`} />
                      </div>

                      {/* Location */}
                      {cfg.show_location && (
                        <div>
                          <label className={`block text-[11px] font-medium mb-1 ${isIncomplete && cfg.require_location && !line.location.trim() ? "text-red-600" : "text-gray-600"}`}>
                            Location{cfg.require_location && <span className="text-red-500"> *</span>}
                          </label>
                          <input type="text" value={line.location} disabled={!canEdit}
                            onChange={(e) => { updateLine(line.localId, { location: e.target.value }); scheduleAutoSave(); }}
                            placeholder="e.g. Lagos"
                            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${isIncomplete && cfg.require_location && !line.location.trim() ? "border-red-400" : "border-gray-300"}`} />
                        </div>
                      )}

                      {/* Level-2 flag comment */}
                      {cfg.coding_level === 2 && line.flag_incorrect && (
                        <div>
                          <label className="block text-[11px] font-medium text-amber-700 mb-1">Why is the GL incorrect? <span className="text-red-500">*</span></label>
                          <input type="text" value={line.flag_comment} disabled={!canEdit}
                            onChange={(e) => { updateLine(line.localId, { flag_comment: e.target.value }); scheduleAutoSave(); }}
                            placeholder="Briefly explain the issue"
                            className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50" />
                        </div>
                      )}

                      {/* Dimension dropdowns — hidden when splits exist */}
                      {!hasSplits && activeDims.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {activeDims.map((req) => {
                            const dim = cfg.dimensions.find((d) => d.id === req.dimension_id);
                            if (!dim) return null;
                            const sugg = lineSugg?.dimensions[req.dimension_id];
                            const today = new Date().toISOString().slice(0, 10);
                            // Filter by validity period
                            const activeValues = dim.values.filter((v) =>
                              (!v.valid_from || v.valid_from <= today) &&
                              (!v.valid_to || v.valid_to >= today)
                            );
                            // Filter by accepted_value_types if set
                            const filteredValues = dim.accepted_value_types
                              ? activeValues.filter((v) =>
                                  !v.value_type || dim.accepted_value_types!.split(",").map((t) => t.trim()).includes(v.value_type)
                                )
                              : activeValues;
                            const showPill = sugg && sugg.confidence >= 0.40 && sugg.confidence < 0.80 && !line.dimension_values[req.dimension_id];
                            const pillLabel = filteredValues.find((v) => v.id === sugg?.value_id)?.code;
                            const missingRequired = isIncomplete && req.requirement === "required" && !line.dimension_values[req.dimension_id];
                            return (
                              <div key={req.dimension_id}>
                                <label className={`block text-[11px] font-medium mb-1 ${missingRequired ? "text-red-600" : "text-gray-600"}`}>
                                  {dim.name}{req.requirement === "required" && <span className="text-red-500"> *</span>}
                                </label>
                                <select disabled={!canEdit}
                                  value={line.dimension_values[req.dimension_id] ?? ""}
                                  onChange={(e) => {
                                    const selectedValueId = e.target.value;
                                    const newDimValues = { ...line.dimension_values, [req.dimension_id]: selectedValueId };
                                    // Auto-fill cascade target
                                    if (selectedValueId) {
                                      const selectedVal = dim.values.find((v) => v.id === selectedValueId);
                                      if (selectedVal?.cascade_dimension_id && selectedVal?.cascade_value_id) {
                                        newDimValues[selectedVal.cascade_dimension_id] = selectedVal.cascade_value_id;
                                      }
                                    }
                                    updateLine(line.localId, { dimension_values: newDimValues });
                                    scheduleAutoSave();
                                  }}
                                  className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${missingRequired ? "border-red-400" : "border-gray-300"}`}>
                                  <option value="">Select…</option>
                                  {filteredValues.map((v) => (
                                    <option key={v.id} value={v.id}>{v.code} — {v.name}</option>
                                  ))}
                                </select>
                                {showPill && pillLabel && canEdit && (
                                  <button type="button"
                                    onClick={() => {
                                      updateLine(line.localId, { dimension_values: { ...line.dimension_values, [req.dimension_id]: sugg!.value_id } });
                                      scheduleAutoSave();
                                    }}
                                    className="mt-1 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors">
                                    Last used: {pillLabel}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Split lines panel */}
                      {hasSplits && (
                        <SplitLinePanel
                          parentAmount={parseFloat(line.amount) || 0}
                          splitLines={line.split_lines}
                          onAddSplit={() => addSplitLine(line.localId)}
                          onUpdateSplit={(splitId, updates) => updateSplitLine(line.localId, splitId, updates)}
                          onRemoveSplit={(splitId) => removeSplitLine(line.localId, splitId)}
                          dimensions={cfg.dimensions}
                          onPickGL={(splitId) => setPickerFor({ lineLocalId: line.localId, splitLocalId: splitId })}
                        />
                      )}

                      {/* Footer: upload zone + split button + remove */}
                      <div className="flex items-start gap-3 pt-1.5 border-t border-gray-100">
                        {/* Drag-drop upload zone */}
                        <div className="flex-1 min-w-0">
                          {lineDocs.length > 0 && (
                            <div className="space-y-0.5 mb-1.5">
                              {lineDocs.map((doc) => (
                                <div key={doc.id} className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className="text-gray-400">📎</span>
                                  <span className="flex-1 truncate">{doc.file_name}</span>
                                  <span className="text-gray-400 shrink-0 text-[10px]">{fmtBytes(doc.file_size)}</span>
                                  {doc.signed_url && (
                                    <a href={doc.signed_url} target="_blank" rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 shrink-0">View</a>
                                  )}
                                  {canEdit && (
                                    <button type="button" onClick={() => handleDeleteDocument(doc.id)}
                                      className="text-red-400 hover:text-red-600 shrink-0">×</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {canEdit && (
                            <div
                              onDragOver={(e) => { e.preventDefault(); setDragOverFor(`line-${line.localId}`); }}
                              onDragLeave={() => setDragOverFor(null)}
                              onDrop={(e) => handleFileDrop(e, line.backendId)}
                              onClick={() => line.backendId && triggerUpload(line.backendId)}
                              title={!line.backendId ? "Save the report first to attach documents" : undefined}
                              className={`flex flex-col items-center justify-center gap-0.5 border-2 border-dashed rounded-lg transition-colors h-12 select-none
                                ${!line.backendId ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                                ${dragOverFor === `line-${line.localId}` ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}>
                              {isUploading ? (
                                <span className="text-[10px] text-gray-400">Uploading…</span>
                              ) : (
                                <>
                                  <span className="text-sm leading-none">📎</span>
                                  <span className="text-[10px] text-gray-400 text-center">Drop file or click to upload</span>
                                </>
                              )}
                            </div>
                          )}
                          {!canEdit && lineDocs.length === 0 && (
                            <span className="text-[10px] text-gray-400">No documents attached</span>
                          )}
                        </div>

                        {/* Split + Remove buttons */}
                        {canEdit && (
                          <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                            {!hasSplits && chipSelected && (parseFloat(line.amount) || 0) > 0 && (
                              <button type="button" onClick={() => addSplitLine(line.localId)}
                                className="text-xs font-medium text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded px-1.5 py-0.5 whitespace-nowrap">
                                ⑂ Split
                              </button>
                            )}
                            <button type="button" onClick={() => removeLine(line.localId)} disabled={lines.length === 1}
                              className="text-xs text-red-400 hover:text-red-600 disabled:text-gray-300 font-medium whitespace-nowrap">
                              Remove Line
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grand total */}
        {lines.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="text-right">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-4">Grand Total</span>
              <span className="text-lg font-bold text-gray-900">{fmtTotal(lines)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc"
        onChange={handleFileSelected} />

      {/* Report-level documents */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Report Documents</h2>
        <p className="text-xs text-gray-400 mb-4">Documents that apply to the whole report.</p>
        {(() => {
          const reportDocs = documents.filter((d) => d.line_id === null);
          const isUp = uploadingFor === "report";
          return (
            <>
              {reportDocs.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {reportDocs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 text-xs text-gray-700">
                      <FileIcon mime={doc.mime_type} />
                      <span className="flex-1 truncate">{doc.file_name}</span>
                      <span className="text-gray-400 shrink-0">{fmtBytes(doc.file_size)}</span>
                      {doc.signed_url && <a href={doc.signed_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 shrink-0">View</a>}
                      {canEdit && <button type="button" onClick={() => handleDeleteDocument(doc.id)} className="text-red-400 hover:text-red-600 shrink-0">×</button>}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverFor("report"); }}
                  onDragLeave={() => setDragOverFor(null)}
                  onDrop={(e) => handleFileDrop(e, null)}
                  onClick={() => triggerUpload("report")}
                  className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg cursor-pointer transition-colors p-4 text-center
                    ${dragOverFor === "report" ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"}`}>
                  {isUp ? (
                    <span className="text-xs text-gray-400">Uploading…</span>
                  ) : (
                    <>
                      <span className="text-base">📎</span>
                      <span className="text-xs text-gray-500">Drop files or click to upload — applies to the whole report</span>
                    </>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Action buttons */}
      {canEdit && (
        <div className="flex items-center gap-3 justify-end">
          <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={isSubmitting} loading={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Draft"}
          </Button>
          <Button variant="primary" onClick={handleOpenApproverModal} disabled={isSubmitting} loading={isSubmitting}>
            {isSubmitting ? "Preparing…" : incompleteCount > 0 ? `Submit (${incompleteCount} incomplete)` : "Submit for Approval"}
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
