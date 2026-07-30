"use client";

/**
 * Personal dashboard removed — individual account path is out of scope.
 * Redirect any visitor to the login page.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PersonalDashboardRemoved() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/auth/login");
  }, [router]);
  return null;
}
