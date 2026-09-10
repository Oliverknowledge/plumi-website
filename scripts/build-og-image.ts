/**
 * Generates the social preview image.
 *
 * Run with: npm run og
 *
 * ── Why it is generated rather than designed ─────────────────────────────────
 * The image is drawn with the same stroke engine the website uses, so the
 * handwriting in a Twitter card is the same handwriting Plumi puts in a margin.
 * A designer's export would drift the first time the headline changed; this
 * cannot.
 *
 * ── Why there is no webfont in it ────────────────────────────────────────────
 * Every glyph here is a path from `src/lib/hand`, which means the file needs no
 * font embedding, no Satori, and no network at build time. It also means the
 * card is the one thing in a social feed that does not look like software —
 * which, in a feed full of gradient screenshots, is the entire point.
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { write, strokePath, width as inkWidth } from "../src/lib/hand/index";
import { PAGE, ruleAt } from "../src/components/product/paperGeometry";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The size every platform crops from. */
const W = 1200;
const H = 630;

const INK = "#16202E";
const TUTOR = "#5A4FE0";
const PAPER = "#FCFCF9";

const HEADLINE = ["A notebook that knows", "what you don't know."] as const;
const SIZE = 62;
const LEFT = 96;

function inkGroup(text: string, x: number, y: number, size: number, colour: string, seed: number) {
  const strokes = write(text, { size, box: { x, y, width: W - x - 40 }, maxLines: 1, seed });
  const paths = strokes
    .map((s) => `<path d="${strokePath(s)}" stroke-width="${s.width.toFixed(2)}"/>`)
    .join("");
  return `<g fill="none" stroke="${colour}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
}

function build(): string {
  const parts: string[] = [];

  parts.push(`<rect width="${W}" height="${H}" fill="${PAPER}"/>`);

  // The page's own rules, at the app's 36pt pitch, so the card is a page.
  for (let y = PAGE.topMargin; y < H; y += PAGE.rule) {
    parts.push(
      `<line x1="${PAGE.insetLeft}" y1="${y}" x2="${W - PAGE.insetRight}" y2="${y}" stroke="${PAGE.ruleColour}" stroke-width="1"/>`,
    );
  }
  parts.push(
    `<line x1="${PAGE.marginRuleX}" y1="0" x2="${PAGE.marginRuleX}" y2="${H}" stroke="${PAGE.marginColour}" stroke-opacity="0.45" stroke-width="1"/>`,
  );

  // Two lines of handwriting, sitting on rules 4 and 7.
  const firstBaseline = ruleAt(4);
  const secondBaseline = ruleAt(7);

  parts.push(inkGroup(HEADLINE[0], LEFT + 24, firstBaseline - SIZE * 0.7, SIZE, INK, 9));
  parts.push(inkGroup(HEADLINE[1], LEFT + 24, secondBaseline - SIZE * 0.7, SIZE, INK, 23));

  // Plumi's underline, under "don't know" — drawn, not ruled.
  const from = LEFT + 24 + inkWidth("what you ", SIZE);
  const to = LEFT + 24 + inkWidth(HEADLINE[1], SIZE) - inkWidth(".", SIZE);
  const span = to - from;
  parts.push(
    `<path d="M ${from} ${secondBaseline + 22} c ${span * 0.26} -5, ${span * 0.46} 6, ${span * 0.64} 1 s ${span * 0.2} -6, ${span * 0.36} 2"
       fill="none" stroke="${TUTOR}" stroke-width="4" stroke-linecap="round"/>`,
  );

  // The mark, and the name, bottom left. The name is handwritten too — there is
  // no typeface anywhere in this file.
  const footY = H - 74;
  parts.push(
    `<path transform="translate(${LEFT + 24} ${footY - 22}) scale(1.35)"
       d="M12 0.8c.9 5.6 4.7 9.4 10.3 10.3v1.8C16.7 13.8 12.9 17.6 12 23.2h-1.8C9.3 17.6 5.5 13.8 0 12.9v-1.8C5.5 10.2 9.3 6.4 10.2 0.8H12Z"
       fill="#2158D4"/>`,
  );
  parts.push(inkGroup("Plumi", LEFT + 70, footY - 20, 30, INK, 41));
  parts.push(
    inkGroup("iPad + Apple Pencil", LEFT + 210, footY - 18, 26, "#8992A1", 55),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

async function main(): Promise<void> {
  const svg = build();
  const out = join(ROOT, "public", "og.png");
  mkdirSync(dirname(out), { recursive: true });

  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);

  // A square crop, for the few places that want one.
  await sharp(Buffer.from(svg))
    .resize(630, 630, { fit: "cover", position: "left" })
    .png({ compressionLevel: 9 })
    .toFile(join(ROOT, "public", "og-square.png"));

  console.log(`Wrote ${out}`);
}

void main();
