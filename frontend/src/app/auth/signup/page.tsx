"use client";

/**
 * Signup page — ZivaBI.
 *
 * Business accounts only. Individual account signup removed (out of scope).
 * On success, user is logged in and redirected to /dashboard.
 */

import { useState, useEffect } from "react";
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

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCountry, setCompanyCountry] = useState("");

  const [countryLoading, setCountryLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const detectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const detectedCode = data.country_code as string;
        if (COUNTRIES.some((c) => c.code === detectedCode)) {
          setCompanyCountry(detectedCode);
        }
      } catch {
        // Silently fall back — user selects manually
      } finally {
        setCountryLoading(false);
      }
    };
    detectCountry();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const payload: SignupData = {
      account_type: "business",
      email,
      password,
      full_name: fullName,
      company_name: companyName,
      company_country: companyCountry,
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
          <p className="mt-2 text-sm text-gray-500">Create your business account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your full name
              </label>
              <p className="text-xs text-gray-500 mb-1">
                This will be your admin account for the company.
              </p>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. John Adeyemi"
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
                placeholder="you@company.com"
              />
            </div>

            {/* Company name */}
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

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              {countryLoading ? (
                <div className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-400 bg-gray-50">
                  Detecting your location…
                </div>
              ) : (
                <select
                  required
                  value={companyCountry}
                  onChange={(e) => setCompanyCountry(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">— Select country —</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
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

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? "Creating account…" : "Create business account"}
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
