/**
 * Root layout — ZivaBI frontend.
 *
 * Wraps every page in the application. Sets global HTML metadata and applies
 * the base font/theme classes. As the design system matures, global providers
 * (theme, auth context, toast notifications) will be added here so that all
 * child pages inherit them automatically via React's context tree.
 *
 * Next.js App Router: this file is a Server Component by default, so it runs
 * on the server — do not add "use client" here. Client-side providers should
 * be extracted into a separate ClientProviders component and composed here.
 */

import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: {
    default: "ZivaBI",
    template: "%s | ZivaBI",
  },
  description:
    "Intelligent finance and operations automation platform — zero manual work, 100% automation.",
  manifest: "/manifest.json", // PWA manifest (added in a future milestone)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* AuthProvider is a Client Component — Next.js App Router handles the boundary */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
