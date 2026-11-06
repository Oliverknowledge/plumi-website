import "server-only";
import type { MsSlug } from "./proServer";

/**
 * The mark scheme cards, read from src/content/proDecks. This is the ONLY place that imports them, and it is imported only by the route handler:
 * `server-only` makes a client import a build error, so the text can never reach `.next/static` (decks:leak-check proves it after every build).
 */
export function loadMarkSchemeFile(slug: MsSlug): Promise<unknown> {
  switch (slug) {
    case "aqa-7402": return import("@/content/proDecks/markscheme-aqa-7402.json").then((m) => m.default);
    case "ocr-h420": return import("@/content/proDecks/markscheme-ocr-h420.json").then((m) => m.default);
    case "aqa-8461": return import("@/content/proDecks/markscheme-aqa-8461.json").then((m) => m.default);
    case "aqa-7405": return import("@/content/proDecks/markscheme-aqa-7405.json").then((m) => m.default);
    case "ocr-h432": return import("@/content/proDecks/markscheme-ocr-h432.json").then((m) => m.default);
    case "aqa-8462": return import("@/content/proDecks/markscheme-aqa-8462.json").then((m) => m.default);
    case "aqa-7408": return import("@/content/proDecks/markscheme-aqa-7408.json").then((m) => m.default);
    case "ocr-h556": return import("@/content/proDecks/markscheme-ocr-h556.json").then((m) => m.default);
    case "edexcel-9ph0": return import("@/content/proDecks/markscheme-edexcel-9ph0.json").then((m) => m.default);
    case "aqa-8463": return import("@/content/proDecks/markscheme-aqa-8463.json").then((m) => m.default);
  }
}
