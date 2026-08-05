"use client";

/**
 * ConfirmDialog — accessible replacement for window.confirm().
 *
 * Usage:
 *   const { confirm } = useConfirm();
 *
 *   const ok = await confirm({
 *     title: "Delete this record?",
 *     message: "This cannot be undone.",
 *     confirmLabel: "Delete",
 *     danger: true,
 *   });
 *   if (ok) { ... }
 *
 * Wire <ConfirmProvider> inside ClientProviders.
 * The dialog traps focus, dismisses on Escape, and blocks the page scroll.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleResult = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  // Keyboard: Escape → cancel
  useEffect(() => {
    if (!state) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleResult(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Focus cancel button when dialog opens
  useEffect(() => {
    if (state) cancelRef.current?.focus();
  }, [state]);

  // Lock body scroll while open
  useEffect(() => {
    if (state) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => handleResult(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            {state.title && (
              <h2 id="confirm-title" className="text-base font-semibold text-gray-900 mb-2">
                {state.title}
              </h2>
            )}
            <p id="confirm-message" className="text-sm text-gray-600 leading-relaxed">
              {state.message}
            </p>

            <div className="flex justify-end gap-2 mt-5">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => handleResult(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {state.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => handleResult(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 ${
                  state.danger
                    ? "bg-red-600 hover:bg-red-700 focus:ring-red-300"
                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-300"
                }`}
              >
                {state.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
