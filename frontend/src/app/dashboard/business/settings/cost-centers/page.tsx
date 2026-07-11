"use client";

/**
 * Cost Centers page — removed.
 * Department heads are now determined by whoever occupies the role with
 * designation = "head_of_department" for that cost centre (Role Hierarchy).
 * Redirects to Organisation → Role Hierarchy.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CostCentersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/business/setup/organisation");
  }, [router]);
  return null;
}
