"use client";

/**
 * Platform tenant detail page — M9.2 / M9.4.
 *
 * Route: /platform/tenants/[id]
 * Shows tenant fields, user list, module count, test env. Actions: set lifecycle,
 * suspend, reactivate, create test environment, promote config test→live.
 * All API errors surfaced inline.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PromotionReviewDialog from "@/components/PromotionReviewDialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PromoteResult {
  promoted: string[];
  deferred: string[];
  message: string;
}

interface TenantUserSummary {
  id: string;
  full_name: string;
  email: string;
  role_tier: string | null;
  is_active: boolean;
}

interface TestEnvSummary {
  id: string;
  name: string;
  slug: string;
  lifecycle_status: string;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  country: string;
  environment: string;
  parent_tenant_id: string | null;
  lifecycle_status: string;
  pre_suspension_status: string | null;
  is_active: boolean;
  user_count: number;
  active_module_count: number;
  users: TenantUserSummary[];
  test_environment: TestEnvSummary | null;
  created_at: string;
  updated_at: string;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const LIFECYCLE_CLS: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600",
  in_implementation: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
};

const ENV_CLS: Record<string, string> = {
  live: "bg-blue-50 text-blue-600",
  test: "bg-amber-100 text-amber-700",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${map[value] ?? "bg-gray-100 text-gray-600"}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

const inputCls =
  "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, accessToken, enterTenant } = useAuth();
  const router = useRouter();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Lifecycle set
  const [newLifecycle, setNewLifecycle] = useState<string>("in_implementation");
  const [settingLifecycle, setSettingLifecycle] = useState(false);

  // Suspend / reactivate
  const [actioning, setActioning] = useState(false);

  // Enter tenant
  const [entering, setEntering] = useState(false);

  // Test environment management
  const [creatingTestEnv, setCreatingTestEnv]     = useState(false);
  const [showReviewDialog, setShowReviewDialog]   = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [promoting, setPromoting]                 = useState(false);
  const [promoteResult, setPromoteResult]         = useState<PromoteResult | null>(null);
  const [selectedSections, setSelectedSections]   = useState<Record<string, boolean>>({
    org_config: true,
    tax:        true,
    fx:         true,
  });

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TenantDetail>(
        `/api/platform/tenants/${id}`,
        { token: accessToken }
      );
      setTenant(data);
      setNewLifecycle(
        data.lifecycle_status === "suspended"
          ? (data.pre_suspension_status ?? "in_implementation")
          : data.lifecycle_status
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    load();
  }, [load]);

  const setLifecycle = async () => {
    if (!accessToken || !tenant) return;
    setSettingLifecycle(true);
    setActionMsg(null);
    try {
      await apiFetch(`/api/platform/tenants/${id}/lifecycle`, {
        method: "PATCH",
        token: accessToken,
        body: { status: newLifecycle },
      });
      setActionMsg({ type: "ok", text: `Lifecycle updated to "${newLifecycle}".` });
      await load();
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setSettingLifecycle(false);
    }
  };

  const suspendTenant = async () => {
    if (!accessToken || !tenant) return;
    if (!window.confirm("This will block all users of this tenant from logging in. Continue?")) return;
    setActioning(true);
    setActionMsg(null);
    try {
      await apiFetch(`/api/platform/tenants/${id}/suspend`, {
        method: "POST",
        token: accessToken,
      });
      setActionMsg({ type: "ok", text: "Tenant suspended. All logins blocked." });
      await load();
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Suspend failed" });
    } finally {
      setActioning(false);
    }
  };

  const reactivateTenant = async () => {
    if (!accessToken || !tenant) return;
    setActioning(true);
    setActionMsg(null);
    try {
      await apiFetch(`/api/platform/tenants/${id}/reactivate`, {
        method: "POST",
        token: accessToken,
      });
      setActionMsg({ type: "ok", text: "Tenant reactivated." });
      await load();
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Reactivate failed" });
    } finally {
      setActioning(false);
    }
  };

  const createTestEnv = async () => {
    if (!accessToken || !tenant) return;
    setCreatingTestEnv(true);
    setActionMsg(null);
    try {
      await apiFetch(`/api/platform/tenants/${id}/test-environment`, {
        method: "POST",
        token: accessToken,
      });
      setActionMsg({ type: "ok", text: "Test environment created. Users mirrored from live." });
      await load();
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Create failed" });
    } finally {
      setCreatingTestEnv(false);
    }
  };

  const runPromote = async () => {
    if (!accessToken || !tenant) return;
    const sections = Object.entries(selectedSections)
      .filter(([, checked]) => checked)
      .map(([key]) => key);
    if (sections.length === 0) {
      setActionMsg({ type: "err", text: "Select at least one section to promote." });
      return;
    }
    setPromoting(true);
    setPromoteResult(null);
    try {
      const result = await apiFetch<PromoteResult>(`/api/platform/tenants/${id}/promote`, {
        method: "POST",
        token: accessToken,
        body: { sections },
      });
      setPromoteResult(result);
      setShowPromoteDialog(false);
      setActionMsg({ type: "ok", text: result.message });
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Promote failed" });
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error ?? "Tenant not found."}
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
          Back
        </button>
      </div>
    );
  }

  const isSuspended = tenant.lifecycle_status === "suspended";
  const isConfigurable = ["trial", "in_implementation"].includes(tenant.lifecycle_status);

  const doEnter = async (env?: "live" | "test") => {
    if (!tenant) return;
    setEntering(true);
    setActionMsg(null);
    try {
      await enterTenant(tenant.id, env);
      // Navigate into the tenant dashboard after successful token swap
      if (env === "live") {
        router.push("/dashboard/business");
      } else {
        router.push("/dashboard/business/setup");
      }
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Enter failed" });
      setEntering(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl space-y-5">

      {/* Back */}
      <Link
        href="/platform/tenants"
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        All tenants
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{tenant.name}</h1>
          <p className="text-sm text-gray-400 font-mono mt-0.5">{tenant.slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <Badge value={tenant.environment} map={ENV_CLS} />
          <Badge value={tenant.lifecycle_status} map={LIFECYCLE_CLS} />
        </div>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <div
          className={`p-3 rounded-md text-sm border ${
            actionMsg.type === "ok"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {actionMsg.text}
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="ml-2 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Enter tenant (primary action) ───────────────────────────────────── */}
      <section className="border border-gray-200 rounded-xl bg-white p-5 space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Enter tenant</h2>

        {isSuspended ? (
          <p className="text-sm text-red-600">
            This tenant is suspended — entry is not allowed until reactivated.
          </p>
        ) : isConfigurable ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Lifecycle: <strong>{tenant.lifecycle_status.replace(/_/g, " ")}</strong> — full configuration access.
            </p>
            <button
              type="button"
              onClick={() => doEnter()}
              disabled={entering}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {entering ? "Entering…" : "Enter tenant (configure)"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Tenant is <strong>live</strong>. Choose your access mode:
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => doEnter("live")}
                  disabled={entering}
                  className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {entering ? "Entering…" : "Enter live (read-only)"}
                </button>
                <p className="text-xs text-gray-400">View what tenant users see — no writes.</p>
              </div>
              {tenant.test_environment && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => doEnter("test")}
                    disabled={entering}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {entering ? "Entering…" : "Enter test (edit)"}
                  </button>
                  <p className="text-xs text-gray-400">Full edit on the test shadow.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Lifecycle & status ───────────────────────────────────────────────── */}
      <section className="border border-gray-200 rounded-xl bg-white p-5 space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Lifecycle &amp; status</h2>

        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Change lifecycle stage. To suspend, use the button below — suspended cannot be set via the dropdown.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={newLifecycle}
              onChange={(e) => setNewLifecycle(e.target.value)}
              className={inputCls}
              disabled={settingLifecycle || actioning}
            >
              <option value="trial">Trial</option>
              <option value="in_implementation">In implementation</option>
              <option value="live">Live</option>
            </select>
            <button
              type="button"
              onClick={setLifecycle}
              disabled={settingLifecycle || actioning || newLifecycle === tenant.lifecycle_status}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {settingLifecycle ? "Saving…" : "Set lifecycle"}
            </button>
          </div>
        </div>

        <hr className="border-gray-100" />

        {!isSuspended ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={suspendTenant}
              disabled={actioning || settingLifecycle}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actioning ? "Processing…" : "Suspend tenant"}
            </button>
            <p className="text-xs text-gray-400">Blocks all user logins. Prior status saved for reactivation.</p>
          </div>
        ) : (
          <div className="space-y-1">
            <button
              type="button"
              onClick={reactivateTenant}
              disabled={actioning || settingLifecycle}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {actioning ? "Processing…" : "Reactivate tenant"}
            </button>
            <p className="text-xs text-gray-400">
              Restores lifecycle to &quot;{tenant.pre_suspension_status ?? "in_implementation"}&quot;.
            </p>
          </div>
        )}
      </section>

      {/* ── Tenant details ───────────────────────────────────────────────────── */}
      <section className="border border-gray-200 rounded-xl bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Tenant details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {[
            ["ID",                   tenant.id],
            ["Country",              tenant.country],
            ["Active",               tenant.is_active ? "Yes" : "No"],
            ["Users",                String(tenant.user_count)],
            ["Active modules",       String(tenant.active_module_count)],
            ["Parent tenant",        tenant.parent_tenant_id ?? "—"],
            ["Pre-suspension status",tenant.pre_suspension_status ?? "—"],
            ["Created",              new Date(tenant.created_at).toLocaleDateString()],
            ["Updated",              new Date(tenant.updated_at).toLocaleDateString()],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</dt>
              <dd className="text-sm text-gray-800 font-mono break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Test environment (Super Admin only) ──────────────────────────────── */}
      {user?.is_super_admin && tenant.environment === "live" && (
        <section className="border border-amber-200 rounded-xl bg-amber-50 p-5 space-y-4">
          <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-widest">
            Test environment
          </h2>

          {tenant.test_environment ? (
            /* Shadow exists — show summary + promote button */
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-amber-900">{tenant.test_environment.name}</p>
                  <p className="text-xs text-amber-600 font-mono mt-0.5">{tenant.test_environment.slug}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-200 text-amber-800">
                    {tenant.test_environment.lifecycle_status.replace(/_/g, " ")}
                  </span>
                </div>
                <Link
                  href={`/platform/tenants/${tenant.test_environment.id}`}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 underline shrink-0"
                >
                  View detail
                </Link>
              </div>

              <div className="pt-1 border-t border-amber-200 space-y-3">
                {/* Phase 2: org/tax/fx simple promote */}
                <div>
                  <button
                    type="button"
                    onClick={() => { setShowPromoteDialog(true); setPromoteResult(null); }}
                    className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Promote configuration to live
                  </button>
                  <p className="text-xs text-amber-600 mt-1">
                    Copy org, tax &amp; FX config from the test shadow to the live tenant.
                  </p>
                </div>
                {/* Phase 3b: CoA / Dimensions / DimValues diff + apply */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowReviewDialog(true)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Review &amp; promote master data
                  </button>
                  <p className="text-xs text-amber-600 mt-1">
                    Diff and selectively promote Chart of Accounts, Dimensions, GL requirements.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* No shadow — offer create */
            <>
              <p className="text-sm text-amber-800">
                No test environment exists for this tenant. Create one to rehearse configuration
                changes in an isolated sandbox before applying them to live.
              </p>
              <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                <li>All users mirrored from the live tenant (same credentials).</li>
                <li>Data is isolated — test changes never affect live.</li>
                <li>Once created, promote config sections from test → live on demand.</li>
              </ul>
              <button
                type="button"
                onClick={createTestEnv}
                disabled={creatingTestEnv}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {creatingTestEnv ? "Creating…" : "Create test environment"}
              </button>
            </>
          )}
        </section>
      )}

      {/* ── Promote confirmation dialog ─────────────────────────────────────── */}
      {showPromoteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-900">
              Promote configuration to live
            </h2>

            {/* Warning */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Warning:</strong> Promoting will overwrite the live tenant&apos;s selected
              configuration with the values from the test environment. This cannot be undone.
            </div>

            {/* Will be promoted */}
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Select sections to promote
              </p>
              <div className="space-y-2">
                {[
                  {
                    key: "org_config",
                    label: "Organisation config",
                    desc: "Legal info, fiscal year, currencies, branding",
                  },
                  {
                    key: "tax",
                    label: "Tax & statutory",
                    desc: "VAT, WHT, PAYE configuration",
                  },
                  {
                    key: "fx",
                    label: "Currencies & FX",
                    desc: "Exchange rates, revaluation rules",
                  },
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSections[key] ?? true}
                      onChange={(e) =>
                        setSelectedSections((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Not included (deferred) */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Not included — require manual handling
              </p>
              <div className="space-y-1">
                {[
                  { label: "Chart of Accounts", reason: "GL account IDs require remapping" },
                  { label: "Dimensions",         reason: "Dimension value IDs require remapping" },
                  { label: "Accounting periods", reason: "Operational state — not config" },
                ].map(({ label, reason }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <i className="ti ti-ban text-gray-400" style={{ fontSize: 12 }} />
                    <span className="text-xs text-gray-500">
                      <span className="font-medium text-gray-600">{label}</span> — {reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowPromoteDialog(false)}
                disabled={promoting}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runPromote}
                disabled={promoting || !Object.values(selectedSections).some(Boolean)}
                className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {promoting ? "Promoting…" : "Confirm promote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 3b: Master data promotion review dialog ────────────────────── */}
      {showReviewDialog && tenant.test_environment && accessToken && (
        <PromotionReviewDialog
          tenantId={tenant.id}
          tenantName={tenant.name}
          shadowName={tenant.test_environment.name}
          onClose={() => setShowReviewDialog(false)}
          accessToken={accessToken}
        />
      )}

      {/* ── Users ────────────────────────────────────────────────────────────── */}
      <section className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Users</h2>
          <span className="text-xs text-gray-400">{tenant.users.length} total</span>
        </div>
        {tenant.users.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400 italic">No users on this tenant.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name", "Email", "Role tier", "Active"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-4 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenant.users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-4 font-medium text-gray-800">{u.full_name}</td>
                  <td className="py-2.5 px-4 text-gray-500">{u.email}</td>
                  <td className="py-2.5 px-4 text-gray-500">{u.role_tier ?? "—"}</td>
                  <td className="py-2.5 px-4">
                    <span className={u.is_active ? "text-green-600 font-medium" : "text-red-400"}>
                      {u.is_active ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

    </div>
  );
}
