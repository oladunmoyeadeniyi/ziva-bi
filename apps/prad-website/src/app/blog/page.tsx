/**
 * PRAD Website — /blog page (stub)
 *
 * Thought leadership content — finance, ERP, AI in accounting, African
 * business. Full CMS integration to be added.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site.config";

export const metadata: Metadata = {
  title: `Blog — ${SITE_CONFIG.name}`,
  description:
    "Finance insights, ERP best practice, and AI in accounting — from the PRAD team.",
};

export default function BlogPage() {
  return (
    <div className="bg-[#060912] min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-xl">
        <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-4">
          Thought leadership
        </p>
        <h1
          className="text-5xl font-extrabold text-white mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          The PRAD blog
        </h1>
        <p className="text-lg text-white/50 mb-10 leading-relaxed">
          Practical finance insights, ERP best practice, and AI in accounting
          — written for CFOs and finance teams in Africa. First articles coming
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
