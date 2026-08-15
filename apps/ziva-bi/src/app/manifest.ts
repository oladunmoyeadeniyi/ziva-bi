/**
 * PWA Web App Manifest — PRAD Expense
 *
 * Next.js App Router generates /manifest.json from this file at build time.
 * The app name is "PRAD Expense" — the employee-facing mobile experience
 * for submitting expenses and requesting / retiring advances.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/Manifest
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PRAD Expense",
    short_name: "PRAD Expense",
    description:
      "PRAD Expense — submit expenses, request advances, and retire them on the go.",
    start_url: "/dashboard/business/expenses",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563EB",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["finance", "business", "productivity"],
  };
}
