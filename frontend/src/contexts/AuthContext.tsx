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
  mode: "implementation" | "support";
  environment: "live" | "test";
  tenantId: string;
  tenantName: string;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signup = useCallback(async (data: SignupData) => {
    const res = await apiFetch<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    saveSession(res);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser | undefined> => {
    const res = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(res);
    return res.user;
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    sessionStorage.removeItem(IMPERSONATION_KEY);
    // accessToken automatically reverts to _accessToken (base super-admin token).
  }, []);

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
