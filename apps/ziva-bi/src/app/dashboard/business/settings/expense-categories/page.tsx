"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExpenseCategoriesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/business/settings/chart-of-accounts");
  }, [router]);
  return null;
}
