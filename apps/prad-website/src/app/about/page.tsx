/**
 * PRAD Website — /about page (stub)
 *
 * Founder story, mission, why PRAD exists. Full content to be written.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site.config";

export const metadata: Metadata = {
  title: `About — ${SITE_CONFIG.name}`,
  description: `Learn about PRAD, founded by ${SITE_CONFIG.founder.name}, ${SITE_CONFIG.founder.credentials} — a Chartered Accountant who built the platform he always wished he had.`,
};

export default function AboutPage() {
  return (
    <div className="bg-[#060912] min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-xl">
        <p className="text-sm font-bold text-[#F59E0B] tracking-widest uppercase mb-4">
          Our story
        </p>
        <h1
          className="text-5xl font-extrabold text-white mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          About PRAD
        </h1>
        <p className="text-lg text-white/50 mb-4 leading-relaxed">
          PRAD was founded by {SITE_CONFIG.founder.name},{" "}
          {SITE_CONFIG.founder.credentials} — a {SITE_CONFIG.founder.role} who
          spent years watching Nigerian companies struggle with tools that
          weren't built for them.
        </p>
        <p className="text-lg text-white/50 mb-10 leading-relaxed">
          Full about page — including team, mission, and company story — coming
          soon.
        </p>
        <Link
          href="/"
          className="text-[#4F46E5] hover:text-[#818CF8] text-sm font-medium transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
