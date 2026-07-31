"use client";

/**
 * PRAD Website — Section 3: Problem Statement (The Pain)
 *
 * Full-width dark editorial section. Makes the target user feel understood
 * before showing the solution. Clean text, no images.
 */

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

const PAIN_POINTS = [
  {
    text: "Sage X3 costs a fortune and takes months to configure. QuickBooks wasn't designed for multi-currency, multi-dimension Nigerian accounting. Excel doesn't scale. And none of them think.",
  },
  {
    text: "Your team spends hours on month-end close that should take minutes. Your approval workflows live in WhatsApp. Your GL coding is inconsistent. Your auditors find gaps you didn't know existed.",
  },
  {
    text: "There's a better way. Built specifically for this market. By someone who lived it.",
  },
];

export default function PainSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-[#0A0F1E] py-24 lg:py-32">
      <div ref={ref} className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-3xl lg:text-5xl font-extrabold text-white mb-12 leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Your finance tools weren't built for Africa.
        </motion.h2>

        <div className="space-y-8">
          {PAIN_POINTS.map((point, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 * (i + 1) }}
              className={`text-lg lg:text-xl leading-relaxed ${
                i === PAIN_POINTS.length - 1
                  ? "text-[#4F46E5] font-semibold"
                  : "text-white/55"
              }`}
            >
              {point.text}
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  );
}
