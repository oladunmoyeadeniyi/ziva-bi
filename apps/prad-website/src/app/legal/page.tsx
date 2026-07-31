/**
 * PRAD Website — /legal page (stub)
 *
 * Privacy Policy, Terms of Service, and Data Processing Agreement.
 * Full legal copy to be written with legal counsel before first customer.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/lib/site.config";

export const metadata: Metadata = {
  title: `Legal — ${SITE_CONFIG.name}`,
  description: `Privacy Policy, Terms of Service, and Data Processing Agreement for ${SITE_CONFIG.name}.`,
};

const LEGAL_DOCS = [
  {
    id: "privacy",
    title: "Privacy Policy",
    summary:
      "How PRAD collects, processes, and protects your personal and financial data.",
  },
  {
    id: "terms",
    title: "Terms of Service",
    summary:
      "The terms governing your use of the PRAD platform and all associated services.",
  },
  {
    id: "dpa",
    title: "Data Processing Agreement",
    summary:
      "Our obligations as a data processor under Nigerian data protection regulations and GDPR.",
  },
  {
    id: "security",
    title: "Security",
    summary:
      "Our security architecture, encryption standards, backup policy, and incident response approach.",
  },
];

export default function LegalPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 pt-32 pb-24">
        <p className="text-sm font-bold text-[#4F46E5] tracking-widest uppercase mb-4">
          Legal
        </p>
        <h1
          className="text-5xl font-extrabold text-[#1A1A2E] mb-6"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Legal documents
        </h1>
        <p className="text-lg text-[#6B7280] mb-12">
          Full legal documents are being finalised and will be published here
          before PRAD&apos;s first commercial customer. In the meantime, contact
          us with any questions.
        </p>

        <div className="space-y-4">
          {LEGAL_DOCS.map((doc) => (
            <div
              key={doc.id}
              id={doc.id}
              className="border border-[#E5E7EB] rounded-2xl p-6"
            >
              <h2
                className="text-lg font-bold text-[#1A1A2E] mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {doc.title}
              </h2>
              <p className="text-sm text-[#6B7280] mb-4">{doc.summary}</p>
              <span className="inline-block text-xs font-semibold text-[#F59E0B] bg-[#F59E0B]/10 px-3 py-1 rounded-full">
                Coming soon
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm text-[#9CA3AF] mt-12 text-center">
          Questions?{" "}
          <Link href="/contact" className="text-[#4F46E5] hover:underline">
            Contact us
          </Link>{" "}
          · © {SITE_CONFIG.year} {SITE_CONFIG.companyName}
        </p>
      </div>
    </div>
  );
}
