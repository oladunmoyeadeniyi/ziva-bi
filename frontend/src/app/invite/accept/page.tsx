"use client";

/**
 * Invitation acceptance — /invite/accept?token={token}
 *
 * Public page (no auth required). Validates the invite token on load,
 * shows a signup form if valid, then auto-logs-in on success.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAppConfig } from "@/contexts/AppConfigContext";

interface InviteDetails {
  email: string;
  tenant_name: string;
  role: string;
  invited_by_name: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    account_type: "individual" | "business";
    tenant_id: string | null;
    is_super_admin: boolean;
    is_tenant_admin: boolean;
  };
}

const ROLE_LABELS: Record<string, string> = {
  employee: "Employee",
  line_manager: "Line Manager",
  finance_reviewer: "Finance Reviewer",
  finance_manager: "Finance Manager",
  gm: "General Manager",
  tenant_admin: "Tenant Admin",
};

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { appName } = useAppConfig();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setValidationError("No invitation token provided."); setValidating(false); return; }
    apiFetch<InviteDetails>(`/api/invitations/validate/${token}`)
      .then(setInvite)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Invalid or expired invitation.";
        setValidationError(msg);
      })
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!fullName.trim()) { setSubmitError("Full name is required."); return; }
    if (password.length < 8) { setSubmitError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setSubmitError("Passwords do not match."); return; }

    setSubmitting(true); setSubmitError(null);
    try {
      const res = await apiFetch<AuthResponse>(`/api/invitations/accept/${token}`, {
        method: "POST",
        body: JSON.stringify({ full_name: fullName.trim(), password }),
      });

      // Store the session the same way AuthContext does, then redirect
      localStorage.setItem("ziva_refresh_token", res.refresh_token);
      localStorage.setItem("ziva_user", JSON.stringify(res.user));
      // Redirect to dashboard — a page reload will restore session via AuthContext
      router.push("/dashboard/business");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      setSubmitError(msg);
    } finally { setSubmitting(false); }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Validating invitation…</div>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm text-center">
          <div className="text-3xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-sm text-gray-600 mb-6">{validationError}</p>
          <p className="text-xs text-gray-400">Please contact your administrator to request a new invitation link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{appName}</h1>
          <p className="mt-3 text-gray-700">
            You&apos;ve been invited to join{" "}
            <span className="font-semibold">{invite?.tenant_name}</span> as{" "}
            <span className="font-semibold">{ROLE_LABELS[invite?.role ?? ""] ?? invite?.role}</span>.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Invited by {invite?.invited_by_name} · {invite?.email}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className={inputCls} placeholder="Your full name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className={inputCls} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls} placeholder="Repeat password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          </div>

          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="w-full py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
            {submitting ? "Creating account…" : "Create Account & Join"}
          </button>

          <p className="text-xs text-center text-gray-400">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 hover:underline">Sign in instead</a>
          </p>
        </div>
      </div>
    </div>
  );
}
