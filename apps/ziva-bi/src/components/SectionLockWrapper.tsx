"use client";

/**
 * SectionLockWrapper — wraps any setup section with consultant locking support.
 *
 * Three states:
 *   1. Unlocked + not a consultant → renders children as-is (zero overhead).
 *   2. Locked + power_admin/functional_admin → amber banner + disabled overlay
 *      (pointer-events: none, opacity 0.55). The user can still scroll and read.
 *   3. Consultant (SA in implementation mode) → cyan lock/unlock toggle button
 *      at top-right + optional note textarea when locking.
 *
 * Usage:
 *   <SectionLockWrapper sectionKey="chart_of_accounts" title="Chart of Accounts">
 *     <YourFormOrTable />
 *   </SectionLockWrapper>
 *
 * Props:
 *   sectionKey — must match one of VALID_SECTION_KEYS in the backend model.
 *   title      — optional; shown in the lock banner for clarity.
 *   children   — the page content to gate.
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConsultantLocks } from "@/contexts/ConsultantLocksContext";

interface SectionLockWrapperProps {
  sectionKey: string;
  title?: string;
  children: React.ReactNode;
}

export default function SectionLockWrapper({
  sectionKey,
  title,
  children,
}: SectionLockWrapperProps) {
  const { user, impersonation } = useAuth();
  const { locks, isLocked, putLock } = useConsultantLocks();
  const [saving, setSaving] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const locked = isLocked(sectionKey);
  const lockRecord = locks[sectionKey] ?? null;

  // Is the current user a consultant (SA in implementation mode)?
  const isConsultant =
    !!user?.is_super_admin && impersonation?.mode === "implementation";

  // Is the current user a regular tenant admin who should see the lock banner?
  const isTenantAdmin =
    !isConsultant &&
    (user?.is_tenant_admin ||
      user?.role_tier === "power_admin" ||
      user?.role_tier === "functional_admin");

  // If neither — render children unchanged (employee, viewer, etc.)
  if (!isConsultant && !isTenantAdmin) {
    return <>{children}</>;
  }

  // ── Consultant: lock/unlock controls ───────────────────────────────────────

  async function handleToggle() {
    if (locked) {
      // Unlock immediately — no note required
      setSaving(true);
      try {
        await putLock(sectionKey, false, null);
      } finally {
        setSaving(false);
      }
    } else {
      // Open note dialog before locking
      setNoteOpen(true);
    }
  }

  async function handleConfirmLock() {
    setSaving(true);
    try {
      await putLock(sectionKey, true, noteText.trim() || null);
      setNoteOpen(false);
      setNoteText("");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* ── Consultant controls ── */}
      {isConsultant && (
        <div className="flex items-center justify-end gap-2 mb-3">
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              locked
                ? "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
                : "bg-slate-50 text-slate-700 border border-slate-300 hover:bg-slate-100"
            } disabled:opacity-50`}
          >
            <i className={`ti ti-${locked ? "lock-open" : "lock"}`} style={{ fontSize: 12 }} />
            {saving ? "Saving…" : locked ? "Unlock section" : "Lock section"}
          </button>
          {locked && lockRecord?.lock_note && (
            <span className="text-xs text-amber-700 italic">
              &ldquo;{lockRecord.lock_note}&rdquo;
            </span>
          )}
        </div>
      )}

      {/* ── Lock note dialog ── */}
      {isConsultant && noteOpen && (
        <div className="mb-4 p-4 rounded-lg border border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900 mb-2">
            Add a note for {title ?? "this section"} (optional)
          </p>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Chart of accounts finalized — do not modify without consultant approval."
            maxLength={500}
            rows={2}
            className="w-full text-sm border border-amber-300 rounded px-3 py-2 mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmLock}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? "Locking…" : "Lock section"}
            </button>
            <button
              type="button"
              onClick={() => { setNoteOpen(false); setNoteText(""); }}
              className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Admin lock banner (visible to tenant admins when locked) ── */}
      {!isConsultant && locked && (
        <div className="flex items-start gap-3 mb-4 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50">
          <i className="ti ti-lock text-amber-600 mt-0.5" style={{ fontSize: 16 }} />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {title ? `${title} is locked` : "This section is locked"}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {lockRecord?.lock_note
                ? lockRecord.lock_note
                : "A PRAD consultant has locked this section. Contact your consultant to make changes."}
            </p>
          </div>
        </div>
      )}

      {/* ── Content: disabled overlay when locked (tenant admin view) ── */}
      <div
        style={
          !isConsultant && locked
            ? { pointerEvents: "none", opacity: 0.55, userSelect: "none" }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
