"use client";

/**
 * Consolidation Groups list — IxE Inter-Company Eliminations.
 * Full ERP mode only. Parent tenant sees all groups they own.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import PageContainer from "@/components/PageContainer";
import PageHeading from "@/components/PageHeading";

interface ConsolidationGroup {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  is_active: boolean;
  ic_match_tolerance: number;
  member_count: number;
  created_at: string;
}

export default function ConsolidationPage() {
  const { accessToken } = useAuth();
  const [groups, setGroups] = useState<ConsolidationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<ConsolidationGroup[]>("/api/consolidation/groups", { token: accessToken })
      .then(setGroups)
      .catch(() => setError("Failed to load consolidation groups."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <PageContainer>
      <PageHeading
        title="Consolidation Groups"
        subtitle="Manage group consolidation perimeters and inter-company eliminations"
        actions={
          <Link
            href="/dashboard/business/consolidation/groups/new"
            className="btn-primary"
          >
            + New Group
          </Link>
        }
      />

      {loading && <p className="text-gray-500 py-8 text-center">Loading groups…</p>}
      {error && <p className="text-red-600 py-4">{error}</p>}

      {!loading && groups.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium mb-2">No consolidation groups yet</p>
          <p className="text-sm mb-4">Create your first group to start consolidating inter-company transactions.</p>
          <Link href="/dashboard/business/consolidation/groups/new" className="btn-primary">
            Create Group
          </Link>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="grid gap-4">
          {groups.map((group) => (
            <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between hover:shadow-sm transition">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900">{group.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${group.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {group.is_active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                    {group.currency}
                  </span>
                </div>
                {group.description && (
                  <p className="text-sm text-gray-500 mb-1">{group.description}</p>
                )}
                <p className="text-xs text-gray-400">
                  {group.member_count} {group.member_count === 1 ? "entity" : "entities"}
                  {group.ic_match_tolerance > 0 && ` · Tolerance: ${group.ic_match_tolerance}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/business/consolidation/groups/${group.id}/matches`}
                  className="text-sm text-indigo-600 hover:underline px-3 py-1.5 border border-indigo-200 rounded"
                >
                  IC Matches
                </Link>
                <Link
                  href={`/dashboard/business/consolidation/groups/${group.id}/journals`}
                  className="text-sm text-indigo-600 hover:underline px-3 py-1.5 border border-indigo-200 rounded"
                >
                  Journals
                </Link>
                <Link
                  href={`/dashboard/business/consolidation/groups/${group.id}/members`}
                  className="text-sm text-gray-600 hover:underline px-3 py-1.5 border border-gray-200 rounded"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
