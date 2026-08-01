"use client";

/**
 * PRAD Website — Section 8: Founder Story
 *
 * Dark background, two-column: text left, founder photo right.
 * Builds trust through the founder's authentic story.
 *
 * Photo: Replace the placeholder <div> with a real <Image> component
 * pointing to /images/adeniyi.jpg (or .webp) when the photo is available.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { SITE_CONFIG } from "@/lib/site.config";

export default function FounderSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-[#0A0F1E] py-24 lg:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <p className="text-sm font-bold text-[#F59E0B] tracking-widest uppercase mb-4">
              Why PRAD exists
            </p>
            <h2
              className="text-4xl lg:text-5xl font-extrabold text-white mb-8 leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Built by someone who lived the problem.
            </h2>

            <div className="space-y-5 text-white/60 leading-relaxed text-lg">
              <p>
                I&apos;m {SITE_CONFIG.founder.name} — a Chartered Accountant and{" "}
                {SITE_CONFIG.founder.role}. I&apos;ve spent years watching
                Nigerian companies struggle with accounting tools that
                weren&apos;t designed for our market, our regulations, or our
                workflows.
              </p>
              <p>
                Sage X3 is powerful but inaccessible. QuickBooks doesn&apos;t
                handle our multi-currency complexity. Excel doesn&apos;t scale.
                And none of them have the intelligence to help finance teams
                work faster.
              </p>
              <p>
                I built PRAD to be the platform I always wished I had.
                Enterprise-grade. Africa-first. Intelligence-powered. And designed by a
                finance professional, not just engineers who guessed what we
                needed.
              </p>
              <p className="text-white font-semibold">
                This is not a side project. This is the finance platform Africa
                deserves.
              </p>
            </div>

            {/* Signature */}
            <div className="mt-10 flex items-center gap-4">
              <div className="h-px w-12 bg-[#F59E0B]/50" />
              <div>
                <p className="text-white font-semibold">
                  {SITE_CONFIG.founder.name},{" "}
                  <span className="text-[#F59E0B]">
                    {SITE_CONFIG.founder.credentials}
                  </span>
                </p>
                <p className="text-white/40 text-sm">
                  {SITE_CONFIG.founder.title}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Founder photo placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="flex justify-center lg:justify-end"
          >
            {/*
              TODO: Replace this placeholder with:
              <Image
                src="/images/adeniyi.jpg"
                alt="Adeniyi Oladunmoye, Founder of PRAD"
                width={480}
                height={560}
                className="rounded-2xl object-cover"
              />
            */}
            <div className="w-80 h-96 lg:w-96 lg:h-[480px] rounded-2xl bg-gradient-to-br from-[#4F46E5]/20 to-[#F59E0B]/10 border border-white/10 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#4F46E5]/10 -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-[#F59E0B]/10 translate-y-1/2 -translate-x-1/2" />

              <div className="w-24 h-24 rounded-full bg-[#4F46E5]/30 border border-[#4F46E5]/40 flex items-center justify-center text-4xl">
                👤
              </div>
              <p className="text-white/40 text-sm text-center px-8">
                Founder photo
                <br />
                <span className="text-white/25 text-xs">
                  Place at /public/images/adeniyi.webp
                </span>
              </p>

              {/* Name card overlay */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 prad-glass rounded-xl px-5 py-3 text-center w-[calc(100%-3rem)]">
                <p className="text-white text-sm font-semibold">
                  {SITE_CONFIG.founder.name}
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  {SITE_CONFIG.founder.credentials} · {SITE_CONFIG.founder.title}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
