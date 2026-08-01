"use client";

/**
 * Intelligent Categorisation Configuration — ICE module.
 *
 * Allows Tenant Admin to enable/disable ICE, set confidence thresholds,
 * control which fields AI may suggest, and view accuracy analytics.
 *
 * Available to: tenant_admin, finance_admin, power_admin, super_admin.
 * Only tenant_admin+ can make changes (enforced by the API).
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";

interface IceConfig {
  id: string;
  tenant_id: string;
  ai_enabled: boolean;
  enabled_fields: Record<string, boolean>;
  confidence_threshold_high: number;
  confidence_threshold_low: number;
  sensitive_gl_accounts: string[];
  allow_user_disable: boolean;
  updated_at: string;
}

interface IceAnalytics {
  total_predictions: number;
  accepted: number;
  corrected: number;
  pending_feedback: number;
  acceptance_rate: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;
  top_corrected_gls: { gl_number: string; gl_name: string | null; count: number }[];
  period_days: number;
}

const FIELD_LABELS: Record<string, string> = {
  gl: "GL account suggestions",
  cost_center: "Cost center suggestions",
  category: "Expense category suggestions",
};

export default function AiConfigPage() {
  const [config, setConfig] = useState<IceConfig | null>(null);
  const [analytics, setAnalytics] = useState<IceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editable form state (mirrors config)
  const [aiEnabled, setAiEnabled] = useState(false);
  const [thresholdHigh, setThresholdHigh] = useState(80);
  const [thresholdLow, setThresholdLow] = useState(50);
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    gl: true,
    cost_center: true,
    category: true,
  });
  const [allowUserDisable, setAllowUserDisable] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [cfg, analytics30] = await Promise.all([
        apiFetch<IceConfig>("/api/ai/ice/config"),
        apiFetch<IceAnalytics>("/api/ai/ice/analytics?period_days=30").catch(() => null),
      ]);
      setConfig(cfg);
      setAiEnabled(cfg.ai_enabled);
      setThresholdHigh(cfg.confidence_threshold_high);
      setThresholdLow(cfg.confidence_threshold_low);
      setEnabledFields(cfg.enabled_fields);
      setAllowUserDisable(cfg.allow_user_disable);
      if (analytics30) setAnalytics(analytics30);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load intelligence configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const updated = await apiFetch<IceConfig>("/api/ai/ice/config", {
        method: "PATCH",
        body: JSON.stringify({
          ai_enabled: aiEnabled,
          confidence_threshold_high: thresholdHigh,
          confidence_threshold_low: thresholdLow,
          enabled_fields: enabledFields,
          allow_user_disable: allowUserDisable,
        }),
      });
      setConfig(updated);
      setSuccessMsg("Configuration saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (key: string) => {
    setEnabledFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="text-center py-12 text-gray-400">Loading configuration…</div>
      </PageContainer>
    );
  }

  const acceptancePercent = analytics
    ? Math.round(analytics.acceptance_rate * 100)
    : null;

  return (
    <PageContainer>
      <PageHeading
        title="Intelligent Categorisation"
        subtitle="Configure the Intelligent Categorisation Engine (ICE) for your organisation."
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{successMsg}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="lg:col-span-2 space-y-6">

          {/* Master toggle */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Intelligent Categorisation</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  When enabled, ICE suggests GL accounts, categories, and dimensions as employees submit expenses.
                </p>
              </div>
              <button
                onClick={() => setAiEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  aiEnabled ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    aiEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {!aiEnabled && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                Smart suggestions are <strong>disabled</strong>. Employees will classify all fields manually.
              </div>
            )}
          </div>

          {/* Field controls */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Suggestion Fields</h3>
            <p className="text-sm text-gray-500 mb-4">
              Choose which fields ICE may suggest. Disabled fields require manual input.
            </p>
            <div className="space-y-3">
              {Object.entries(FIELD_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() => toggleField(key)}
                    disabled={!aiEnabled}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
                      enabledFields[key] ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                        enabledFields[key] ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence thresholds */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Confidence Thresholds</h3>
            <p className="text-sm text-gray-500 mb-4">
              ICE assigns each prediction a score (0–100). These thresholds determine the confidence badge shown to users.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  High confidence threshold
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={51}
                    max={99}
                    value={thresholdHigh}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setThresholdHigh(v);
                      if (v <= thresholdLow) setThresholdLow(v - 1);
                    }}
                    disabled={!aiEnabled}
                    className="flex-1 disabled:opacity-40"
                  />
                  <span className="text-sm font-mono font-semibold text-green-700 w-10 text-right">
                    {thresholdHigh}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  ≥ {thresholdHigh}% → <span className="text-green-600 font-medium">GREEN badge</span> — accept with one click
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Low confidence threshold
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={thresholdHigh - 1}
                    value={thresholdLow}
                    onChange={(e) => setThresholdLow(Number(e.target.value))}
                    disabled={!aiEnabled}
                    className="flex-1 disabled:opacity-40"
                  />
                  <span className="text-sm font-mono font-semibold text-amber-600 w-10 text-right">
                    {thresholdLow}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {"< "}{thresholdLow}% → <span className="text-red-500 font-medium">RED badge</span> — manual classification required
                </p>
              </div>
            </div>

            {/* Band legend */}
            <div className="mt-4 flex gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-gray-600">HIGH ≥ {thresholdHigh}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-gray-600">MEDIUM {thresholdLow}–{thresholdHigh - 1}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-gray-600">LOW {"< "}{thresholdLow}%</span>
              </div>
            </div>
          </div>

          {/* Employee controls */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Allow employees to disable smart suggestions</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  When on, employees can turn off smart suggestions for their own account.
                </p>
              </div>
              <button
                onClick={() => setAllowUserDisable((v) => !v)}
                disabled={!aiEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                  allowUserDisable ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    allowUserDisable ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save configuration"}
            </Button>
          </div>
        </div>

        {/* Analytics panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Last 30 Days</h3>
            {analytics ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total predictions</span>
                  <span className="font-semibold">{analytics.total_predictions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Acceptance rate</span>
                  <span className="font-semibold text-green-600">{acceptancePercent}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Accepted</span>
                  <span className="font-medium text-green-600">{analytics.accepted}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Corrected</span>
                  <span className="font-medium text-red-500">{analytics.corrected}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Awaiting response</span>
                  <span className="font-medium text-gray-400">{analytics.pending_feedback}</span>
                </div>
                <hr />
                <div className="text-xs text-gray-500 font-medium mt-1 mb-1">Confidence distribution</div>
                <div className="flex gap-2">
                  {[
                    { label: "High", count: analytics.high_confidence_count, color: "bg-green-100 text-green-700" },
                    { label: "Med", count: analytics.medium_confidence_count, color: "bg-amber-100 text-amber-700" },
                    { label: "Low", count: analytics.low_confidence_count, color: "bg-red-100 text-red-500" },
                  ].map((b) => (
                    <div key={b.label} className={`flex-1 rounded-lg p-2 text-center ${b.color}`}>
                      <div className="font-bold text-base">{b.count}</div>
                      <div className="text-xs">{b.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No predictions yet — enable smart suggestions to start.</p>
            )}
          </div>

          {analytics && analytics.top_corrected_gls.length > 0 && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Most Corrected GLs</h3>
              <p className="text-xs text-gray-500 mb-3">
                GLs users selected instead of the suggested code — helps improve accuracy.
              </p>
              <div className="space-y-2">
                {analytics.top_corrected_gls.map((gl) => (
                  <div key={gl.gl_number} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-xs text-gray-500">{gl.gl_number}</span>
                      {gl.gl_name && <span className="ml-1 text-gray-700 text-xs">— {gl.gl_name}</span>}
                    </div>
                    <span className="text-xs bg-gray-100 rounded px-2 py-0.5 font-medium">{gl.count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-semibold mb-1">How ICE learns</p>
            <p>
              Every accepted suggestion reinforces the pattern. Every correction trains ICE to do better.
              Accuracy typically improves after 50+ transactions per vendor.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
