"use client";

/**
 * PRAD Website — Section 9: Trust Signals
 *
 * Light background, 2×3 grid of trust signal cards.
 * "Built to enterprise standards."
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Lock,
  Globe,
  Brain,
  Server,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { TRUST_SIGNALS } from "@/lib/site.config";

const ICONS = [Lock, Globe, Brain, Server, Smartphone, RefreshCw];

export default function TrustSignalsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-white py-24 lg:py-32">
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
            Built to enterprise standards.
          </motion.h2>
        </div>

        {/* Trust signal grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TRUST_SIGNALS.map((signal, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div
                key={signal.title}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.08 * (i + 1) }}
                className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-6 hover:border-[#4F46E5]/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-[#4F46E5]/10 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-[#4F46E5]" />
                </div>
                <h3
                  className="text-base font-bold text-[#1A1A2E] mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {signal.title}
                </h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  {signal.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
