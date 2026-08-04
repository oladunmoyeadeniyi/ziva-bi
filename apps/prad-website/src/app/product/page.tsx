/**
 * PRAD Website — /product page
 *
 * Full module-by-module product breakdown. Sections:
 *   1. Hero — positioning headline
 *   2. Module grid — 14 modules with descriptions
 *   3. Architecture callout — three-mode design
 *   4. Intelligence layer — what AI does in PRAD
 *   5. CTA band — demo request
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site.config";

export const metadata: Metadata = {
  title: `Product — ${SITE_CONFIG.name}`,
  description:
    "Every module PRAD ships — GL, period management, expense automation, approvals, AR, AP, payroll, tax, inventory, fixed assets, inter-company, and financial intelligence. Built for Africa.",
};

const MODULES = [
  {
    category: "Foundation",
    color: "#4F46E5",
    items: [
      {
        name: "Chart of Accounts & Dimensions",
        desc: "Unlimited account hierarchy with IFRS FS mapping, dimension coding rules, and bulk upload. Configure once — every transaction knows exactly how to code itself.",
      },
      {
        name: "Accounting Periods & Close",
        desc: "Auto-generated fiscal periods, sequential close enforcement, grace windows, year-end close, statutory close, and a gated close checklist with SOD controls.",
      },
      {
        name: "Currencies & FX",
        desc: "Multiple transaction currencies, FX rate tables with rate type support (SPOT / CLOSING / AVERAGE / BUDGET), inverse-rate fallback, period-end revaluation rules, and a BDC parallel-rate register.",
      },
      {
        name: "Tax Engine",
        desc: "Transaction-level VAT, WHT, and PAYE computation. Auto-generate WHT certificates. Produces tax return summaries aligned to FIRS reporting requirements.",
      },
    ],
  },
  {
    category: "Spend Management",
    color: "#10B981",
    items: [
      {
        name: "Expense Management",
        desc: "Employees photograph a receipt — PRAD reads it with OCR, fills the form, suggests the GL code based on vendor history, and routes it through your approval chain automatically.",
      },
      {
        name: "Approval Workflows",
        desc: "Multi-level approval chains built on your org structure and designation hierarchy. Configure by amount threshold, cost centre, or business function. Full audit trail. Delegation rules.",
      },
      {
        name: "Accounts Payable",
        desc: "Vendor management, invoice processing, three-way PO matching, AP aging, and automated payment request routing. Supports both connected and standalone modes.",
      },
      {
        name: "Purchase Orders",
        desc: "Full PO lifecycle — requisition, approval, GRN matching, invoice matching. Variance tracking and budget commitment accounting included.",
      },
    ],
  },
  {
    category: "Revenue & Operations",
    color: "#0EA5E9",
    items: [
      {
        name: "Accounts Receivable",
        desc: "Customer management, invoice creation and dispatch, payment recording, AR aging analysis, and overdue escalation. Revenue posting to GL in all three modes.",
      },
      {
        name: "Inventory & Warehouse",
        desc: "Item master, multi-location stock management, FIFO, WACC, and standard costing with purchase price variance journals. COGS posts to GL automatically on issue.",
      },
      {
        name: "Fixed Assets",
        desc: "Asset register, straight-line and reducing-balance depreciation schedules, disposal accounting with gain/loss, and asset revaluation. Depreciation posts monthly without manual intervention.",
      },
      {
        name: "Payroll & HR",
        desc: "Salary structures, payroll runs, payslip generation, PAYE computation, and leave management. Net pay journals post to GL. WHT certificate generation included.",
      },
    ],
  },
  {
    category: "Reporting & Intelligence",
    color: "#8B5CF6",
    items: [
      {
        name: "Financial Statements",
        desc: "Real-time P&L, Balance Sheet, and indirect-method Cash Flow Statement generated from your GL. All three update the moment a journal is posted.",
      },
      {
        name: "Budget & Planning",
        desc: "Budget periods, line-level budgets by account and dimension, monthly variance engine, and variance analysis with percentage and absolute columns.",
      },
      {
        name: "Financial Intelligence",
        desc: "Anomaly detection flags unusual transactions before month-end. Spending pattern analysis. Cash flow forecast. Auto-generated management commentary draft every period.",
      },
      {
        name: "Inter-Company Eliminations",
        desc: "Consolidation groups, IC account mapping, automatic transaction matching, elimination journal generation, and consolidated trial balance. Designed for multi-entity groups.",
      },
    ],
  },
];

const MODES = [
  {
    name: "Lite",
    color: "#10B981",
    headline: "Workflow only",
    desc: "PRAD manages your approval workflows, documents, and reporting. Your existing ERP or accounting system handles the GL. No posting happens inside PRAD.",
  },
  {
    name: "Connected",
    color: "#0EA5E9",
    headline: "GL coding + export",
    desc: "PRAD captures and codes every transaction against your chart of accounts, then exports posting batches to your ERP on schedule. Best of both worlds.",
  },
  {
    name: "Full ERP",
    color: "#4F46E5",
    headline: "Complete in-app GL",
    desc: "Every transaction posts directly to PRAD's GL. Real-time P&L, Balance Sheet, and Cash Flow from the same system that processes your expense reports.",
  },
];

const INTELLIGENCE = [
  {
    icon: "🧠",
    title: "Receipt scanning & OCR",
    body: "Employees photograph receipts. PRAD extracts vendor, date, amount, and currency — no typing required.",
  },
  {
    icon: "🎯",
    title: "GL auto-coding",
    body: "The Intelligence Engine learns from every coding decision and suggests GL codes with confidence scores. Finance teams approve; the model learns.",
  },
  {
    icon: "🔍",
    title: "Anomaly detection",
    body: "Statistical models flag unusual transactions before month-end — duplicate vendors, rounding errors, outlier amounts.",
  },
  {
    icon: "📝",
    title: "Management narratives",
    body: "Every period-end, PRAD generates a draft management commentary with variance explanations. Your team edits rather than writes from scratch.",
  },
  {
    icon: "📈",
    title: "Cash flow forecast",
    body: "Pattern-based rolling cash flow forecast from your AR, AP, and payroll schedules. Always current, never a spreadsheet.",
  },
  {
    icon: "🏦",
    title: "Bank reconciliation",
    body: "Import bank statements. PRAD auto-matches transactions to GL postings and flags unreconciled items for review.",
  },
];

export default function ProductPage() {
  return (
    <div className="bg-[#060912] text-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 text-center max-w-4xl mx-auto">
        <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-5">
          The Platform
        </p>
        <h1
          className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-[1.1]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Enterprise finance,<br />
          <span className="text-[#4F46E5]">minus the enterprise price.</span>
        </h1>
        <p className="text-xl text-white/55 max-w-2xl mx-auto leading-relaxed mb-10">
          Every module your finance team needs — built as a single platform, not a patchwork of disconnected tools. Designed specifically for African companies.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={`${SITE_CONFIG.APP_URL}/auth/signup`}
            className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-8 py-4 rounded-xl transition-all"
          >
            Request a demo
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-white/80 hover:text-white font-medium px-8 py-4 rounded-xl transition-all"
          >
            See pricing
          </Link>
        </div>
      </section>

      {/* ── Module grid ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-28">
        <div className="space-y-20">
          {MODULES.map((category) => (
            <div key={category.category}>
              <div className="flex items-center gap-3 mb-8">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <h2 className="text-xs font-bold tracking-widest uppercase text-white/40">
                  {category.category}
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                {category.items.map((mod) => (
                  <div
                    key={mod.name}
                    className="bg-white/[0.03] border border-white/8 rounded-2xl p-7 hover:bg-white/[0.06] hover:border-white/15 transition-all"
                  >
                    <div
                      className="text-xs font-bold tracking-widest uppercase mb-3"
                      style={{ color: category.color }}
                    >
                      {category.category}
                    </div>
                    <h3
                      className="text-lg font-bold text-white mb-3"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {mod.name}
                    </h3>
                    <p className="text-white/55 text-sm leading-relaxed">{mod.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three-mode architecture ───────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/8 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#10B981] tracking-widest uppercase mb-4">
              Architecture
            </p>
            <h2
              className="text-4xl font-extrabold text-white mb-5"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Three modes. One platform.
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              PRAD adapts to where you are. Start in the mode that fits today, upgrade as you grow — no data migration required.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {MODES.map((mode) => (
              <div
                key={mode.name}
                className="bg-[#060912] border border-white/10 rounded-2xl p-8 flex flex-col gap-4"
              >
                <div
                  className="text-3xl font-black"
                  style={{ color: mode.color }}
                >
                  {mode.name}
                </div>
                <div className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                  {mode.headline}
                </div>
                <p className="text-white/50 text-sm leading-relaxed">{mode.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Intelligence layer ────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#8B5CF6] tracking-widest uppercase mb-4">
              Intelligence Layer
            </p>
            <h2
              className="text-4xl font-extrabold text-white mb-5"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Finance that works while you sleep.
            </h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">
              PRAD doesn't just store your data — it learns from it. Every transaction teaches the system to work faster next time.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {INTELLIGENCE.map((item) => (
              <div
                key={item.title}
                className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:bg-white/[0.05] transition-all"
              >
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-4xl font-extrabold text-white mb-5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Ready to see it live?
          </h2>
          <p className="text-lg text-white/50 mb-10">
            Book a demo and we'll walk you through your specific modules in a configured environment — not a generic slideshow.
          </p>
          <Link
            href={`${SITE_CONFIG.APP_URL}/auth/signup`}
            className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-10 py-4 rounded-xl transition-all text-lg"
          >
            Request a demo
          </Link>
        </div>
      </section>

    </div>
  );
}
