"use client";

/**
 * User profile page — /dashboard/profile
 *
 * Three sections: Personal Info, Work Info, Change Password.
 * Each section saves independently. Fixes the "Employee Code not set on profile" issue.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
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

export default function ProfilePage() {
  const { user, accessToken, refreshUser } = useAuth();

  // Personal info
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalSuccess, setPersonalSuccess] = useState("");
  const [personalError, setPersonalError] = useState("");

  // Work info
  const [employeeCode, setEmployeeCode] = useState(user?.employee_code ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [jobTitle, setJobTitle] = useState(user?.job_title ?? "");
  const [workSaving, setWorkSaving] = useState(false);
  const [workSuccess, setWorkSuccess] = useState("");
  const [workError, setWorkError] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");

  // Sync when user loads (from AuthContext, could be cached)
  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? "");
      setPhone(user.phone ?? "");
      setEmployeeCode(user.employee_code ?? "");
      setDepartment(user.department ?? "");
      setJobTitle(user.job_title ?? "");
    }
  }, [user]);

  const savePersonal = async () => {
    if (!accessToken) return;
    setPersonalSaving(true); setPersonalError(""); setPersonalSuccess("");
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH", token: accessToken,
        body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim() || null }),
      });
      await refreshUser();
      setPersonalSuccess("Personal info saved.");
    } catch (err) {
      setPersonalError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setPersonalSaving(false); }
  };

  const saveWork = async () => {
    if (!accessToken) return;
    setWorkSaving(true); setWorkError(""); setWorkSuccess("");
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH", token: accessToken,
        body: JSON.stringify({
          employee_code: employeeCode.trim() || null,
          department: department.trim() || null,
          job_title: jobTitle.trim() || null,
        }),
      });
      await refreshUser();
      setWorkSuccess("Work info saved.");
    } catch (err) {
      setWorkError(err instanceof Error ? err.message : "Failed to save.");
    } finally { setWorkSaving(false); }
  };

  const savePassword = async () => {
    if (!accessToken) return;
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    setPwSaving(true); setPwError(""); setPwSuccess("");
    try {
      await apiFetch("/api/users/me/password", {
        method: "PATCH", token: accessToken,
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPwSuccess("Password changed successfully.");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password.");
    } finally { setPwSaving(false); }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const readCls = "px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic";
  const btnCls = "px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* ── Personal Info ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Personal Info</h2>

        {personalSuccess && <SuccessBanner message={personalSuccess} onDismiss={() => setPersonalSuccess("")} />}
        {personalError && <ErrorBanner message={personalError} onDismiss={() => setPersonalError("")} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              className={inputCls} placeholder="Your full name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-gray-400">(read only)</span></label>
            <div className={readCls}>{user?.email}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className={inputCls} placeholder="+234 800 000 0000" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={savePersonal} disabled={personalSaving} className={btnCls}>
            {personalSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Work Info ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Work Info</h2>

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
              className={inputCls} placeholder="e.g. Finance, Marketing" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Job Title</label>
            <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
              className={inputCls} placeholder="e.g. Senior Accountant" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={saveWork} disabled={workSaving} className={btnCls}>
            {workSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ── Change Password ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Change Password</h2>

        {pwSuccess && <SuccessBanner message={pwSuccess} onDismiss={() => setPwSuccess("")} />}
        {pwError && <ErrorBanner message={pwError} onDismiss={() => setPwError("")} />}

        <div className="grid grid-cols-1 gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputCls} placeholder="Enter current password" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputCls} placeholder="Repeat new password" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={savePassword} disabled={pwSaving} className={btnCls}>
            {pwSaving ? "Changing…" : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
