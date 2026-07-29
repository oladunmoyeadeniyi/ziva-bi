"use client";

/**
 * Leave Management page — M15.
 * Lists leave requests and their approval status.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface LeaveRequest {
  id: string;
  employee_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-600",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function LeavePage() {
  const { accessToken } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<LeaveRequest[]>("/api/payroll/leave/requests", { token: accessToken })
      .then(setRequests)
      .catch(() => setError("Failed to load leave requests."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleApprove = async (id: string) => {
    try {
      await apiFetch(`/api/payroll/leave/requests/${id}/approve`, { token: accessToken!, method: "POST" });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "APPROVED" } : r));
    } catch (err: any) { setError(err?.message || "Failed to approve."); }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Rejection reason:");
    if (!reason) return;
    try {
      await apiFetch(`/api/payroll/leave/requests/${id}/reject`, {
        token: accessToken!, method: "POST", body: { rejection_reason: reason },
      });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "REJECTED" } : r));
    } catch (err: any) { setError(err?.message || "Failed to reject."); }
  };

  return (
    <PageContainer>
      <PageHeading title="Leave Management" />

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Leave Type</th>
              <th className="px-4 py-3 text-left">Start</th>
              <th className="px-4 py-3 text-left">End</th>
              <th className="px-4 py-3 text-center">Days</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              : requests.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No leave requests.</td></tr>
              : requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.employee_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.leave_type_name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.start_date}</td>
                  <td className="px-4 py-3 text-gray-500">{r.end_date}</td>
                  <td className="px-4 py-3 text-center font-medium">{r.days_requested}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center flex gap-2 justify-center">
                    {r.status === "PENDING" && (
                      <>
                        <button onClick={() => handleApprove(r.id)} className="text-xs text-green-600 hover:underline">Approve</button>
                        <button onClick={() => handleReject(r.id)} className="text-xs text-red-500 hover:underline">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
