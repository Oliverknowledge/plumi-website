import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { assertLaunchConfig, entityDescription, site } from "@/config/site";
import { intentFor } from "@/config/routes";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { GoogleAds } from "@/components/GoogleAds";
import { SiteStructuredData } from "@/components/StructuredData";
import "./globals.css";
import "./story.css";
import "./quill.css";
assertLaunchConfig();
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-plumi-sans" });

const home = intentFor("/");

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  /**
   * The default is the homepage's title, and the template covers everything
   * else. Both lead with what the page is rather than with the brand slogan:
   * "Your handwriting. Read, understood, visualised." is a good headline and a
   * useless title, because it never says tutor, notebook, GCSE or A-Level, and
   * a title is one of the few places a crawler takes you at your word.
   */
  title: { default: home.title, template: "%s · Plumi" },
  description: home.description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.domain,
    siteName: site.name,
    locale: site.locale,
    title: home.title,
    description: home.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Plumi: your handwriting, read, understood and visualised, with Plumi the quill." }],
  },
  twitter: { card: "summary_large_image", title: home.title, description: home.description, images: ["/og.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  other: {
    // Read by nothing that ranks, but it is the fastest way for a human — or an
    // LLM summarising the page — to get the one-line definition of the product.
    "description:entity": entityDescription,
  },
};
export const viewport: Viewport = { themeColor: "#fcfcf9", colorScheme: "light", width: "device-width", initialScale: 1, maximumScale: 5 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-GB" className={inter.variable}><body className="antialiased"><a href="#main" className="sr-only-focusable skip-content" data-testid="skip-to-content">Skip to content</a><SiteStructuredData/><AnalyticsProvider/><GoogleAds/>{children}</body></html>;
}
