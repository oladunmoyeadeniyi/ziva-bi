/**
 * PRAD Website — /contact page
 *
 * Demo request and general enquiries. Links to the app signup (trial flow).
 * A full contact form with email delivery can be added later.
 */

import type { Metadata } from "next";
import { ArrowRight, Mail } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site.config";

export const metadata: Metadata = {
  title: `Contact — ${SITE_CONFIG.name}`,
  description:
    "Get in touch with the PRAD team. Request a demo, ask a question, or start your free trial.",
};

export default function ContactPage() {
  return (
    <div className="bg-[#060912] min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-4">
          Get in touch
        </p>
        <h1
          className="text-5xl font-extrabold text-white mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Let&apos;s talk.
        </h1>
        <p className="text-lg text-white/50 mb-12 leading-relaxed">
          The fastest way to see PRAD is to book a demo. You&apos;ll get access
          to a live trial environment — configured for your actual business, not
          a generic dataset.
        </p>

        <div className="flex flex-col gap-4 items-center">
          <a
            href={`${SITE_CONFIG.APP_URL}/signup`}
            className="inline-flex items-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-xl shadow-indigo-500/25 w-full justify-center"
          >
            Book a demo / Start free trial
            <ArrowRight size={18} />
          </a>

          <a
            href={`mailto:hello@${SITE_CONFIG.domain}`}
            className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 text-white/70 hover:text-white font-medium px-8 py-4 rounded-xl transition-all w-full justify-center"
          >
            <Mail size={17} />
            hello@{SITE_CONFIG.domain}
          </a>
        </div>

        <p className="text-white/30 text-sm mt-10">
          No commitment. No credit card. Just a conversation.
        </p>
      </div>
    </div>
  );
}
