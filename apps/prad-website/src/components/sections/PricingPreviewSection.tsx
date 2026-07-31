"use client";

/**
 * PRAD Website — Section 10: Pricing Preview
 *
 * Dark background, three tier cards. All prices come from PRICING_PLANS in
 * site.config.ts — update prices there without touching this component.
 *
 * Price display logic:
 *   plan.price === null  → shows "Contact us for pricing"
 *   plan.price === string → shows the price + plan.period
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, ArrowRight } from "lucide-react";
import { PRICING_PLANS } from "@/lib/site.config";
import Link from "next/link";

export default function PricingPreviewSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-[#060912] py-24 lg:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-4xl lg:text-5xl font-extrabold text-white mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Transparent pricing. No surprises.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-white/50 max-w-xl mx-auto"
          >
            PRAD is priced to be accessible to growing African businesses —
            not just multinationals.{" "}
            <Link href="/pricing" className="text-[#4F46E5] hover:text-[#818CF8] transition-colors">
              See full pricing →
            </Link>
          </motion.p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PRICING_PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.12 * (i + 1) }}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.highlight
                  ? "bg-[#4F46E5] shadow-2xl shadow-indigo-500/30 ring-2 ring-[#4F46E5]"
                  : "prad-glass"
              }`}
            >
              {/* Popular badge */}
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#F59E0B] text-[#060912] text-xs font-black px-4 py-1 rounded-full uppercase tracking-wide shadow-lg">
                    Most popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <h3
                  className={`text-xl font-bold mb-1 ${
                    plan.highlight ? "text-white" : "text-white"
                  }`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm ${
                    plan.highlight ? "text-white/70" : "text-white/50"
                  }`}
                >
                  {plan.tagline}
                </p>
              </div>

              {/* Price */}
              <div className="mb-8">
                {plan.price ? (
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-4xl font-extrabold ${
                        plan.highlight ? "text-white" : "text-white"
                      }`}
                    >
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
                  <p
                    className={`text-base font-semibold ${
                      plan.highlight ? "text-white/80" : "text-white/50"
                    }`}
                  >
                    {plan.name === "Enterprise"
                      ? "Custom pricing"
                      : "Contact us for pricing"}
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <Check
                      size={16}
                      className={`mt-0.5 flex-shrink-0 ${
                        plan.highlight ? "text-white" : "text-[#4F46E5]"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        plan.highlight ? "text-white/80" : "text-white/60"
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
                className={`w-full text-center font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all ${
                  plan.highlight
                    ? "bg-white text-[#4F46E5] hover:bg-white/90"
                    : "border border-white/20 text-white hover:bg-white/5 hover:border-white/40"
                }`}
              >
                {plan.cta}
                <ArrowRight size={15} />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
