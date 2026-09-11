import sharp from "sharp";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Uses the same actual Tutor screenshot and approved bird as the page. Run yarn og.
async function main() {
  const background = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#fcfcf9"/><text x="64" y="102" fill="#2158d4" font-family="sans-serif" font-size="27" font-weight="600">Plumi</text><text x="64" y="239" fill="#16202e" font-family="sans-serif" font-size="60" font-weight="600" letter-spacing="-2">Your notebook.</text><text x="64" y="312" fill="#2158d4" font-family="sans-serif" font-size="60" font-weight="600" letter-spacing="-2">Now your tutor.</text><text x="66" y="382" fill="#64717c" font-family="sans-serif" font-size="21">Write naturally. Get help on the page.</text><text x="66" y="532" fill="#64717c" font-family="sans-serif" font-size="16">Made for iPad · Launching 25 September 2026</text></svg>`);
  const screen = await sharp(join(root,"public/product/tutor-5.webp")).resize(535,350).toBuffer();
  const bird = await sharp(join(root,"public/mascot/plumi-welcoming.webp")).resize(170,170).toBuffer();
  const frame = Buffer.from('<svg width="565" height="380" xmlns="http://www.w3.org/2000/svg"><rect width="565" height="380" rx="22" fill="#26303b"/></svg>');
  const image = await sharp(background).composite([{input:frame,left:618,top:174},{input:screen,left:633,top:189},{input:bird,left:946,top:55}]).png().toBuffer();
  await sharp(image).toFile(join(root,"public/og.png"));
  await sharp(image).resize(630,630,{fit:"cover",position:"left"}).toFile(join(root,"public/og-square.png"));
  console.log("Generated social previews from real Plumi assets");
}
void main();
