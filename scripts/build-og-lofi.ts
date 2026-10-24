import sharp from "sharp";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The cosy homepage as a share card, at 1200x630: its notebook paper, its hero line, the grand
// library's fireside through the hero window, and Plumi. Run yarn og:lofi. A new filename rather than
// over og.png, because chat apps cache a preview by its image URL.
const W = 1200, H = 630;
const c = { paper: "#f6efe1", rule: "#d5e1ef", margin: "#e9a89a", ink: "#4a3a36", inkSoft: "#7a665d", line: "#5b4741", blue: "#4f86c6", orange: "#d9702f" };
const fontfile = join(root, "src/components/cosy/PixelifySans-SemiBold.ttf");

/** One line of Pixelify Sans, as the site sets its headings. */
async function text(markup: string, size: number) {
  return sharp({ text: { text: markup, font: `Pixelify Sans SemiBold ${size}`, fontfile, rgba: true, dpi: 72 } }).png().toBuffer();
}

async function main() {
  const rules = Array.from({ length: Math.floor(H / 37) }, (_, i) => `<rect y="${37 * (i + 1) - 2}" width="${W}" height="2" fill="${c.rule}"/>`).join("");
  const paper = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="${c.paper}"/>${rules}<rect x="86" width="2" height="${H}" fill="${c.margin}"/></svg>`);

  // The hero window: the library's fireside, art pixels doubled with nearest-neighbour as the page draws them.
  const win = { x: 752, y: 112, w: 400, bar: 36, crop: { left: 386, top: 200, width: 196, height: 150 } };
  const scene = await sharp(join(root, "public/library/bg.png")).extract(win.crop).resize({ width: win.crop.width * 2, kernel: "nearest" }).toBuffer();
  const winH = 4 + win.bar + win.crop.height * 2 + 4;
  const dots = [c.orange, "#f2c96b", "#7cc6c2"].map((f, i) => `<rect x="${18 + i * 18}" y="${win.bar / 2 - 3}" width="9" height="9" rx="2" fill="${f}"/>`).join("");
  const frame = Buffer.from(`<svg width="${win.w + 8}" height="${winH + 8}" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="${win.w}" height="${winH}" rx="14" fill="${c.line}"/><rect width="${win.w}" height="${winH}" rx="14" fill="${c.line}"/>${dots}</svg>`);
  const sceneMask = Buffer.from(`<svg width="${win.crop.width * 2}" height="${win.crop.height * 2}"><rect width="100%" height="100%" rx="10" fill="#fff"/></svg>`);
  const sceneRounded = await sharp(scene).composite([{ input: sceneMask, blend: "dest-in" }]).png().toBuffer();
  const winLabel = await text(`<span foreground="${c.paper}">the grand library · 21:40</span>`, 17);
  const winLabelWidth = (await sharp(winLabel).metadata()).width ?? 0;

  const logo = await sharp(join(root, "public/landing/plumi-mood-happy.svg")).resize(58, 58).png().toBuffer();
  const plumi = await sharp(join(root, "public/landing/plumi-lofi-cozy-anim.svg")).resize(259, 259, { kernel: "nearest" }).png().toBuffer();

  const layers = [
    { input: logo, left: 118, top: 38 },
    { input: await text(`<span foreground="${c.ink}">plumi</span>`, 46), left: 184, top: 46 },
    { input: await text(`<span foreground="${c.blue}">GCSE &amp; A-Level revision · free on iPad</span>`, 30), left: 120, top: 146 },
    { input: await text(`<span foreground="${c.ink}">The cosy notebook</span>`, 66), left: 118, top: 206 },
    { input: await text(`<span foreground="${c.ink}">that </span><span foreground="${c.orange}">marks</span>`, 66), left: 118, top: 284 },
    { input: await text(`<span foreground="${c.orange}">your work.</span>`, 66), left: 118, top: 362 },
    { input: await text(`<span foreground="${c.inkSoft}">Handwrite it with Apple Pencil.</span>`, 30), left: 120, top: 474 },
    { input: await text(`<span foreground="${c.inkSoft}">Plumi marks it line by line.</span>`, 30), left: 120, top: 514 },
    { input: frame, left: win.x, top: win.y },
    { input: winLabel, left: win.x + win.w - 18 - winLabelWidth, top: win.y + 9 },
    { input: sceneRounded, left: win.x + 4, top: win.y + win.bar },
    { input: plumi, left: 930, top: 336 },
  ];
  await sharp(paper).composite(layers).png().toFile(join(root, "public/og-lofi.png"));
  console.log("Generated the cosy share card");
}
void main();
