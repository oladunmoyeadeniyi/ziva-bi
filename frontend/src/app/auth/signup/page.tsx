"use client";

/**
 * Signup page — ZivaBI.
 *
 * Two-step registration form:
 *   Step 1: Account type selection (Individual or Business)
 *   Step 2: Registration details (adapts based on chosen type)
 *
 * On success, the user is logged in automatically and redirected to their dashboard.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, SignupData } from "@/contexts/AuthContext";

// ── Country list (ISO 3166-1 alpha-2) ────────────────────────────────────────

const COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "ZA", name: "South Africa" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "EG", name: "Egypt" },
  { code: "ET", name: "Ethiopia" },
  { code: "RW", name: "Rwanda" },
].sort((a, b) => a.name.localeCompare(b.name));

const COUNTRY_CURRENCY_MAP: Record<string, { code: string; name: string }> = {
  NG: { code: "NGN", name: "Nigerian Naira" },
  GH: { code: "GHS", name: "Ghanaian Cedi" },
  KE: { code: "KES", name: "Kenyan Shilling" },
  ZA: { code: "ZAR", name: "South African Rand" },
  GB: { code: "GBP", name: "British Pound" },
  US: { code: "USD", name: "US Dollar" },
  CA: { code: "CAD", name: "Canadian Dollar" },
  AU: { code: "AUD", name: "Australian Dollar" },
  DE: { code: "EUR", name: "Euro" },
  FR: { code: "EUR", name: "Euro" },
  NL: { code: "EUR", name: "Euro" },
  AE: { code: "AED", name: "UAE Dirham" },
  SG: { code: "SGD", name: "Singapore Dollar" },
  IN: { code: "INR", name: "Indian Rupee" },
  BR: { code: "BRL", name: "Brazilian Real" },
  JP: { code: "JPY", name: "Japanese Yen" },
  CN: { code: "CNY", name: "Chinese Yuan" },
  EG: { code: "EGP", name: "Egyptian Pound" },
  ET: { code: "ETB", name: "Ethiopian Birr" },
  RW: { code: "RWF", name: "Rwandan Franc" },
};

// ── Component ─────────────────────────────────────────────────────────────────

type AccountType = "individual" | "business";

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType>("individual");

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCountry, setCompanyCountry] = useState("NG");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Step 1: Account type selection ─────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">ZivaBI</h1>
            <p className="mt-2 text-sm text-gray-500">
              Choose your account type to get started
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Individual card */}
            <button
              onClick={() => { setAccountType("individual"); setStep(2); }}
              className="group text-left bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="text-3xl mb-3">👤</div>
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                Individual
              </h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Track your personal finances — expenses, income, budgets,
                bank reconciliation, and tax prep. Mobile-first.
              </p>
              <div className="mt-4 text-xs font-medium text-blue-600">
                Personal account →
              </div>
            </button>

            {/* Business card */}
            <button
              onClick={() => { setAccountType("business"); setStep(2); }}
              className="group text-left bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-blue-500 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="text-3xl mb-3">🏢</div>
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                Business
              </h2>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Full finance and operations platform — expense management,
                AP/AR, payroll, multi-tenant workflows, and more.
              </p>
              <div className="mt-4 text-xs font-medium text-blue-600">
                Company account →
              </div>
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Registration form ───────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const payload: SignupData = {
      account_type: accountType,
      email,
      password,
      full_name: fullName,
      ...(accountType === "business" && {
        company_name: companyName,
        company_country: companyCountry,
      }),
    };

    try {
      await signup(payload);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ZivaBI</h1>
          <p className="mt-2 text-sm text-gray-500">
            {accountType === "individual"
              ? "Create your personal account"
              : "Create your business account"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Back to step 1 */}
          <button
            onClick={() => { setStep(1); setError(""); }}
            className="mb-6 flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            ← Change account type
          </button>

          {/* Account type badge */}
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {accountType === "individual" ? "👤 Personal" : "🏢 Business"}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Adeniyi Oladunmoye"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {/* Business-only fields */}
            {accountType === "business" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company name
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    required
                    value={companyCountry}
                    onChange={(e) => setCompanyCountry(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {companyCountry && COUNTRY_CURRENCY_MAP[companyCountry] && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-xs font-medium text-amber-800 mb-1">
                      Functional currency — locked after go-live (IAS 21)
                    </p>
                    <p className="text-sm font-semibold text-amber-900">
                      {COUNTRY_CURRENCY_MAP[companyCountry].code} —{" "}
                      {COUNTRY_CURRENCY_MAP[companyCountry].name}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Auto-detected from your country. This cannot be changed after go-live.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="At least 8 characters"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
