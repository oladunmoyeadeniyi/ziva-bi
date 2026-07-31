/**
 * PRAD Website — Footer
 *
 * Four-column layout: logo+tagline | Product | Company | Apps
 * Bottom bar: copyright + legal links
 */

import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site.config";

const FOOTER_COLS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/product" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/legal#security" },
      { label: "Roadmap", href: "/product#roadmap" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Careers", href: "/about#careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Apps",
    links: [
      { label: "PRAD Expense", href: "/product#expense" },
      { label: "PRAD Approve", href: "/product#approve" },
      { label: "PRAD Procure", href: "/product#procure" },
      { label: "PRAD Insights", href: "/product#insights" },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/legal#privacy" },
  { label: "Terms of Service", href: "/legal#terms" },
  { label: "Data Processing Agreement", href: "/legal#dpa" },
];

export default function Footer() {
  return (
    <footer className="bg-[#060912] border-t border-white/10 text-white/70">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link
              href="/"
              className="inline-block text-white font-bold text-xl tracking-tight mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              PRAD<span className="text-[#4F46E5] text-2xl leading-none">.</span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              {SITE_CONFIG.tagline}
            </p>
            <div className="flex gap-4">
              <a
                href={SITE_CONFIG.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white/80 transition-colors text-sm"
              >
                LinkedIn
              </a>
              <a
                href={SITE_CONFIG.social.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white/80 transition-colors text-sm"
              >
                X / Twitter
              </a>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-white text-sm font-semibold mb-4 tracking-wide uppercase">
                {col.heading}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © {SITE_CONFIG.year} {SITE_CONFIG.companyName}. All rights reserved. ·{" "}
            {SITE_CONFIG.domain}
          </p>
          <div className="flex gap-6">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
