import { Caveat, Nunito } from "next/font/google";
import localFont from "next/font/local";

/**
 * The site's three faces, self-hosted by next/font (no request to Google from the
 * visitor's browser) and set on <html> in the root layout, so every page has them:
 * Pixelify Sans for headings and keys, Nunito for reading, and Caveat for the
 * handwriting on the marked page. The app uses the same pair of Pixelify
 * Sans and Nunito (Design/LofiFonts.swift).
 */
// The app's own cut of Pixelify Sans SemiBold, with the e redrawn on the font's grid so it
// reads as an e at every size, and the 5 redrawn so 25:00 never reads 2S:00 (app commits
// a3ccdb69, and the 5 on 20 October). It is the only weight the app ships, so
// it serves the whole 500 to 700 range here: headings and keys match the app exactly.
const pixel = localFont({ src: "./PixelifySans-SemiBold.ttf", weight: "500 700", display: "swap", variable: "--lp-font-px" });
const body = Nunito({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap", variable: "--lp-font-body" });
const hand = Caveat({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--lp-font-hand" });

export const cosyFonts = `${pixel.variable} ${body.variable} ${hand.variable}`;
