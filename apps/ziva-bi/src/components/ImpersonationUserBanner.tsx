"use client";

/**
 * ImpersonationUserBanner — M9.3b.
 *
 * Persistent, non-dismissable banner shown when a super admin has entered
 * a specific user's identity (mode === "user"). Visually distinct from the
 * existing tenant-level banner (amber/blue) — uses indigo so both can be
 * stacked without confusion when both are active simultaneously.
 */

interface Props {
  fullName: string;
  role: string | null | undefined;
  onExit: () => void;
}

export default function ImpersonationUserBanner({ fullName, role, onExit }: Props) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-4 shrink-0"
      style={{
        height: 36,
        background: "#eef2ff",
        borderBottom: "0.5px solid #a5b4fc",
      }}
    >
      <div className="flex items-center gap-2">
        <i className="ti ti-user-check" style={{ fontSize: 13, color: "#3730a3" }} />
        <span style={{ fontSize: 11, color: "#3730a3" }}>
          Viewing as <strong>{fullName}</strong>
          {role ? <> — {role}</> : null}
        </span>
      </div>
      <button
        type="button"
        onClick={onExit}
        style={{
          fontSize: 11,
          color: "#3730a3",
          border: "1px solid #a5b4fc",
        }}
        className="px-2 py-0.5 rounded bg-white bg-opacity-60 hover:bg-opacity-100 font-medium transition-colors"
      >
        Exit impersonation
      </button>
    </div>
  );
}
