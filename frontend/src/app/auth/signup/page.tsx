"use client";

/**
 * Signup page — ZivaBI.
 *
 * Two-step form for business accounts.
 *   Step 1 — Account basics: name, email, company, country, password
 *   Step 2 — Trial intent:   phone, job title, company size,
 *                             modules of interest, preferred posting mode
 *
 * All step-2 fields are optional — user may skip by clicking "Skip for now".
 * On success the user is logged in and redirected to /dashboard.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, SignupData } from "@/contexts/AuthContext";
import { MODULE_CATALOGUE } from "@/lib/modules";

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

const COMPANY_SIZES = [
  { value: "1-10",    label: "1–10 employees" },
  { value: "11-50",   label: "11–50 employees" },
  { value: "51-200",  label: "51–200 employees" },
  { value: "200+",    label: "200+ employees" },
];

const POSTING_MODES = [
  {
    value: "lite",
    label: "Lite Mode",
    description: "Simple approval and cost tracking — no full GL posting.",
  },
  {
    value: "connected",
    label: "Connected Mode",
    description: "Syncs with your existing accounting software via integration.",
  },
  {
    value: "full_erp",
    label: "Full ERP Mode",
    description: "Complete double-entry GL, trial balance, and financial reporting.",
  },
];

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// ── Component ─────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();

  // Step 1 fields
  const [fullName, setFullName]             = useState("");
  const [email, setEmail]                   = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName]       = useState("");
  const [companyCountry, setCompanyCountry] = useState("");
  const [countryLoading, setCountryLoading] = useState(true);

  // Step 2 fields
  const [phone, setPhone]                       = useState("");
  const [jobTitle, setJobTitle]                 = useState("");
  const [companySize, setCompanySize]           = useState("");
  const [selectedModules, setSelectedModules]   = useState<string[]>([]);
  const [postingMode, setPostingMode]           = useState("full_erp");

  // UI state
  const [step, setStep]     = useState<1 | 2>(1);
  const [error, setError]   = useState("");
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

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setStep(2);
  }

  function toggleModule(key: string) {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function submitSignup(skipStep2 = false) {
    setError("");
    setLoading(true);

    const payload: SignupData = {
      account_type: "business",
      email,
      password,
      full_name: fullName,
      company_name: companyName,
      company_country: companyCountry,
      ...(skipStep2
        ? {}
        : {
            phone: phone || undefined,
            job_title: jobTitle || undefined,
            company_size: companySize || undefined,
            interested_modules: selectedModules.length > 0 ? selectedModules : undefined,
            preferred_posting_mode: postingMode || undefined,
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
  }

  // ── Step indicator ─────────────────────────────────────────────────────────

  function StepIndicator() {
    return (
      <div className="flex items-center gap-2 mb-6">
        {([1, 2] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step >= s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            {s < 2 && (
              <div
                className={`h-0.5 w-10 transition-colors ${
                  step > s ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-xs text-gray-500">
          {step === 1 ? "Account basics" : "What you're planning to use"}
        </span>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ZivaBI</h1>
          <p className="mt-2 text-sm text-gray-500">Create your business account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <StepIndicator />

          {/* ── STEP 1 ─────────────────────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
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
                  className={inputCls}
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
                  className={inputCls}
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
                  className={inputCls}
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
                    className={inputCls}
                  >
                    <option value="">&#x2014; Select country &#x2014;</option>
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
                  className={inputCls}
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
                  className={inputCls}
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
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors mt-2"
              >
                Continue →
              </button>
            </form>
          )}

          {/* ── STEP 2 ─────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500">
                Help us set up the right trial for you. All fields are optional —
                you can fill this in later from your account settings.
              </p>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone number <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  placeholder="+234 800 000 0000"
                />
              </div>

              {/* Job title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your job title <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. CFO, Finance Manager, Accountant"
                />
              </div>

              {/* Company size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company size <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className={inputCls}
                >
                  <option value="">&#x2014; Select size &#x2014;</option>
                  {COMPANY_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modules of interest */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Which modules are you interested in?{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_CATALOGUE.map((m) => {
                    const checked = selectedModules.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-xs transition-colors ${
                          checked
                            ? "border-blue-500 bg-blue-50 text-blue-800"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleModule(m.key)}
                        />
                        <span
                          className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                            checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                          }`}
                        >
                          {checked && (
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="none"
                              viewBox="0 0 10 10"
                            >
                              <path
                                d="M1.5 5l2.5 2.5 4.5-4.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                        {m.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Preferred posting mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How do you want to manage your financials?{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="space-y-2">
                  {POSTING_MODES.map((m) => {
                    const selected = postingMode === m.value;
                    return (
                      <label
                        key={m.value}
                        className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                          selected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="posting_mode"
                          value={m.value}
                          checked={selected}
                          onChange={() => setPostingMode(m.value)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className={`text-sm font-medium ${selected ? "text-blue-800" : "text-gray-800"}`}>
                            {m.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => submitSignup(false)}
                  disabled={loading}
                  className="flex-2 flex-grow rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Creating account…" : "Start free trial →"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => submitSignup(true)}
                disabled={loading}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
              >
                Skip for now — I'll fill this in later
              </button>
            </div>
          )}

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
