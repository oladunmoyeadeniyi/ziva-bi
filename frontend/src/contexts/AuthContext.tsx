"use client";

/**
 * ZivaBI — Auth context.
 *
 * Provides authentication state and actions to every client component.
 * Wrap the app root with <AuthProvider> (done in app/layout.tsx).
 *
 * State:
 *   accessToken  — short-lived JWT kept in memory (lost on page refresh).
 *                  While impersonating a tenant, this becomes the impersonation
 *                  token so all existing pages "just work" without changes.
 *   user         — current user profile (also cached in localStorage).
 *   isLoading    — true while restoring session on mount.
 *   impersonation — active impersonation session, or null.
 *
 * Impersonation (M9.3b):
 *   - enterTenant() calls /enter, stores the impersonation token in memory +
 *     sessionStorage (tab-scoped, transient), and overrides accessToken.
 *   - exitImpersonation() restores accessToken to the base super-admin token.
 *   - The super admin's refresh token in localStorage is NEVER touched.
 *   - On page refresh while impersonating: base session is restored via the
 *     localStorage refresh token, then sessionStorage impersonation is rehydrated.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  first_name?: string | null;
  account_type: "individual" | "business";
  tenant_id: string | null;
  is_super_admin: boolean;
  is_tenant_admin: boolean;
  has_non_admin_role: boolean;
  role_tier?: "power_admin" | "functional_admin" | null;
  employee_code?: string | null;
  department?: string | null;
  job_title?: string | null;
  phone?: string | null;
  totp_enabled?: boolean;
}

export interface ImpersonationState {
  token: string;
  mode: "implementation" | "support" | "user";
  environment: "live" | "test";
  tenantId: string;
  tenantName: string;
  // Only set when mode === "user" (M9.3b user-level impersonation)
  sessionId?: string;
  targetUser?: { id: string; fullName: string; role: string | null };
  // M9.3b fix: true when user impersonation was started from INSIDE a tenant context
  // (Entry Point 2 — employee list). False/absent = started from platform portal (EP1).
  // Used by exitUserImpersonation to decide whether to restore tenant context or go to /platform.
  hadPriorTenantContext?: boolean;
  // URL to return to when exiting user impersonation — captured at start time so the SA
  // is taken back to exactly where they came from (tenant detail page for EP1, employees
  // page for EP2) rather than the generic /platform root.
  returnUrl?: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user?: AuthUser;
  must_change_password?: boolean;
}

interface EnterTenantResponse {
  access_token: string;
  token_type: string;
  impersonation_mode: string;
  environment: string;
  tenant_id: string;
  tenant_name: string;
}

interface UserImpersonateResponse {
  access_token: string;
  session_id: string;
  target_user: { id: string; full_name: string; email: string; role: string | null };
}

export interface SignupData {
  account_type: "individual" | "business";
  email: string;
  password: string;
  full_name: string;
  company_name?: string;
  company_country?: string;
  // Trial lead qualification fields (step 2 of signup)
  phone?: string;
  job_title?: string;
  company_size?: string;
  interested_modules?: string[];
  preferred_posting_mode?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  /** Effective token: impersonation token while impersonating, base token otherwise. */
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  impersonation: ImpersonationState | null;
  signup: (data: SignupData) => Promise<void>;
  login: (email: string, password: string) => Promise<{ user?: AuthUser; must_change_password?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Enter a tenant as a super admin. Navigating to the tenant dashboard is the caller's responsibility. */
  enterTenant: (tenantId: string, environment?: "live" | "test") => Promise<void>;
  /** Clear impersonation and restore the base super-admin session. */
  exitImpersonation: () => void;
  /**
   * Enter a specific user's identity (M9.3b).
   *
   * Two calling contexts:
   *  - From within an existing tenant context (Entry Point 2 — employee list):
   *    tenantContext is omitted; tenant info is read from impersonation state.
   *  - From the platform portal (Entry Point 1 — user list on tenant detail page):
   *    the SA has no tenant context yet, so pass tenantContext explicitly.
   *
   * Navigating to /dashboard/business is the caller's responsibility.
   */
  startUserImpersonation: (
    targetUserId: string,
    entryPoint: "user_list" | "employee_list",
    tenantContext?: { tenantId: string; tenantName: string; environment: string },
  ) => Promise<void>;
  /**
   * Exit user-level impersonation (M9.3b).
   *
   * Calls the backend end-session endpoint, then either:
   *  - Restores the prior tenant-level context (if user impersonation started from EP2 —
   *    inside a tenant context), returning false.
   *  - Clears impersonation entirely (if started from EP1 — platform portal), returning true.
   *    When true, the caller is responsible for navigating to /platform.
   */
  exitUserImpersonation: () => Promise<boolean>;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const REFRESH_KEY = "ziva_refresh_token";
const USER_KEY = "ziva_user";
const IMPERSONATION_KEY = "ziva_impersonation"; // sessionStorage — tab-scoped
// M9.3b fix: the implementation token held before user impersonation starts.
// Persisted to sessionStorage (not just memory) so it survives a page refresh
// mid-session — enabling correct EP2 restore even after a refresh.
const PRIOR_TOKEN_KEY = "ziva_prior_imp_token"; // sessionStorage — tab-scoped

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Base super-admin (or regular user) access token — never overwritten by impersonation.
  const [_accessToken, _setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  // M9.3b: original SA token saved when user-level impersonation starts, so it can
  // be restored when the SA exits user impersonation (returns to tenant context).
  const [_originalSAToken, _setOriginalSAToken] = useState<string | null>(null);
  // M9.3b fix: original SA user profile saved when user-level impersonation starts.
  // During user impersonation, `user` is swapped to the target user's profile so that
  // all components (sidebar isAdmin, header name, etc.) reflect what the target user sees.
  const [_originalUser, _setOriginalUser] = useState<AuthUser | null>(null);

  // Effective token exposed to consumers: impersonation token takes precedence.
  const accessToken = impersonation?.token ?? _accessToken;

  // ── Persist helpers ───────────────────────────────────────────────────────

  const saveSession = (data: AuthResponse) => {
    _setAccessToken(data.access_token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    if (data.user) {
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
  };

  const clearSession = () => {
    _setAccessToken(null);
    setUser(null);
    setImpersonation(null);
    _setOriginalSAToken(null);
    _setOriginalUser(null);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(IMPERSONATION_KEY);
    sessionStorage.removeItem(PRIOR_TOKEN_KEY);
  };

  // ── Restore session on mount ──────────────────────────────────────────────

  useEffect(() => {
    const restore = async () => {
      const storedRefresh = localStorage.getItem(REFRESH_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (!storedRefresh) {
        setIsLoading(false);
        return;
      }

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // ignore malformed cache
        }
      }

      try {
        const data = await apiFetch<AuthResponse>("/api/auth/refresh-token", {
          method: "POST",
          body: JSON.stringify({ refresh_token: storedRefresh }),
        });
        _setAccessToken(data.access_token);
        localStorage.setItem(REFRESH_KEY, data.refresh_token);

        // Rehydrate impersonation from sessionStorage (survives page refresh).
        const storedImp = sessionStorage.getItem(IMPERSONATION_KEY);
        if (storedImp) {
          try {
            const parsedImp = JSON.parse(storedImp) as ImpersonationState;
            setImpersonation(parsedImp);

            // M9.3b fix: if user impersonation was active when the page refreshed,
            // re-fetch the target user's profile so `user` reflects the impersonated
            // identity rather than the SA's own profile. _originalUser is in memory
            // only (lost on refresh) so we can't restore it here — the SA profile
            // stays in localStorage and will be restored when the user exits impersonation.
            if (parsedImp.mode === "user" && parsedImp.token) {
              try {
                const targetProfile = await apiFetch<AuthUser>("/api/users/me", {
                  token: parsedImp.token,
                });
                setUser(targetProfile);
                // Do NOT update localStorage — SA profile must stay there for restore on exit.
              } catch {
                // Impersonation token expired; clear user impersonation so the SA
                // doesn't get stuck seeing stale/wrong UI after a refresh.
                const restoredImp: ImpersonationState | null = parsedImp.hadPriorTenantContext
                  ? { token: "", mode: "implementation", environment: parsedImp.environment, tenantId: parsedImp.tenantId, tenantName: parsedImp.tenantName }
                  : null;
                // Token is gone — we can't rebuild the implementation context without
                // re-entering. Clear everything and let the SA log in / re-enter.
                setImpersonation(restoredImp);
                if (!restoredImp) sessionStorage.removeItem(IMPERSONATION_KEY);
              }
            }
          } catch {
            sessionStorage.removeItem(IMPERSONATION_KEY);
          }
        }
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signup = useCallback(async (data: SignupData) => {
    const res = await apiFetch<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    saveSession(res);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ user?: AuthUser; must_change_password?: boolean }> => {
    const res = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(res);
    return { user: res.user, must_change_password: res.must_change_password ?? false };
  }, []);

  const refreshUser = useCallback(async () => {
    const token = _accessToken;
    if (!token) return;
    try {
      const updated = await apiFetch<AuthUser>("/api/users/me", { token });
      setUser(updated);
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
    } catch {
      // non-fatal — user stays as-is
    }
  }, [_accessToken]);

  const logout = useCallback(async () => {
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    try {
      if (storedRefresh && _accessToken) {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          token: _accessToken,
          body: JSON.stringify({ refresh_token: storedRefresh }),
        });
      }
    } catch {
      // Logout is best-effort — clear local state regardless
    } finally {
      clearSession();
    }
  }, [_accessToken]);

  // ── Impersonation actions ─────────────────────────────────────────────────

  const enterTenant = useCallback(async (
    tenantId: string,
    environment?: "live" | "test",
  ): Promise<void> => {
    // Always use the base token (super admin's own) to call /enter.
    const baseToken = _accessToken;
    if (!baseToken) throw new Error("Not authenticated.");

    const res = await apiFetch<EnterTenantResponse>(
      `/api/platform/tenants/${tenantId}/enter`,
      {
        method: "POST",
        token: baseToken,
        body: environment ? { environment } : undefined,
      },
    );

    const imp: ImpersonationState = {
      token: res.access_token,
      mode: res.impersonation_mode as "implementation" | "support",
      environment: res.environment as "live" | "test",
      tenantId: res.tenant_id,
      tenantName: res.tenant_name,
    };

    setImpersonation(imp);
    sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(imp));
  }, [_accessToken]);

  const exitImpersonation = useCallback(() => {
    setImpersonation(null);
    _setOriginalSAToken(null);
    // Restore original SA user if we were in user impersonation mode.
    if (_originalUser) {
      setUser(_originalUser);
      _setOriginalUser(null);
    }
    sessionStorage.removeItem(IMPERSONATION_KEY);
    sessionStorage.removeItem(PRIOR_TOKEN_KEY);
    // accessToken automatically reverts to _accessToken (base super-admin token).
  }, [_originalUser]);

  // M9.3b — user-level impersonation ─────────────────────────────────────────

  const startUserImpersonation = useCallback(async (
    targetUserId: string,
    entryPoint: "user_list" | "employee_list",
    tenantContext?: { tenantId: string; tenantName: string; environment: string },
  ): Promise<void> => {
    // Resolve which token and tenant info to use.
    // Entry Point 1 (platform portal, no existing tenant context): use the base SA
    // token and explicit tenantContext. Entry Point 2 (inside tenant): use the
    // existing impersonation token and impersonation state for tenant info.
    const callerToken = impersonation?.token ?? _accessToken;
    const tenantId = tenantContext?.tenantId ?? impersonation?.tenantId;
    const tenantName = tenantContext?.tenantName ?? impersonation?.tenantName ?? "";
    const environment = tenantContext?.environment ?? impersonation?.environment ?? "live";

    if (!callerToken) throw new Error("Not authenticated.");
    if (!tenantId) throw new Error("No tenant context — pass tenantContext explicitly when calling from the platform portal.");

    const res = await apiFetch<UserImpersonateResponse>(
      `/api/platform/tenants/${tenantId}/users/${targetUserId}/impersonate`,
      { method: "POST", token: callerToken, body: { entry_point: entryPoint } },
    );

    // Save the current token (tenant-level or base SA) so we can restore it on exit.
    // Persisted to sessionStorage so it survives a page refresh mid-session —
    // without this, a refresh during EP2 user impersonation loses the implementation
    // token and exitUserImpersonation cannot restore tenant context.
    _setOriginalSAToken(callerToken);
    sessionStorage.setItem(PRIOR_TOKEN_KEY, callerToken);

    const newImp: ImpersonationState = {
      token: res.access_token,
      mode: "user",
      environment: environment as "live" | "test",
      tenantId,
      tenantName,
      sessionId: res.session_id,
      targetUser: {
        id: res.target_user.id,
        fullName: res.target_user.full_name,
        role: res.target_user.role,
      },
      // M9.3b fix: record whether we had a prior tenant context (EP2) so exitUserImpersonation
      // knows whether to restore the tenant context or clear entirely and return to platform.
      hadPriorTenantContext: !!impersonation,
      // Capture the caller's current URL so the SA is returned to exactly the right page
      // on exit (tenant detail for EP1, employees/cost-centers page for EP2).
      returnUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
    };

    setImpersonation(newImp);
    sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(newImp));

    // M9.3b fix: swap `user` to the target user's profile so every component that reads
    // `user` (sidebar isAdmin check, header, profile page, etc.) reflects what the
    // target user actually sees — not the SA's own super-admin profile.
    // Save the SA's profile first so we can restore it on exit.
    _setOriginalUser(user);
    try {
      const targetProfile = await apiFetch<AuthUser>("/api/users/me", {
        token: res.access_token,
      });
      setUser(targetProfile);
      // Do NOT write to localStorage — SA profile must stay there so it can be
      // restored if the page is refreshed during user impersonation.
    } catch {
      // Non-fatal: if the profile fetch fails, user state stays as the SA's profile.
      // Components will degrade gracefully (may show SA-level UI for the target user).
    }
  }, [impersonation, _accessToken, user]);

  const exitUserImpersonation = useCallback(async (): Promise<boolean> => {
    const sessionId = impersonation?.sessionId;
    // Prefer in-memory value; fall back to sessionStorage for the page-refresh case
    // where _originalSAToken was lost from memory but we persisted it before reloading.
    const restoredToken = _originalSAToken ?? sessionStorage.getItem(PRIOR_TOKEN_KEY);
    // hadPriorTenantContext is set in startUserImpersonation: true = EP2 (started inside
    // tenant context), false/absent = EP1 (started from platform portal with no tenant context).
    const hadPriorContext = impersonation?.hadPriorTenantContext ?? false;

    // Best-effort: notify backend the session ended (use the original SA / tenant token).
    if (sessionId && restoredToken) {
      try {
        await apiFetch(`/api/platform/impersonation/${sessionId}/end`, {
          method: "POST",
          token: restoredToken,
        });
      } catch {
        // non-fatal — audit trail still has started_at; ended_at will just be null
      }
    }

    _setOriginalSAToken(null);
    sessionStorage.removeItem(PRIOR_TOKEN_KEY);

    // Restore the SA's original user profile.
    // _originalUser is in memory (set in startUserImpersonation). If the page was
    // refreshed during impersonation it will be null — fall back to localStorage
    // which always holds the SA's own profile (we never overwrite it during impersonation).
    const restoredUser = _originalUser ?? (() => {
      try {
        const stored = localStorage.getItem(USER_KEY);
        return stored ? (JSON.parse(stored) as AuthUser) : null;
      } catch { return null; }
    })();
    if (restoredUser) setUser(restoredUser);
    _setOriginalUser(null);

    if (hadPriorContext && impersonation && restoredToken) {
      // EP2: restore the prior tenant-level implementation context.
      // restoredToken = the implementation/support token from before user impersonation started,
      // which carries tenant_id so all tenant-scoped API calls will work again.
      // Write to sessionStorage FIRST so the reload in the caller picks it up immediately.
      const restoredImp: ImpersonationState = {
        token: restoredToken,
        mode: "implementation",
        environment: impersonation.environment,
        tenantId: impersonation.tenantId,
        tenantName: impersonation.tenantName,
      };
      sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(restoredImp));
      setImpersonation(restoredImp);
      return false; // caller should window.location.reload() — restore() picks up sessionStorage
    } else {
      // EP1 (no prior tenant context) or page was refreshed (restoredToken lost from memory):
      // clear session state and signal the caller to hard-navigate to /platform.
      // The caller uses window.location.replace (not router.push) so the page reloads
      // cleanly from localStorage — avoiding the React async-state race where the platform
      // layout renders before setUser(restoredUser) is applied and sees is_super_admin=false.
      setImpersonation(null);
      sessionStorage.removeItem(IMPERSONATION_KEY);
      return true; // caller should window.location.replace("/platform")
    }
  }, [impersonation, _originalSAToken, _originalUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!accessToken,
        impersonation,
        signup,
        login,
        logout,
        refreshUser,
        enterTenant,
        exitImpersonation,
        startUserImpersonation,
        exitUserImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
