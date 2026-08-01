"use client";

/**
 * PRAD Website — Navigation Bar
 *
 * Behaviour:
 *  - Transparent on load, transitions to solid dark background on scroll.
 *  - Desktop: logo left, links centre, CTA buttons right.
 *  - Mobile: hamburger → full-screen overlay with all links.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SITE_CONFIG } from "@/lib/site.config";

const NAV_LINKS = [
  { label: "Product", href: "/product" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0A0F1E]/95 backdrop-blur-md border-b border-white/10 shadow-xl"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="text-white font-display text-xl font-bold tracking-tight hover:opacity-90 transition-opacity"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            PRAD
            <span className="text-[#4F46E5] text-2xl leading-none">.</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={`${SITE_CONFIG.APP_URL}/auth/login`}
              className="text-sm font-medium text-white/80 hover:text-white px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 transition-all"
            >
              Sign in
            </a>
            <a
              href={`${SITE_CONFIG.APP_URL}/auth/signup`}
              className="text-sm font-semibold bg-[#4F46E5] hover:bg-[#4338CA] text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
            >
              Request demo
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white/80 hover:text-white p-2"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0A0F1E] flex flex-col px-6 pt-24 pb-10">
          <nav className="flex flex-col gap-6 flex-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-2xl font-semibold text-white/80 hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3 mt-auto">
            <a
              href={`${SITE_CONFIG.APP_URL}/auth/login`}
              className="text-center text-sm font-medium text-white/80 py-3 rounded-lg border border-white/20"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </a>
            <a
              href={`${SITE_CONFIG.APP_URL}/auth/signup`}
              className="text-center text-sm font-semibold bg-[#4F46E5] text-white py-3 rounded-lg"
              onClick={() => setMenuOpen(false)}
            >
              Request a demo
            </a>
          </div>
        </div>
      )}
    </>
  );
}
