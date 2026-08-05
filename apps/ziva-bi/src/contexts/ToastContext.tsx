"use client";

/**
 * ToastContext — lightweight global toast/notification system.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Saved successfully");
 *   toast.error("Something went wrong");
 *   toast.info("Email sent");
 *
 * Toasts auto-dismiss after 4 seconds. Error toasts stay for 6 seconds.
 * A maximum of 5 toasts are shown simultaneously (FIFO eviction).
 *
 * The ToastContainer renders itself into a fixed portal at the bottom-right.
 * Wire <ToastProvider> into ClientProviders above <AuthProvider>.
 */

import { createContext, useCallback, useContext, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  exiting?: boolean;
}

interface ToastAPI {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

interface ToastContextValue {
  toast: ToastAPI;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

const KIND_STYLES: Record<ToastKind, { bg: string; text: string; icon: string }> = {
  success: { bg: "bg-green-600",  text: "text-white", icon: "ti-circle-check" },
  error:   { bg: "bg-red-600",    text: "text-white", icon: "ti-circle-x" },
  info:    { bg: "bg-blue-600",   text: "text-white", icon: "ti-info-circle" },
  warning: { bg: "bg-amber-500",  text: "text-white", icon: "ti-alert-triangle" },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Trigger exit animation, then remove
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, 280);
  }, []);

  const add = useCallback((kind: ToastKind, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => {
      const next = [...prev, { id, kind, message }];
      // Evict oldest if over limit
      if (next.length > MAX_TOASTS) {
        const evict = next[0];
        const existing = timers.current.get(evict.id);
        if (existing) clearTimeout(existing);
        return next.slice(1);
      }
      return next;
    });
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS[kind]);
    timers.current.set(id, timer);
  }, [dismiss]);

  const toast: ToastAPI = {
    success: (msg) => add("success", msg),
    error:   (msg) => add("error", msg),
    info:    (msg) => add("info", msg),
    warning: (msg) => add("warning", msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── ToastContainer ────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map(t => {
        const style = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg max-w-sm
              ${style.bg} ${style.text}
              transition-all duration-200 ease-out
              ${t.exiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
            `}
            role="status"
          >
            <i className={`ti ${style.icon} mt-0.5 shrink-0`} style={{ fontSize: 16 }} />
            <p className="text-sm font-medium leading-snug flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="opacity-70 hover:opacity-100 transition-opacity ml-1 shrink-0"
              aria-label="Dismiss"
            >
              <i className="ti ti-x" style={{ fontSize: 14 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
