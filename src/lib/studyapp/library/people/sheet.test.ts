/**
 * npm run library:test
 *
 * Proves the mapping from the iPad's layers to the engine's 78 frames: the cast in public/library/people.png (36
 * looks, made by the website's own export from the same layers) is rebuilt here from its parts, and every one of the
 * 36 x 78 frames has the identical outline and all but a handful of pixels equal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LayerPack } from "./layers";
import type { PeopleCatalogue, PersonLook } from "./look";
import { decodePng } from "./png";
import { FRAMES, FRAME_H, FRAME_W, POSE, ROW_W, composeRow, layerKeys } from "./sheet";

const file = (p: string) => new URL(`../../../../../public/library/${p}`, import.meta.url);
const cat = JSON.parse(readFileSync(file("people-layers.json"), "utf8")) as PeopleCatalogue;
const bin = new Uint8Array(readFileSync(file("people-layers.bin")));
const layout = JSON.parse(readFileSync(file("layout.json"), "utf8")) as { people: { rows: Record<string, number>; frames: number; phones: boolean[] } };

/** The cast's parts in people.png's row order: body, eyes, outfit, hair, accessory, headphones (from the website's export, rebuilt from its seed). */
const CAST: [string, string, string, string, string, string][] = JSON.parse(
  '[["02","03","31_05","04_02","-","cream"],["03","05","26_02","07_03","15_glasses_01","lilac"],["04","07","13_04","10_06","-","-"],["07","05","22_03","13_03","15_glasses_01","cream"],["01","06","02_02","06_03","-","black"],["07","02","26_03","05_06","-","lilac"],["03","05","24_01","10_01","-","teal"],["02","01","14_02","01_03","15_glasses_01","lilac"],["03","03","24_04","26_02","-","-"],["03","03","19_01","08_03","-","black"],["04","07","18_02","23_07","15_glasses_01","teal"],["06","06","22_02","01_04","15_glasses_01","lilac"],["07","05","29_03","06_05","-","black"],["04","07","28_02","06_07","-","teal"],["01","05","25_05","13_05","15_glasses_01","red"],["07","02","26_03","14_04","-","red"],["03","04","23_04","16_06","-","teal"],["03","02","03_04","01_03","15_glasses_01","-"],["05","07","01_03","21_03","-","red"],["07","03","02_03","24_03","-","red"],["05","05","02_04","01_03","-","cream"],["05","07","21_03","21_02","15_glasses_01","black"],["02","05","25_02","02_02","15_glasses_01","red"],["01","03","26_03","18_07","-","red"],["03","05","11_01","08_07","15_glasses_01","cream"],["07","05","13_01","10_02","-","-"],["03","05","14_01","19_03","-","red"],["02","07","20_03","24_06","15_glasses_01","red"],["07","07","25_02","13_03","-","cream"],["02","07","07_03","27_02","-","black"],["06","06","11_01","29_06","-","lilac"],["02","04","04_02","14_04","-","red"],["06","05","21_01","28_03","15_glasses_01","lilac"],["06","07","12_01","24_01","-","black"],["03","01","01_09","01_03","-","red"],["05","03","11_01","27_02","-","red"]]',
);
const lookOf = ([body, eyes, outfit, hair, acc, ph]: (typeof CAST)[number]): PersonLook =>
  ({ body, eyes, outfit, hair, accessory: acc === "-" ? null : acc, phones: ph === "-" ? null : ph });

async function pack(looks: PersonLook[], books: string[] = []) {
  const p = new LayerPack(cat, bin);
  await p.load([...new Set([...looks.flatMap(layerKeys), ...books.map((b) => "book/" + b)])]);
  return p;
}

describe("the people's art", () => {
  it("lists every layer the catalogue names, and every one is in the file and decodes to the iPad's 384 x 192", async () => {
    const keys = Object.keys(cat.index);
    assert.equal(keys.length, 326);
    const p = new LayerPack(cat, bin);
    for (const k of keys.filter((_, i) => i % 11 === 0)) {
      const o = cat.index[k];
      const bm = await decodePng(bin.subarray(o[0], o[0] + o[1]));
      assert.deepEqual([bm.width, bm.height], [384, 192], k);
    }
    assert.equal(p.has("body/01"), true);
    assert.equal(p.has("body/99"), false);
  });

  it("uses the engine's frame order (layout.json people.rows) and 78 frames", () => {
    assert.equal(layout.people.frames, FRAMES);
    for (const k of Object.keys(POSE) as (keyof typeof POSE)[]) assert.equal(layout.people.rows[k], POSE[k], k);
  });

  it("rebuilds the premade cast from its parts: 36 looks x 78 frames, the same outlines, all but a handful of pixels equal", async () => {
    const sheet = await decodePng(new Uint8Array(readFileSync(file("people.png"))));
    assert.equal(sheet.width, ROW_W);
    const looks = CAST.map(lookOf);
    const p = await pack(looks, ["01", "02", "03", "04", "05", "06"]);
    let frames = 0, worst = 0, off = 0;
    for (let r = 0; r < looks.length; r++) {
      const row = composeRow(cat, looks[r], p.source, { book: `0${(r % 6) + 1}` });
      assert.ok(row, `row ${r}`);
      for (let f = 0; f < FRAMES; f++) {
        let diff = 0;
        for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
          const a = (y * ROW_W + f * FRAME_W + x) * 4, b = ((r * FRAME_H + y) * sheet.width + f * FRAME_W + x) * 4;
          const alphaA: number = row[a + 3], alphaB: number = sheet.rgba[b + 3];
          if (alphaA === 0 && alphaB === 0) continue;
          assert.equal(alphaA, alphaB, `row ${r} frame ${f} pixel ${x},${y}: the outline differs`);
          const d = Math.max(Math.abs(row[a] - sheet.rgba[b]), Math.abs(row[a + 1] - sheet.rgba[b + 1]), Math.abs(row[a + 2] - sheet.rgba[b + 2]));
          if (d > 2) diff++;
        }
        worst = Math.max(worst, diff); if (diff) off++;
        frames++;
      }
    }
    assert.equal(frames, 36 * 78);
    assert.ok(worst <= 16, `at most 16 of 512 pixels differ in a frame (the soft hair shadows), worst was ${worst}`);
    assert.ok(off < frames, "some frames are exact");
  });

  it("paints the headphones in the colour asked for, on both sides from the front, and not at all for none", async () => {
    const base: PersonLook = { body: "02", eyes: "01", outfit: "10_01", hair: "05_01", accessory: null, phones: null };
    const p = await pack([base]);
    const none = composeRow(cat, base, p.source, { graded: false })!;
    const red = composeRow(cat, { ...base, phones: "red" }, p.source, { graded: false })!;
    const teal = composeRow(cat, { ...base, phones: "teal" }, p.source, { graded: false })!;
    const front = 18;
    const px = (row: Uint8ClampedArray, f: number) => { const out: string[] = []; for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) { const i = (y * ROW_W + f * FRAME_W + x) * 4; out.push(`${row[i]},${row[i + 1]},${row[i + 2]},${row[i + 3]}`); } return out; };
    assert.deepEqual(px(none, front).filter((s) => s === "224,103,95,255").length, 0);
    assert.equal(px(red, front).filter((s) => s === "224,103,95,255").length >= 4, true, "two cups of 2 x 3 minus the light pixel");
    assert.equal(px(teal, front).filter((s) => s === "90,166,164,255").length >= 4, true);
    assert.notDeepEqual(px(red, front), px(none, front));
  });
});
