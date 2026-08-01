"use client";

/**
 * PRAD Website — Section 12: Final CTA
 *
 * Full-width dark section with gradient. Last push to convert.
 *
 * Both "Book a demo" and "Join the waitlist" link to the PRAD app signup page
 * (/signup with account_type=business). Signing up creates a trial tenant
 * which appears in the SA portal Trials & Signups queue for Adeniyi to review.
 *
 * The signup URL comes from site.config.ts — change SITE_CONFIG.APP_URL there
 * when the custom domain goes live. No component edits needed.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site.config";

export default function FinalCTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="relative bg-[#0A0F1E] py-24 lg:py-32 overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(79,70,229,0.18) 0%, rgba(245,158,11,0.06) 60%, transparent 100%)",
        }}
      />
      {/* Faint grid */}
      <div className="absolute inset-0 prad-grid-bg opacity-40" />

      <div ref={ref} className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-4xl lg:text-6xl font-extrabold text-white mb-6 leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Your finance team{" "}
          <span className="prad-gradient-text">deserves better tools.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg lg:text-xl text-white/55 mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Book a demo and see PRAD working on your actual chart of accounts —
          not a generic demo dataset. You&apos;ll get access to a live trial
          environment configured for your business.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
        >
          {/* Primary: Book a demo → trial signup */}
          <a
            href={`${SITE_CONFIG.APP_URL}/auth/signup`}
            className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 w-full sm:w-auto justify-center"
          >
            Book a demo
            <ArrowRight size={18} />
          </a>

          {/* Secondary: Join the waitlist → same signup page */}
          <a
            href={`${SITE_CONFIG.APP_URL}/auth/signup`}
            className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-medium px-8 py-4 rounded-xl text-base transition-all hover:bg-white/5 w-full sm:w-auto justify-center"
          >
            <Mail size={17} />
            Join the waitlist
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-sm text-white/30"
        >
          No commitment. No credit card. Just a conversation.
        </motion.p>
      </div>
    </section>
  );
}
