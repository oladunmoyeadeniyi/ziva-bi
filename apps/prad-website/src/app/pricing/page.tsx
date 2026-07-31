/**
 * PRAD Website — /pricing page
 *
 * Full pricing page. ALL pricing data comes from PRICING_PLANS in
 * src/lib/site.config.ts. To update prices or plan features:
 *   1. Open src/lib/site.config.ts
 *   2. Edit the PRICING_PLANS array
 *   3. Save — done. No changes to this file needed.
 *
 * Price display logic (in the component below):
 *   plan.price === null   → "Contact us for pricing"
 *   plan.price === string → show the price + plan.period
 */

import type { Metadata } from "next";
import { Check, ArrowRight } from "lucide-react";
import { PRICING_PLANS, SITE_CONFIG } from "@/lib/site.config";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Pricing — ${SITE_CONFIG.name}`,
  description:
    "Transparent pricing for PRAD — the AI-powered finance platform built for African companies. Choose the plan that fits your company size.",
};

export default function PricingPage() {
  return (
    <div className="bg-[#060912] min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-20 text-center px-6">
        <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-3">
          Pricing
        </p>
        <h1
          className="text-5xl lg:text-6xl font-extrabold text-white mb-5"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Transparent pricing.
          <br />
          No surprises.
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto">
          Priced to be accessible to growing African businesses — not just
          multinationals.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.highlight
                  ? "bg-[#4F46E5] shadow-2xl shadow-indigo-500/30 ring-2 ring-[#4F46E5]"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#F59E0B] text-[#060912] text-xs font-black px-4 py-1 rounded-full uppercase tracking-wide">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2
                  className="text-2xl font-bold text-white mb-1"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {plan.name}
                </h2>
                <p
                  className={`text-sm ${
                    plan.highlight ? "text-white/70" : "text-white/50"
                  }`}
                >
                  {plan.tagline}
                </p>
              </div>

              {/* Price */}
              <div className="mb-8 pb-8 border-b border-white/10">
                {plan.price ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold text-white">
                      {plan.price}
                    </span>
                    <span
                      className={`text-sm ${
                        plan.highlight ? "text-white/60" : "text-white/40"
                      }`}
                    >
                      {plan.period}
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-white/60">
                      {plan.name === "Enterprise"
                        ? "Custom pricing"
                        : "Contact us for pricing"}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        plan.highlight ? "text-white/50" : "text-white/30"
                      }`}
                    >
                      Pricing set individually based on your organisation
                    </p>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <Check
                      size={17}
                      className={`mt-0.5 flex-shrink-0 ${
                        plan.highlight ? "text-white" : "text-[#4F46E5]"
                      }`}
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        plan.highlight ? "text-white/85" : "text-white/65"
                      }`}
                    >
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={plan.ctaHref}
                className={`w-full text-center font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all ${
                  plan.highlight
                    ? "bg-white text-[#4F46E5] hover:bg-white/90"
                    : "border border-white/20 text-white hover:bg-white/5 hover:border-white/40"
                }`}
              >
                {plan.cta}
                <ArrowRight size={15} />
              </a>
            </div>
          ))}
        </div>

        {/* FAQ prompt */}
        <p className="text-center text-white/40 text-sm mt-14">
          Have questions?{" "}
          <Link href="/#faq" className="text-[#4F46E5] hover:text-[#818CF8] transition-colors">
            Read our FAQ
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="text-[#4F46E5] hover:text-[#818CF8] transition-colors">
            contact us
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
