"use client";

/**
 * ClientProviders — root client-side provider tree.
 *
 * This component exists because the root layout (app/layout.tsx) is a Server
 * Component and cannot render "use client" providers directly. All providers
 * that need React client features are composed here and rendered as a single
 * boundary.
 *
 * Props:
 *   appName  — fetched server-side from /api/app-config, passed in as a prop
 *              so AppConfigProvider does not need a client-side fetch.
 *   children — the rest of the page tree.
 */

import { AuthProvider } from "@/contexts/AuthContext";
import { AppConfigProvider } from "@/contexts/AppConfigContext";

export function ClientProviders({
  appName,
  children,
}: {
  appName: string;
  children: React.ReactNode;
}) {
  return (
    <AppConfigProvider appName={appName}>
      <AuthProvider>{children}</AuthProvider>
    </AppConfigProvider>
  );
}
