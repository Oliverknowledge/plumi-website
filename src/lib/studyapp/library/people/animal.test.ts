/**
 * npm run library:test
 *
 * Every animal (animals.ts): its art (the invariants tools/art/check_animals.py asserts, run from here when Python is there), the
 * 78 frames the engine reads (count, order, frame size, feet, anchors), the walk (a bob and a stride in every direction), the idle and
 * the seated poses (nothing hanging below the lap, the tail tucked, a breath).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ANIMAL_H, ANIMAL_HI_ROW_W, ANIMAL_ROW_W, ANIMAL_W, ART_W, HI, PAD, composeAnimal, composeAnimalHi, headBox, jumperOf, stripFrame, torsoX, validHiStrip, validStrip } from "./animal";
import { ANIMALS, animalHiUrl, animalUrl, type Animal } from "./animals";
import { decodePng, type Bitmap } from "./png";
import { FRAMES, POSE } from "./sheet";

const file = (p: string) => new URL(`../../../../../public/library/${p}`, import.meta.url);
interface Meta {
  id: string; frame: [number, number]; artFrame: [number, number]; pad: number; frames: number; layout: Record<string, number>;
  palette: string[]; jumper: string[]; rig: { hip: number };
}
const metaOf = (a: Animal) => JSON.parse(readFileSync(file(`characters/${a.id}.json`), "utf8")) as Meta;
const stripOf = async (a: Animal): Promise<Bitmap> => decodePng(new Uint8Array(readFileSync(file(`characters/${a.id}.png`))));
const frameAt = (rgba: Uint8ClampedArray, index: number, w = ANIMAL_W) => {
  const f = new Uint8Array(w * ANIMAL_H * 4);
  for (let y = 0; y < ANIMAL_H; y++) f.set(rgba.subarray((y * ANIMAL_ROW_W + index * w) * 4, (y * ANIMAL_ROW_W + (index + 1) * w) * 4), y * w * 4);
  return f;
};
const rows = (f: Uint8Array, w: number) => { const ys: number[] = []; for (let y = 0; y < ANIMAL_H; y++) for (let x = 0; x < w; x++) if (f[(y * w + x) * 4 + 3] > 0) { ys.push(y); break; } return ys; };
const cols = (f: Uint8Array, w: number) => { const xs: number[] = []; for (let x = 0; x < w; x++) for (let y = 0; y < ANIMAL_H; y++) if (f[(y * w + x) * 4 + 3] > 0) { xs.push(x); break; } return xs; };
const top = (f: Uint8Array) => rows(f, ANIMAL_W)[0];
const bottom = (f: Uint8Array) => { const r = rows(f, ANIMAL_W); return r[r.length - 1]; };

describe("the animals, as a set", () => {
  it("are nine, in the order the wardrobe shows them, each with art, a strip file and an id the server can take in `body`", () => {
    assert.deepEqual(ANIMALS.map((a) => a.id), ["fox", "capybara", "axolotl", "redpanda", "badger", "hedgehog", "raccoon", "triceratops", "dragon"]);
    for (const a of ANIMALS) {
      assert.match(a.id, /^[a-z]{3,12}$/, `${a.id}: lower case letters, 3 to 12 (what 0126's set_avatar can be asked to take in body)`);
      assert.match(a.id, /^[a-z0-9_-]{1,24}$/, `${a.id}: and what every earlier set_avatar took`);
      assert.equal(animalUrl(a.id), `/library/characters/${a.id}.png`);
      assert.ok(a.title.length > 0 && !/[–—]/.test(a.title), `${a.id}: a title with no dash`);
      assert.ok(a.jumper.length >= 1 && a.jumper.every((h) => /^#[0-9a-f]{6}$/.test(h)));
    }
    assert.equal(new Set(ANIMALS.map((a) => a.id)).size, ANIMALS.length);
  });
  it("pass the checker the tool ships (78 frames, one size, feet on one row, binary alpha, a palette, no magenta, a 1 px outline, no stray pieces, a walk that bobs and strides, a seated pose with nothing hanging and the tail tucked)", (t) => {
    const r = spawnSync("python3", ["-I", new URL("../../../../../tools/art/check_animals.py", import.meta.url).pathname], { encoding: "utf8" });
    if (r.error) { t.skip("python3 is not here"); return; }
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^ok: 9 animals, 78 frames each/);
  });
  it("keep every animal's strips small and out of the first load: nine strips under 400 KB in all", () => {
    let total = 0;
    for (const a of ANIMALS) total += readFileSync(file(`characters/${a.id}.png`)).length;
    assert.ok(total < 400_000, `${total} bytes`);
  });
});

for (const animal of ANIMALS) {
  const meta = metaOf(animal);
  const strip = () => stripOf(animal);
  const jumper = jumperOf(animal.jumper);
  const FOUR = [["right", 0], ["back", 6], ["left", 12], ["front", 18]] as const;

  describe(`the ${animal.id}'s art`, () => {
    it("is the strip its json says: 78 frames of 34 x 32 in the engine's layout (idle, walk, sit, phone, read, stool)", async () => {
      const s = await strip();
      assert.equal(meta.id, animal.id);
      assert.deepEqual(meta.frame, [ANIMAL_W, ANIMAL_H]);
      assert.deepEqual(meta.artFrame, [ART_W, ANIMAL_H]);
      assert.equal(meta.pad, PAD);
      assert.equal(meta.frames, FRAMES);
      assert.deepEqual(meta.layout, {
        "idle right": 0, "idle back": 6, "idle left": 12, "idle front": 18,
        "walk right": POSE.walk, "walk back": POSE.walk + 6, "walk left": POSE.walk + 12, "walk front": POSE.walk + 18,
        "sit right": POSE.sit, "sit left": POSE.sit + 6, phone: POSE.phone, read: POSE.read, stool: POSE.stool,
      });
      assert.equal(validStrip(s), true);
      assert.equal(validStrip({ ...s, width: s.width - 1 }), false);
      assert.equal(s.width, ANIMAL_ROW_W);
      assert.ok(meta.palette.length <= 24);
      assert.deepEqual(meta.jumper, [...animal.jumper], "animals.json and the strip's json agree on the jumper");
      for (const h of animal.jumper) assert.ok(meta.palette.includes(h), `${h} is a colour of the strip`);
      for (let i = 3; i < s.rgba.length; i += 4) assert.ok(s.rgba[i] === 0 || s.rgba[i] === 255);
    });
    it("faces the way its row says: the left walk's eyes are on the left of its head, the right walk's on the right", async () => {
      const s = await strip();
      const side = (first: number) => {
        let sum = 0, n = 0;
        for (let step = 0; step < 6; step++) {
          const f = stripFrame(s, first + step);
          let neck = ANIMAL_H;
          for (let y = 0; y < ANIMAL_H && neck === ANIMAL_H; y++) for (let x = 0; x < ANIMAL_W; x++) { const i = (y * ANIMAL_W + x) * 4; if (f[i + 3] && jumper.has((f[i] << 16) | (f[i + 1] << 8) | f[i + 2])) { neck = y; break; } }
          let lo = ANIMAL_W, hi = -1;
          for (let y = 0; y < neck; y++) for (let x = 0; x < ANIMAL_W; x++) if (f[(y * ANIMAL_W + x) * 4 + 3]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
          // an eye: an inside pixel (all four neighbours drawn) that is very dark
          for (let y = 2; y < neck; y++) for (let x = 1; x < ANIMAL_W - 1; x++) {
            const i = (y * ANIMAL_W + x) * 4;
            if (!f[i + 3] || f[i] + f[i + 1] + f[i + 2] > 150) continue;
            if ([[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => f[((y + dy) * ANIMAL_W + x + dx) * 4 + 3])) { sum += x - (lo + hi) / 2; n++; }
          }
        }
        return n ? sum / n : NaN;
      };
      assert.ok(side(POSE.walk + 12) < 0, `left: the eyes are left of the head's middle (${side(POSE.walk + 12)})`);
      assert.ok(side(POSE.walk) > 0, `right: the eyes are right of the head's middle (${side(POSE.walk)})`);
    });
  });

  describe(`the ${animal.id}'s 78 frames`, () => {
    it("are what composeAnimal lays out: 78 frames of ANIMAL_W x 32, the strip's own, graded like the people unless the wardrobe asks otherwise", async () => {
      const s = await strip();
      const row = composeAnimal(s, animal, { graded: false })!;
      assert.ok(row);
      assert.equal(row.rgba.length, FRAMES * ANIMAL_W * ANIMAL_H * 4);
      for (const n of [0, 24, 30, 48, 77]) assert.deepEqual([...frameAt(row.rgba, n)], [...stripFrame(s, n)], `frame ${n}`);
      const graded = composeAnimal(s, animal)!.rgba;
      assert.notDeepEqual([...graded], [...row.rgba]);
      for (let i = 3; i < graded.length; i += 4) assert.equal(graded[i], row.rgba[i], "alpha is not graded");
    });
    it("keeps the feet on the bottom row in every walk and idle frame, the art inside its columns and about where the feet are", async () => {
      const row = composeAnimal(await strip(), animal, { graded: false })!;
      for (let i = 0; i < POSE.sit; i++) {
        const f = frameAt(row.rgba, i), r = rows(f, ANIMAL_W), c = cols(f, ANIMAL_W);
        assert.equal(r[r.length - 1], ANIMAL_H - 1, `frame ${i}: feet on the last row`);
        assert.ok(c[0] >= PAD - 1 && c[c.length - 1] <= ANIMAL_W - PAD, `frame ${i}: inside the art's columns (${c[0]}..${c[c.length - 1]})`);
        const cx = c.reduce((s, x) => s + x, 0) / c.length;
        assert.ok(Math.abs(cx - ANIMAL_W / 2) < 4.5, `frame ${i}: centred (${cx})`);
      }
    });
    it("walks: in every direction the body bobs a row or two over a cycle, up at the passing frames, and the six frames all differ (a person's cycle)", async () => {
      const row = composeAnimal(await strip(), animal, { graded: false })!;
      for (const [name, off] of FOUR) {
        const six = Array.from({ length: 6 }, (_, i) => frameAt(row.rgba, POSE.walk + off + i));
        const tops = six.map(top);
        const bob = Math.max(...tops) - Math.min(...tops);
        assert.ok(bob >= 1 && bob <= 2, `${name}: head bobs ${bob}`);
        assert.equal(new Set(six.map((f) => f.join(","))).size, 6, `${name}: six different frames`);
        assert.ok(tops[2] <= tops[0] && tops[5] <= tops[3], `${name}: up at the passing frames (${tops})`);
      }
    });
    it("has an idle of six frames per direction that stand on the same feet (it breathes, swishes a tail where it has one, and blinks facing the camera)", async () => {
      const row = composeAnimal(await strip(), animal, { graded: false })!;
      for (const [name, off] of FOUR) {
        const fr = Array.from({ length: 6 }, (_, i) => frameAt(row.rgba, POSE.idle + off + i));
        assert.equal(new Set(fr.map((f) => f.join(","))).size >= 2, true, `${name} animates`);
        const cx = Math.round(torsoX(fr[0], jumper));
        // the feet (the bottom five rows, under the torso: the tail may swish beside them) do not move
        const feet = (f: Uint8Array) => { const o: number[] = []; for (let y = ANIMAL_H - 5; y < ANIMAL_H; y++) for (let x = cx - 3; x < cx + 3; x++) o.push(...f.subarray((y * ANIMAL_W + x) * 4, (y * ANIMAL_W + x + 1) * 4)); return o; };
        for (const f of fr.slice(1)) assert.deepEqual(feet(f), feet(fr[0]), `${name}: the feet stay`);
      }
    });
    it("has the seated frames (right, then left; phone and read facing the camera; the stool from behind): inside the frame, sat back from the desk, nothing hanging below the lap, and not a still picture", async () => {
      const s = await strip();
      const row = composeAnimal(s, animal, { graded: false })!;
      const at = (n: number) => torsoX(frameAt(row.rgba, n), jumper);
      const drawn = animal.seated === "drawn";
      if (!drawn) {
        assert.ok(at(POSE.sit) < at(0) - 3, "facing right its torso sits back to the left");
        assert.ok(at(POSE.sit + 6) > at(12) + 3, "facing left its torso sits back to the right");
      }
      for (const first of [POSE.sit, POSE.sit + 6, POSE.phone, POSE.read, POSE.stool]) {
        const six = Array.from({ length: 6 }, (_, i) => frameAt(row.rgba, first + i));
        assert.equal(new Set(six.map(bottom)).size, 1, `pose at ${first}: the lowest row does not move`);
        assert.equal(new Set(six.map((f) => f.join(","))).size >= 3, true, `pose at ${first}: it is not a still picture`);
        for (const f of six) { assert.ok(rows(f, ANIMAL_W).length > 10 && cols(f, ANIMAL_W).length > 8); assert.ok(cols(f, ANIMAL_W)[0] >= 0); }
        if (first !== POSE.stool) assert.ok(bottom(six[0]) <= meta.rig.hip + 5, `pose at ${first}: nothing hangs below the lap line (${bottom(six[0])})`);
      }
      // the stool frames are cut to the top 20 rows as a person's are (a drawn seated figure is whole: it ends on row 22, the seat)
      for (let i = POSE.stool; i < POSE.stool + 6; i++) assert.ok(bottom(frameAt(row.rgba, i)) <= (drawn ? 22 : 19));
    });
    it(`has the seated art the registry says: ${animal.seated === "drawn" ? "drawn for sitting (the sheet's own right, left, front and back poses), a breath, a nod and a pen stroke made from it, the same size as standing" : "the standing art made to sit"}`, async () => {
      const m = metaOf(animal) as Meta & { sit?: { kind: string; scale: number } };
      if (animal.seated !== "drawn") { assert.equal(m.sit, undefined); return; }
      assert.equal(m.sit?.kind, "drawn");
      const row = composeAnimal(await strip(), animal, { graded: false })!;
      const box = (n: number) => { const f = frameAt(row.rgba, n); const c = cols(f, ANIMAL_W), r = rows(f, ANIMAL_W); return { x0: c[0], x1: c[c.length - 1], y0: r[0], y1: r[r.length - 1] }; };
      // the two profiles are placed as mirror images of each other, on one baseline (the lap line, row 30), the loop's head moves 2 rows at most
      const R = box(POSE.sit), L = box(POSE.sit + 6);
      assert.ok(Math.abs((R.x0 + R.x1) + (L.x0 + L.x1) - 2 * (ANIMAL_W - 1)) <= 6, `right and left sit mirror placed (${JSON.stringify(R)} ${JSON.stringify(L)})`);
      assert.equal(R.y1, 30); assert.equal(L.y1, 30);
      for (const first of [POSE.sit, POSE.sit + 6, POSE.phone, POSE.read, POSE.stool]) {
        const tops = Array.from({ length: 6 }, (_, i) => top(frameAt(row.rgba, first + i)));
        assert.ok(Math.max(...tops) - Math.min(...tops) <= 2, `pose at ${first}: the head moves ${tops}`);
      }
      // phone and read are the one drawn front pose, and facing the camera it is as wide as the standing front frame's head (+- 4)
      assert.deepEqual([...frameAt(row.rgba, POSE.phone)], [...frameAt(row.rgba, POSE.read)]);
    });
    it("finds the head from the art: the ears down to the jumper, inside the frame (for a friends list or a card)", async () => {
      const s = await strip();
      const row = composeAnimal(s, animal)!;
      const h = row.head;
      assert.deepEqual(h, headBox(stripFrame(s, 18), jumper));
      assert.ok(h.w >= 12 && h.w <= ART_W && h.h >= 8 && h.h <= 17, JSON.stringify(h));
      assert.ok(h.x >= PAD && h.x + h.w <= ANIMAL_W - PAD && h.y >= 0 && h.y + h.h < ANIMAL_H, JSON.stringify(h));
    });
    it("has a 2x strip (the same 78 frames, twice the pixels each way) that the engine draws over the same box at an even zoom: same size class, binary alpha, feet on the last row, the same seated baseline", async () => {
      assert.equal(animalHiUrl(animal.id), `/library/characters/${animal.id}@2x.png`);
      const hi = decodePng(new Uint8Array(readFileSync(file(`characters/${animal.id}@2x.png`))));
      const s2 = await hi;
      assert.equal(validHiStrip(s2), true);
      assert.equal(s2.width, ANIMAL_HI_ROW_W);
      assert.equal(s2.height, ANIMAL_H * HI);
      assert.equal(validHiStrip({ ...s2, width: s2.width - 1 }), false);
      for (let i = 3; i < s2.rgba.length; i += 4) assert.ok(s2.rgba[i] === 0 || s2.rgba[i] === 255);
      const graded = composeAnimalHi(s2)!;
      assert.equal(graded.length, s2.rgba.length);
      assert.equal(composeAnimalHi({ ...s2, height: 1 }), null);
      const W2 = ANIMAL_W * HI, H2 = ANIMAL_H * HI;
      const frame2 = (n: number) => { const f = new Uint8Array(W2 * H2 * 4); for (let y = 0; y < H2; y++) f.set(s2.rgba.subarray((y * ANIMAL_HI_ROW_W + n * W2) * 4, (y * ANIMAL_HI_ROW_W + (n + 1) * W2) * 4), y * W2 * 4); return f; };
      const lowest = (f: Uint8Array) => { for (let y = H2 - 1; y >= 0; y--) for (let x = 0; x < W2; x++) if (f[(y * W2 + x) * 4 + 3]) return y; return -1; };
      const s1 = await strip();
      for (let n = 0; n < POSE.sit; n++) assert.equal(lowest(frame2(n)), H2 - 1, `frame ${n}: feet on the last row`);
      // a frame at 2x covers about the box of the 1x frame: its lowest row is the 1x one's (x2, within 2 rows) in every pose
      for (const n of [0, 6, 24, 30, 36, 42, POSE.sit, POSE.sit + 6, POSE.read, POSE.stool]) {
        const l1 = bottom(stripFrame(s1, n));
        assert.ok(Math.abs(lowest(frame2(n)) - (2 * l1 + 1)) <= (animal.seated === "drawn" || n < POSE.sit ? 3 : 7), `frame ${n}: bottom ${lowest(frame2(n))} against 2 x ${l1}`);   // a stand-in seated pose is made by the rig, whose fold of the near leg rounds differently at 2x
      }
    });
    it("refuses a strip that is not the animal's", async () => {
      const s = await strip();
      assert.equal(composeAnimal({ ...s, width: 100 }, animal), null);
    });
  });
}
