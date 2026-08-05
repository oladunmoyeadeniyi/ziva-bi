"use client";

/**
 * NavigationProgress — thin top loading bar during Next.js route transitions.
 *
 * Listens to the browser's navigation API (Chrome 102+) via the
 * window.navigation event where available, and falls back to a
 * usePathname() change detector for older browsers.
 *
 * Wire it inside the root layout (or any shared layout) once.
 * No external dependencies — pure CSS animation.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const prev = useRef(pathname);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start the bar
  const start = () => {
    setActive(true);
    setWidth(15);
    // Animate to 80% over ~1s, then stall there
    let w = 15;
    const tick = () => {
      w = Math.min(w + (80 - w) * 0.06 + 0.5, 80);
      setWidth(w);
      if (w < 79.5) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Complete the bar
  const complete = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setWidth(100);
    timerRef.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 300);
  };

  useEffect(() => {
    if (pathname !== prev.current) {
      prev.current = pathname;
      complete();
    }
  }, [pathname]);

  // Detect navigation start via Navigation API (Chrome 102+)
  useEffect(() => {
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    if (!nav) return;
    const onNavigate = () => start();
    nav.addEventListener("navigate", onNavigate);
    return () => nav.removeEventListener("navigate", onNavigate);
  }, []);

  // Also trigger start on link clicks as a fallback
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto") || href.startsWith("tel")) return;
      if (target.getAttribute("target") === "_blank") return;
      // Only trigger for same-origin links
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) start();
      } catch {}
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (!active && width === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 2,
        width: `${width}%`,
        background: "var(--ziva-primary, #2563eb)",
        transition: width === 100 ? "width 0.15s ease-out, opacity 0.3s 0.15s" : "width 0.08s ease-out",
        opacity: active ? 1 : 0,
        zIndex: 10000,
        pointerEvents: "none",
      }}
    />
  );
}
