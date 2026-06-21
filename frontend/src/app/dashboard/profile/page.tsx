"use client";

/**
 * User profile page — /dashboard/profile
 *
 * Two-column layout inside a card with a banner strip:
 *   Left  — identity rail (avatar, name, email, role pills, meta)
 *   Right — Personal Info · Work Info (staff only) · Security (password + 2FA) · Active Sessions
 *
 * Role-aware: super admins see no Work Info section.
 * All controls are wired to real backend endpoints.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionData {
  id: string;
  device: string;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

type TotpStep = "idle" | "enrolling" | "disabling";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Mini UI components ────────────────────────────────────────────────────────

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(onDismiss, 3000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [onDismiss]);
  return (
    <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between gap-3">
      <span>✓ {message}</span>
      <button type="button" onClick={onDismiss} className="text-green-600 hover:text-green-800 font-bold text-lg leading-none">×</button>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none">×</button>
    </div>
  );
}

function Pill({ label, color = "gray" }: { label: string; color?: "gray" | "blue" | "purple" | "amber" }) {
  const cls: Record<string, string> = {
    gray:   "bg-gray-100 text-gray-600",
    blue:   "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    amber:  "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cls[color]}`}>
      {label}
    </span>
  );
}

// ── Shared input / button classes ─────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const readCls  = "px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500";
const btnCls   = "px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors";
const secBtnCls = "px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors disabled:opacity-60";

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-white">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, accessToken, refreshUser } = useAuth();
  const router = useRouter();

  const isSuperAdmin = user?.is_super_admin === true;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard/business");
    }
  };

  // ── Personal info state ───────────────────────────────────────────────────
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalSuccess, setPersonalSuccess] = useState("");
  const [personalError, setPersonalError] = useState("");

  // ── Work info state ───────────────────────────────────────────────────────
  const [employeeCode, setEmployeeCode] = useState(user?.employee_code ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [jobTitle, setJobTitle] = useState(user?.job_title ?? "");
  const [workSaving, setWorkSaving] = useState(false);
  const [workSuccess, setWorkSuccess] = useState("");
  const [workError, setWorkError] = useState("");

  // ── Password state ────────────────────────────────────────────────────────
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  // ── 2FA state ─────────────────────────────────────────────────────────────
  const [totpStep, setTotpStep] = useState<TotpStep>("idle");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState("");
  const [totpSuccess, setTotpSuccess] = useState("");

  // ── Sessions state ────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeOthersLoading, setRevokeOthersLoading] = useState(false);
  const [sessionsMsg, setSessionsMsg] = useState("");
  const [sessionsError, setSessionsError] = useState("");

  // ── Sync user fields on load ──────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? "");
      setPhone(user.phone ?? "");
      setEmployeeCode(user.employee_code ?? "");
      setDepartment(user.department ?? "");
      setJobTitle(user.job_title ?? "");
    }
  }, [user]);

  // ── Load sessions ─────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!accessToken) return;
    setSessionsLoading(true);
    try {
      const data = await apiFetch<SessionData[]>("/api/users/me/sessions", { token: accessToken });
      setSessions(data);
    } catch {
      /* silently fail */
    } finally {
      setSessionsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Handlers — Personal ───────────────────────────────────────────────────
  const savePersonal = async () => {
    if (!accessToken) return;
    setPersonalSaving(true); setPersonalError(""); setPersonalSuccess("");
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH", token: accessToken,
        body: { full_name: fullName.trim(), phone: phone.trim() || null },
      });
      await refreshUser();
      setPersonalSuccess("Personal info saved.");
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setPersonalSaving(false); }
  };

  // ── Handlers — Work ───────────────────────────────────────────────────────
  const saveWork = async () => {
    if (!accessToken) return;
    setWorkSaving(true); setWorkError(""); setWorkSuccess("");
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH", token: accessToken,
        body: {
          employee_code: employeeCode.trim() || null,
          department: department.trim() || null,
          job_title: jobTitle.trim() || null,
        },
      });
      await refreshUser();
      setWorkSuccess("Work info saved.");
    } catch (err) {
      setWorkError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setWorkSaving(false); }
  };

  // ── Handlers — Password ───────────────────────────────────────────────────
  const savePassword = async () => {
    if (!accessToken) return;
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    setPwSaving(true); setPwError(""); setPwSuccess("");
    try {
      await apiFetch("/api/users/me/password", {
        method: "PATCH", token: accessToken,
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setShowPwForm(false);
      setPwSuccess("Password changed successfully.");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally { setPwSaving(false); }
  };

  // ── Handlers — 2FA ────────────────────────────────────────────────────────
  const startEnroll = async () => {
    if (!accessToken) return;
    setTotpBusy(true); setTotpError("");
    try {
      const res = await apiFetch<{ secret: string; uri: string }>("/api/users/me/2fa/enroll", {
        method: "POST", token: accessToken,
      });
      setTotpSecret(res.secret);
      setTotpUri(res.uri);
      setTotpCode("");
      setTotpStep("enrolling");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Enroll failed.");
    } finally { setTotpBusy(false); }
  };

  const verify2fa = async () => {
    if (!accessToken) return;
    setTotpBusy(true); setTotpError("");
    try {
      await apiFetch("/api/users/me/2fa/verify", {
        method: "POST", token: accessToken, body: { code: totpCode },
      });
      await refreshUser();
      setTotpStep("idle");
      setTotpCode("");
      setTotpSuccess("Two-factor authentication enabled.");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Verification failed.");
    } finally { setTotpBusy(false); }
  };

  const disable2fa = async () => {
    if (!accessToken) return;
    setTotpBusy(true); setTotpError("");
    try {
      await apiFetch("/api/users/me/2fa/disable", {
        method: "POST", token: accessToken, body: { code: totpCode },
      });
      await refreshUser();
      setTotpStep("idle");
      setTotpCode("");
      setTotpSuccess("Two-factor authentication disabled.");
    } catch (err) {
      setTotpError(err instanceof Error ? err.message : "Failed to disable.");
    } finally { setTotpBusy(false); }
  };

  // ── Handlers — Sessions ───────────────────────────────────────────────────
  const revokeSession = async (id: string) => {
    if (!accessToken) return;
    setRevokingId(id); setSessionsError("");
    try {
      await apiFetch(`/api/users/me/sessions/${id}`, { method: "DELETE", token: accessToken });
      await loadSessions();
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Revoke failed.");
    } finally { setRevokingId(null); }
  };

  const revokeOthers = async () => {
    if (!accessToken) return;
    setRevokeOthersLoading(true); setSessionsError(""); setSessionsMsg("");
    try {
      const res = await apiFetch<{ revoked: number; message: string }>(
        "/api/users/me/sessions/revoke-others", { method: "POST", token: accessToken }
      );
      await loadSessions();
      setSessionsMsg(res.message);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed.");
    } finally { setRevokeOthersLoading(false); }
  };

  // ── Identity rail data ────────────────────────────────────────────────────
  const initials = getInitials(user?.full_name ?? "?");
  const rolePills: Array<{ label: string; color: "purple" | "blue" | "amber" | "gray" }> = isSuperAdmin
    ? [{ label: "Super admin", color: "purple" }, { label: "Platform owner", color: "blue" }]
    : [
        { label: user?.role_tier?.replace(/_/g, " ") ?? "Staff", color: "gray" },
        ...(user?.tenant_id ? [{ label: "Business account", color: "blue" as const }] : []),
      ];
  const metaLine = isSuperAdmin
    ? "Ziva BI internal · no tenant"
    : user?.tenant_id
    ? "Business account"
    : "No tenant";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 13 }} />
        Back
      </button>
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* Outer card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

        {/* Banner strip */}
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-purple-600" />

        {/* Two-column body */}
        <div className="flex flex-col lg:flex-row">

          {/* ── Left identity rail ──────────────────────────────────────── */}
          <div className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 p-6 flex flex-col items-center lg:items-start gap-4 bg-gray-50">

            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold select-none shrink-0">
              {initials}
            </div>

            {/* Name + email */}
            <div className="min-w-0 text-center lg:text-left">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
            </div>

            {/* Role pills */}
            <div className="flex flex-wrap gap-1.5 justify-center lg:justify-start">
              {rolePills.map((p) => (
                <Pill key={p.label} label={p.label} color={p.color} />
              ))}
            </div>

            {/* Meta */}
            <p className="text-[11px] text-gray-400 text-center lg:text-left leading-snug">{metaLine}</p>
          </div>

          {/* ── Right column — sections ──────────────────────────────────── */}
          <div className="flex-1 p-6 space-y-5 min-w-0">

            {/* ── 1. Personal Info ──────────────────────────────────────── */}
            <Section title="Personal Info">
              {personalSuccess && <SuccessBanner message={personalSuccess} onDismiss={() => setPersonalSuccess("")} />}
              {personalError && <ErrorBanner message={personalError} onDismiss={() => setPersonalError("")} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className={inputCls} placeholder="Your full name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email <span className="text-gray-400 font-normal">(read-only)</span>
                  </label>
                  <div className={readCls}>{user?.email}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className={inputCls} placeholder="+234 800 000 0000" />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={savePersonal} disabled={personalSaving} className={btnCls}>
                  {personalSaving ? "Saving…" : "Save personal info"}
                </button>
              </div>
            </Section>

            {/* ── 2. Work Info (staff only) ─────────────────────────────── */}
            {!isSuperAdmin && (
              <Section title="Work Info">
                {workSuccess && <SuccessBanner message={workSuccess} onDismiss={() => setWorkSuccess("")} />}
                {workError && <ErrorBanner message={workError} onDismiss={() => setWorkError("")} />}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Employee Code</label>
                    <input type="text" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)}
                      className={inputCls} placeholder="e.g. EMP-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                    <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                      className={inputCls} placeholder="e.g. Finance" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Job Title</label>
                    <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                      className={inputCls} placeholder="e.g. Senior Accountant" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={saveWork} disabled={workSaving} className={btnCls}>
                    {workSaving ? "Saving…" : "Save work info"}
                  </button>
                </div>
              </Section>
            )}

            {/* ── 3. Security ───────────────────────────────────────────── */}
            <Section title="Security">

              {/* Password */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Password</p>
                    <p className="text-xs text-gray-500">Change your account password.</p>
                  </div>
                  {!showPwForm && (
                    <button type="button" onClick={() => setShowPwForm(true)}
                      className={`${secBtnCls} border-gray-300 text-gray-700 hover:bg-gray-50`}>
                      Change password
                    </button>
                  )}
                </div>

                {showPwForm && (
                  <div className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
                    {pwSuccess && <SuccessBanner message={pwSuccess} onDismiss={() => setPwSuccess("")} />}
                    {pwError && <ErrorBanner message={pwError} onDismiss={() => setPwError("")} />}

                    <div className="grid grid-cols-1 gap-3 max-w-sm">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                          className={inputCls} placeholder="Current password" autoComplete="current-password" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          className={inputCls} placeholder="At least 8 characters" autoComplete="new-password" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          className={inputCls} placeholder="Repeat new password" autoComplete="new-password" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={savePassword} disabled={pwSaving} className={btnCls}>
                        {pwSaving ? "Changing…" : "Change password"}
                      </button>
                      <button type="button" onClick={() => { setShowPwForm(false); setPwError(""); }}
                        className={`${secBtnCls} border-gray-300 text-gray-500 hover:bg-gray-100`}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Two-factor authentication */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Two-factor authentication</p>
                    <p className="text-xs text-gray-500">
                      {user?.totp_enabled
                        ? "Enabled — your account requires a 6-digit code at login."
                        : "Disabled — add extra protection with an authenticator app."}
                    </p>
                  </div>
                  {totpStep === "idle" && (
                    user?.totp_enabled ? (
                      <button type="button" onClick={() => { setTotpStep("disabling"); setTotpCode(""); setTotpError(""); }}
                        className={`${secBtnCls} border-red-200 text-red-600 hover:bg-red-50`}>
                        Disable
                      </button>
                    ) : (
                      <button type="button" onClick={startEnroll} disabled={totpBusy}
                        className={`${secBtnCls} border-blue-200 text-blue-700 hover:bg-blue-50`}>
                        {totpBusy ? "Loading…" : "Enable"}
                      </button>
                    )
                  )}
                </div>

                {/* Success / error for 2FA */}
                {totpSuccess && <SuccessBanner message={totpSuccess} onDismiss={() => setTotpSuccess("")} />}
                {totpError && <ErrorBanner message={totpError} onDismiss={() => setTotpError("")} />}

                {/* Enrollment flow */}
                {totpStep === "enrolling" && (
                  <div className="border border-blue-100 rounded-lg p-4 space-y-4 bg-blue-50">
                    <p className="text-sm font-medium text-blue-900">Scan this QR with your authenticator app</p>
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      <div className="bg-white p-3 rounded-lg border border-blue-100 inline-block">
                        <QRCodeSVG value={totpUri} size={140} />
                      </div>
                      <div className="space-y-2 min-w-0">
                        <p className="text-xs text-blue-700 font-medium">Manual entry key:</p>
                        <code className="block text-xs font-mono bg-white border border-blue-100 rounded px-2 py-1.5 break-all text-gray-700">
                          {totpSecret}
                        </code>
                        <p className="text-xs text-blue-600">
                          After scanning, enter the 6-digit code your app shows to confirm.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 max-w-xs">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={`${inputCls} tracking-widest font-mono text-center text-lg`}
                        placeholder="000000"
                        autoComplete="one-time-code"
                      />
                      <button type="button" onClick={verify2fa} disabled={totpBusy || totpCode.length !== 6}
                        className={btnCls}>
                        {totpBusy ? "Verifying…" : "Verify"}
                      </button>
                    </div>
                    <button type="button" onClick={() => { setTotpStep("idle"); setTotpError(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      Cancel
                    </button>
                  </div>
                )}

                {/* Disable flow */}
                {totpStep === "disabling" && (
                  <div className="border border-red-100 rounded-lg p-4 space-y-3 bg-red-50">
                    <p className="text-sm font-medium text-red-800">Enter your current 2FA code to disable</p>
                    <div className="flex items-center gap-2 max-w-xs">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={`${inputCls} tracking-widest font-mono text-center text-lg`}
                        placeholder="000000"
                        autoComplete="one-time-code"
                      />
                      <button type="button" onClick={disable2fa} disabled={totpBusy || totpCode.length !== 6}
                        className={`px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors`}>
                        {totpBusy ? "Disabling…" : "Disable 2FA"}
                      </button>
                    </div>
                    <button type="button" onClick={() => { setTotpStep("idle"); setTotpError(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </Section>

            {/* ── 4. Active Sessions ────────────────────────────────────── */}
            <Section title="Active Sessions">
              {sessionsMsg && <SuccessBanner message={sessionsMsg} onDismiss={() => setSessionsMsg("")} />}
              {sessionsError && <ErrorBanner message={sessionsError} onDismiss={() => setSessionsError("")} />}

              {sessionsLoading ? (
                <p className="text-sm text-gray-400">Loading sessions…</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No active sessions found.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border ${
                        s.is_current ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.device}</p>
                          {s.is_current && (
                            <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">
                              This device
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.ip_address ?? "Unknown IP"} · Started {fmtDate(s.created_at)} · Expires {fmtDateTime(s.expires_at)}
                        </p>
                      </div>
                      {!s.is_current && (
                        <button
                          type="button"
                          onClick={() => revokeSession(s.id)}
                          disabled={revokingId === s.id}
                          className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {revokingId === s.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {sessions.filter((s) => !s.is_current).length > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={revokeOthers}
                    disabled={revokeOthersLoading}
                    className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    {revokeOthersLoading ? "Signing out…" : "Sign out everywhere else"}
                  </button>
                </div>
              )}
            </Section>

          </div>
        </div>
      </div>
    </div>
  );
}
