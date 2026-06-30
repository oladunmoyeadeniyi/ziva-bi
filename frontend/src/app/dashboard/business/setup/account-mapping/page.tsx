"use client";

/**
 * Account Mapping setup page — /dashboard/business/setup/account-mapping
 *
 * Reworked in BRIEF_account_mapping_ui_rework:
 *   - Nested collapsible layout: Statement (BS/PL) → Group → Subgroup → Roles.
 *   - Per-tenant control-account toggle (super admin only), with reset-to-default.
 *   - Z-index bug fixed: parent cards use overflow-visible; dropdown uses z-[200].
 *
 * Save model: per-row immediate save.
 * Combobox: client-side filter; pre-filters by expected_account_type; toggle "Show all".
 * Admin-gated: behind the isAdmin nav gate in layout.tsx + backend enforces _require_admin.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PostingRole {
  role_key: string;
  label: string;
  statement: string;                  // 'BS' | 'PL'
  group: string;                      // e.g. 'current_assets'
  subgroup: string | null;            // e.g. 'receivables'
  display_order: number;
  expected_account_type: string | null;
  is_control_account: boolean;        // catalogue default
  is_control_account_override: boolean | null;  // null = no override
  is_control_account_effective: boolean;
  description: string | null;
  gl_account_id: string | null;
  gl_number: string | null;
  gl_name: string | null;
  gl_account_type: string | null;
}

interface GLAccount {
  id: string;
  gl_number: string;
  gl_name: string;
  account_type: string;
  is_active: boolean;
}

// ── Label maps ────────────────────────────────────────────────────────────────

const STATEMENT_LABELS: Record<string, string> = {
  BS: "Balance Sheet",
  PL: "Profit & Loss",
};

const GROUP_LABELS: Record<string, string> = {
  current_assets:          "Current Assets",
  current_liabilities:     "Current Liabilities",
  non_current_liabilities: "Non-Current Liabilities",
  equity:                  "Equity",
  suspense:                "Suspense & Clearing",
  cost_of_sales:           "Cost of Sales",
};

const SUBGROUP_LABELS: Record<string, string> = {
  cash_bank:           "Cash & Bank",
  clearing:            "Clearing",
  receivables:         "Receivables",
  inventory:           "Inventory",
  prepayments:         "Prepayments",
  tax:                 "Tax",
  payables:            "Payables",
  accruals_provisions: "Accruals & Provisions",
  loans:               "Loans",
  equity:              "Equity",
  suspense:            "Suspense",
  cost_of_sales:       "Cost of Sales",
};

function toLabel(map: Record<string, string>, key: string): string {
  return map[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Type helpers ──────────────────────────────────────────────────────────────

const BS_TYPES = new Set(["BS", "SOFP"]);
const PL_TYPES = new Set(["PL", "SOCI"]);

function isTypeMatch(glType: string, expected: string | null): boolean {
  if (!expected) return true;
  if (expected === "BS") return BS_TYPES.has(glType);
  if (expected === "PL") return PL_TYPES.has(glType);
  return true;
}

function typeLabel(t: string | null): string {
  if (t === "BS") return "Balance Sheet";
  if (t === "PL") return "Income statement";
  return "Either";
}

function typeBadgeCls(t: string | null): string {
  if (t === "BS") return "bg-blue-50 text-blue-600";
  if (t === "PL") return "bg-purple-50 text-purple-600";
  return "bg-gray-100 text-gray-500";
}

// ── GL Picker combobox ────────────────────────────────────────────────────────
// Z-index fix: the parent card must NOT use overflow-hidden.
// The dropdown uses z-[200] to float above all sibling cards.

function GLPicker({
  role,
  accounts,
  onSelect,
  onClear,
  saving,
  errorMsg,
}: {
  role: PostingRole;
  accounts: GLAccount[];
  onSelect: (id: string) => void;
  onClear: () => void;
  saving: boolean;
  errorMsg: string | null;
}) {
  const [query, setQuery]     = useState("");
  const [isOpen, setIsOpen]   = useState(false);
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const typeFiltered = (showAll || !role.expected_account_type)
    ? accounts
    : accounts.filter(a => isTypeMatch(a.account_type, role.expected_account_type));

  const filtered = typeFiltered
    .filter(a => {
      if (!query) return true;
      const q = query.toLowerCase();
      return a.gl_number.toLowerCase().includes(q) || a.gl_name.toLowerCase().includes(q);
    })
    .slice(0, 50);

  const displayVal = isOpen
    ? query
    : role.gl_number ? `${role.gl_number} — ${role.gl_name}` : "";

  const isMapped = !!role.gl_account_id;
  const inputCls = [
    "w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
    isMapped ? "border-gray-300 bg-white text-gray-800"
              : "border-amber-200 bg-amber-50 text-gray-500 placeholder-amber-400",
    saving ? "opacity-50 cursor-not-allowed" : "",
  ].join(" ");

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={displayVal}
          placeholder={saving ? "Saving…" : "Search accounts…"}
          disabled={saving}
          className={inputCls}
          onFocus={() => { setIsOpen(true); setQuery(""); }}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
        />
        {isMapped && !saving && (
          <button
            type="button"
            title="Remove mapping"
            onMouseDown={e => { e.preventDefault(); onClear(); setIsOpen(false); setQuery(""); }}
            className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 text-base leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown — z-[200] so it sits above all sibling cards */}
      {isOpen && (
        <div className="absolute z-[200] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl">
          {role.expected_account_type && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100 rounded-t-lg">
              <span className="text-[10px] text-gray-400">
                {showAll ? "Showing all accounts"
                         : `Filtered to ${typeLabel(role.expected_account_type)}`}
              </span>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setShowAll(v => !v); }}
                className="text-[10px] text-blue-500 hover:text-blue-700"
              >
                {showAll ? "Filter by type" : "Show all"}
              </button>
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 italic">No accounts match.</p>
          ) : (
            <ul className="max-h-44 overflow-y-auto divide-y divide-gray-50">
              {filtered.map(a => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between gap-2"
                    onMouseDown={e => {
                      e.preventDefault();
                      onSelect(a.id);
                      setIsOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="truncate">
                      <span className="font-mono font-medium text-gray-800">{a.gl_number}</span>
                      <span className="text-gray-500"> — {a.gl_name}</span>
                    </span>
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      BS_TYPES.has(a.account_type) ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    }`}>
                      {a.account_type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="mt-1 text-[11px] text-red-600 leading-snug">{errorMsg}</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const STATEMENT_ORDER = ["BS", "PL"];

export default function AccountMappingPage() {
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const isSuperAdmin = user?.is_super_admin === true;

  const [roles, setRoles]         = useState<PostingRole[]>([]);
  const [accounts, setAccounts]   = useState<GLAccount[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Collapsible state — Set of "statement:group" keys that are COLLAPSED
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Per-role UI state
  const [savingKey, setSavingKey]   = useState<string | null>(null);
  const [rowErrors, setRowErrors]   = useState<Record<string, string>>({});
  const [rowSuccess, setRowSuccess] = useState<Record<string, boolean>>({});
  const [controlSaving, setControlSaving] = useState<string | null>(null);
  const [controlErrors, setControlErrors] = useState<Record<string, string>>({});

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setPageError(null);
    try {
      const [rolesData, coaData] = await Promise.all([
        apiFetch<PostingRole[]>("/api/setup/account-mapping/roles", { token: accessToken }),
        apiFetch<GLAccount[]>("/api/config/coa?active_only=true&limit=10000", { token: accessToken }),
      ]);
      setRoles(rolesData.slice().sort((a, b) => a.display_order - b.display_order));
      setAccounts(coaData.filter(a => a.is_active));
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Failed to load account mapping data.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  // ── GL map / unmap ────────────────────────────────────────────────────────
  const handleSelect = async (roleKey: string, glAccountId: string) => {
    if (!accessToken) return;
    setSavingKey(roleKey);
    setRowErrors(p => { const n = { ...p }; delete n[roleKey]; return n; });
    setRowSuccess(p => { const n = { ...p }; delete n[roleKey]; return n; });
    try {
      await apiFetch(`/api/setup/account-mapping/${roleKey}`, {
        method: "PUT", token: accessToken, body: { gl_account_id: glAccountId },
      });
      const fresh = await apiFetch<PostingRole[]>("/api/setup/account-mapping/roles", { token: accessToken });
      setRoles(fresh.slice().sort((a, b) => a.display_order - b.display_order));
      setRowSuccess(p => ({ ...p, [roleKey]: true }));
      setTimeout(() => setRowSuccess(p => { const n = { ...p }; delete n[roleKey]; return n; }), 2000);
    } catch (e) {
      setRowErrors(p => ({ ...p, [roleKey]: e instanceof Error ? e.message : "Save failed." }));
    } finally {
      setSavingKey(null);
    }
  };

  const handleClear = async (roleKey: string) => {
    if (!accessToken) return;
    setSavingKey(roleKey);
    setRowErrors(p => { const n = { ...p }; delete n[roleKey]; return n; });
    try {
      await apiFetch(`/api/setup/account-mapping/${roleKey}`, { method: "DELETE", token: accessToken });
      const fresh = await apiFetch<PostingRole[]>("/api/setup/account-mapping/roles", { token: accessToken });
      setRoles(fresh.slice().sort((a, b) => a.display_order - b.display_order));
    } catch (e) {
      setRowErrors(p => ({ ...p, [roleKey]: e instanceof Error ? e.message : "Remove failed." }));
    } finally {
      setSavingKey(null);
    }
  };

  // ── Control override ──────────────────────────────────────────────────────
  const handleControl = async (roleKey: string, value: boolean | null) => {
    if (!accessToken) return;
    setControlSaving(roleKey);
    setControlErrors(p => { const n = { ...p }; delete n[roleKey]; return n; });
    try {
      await apiFetch(`/api/setup/account-mapping/${roleKey}/control`, {
        method: "PUT", token: accessToken, body: { is_control_account: value },
      });
      const fresh = await apiFetch<PostingRole[]>("/api/setup/account-mapping/roles", { token: accessToken });
      setRoles(fresh.slice().sort((a, b) => a.display_order - b.display_order));
    } catch (e) {
      setControlErrors(p => ({ ...p, [roleKey]: e instanceof Error ? e.message : "Failed." }));
    } finally {
      setControlSaving(null);
    }
  };

  // ── Derived structure ─────────────────────────────────────────────────────
  const totalRoles  = roles.length;
  const mappedCount = roles.filter(r => r.gl_account_id).length;
  const pct         = totalRoles > 0 ? Math.round((mappedCount / totalRoles) * 100) : 0;

  // Build statement → group → subgroup → roles hierarchy
  const byStatement: Record<string, Record<string, Record<string, PostingRole[]>>> = {};
  for (const role of roles) {
    if (!byStatement[role.statement]) byStatement[role.statement] = {};
    const sg = byStatement[role.statement];
    if (!sg[role.group]) sg[role.group] = {};
    const key = role.subgroup ?? "__none__";
    if (!sg[role.group][key]) sg[role.group][key] = [];
    sg[role.group][key].push(role);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageContainer maxWidth="4xl">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>

      {/* Header */}
      <PageHeading title="Account mapping" />
      <p className="text-sm text-gray-500 mb-6">
        Map each posting role to a GL account so transactions post to the correct ledger.
      </p>

      {/* Overall progress */}
      {!loading && totalRoles > 0 && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{mappedCount} of {totalRoles} roles mapped</span>
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {mappedCount < totalRoles && (
            <p className="text-[11px] text-amber-600 mt-2">
              {totalRoles - mappedCount} role{totalRoles - mappedCount > 1 ? "s" : ""} unmapped — modules that need
              them will fail to post until configured.
            </p>
          )}
        </div>
      )}

      {pageError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {pageError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {STATEMENT_ORDER.filter(s => byStatement[s]).map(stmt => {
            const stmtRoles = roles.filter(r => r.statement === stmt);
            const stmtMapped = stmtRoles.filter(r => r.gl_account_id).length;
            const stmtKey = stmt;
            const stmtCollapsed = collapsed.has(stmtKey);

            return (
              <div key={stmt} className="border border-gray-200 rounded-xl bg-white">
                {/* Statement header — click to collapse */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(stmtKey)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 rounded-t-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <i
                      className={`ti ti-chevron-${stmtCollapsed ? "right" : "down"} text-gray-400`}
                      style={{ fontSize: 14 }}
                    />
                    <span className="text-sm font-semibold text-gray-800">
                      {toLabel(STATEMENT_LABELS, stmt)}
                    </span>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    stmtMapped === stmtRoles.length && stmtRoles.length > 0
                      ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                  }`}>
                    {stmtMapped}/{stmtRoles.length}
                  </span>
                </button>

                {/* Statement body */}
                {!stmtCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {Object.keys(byStatement[stmt] ?? {}).map(groupKey => {
                      const groupRoles = Object.values(byStatement[stmt][groupKey])
                        .flat()
                        .sort((a, b) => a.display_order - b.display_order);
                      const groupMapped = groupRoles.filter(r => r.gl_account_id).length;
                      const gKey = `${stmt}:${groupKey}`;
                      const groupCollapsed = collapsed.has(gKey);

                      return (
                        <div key={groupKey}>
                          {/* Group header */}
                          <button
                            type="button"
                            onClick={() => toggleCollapse(gKey)}
                            className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50/60 hover:bg-gray-100/60 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <i
                                className={`ti ti-chevron-${groupCollapsed ? "right" : "down"} text-gray-300`}
                                style={{ fontSize: 12 }}
                              />
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                                {toLabel(GROUP_LABELS, groupKey)}
                              </span>
                            </div>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              groupMapped === groupRoles.length
                                ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                            }`}>
                              {groupMapped}/{groupRoles.length}
                            </span>
                          </button>

                          {/* Group content */}
                          {!groupCollapsed && (
                            <div>
                              {Object.entries(byStatement[stmt][groupKey])
                                .sort()
                                .map(([subgroupKey, subRoles]) => {
                                  const sorted = [...subRoles].sort((a, b) => a.display_order - b.display_order);
                                  return (
                                    <div key={subgroupKey}>
                                      {/* Subgroup heading (skip if "__none__") */}
                                      {subgroupKey !== "__none__" && (
                                        <div className="px-5 pt-3 pb-1">
                                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                            {toLabel(SUBGROUP_LABELS, subgroupKey)}
                                          </span>
                                        </div>
                                      )}

                                      {/* Role rows */}
                                      <div className="divide-y divide-gray-50">
                                        {sorted.map(role => {
                                          const isSaving     = savingKey === role.role_key;
                                          const errMsg       = rowErrors[role.role_key] ?? null;
                                          const didSave      = rowSuccess[role.role_key] ?? false;
                                          const ctrlSaving   = controlSaving === role.role_key;
                                          const ctrlErr      = controlErrors[role.role_key] ?? null;
                                          const hasOverride  = role.is_control_account_override !== null;

                                          return (
                                            // overflow-visible ensures the GLPicker dropdown is not clipped
                                            <div key={role.role_key} className="px-5 py-3 flex items-start gap-4 overflow-visible">
                                              {/* Left: role info */}
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <span className="text-sm font-medium text-gray-800">{role.label}</span>
                                                  {role.is_control_account_effective && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                                                      Control
                                                    </span>
                                                  )}
                                                  {didSave && (
                                                    <span className="text-[10px] text-green-600 font-medium">Saved</span>
                                                  )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeBadgeCls(role.expected_account_type)}`}>
                                                    {typeLabel(role.expected_account_type)}
                                                  </span>
                                                  {!role.gl_account_id && (
                                                    <span className="text-[10px] text-amber-500">Unmapped</span>
                                                  )}
                                                </div>

                                                {/* Control toggle — super admin only */}
                                                {isSuperAdmin && (
                                                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                                      <input
                                                        type="checkbox"
                                                        checked={role.is_control_account_effective}
                                                        disabled={ctrlSaving}
                                                        onChange={e => handleControl(role.role_key, e.target.checked)}
                                                        className="w-3 h-3 accent-indigo-600 cursor-pointer disabled:opacity-50"
                                                      />
                                                      <span className="text-[11px] text-gray-500">
                                                        {ctrlSaving ? "Saving…" : "Control account"}
                                                      </span>
                                                    </label>
                                                    {hasOverride && !ctrlSaving && (
                                                      <button
                                                        type="button"
                                                        onClick={() => handleControl(role.role_key, null)}
                                                        className="text-[10px] text-gray-400 hover:text-red-500 underline"
                                                        title={`Reset to catalogue default (${role.is_control_account ? "Control" : "Non-control"})`}
                                                      >
                                                        reset to default
                                                      </button>
                                                    )}
                                                    {ctrlErr && (
                                                      <span className="text-[10px] text-red-600">{ctrlErr}</span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>

                                              {/* Right: GL picker — overflow-visible so dropdown escapes */}
                                              <div className="w-72 shrink-0 overflow-visible">
                                                <GLPicker
                                                  role={role}
                                                  accounts={accounts}
                                                  onSelect={id => handleSelect(role.role_key, id)}
                                                  onClear={() => handleClear(role.role_key)}
                                                  saving={isSaving}
                                                  errorMsg={errMsg}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
