"use client";

/**
 * Reset-password page — ZivaBI.
 *
 * Loaded from the link in the password reset email:
 *   /auth/reset-password?token=<raw-token>
 *
 * useSearchParams() requires a <Suspense> boundary in Next.js 15 App Router.
 * The inner component (ResetPasswordContent) holds all the logic; the default
 * export wraps it in <Suspense> per the project-wide convention.
 */

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppConfig } from "@/contexts/AppConfigContext";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function ResetPasswordContent() {
  const { appName } = useAppConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail ?? "Failed to reset password. The link may have expired.");
      }
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{appName}</h1>
          <p className="mt-2 text-sm text-gray-500">Set a new password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Password reset successfully</h2>
              <p className="text-sm text-gray-600">
                Your password has been updated. Redirecting you to sign in…
              </p>
              <Link
                href="/auth/login"
                className="inline-block mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Sign in now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>

              <p className="text-center text-sm text-gray-500">
                Link expired?{" "}
                <Link href="/auth/forgot-password" className="font-semibold text-blue-600 hover:text-blue-700">
                  Request a new one
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-400">Loading…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
