import { Caveat, Nunito, Pixelify_Sans } from "next/font/google";

/**
 * The site's three faces, self-hosted by next/font (no request to Google from the
 * visitor's browser) and set on <html> in the root layout, so every page has them:
 * Pixelify Sans for headings and keys, Nunito for reading, and Caveat for the
 * handwriting on the marked page. The app uses the same pair of Pixelify
 * Sans and Nunito (Design/LofiFonts.swift).
 */
const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--lp-font-px" });
const body = Nunito({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap", variable: "--lp-font-body" });
const hand = Caveat({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--lp-font-hand" });

export const cosyFonts = `${pixel.variable} ${body.variable} ${hand.variable}`;
