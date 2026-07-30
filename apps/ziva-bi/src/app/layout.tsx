/**
 * Root layout — async Server Component.
 *
 * Fetches public platform config (app name) on the server so client components
 * can read it via useAppConfig() without a client-side fetch. The fetched value
 * is passed as a prop to <ClientProviders>, which injects it into AppConfigContext.
 *
 * Cache strategy: revalidate every 5 minutes — the app name changes at most once
 * in the product lifetime, so a short stale window is fine and avoids hitting the
 * DB on every page request.
 *
 * Next.js App Router: Server Components are allowed to be async. Do not add
 * "use client" here. Any client-side providers live in ClientProviders.tsx.
 */

import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "@/components/ClientProviders";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchAppName(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/api/app-config`, {
      next: { revalidate: 300 }, // 5 minutes
    });
    if (!res.ok) return "Ziva BI";
    const data = await res.json();
    return data.app_name ?? "Ziva BI";
  } catch {
    return "Ziva BI";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const appName = await fetchAppName();
  return {
    title: {
      default: appName,
      template: `%s | ${appName}`,
    },
    description:
      "Intelligent finance and operations automation platform — zero manual work, 100% automation.",
    manifest: "/manifest.json",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appName = await fetchAppName();

  return (
    <html lang="en">
      <head>
        {/* Tabler Icons webfont — outline icon set used throughout the admin UI */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
        />
      </head>
      <body>
        <ClientProviders appName={appName}>{children}</ClientProviders>
      </body>
    </html>
  );
}
