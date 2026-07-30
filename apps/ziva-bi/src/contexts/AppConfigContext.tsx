"use client";

/**
 * AppConfig context — dynamic platform configuration.
 *
 * Provides the platform's `app_name` (and any future public branding fields)
 * to every client component without requiring an extra client-side fetch.
 *
 * The value is fetched once on the server inside the root layout, then passed
 * as a prop to <ClientProviders> which wraps this provider. Client components
 * use the `useAppConfig()` hook to read it.
 *
 * Usage:
 *   const { appName } = useAppConfig();
 */

import React, { createContext, useContext } from "react";

interface AppConfig {
  /** The product name displayed across the UI, emails, and TOTP issuer. */
  appName: string;
}

const AppConfigContext = createContext<AppConfig>({ appName: "Ziva BI" });

export function AppConfigProvider({
  appName,
  children,
}: {
  appName: string;
  children: React.ReactNode;
}) {
  return (
    <AppConfigContext.Provider value={{ appName }}>
      {children}
    </AppConfigContext.Provider>
  );
}

/** Return the platform config. Falls back to "Ziva BI" if provider is absent. */
export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext);
}
