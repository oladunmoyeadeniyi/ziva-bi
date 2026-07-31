"use client";

/**
 * PRAD Website — Section 7: How It Works (3 Steps)
 *
 * Light background, three numbered steps in a horizontal row.
 * Connecting line between steps on desktop.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Settings, ShieldCheck, Rocket } from "lucide-react";
import { HOW_IT_WORKS } from "@/lib/site.config";

const ICONS = [Settings, ShieldCheck, Rocket];

export default function HowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-[#F9FAFB] py-24 lg:py-32 border-y border-[#E5E7EB]">
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-4xl lg:text-5xl font-extrabold text-[#1A1A2E]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Up and running in days, not months.
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line on desktop */}
          <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-px bg-gradient-to-r from-[#4F46E5]/20 via-[#4F46E5]/60 to-[#4F46E5]/20" />

          {HOW_IT_WORKS.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 * (i + 1) }}
                className="text-center relative"
              >
                {/* Step icon */}
                <div className="relative inline-flex mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-[#4F46E5] flex items-center justify-center shadow-xl shadow-indigo-500/20">
                    <Icon size={32} className="text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#F59E0B] text-[10px] font-black text-white flex items-center justify-center">
                    {step.step}
                  </span>
                </div>

                <h3
                  className="text-xl font-bold text-[#1A1A2E] mb-3"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {step.title}
                </h3>
                <p className="text-[#6B7280] leading-relaxed">{step.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
