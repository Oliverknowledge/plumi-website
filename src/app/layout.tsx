import type { Metadata, Viewport } from "next";
import { appStoreCampaignToken, appStoreProviderToken, assertLaunchConfig, entityDescription, site } from "@/config/site";
import { intentFor } from "@/config/routes";
import { Analytics } from "@vercel/analytics/next";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { GoogleAds } from "@/components/GoogleAds";
import { ConsentBanner } from "@/components/ConsentBanner";
import { SiteOnly } from "@/components/SiteOnly";
import { SiteStructuredData } from "@/components/StructuredData";
import { cosyFonts } from "@/components/cosy/fonts";
import "./globals.css";
import "./cosy.css";
assertLaunchConfig();

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
    images: [{ url: "/og-lofi.png", width: 1200, height: 630, alt: "The cosy notebook that marks your work. Plumi, the GCSE and A-Level revision app for iPad, with its pixel library by the fire." }],
  },
  twitter: { card: "summary_large_image", title: home.title, description: home.description, images: ["/og-lofi.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  other: {
    // Read by nothing that ranks, but it is the fastest way for a human — or an
    // LLM summarising the page — to get the one-line definition of the product.
    "description:entity": entityDescription,
    // Safari on iPad turns this into an install banner above the page. Once a
    // provider token is configured it carries Apple's campaign tokens too, so
    // App Analytics can say how many installs the banner itself produced.
    "apple-itunes-app": appStoreProviderToken
      ? `app-id=6811389052, affiliate-data=pt=${appStoreProviderToken}&ct=${appStoreCampaignToken("smart-banner")}&mt=8`
      : "app-id=6811389052",
  },
};
export const viewport: Viewport = { themeColor: "#f6efe1", colorScheme: "light", width: "device-width", initialScale: 1, maximumScale: 5 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-GB" className={cosyFonts}><body className="antialiased"><SiteOnly><a href="#main" className="sr-only-focusable skip-content" data-testid="skip-to-content">Skip to content</a><SiteStructuredData/><AnalyticsProvider/><GoogleAds/></SiteOnly>{children}<SiteOnly><ConsentBanner/><Analytics/></SiteOnly></body></html>;
}
