/**
 * The head the lists draw: the front idle frame cropped to head and shoulders, at a whole scale for the device. Held
 * on the real art (public/library): every hairstyle fits the crop, two people differ, someone with no avatar is the
 * person their id makes, and the scale is the same whole number at 1x, 2x and 3x.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LayerPack } from "./layers";
import { personOf, type PeopleCatalogue, type PersonLook } from "./look";
import { HEAD, cropHead, headPx, headScale, inkOf, scaleHead } from "./headCrop";
import { FRAME_H, FRAME_W, ROW_W, composeRow, layerKeys } from "./sheet";

const file = (p: string) => new URL(`../../../../../public/library/${p}`, import.meta.url);
const cat = JSON.parse(readFileSync(file("people-layers.json"), "utf8")) as PeopleCatalogue;
const bin = new Uint8Array(readFileSync(file("people-layers.bin")));

async function rowOf(look: PersonLook) {
  const p = new LayerPack(cat, bin);
  await p.load(layerKeys(look));
  const row = composeRow(cat, look, p.source, { book: null });
  assert.ok(row, "the row is built");
  return row;
}
const same = (a: ArrayLike<number>, b: ArrayLike<number>) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

describe("the head crop", () => {
  it("is the whole frame width and sixteen rows, from the front idle frame", () => {
    assert.deepEqual([HEAD.frame, HEAD.w, HEAD.h], [18, 16, 16]);
    assert.equal(HEAD.frame * FRAME_W + HEAD.w <= ROW_W, true);
    assert.equal(HEAD.y + HEAD.h <= FRAME_H, true);
  });

  it("holds the whole head of every hairstyle: only the tips of the two tallest are left out, and the crop is not mostly empty", async () => {
    // every hairstyle on the first body and outfit: the lost rows are one for styles 03 and 26 (spikes), three for style 11 (two thin tufts), none for the rest
    let highest = FRAME_H;
    for (const hair of cat.parts.hair) {
      const look: PersonLook = { body: cat.parts.bodies[0].id, eyes: cat.parts.eyes[0].id, outfit: cat.parts.outfits[0].id, hair: hair.id, accessory: null, phones: null };
      const row = await rowOf(look);
      let top = FRAME_H, bottom = 0;
      for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) if (row[(y * ROW_W + HEAD.frame * FRAME_W + x) * 4 + 3] > 0) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
      highest = Math.min(highest, top);
      const lost = Math.max(0, HEAD.y - top);
      const allowed = hair.id.startsWith("11_") ? 3 : hair.id.startsWith("03_") || hair.id.startsWith("26_") ? 1 : 0;
      assert.ok(lost <= allowed, `${hair.id} starts at row ${top}: ${lost} rows cut, only ${allowed} allowed`);
      assert.ok(bottom >= HEAD.y + HEAD.h - 1, "there is a figure down to the bottom of the crop (the chin is not cut off by an empty frame)");
    }
    assert.ok(highest >= HEAD.y - 3 && highest <= HEAD.y, `tallest hair at row ${highest}`);
  });

  it("draws somebody: the head is not blank, and two different people are different pictures", async () => {
    const a = personOf(cat, { body: "05", eyes: "03", outfit: "04_02", hair: "06_03", acc: "15_glasses_01", phones: "teal" }, 1, "u-a");
    const b = personOf(cat, { body: "01", eyes: "05", outfit: "24_01", hair: "19_04", acc: "none", phones: "none" }, 2, "u-b");
    const ha = cropHead(await rowOf(a)), hb = cropHead(await rowOf(b));
    assert.ok(inkOf(ha) > 0.6 && inkOf(ha) <= 1, `ink ${inkOf(ha)}`);
    assert.ok(inkOf(hb) > 0.6, `ink ${inkOf(hb)}`);
    assert.equal(same(ha, hb), false);
    for (const px of [32, 64, 96, 120, 168]) assert.equal(same(scaleHead(ha, px), scaleHead(hb, px)), false, `different at ${px}px`);
  });

  it("draws the derived person for a student with no avatar, from their id: the same one every time, a different one for another id", async () => {
    const x1 = cropHead(await rowOf(personOf(cat, null, 3, "student-one")));
    const x2 = cropHead(await rowOf(personOf(cat, null, 3, "student-one")));
    const y = cropHead(await rowOf(personOf(cat, null, 3, "student-two")));
    assert.ok(inkOf(x1) > 0.6);
    assert.ok(same(x1, x2), "the same id is the same person");
    assert.equal(same(x1, y), false, "another id is another person");
    // an avatar with only the old keys is a person too (the iPad's `RoomAvatar.legacyLook`)
    const old = cropHead(await rowOf(personOf(cat, { feather: "pink", top: "hoodie", colour: "#5a86bf", hat: "none", glasses: "round" }, 1, "student-one")));
    assert.ok(inkOf(old) > 0.6);
  });
});

describe("crisp at 1x, 2x and 3x", () => {
  it("scales by a whole number: the same pixel is a block of the same size, never a stretched one", () => {
    for (const size of [32, 40, 56]) for (const dpr of [1, 2, 3]) {
      const px = headPx(size, dpr), s = headScale(px);
      assert.equal(px, size * dpr);
      assert.ok(s >= 1 && Number.isInteger(s));
      assert.ok(HEAD.w * s <= px, "it fits the tile");
      assert.ok(px - HEAD.w * s < HEAD.w, "and uses the most whole scale that does");
    }
    assert.deepEqual([32, 40, 56].map((n) => headScale(headPx(n, 1))), [2, 2, 3]);
    assert.deepEqual([32, 40, 56].map((n) => headScale(headPx(n, 2))), [4, 5, 7]);
    assert.deepEqual([32, 40, 56].map((n) => headScale(headPx(n, 3))), [6, 7, 10]);
  });

  it("every source pixel becomes an s x s block of the same colour", () => {
    const head = new Uint8ClampedArray(HEAD.w * HEAD.h * 4);
    for (let i = 0; i < HEAD.w * HEAD.h; i++) head.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256, 255], i * 4);
    for (const px of [32, 40, 80, 120]) {
      const s = headScale(px), out = scaleHead(head, px), o = Math.floor((px - HEAD.w * s) / 2);
      for (let y = 0; y < HEAD.h * s; y++) for (let x = 0; x < HEAD.w * s; x++) {
        const si = (Math.floor(y / s) * HEAD.w + Math.floor(x / s)) * 4, di = ((o + y) * px + (o + x)) * 4;
        assert.ok(same(out.subarray(di, di + 4), head.subarray(si, si + 4)), `${px}px (${x},${y})`);
      }
      if (o > 0) assert.equal(out[3], 0, "the margin is transparent");
    }
  });

  it("a nonsense pixel ratio is treated as 1x", () => {
    assert.equal(headPx(40, 0), 40);
    assert.equal(headPx(40, NaN), 40);
    assert.equal(headPx(40, -2), 40);
  });
});
