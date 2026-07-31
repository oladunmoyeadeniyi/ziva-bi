/**
 * PRAD Website — Root Layout
 *
 * Applies global fonts, metadata, and wraps every page with Nav + Footer.
 * All SEO meta tags are derived from SITE_CONFIG.seo to keep them in one place.
 */
import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/site.config";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_CONFIG.seo.title,
  description: SITE_CONFIG.seo.description,
  openGraph: {
    title: SITE_CONFIG.seo.ogTitle,
    description: SITE_CONFIG.seo.ogDescription,
    url: `https://${SITE_CONFIG.domain}`,
    siteName: SITE_CONFIG.name,
    images: [{ url: SITE_CONFIG.seo.ogImage, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.seo.ogTitle,
    description: SITE_CONFIG.seo.ogDescription,
    images: [SITE_CONFIG.seo.ogImage],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(`https://${SITE_CONFIG.domain}`),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Structured data — Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: SITE_CONFIG.name,
              url: `https://${SITE_CONFIG.domain}`,
              description: SITE_CONFIG.seo.description,
              foundingDate: "2026",
              founder: { "@type": "Person", name: SITE_CONFIG.founder.name },
            }),
          }}
        />
        {/* Structured data — SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: SITE_CONFIG.name,
              applicationCategory: "BusinessApplication",
              description: SITE_CONFIG.seo.description,
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" },
            }),
          }}
        />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
