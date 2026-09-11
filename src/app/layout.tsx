import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { assertLaunchConfig, site } from "@/config/site";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import "./globals.css";
import "./story.css";
import "./quill.css";
assertLaunchConfig();
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-plumi-sans" });
export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: { default: "Plumi — Your handwriting. Read, understood, visualised.", template: "%s · Plumi" },
  description: "Write naturally on your iPad. Plumi tutors you right on the page, then shapes practice around what your work reveals. Launching 25 September 2026. Join the community.",
  applicationName: site.name,
  keywords: ["iPad notebook", "Apple Pencil", "A-Level revision", "GCSE study", "handwritten notes", "personalised practice", "on-page tutor"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: site.domain, siteName: site.name, locale: site.locale, title: "Your notebook. Now your tutor.", description: site.description, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Plumi: Your notebook. Now your tutor. Real handwriting and Plumi, the quill." }] },
  twitter: { card: "summary_large_image", title: "Plumi — Your handwriting. Read, understood, visualised.", description: site.description, images: ["/og.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
};
export const viewport: Viewport = { themeColor: "#fcfcf9", colorScheme: "light", width: "device-width", initialScale: 1, maximumScale: 5 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-GB" className={inter.variable}><body className="antialiased"><a href="#main" className="sr-only-focusable skip-content" data-testid="skip-to-content">Skip to content</a><AnalyticsProvider/>{children}</body></html>;
}
