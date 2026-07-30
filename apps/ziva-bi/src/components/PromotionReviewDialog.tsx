"use client";

/**
 * PromotionReviewDialog — Phase 3b, extended for M9.0.1 (test-first flow).
 *
 * Full diff review UI for CoA / Dimensions / DimensionValues /
 * GL Dimension Requirements / Account Mappings promotion. Doubles as the
 * "create live environment" flow: when `tenantName` is null, no live
 * tenant exists yet for this tenant, so every item in the diff is a CREATE
 * and applying births the live tenant (org/tax/FX config and all current
 * users are carried over automatically by the backend on every apply).
 *
 * Fetches a fresh diff on every open, renders items grouped by entity type
 * in collapsible sections (color-coded CREATE / UPDATE / DEACTIVATE), lets
 * the admin accept or deselect individual items, then calls apply with the
 * explicit accepted_item_ids list.
 */

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// ── Types (matching backend PromotionDiff / PromotionApplyResult) ──────────────

interface PromotionDiffItem {
  item_id: string;
  entity: string;
  action: "create" | "update" | "deactivate";
  natural_key: string;
  label: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changed_fields: string[];
}

interface PromotionDiff {
  dimensions: PromotionDiffItem[];
  coa: PromotionDiffItem[];
  dimension_values: PromotionDiffItem[];
  gl_requirements: PromotionDiffItem[];
  account_mappings: PromotionDiffItem[];
  total_changes: number;
}

interface PromotionApplyResult {
  created: Record<string, number>;
  updated: Record<string, number>;
  deactivated: Record<string, number>;
  total_applied: number;
  message: string;
}

export interface PromotionReviewDialogProps {
  tenantId: string;
  /**
   * Name of the live tenant, or `null` if no live counterpart exists yet
   * (M9.0.1: this is the tenant's first-ever promotion — applying will
   * create the live tenant rather than update an existing one).
   */
  tenantName: string | null;
  shadowName: string;
  onClose: () => void;
  accessToken: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_ORDER: Array<{ key: keyof Omit<PromotionDiff, "total_changes">; label: string }> = [
  { key: "dimensions",       label: "Dimensions" },
  { key: "coa",              label: "Chart of Accounts" },
  { key: "dimension_values", label: "Dimension Values" },
  { key: "gl_requirements",  label: "GL Dimension Requirements" },
  { key: "account_mappings", label: "Account Mappings" },
];

const ACTION_STYLES = {
  create:     { bg: "bg-green-50",  border: "border-green-200", badge: "bg-green-100 text-green-700",  text: "Create"     },
  update:     { bg: "bg-amber-50",  border: "border-amber-200", badge: "bg-amber-100 text-amber-700",  text: "Update"     },
  deactivate: { bg: "bg-red-50",    border: "border-red-200",   badge: "bg-red-100 text-red-700",      text: "Deactivate" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

function sectionCounts(items: PromotionDiffItem[]) {
  const c = items.filter((i) => i.action === "create").length;
  const u = items.filter((i) => i.action === "update").length;
  const d = items.filter((i) => i.action === "deactivate").length;
  const parts: string[] = [];
  if (c) parts.push(`${c} to create`);
  if (u) parts.push(`${u} to update`);
  if (d) parts.push(`${d} to deactivate`);
  return parts.join(", ") || "no changes";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DiffItemRow({
  item,
  checked,
  onToggle,
}: {
  item: PromotionDiffItem;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const style = ACTION_STYLES[item.action];

  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${style.bg} ${style.border} ${
        checked ? "opacity-100" : "opacity-50"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(item.item_id)}
        className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
      />
      <div className="min-w-0 flex-1">
        {/* Header: label + action badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800 truncate">{item.label}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.badge} shrink-0`}>
            {style.text}
          </span>
        </div>

        {/* CREATE: show key after-fields */}
        {item.action === "create" && Object.keys(item.after).length > 0 && (
          <div className="mt-1 space-y-0.5">
            {Object.entries(item.after)
              .filter(([, v]) => v !== null && v !== undefined && v !== "")
              .slice(0, 4)
              .map(([k, v]) => (
                <p key={k} className="text-xs text-gray-600">
                  <span className="font-medium">{k}:</span> {fmt(v)}
                </p>
              ))}
          </div>
        )}

        {/* UPDATE: show changed fields before → after */}
        {item.action === "update" && item.changed_fields.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {item.changed_fields.map((f) => (
              <p key={f} className="text-xs text-gray-700">
                <span className="font-medium">{f}:</span>{" "}
                <span className="line-through text-red-500 mr-1">{fmt(item.before[f])}</span>
                <span className="text-green-700">{fmt(item.after[f])}</span>
              </p>
            ))}
          </div>
        )}

        {/* DEACTIVATE: warning note */}
        {item.action === "deactivate" && (
          <p className="mt-1 text-xs text-red-600">
            This item will be deactivated in the live tenant (is_active → false). Not deleted.
          </p>
        )}
      </div>
    </label>
  );
}

function DiffSection({
  label,
  items,
  checked,
  onToggleItem,
  onSelectAll,
  onDeselectAll,
}: {
  sectionKey: string;
  label: string;
  items: PromotionDiffItem[];
  checked: Set<string>;
  onToggleItem: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;

  const ids = items.map((i) => i.item_id);
  const allChecked = ids.every((id) => checked.has(id));

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <i
            className={`ti ti-chevron-${open ? "down" : "right"} text-gray-400`}
            style={{ fontSize: 13 }}
          />
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="text-xs text-gray-400">{sectionCounts(items)}</span>
        </div>
        {/* Section-level select/deselect all */}
        <div className="flex items-center gap-2 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => allChecked ? onDeselectAll(ids) : onSelectAll(ids)}
            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 rounded border border-blue-200 hover:border-blue-400 transition-colors"
          >
            {allChecked ? "Deselect all" : "Select all"}
          </button>
        </div>
      </button>

      {/* Items */}
      {open && (
        <div className="p-3 space-y-2 bg-white">
          {items.map((item) => (
            <DiffItemRow
              key={item.item_id}
              item={item}
              checked={checked.has(item.item_id)}
              onToggle={onToggleItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export default function PromotionReviewDialog({
  tenantId,
  tenantName,
  shadowName,
  onClose,
  accessToken,
}: PromotionReviewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [diff, setDiff] = useState<PromotionDiff | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Set of currently-accepted item_ids (all checked by default)
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<PromotionApplyResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Fetch diff on mount — fresh on every open
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    apiFetch<PromotionDiff>(`/api/platform/tenants/${tenantId}/promotion/diff`, {
      method: "POST",
      token: accessToken,
    })
      .then((d) => {
        if (cancelled) return;
        setDiff(d);
        // Default: accept everything
        const allIds = new Set([
          ...d.dimensions.map((i) => i.item_id),
          ...d.coa.map((i) => i.item_id),
          ...d.dimension_values.map((i) => i.item_id),
          ...d.gl_requirements.map((i) => i.item_id),
          ...d.account_mappings.map((i) => i.item_id),
        ]);
        setAccepted(allIds);
      })
      .catch((e) => {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : "Failed to fetch diff");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tenantId, accessToken]);

  const toggleItem = useCallback((id: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setAccepted((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
  }, []);

  const deselectAll = useCallback((ids: string[]) => {
    setAccepted((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
  }, []);

  const acceptAll = useCallback(() => {
    if (!diff) return;
    const allIds = new Set([
      ...diff.dimensions.map((i) => i.item_id),
      ...diff.coa.map((i) => i.item_id),
      ...diff.dimension_values.map((i) => i.item_id),
      ...diff.gl_requirements.map((i) => i.item_id),
      ...diff.account_mappings.map((i) => i.item_id),
    ]);
    setAccepted(allIds);
  }, [diff]);

  const handleApply = async () => {
    if (!diff || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      // Send the explicit list — even if "accept all" was clicked, we enumerate the actual ids.
      const result = await apiFetch<PromotionApplyResult>(
        `/api/platform/tenants/${tenantId}/promotion/apply`,
        {
          method: "POST",
          token: accessToken,
          body: { accepted_item_ids: Array.from(accepted) },
        }
      );
      setApplyResult(result);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const isEmpty = diff && diff.total_changes === 0;
  const acceptedCount = accepted.size;
  // M9.0.1: no live tenant exists yet -- applying creates it for the first time.
  const isFirstPromotion = !tenantName;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {isFirstPromotion ? "Review & create live environment" : "Review & promote master data"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-medium">{shadowName}</span>
                {" "}→{" "}
                {isFirstPromotion ? (
                  <span className="font-medium italic">new live environment</span>
                ) : (
                  <>
                    <span className="font-medium">{tenantName}</span>
                    {" (live)"}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors shrink-0"
            >
              <i className="ti ti-x" style={{ fontSize: 16 }} />
            </button>
          </div>

          {/* Overwrite / create warning */}
          {diff && !isEmpty && !applyResult && (
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              {isFirstPromotion ? (
                <>
                  <strong>This creates the live environment.</strong> Accepted items, plus
                  organisation/tax/FX config, become the tenant&apos;s live data for the first
                  time. All current test users are mirrored onto it. This cannot be undone.
                </>
              ) : (
                <>
                  <strong>Warning:</strong> Promoting overwrites matching live rows with test values.
                  Deactivated items will be set inactive in live. This cannot be undone.
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <i className="ti ti-loader-2 animate-spin mr-2" style={{ fontSize: 18 }} />
              <span className="text-sm">Computing diff…</span>
            </div>
          )}

          {/* Fetch error */}
          {!loading && fetchError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {/* Empty diff */}
          {!loading && isEmpty && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <i className="ti ti-circle-check text-green-500" style={{ fontSize: 36 }} />
              {isFirstPromotion ? (
                <>
                  <p className="text-sm font-medium text-gray-700">Nothing to promote yet.</p>
                  <p className="text-xs text-gray-400 max-w-sm text-center">
                    No Chart of Accounts, Dimensions, or related master data exists in test yet.
                    Add configuration in test before promoting.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">Live is already up to date with test.</p>
                  <p className="text-xs text-gray-400">No changes were detected across all entity types.</p>
                </>
              )}
            </div>
          )}

          {/* Apply result */}
          {applyResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <i className="ti ti-circle-check text-green-600 shrink-0" style={{ fontSize: 22 }} />
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    {isFirstPromotion
                      ? `Live environment created — ${applyResult.total_applied} item(s) applied.`
                      : `Promotion complete — ${applyResult.total_applied} change(s) applied.`}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">{applyResult.message}</p>
                </div>
              </div>

              {/* Counts breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {(["created", "updated", "deactivated"] as const).map((kind) => {
                  const counts = applyResult[kind];
                  const total = Object.values(counts).reduce((s, v) => s + v, 0);
                  if (total === 0) return null;
                  const colors = {
                    created:    "bg-green-50 border-green-200 text-green-700",
                    updated:    "bg-amber-50 border-amber-200 text-amber-700",
                    deactivated:"bg-red-50   border-red-200   text-red-700",
                  };
                  return (
                    <div key={kind} className={`p-3 border rounded-lg ${colors[kind]}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1">
                        {total} {kind}
                      </p>
                      {Object.entries(counts).map(([entity, n]) => (
                        <p key={entity} className="text-xs">{entity}: {n}</p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Diff sections */}
          {!loading && diff && !isEmpty && !applyResult && (
            <>
              {/* Accept-all bar */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-500">
                  {acceptedCount} of {diff.total_changes} change(s) selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={acceptAll}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Accept all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setAccepted(new Set())}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              {SECTION_ORDER.map(({ key, label }) => (
                <DiffSection
                  key={key}
                  sectionKey={key}
                  label={label}
                  items={diff[key]}
                  checked={accepted}
                  onToggleItem={toggleItem}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                />
              ))}
            </>
          )}

          {/* Apply error */}
          {applyError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Apply failed:</strong> {applyError}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500">
            {!loading && diff && !isEmpty && !applyResult
              ? `${acceptedCount} item(s) will be promoted`
              : ""}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              {applyResult ? "Close" : "Cancel"}
            </button>
            {!loading && diff && !isEmpty && !applyResult && (
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || acceptedCount === 0}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {applying
                  ? (isFirstPromotion ? "Creating live…" : "Promoting…")
                  : isFirstPromotion
                    ? `Create live with ${acceptedCount} accepted item${acceptedCount !== 1 ? "s" : ""}`
                    : `Promote ${acceptedCount} accepted change${acceptedCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
