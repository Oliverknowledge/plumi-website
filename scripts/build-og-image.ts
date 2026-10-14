import sharp from "sharp";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The homepage's promise and its real marked page, at 1200x630. Run yarn og.
async function main() {
  const font = "Inter, 'Helvetica Neue', Arial, sans-serif";
  const background = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#ffffff"/><text x="64" y="96" fill="#1d1d1f" font-family="${font}" font-size="30" font-weight="700" letter-spacing="-0.5">Plumi</text><text x="64" y="250" fill="#1d1d1f" font-family="${font}" font-size="68" font-weight="700" letter-spacing="-2.6">Handwrite it.</text><text x="64" y="332" fill="#2158d4" font-family="${font}" font-size="68" font-weight="700" letter-spacing="-2.6">Plumi marks it.</text><text x="66" y="398" fill="#6e6e73" font-family="${font}" font-size="25" letter-spacing="-0.3">GCSE &amp; A-Level revision app for iPad</text><text x="66" y="436" fill="#6e6e73" font-family="${font}" font-size="25" letter-spacing="-0.3">AQA, OCR and Edexcel</text></svg>`);
  const screen = await sharp(join(root, "public/site/shot-mark.webp")).resize(560, 420).toBuffer();
  const mask = Buffer.from('<svg width="560" height="420"><rect width="560" height="420" rx="16" fill="#fff"/></svg>');
  const rounded = await sharp(screen).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const frame = Buffer.from('<svg width="592" height="452" xmlns="http://www.w3.org/2000/svg"><rect width="592" height="452" rx="30" fill="#1a1b1f"/></svg>');
  const image = await sharp(background).composite([{ input: frame, left: 576, top: 108 }, { input: rounded, left: 592, top: 124 }]).png().toBuffer();
  await sharp(image).toFile(join(root, "public/og.png"));
  await sharp(image).resize(630, 630, { fit: "cover", position: "right" }).toFile(join(root, "public/og-square.png"));
  // One per subject page: the subject's own promise beside its real question picture.
  const subjects = [
    { slug: "physics", name: "Physics", image: "public/site/shot-mark.webp", ipad: true },
    { slug: "chemistry", name: "Chemistry", image: "public/site/diagram-chemb.webp", ipad: false },
    { slug: "biology", name: "Biology", image: "public/site/diagram-biob.webp", ipad: false },
  ];
  for (const s of subjects) {
    const text = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#fcfcf9"/><text x="64" y="96" fill="#1d1d1f" font-family="${font}" font-size="30" font-weight="700" letter-spacing="-0.5">Plumi</text><text x="64" y="250" fill="#1d1d1f" font-family="${font}" font-size="54" font-weight="700" letter-spacing="-2">${s.name} revision</text><text x="64" y="318" fill="#2158d4" font-family="${font}" font-size="54" font-weight="700" letter-spacing="-2.4">that marks it.</text><text x="66" y="394" fill="#6e6e73" font-family="${font}" font-size="25" letter-spacing="-0.3">GCSE &amp; A-Level · AQA, OCR, Edexcel</text><text x="66" y="432" fill="#6e6e73" font-family="${font}" font-size="25" letter-spacing="-0.3">For iPad and Apple Pencil</text></svg>`);
    const pic = await sharp(join(root, s.image)).resize(500, 375, { fit: "contain", background: "#ffffff" }).toBuffer();
    const smallMask = Buffer.from('<svg width="500" height="375"><rect width="500" height="375" rx="14" fill="#fff"/></svg>');
    const picRounded = await sharp(pic).composite([{ input: smallMask, blend: "dest-in" }]).png().toBuffer();
    const smallFrame = Buffer.from('<svg width="530" height="405" xmlns="http://www.w3.org/2000/svg"><rect width="530" height="405" rx="28" fill="#1a1b1f"/></svg>');
    const card = Buffer.from('<svg width="530" height="405" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="528" height="401" rx="26" fill="#ffffff" stroke="#e3e5e9" stroke-width="2"/></svg>');
    const layers = [{ input: s.ipad ? smallFrame : card, left: 628, top: 112 }, { input: picRounded, left: 643, top: 127 }];
    await sharp(text).composite(layers).png().toFile(join(root, `public/og-${s.slug}.png`));
  }
  console.log("Generated social previews from real Plumi assets");
}
void main();
