import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { assertLaunchConfig, site } from "@/config/site";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";

import "./globals.css";

// Fails the build rather than shipping a download button that goes nowhere.
assertLaunchConfig();

/**
 * Inter carries everything the site says in its own words — chosen because it
 * is the closest open sibling to the SF Pro the iPad app actually uses, and
 * this site is meant to look like the app.
 *
 * The weight axis only. Inter's optical-size axis is a real improvement at
 * display sizes, and it costs about 130 kB against the single-axis file's 71 kB
 * — on a page whose largest payload is already its font, that is the wrong side
 * of the trade. The display sizes here are tracked in tightly by hand instead,
 * which is most of what `opsz` would have done for them.
 *
 * Latin only. Nothing on this site is set in another script, and shipping
 * latin-ext for a site about British exam boards is 30 kB of Polish diacritics
 * nobody will read.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plumi-sans",
});

/*
 * There is deliberately no second webfont.
 *
 * The only serif on this site sets mathematical notation inside the product
 * mockups — an `∫`, a `dx`, a couple of italic pronumerals, "[6 marks]". A
 * webfont family for that costs around 120 kB and buys a difference nobody can
 * see at 27px inside a device.
 *
 * The system stack is also the more honest choice. Real exam papers are
 * typeset in a Times-like face, so `ui-serif, Georgia, "Times New Roman"`
 * renders the printed question as a printed question actually looks — on every
 * platform, with no download and no swap.
 *
 * (This is the opposite of the mistake Alma makes, which is to set a 156px
 * hero in `"Iowan Old Style", Baskerville, "Times New Roman"` — an Apple-only
 * stack, so their brand headline renders as Times New Roman on Windows and
 * Android. A system serif is fine for notation; it is not fine for a wordmark.)
 */

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: {
    default: "Plumi — the notebook that knows what you don't know",
    template: "%s · Plumi",
  },
  description:
    "An iPad notebook for GCSE and A-Level. Write with Apple Pencil, get help on the page, and find out what you can actually do. Join the waitlist.",
  applicationName: site.name,
  keywords: [
    "iPad notebook",
    "Apple Pencil",
    "A-Level revision",
    "GCSE revision",
    "handwriting notes",
    "study app",
    "exam practice",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: site.domain,
    siteName: site.name,
    locale: site.locale,
    title: "Plumi — a notebook that knows what you don't know",
    description:
      "Write on your iPad like normal. Plumi works out what you can do, and what to study next.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "“A notebook that knows what you don't know.” — handwritten on ruled paper, with “don't know” underlined in indigo.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plumi — a notebook that knows what you don't know",
    description:
      "Write on your iPad like normal. Plumi works out what you can do, and what to study next.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // No fake awards, counts or ratings anywhere — including in metadata, where
  // they would be easy to slip past a reader and hard to defend.
};

export const viewport: Viewport = {
  themeColor: "#FCFCF9",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // Deliberately not disabled. Pinch-zoom is an accessibility feature and
  // locking it is a WCAG failure, whatever it does for the mockups.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only-focusable z-[100] m-3 rounded-[var(--radius-control)] bg-[var(--color-blue-600)] px-4 py-2 text-white"
        >
          Skip to content
        </a>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
