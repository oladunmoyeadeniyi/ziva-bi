/**
 * PRAD Website — Homepage
 *
 * Assembles all 13 sections in order per the PRAD_WEBSITE_PRD.md brief.
 * Each section is a self-contained component; data flows from site.config.ts.
 */

import Hero from "@/components/sections/Hero";
import PainSection from "@/components/sections/PainSection";
import SolutionSection from "@/components/sections/SolutionSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import AppFamilySection from "@/components/sections/AppFamilySection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import FounderSection from "@/components/sections/FounderSection";
import TrustSignalsSection from "@/components/sections/TrustSignalsSection";
import PricingPreviewSection from "@/components/sections/PricingPreviewSection";
import FAQSection from "@/components/sections/FAQSection";
import FinalCTASection from "@/components/sections/FinalCTASection";

export default function HomePage() {
  return (
    <>
      {/* S1 — Nav (in layout) */}
      {/* S2 — Hero */}
      <Hero />

      {/* S3 — Problem: Your finance tools weren't built for Africa */}
      <PainSection />

      {/* S4 — Solution: Introducing PRAD */}
      <SolutionSection />

      {/* S5 — Product features (alternating layout) */}
      <FeaturesSection />

      {/* S6 — The app family */}
      <AppFamilySection />

      {/* S7 — How it works (3 steps) */}
      <HowItWorksSection />

      {/* S8 — Founder story */}
      <FounderSection />

      {/* S9 — Trust signals */}
      <TrustSignalsSection />

      {/* S10 — Pricing preview */}
      <PricingPreviewSection />

      {/* S11 — FAQ */}
      <FAQSection />

      {/* S12 — Final CTA */}
      <FinalCTASection />

      {/* S13 — Footer (in layout) */}
    </>
  );
}
