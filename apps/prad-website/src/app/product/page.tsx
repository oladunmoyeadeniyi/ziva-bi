/**
 * PRAD Website — /product page (stub)
 *
 * Deep dive into features and modules. Full content to be written.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site.config";

export const metadata: Metadata = {
  title: `Product — ${SITE_CONFIG.name}`,
  description:
    "Explore everything PRAD does — GL, period management, expense automation, approvals, AI intelligence, and more.",
};

export default function ProductPage() {
  return (
    <div className="bg-[#060912] min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-xl">
        <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-4">
          Coming soon
        </p>
        <h1
          className="text-5xl font-extrabold text-white mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Product overview
        </h1>
        <p className="text-lg text-white/50 mb-10 leading-relaxed">
          A full module-by-module breakdown of PRAD is on its way. For now,
          book a demo to see it live.
        </p>
        <Link
          href={`${SITE_CONFIG.APP_URL}/signup`}
          className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-8 py-4 rounded-xl transition-all"
        >
          Request a demo
        </Link>
      </div>
    </div>
  );
}
