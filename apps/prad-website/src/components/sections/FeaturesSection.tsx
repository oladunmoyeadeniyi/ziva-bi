"use client";

/**
 * PRAD Website — Section 5: Product Features
 *
 * Alternating left-right rows: screenshot placeholder left/right, text on the
 * other side. Each feature has a headline and body.
 *
 * Screenshots are CSS mockup placeholders — replace with real <Image> tags
 * once product screenshots are captured from the live PRAD app.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site.config";

const FEATURES = [
  {
    tag: "Chart of Accounts & Dimensions",
    headline: "A GL structure that actually works",
    body: "Configure your full chart of accounts with hierarchy, FS mappings, and dimension coding requirements. Upload 600 accounts in minutes. Every GL knows which dimensions it needs before a single transaction is posted.",
    mockupLabel: "Chart of Accounts",
    mockupColor: "#4F46E5",
  },
  {
    tag: "Period Management & Close",
    headline: "Month-end close without the chaos",
    body: "Auto-generated fiscal periods, sequential close enforcement, two-stage year-end close, configurable grace windows, and a close checklist with segregation of duties. Your auditors will love it.",
    mockupLabel: "Period Management",
    mockupColor: "#0EA5E9",
  },
  {
    tag: "Intelligent Expense Management",
    headline: "Expenses that submit themselves",
    body: "Employees photograph a receipt. PRAD reads it, fills the form, suggests the GL code, checks the policy, and routes it for approval — all before the approver sees it. Available as a standalone mobile app.",
    mockupLabel: "PRAD Expense PWA",
    mockupColor: "#10B981",
  },
  {
    tag: "Approval Workflows",
    headline: "Approvals in seconds, not days",
    body: "Multi-level approval chains, delegation rules, and a dedicated mobile app for approvers. Approve expenses, purchase orders, and payment requests from anywhere — with full audit trail automatically recorded.",
    mockupLabel: "PRAD Approve",
    mockupColor: "#F59E0B",
  },
  {
    tag: "Financial Intelligence",
    headline: "Finance that explains itself",
    body: "Budget vs actual variance analysis, anomaly detection, and auto-generated month-end narratives. Your CFO gets a draft commentary every month-end — they edit, not write from scratch.",
    mockupLabel: "PRAD Insights",
    mockupColor: "#8B5CF6",
  },
];

// Simple stylised mockup placeholder
function ScreenMockup({ label, color }: { label: string; color: string }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0A0F1E]">
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-[#111827] border-b border-white/10">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <div className="flex-1 mx-3 bg-white/10 rounded px-3 py-0.5 text-[11px] text-white/30 font-mono">
          app.prad.finance
        </div>
      </div>
      {/* Content area */}
      <div
        className="flex flex-col items-center justify-center py-20 px-8 gap-4"
        style={{ background: `${color}08` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}
        >
          📊
        </div>
        <p
          className="text-sm font-semibold text-white/50 text-center"
          style={{ color }}
        >
          {label}
        </p>
        <p className="text-xs text-white/25 text-center">
          Screenshot coming soon · Replace with real product image
        </p>
        {/* Fake UI skeleton lines */}
        <div className="w-full mt-4 space-y-2">
          {[80, 60, 70, 45].map((w, i) => (
            <div
              key={i}
              className="h-2 rounded-full"
              style={{
                width: `${w}%`,
                background: `${color}20`,
                marginLeft: i % 2 === 0 ? "0" : "auto",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[0];
  index: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const reverse = index % 2 === 1;

  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
        reverse ? "lg:flex-row-reverse" : ""
      }`}
    >
      {/* Mockup */}
      <motion.div
        initial={{ opacity: 0, x: reverse ? 30 : -30 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7 }}
        className={reverse ? "lg:order-2" : ""}
      >
        <ScreenMockup label={feature.mockupLabel} color={feature.mockupColor} />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, x: reverse ? -30 : 30 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.1 }}
        className={reverse ? "lg:order-1" : ""}
      >
        <span
          className="text-xs font-bold tracking-widest uppercase mb-3 block"
          style={{ color: feature.mockupColor }}
        >
          {feature.tag}
        </span>
        <h3
          className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4 leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {feature.headline}
        </h3>
        <p className="text-lg text-[#6B7280] leading-relaxed mb-6">
          {feature.body}
        </p>
        <a
          href={`${SITE_CONFIG.APP_URL}/auth/signup`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#4F46E5] hover:gap-3 transition-all"
        >
          See it in action <ArrowRight size={16} />
        </a>
      </motion.div>
    </div>
  );
}

export default function FeaturesSection() {
  return (
    <section className="bg-white py-24 lg:py-32 border-t border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-20">
          <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-3">
            What PRAD does
          </p>
          <h2
            className="text-4xl lg:text-5xl font-extrabold text-[#1A1A2E]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Every module your finance team needs.
          </h2>
        </div>

        {/* Feature rows */}
        <div className="space-y-24 lg:space-y-32">
          {FEATURES.map((feature, i) => (
            <FeatureRow key={feature.tag} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
