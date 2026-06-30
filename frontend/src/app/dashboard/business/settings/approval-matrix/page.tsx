"use client";

/**
 * Approval Matrix Setup — /dashboard/business/settings/approval-matrix
 *
 * Tenant Admin only. Configures how many approval levels the company requires,
 * the role label for each level, and optional amount thresholds that control
 * whether level 2 / 3 are required based on the report total.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";

interface ApprovalMatrix {
  id: string;
  levels: number;
  level1_role: string;
  level2_role: string | null;
  level3_role: string | null;
  amount_threshold_l2: string | null;
  amount_threshold_l3: string | null;
}

export default function ApprovalMatrixPage() {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [levels, setLevels] = useState<1 | 2 | 3>(1);
  const [l1Role, setL1Role] = useState("Line Manager");
  const [l2Role, setL2Role] = useState("Finance Manager");
  const [l3Role, setL3Role] = useState("GM");
  const [thresholdL2, setThresholdL2] = useState("");
  const [thresholdL3, setThresholdL3] = useState("");

  // Redirect non-admins
  useEffect(() => {
    if (!user) return;
    if (!user.is_tenant_admin && !user.is_super_admin) {
      router.replace("/dashboard/business");
    }
  }, [user, router]);

  // Load existing matrix
  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ApprovalMatrix | null>("/api/approvals/matrix", { token: accessToken })
      .then((data) => {
        if (data) {
          setLevels(data.levels as 1 | 2 | 3);
          setL1Role(data.level1_role);
          setL2Role(data.level2_role ?? "Finance Manager");
          setL3Role(data.level3_role ?? "GM");
          setThresholdL2(data.amount_threshold_l2 ?? "");
          setThresholdL3(data.amount_threshold_l3 ?? "");
        }
      })
      .catch(() => { /* start with defaults */ })
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    if (!l1Role.trim()) { setError("Level 1 role label is required."); return; }
    if (levels >= 2 && !l2Role.trim()) { setError("Level 2 role label is required."); return; }
    if (levels >= 3 && !l3Role.trim()) { setError("Level 3 role label is required."); return; }

    setIsSaving(true);
    try {
      await apiFetch("/api/approvals/matrix", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({
          levels,
          level1_role: l1Role.trim(),
          level2_role: levels >= 2 ? l2Role.trim() : null,
          level3_role: levels >= 3 ? l3Role.trim() : null,
          amount_threshold_l2: levels >= 2 && thresholdL2 ? parseFloat(thresholdL2) : null,
          amount_threshold_l3: levels >= 3 && thresholdL3 ? parseFloat(thresholdL3) : null,
        }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save approval matrix.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="2xl" className="space-y-4">
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="2xl">
      <button
        type="button"
        onClick={() => router.push("/dashboard/business/setup")}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Setup dashboard
      </button>
      <div className="mb-6">
        <PageHeading title="Approval Matrix" />
        <p className="mt-0.5 text-sm text-gray-500">
          Configure how many approval levels expense reports require and who is responsible at each level.
        </p>
      </div>

      {success && (
        <Banner variant="success" className="mb-4">
          Approval matrix saved successfully.
        </Banner>
      )}

      {error && (
        <Banner variant="error" className="mb-4 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
        </Banner>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Number of levels */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            Number of Approval Levels
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            {([1, 2, 3] as const).map((n) => (
              <label
                key={n}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  levels === n
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="levels"
                  value={n}
                  checked={levels === n}
                  onChange={() => setLevels(n)}
                  className="accent-blue-600"
                />
                <span className="text-sm font-medium text-gray-800">{n} Level{n > 1 ? "s" : ""}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Level 1 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-200">
            Level 1 — Always Required
          </h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Approver Role Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={l1Role}
              onChange={(e) => setL1Role(e.target.value)}
              placeholder="e.g. Line Manager"
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">Shown to employees when selecting their approver</p>
          </div>
        </div>

        {/* Level 2 */}
        {levels >= 2 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-200">
              Level 2
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Approver Role Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={l2Role}
                  onChange={(e) => setL2Role(e.target.value)}
                  placeholder="e.g. Finance Manager"
                  className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Amount Threshold <span className="text-gray-400">(optional — skip L2 if report total ≤ this)</span>
                </label>
                <div className="flex items-center gap-2 max-w-sm">
                  <span className="text-sm text-gray-500">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={thresholdL2}
                    onChange={(e) => setThresholdL2(e.target.value)}
                    placeholder="e.g. 500000"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Leave blank to always require Level 2</p>
              </div>
            </div>
          </div>
        )}

        {/* Level 3 */}
        {levels >= 3 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-200">
              Level 3
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Approver Role Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={l3Role}
                  onChange={(e) => setL3Role(e.target.value)}
                  placeholder="e.g. GM"
                  className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Amount Threshold <span className="text-gray-400">(optional — skip L3 if report total ≤ this)</span>
                </label>
                <div className="flex items-center gap-2 max-w-sm">
                  <span className="text-sm text-gray-500">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={thresholdL3}
                    onChange={(e) => setThresholdL3(e.target.value)}
                    placeholder="e.g. 2000000"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Leave blank to always require Level 3</p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button variant="primary" onClick={handleSave} disabled={isSaving} loading={isSaving}>
            {isSaving ? "Saving…" : "Save Approval Matrix"}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
