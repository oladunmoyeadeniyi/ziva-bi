"use client";

/**
 * Module Activation page — M8.2 Implementation Portal.
 *
 * Shows all 14 modules as toggleable cards. Only activated modules appear
 * in the Module Setup section of the sidebar.
 *
 * Route: /dashboard/business/setup/modules
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

interface ModuleState {
  module_key: string;
  label: string;
  is_active: boolean;
}

interface ModulesResponse {
  modules: ModuleState[];
}

const MODULE_ICONS: Record<string, string> = {
  expense:          "🧾",
  ap:               "📄",
  ar:               "📬",
  payroll:          "💰",
  inventory:        "📦",
  fixed_assets:     "🏗️",
  posm:             "🗺️",
  vendor_portal:    "🤝",
  customer_portal:  "👤",
  warehouse:        "🏭",
  bank_recon:       "🏦",
  budget:           "📈",
  tax_engine:       "🧮",
  reporting:        "📊",
};

export default function ModuleActivationPage() {
  const { accessToken } = useAuth();
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ModulesResponse>("/api/setup/modules", { token: accessToken })
      .then((data) => setModules(data.modules))
      .catch((e) => setError(e.message));
  }, [accessToken]);

  const toggle = async (key: string) => {
    const current = modules.find((m) => m.module_key === key);
    if (!current) return;

    const newModules = modules.map((m) =>
      m.module_key === key ? { ...m, is_active: !m.is_active } : m
    );
    setModules(newModules);

    // Auto-save on toggle
    setSaving(true);
    try {
      const payload: Record<string, boolean> = { [key]: !current.is_active };
      const data = await apiFetch<ModulesResponse>("/api/setup/modules", {
        method: "PATCH",
        token: accessToken!,
        body: JSON.stringify({ modules: payload }),
      });
      setModules(data.modules);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      // Revert on error
      setModules(modules);
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Module activation</h1>
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        Activate the modules your organisation will use. Only activated modules appear in the Module Setup section.
        You can activate additional modules at any time.
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {saving && (
        <p className="mb-4 text-xs text-gray-400">Saving…</p>
      )}
      {saved && (
        <p className="mb-4 text-xs text-green-600">Saved</p>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
      >
        {modules.map((mod) => (
          <button
            key={mod.module_key}
            type="button"
            onClick={() => toggle(mod.module_key)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
              mod.is_active
                ? "border-green-400 bg-green-50 shadow-sm"
                : "border-gray-200 bg-white opacity-60 hover:opacity-80"
            }`}
          >
            <span className="text-2xl leading-none">
              {MODULE_ICONS[mod.module_key] ?? "⚙️"}
            </span>
            <span className="text-sm font-medium text-gray-800 leading-tight">
              {mod.label}
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                mod.is_active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {mod.is_active ? "Active" : "Inactive"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
