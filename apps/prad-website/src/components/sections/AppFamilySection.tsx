"use client";

/**
 * PRAD Website — Section 6: The App Family
 *
 * Dark background, five app cards in a responsive grid.
 * Each card shows the app name, description, and a PWA badge where applicable.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { APP_FAMILY } from "@/lib/site.config";

export default function AppFamilySection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section className="bg-[#0A0F1E] py-24 lg:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-4xl lg:text-5xl font-extrabold text-white mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            One platform. Five focused experiences.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-white/50 max-w-2xl mx-auto"
          >
            PRAD is not one monolithic app that tries to do everything for
            everyone. It&apos;s a family of purpose-built tools — each designed
            for a specific person&apos;s job.
          </motion.p>
        </div>

        {/* App cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {APP_FAMILY.map((app, i) => (
            <motion.div
              key={app.name}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.08 * (i + 1) }}
              className={`prad-glass rounded-2xl p-7 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ${
                i === 0 ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              {/* Colour bar + badge */}
              <div className="flex items-start justify-between mb-5">
                <div
                  className="w-10 h-10 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${app.accentColor}40, ${app.accentColor}20)`,
                    border: `1px solid ${app.accentColor}40`,
                  }}
                />
                {app.badge && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: app.accentColor,
                      background: `${app.accentColor}20`,
                      border: `1px solid ${app.accentColor}30`,
                    }}
                  >
                    {app.badge}
                  </span>
                )}
              </div>

              {/* Name */}
              <h3
                className="text-lg font-bold text-white mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {app.name}
              </h3>

              {/* Description */}
              <p className="text-white/50 text-sm leading-relaxed">
                {app.description}
              </p>

              {/* Accent bottom line */}
              <div
                className="h-px w-full mt-6 rounded-full opacity-20"
                style={{ background: app.accentColor }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
