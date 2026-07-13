"use client";

/**
 * Platform tenant detail page — M9.2 / M9.4, updated for M9.0.1 (test-first).
 *
 * Route: /platform/tenants/[id]
 * Shows tenant fields, user list, module count, and the tenant's environment
 * counterpart (test↔live, whichever this tenant doesn't already have).
 * Actions: set lifecycle, suspend, reactivate, create test environment,
 * review & promote (first promotion creates live; repeat promotions update it
 * — see PromotionReviewDialog). All API errors surfaced inline.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PromotionReviewDialog from "@/components/PromotionReviewDialog";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantUserSummary {
  id: string;
  full_name: string;
  email: string;
  role_tier: string | null;
  is_active: boolean;
  user_type: "employee" | "external";
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
  /** M9.0.1 — populated when this tenant is itself a test tenant with a born-from-promotion live counterpart. */
  live_environment: TestEnvSummary | null;
  created_at: string;
  updated_at: string;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

interface ModuleLicense {
  key: string;
  label: string;
  is_licensed: boolean;
  is_active: boolean;
}

interface SystemConfig {
  posting_mode: string;
  modules: ModuleLicense[];
}

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
  const { user, accessToken, enterTenant, startUserImpersonation } = useAuth();
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

  // User-level impersonation (M9.3b)
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  // User list filter/sort — persisted to localStorage
  const lsKey = `ziva_td_users_${id}`;
  const lsRead = (field: string, def: string) => { try { return JSON.parse(localStorage.getItem(lsKey) ?? "{}")[field] ?? def; } catch { return def; } };
  const lsSave = (patch: Record<string, string>) => { try { const cur = JSON.parse(localStorage.getItem(lsKey) ?? "{}"); localStorage.setItem(lsKey, JSON.stringify({ ...cur, ...patch })); } catch {} };

  const [usersExpanded, setUsersExpanded] = useState(false);
  const [userSearch, _setUserSearch] = useState(() => lsRead("search", ""));
  const [userStatusF, _setUserStatusF] = useState<"all" | "active" | "inactive">(() => lsRead("status", "all") as "all" | "active" | "inactive");
  const [userSortCol, _setUserSortCol] = useState<"name" | "email" | "active">(() => lsRead("sortCol", "name") as "name" | "email" | "active");
  const [userSortDir, _setUserSortDir] = useState<"asc" | "desc">(() => lsRead("sortDir", "asc") as "asc" | "desc");

  const setUserSearch   = (v: string) => { _setUserSearch(v);   lsSave({ search: v }); };
  const setUserStatusF  = (v: "all" | "active" | "inactive") => { _setUserStatusF(v); lsSave({ status: v }); };
  const toggleUserSort  = (col: "name" | "email" | "active") => {
    if (userSortCol === col) { const d = userSortDir === "asc" ? "desc" : "asc"; _setUserSortDir(d); lsSave({ sortDir: d }); }
    else { _setUserSortCol(col); _setUserSortDir("asc"); lsSave({ sortCol: col, sortDir: "asc" }); }
  };

  // Consultant system config (#49)
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);
  const [sysConfigSaving, setSysConfigSaving] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [pendingLicenses, setPendingLicenses] = useState<Record<string, boolean>>({});
  const [sysConfigMsg, setSysConfigMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Test/live environment management (M9.0.1: promotion is the single mechanism
  // for both "create live" and "update live" — see PromotionReviewDialog below).
  const [creatingTestEnv, setCreatingTestEnv]     = useState(false);
  const [showReviewDialog, setShowReviewDialog]   = useState(false);

  // Nuke tenant
  const [showNukeModal, setShowNukeModal]   = useState(false);
  const [nukeSlug, setNukeSlug]             = useState("");
  const [nukeLiveConfirm, setNukeLiveConfirm] = useState(false);
  const [nuking, setNuking]                 = useState(false);

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

  const loadSysConfig = async () => {
    if (!accessToken || !id) return;
    try {
      const data = await apiFetch<SystemConfig>(
        `/api/platform/tenants/${id}/system-config`,
        { token: accessToken }
      );
      setSysConfig(data);
      setPendingMode(data.posting_mode);
      const lic: Record<string, boolean> = {};
      data.modules.forEach(m => { lic[m.key] = m.is_licensed; });
      setPendingLicenses(lic);
    } catch {
      // non-fatal — section shows loading state
    }
  };

  useEffect(() => {
    loadSysConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  const saveSysConfig = async () => {
    if (!accessToken || !id) return;
    setSysConfigSaving(true);
    setSysConfigMsg(null);
    try {
      await apiFetch(`/api/platform/tenants/${id}/system-config`, {
        method: "PATCH",
        token: accessToken,
        body: {
          posting_mode: pendingMode,
          module_licenses: pendingLicenses,
        },
      });
      setSysConfigMsg({ type: "ok", text: "Configuration saved." });
      await loadSysConfig();
    } catch (e) {
      setSysConfigMsg({ type: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSysConfigSaving(false);
    }
  };

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

  const nukeTenant = async () => {
    if (!accessToken || !tenant) return;
    setNuking(true);
    setActionMsg(null);
    try {
      await apiFetch(`/api/platform/tenants/${id}`, {
        method: "DELETE",
        token: accessToken,
        body: {
          confirmation_slug: nukeSlug,
          confirm_live_delete: nukeLiveConfirm,
        },
      });
      setShowNukeModal(false);
      // Tenant is gone — navigate back to the list
      router.push("/platform/tenants");
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Delete failed" });
      setShowNukeModal(false);
    } finally {
      setNuking(false);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const displayedTenantUsers = useMemo(() => {
    if (!tenant) return [];
    let list = tenant.users;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      list = list.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (userStatusF === "active")   list = list.filter(u => u.is_active);
    if (userStatusF === "inactive") list = list.filter(u => !u.is_active);
    return [...list].sort((a, b) => {
      const av = userSortCol === "name" ? a.full_name : userSortCol === "email" ? a.email : (a.is_active ? "1" : "0");
      const bv = userSortCol === "name" ? b.full_name : userSortCol === "email" ? b.email : (b.is_active ? "1" : "0");
      return userSortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [tenant, userSearch, userStatusF, userSortCol, userSortDir]);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <PageContainer maxWidth="3xl">
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
      </PageContainer>
    );
  }

  const isSuspended = tenant.lifecycle_status === "suspended";
  const isConfigurable = ["trial", "in_implementation"].includes(tenant.lifecycle_status);

  const doImpersonateUser = async (targetUserId: string) => {
    if (!tenant) return;
    setImpersonatingUserId(targetUserId);
    setActionMsg(null);
    try {
      await startUserImpersonation(targetUserId, "user_list", {
        tenantId: tenant.id,
        tenantName: tenant.name,
        environment: tenant.environment,
      });
      router.push("/dashboard/business");
    } catch (e) {
      setActionMsg({ type: "err", text: e instanceof Error ? e.message : "Impersonation failed" });
      setImpersonatingUserId(null);
    }
  };

  const doEnter = async (env?: "live" | "test") => {
    if (!tenant) return;
    // Save current page so "Exit to platform" banner returns here instead of /platform root.
    try { sessionStorage.setItem("ziva_impl_return_url", window.location.pathname); } catch {}
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
    <PageContainer maxWidth="4xl" className="space-y-5">

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
          <PageHeading title={tenant.name} />
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
            <Button variant="primary" onClick={() => doEnter()} loading={entering}>
              {entering ? "Entering…" : "Enter tenant (configure)"}
            </Button>
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
                  <Button variant="primary" onClick={() => doEnter("test")} loading={entering}>
                    {entering ? "Entering…" : "Enter test (edit)"}
                  </Button>
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
            <Button
              variant="primary"
              onClick={setLifecycle}
              disabled={settingLifecycle || actioning || newLifecycle === tenant.lifecycle_status}
              loading={settingLifecycle}
            >
              {settingLifecycle ? "Saving…" : "Set lifecycle"}
            </Button>
          </div>
        </div>

        <hr className="border-gray-100" />

        {!isSuspended ? (
          <div className="space-y-1">
            <Button
              variant="danger"
              onClick={suspendTenant}
              disabled={actioning || settingLifecycle}
              loading={actioning}
            >
              {actioning ? "Processing…" : "Suspend tenant"}
            </Button>
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

        <hr className="border-red-100 mt-2" />

        {/* ── Danger: delete tenant ───────────────────────────────────────── */}
        <div className="space-y-1">
          <Button
            variant="danger"
            onClick={() => { setNukeSlug(""); setNukeLiveConfirm(false); setShowNukeModal(true); }}
            disabled={actioning || settingLifecycle || nuking}
          >
            Delete tenant permanently
          </Button>
          <p className="text-xs text-red-400">
            Irreversible. Removes the tenant and ALL its data from the database.
          </p>
        </div>
      </section>

      {/* ── Nuke tenant modal ────────────────────────────────────────────────── */}
      {showNukeModal && tenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-red-700">Delete company permanently</h2>
              <p className="mt-1 text-sm text-gray-600">
                This will <strong>permanently delete</strong> <span className="font-medium">{tenant.name}</span> and
                all of its data — users, employees, expenses, GL entries, documents — from the database.
                {(tenant.test_environment || tenant.live_environment) && (
                  <> Both the <strong>test</strong> and <strong>live</strong> environments will be deleted together in one operation.</>
                )}
                {' '}This cannot be undone.
              </p>
            </div>

            {(tenant.lifecycle_status === "live" || !!tenant.test_environment || !!tenant.live_environment) && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <input
                  id="nuke-live-confirm"
                  type="checkbox"
                  checked={nukeLiveConfirm}
                  onChange={e => setNukeLiveConfirm(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-red-600 cursor-pointer"
                />
                <label htmlFor="nuke-live-confirm" className="text-sm text-red-700 cursor-pointer">
                  I understand this company has a <strong>live environment</strong>. I confirm I want
                  to permanently delete all its data including live records.
                </label>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Type the tenant slug to confirm: <code className="bg-gray-100 px-1 rounded">{tenant.slug}</code>
              </label>
              <input
                type="text"
                value={nukeSlug}
                onChange={e => setNukeSlug(e.target.value)}
                placeholder={tenant.slug}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowNukeModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={nukeTenant}
                disabled={
                  nuking ||
                  nukeSlug !== tenant.slug ||
                  ((tenant.lifecycle_status === "live" || !!tenant.test_environment || !!tenant.live_environment) && !nukeLiveConfirm)
                }
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {nuking ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Test/live environment & promotion (Super Admin only, M9.0.1) ───────
           Every tenant starts test-only (no live counterpart) until its first
           promotion. This section therefore renders for BOTH environments and
           branches on which side of the pair is currently being viewed. */}
      {user?.is_super_admin && (tenant.environment === "live" || tenant.environment === "test") && (
        <section className="border border-amber-200 rounded-xl bg-amber-50 p-5 space-y-4">
          <h2 className="text-xs font-semibold text-amber-700 uppercase tracking-widest">
            {tenant.environment === "live" ? "Test environment" : "Live environment"}
          </h2>

          {tenant.environment === "live" ? (
            tenant.test_environment ? (
              /* Live tenant with a test shadow — repeat promotion */
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

                <div className="pt-1 border-t border-amber-200">
                  <Button variant="primary" onClick={() => setShowReviewDialog(true)}>
                    Review &amp; promote to live
                  </Button>
                  <p className="text-xs text-amber-600 mt-1">
                    Diff and selectively promote Chart of Accounts, Dimensions, GL requirements.
                    Organisation, tax &amp; FX config are always carried over in full.
                  </p>
                </div>
              </>
            ) : (
              /* Live tenant with no shadow — offer create (unrelated to promotion) */
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
            )
          ) : tenant.live_environment ? (
            /* Test tenant with a born-live counterpart — repeat promotion, viewed from test side */
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-amber-900">{tenant.live_environment.name}</p>
                  <p className="text-xs text-amber-600 font-mono mt-0.5">{tenant.live_environment.slug}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-200 text-amber-800">
                    {tenant.live_environment.lifecycle_status.replace(/_/g, " ")}
                  </span>
                </div>
                <Link
                  href={`/platform/tenants/${tenant.live_environment.id}`}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 underline shrink-0"
                >
                  View detail
                </Link>
              </div>

              <div className="pt-1 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => setShowReviewDialog(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Review &amp; promote to live
                </button>
                <p className="text-xs text-amber-600 mt-1">
                  Diff and selectively promote Chart of Accounts, Dimensions, GL requirements.
                  Organisation, tax &amp; FX config are always carried over in full.
                </p>
              </div>
            </>
          ) : (
            /* Test tenant, no live counterpart yet — first-ever promotion */
            <>
              <p className="text-sm text-amber-800">
                No live environment exists yet for this tenant — this is its only environment
                so far. Promoting its validated configuration creates the live environment for
                the first time.
              </p>
              <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                <li>Creates the live tenant and copies every accepted CoA / Dimensions item.</li>
                <li>Organisation, tax &amp; FX config are carried over in full automatically.</li>
                <li>All current users are mirrored onto the new live tenant.</li>
              </ul>
              <Button variant="primary" onClick={() => setShowReviewDialog(true)}>
                Review &amp; create live environment
              </Button>
            </>
          )}
        </section>
      )}

      {/* ── Promotion review dialog (M9.0.1 unified engine) ───────────────────
           tenantId is always THIS page's tenant id -- the backend resolves the
           test/live pair from either side. Name props branch on which side of
           the pair we're viewing, and on whether live exists yet at all. */}
      {showReviewDialog && accessToken && (
        <PromotionReviewDialog
          tenantId={tenant.id}
          tenantName={
            tenant.environment === "live"
              ? tenant.name
              : tenant.live_environment?.name ?? null
          }
          shadowName={tenant.environment === "live" ? (tenant.test_environment?.name ?? "Test") : tenant.name}
          onClose={() => { setShowReviewDialog(false); load(); }}
          accessToken={accessToken}
        />
      )}

      {/* ── Users ────────────────────────────────────────────────────────────── */}
      <section className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setUsersExpanded(v => !v)}
          className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Users</h2>
            <span className="text-xs text-gray-400 font-normal">
              {tenant.users.length} total · {tenant.users.filter(u => u.is_active).length} active
            </span>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 text-gray-400 transition-transform ${usersExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {usersExpanded && (
          <>
        {/* Filter bar */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            placeholder="Search name or email…"
            className="flex-1 min-w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            {(["all", "active", "inactive"] as const).map((v, i) => (
              <button key={v} type="button" onClick={() => setUserStatusF(v)}
                className={`px-3 py-1.5 font-medium transition-colors ${userStatusF === v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"} ${i > 0 ? "border-l border-gray-300" : ""}`}>
                {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {(userSearch || userStatusF !== "all") && (
            <button type="button" onClick={() => { setUserSearch(""); setUserStatusF("all"); }}
              className="px-2 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Clear</button>
          )}
        </div>

        {displayedTenantUsers.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400 italic">No users match the current filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {(
                  [
                    { key: "name",   label: "Name" },
                    { key: "email",  label: "Email" },
                    { key: null,     label: "Role tier" },
                    { key: "active", label: "Active" },
                    { key: null,     label: "" },
                  ] as { key: "name" | "email" | "active" | null; label: string }[]
                ).map(({ key, label }) => (
                  <th key={label || "action"}
                    onClick={key ? () => toggleUserSort(key) : undefined}
                    className={`text-left py-2.5 px-4 font-medium text-gray-500 ${key ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                  >
                    {label}
                    {key && (
                      <span className="ml-1">
                        {userSortCol === key ? (userSortDir === "asc" ? "↑" : "↓") : <span className="text-gray-300">↕</span>}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedTenantUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-4">
                    <span className="font-medium text-gray-800">{u.full_name}</span>
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      (u.user_type ?? "employee") === "external"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-50 text-blue-600"
                    }`}>
                      {(u.user_type ?? "employee") === "external" ? "External" : "Staff"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">{u.email}</td>
                  <td className="py-2.5 px-4 text-gray-500">{u.role_tier ?? "—"}</td>
                  <td className="py-2.5 px-4">
                    <span className={u.is_active ? "text-green-600 font-medium" : "text-red-400"}>
                      {u.is_active ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    {user?.is_super_admin && u.is_active && (
                      <button
                        type="button"
                        onClick={() => doImpersonateUser(u.id)}
                        disabled={!!impersonatingUserId || entering}
                        className="px-2 py-0.5 text-[11px] font-medium rounded border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                      >
                        {impersonatingUserId === u.id ? "Entering…" : "Impersonate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
          </>
        )}
      </section>

      {/* ── Consultant configuration ──────────────────────────────────────── */}
      {user?.is_super_admin && (
        <section className="border border-indigo-200 rounded-xl bg-white p-5 space-y-5">
          <h2 className="text-xs font-semibold text-indigo-700 uppercase tracking-widest">
            Consultant configuration
          </h2>

          {!sysConfig ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <>
              {/* Posting mode */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Posting mode</p>
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      { value: "lite",       label: "Lite",        desc: "No GL — approve only" },
                      { value: "connected",  label: "Connected",   desc: "Export to external ERP" },
                      { value: "full_erp",   label: "Full ERP",    desc: "Ziva BI internal GL" },
                    ] as const
                  ).map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2.5 cursor-pointer rounded-lg border px-4 py-3 text-sm transition-colors ${
                        pendingMode === opt.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="posting_mode"
                        value={opt.value}
                        checked={pendingMode === opt.value}
                        onChange={() => setPendingMode(opt.value)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div>
                        <p className="font-medium text-gray-800">{opt.label}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Module licensing */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Module licensing</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sysConfig.modules.map(mod => (
                    <label
                      key={mod.key}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={pendingLicenses[mod.key] ?? false}
                        onChange={e => setPendingLicenses(prev => ({ ...prev, [mod.key]: e.target.checked }))}
                        className="accent-indigo-600"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{mod.label}</p>
                        {mod.is_active && (
                          <p className="text-[10px] text-green-600 font-medium">Active</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Licensing grants the tenant permission to activate a module. Activation is done by the tenant in their setup portal.
                </p>
              </div>

              {/* Save */}
           
              {sysConfigMsg && (
                <p className={`text-xs ${sysConfigMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                  {sysConfigMsg.text}
                </p>
              )}
              <button
                type="button"
                onClick={saveSysConfig}
                disabled={sysConfigSaving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {sysConfigSaving ? "Saving..." : "Save configuration"}
              </button>
            </>
          )}
        </section>
      )}
    </PageContainer>
  );
}
