"use client";

/**
 * PRAD Website — Section 4: Solution Introduction
 *
 * Introduces PRAD as the answer. Transitions from dark to light background.
 * Three pillar cards with glassmorphism on dark or clean on white.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Brain, Shield, Globe } from "lucide-react";

const PILLARS = [
  {
    Icon: Brain,
    title: "Intelligent by design",
    body: "PRAD reads your receipts, suggests GL codes, checks policy compliance, and flags anomalies — before your approvers see them.",
    accent: "#4F46E5",
  },
  {
    Icon: Shield,
    title: "Enterprise-grade rigour",
    body: "Built to SAP, Oracle, and Dynamics standards. Period management, multi-currency, dimensions, audit trails — nothing missing.",
    accent: "#10B981",
  },
  {
    Icon: Globe,
    title: "Built for this market",
    body: "Designed for Nigerian and African accounting realities — WHT, VAT, FIRS compliance, multi-entity, group reporting.",
    accent: "#F59E0B",
  },
];

export default function SolutionSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-white py-24 lg:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-3"
          >
            Introducing PRAD
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl lg:text-5xl font-extrabold text-[#1A1A2E] leading-tight mb-5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Precision-driven Reporting,
            <br />
            Analytics &amp; Decision-making.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-[#6B7280] max-w-2xl mx-auto"
          >
            An enterprise finance platform built for African companies — with
            precision intelligence and the rigour of global ERP standards.
          </motion.p>
        </div>

        {/* Pillar cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 * (i + 1) }}
              className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: `${pillar.accent}15` }}
              >
                <pillar.Icon size={24} style={{ color: pillar.accent }} />
              </div>
              <h3
                className="text-lg font-bold text-[#1A1A2E] mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {pillar.title}
              </h3>
              <p className="text-[#6B7280] leading-relaxed">{pillar.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
