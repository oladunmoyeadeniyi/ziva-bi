"use client";

/**
 * PRAD Website — Hero Section
 *
 * Two-column desktop layout: bold headline + CTA left, animated dashboard
 * mockup right. Dark navy background with animated grid lines and indigo glow.
 *
 * The dashboard mockup is a styled component — swap the <DashboardMockup>
 * with a real <Image> of the PRAD app once screenshots are available.
 */

import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site.config";

// ── Animated notification card ────────────────────────────────────────────────
function NotifCard({
  text,
  delay,
  top,
  right,
}: {
  text: string;
  delay: number;
  top: string;
  right: string;
}) {
  return (
    <motion.div
      className="absolute prad-glass rounded-lg px-3 py-2 text-xs text-white/90 whitespace-nowrap shadow-xl"
      style={{ top, right }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: [0, 1, 1, 0], x: [20, 0, 0, -10] }}
      transition={{
        delay,
        duration: 4,
        repeat: Infinity,
        repeatDelay: 8,
        ease: "easeInOut",
      }}
    >
      <span className="text-[#10B981] mr-1.5">✓</span>
      {text}
    </motion.div>
  );
}

// ── Dashboard mockup (placeholder) ────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-indigo-500/20 bg-[#111827]">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-[#1F2937] border-b border-white/10">
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <div className="w-3 h-3 rounded-full bg-green-500/70" />
        <div className="flex-1 mx-4 bg-white/10 rounded px-3 py-0.5 text-xs text-white/40 font-mono">
          app.prad.finance
        </div>
      </div>

      {/* App content */}
      <div className="p-4 space-y-3">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs">Period</p>
            <p className="text-white text-sm font-semibold">July 2026</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs">Status</p>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
              Open
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Revenue", val: "₦48.3M", delta: "+12%", up: true },
            { label: "Expenses", val: "₦31.7M", delta: "-4%",  up: false },
            { label: "Net",      val: "₦16.6M", delta: "+28%", up: true },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white/5 rounded-lg p-2.5">
              <p className="text-white/40 text-[10px] mb-1">{kpi.label}</p>
              <p className="text-white text-sm font-bold">{kpi.val}</p>
              <p className={`text-[10px] font-medium ${kpi.up ? "text-emerald-400" : "text-red-400"}`}>
                {kpi.delta}
              </p>
            </div>
          ))}
        </div>

        {/* Sparkline bars */}
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-white/40 text-[10px] mb-2 uppercase tracking-wide">
            Monthly Revenue vs Budget
          </p>
          <div className="flex items-end gap-1.5 h-16">
            {[55, 70, 48, 82, 63, 90, 75, 58, 86, 72, 95, 80].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                <div
                  className="w-full rounded-sm bg-[#4F46E5]/60"
                  style={{ height: `${h}%` }}
                />
                <div
                  className="w-full rounded-sm bg-[#F59E0B]/30"
                  style={{ height: `${h * 0.85}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Recent GL postings */}
        <div className="space-y-1.5">
          <p className="text-white/40 text-[10px] uppercase tracking-wide">
            Recent GL Postings
          </p>
          {[
            { ref: "JE-2026-0847", acc: "4100 — Revenue", amt: "₦2,340,000", status: "Posted" },
            { ref: "JE-2026-0848", acc: "6200 — Salaries", amt: "₦1,850,000", status: "Posted" },
            { ref: "EXP-0291", acc: "6400 — Travel",    amt: "₦45,200",    status: "Pending" },
          ].map((row) => (
            <div key={row.ref} className="flex items-center gap-2 bg-white/5 rounded px-2.5 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-medium truncate">{row.acc}</p>
                <p className="text-white/40 text-[10px]">{row.ref}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-[11px] font-semibold">{row.amt}</p>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    row.status === "Posted"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {row.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-[#060912] overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 prad-grid-bg opacity-100" />

      {/* Indigo radial glow (right side, behind mockup) */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[60vw] h-[70vh] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 70% 50%, rgba(79,70,229,0.25) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-16 lg:py-0 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* ── Left: text ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-[#4F46E5]/10 border border-[#4F46E5]/30 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-pulse" />
              <span className="text-[#818CF8] text-xs font-semibold tracking-widest uppercase">
                Intelligent Finance Platform
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white leading-[1.05] mb-6"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Finance that
              <br />
              <span className="prad-gradient-text">thinks ahead.</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-lg lg:text-xl text-white/60 leading-relaxed mb-8 max-w-lg">
              PRAD gives CFOs and finance teams in Africa the enterprise-grade
              tools to close faster, report smarter, and make decisions with
              confidence.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <a
                href={`${SITE_CONFIG.APP_URL}/signup`}
                className="inline-flex items-center justify-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-7 py-4 rounded-xl text-base transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                Request a demo
                <ArrowRight size={18} />
              </a>
              <button className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-medium px-7 py-4 rounded-xl text-base transition-all hover:bg-white/5">
                <Play size={16} className="fill-current" />
                See how it works
              </button>
            </div>

            {/* Social proof */}
            <p className="text-sm text-white/35">
              Trusted by finance teams across Nigeria · Built by a Chartered
              Accountant
            </p>
          </motion.div>

          {/* ── Right: dashboard mockup ── */}
          <motion.div
            className="relative prad-float"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            {/* Floating notification cards */}
            <div className="relative">
              <DashboardMockup />
              <NotifCard text="Period FY2026 closed ✓" delay={2}   top="-40px" right="20px" />
              <NotifCard text="GL posted — ₦2.3M ✓"   delay={5.5} top="30%"   right="-130px" />
              <NotifCard text="Expense approved ✓"     delay={9}   top="65%"   right="-110px" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
