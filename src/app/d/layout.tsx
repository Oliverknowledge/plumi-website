import type { Metadata, Viewport } from "next";
import "../study/(app)/app.css";
import "./share.css";

/**
 * A flashcard deck someone shared by link, at study.tryplumi.app/d/<code>. Public: no sign-in gate, no app shell (no top bar,
 * timer or record player), just the study app's look, light only, on the same tokens (`.pa`, app.css).
 *
 * Not for search engines or other sites' eyes: noindex, and the address (which holds the code) is never sent on as a referrer.
 */
const about = "A flashcard deck shared with you on Plumi. Flip through the cards and add them to your own decks.";
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  description: about,
  // The site's home canonical and share card describe the marketing homepage, not this page.
  alternates: { canonical: null },
  openGraph: { type: "website", siteName: "Plumi", title: "A flashcard deck on Plumi", description: about, images: [{ url: "/og-lofi.png", width: 1200, height: 630, alt: "" }] },
  twitter: { card: "summary_large_image", title: "A flashcard deck on Plumi", description: about, images: ["/og-lofi.png"] },
};
export const viewport: Viewport = { themeColor: "#f2f7fd", colorScheme: "light" };

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <div className="pa sh">{children}</div>;
}
