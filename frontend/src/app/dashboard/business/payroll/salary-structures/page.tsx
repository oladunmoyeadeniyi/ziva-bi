"use client";

/**
 * Salary Structures page — M15.
 * Lists and creates salary structures linked to employees.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface SalaryStructure {
  id: string;
  employee_id: string;
  employee_name: string;
  effective_date: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  gross_pay: number;
  currency: string;
  is_active: boolean;
}

export default function SalaryStructuresPage() {
  const { accessToken } = useAuth();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<SalaryStructure[]>("/api/payroll/salary-structures", { token: accessToken })
      .then(setStructures)
      .catch(() => setError("Failed to load salary structures."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const fmt = (n: number) => n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <PageContainer>
      <PageHeading title="Salary Structures" />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Effective Date</th>
              <th className="px-4 py-3 text-right">Basic</th>
              <th className="px-4 py-3 text-right">Housing</th>
              <th className="px-4 py-3 text-right">Transport</th>
              <th className="px-4 py-3 text-right">Gross Pay</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : structures.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No salary structures configured.</td></tr>
              : structures.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.employee_name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.effective_date}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(s.basic_salary)}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(s.housing_allowance)}</td>
                  <td className="px-4 py-3 text-right font-mono">₦{fmt(s.transport_allowance)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">₦{fmt(s.gross_pay)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.is_active ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
