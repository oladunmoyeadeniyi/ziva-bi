"use client";

/**
 * ConsultantLocksContext — provides section lock state for the current tenant.
 *
 * Fetches GET /api/locks once at layout mount. All SectionLockWrapper instances
 * throughout the page tree read from this context so there is only one network
 * request per layout render rather than one per section.
 *
 * Shape returned to consumers:
 *   locks      — map of section_key → lock record (or {} if none)
 *   isLocked   — convenience fn: (key) => boolean
 *   putLock    — calls PUT /api/locks/{key}, returns updated record, triggers refetch
 *   refetch    — re-runs GET /api/locks
 *   loading    — true while the initial fetch is in flight
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LockRecord {
  section_key: string;
  is_locked: boolean;
  lock_note: string | null;
  locked_by_id: string | null;
  locked_at: string;
  unlocked_at: string | null;
}

export interface LocksMap {
  [section_key: string]: LockRecord;
}

export interface ConsultantLocksContextValue {
  locks: LocksMap;
  isLocked: (key: string) => boolean;
  putLock: (
    key: string,
    is_locked: boolean,
    lock_note?: string | null
  ) => Promise<LockRecord>;
  refetch: () => Promise<void>;
  loading: boolean;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ConsultantLocksContext = createContext<ConsultantLocksContextValue>({
  locks: {},
  isLocked: () => false,
  putLock: async () => { throw new Error("ConsultantLocksProvider not mounted"); },
  refetch: async () => {},
  loading: false,
});

// ── Provider ───────────────────────────────────────────────────────────────────

export function ConsultantLocksProvider({
  children,
  accessToken,
}: {
  children: React.ReactNode;
  accessToken: string | null;
}) {
  const [locks, setLocks] = useState<LocksMap>({});
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ locks: LocksMap }>("/api/locks", {
        token: accessToken,
      });
      setLocks(data.locks ?? {});
    } catch {
      // Network error — keep previous state so the UI doesn't break
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const isLocked = useCallback(
    (key: string): boolean => locks[key]?.is_locked ?? false,
    [locks]
  );

  const putLock = useCallback(
    async (
      key: string,
      is_locked: boolean,
      lock_note: string | null = null
    ): Promise<LockRecord> => {
      if (!accessToken) throw new Error("Not authenticated");
      const result = await apiFetch<LockRecord>(`/api/locks/${key}`, {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({ is_locked, lock_note }),
      });
      // Optimistic update — replace this key in the map
      setLocks((prev) => ({ ...prev, [key]: result }));
      return result;
    },
    [accessToken]
  );

  return (
    <ConsultantLocksContext.Provider
      value={{ locks, isLocked, putLock, refetch, loading }}
    >
      {children}
    </ConsultantLocksContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useConsultantLocks(): ConsultantLocksContextValue {
  return useContext(ConsultantLocksContext);
}
