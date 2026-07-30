"use client";

/**
 * Self-onboarding page — /onboard/[token]
 *
 * Public route (no auth required). New hire visits this link from their invite email.
 * Validates the token, shows a form to collect personal/financial/emergency details,
 * and submits to the backend. Sets employee status to pending_hr_approval on submit.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface TokenInfo {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  tenant_name: string;
  start_date: string | null;
}

interface FormData {
  other_name: string;
  preferred_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  residential_address: string;
  nin: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  bvn: string;
}

const EMPTY_FORM: FormData = {
  other_name: "",
  preferred_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  residential_address: "",
  nin: "",
  emergency_contact_name: "",
  emergency_contact_relationship: "",
  emergency_contact_phone: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
  bvn: "",
};

export default function SelfOnboardingPage() {
  const params = useParams();
  const token = params.token as string;

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`${BASE}/onboard/${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setTokenError(body.detail ?? "This link is invalid or has expired.");
          return;
        }
        const data: TokenInfo = await res.json();
        setTokenInfo(data);
      } catch {
        setTokenError("Unable to validate your onboarding link. Please check your internet connection.");
      } finally {
        setLoading(false);
      }
    }
    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${BASE}/onboard/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.detail ?? "Submission failed. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: keyof FormData, label: string, type = "text", required = false) => (
    <div key={key}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Validating your link…</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-red-200 p-6 text-center">
          <i className="ti ti-link-off text-red-400 mb-3" style={{ fontSize: 28 }} />
          <h1 className="text-base font-semibold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-sm text-gray-500">{tokenError}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm w-full bg-white rounded-xl border border-green-200 p-6 text-center">
          <i className="ti ti-circle-check text-green-500 mb-3" style={{ fontSize: 28 }} />
          <h1 className="text-base font-semibold text-gray-900 mb-2">Details submitted</h1>
          <p className="text-sm text-gray-500">
            Thank you, {tokenInfo?.first_name}. Your details have been sent to HR for review.
            You will be notified once your record is approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Welcome, {tokenInfo?.first_name}!</h1>
          <p className="text-sm text-gray-500 mt-1">
            Please fill in your personal details to complete your onboarding with {tokenInfo?.tenant_name}.
          </p>
          {tokenInfo?.start_date && (
            <p className="text-xs text-gray-400 mt-1">Start date: {tokenInfo.start_date}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {submitError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* Personal */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Personal details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("other_name", "Other name")}
              {field("preferred_name", "Preferred name")}
              {field("date_of_birth", "Date of birth", "date")}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Prefer not to say</option>
                </select>
              </div>
              {field("phone", "Phone number")}
              {field("nin", "NIN (National Identification Number)")}
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Residential address</label>
              <textarea value={form.residential_address} rows={2}
                onChange={(e) => setForm((f) => ({ ...f, residential_address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Emergency contact */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Emergency contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("emergency_contact_name", "Full name")}
              {field("emergency_contact_relationship", "Relationship")}
              {field("emergency_contact_phone", "Phone number")}
            </div>
          </div>

          {/* Financial */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Financial details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("bank_name", "Bank name")}
              {field("bank_account_number", "Account number")}
              {field("bank_account_name", "Account name")}
              {field("bvn", "BVN (Bank Verification Number)")}
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" disabled={submitting}
              className="w-full py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {submitting ? "Submitting…" : "Submit my details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
