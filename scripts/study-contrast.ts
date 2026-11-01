/**
 * Measures the study app's palettes. "It renders" and "it can be seen" are different claims
 * (the iPad app learned that with a 1.34:1 module bar), so this asserts the second.
 *
 *   npm run study:contrast
 *
 * Text a student reads must reach 4.5:1 (WCAG AA, body size). A line or icon a student has to
 * see must reach 3:1. Both are checked in all four palettes (blue and lime, light and dark).
 * Mastery squares are reported, not failed: a square is told from its neighbours by its own
 * pattern and its 2px line, never by hue alone (see `.st-tile` in components.css).
 */
import { looks, modes, palettes, paperStocks, stationery, type Palette } from "../src/components/study/tokens";

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
function ratio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

type Pair = { what: string; fg: string; bg: string; min: number };

function pairs(p: Palette): Pair[] {
  const T = 4.5, G = 3;
  const out: Pair[] = [];
  const text = (what: string, fg: string, bg: string) => out.push({ what, fg, bg, min: T });
  const graphic = (what: string, fg: string, bg: string) => out.push({ what, fg, bg, min: G });

  for (const surface of ["ground", "card", "inset", "tab-off"] as const) {
    text(`ink on ${surface}`, p.ink, p[surface]);
    text(`ink-2 on ${surface}`, p["ink-2"], p[surface]);
    text(`ink-3 on ${surface}`, p["ink-3"], p[surface]);
  }
  text("ink on paper", p.ink, p.paper);
  for (const surface of ["ground", "card", "inset"] as const) text(`accent (links) on ${surface}`, p.accent, p[surface]);
  text("selected label on selected fill", p["sel-fg"], p["sel-bg"]);
  text("ink on accent-tint", p.ink, p["accent-tint"]);

  // Keys and pastel faces: the same in every palette except the ink on a neutral pastel.
  text("primary key label", stationery["key-blue-ink"], stationery["key-blue"]);
  text("go key label", stationery["key-green-ink"], stationery["key-green"]);
  for (const face of ["mint", "yellow", "teal", "pink", "blue-tint", "lime-tint", "key-green"] as const) {
    text(`on-pastel ink on ${face}`, p["on-pastel"], stationery[face]);
  }

  // Marking: text-safe shades on the card and on their own tint; the fills as icons.
  for (const k of ["correct", "partial", "incorrect"] as const) {
    text(`${k}-ink on card`, p[`${k}-ink`], p.card);
    text(`${k}-ink on ${k}-bg`, p[`${k}-ink`], p[`${k}-bg`]);
    graphic(`${k} mark on card`, p[k], p.card);
  }
  text("tutor ink on paper", p.tutor, p.paper);
  text("tutor ink on tutor-bg", p.tutor, p["tutor-bg"]);

  // The line has to be seen against everything it outlines.
  for (const surface of ["ground", "card", "inset"] as const) graphic(`line on ${surface}`, p.line, p[surface]);
  // The focus ring is offset from its control, so it always sits on the surface around it,
  // never on the control's own (possibly selected) fill.
  for (const surface of ["ground", "card", "inset"] as const) graphic(`focus ring on ${surface}`, p.focus, p[surface]);
  return out;
}

let failed = 0;

// Paper keeps its own stock in every look and mode, so it is checked once, on its own.
console.log("\npaper stocks (independent of look and mode)");
for (const stock of paperStocks) {
  const rows: Pair[] = [
    { what: "pen ink", fg: stock.ink, bg: stock.page, min: 4.5 },
    { what: "tutor ink", fg: stock.tutor, bg: stock.page, min: 4.5 },
    { what: "wrong-line underline", fg: stock.wrong, bg: stock.page, min: 3 },
  ];
  for (const r of rows) {
    const got = ratio(r.fg, r.bg);
    if (got < r.min) { failed++; console.log(`  FAIL ${stock.id}: ${r.what} ${r.fg} on ${r.bg} is ${got.toFixed(2)}:1, needs ${r.min}:1`); }
  }
  console.log(`  ${stock.id}: ink ${ratio(stock.ink, stock.page).toFixed(1)}, tutor ${ratio(stock.tutor, stock.page).toFixed(1)}, wrong ${ratio(stock.wrong, stock.page).toFixed(1)}`);
}
for (const look of looks) {
  for (const mode of modes) {
    const p = palettes[look][mode];
    const rows = pairs(p).map((r) => ({ ...r, got: ratio(r.fg, r.bg) }));
    const bad = rows.filter((r) => r.got < r.min);
    failed += bad.length;
    console.log(`\n${look} / ${mode}: ${rows.length - bad.length}/${rows.length} pairs pass`);
    for (const r of bad) {
      console.log(`  FAIL ${r.what}: ${r.fg} on ${r.bg} is ${r.got.toFixed(2)}:1, needs ${r.min}:1`);
    }
    const info = (["m-attention", "m-rusty", "m-developing", "m-strong"] as const)
      .map((k) => `${k.slice(2)} ${ratio(p[k], p.card).toFixed(1)}`).join(", ");
    console.log(`  (info) mastery fill vs card: ${info}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} pair(s) under their threshold.`);
  process.exit(1);
}
console.log("\nAll palettes pass.");
