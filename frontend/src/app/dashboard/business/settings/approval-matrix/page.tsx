"use client";

/**
 * Approval Workflows — /dashboard/business/settings/approval-matrix
 *
 * Designation hierarchy tab: read-only view of org roles by designation level.
 * Module policies tab: per-module routing config + finance review step builder.
 *
 * Changes from original:
 * - selectedDesignations state + selective_tree routing mode UI
 * - Finance step step_type is now an open text field (+ datalist suggestions);
 *   label is fully decoupled — changing the behavior tag no longer overwrites it.
 * - function_code per step: links a step to a SystemFunctionMapping; the assignee
 *   picker is then filtered to users mapped to that function.
 * - Thresholds state is isolated from routing mode — switching modes does not wipe
 *   the designation thresholds the user has configured.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

type Tab = "roles" | "policies";

const DESIGNATIONS = [
  { value: "individual_contributor", label: "Individual Contributor", short: "IC",  desc: "Regular staff — submitters only",            color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "team_lead",              label: "Team Lead",              short: "TL",  desc: "First line of approval",                    color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "manager",                label: "Manager",                short: "MGR", desc: "Mid-level approver",                        color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "head_of_department",     label: "Head of Department",     short: "HoD", desc: "Department ceiling",                        color: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "head_of_entity",         label: "Head of Entity",         short: "HoE", desc: "Top-level approver (GM / MD / CEO)",        color: "bg-amber-100 text-amber-700 border-amber-200" },
] as const;

type DesignationValue = typeof DESIGNATIONS[number]["value"];

// Designation levels eligible to appear in an approval chain (no IC)
const APPROVER_DESIGNATIONS = DESIGNATIONS.filter(d => d.value !== "individual_contributor");

function desigMeta(v: string | null | undefined) {
  return DESIGNATIONS.find(d => d.value === v) ?? null;
}

// ── Suggested step behaviors (open — tenants may use any string) ──────────────
const STEP_BEHAVIORS = [
  { value: "capture",        label: "Document Intake",       color: "bg-gray-100 text-gray-700 border-gray-300",       desc: "Capture, file, mark received" },
  { value: "validate",       label: "GL & Doc Validation",   color: "bg-blue-100 text-blue-700 border-blue-300",       desc: "Check completeness, validate GL codes" },
  { value: "internal_audit", label: "Internal Audit Review", color: "bg-orange-100 text-orange-700 border-orange-300", desc: "Audit check — policy compliance, retire eligibility" },
  { value: "review",         label: "Controller Review",     color: "bg-indigo-100 text-indigo-700 border-indigo-300", desc: "Second-level sign-off, payment collation" },
  { value: "approve",        label: "FD Approval",           color: "bg-green-100 text-green-700 border-green-300",    desc: "Final finance approval — releases GL post & payment" },
];

function behaviorMeta(v: string) {
  return STEP_BEHAVIORS.find(b => b.value === v) ?? null;
}
function behaviorColor(v: string) {
  return behaviorMeta(v)?.color ?? "bg-gray-100 text-gray-700 border-gray-300";
}

interface OrgRole {
  id: string;
  name: string;
  designation: string | null;
  cost_center_name: string | null;
  area: string | null;
  employment_type: string | null;
  occupants: { id: string; full_name: string; initials: string }[];
}

interface ThresholdRow { designation: string; max_amount: string; }

interface SelectiveDesig { designation: string; role: "approve" | "review"; }

interface ApprovalPolicy {
  id: string; module: string; routing_mode: string;
  selected_designations: SelectiveDesig[] | null;
  ceiling_designation: string | null;
  finance_l1_designation: string | null; finance_l2_designation: string | null; finance_l3_designation: string | null;
  vacant_seat_behavior: string; fallback_approver_id: string | null;
  requires_finance_review: boolean; finance_levels: number;
  finance_amount_threshold_l2: string | null; finance_amount_threshold_l3: string | null;
  is_active: boolean;
  thresholds: { id: string; designation: string | null; max_amount: string | null }[];
}

interface EmployeeOption { id: string; first_name: string; last_name: string; approval_role_id: string | null; user_id: string | null; }

interface FunctionMapping { id: string; code: string; name: string; description: string | null; user_id: string | null; }
interface FunctionOption  { code: string; name: string; user_ids: string[]; }

interface FinanceStep {
  _key: string; id?: string; level: number;
  step_type: string;   // open — any non-empty string
  label: string;       // display name — fully independent from step_type
  function_code: string;
  assigned_employee_id: string; assigned_designation: string; min_amount: string;
  can_send_back: boolean; can_correct_gl: boolean; is_required: boolean;
  instructions: string; showInstructions: boolean;
}

function makeStep(level: number, type: string, label: string): FinanceStep {
  return {
    _key: `${Date.now()}-${Math.random()}`, level, step_type: type, label,
    function_code: "",
    assigned_employee_id: "", assigned_designation: "", min_amount: "",
    can_send_back: true, can_correct_gl: type === "validate", is_required: true,
    instructions: "", showInstructions: false,
  };
}

const DEFAULT_STEPS: Omit<FinanceStep, "_key">[] = [
  { level: 1, step_type: "capture",  label: "Document Intake",           function_code: "", assigned_employee_id: "", assigned_designation: "", min_amount: "", can_send_back: false, can_correct_gl: false, is_required: true,  instructions: "", showInstructions: false },
  { level: 2, step_type: "validate", label: "GL & Document Validation",  function_code: "", assigned_employee_id: "", assigned_designation: "", min_amount: "", can_send_back: true,  can_correct_gl: true,  is_required: true,  instructions: "Verify all receipts are attached. Correct GL codes if needed.", showInstructions: false },
  { level: 3, step_type: "review",   label: "Controller Review",          function_code: "", assigned_employee_id: "", assigned_designation: "", min_amount: "", can_send_back: true,  can_correct_gl: false, is_required: true,  instructions: "", showInstructions: false },
  { level: 4, step_type: "approve",  label: "Finance Director Approval",  function_code: "", assigned_employee_id: "", assigned_designation: "", min_amount: "", can_send_back: true,  can_correct_gl: false, is_required: true,  instructions: "", showInstructions: false },
];

const MODULE_POLICIES = [
  { key: "expense",    label: "Expense Management",  icon: "ti-receipt",       active: true  },
  { key: "payable",    label: "Accounts Payable",    icon: "ti-building-bank", active: false },
  { key: "receivable", label: "Accounts Receivable", icon: "ti-cash",          active: false },
  { key: "payroll",    label: "Payroll",              icon: "ti-users",         active: false },
  { key: "budget",     label: "Budget",               icon: "ti-chart-bar",    active: false },
];

const ROUTING_MODES = [
  { value: "org_tree",          label: "Org-tree traversal",           desc: "Auto-route up the reporting hierarchy. Designation thresholds control escalation." },
  { value: "selective_tree",    label: "Selective org-tree",           desc: "Like org-tree, but you choose which designation levels participate in the chain." },
  { value: "requestor_selects", label: "Requestor selects approver",   desc: "Submitter picks their approver. System validates they are above them in hierarchy." },
  { value: "direct_to_hod",     label: "Direct to Head of Department", desc: "Skip intermediate managers — route straight to the HoD." },
];

const VACANT_OPTIONS = [
  { value: "skip",                 label: "Skip — bypass and continue" },
  { value: "hold",                 label: "Hold — pause until seat is filled" },
  { value: "escalate_to_fallback", label: "Escalate to fallback approver" },
];

function groupByCostCenter(roles: OrgRole[]) {
  const m = new Map<string, OrgRole[]>();
  for (const r of roles) {
    const k = r.cost_center_name || r.area || "Other";
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return Array.from(m.entries()).map(([cc, ccRoles]) => ({ cc, ccRoles }));
}

function TabBtn({ id, active, onClick, label }: { id: Tab; active: boolean; onClick: (t: Tab) => void; label: string }) {
  return (
    <button type="button" onClick={() => onClick(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
      {label}
    </button>
  );
}

function DesigBadge({ value }: { value: string | null | undefined }) {
  const m = desigMeta(value);
  if (!m) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${m.color}`}>
      <span className="font-bold text-[10px]">{m.short}</span>{m.label}
    </span>
  );
}

function DesigSelect({ value, onChange, placeholder, includeIC }: {
  value: string; onChange: (v: string) => void; placeholder?: string; includeIC?: boolean;
}) {
  const opts = includeIC ? DESIGNATIONS : APPROVER_DESIGNATIONS;
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
      <option value="">{placeholder ?? "— Select designation —"}</option>
      {opts.map(d => <option key={d.value} value={d.value}>{d.label} ({d.short})</option>)}
    </select>
  );
}

export default function ApprovalWorkflowsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("roles");
  const [error, setError] = useState<string | null>(null);

  const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>("expense");

  // ── Routing config state (isolated — changing routingMode does not wipe thresholds) ──
  const [routingMode, setRoutingMode] = useState("org_tree");
  const [selectedDesignations, setSelectedDesignations] = useState<SelectiveDesig[]>([]);
  const [ceilingDesig, setCeilingDesig] = useState("");
  const [vacantBehavior, setVacantBehavior] = useState("skip");
  const [fallbackApproverId, setFallbackApproverId] = useState("");
  const [requiresFinanceReview, setRequiresFinanceReview] = useState(false);
  const [financeLevels, setFinanceLevels] = useState<0|1|2|3>(0);
  const [finL1Desig, setFinL1Desig] = useState("");
  const [finL2Desig, setFinL2Desig] = useState("");
  const [finL3Desig, setFinL3Desig] = useState("");
  const [financeThreshL2, setFinanceThreshL2] = useState("");
  const [financeThreshL3, setFinanceThreshL3] = useState("");
  const [thresholds, setThresholds] = useState<ThresholdRow[]>([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaved, setPolicySaved] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [functionOptions, setFunctionOptions] = useState<FunctionOption[]>([]);
  const [currentPolicyId, setCurrentPolicyId] = useState<string | null>(null);

  const [financeSteps, setFinanceSteps] = useState<FinanceStep[]>([]);
  const [loadingFinanceSteps, setLoadingFinanceSteps] = useState(false);
  const [savingFinanceSteps, setSavingFinanceSteps] = useState(false);
  const [financeStepsSaved, setFinanceStepsSaved] = useState(false);
  const [financeStepsError, setFinanceStepsError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    if (!accessToken) return;
    setLoadingRoles(true);
    try {
      const data = await apiFetch<OrgRole[]>("/api/approvals/roles", { token: accessToken });
      setOrgRoles(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load roles"); }
    finally { setLoadingRoles(false); }
  }, [accessToken]);

  const loadFinanceStepsById = useCallback(async (policyId: string) => {
    if (!accessToken) return;
    setLoadingFinanceSteps(true);
    try {
      type SR = {
        id: string; level: number; step_type: string; label: string; function_code: string | null;
        assigned_employee_id: string | null; assigned_designation: string | null;
        min_amount: number | null; can_send_back: boolean; can_correct_gl: boolean;
        is_required: boolean; instructions: string | null;
      };
      const data = await apiFetch<SR[]>(`/api/approvals/policies/${policyId}/finance-steps`, { token: accessToken });
      if (data.length === 0) {
        setFinanceSteps(DEFAULT_STEPS.map(s => ({ ...s, _key: `${Date.now()}-${Math.random()}` })));
      } else {
        setFinanceSteps(data.map(s => ({
          _key: s.id, id: s.id, level: s.level, step_type: s.step_type, label: s.label,
          function_code: s.function_code ?? "",
          assigned_employee_id: s.assigned_employee_id ?? "",
          assigned_designation: s.assigned_designation ?? "",
          min_amount: s.min_amount != null ? String(s.min_amount) : "",
          can_send_back: s.can_send_back, can_correct_gl: s.can_correct_gl,
          is_required: s.is_required, instructions: s.instructions ?? "",
          showInstructions: !!(s.instructions),
        })));
      }
    } catch { /* non-fatal */ }
    finally { setLoadingFinanceSteps(false); }
  }, [accessToken]);

  const loadPolicies = useCallback(async () => {
    if (!accessToken) return;
    setLoadingPolicies(true);
    try {
      const [data, emps, funcs] = await Promise.all([
        apiFetch<ApprovalPolicy[]>("/api/approvals/policies", { token: accessToken }),
        apiFetch<EmployeeOption[]>("/api/hr/employees?active_only=true", { token: accessToken }).catch(() => [] as EmployeeOption[]),
        apiFetch<FunctionMapping[]>("/api/setup/functions", { token: accessToken }).catch(() => [] as FunctionMapping[]),
      ]);
      setPolicies(data);
      setEmployeeOptions(emps);

      // Build function options: group by code
      const funcMap = new Map<string, FunctionOption>();
      for (const f of funcs) {
        if (!funcMap.has(f.code)) funcMap.set(f.code, { code: f.code, name: f.name, user_ids: [] });
        if (f.user_id) funcMap.get(f.code)!.user_ids.push(f.user_id);
      }
      setFunctionOptions(Array.from(funcMap.values()));

      const ep = data.find(p => p.module === "expense");
      if (ep) {
        setCurrentPolicyId(ep.id);
        setRoutingMode(ep.routing_mode);
        setSelectedDesignations(ep.selected_designations ?? []);
        setCeilingDesig(ep.ceiling_designation ?? "");
        setVacantBehavior(ep.vacant_seat_behavior);
        setFallbackApproverId(ep.fallback_approver_id ?? "");
        setRequiresFinanceReview(ep.requires_finance_review);
        setFinanceLevels(ep.finance_levels as 0|1|2|3);
        setFinL1Desig(ep.finance_l1_designation ?? "");
        setFinL2Desig(ep.finance_l2_designation ?? "");
        setFinL3Desig(ep.finance_l3_designation ?? "");
        setFinanceThreshL2(ep.finance_amount_threshold_l2 ?? "");
        setFinanceThreshL3(ep.finance_amount_threshold_l3 ?? "");
        setThresholds(ep.thresholds.filter(t => t.designation).map(t => ({ designation: t.designation!, max_amount: t.max_amount ?? "" })));
        loadFinanceStepsById(ep.id);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load policies"); }
    finally { setLoadingPolicies(false); }
  }, [accessToken, loadFinanceStepsById]);

  useEffect(() => { if (tab === "roles") loadRoles(); }, [tab, loadRoles]);
  useEffect(() => { if (tab === "policies") { loadRoles(); loadPolicies(); } }, [tab, loadRoles, loadPolicies]);

  // ── Threshold helpers ─────────────────────────────────────────────────────
  const addThresholdRow = (desig: string) => {
    if (!desig || thresholds.some(t => t.designation === desig)) return;
    setThresholds(prev => [...prev, { designation: desig, max_amount: "" }]);
  };
  const updateThresholdAmount = (desig: string, amount: string) =>
    setThresholds(prev => prev.map(t => t.designation === desig ? { ...t, max_amount: amount } : t));
  const removeThreshold = (desig: string) =>
    setThresholds(prev => prev.filter(t => t.designation !== desig));

  // ── Selective-tree helpers ────────────────────────────────────────────────
  const toggleSelectiveDesig = (designation: string) => {
    setSelectedDesignations(prev => {
      const exists = prev.find(d => d.designation === designation);
      if (exists) return prev.filter(d => d.designation !== designation);
      return [...prev, { designation, role: "approve" }];
    });
  };
  const setSelectiveDesigRole = (designation: string, role: "approve" | "review") => {
    setSelectedDesignations(prev =>
      prev.map(d => d.designation === designation ? { ...d, role } : d)
    );
  };

  // ── Policy save ───────────────────────────────────────────────────────────
  const savePolicy = async (module: string) => {
    if (!accessToken) return;
    setSavingPolicy(true); setError(null);
    try {
      const body = {
        module,
        routing_mode: routingMode,
        selected_designations: routingMode === "selective_tree" ? selectedDesignations : null,
        ceiling_designation: routingMode === "org_tree" ? (ceilingDesig || null) : null,
        vacant_seat_behavior: vacantBehavior,
        fallback_approver_id: vacantBehavior === "escalate_to_fallback" ? (fallbackApproverId || null) : null,
        requires_finance_review: requiresFinanceReview,
        finance_levels: requiresFinanceReview ? financeLevels : 0,
        finance_l1_designation: requiresFinanceReview && financeLevels >= 1 ? (finL1Desig || null) : null,
        finance_l2_designation: requiresFinanceReview && financeLevels >= 2 ? (finL2Desig || null) : null,
        finance_l3_designation: requiresFinanceReview && financeLevels >= 3 ? (finL3Desig || null) : null,
        finance_amount_threshold_l2: requiresFinanceReview && financeLevels >= 2 && financeThreshL2 ? parseFloat(financeThreshL2) : null,
        finance_amount_threshold_l3: requiresFinanceReview && financeLevels >= 3 && financeThreshL3 ? parseFloat(financeThreshL3) : null,
        thresholds: thresholds.map(t => ({ designation: t.designation, max_amount: t.max_amount ? parseFloat(t.max_amount) : null })),
      };
      const saved = await apiFetch<ApprovalPolicy>("/api/approvals/policies", { method: "POST", token: accessToken, body });
      setPolicies(prev => {
        const existing = prev.find(p => p.module === module);
        return existing ? prev.map(p => p.module === module ? saved : p) : [...prev, saved];
      });
      if (saved.id) setCurrentPolicyId(saved.id);
      setPolicySaved(true); setTimeout(() => setPolicySaved(false), 2500);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save policy"); }
    finally { setSavingPolicy(false); }
  };

  // ── Finance steps save ────────────────────────────────────────────────────
  const saveFinanceSteps = async () => {
    if (!accessToken || !currentPolicyId) {
      setFinanceStepsError("Save the routing config first."); return;
    }
    for (const s of financeSteps) {
      if (!s.label.trim()) { setFinanceStepsError("All steps must have a label."); return; }
      if (!s.step_type.trim()) { setFinanceStepsError(`Step "${s.label}" needs a behavior tag.`); return; }
      if (!s.assigned_employee_id && !s.assigned_designation) {
        setFinanceStepsError(`Step "${s.label}" needs an assignee.`); return;
      }
    }
    setSavingFinanceSteps(true); setFinanceStepsError(null);
    try {
      type SR = {
        id: string; level: number; step_type: string; label: string; function_code: string | null;
        assigned_employee_id: string | null; assigned_designation: string | null;
        min_amount: number | null; can_send_back: boolean; can_correct_gl: boolean;
        is_required: boolean; instructions: string | null;
      };
      const body = {
        steps: financeSteps.map((s, idx) => ({
          level: idx + 1,
          step_type: s.step_type.trim(),
          label: s.label.trim(),
          function_code: s.function_code || null,
          assigned_employee_id: s.assigned_employee_id || null,
          assigned_designation: s.assigned_designation || null,
          min_amount: s.min_amount ? parseFloat(s.min_amount) : null,
          can_send_back: s.can_send_back,
          can_correct_gl: s.can_correct_gl,
          is_required: s.is_required,
          instructions: s.instructions.trim() || null,
        })),
      };
      const saved = await apiFetch<SR[]>(`/api/approvals/policies/${currentPolicyId}/finance-steps`,
        { method: "PUT", token: accessToken, body });
      setFinanceSteps(saved.map(s => ({
        _key: s.id, id: s.id, level: s.level, step_type: s.step_type, label: s.label,
        function_code: s.function_code ?? "",
        assigned_employee_id: s.assigned_employee_id ?? "",
        assigned_designation: s.assigned_designation ?? "",
        min_amount: s.min_amount != null ? String(s.min_amount) : "",
        can_send_back: s.can_send_back, can_correct_gl: s.can_correct_gl,
        is_required: s.is_required, instructions: s.instructions ?? "",
        showInstructions: !!(s.instructions),
      })));
      setFinanceStepsSaved(true); setTimeout(() => setFinanceStepsSaved(false), 2500);
    } catch (e) { setFinanceStepsError(e instanceof Error ? e.message : "Failed to save finance steps"); }
    finally { setSavingFinanceSteps(false); }
  };

  // ── Step helpers ──────────────────────────────────────────────────────────
  const updateStep = (key: string, patch: Partial<FinanceStep>) =>
    setFinanceSteps(prev => prev.map(s => s._key === key ? { ...s, ...patch } : s));
  const removeStep = (key: string) =>
    setFinanceSteps(prev => prev.filter(s => s._key !== key).map((s, i) => ({ ...s, level: i + 1 })));
  const moveStep = (key: string, dir: -1 | 1) => {
    setFinanceSteps(prev => {
      const idx = prev.findIndex(s => s._key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((s, i) => ({ ...s, level: i + 1 }));
    });
  };
  const addStep = () => {
    const nextType = "review";
    const nextLabel = "Review Step";
    setFinanceSteps(prev => [...prev, makeStep(prev.length + 1, nextType, nextLabel)]);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isConfigured = (module: string) => policies.some(p => p.module === module && p.is_active);

  // For a given step's function_code, return filtered employee list
  const filteredEmployees = (step: FinanceStep): EmployeeOption[] => {
    if (!step.function_code) return employeeOptions;
    const func = functionOptions.find(f => f.code === step.function_code);
    if (!func || func.user_ids.length === 0) return [];
    return employeeOptions.filter(e => e.user_id && func.user_ids.includes(e.user_id));
  };

  return (
    <PageContainer maxWidth="3xl">
      <button type="button" onClick={() => window.history.length > 1 ? router.back() : router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4">
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />Back
      </button>
      <PageHeading title="Approval workflows" />
      <p className="text-sm text-gray-500 mb-6">Configure designation-based approval routing and finance review chains.</p>

      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <TabBtn id="roles"    active={tab === "roles"}    onClick={setTab} label="Designation hierarchy" />
        <TabBtn id="policies" active={tab === "policies"} onClick={setTab} label="Module policies" />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* ── Designation hierarchy tab ───────────────────────────────────── */}
      {tab === "roles" && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            Approval routing is based on designation levels. To change a role&apos;s designation, edit it in{" "}
            <button type="button" onClick={() => router.push("/dashboard/business/setup/organisation?tab=structure")} className="underline font-medium">
              Organisation → Structure
            </button>.
          </div>

          {loadingRoles ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
          ) : (() => {
            const nonStaffRoles = orgRoles.filter(r => r.employment_type === "contract" || r.employment_type === "outsourced");
            const permanentByDesig = new Map<string, OrgRole[]>();
            for (const r of orgRoles) {
              if (r.employment_type === "contract" || r.employment_type === "outsourced") continue;
              const k = r.designation ?? "unassigned";
              if (!permanentByDesig.has(k)) permanentByDesig.set(k, []);
              permanentByDesig.get(k)!.push(r);
            }
            const RoleChip = ({ r }: { r: OrgRole }) => (
              <span className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-xs text-gray-700 w-fit whitespace-nowrap">
                <span className="font-medium">{r.name}</span>
                {r.area && r.area !== r.cost_center_name && <span className="text-[10px] text-gray-400 border-l border-gray-200 pl-1">{r.area}</span>}
                {r.occupants.length > 0 && <span className="ml-0.5 text-[10px] bg-white border border-gray-200 text-gray-500 rounded px-1">{r.occupants.length}</span>}
              </span>
            );
            const CostCenterBody = ({ roles, borderColor }: { roles: OrgRole[]; borderColor?: string }) => {
              const groups = groupByCostCenter(roles);
              return (
                <div className="px-4 py-3 bg-white border-t" style={{ borderColor: borderColor ?? "#f3f4f6", columns: 3, columnGap: "1rem" }}>
                  {groups.map(({ cc, ccRoles }) => (
                    <div key={cc} style={{ breakInside: "avoid", marginBottom: "0.625rem" }}>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{cc}</p>
                      <div className="flex flex-col gap-0.5">{ccRoles.map(r => <RoleChip key={r.id} r={r} />)}</div>
                    </div>
                  ))}
                </div>
              );
            };
            return (
              <div className="space-y-2">
                {[...DESIGNATIONS].reverse().map((d) => {
                  const roles = permanentByDesig.get(d.value) ?? [];
                  return (
                    <div key={d.value} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${d.color}`}>{d.short}</span>
                          <span className="text-sm font-medium text-gray-800">{d.label}</span>
                          <span className="text-xs text-gray-400">{d.desc}</span>
                        </div>
                        <span className="text-xs text-gray-400">{roles.length} role{roles.length !== 1 ? "s" : ""}</span>
                      </div>
                      {roles.length > 0
                        ? <CostCenterBody roles={roles} />
                        : <p className="px-4 py-2 text-xs text-gray-400 italic">No roles at this designation level yet.</p>}
                    </div>
                  );
                })}
                <div className="border border-dashed border-orange-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between bg-orange-50">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-orange-100 text-orange-700 border-orange-200">NS</span>
                      <span className="text-sm font-medium text-gray-800">Non-Staff</span>
                      <span className="text-xs text-gray-400">Contract &amp; outsourced roles</span>
                    </div>
                    <span className="text-xs text-gray-400">{nonStaffRoles.length} role{nonStaffRoles.length !== 1 ? "s" : ""}</span>
                  </div>
                  {nonStaffRoles.length > 0
                    ? <CostCenterBody roles={nonStaffRoles} borderColor="#fed7aa" />
                    : <p className="px-4 py-2 text-xs text-gray-400 italic">No contract or outsourced roles defined yet.</p>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Module policies tab ─────────────────────────────────────────── */}
      {tab === "policies" && (
        <div className="space-y-3">
          {loadingPolicies ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse"/>)}</div>
          ) : (
            MODULE_POLICIES.map(mod => {
              const isActive = mod.active;
              const configured = isConfigured(mod.key);
              const isExpanded = expandedModule === mod.key;
              return (
                <div key={mod.key} className={`border rounded-lg overflow-hidden ${!isActive ? "opacity-50" : ""}`}>
                  <button type="button" disabled={!isActive}
                    onClick={() => setExpandedModule(isExpanded ? null : mod.key)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <i className={`ti ${mod.icon} text-gray-500`} style={{ fontSize: 15 }} />
                      <span className="text-sm font-medium text-gray-800">{mod.label}</span>
                      {!isActive && <span className="text-[10px] bg-gray-200 text-gray-500 rounded px-1.5 py-0.5">Coming soon</span>}
                      {isActive && configured && <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded px-1.5 py-0.5">Configured</span>}
                      {isActive && !configured && <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Not configured</span>}
                    </div>
                    <i className={`ti ti-chevron-${isExpanded ? "up" : "down"} text-gray-400`} style={{ fontSize: 13 }} />
                  </button>

                  {isExpanded && isActive && mod.key === "expense" && (
                    <div className="px-5 py-4 space-y-5 border-t border-gray-200">

                      {/* ── Routing mode ──────────────────────────────────── */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Routing mode</p>
                        <div className="space-y-2">
                          {ROUTING_MODES.map(rm => (
                            <label key={rm.value} className="flex items-start gap-2.5 cursor-pointer">
                              <input type="radio" name="routing_mode" value={rm.value} checked={routingMode === rm.value}
                                onChange={() => setRoutingMode(rm.value)} className="mt-0.5 accent-blue-600" />
                              <div>
                                <p className="text-sm font-medium text-gray-700">{rm.label}</p>
                                <p className="text-xs text-gray-400">{rm.desc}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* ── Selective org-tree: designation checklist ────── */}
                      {routingMode === "selective_tree" && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Select participating designation levels</p>
                          <p className="text-xs text-gray-400 mb-3">Only checked levels will receive the expense for approval. Unchecked levels are skipped.</p>
                          <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                            {APPROVER_DESIGNATIONS.map(d => {
                              const entry = selectedDesignations.find(s => s.designation === d.value);
                              const included = !!entry;
                              return (
                                <div key={d.value} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors ${included ? "bg-white border border-blue-200" : ""}`}>
                                  <input type="checkbox" className="accent-blue-600 w-4 h-4 shrink-0"
                                    checked={included} onChange={() => toggleSelectiveDesig(d.value)} />
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${d.color}`}>{d.short}</span>
                                  <span className="text-sm text-gray-700 flex-1">{d.label}</span>
                                  {included && (
                                    <div className="flex gap-1">
                                      <button type="button"
                                        onClick={() => setSelectiveDesigRole(d.value, "approve")}
                                        className={`px-2 py-0.5 text-[10px] rounded border font-medium transition-colors ${entry.role === "approve" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"}`}>
                                        Approves
                                      </button>
                                      <button type="button"
                                        onClick={() => setSelectiveDesigRole(d.value, "review")}
                                        className={`px-2 py-0.5 text-[10px] rounded border font-medium transition-colors ${entry.role === "review" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"}`}>
                                        Reviews only
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {selectedDesignations.length === 0 && (
                            <p className="mt-1.5 text-xs text-amber-600">Select at least one designation level to include in the chain.</p>
                          )}
                        </div>
                      )}

                      {/* ── Ceiling designation (org_tree only) ─────────── */}
                      {routingMode === "org_tree" && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Ceiling designation</p>
                          <p className="text-xs text-gray-400 mb-2">Traversal stops at this designation level.</p>
                          <DesigSelect value={ceilingDesig} onChange={setCeilingDesig} placeholder="— No ceiling (walks to root) —" />
                        </div>
                      )}

                      {/* ── Designation thresholds (org_tree or selective_tree) */}
                      {(routingMode === "org_tree" || routingMode === "selective_tree") && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Designation thresholds</p>
                          <p className="text-xs text-gray-400 mb-2">Max amount each designation can be the final approver for (blank = no limit).</p>
                          {thresholds.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {thresholds.map(t => (
                                <div key={t.designation} className="flex items-center gap-2">
                                  <DesigBadge value={t.designation} />
                                  <input type="number" value={t.max_amount}
                                    onChange={e => updateThresholdAmount(t.designation, e.target.value)}
                                    placeholder="Max amount"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                  <button type="button" onClick={() => removeThreshold(t.designation)} className="text-red-400 hover:text-red-600">
                                    <i className="ti ti-x" style={{ fontSize: 13 }} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <DesigSelect value="" onChange={v => addThresholdRow(v)} placeholder="+ Add designation threshold…" />
                        </div>
                      )}

                      {/* ── Vacant seat ──────────────────────────────────── */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Vacant seat behaviour</p>
                        <div className="space-y-1.5">
                          {VACANT_OPTIONS.map(vo => (
                            <label key={vo.value} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="vacant" value={vo.value} checked={vacantBehavior === vo.value}
                                onChange={() => setVacantBehavior(vo.value)} className="accent-blue-600" />
                              <span className="text-sm text-gray-700">{vo.label}</span>
                            </label>
                          ))}
                        </div>
                        {vacantBehavior === "escalate_to_fallback" && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 mb-1">Fallback approver</p>
                            <select value={fallbackApproverId} onChange={e => setFallbackApproverId(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              <option value="">— Select employee —</option>
                              {employeeOptions.filter(e => e.user_id).map(e => (
                                <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* ── Save routing config ──────────────────────────── */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        {policySaved ? <p className="text-xs text-green-600">✓ Routing config saved</p> : <span />}
                        <button type="button" onClick={() => savePolicy(mod.key)} disabled={savingPolicy}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                          {savingPolicy ? "Saving…" : "Save routing config"}
                        </button>
                      </div>

                      {/* ── Finance review chain ─────────────────────────── */}
                      <div className="border-t border-gray-100 pt-5">
                        <label className="flex items-center gap-2 cursor-pointer mb-1">
                          <input type="checkbox" checked={requiresFinanceReview}
                            onChange={e => {
                              const checked = e.target.checked;
                              setRequiresFinanceReview(checked);
                              if (checked && financeSteps.length === 0) {
                                if (currentPolicyId) loadFinanceStepsById(currentPolicyId);
                                else setFinanceSteps(DEFAULT_STEPS.map(s => ({ ...s, _key: `${Date.now()}-${Math.random()}` })));
                              }
                            }} className="accent-blue-600" />
                          <span className="text-sm font-medium text-gray-700">Requires finance review after management approval</span>
                        </label>
                        <p className="text-xs text-gray-400 mb-3 ml-5">
                          Named-person step chain runs after the management approval chain clears.
                          Step behavior tags are freely configurable per tenant.
                        </p>

                        {requiresFinanceReview && (
                          <div className="border border-blue-200 rounded-xl bg-blue-50/40 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Finance review chain</p>
                              <p className="text-[11px] text-blue-500">Steps run in order after management approval clears</p>
                            </div>

                            {financeStepsError && (
                              <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
                                {financeStepsError}
                                <button type="button" onClick={() => setFinanceStepsError(null)} className="text-red-400 ml-2">&times;</button>
                              </div>
                            )}

                            {/* Suggested step behaviors hint */}
                            <div className="flex flex-wrap gap-1.5 pb-1">
                              <span className="text-[10px] text-blue-400 font-medium uppercase tracking-wide self-center">Quick add:</span>
                              {STEP_BEHAVIORS.map(b => (
                                <button key={b.value} type="button"
                                  onClick={() => setFinanceSteps(prev => [...prev, makeStep(prev.length + 1, b.value, b.label)])}
                                  className={`px-2 py-0.5 text-[10px] rounded border font-medium hover:opacity-80 transition-opacity ${b.color}`}>
                                  + {b.label}
                                </button>
                              ))}
                            </div>

                            {/* datalist for behavior tag suggestions */}
                            <datalist id="step-behavior-suggestions">
                              {STEP_BEHAVIORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                            </datalist>

                            {loadingFinanceSteps ? (
                              <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-blue-100 rounded-lg animate-pulse"/>)}</div>
                            ) : (
                              <div className="space-y-2">
                                {financeSteps.map((step, idx) => {
                                  const stepEmployees = filteredEmployees(step);
                                  return (
                                    <div key={step._key} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                      {/* ── Step header row ─────────────────────── */}
                                      <div className="flex items-center gap-2 px-3 py-2.5">
                                        {/* Reorder arrows */}
                                        <div className="flex flex-col gap-0.5 shrink-0">
                                          <button type="button" onClick={() => moveStep(step._key, -1)} disabled={idx === 0}
                                            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-[13px]">
                                            <i className="ti ti-chevron-up" />
                                          </button>
                                          <button type="button" onClick={() => moveStep(step._key, 1)} disabled={idx === financeSteps.length - 1}
                                            className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-[13px]">
                                            <i className="ti ti-chevron-down" />
                                          </button>
                                        </div>

                                        {/* Step number */}
                                        <span className="w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>

                                        {/* Behavior tag (open text + datalist) */}
                                        <div className="shrink-0" style={{ minWidth: 140 }}>
                                          <input
                                            list="step-behavior-suggestions"
                                            value={step.step_type}
                                            onChange={e => updateStep(step._key, { step_type: e.target.value })}
                                            placeholder="Behavior tag…"
                                            className={`w-full border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${behaviorColor(step.step_type)}`}
                                          />
                                          <p className="text-[9px] text-gray-400 mt-0.5 leading-none">behavior tag</p>
                                        </div>

                                        {/* Step label (display name) */}
                                        <input type="text" value={step.label}
                                          onChange={e => updateStep(step._key, { label: e.target.value })}
                                          placeholder="Step display name…"
                                          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0" />

                                        {/* Notes toggle */}
                                        <button type="button" onClick={() => updateStep(step._key, { showInstructions: !step.showInstructions })}
                                          className={`text-xs px-1.5 py-1 rounded border transition-colors ${step.showInstructions ? "bg-blue-50 border-blue-200 text-blue-600" : "border-gray-200 text-gray-400 hover:text-gray-600"}`}>
                                          <i className="ti ti-notes" style={{ fontSize: 13 }} />
                                        </button>

                                        {/* Remove */}
                                        <button type="button" onClick={() => removeStep(step._key)} className="text-red-300 hover:text-red-500">
                                          <i className="ti ti-trash" style={{ fontSize: 14 }} />
                                        </button>
                                      </div>

                                      {/* ── Step body ───────────────────────────── */}
                                      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-2.5">

                                        {/* Function mapping (cost-center scoped assignee pool) */}
                                        <div>
                                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                            Function mapping <span className="normal-case font-normal text-gray-300">(optional — filters assignee to mapped staff)</span>
                                          </p>
                                          <select
                                            value={step.function_code}
                                            onChange={e => updateStep(step._key, { function_code: e.target.value, assigned_employee_id: "" })}
                                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                            <option value="">— No function filter (all employees) —</option>
                                            {functionOptions.map(f => (
                                              <option key={f.code} value={f.code}>
                                                {f.name} ({f.code}) · {f.user_ids.length} assigned
                                              </option>
                                            ))}
                                          </select>
                                          {step.function_code && stepEmployees.length === 0 && (
                                            <p className="text-[10px] text-amber-600 mt-0.5">No employees are mapped to this function yet. Configure in Organisation → Functions.</p>
                                          )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                          {/* Named assignee */}
                                          <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                              Named assignee{step.function_code ? " (filtered)" : ""}
                                            </p>
                                            <select value={step.assigned_employee_id}
                                              onChange={e => updateStep(step._key, { assigned_employee_id: e.target.value, assigned_designation: "" })}
                                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                              <option value="">— Select employee —</option>
                                              {stepEmployees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                                            </select>
                                          </div>

                                          {/* Designation fallback */}
                                          <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Or designation fallback</p>
                                            <DesigSelect value={step.assigned_designation}
                                              onChange={v => updateStep(step._key, { assigned_designation: v, assigned_employee_id: "" })}
                                              placeholder="— Select designation —" includeIC />
                                          </div>

                                          {/* Min amount */}
                                          <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Min amount to trigger (optional)</p>
                                            <input type="number" value={step.min_amount} onChange={e => updateStep(step._key, { min_amount: e.target.value })}
                                              placeholder="Leave blank = always run"
                                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                          </div>

                                          {/* Toggles */}
                                          <div className="flex flex-col justify-center gap-1 pt-1">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                              <input type="checkbox" className="accent-blue-600" checked={step.can_send_back} onChange={e => updateStep(step._key, { can_send_back: e.target.checked })} />
                                              <span className="text-xs text-gray-600">Can send back to submitter</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                              <input type="checkbox" className="accent-blue-600" checked={step.can_correct_gl} onChange={e => updateStep(step._key, { can_correct_gl: e.target.checked })} />
                                              <span className="text-xs text-gray-600">Can correct GL codes inline</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                              <input type="checkbox" className="accent-blue-600" checked={step.is_required} onChange={e => updateStep(step._key, { is_required: e.target.checked })} />
                                              <span className="text-xs text-gray-600">Required (blocks chain if skipped)</span>
                                            </label>
                                          </div>
                                        </div>

                                        {step.showInstructions && (
                                          <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Instructions for reviewer</p>
                                            <textarea value={step.instructions} rows={2} onChange={e => updateStep(step._key, { instructions: e.target.value })}
                                              placeholder="What should the reviewer check or do at this step?"
                                              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                <button type="button" onClick={addStep}
                                  className="w-full border border-dashed border-blue-300 rounded-xl py-2 text-xs text-blue-500 hover:bg-blue-50 hover:border-blue-400 transition-colors flex items-center justify-center gap-1.5">
                                  <i className="ti ti-plus" style={{ fontSize: 13 }} /> Add custom step
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-blue-200">
                              <p className="text-[11px] text-blue-500">{financeStepsSaved ? "✓ Finance steps saved" : "Saved separately from routing config"}</p>
                              <button type="button" onClick={saveFinanceSteps} disabled={savingFinanceSteps}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {savingFinanceSteps ? "Saving…" : "Save finance steps"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </PageContainer>
  );
}
