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
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user?: AuthUser;
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
}

interface AuthContextType {
  user: AuthUser | null;
  /** Effective token: impersonation token while impersonating, base token otherwise. */
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  impersonation: ImpersonationState | null;
  signup: (data: SignupData) => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser | undefined>;
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
   * Exit user-level impersonation and restore the tenant-level context (M9.3b).
   * Calls the backend end-session endpoint, then restores the pre-impersonation token.
   */
  exitUserImpersonation: () => Promise<void>;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const REFRESH_KEY = "ziva_refresh_token";
const USER_KEY = "ziva_user";
const IMPERSONATION_KEY = "ziva_impersonation"; // sessionStorage — tab-scoped

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
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(IMPERSONATION_KEY);
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
            setImpersonation(JSON.parse(storedImp) as ImpersonationState);
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

  const login = useCallback(async (email: string, password: string): Promise<AuthUser | undefined> => {
    const res = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(res);
    return res.user;
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
    sessionStorage.removeItem(IMPERSONATION_KEY);
    // accessToken automatically reverts to _accessToken (base super-admin token).
  }, []);

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
    _setOriginalSAToken(callerToken);

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
    };

    setImpersonation(newImp);
    sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(newImp));
  }, [impersonation, _accessToken]);

  const exitUserImpersonation = useCallback(async (): Promise<void> => {
    const sessionId = impersonation?.sessionId;
    const restoredToken = _originalSAToken;

    // Best-effort: notify backend the session ended (use the original SA token).
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

    // Restore tenant-level impersonation state using the saved token.
    if (impersonation && restoredToken) {
      const restoredImp: ImpersonationState = {
        token: restoredToken,
        mode: impersonation.mode === "user"
          ? ("implementation" as const)  // fall back to implementation; caller can override
          : impersonation.mode,
        environment: impersonation.environment,
        tenantId: impersonation.tenantId,
        tenantName: impersonation.tenantName,
      };
      setImpersonation(restoredImp);
      sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(restoredImp));
    } else {
      setImpersonation(null);
      sessionStorage.removeItem(IMPERSONATION_KEY);
    }

    _setOriginalSAToken(null);
  }, [impersonation, _originalSAToken]);

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

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
