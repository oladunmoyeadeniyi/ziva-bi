"use client";

/**
 * PRAD Website — Section 11: FAQ
 *
 * Light background, Framer Motion accordion.
 * All Q&A data comes from FAQ_ITEMS in site.config.ts — add/edit/reorder
 * questions there without touching this component.
 *
 * Includes JSON-LD FAQPage structured data for SEO.
 */

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/site.config";

function FAQItem({
  item,
  index,
  inView,
}: {
  item: (typeof FAQ_ITEMS)[0];
  index: number;
  inView: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: 0.04 * index }}
      className="border border-[#E5E7EB] rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-[#F9FAFB] transition-colors"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-[#1A1A2E] leading-snug">
          {item.question}
        </span>
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
          {open ? (
            <Minus size={13} className="text-[#4F46E5]" />
          ) : (
            <Plus size={13} className="text-[#4F46E5]" />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 text-[#6B7280] leading-relaxed border-t border-[#F3F4F6] pt-4">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-white py-24 lg:py-32 border-t border-[#E5E7EB]">
      {/* JSON-LD structured data for FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          }),
        }}
      />

      <div ref={ref} className="max-w-3xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-4xl lg:text-5xl font-extrabold text-[#1A1A2E]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Common questions.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[#6B7280] mt-4"
          >
            Everything you need to know before your first conversation with us.
          </motion.p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem key={item.question} item={item} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
