"use client";

/**
 * ZivaBI — Auth context.
 *
 * Provides authentication state and actions to every client component.
 * Wrap the app root with <AuthProvider> (done in app/layout.tsx).
 *
 * State:
 *   accessToken  — short-lived JWT kept in memory (lost on page refresh)
 *   user         — current user profile (also cached in localStorage)
 *   isLoading    — true while restoring session on mount
 *
 * On mount: checks localStorage for a refresh token and calls /api/auth/refresh-token
 * to restore the access token. If the refresh token is expired or absent, the user
 * is treated as unauthenticated.
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
  account_type: "individual" | "business";
  tenant_id: string | null;
  is_super_admin: boolean;
  is_tenant_admin: boolean;
  has_non_admin_role: boolean;
  /** M8.2: implementation portal role tier */
  role_tier?: "consultant" | "power_admin" | "functional_admin" | null;
  employee_code?: string | null;
  department?: string | null;
  job_title?: string | null;
  phone?: string | null;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user?: AuthUser;
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
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (data: SignupData) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Refresh the stored user object (e.g. after a profile update). */
  refreshUser: () => Promise<void>;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const REFRESH_KEY = "ziva_refresh_token";
const USER_KEY = "ziva_user";

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Persist helpers ───────────────────────────────────────────────────────

  const saveSession = (data: AuthResponse) => {
    setAccessToken(data.access_token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    if (data.user) {
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
  };

  const clearSession = () => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
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

      // Optimistic: show the cached user while the refresh happens
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
        setAccessToken(data.access_token);
        // Rotate the stored refresh token
        localStorage.setItem(REFRESH_KEY, data.refresh_token);
      } catch {
        // Refresh token expired or revoked — force re-login
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveSession(res);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = accessToken;
    if (!token) return;
    try {
      const updated = await apiFetch<AuthUser>("/api/users/me", { token });
      setUser(updated);
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
    } catch {
      // non-fatal — user stays as-is
    }
  }, [accessToken]);

  const logout = useCallback(async () => {
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    try {
      if (storedRefresh && accessToken) {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ refresh_token: storedRefresh }),
        });
      }
    } catch {
      // Logout is best-effort — clear local state regardless
    } finally {
      clearSession();
    }
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!accessToken,
        signup,
        login,
        logout,
        refreshUser,
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
