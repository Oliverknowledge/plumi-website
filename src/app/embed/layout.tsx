import type { Viewport } from "next";
import "@/app/question-bank.css";
import "@/app/embed.css";

/**
 * Everything under /embed/ is meant to sit in someone else's page. The root layout's
 * own site furniture (nav, footer, cookie question, ad tag, analytics) is switched off
 * for these paths in src/components/SiteOnly.tsx.
 *
 * The site is light-only (colorScheme: "light" in the root layout); an embed follows
 * the viewer's own setting, and embed.css has both palettes.
 */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6efe1" }, { media: "(prefers-color-scheme: dark)", color: "#1f1a18" }],
  width: "device-width",
  initialScale: 1,
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
