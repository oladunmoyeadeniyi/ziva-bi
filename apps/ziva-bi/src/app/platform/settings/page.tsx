"use client";

/**
 * Platform Settings — Super Admin only.
 *
 * Currently exposes the app_name field from the platform_config table.
 * Changing the name updates every place in the UI that reads from AppConfigContext
 * (after the 5-minute in-process cache expires or on next hard refresh).
 *
 * API:
 *   GET  /api/platform/config          → list all config entries
 *   PATCH /api/platform/config/app_name → update the app name
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface ConfigItem {
  key: string;
  value: string;
  description: string | null;
}

export default function PlatformSettingsPage() {
  const { accessToken } = useAuth();
  const { appName } = useAppConfig();

  const [appNameValue, setAppNameValue] = useState(appName);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const items = await apiFetch<ConfigItem[]>("/api/platform/config", {
        token: accessToken,
      });
      const nameItem = items.find((i) => i.key === "app_name");
      if (nameItem) setAppNameValue(nameItem.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!accessToken) return;
    const trimmed = appNameValue.trim();
    if (!trimmed) { setError("App name cannot be blank."); return; }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch("/api/platform/config/app_name", {
        method: "PATCH",
        token: accessToken,
        body: { value: trimmed },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer maxWidth="4xl">
      <PageHeading title="Platform settings" />
      <p className="text-sm text-gray-500 mb-8">
        Platform-wide configuration managed by super admins.
      </p>

      {/* ── Branding section ── */}
      <section className="border border-gray-200 rounded-xl bg-white p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="ti ti-brand-abstract text-indigo-500" style={{ fontSize: 18 }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Branding</h2>
            <p className="text-xs text-gray-500">Controls the product name displayed across the UI, emails, and 2FA issuer.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="max-w-sm space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App name
              </label>
              <input
                type="text"
                value={appNameValue}
                onChange={(e) => { setAppNameValue(e.target.value); setSaved(false); setError(null); }}
                placeholder="e.g. Finara"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">
                Takes effect on next page load (server cache refreshes every 5 min).
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {saved && (
              <p className="text-sm text-green-600">Saved successfully.</p>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || appNameValue.trim() === ""}
              size="sm"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </section>

      {/* ── Future settings ── */}
      <section className="border border-gray-200 rounded-xl bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <i className="ti ti-settings text-gray-500" style={{ fontSize: 20 }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">More settings coming</p>
            <ul className="text-sm text-gray-500 space-y-1 list-disc list-inside">
              <li>Default trial duration for new signups</li>
              <li>Feature flags per lifecycle status</li>
              <li>Global module availability switches</li>
              <li>Platform maintenance mode toggle</li>
            </ul>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
