/**
 * PRAD Website — Site Configuration
 *
 * This is the SINGLE source of truth for all pricing, FAQ answers, app family
 * descriptions, trust signals, and site-wide copy.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  To update pricing → change PRICING_PLANS below.                        │
 * │  To update FAQ     → change FAQ_ITEMS below.                            │
 * │  To update app URL → change SITE_CONFIG.APP_URL below.                  │
 * │  No component files need to be touched for any of these changes.        │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

// ── Core identity ─────────────────────────────────────────────────────────────

export const SITE_CONFIG = {
  name: "PRAD",
  fullName: "Precision-driven Reporting, Analytics & Decision-making",
  tagline: "Finance that thinks ahead.",
  secondaryTagline: "Where precision meets intelligence.",
  domain: "prad.finance",
  companyName: "PRAD Financial Technologies Ltd",
  year: 2026,

  /**
   * URL of the live PRAD application.
   *
   * This is where all "Request a demo" / "Start free trial" CTAs link.
   * Signing up there creates a trial tenant that appears in the SA portal.
   *
   * Update this when:
   *   — today:               "https://ziva-bi-frontend.onrender.com"
   *   — after custom domain: "https://app.prad.finance"
   */
  APP_URL: "https://ziva-bi-frontend.onrender.com",

  founder: {
    name: "Adeniyi Oladunmoye",
    credentials: "ACA",
    title: "Founder, PRAD",
    role: "Chief Accountant, Red Bull Nigeria Limited",
  },

  social: {
    linkedin: "https://linkedin.com/company/pradfinance",
    twitter: "https://twitter.com/pradfinance",
  },

  seo: {
    title: "PRAD — Finance that thinks ahead | prad.finance",
    description:
      "PRAD is an AI-powered enterprise finance platform built for African companies. Chart of accounts, period management, expense automation, approval workflows, and financial intelligence — all in one platform.",
    ogTitle: "PRAD — Finance that thinks ahead",
    ogDescription:
      "Enterprise finance for Africa. AI-powered. Built by a Chartered Accountant.",
    ogImage: "/og-image.png",
  },
} as const;

// ── Pricing ───────────────────────────────────────────────────────────────────
//
// price: string  → show the price (e.g. "₦150,000")
// price: null    → show "Contact us for pricing"
//
// To set a real price: change `price: null` to `price: "₦150,000"` (or any string).
// The component reads this and renders accordingly — no JSX edits needed.

export interface PricingPlan {
  name: string;
  tagline: string;
  /** Monthly price string, or null to show "Contact us for pricing" */
  price: string | null;
  period: string;
  /** Set true to display the "Most popular" badge */
  highlight: boolean;
  features: string[];
  cta: string;
  ctaHref: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: "Starter",
    tagline: "For growing companies",
    price: null, // → shows "Contact us for pricing" until set
    period: "/ month",
    highlight: false,
    features: [
      "Up to 50 employees",
      "PRAD core platform",
      "PRAD Expense + PRAD Approve",
      "Email support",
      "Test environment included",
    ],
    cta: "Request a demo",
    ctaHref: `${SITE_CONFIG.APP_URL}/signup`,
  },
  {
    name: "Business",
    tagline: "For established companies",
    price: null, // → shows "Contact us for pricing" until set
    period: "/ month",
    highlight: true,
    features: [
      "Up to 500 employees",
      "Everything in Starter",
      "PRAD Procure + PRAD Insights",
      "AI features (OCR, GL coding, narratives)",
      "Priority support + dedicated consultant",
    ],
    cta: "Request a demo",
    ctaHref: `${SITE_CONFIG.APP_URL}/signup`,
  },
  {
    name: "Enterprise",
    tagline: "For large organisations and groups",
    price: null, // always "Contact us"
    period: "",
    highlight: false,
    features: [
      "Unlimited employees",
      "Everything in Business",
      "Multi-entity / group reporting",
      "Custom integrations",
      "SLA + dedicated account manager",
    ],
    cta: "Contact us",
    ctaHref: "/contact",
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
// Add, remove, or reorder questions here. No component changes needed.

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: "How is PRAD different from QuickBooks or Sage?",
    answer:
      "QuickBooks was designed for small Western businesses — it doesn't handle multi-currency, multi-dimension Nigerian accounting at scale. Sage X3 is powerful but costs a fortune and takes months to configure with specialist consultants. PRAD was built specifically for African companies by a Chartered Accountant who worked with both systems. It combines enterprise-grade GL rigour with AI automation at a price point accessible to growing businesses — not just multinationals.",
  },
  {
    question: "Is PRAD suitable for my company size?",
    answer:
      "PRAD is designed for companies with 10 to 5,000 employees. Our Starter plan covers companies up to 50 employees; Business covers up to 500; Enterprise has no limit. The platform scales with you — you don't need to switch systems as you grow.",
  },
  {
    question: "How long does implementation take?",
    answer:
      "Most companies are fully configured and live within 2–6 weeks, depending on the complexity of their chart of accounts and approval workflows. Every PRAD account starts in a test environment — your team configures everything, runs real transactions, and validates the setup before a single live posting is made. When you're satisfied, you promote to live with one click.",
  },
  {
    question: "Is my financial data safe with PRAD?",
    answer:
      "Yes. All data is encrypted at rest and in transit using industry-standard AES-256 and TLS 1.3. PRAD is hosted on managed cloud infrastructure with automated daily backups and point-in-time recovery. Your financial data never leaves our secured environment and is never shared with third parties.",
  },
  {
    question: "Does PRAD handle Nigerian tax requirements (WHT, VAT, FIRS)?",
    answer:
      "Yes — this was a core design requirement, not an afterthought. PRAD includes a full Tax Engine with transaction-level VAT and WHT computation, WHT certificate generation, PAYE calculation, and a tax returns module. This is configured per tenant to match your specific tax obligations under Nigerian law and FIRS guidance.",
  },
  {
    question: "Can employees use PRAD on their phones without installing an app?",
    answer:
      "Yes. PRAD Expense, PRAD Approve, PRAD Procure, and PRAD Insights are all Progressive Web Apps (PWAs) — they run in the browser on any smartphone and can be added to the home screen for a native app experience. No App Store, no Play Store, no IT department needed.",
  },
  {
    question: "What happens during the implementation period before we go live?",
    answer:
      "Every PRAD account starts in a full test environment — an isolated shadow of your live system. Your PRAD consultant works with your finance team to configure your chart of accounts, dimensions, approval workflows, and integrations. You run test transactions, see how reports look, approve test expense reports — everything — until you're confident. Only then do you promote to live.",
  },
  {
    question: "Do you offer training and support?",
    answer:
      "Yes. All plans include email support and access to our help documentation. Business and Enterprise plans include a dedicated PRAD consultant for implementation and ongoing support. We also offer live training sessions for finance teams and approver groups.",
  },
  {
    question: "Can PRAD handle multi-currency transactions?",
    answer:
      "Yes. PRAD supports multiple functional and transaction currencies with configurable exchange rate management. You can record transactions in any currency, maintain FX rate tables, and produce reports in your functional currency with automatic translation. Essential for Nigerian companies transacting in USD, GBP, EUR, and other currencies alongside Naira.",
  },
  {
    question: "Is PRAD available outside Nigeria?",
    answer:
      "PRAD is currently focused on Nigeria and will expand across Africa. The platform already supports any currency and can be configured for different country tax regimes. If your use case is outside Nigeria, contact us to discuss availability.",
  },
];

// ── App family ─────────────────────────────────────────────────────────────────

export const APP_FAMILY = [
  {
    name: "PRAD",
    description: "The complete finance platform for your finance team",
    badge: null as string | null,
    accentColor: "#4F46E5",
    bgClass: "from-indigo-600 to-indigo-800",
  },
  {
    name: "PRAD Expense",
    description: "Submit expenses, attach receipts, track approvals — on your phone",
    badge: "PWA" as string | null,
    accentColor: "#4F46E5",
    bgClass: "from-indigo-500 to-violet-700",
  },
  {
    name: "PRAD Approve",
    description: "Your approval inbox. Review, decide, move on.",
    badge: "PWA" as string | null,
    accentColor: "#0EA5E9",
    bgClass: "from-sky-500 to-blue-700",
  },
  {
    name: "PRAD Procure",
    description: "Purchase orders, payment requests, vendor management",
    badge: "PWA" as string | null,
    accentColor: "#10B981",
    bgClass: "from-emerald-500 to-teal-700",
  },
  {
    name: "PRAD Insights",
    description: "Executive dashboards and AI financial intelligence",
    badge: "PWA" as string | null,
    accentColor: "#F59E0B",
    bgClass: "from-amber-500 to-orange-600",
  },
];

// ── Trust signals ──────────────────────────────────────────────────────────────

export const TRUST_SIGNALS = [
  {
    title: "Bank-grade security",
    body: "Data encrypted at rest and in transit. AES-256 + TLS 1.3. SOC 2 ready.",
  },
  {
    title: "Africa-first compliance",
    body: "WHT, VAT, FIRS, IFRS. Built for Nigerian and African regulations from day one.",
  },
  {
    title: "AI-powered intelligence",
    body: "Receipt OCR, GL auto-coding, anomaly detection, and month-end narratives — built in.",
  },
  {
    title: "ERP-grade standards",
    body: "Designed to SAP, Oracle, and Microsoft Dynamics best practice. Nothing missing.",
  },
  {
    title: "Mobile-first PWA",
    body: "Full PWA support. Your team uses PRAD on any device without installing anything.",
  },
  {
    title: "Always current",
    body: "Cloud-based. Updates deploy instantly. No version upgrades, no downtime windows.",
  },
];

// ── How it works steps ─────────────────────────────────────────────────────────

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Configure",
    body: "Import your chart of accounts, configure dimensions, set up approval workflows. Your PRAD consultant guides you through implementation in your test environment.",
  },
  {
    step: "02",
    title: "Validate",
    body: "Every PRAD account starts in a test environment. Run real transactions, see how reports look, make sure everything is perfect — before a single live transaction is posted.",
  },
  {
    step: "03",
    title: "Go Live",
    body: "When you're ready, promote your validated configuration to your live environment. Your team logs in. Everything works. No surprises.",
  },
];
