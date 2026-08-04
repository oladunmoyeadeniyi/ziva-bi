/**
 * PRAD Website — /about page
 *
 * Founder story, mission, and why PRAD exists. Sections:
 *   1. Hero — the origin sentence
 *   2. The problem — what PRAD is solving
 *   3. Founder story — who built it and why
 *   4. Mission statement
 *   5. Values
 *   6. CTA
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site.config";

export const metadata: Metadata = {
  title: `About — ${SITE_CONFIG.name}`,
  description: `PRAD was founded by ${SITE_CONFIG.founder.name}, ${SITE_CONFIG.founder.credentials} — a Chartered Accountant who spent a decade watching Nigerian companies struggle with tools built for someone else's problems.`,
};

const VALUES = [
  {
    icon: "⚖️",
    title: "Precision over shortcuts",
    body: "Finance is a discipline. PRAD enforces good accounting practice — period controls, audit trails, segregation of duties — because shortcuts in finance compound.",
  },
  {
    icon: "🌍",
    title: "Built for Africa, not adapted for it",
    body: "WHT, VAT, FIRS, Naira, multi-currency, parallel rates, diverse org structures — these are first-class requirements, not edge cases or plugins.",
  },
  {
    icon: "🔍",
    title: "Transparency over magic",
    body: "Every posting has a trail. Every intelligent suggestion shows its confidence score. Finance teams should always be able to explain why the system did what it did.",
  },
  {
    icon: "🏗️",
    title: "Enterprise rigour at every scale",
    body: "A 30-person company deserves the same GL discipline as a 3,000-person company. PRAD doesn't dumb anything down — it makes complexity accessible.",
  },
];

const TIMELINE = [
  {
    year: "2017",
    event: "Begins career in audit at Ernst & Young Nigeria — sees first-hand how companies of all sizes struggle with finance systems not designed for the Nigerian market.",
  },
  {
    year: "2019",
    event: "Qualifies as a Chartered Accountant (ACA) with the Institute of Chartered Accountants of Nigeria.",
  },
  {
    year: "2021",
    event: "Joins Red Bull Nigeria as Chief Accountant. Responsible for the full finance function — GL, reporting, tax, FX, treasury — across a complex FMCG operation.",
  },
  {
    year: "2025",
    event: "Starts building PRAD — a platform that combines the rigour of the enterprise systems he's used with the intelligence and accessibility that African companies actually need.",
  },
  {
    year: "2026",
    event: "PRAD launches. All core modules live: GL, expense, approvals, AP, AR, payroll, inventory, fixed assets, tax, budget, inter-company, and financial intelligence.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-[#060912] text-white">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 text-center max-w-4xl mx-auto">
        <p className="text-sm font-bold text-[#F59E0B] tracking-widest uppercase mb-5">
          Our story
        </p>
        <h1
          className="text-5xl md:text-6xl font-extrabold text-white mb-7 leading-[1.1]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Built by someone who lived<br />
          <span className="text-[#F59E0B]">the problem.</span>
        </h1>
        <p className="text-xl text-white/55 max-w-2xl mx-auto leading-relaxed">
          PRAD exists because {SITE_CONFIG.founder.name}, {SITE_CONFIG.founder.credentials} — a Chartered Accountant who spent a decade in Nigerian finance — got tired of watching great companies run on systems that weren't built for them.
        </p>
      </section>

      {/* ── The problem ───────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
              <div className="text-2xl mb-4">😤</div>
              <h3
                className="text-xl font-bold text-white mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Accounting software designed elsewhere
              </h3>
              <p className="text-white/55 leading-relaxed text-sm">
                QuickBooks was designed for Western small businesses. It doesn't understand WHT, parallel FX rates, or multi-dimensional GL coding at scale. It's a spreadsheet with a nice interface.
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
              <div className="text-2xl mb-4">💸</div>
              <h3
                className="text-xl font-bold text-white mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Enterprise systems that cost a fortune
              </h3>
              <p className="text-white/55 leading-relaxed text-sm">
                SAP, Oracle, and Sage X3 are capable — but they cost millions to license, months to implement with specialist consultants, and assume your team has been trained for years. They're not accessible to growing African companies.
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
              <div className="text-2xl mb-4">📋</div>
              <h3
                className="text-xl font-bold text-white mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Spreadsheet finance at scale
              </h3>
              <p className="text-white/55 leading-relaxed text-sm">
                The gap between "too simple" and "too expensive" is filled by spreadsheets and manual processes. Expense reports emailed as PDFs. Approvals by WhatsApp. Month-end close that takes three weeks.
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
              <div className="text-2xl mb-4">🌍</div>
              <h3
                className="text-xl font-bold text-white mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Africa-specific requirements ignored
              </h3>
              <p className="text-white/55 leading-relaxed text-sm">
                WHT certificates. Parallel market FX rates. FIRS-aligned tax returns. IFRS-compliant financial statements with Nigerian-specific disclosures. These are not edge cases — they're standard requirements for any company operating in Nigeria.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Founder story ─────────────────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/8 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-5">
                The founder
              </p>
              <h2
                className="text-4xl font-extrabold text-white mb-6"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {SITE_CONFIG.founder.name}, {SITE_CONFIG.founder.credentials}
              </h2>
              <p className="text-white/60 leading-relaxed mb-5">
                Adeniyi is a Chartered Accountant with over eight years of experience in Nigerian finance. He started his career in audit at Ernst &amp; Young Nigeria, where he worked across clients of every size — from growing SMEs to large multinationals — and saw the same problem everywhere: great companies hamstrung by tools that weren't designed for their reality.
              </p>
              <p className="text-white/60 leading-relaxed mb-5">
                As Chief Accountant at Red Bull Nigeria, he's been responsible for the complete finance function of a complex FMCG operation — GL management, statutory reporting, multi-currency treasury, Nigerian tax compliance, and financial planning. He knows what enterprise finance looks like from the inside.
              </p>
              <p className="text-white/60 leading-relaxed">
                PRAD is the platform he always wished he had. Not a product built by engineers who've never closed a month-end, but a finance system designed by a finance professional who has done it hundreds of times — and knows exactly where the pain is.
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-white/30 tracking-widest uppercase mb-6">
                Timeline
              </p>
              <div className="space-y-6">
                {TIMELINE.map((item) => (
                  <div key={item.year} className="flex gap-5">
                    <div className="flex-shrink-0 mt-1">
                      <span className="text-xs font-bold text-[#4F46E5] bg-[#4F46E5]/10 border border-[#4F46E5]/20 rounded px-2 py-1">
                        {item.year}
                      </span>
                    </div>
                    <p className="text-white/55 text-sm leading-relaxed">{item.event}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-bold text-[#10B981] tracking-widest uppercase mb-5">
            Mission
          </p>
          <blockquote
            className="text-3xl md:text-4xl font-bold text-white leading-[1.25]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            "Give every African company — regardless of size — access to the same quality of financial management that multinationals take for granted. Precise, intelligent, and built for the continent."
          </blockquote>
          <p className="mt-8 text-white/40 text-sm">
            — {SITE_CONFIG.founder.name}, Founder
          </p>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/8 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-[#8B5CF6] tracking-widest uppercase mb-4">
              What we believe
            </p>
            <h2
              className="text-4xl font-extrabold text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Our values
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="bg-[#060912] border border-white/10 rounded-2xl p-8"
              >
                <div className="text-3xl mb-4">{value.icon}</div>
                <h3
                  className="text-lg font-bold text-white mb-3"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {value.title}
                </h3>
                <p className="text-white/55 text-sm leading-relaxed">{value.body}</p>
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
            Join the companies<br />already on PRAD.
          </h2>
          <p className="text-lg text-white/50 mb-10">
            Book a 30-minute demo. See your specific modules in a configured environment. No slides, no generic walkthroughs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`${SITE_CONFIG.APP_URL}/auth/signup`}
              className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-8 py-4 rounded-xl transition-all"
            >
              Request a demo
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-white/80 hover:text-white font-medium px-8 py-4 rounded-xl transition-all"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
