import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { practicePacks } from "../../src/content/practicePacks";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Each practice pack's share card, at 1200x630, in the style of og-lofi.png: the notebook paper, the
// pack's name and facts in Pixelify Sans, its real cover taped on at a tilt, and the FREE stamp.
// Run `npx tsx scripts/practice-packs/og.ts` after build.sh. Writes public/practice-packs/<slug>/og.png.
const W = 1200, H = 630;
const c = { paper: "#f6efe1", rule: "#d5e1ef", margin: "#e9a89a", ink: "#4a3a36", inkSoft: "#7a665d", line: "#5b4741", blue: "#4f86c6", orange: "#d9702f", red: "#d33a2f" };
const fontfile = join(root, "src/components/cosy/PixelifySans-SemiBold.ttf");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

async function text(markup: string, size: number) {
  return sharp({ text: { text: markup, font: `Pixelify Sans SemiBold ${size}`, fontfile, rgba: true, dpi: 72 } }).png().toBuffer();
}

async function main() {
  const rules = Array.from({ length: Math.floor(H / 37) }, (_, i) => `<rect y="${37 * (i + 1) - 2}" width="${W}" height="2" fill="${c.rule}"/>`).join("");
  const paper = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${c.paper}"/>${rules}<rect x="86" width="2" height="${H}" fill="${c.margin}"/></svg>`);
  const logo = await sharp(join(root, "public/landing/plumi-mood-happy.svg")).resize(58, 58).png().toBuffer();

  for (const p of practicePacks) {
    // The cover with a dark edge and a hard shadow, as the site draws cards, then tilted.
    const cw = 330, ch = Math.round(cw * 1274 / 900);
    const cover = await sharp(join(root, `public/practice-packs/${p.slug}/cover.webp`)).resize(cw, ch).png().toBuffer();
    const card = Buffer.from(`<svg width="${cw + 14}" height="${ch + 16}" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="12" width="${cw + 6}" height="${ch + 4}" rx="8" fill="${c.line}"/><rect width="${cw + 6}" height="${ch + 6}" rx="8" fill="${c.line}"/></svg>`);
    const framed = await sharp(card).composite([{ input: cover, left: 3, top: 3 }]).png().toBuffer();
    const tilted = await sharp(framed).rotate(4, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const stamp = Buffer.from(`<svg width="150" height="150" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-12 75 75)"><circle cx="75" cy="75" r="66" fill="#fffdf8" stroke="${c.red}" stroke-width="6"/><circle cx="75" cy="75" r="56" fill="none" stroke="${c.red}" stroke-width="3"/></g></svg>`);
    const free = await sharp({ text: { text: `<span foreground="${c.red}">FREE</span>`, font: `Pixelify Sans SemiBold 40`, fontfile, rgba: true, dpi: 72 } }).rotate(-12, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const freeMeta = await sharp(free).metadata();
    const tape = Buffer.from(`<svg width="120" height="40" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="108" height="28" fill="rgba(220,229,151,.9)" transform="rotate(-4 60 20)"/></svg>`);

    const layers = [
      { input: logo, left: 118, top: 38 },
      { input: await text(`<span foreground="${c.ink}">plumi</span>`, 46), left: 184, top: 46 },
      { input: await text(`<span foreground="${c.blue}">Free practice pack · no sign-up</span>`, 30), left: 120, top: 150 },
      { input: await text(`<span foreground="${c.ink}">${esc(p.title)}</span>`, 64), left: 118, top: 206 },
      { input: await text(`<span foreground="${c.orange}">${p.board}-style · ${p.spec}</span>`, 50), left: 120, top: 290 },
      { input: await text(`<span foreground="${c.inkSoft}">${p.questions.length} questions · ${p.marks} marks</span>`, 32), left: 120, top: 400 },
      { input: await text(`<span foreground="${c.inkSoft}">easy to super hard, full mark scheme</span>`, 32), left: 120, top: 444 },
      { input: await text(`<span foreground="${c.inkSoft}">tryplumi.app</span>`, 26), left: 120, top: 540 },
      { input: tilted, left: 770, top: 40 },
      { input: tape, left: 880, top: 30 },
      { input: stamp, left: 1010, top: 430 },
      { input: free, left: 1085 - Math.round((freeMeta.width ?? 0) / 2), top: 505 - Math.round((freeMeta.height ?? 0) / 2) },
    ];
    await sharp(paper).composite(layers).png({ compressionLevel: 9 }).toFile(join(root, `public/practice-packs/${p.slug}/og.png`));
    console.log(`og.png for ${p.slug}`);
  }
}
void main();
