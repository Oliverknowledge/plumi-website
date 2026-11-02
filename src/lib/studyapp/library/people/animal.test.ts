/**
 * npm run library:test
 *
 * Every animal (animals.ts): its art (the invariants tools/art/check_animals.py asserts, run from here when Python is there), the
 * 78 frames the engine reads (count, order, frame size, feet, anchors), and the poses derived from the walk (idle, seated).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ANIMAL_H, ANIMAL_ROW_W, ANIMAL_W, ART_W, PAD, SIT_BACK, SIT_DROP, STRIP_DIRS, breathe, composeAnimal, idleFrames, jumperOf, lowered, sitFrames, standingStep, stripFrame, torsoX,
  validStrip,
} from "./animal";
import { ANIMALS, animalUrl, type Animal } from "./animals";
import { decodePng, type Bitmap } from "./png";
import { FRAMES, POSE } from "./sheet";

const file = (p: string) => new URL(`../../../../../public/library/${p}`, import.meta.url);
interface Meta { id: string; frame: [number, number]; frames: number; order: string[]; palette: string[]; jumper: string[]; anchor: { x: number; feetRow: number } }
const metaOf = (a: Animal) => JSON.parse(readFileSync(file(`characters/${a.id}.json`), "utf8")) as Meta;
const stripOf = async (a: Animal): Promise<Bitmap> => decodePng(new Uint8Array(readFileSync(file(`characters/${a.id}.png`))));
const frameAt = (rgba: Uint8ClampedArray, index: number, w = ANIMAL_W) => {
  const f = new Uint8Array(w * ANIMAL_H * 4);
  for (let y = 0; y < ANIMAL_H; y++) f.set(rgba.subarray((y * ANIMAL_ROW_W + index * w) * 4, (y * ANIMAL_ROW_W + (index + 1) * w) * 4), y * w * 4);
  return f;
};
const rows = (f: Uint8Array, w: number) => { const ys: number[] = []; for (let y = 0; y < ANIMAL_H; y++) for (let x = 0; x < w; x++) if (f[(y * w + x) * 4 + 3] > 0) { ys.push(y); break; } return ys; };
const cols = (f: Uint8Array, w: number) => { const xs: number[] = []; for (let x = 0; x < w; x++) for (let y = 0; y < ANIMAL_H; y++) if (f[(y * w + x) * 4 + 3] > 0) { xs.push(x); break; } return xs; };
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

describe("the animals, as a set", () => {
  it("are nine, in the order the wardrobe shows them, each with art, a strip file and an id the server can take in `body`", () => {
    assert.deepEqual(ANIMALS.map((a) => a.id), ["fox", "capybara", "axolotl", "redpanda", "badger", "hedgehog", "raccoon", "triceratops", "dragon"]);
    for (const a of ANIMALS) {
      assert.match(a.id, /^[a-z]{3,12}$/, `${a.id}: lower case letters, 3 to 12 (what 0126's set_avatar can be asked to take in body)`);
      assert.match(a.id, /^[a-z0-9_-]{1,24}$/, `${a.id}: and what every earlier set_avatar took`);
      assert.equal(animalUrl(a.id), `/library/characters/${a.id}.png`);
      assert.ok(a.title.length > 0 && !/[\u2013\u2014]/.test(a.title), `${a.id}: a title with no dash`);
      assert.ok(a.jumper.length >= 1 && a.jumper.every((h) => /^#[0-9a-f]{6}$/.test(h)));
    }
    assert.equal(new Set(ANIMALS.map((a) => a.id)).size, ANIMALS.length);
  });
  it("pass the checker the tool ships (24 frames, one size, feet on one row, binary alpha, a palette, no magenta, a 1 px outline, no stray pieces)", (t) => {
    const r = spawnSync("python3", ["-I", new URL("../../../../../tools/art/check_animals.py", import.meta.url).pathname], { encoding: "utf8" });
    if (r.error) { t.skip("python3 is not here"); return; }
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^ok: 9 animals, 24 frames each/);
  });
  it("keep every animal's strips small and out of the first load: nine strips under 200 KB in all", () => {
    let total = 0;
    for (const a of ANIMALS) total += readFileSync(file(`characters/${a.id}.png`)).length;
    assert.ok(total < 200_000, `${total} bytes`);
  });
});

for (const animal of ANIMALS) {
const meta = metaOf(animal);
const strip = () => stripOf(animal);
const jumper = jumperOf(animal.jumper);
describe(`the ${animal.id}'s art`, () => {
  it("is the strip its json says: 24 frames of 24 x 32, down, left, up, right, six steps each", async () => {
    const s = await strip();
    assert.equal(meta.id, animal.id);
    assert.deepEqual(meta.frame, [ART_W, ANIMAL_H]);
    assert.equal(meta.frames, 24);
    assert.equal(meta.order.length, 24);
    assert.deepEqual(meta.order.filter((_, i) => i % 6 === 0), STRIP_DIRS.map((d) => `${d}:0`));
    assert.equal(validStrip(s), true);
    assert.equal(validStrip({ ...s, width: s.width - 1 }), false);
    assert.ok(meta.palette.length <= 24);
    assert.deepEqual(meta.jumper, [...animal.jumper], "animals.json and the strip's json agree on the jumper");
    for (const h of animal.jumper) assert.ok(meta.palette.includes(h), `${h} is a colour of the strip`);
    for (let i = 3; i < s.rgba.length; i += 4) assert.ok(s.rgba[i] === 0 || s.rgba[i] === 255);
  });
  it("faces the way its row says: the left row's eyes are on the left of its head, the right row's on the right", async () => {
    const s = await strip();
    const side = (d: number) => {
      let sum = 0, n = 0;
      for (let step = 0; step < 6; step++) {
        const f = stripFrame(s, d, step);
        let neck = ANIMAL_H;
        for (let y = 0; y < ANIMAL_H && neck === ANIMAL_H; y++) for (let x = 0; x < ART_W; x++) if (isJ(f, x, y)) { neck = y; break; }
        let lo = ART_W, hi = -1;
        for (let y = 0; y < neck; y++) for (let x = 0; x < ART_W; x++) if (f[(y * ART_W + x) * 4 + 3]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
        // an eye: an inside pixel (all four neighbours drawn) that is very dark
        for (let y = 2; y < neck; y++) for (let x = 1; x < ART_W - 1; x++) {
          const i = (y * ART_W + x) * 4;
          if (!f[i + 3] || f[i] + f[i + 1] + f[i + 2] > 150) continue;
          if ([[0, -1], [0, 1], [-1, 0], [1, 0]].every(([dx, dy]) => f[((y + dy) * ART_W + x + dx) * 4 + 3])) { sum += x - (lo + hi) / 2; n++; }
        }
      }
      return n ? sum / n : NaN;
    };
    const isJ = (f: Uint8Array, x: number, y: number) => { const i = (y * ART_W + x) * 4; return f[i + 3] > 0 && jumper.has((f[i] << 16) | (f[i + 1] << 8) | f[i + 2]); };
    assert.ok(side(1) < 0, `left: the eyes are left of the head's middle (${side(1)})`);
    assert.ok(side(3) > 0, `right: the eyes are right of the head's middle (${side(3)})`);
  });
});

describe(`the ${animal.id}'s 78 frames`, () => {
  it("is 78 frames of ANIMAL_W x 32 in the engine's order, the walk used as it is drawn", async () => {
    const s = await strip();
    const row = composeAnimal(s, animal, { graded: false })!;
    assert.ok(row);
    assert.equal(FRAMES, 78);
    assert.equal(row.rgba.length, FRAMES * ANIMAL_W * ANIMAL_H * 4);
    assert.equal(ANIMAL_ROW_W, 78 * ANIMAL_W);
    assert.equal(ANIMAL_W, ART_W + 2 * PAD);
    // walk frames 24..47 are the strip's: engine order right, back, left, front = strip 3, 2, 1, 0
    [3, 2, 1, 0].forEach((strip_d, k) => {
      for (let i = 0; i < 6; i++) {
        const got = frameAt(row.rgba, POSE.walk + k * 6 + i), want = stripFrame(s, strip_d, i);
        for (let y = 0; y < ANIMAL_H; y++) for (let x = 0; x < ART_W; x++) {
          const a = (y * ANIMAL_W + x + PAD) * 4, b = (y * ART_W + x) * 4;
          assert.deepEqual([...got.subarray(a, a + 4)], [...want.subarray(b, b + 4)], `walk ${STRIP_DIRS[strip_d]} ${i} at ${x},${y}`);
        }
      }
    });
  });
  it("keeps the feet on the bottom row in every walk and idle frame, the body inside the frame and about where the feet are", async () => {
    const row = composeAnimal(await strip(), animal, { graded: false })!;
    for (const base of [POSE.idle, POSE.walk]) {
      for (let i = 0; i < 24; i++) {
        const f = frameAt(row.rgba, base + i), r = rows(f, ANIMAL_W), c = cols(f, ANIMAL_W);
        assert.equal(r[r.length - 1], ANIMAL_H - 1, `frame ${base + i}: feet on the last row`);
        assert.ok(c[0] >= PAD - 1 && c[c.length - 1] <= ANIMAL_W - PAD, `frame ${base + i}: inside the art's columns (${c[0]}..${c[c.length - 1]})`);
        const cx = c.reduce((s, x) => s + x, 0) / c.length;
        assert.ok(Math.abs(cx - ANIMAL_W / 2) < 4.5, `frame ${base + i}: centred (${cx})`);
      }
    }
  });
  it("has an idle of six frames per direction that stand on the same feet (it breathes, and swishes a tail where it has one)", async () => {
    const row = composeAnimal(await strip(), animal, { graded: false })!;
    for (let d = 0; d < 4; d++) {
      const fr = Array.from({ length: 6 }, (_, i) => frameAt(row.rgba, POSE.idle + d * 6 + i));
      assert.equal(new Set(fr.map((f) => f.join(","))).size >= 2, true, `direction ${d} animates`);
      // the feet (the bottom five rows, under the torso: the tail may swish beside them) do not move
      let sum = 0, n = 0;                                       // the torso's centre in the padded frame (the jumper's colours)
      for (let y = 0; y < ANIMAL_H; y++) for (let x = 0; x < ANIMAL_W; x++) { const i = (y * ANIMAL_W + x) * 4; if (fr[0][i + 3] && jumper.has((fr[0][i] << 16) | (fr[0][i + 1] << 8) | fr[0][i + 2])) { sum += x; n++; } }
      const cx = n ? Math.round(sum / n) : ANIMAL_W / 2;
      const feet = (f: Uint8Array) => { const o: number[] = []; for (let y = ANIMAL_H - 5; y < ANIMAL_H; y++) for (let x = cx - 3; x < cx + 3; x++) o.push(...f.subarray((y * ANIMAL_W + x) * 4, (y * ANIMAL_W + x + 1) * 4)); return o; };
      for (const f of fr.slice(1)) assert.deepEqual(feet(f), feet(fr[0]), `direction ${d}: the feet stay`);
    }
  });
  it("has the seated frames (right, then left; phone, read and stool facing the camera) lowered, inside the frame, and sitting back from the desk", async () => {
    const s = await strip();
    const row = composeAnimal(s, animal, { graded: false })!;
    const right = frameAt(row.rgba, POSE.sit), left = frameAt(row.rgba, POSE.sit + 6);
    const idleRight = frameAt(row.rgba, POSE.idle), idleLeft = frameAt(row.rgba, POSE.idle + 12);
    const mean = (f: Uint8Array) => { const c = cols(f, ANIMAL_W); return c.reduce((a, x) => a + x, 0) / c.length; };
    assert.ok(mean(right) < mean(idleRight) - 1, "facing right it sits back to the left");
    assert.ok(mean(left) > mean(idleLeft) + 1, "facing left it sits back to the right");
    assert.equal(SIT_BACK >= 3, true);
    for (let i = POSE.sit; i < POSE.stool + 6; i++) {
      const f = frameAt(row.rgba, i), r = rows(f, ANIMAL_W), c = cols(f, ANIMAL_W);
      assert.ok(r.length > 10, `frame ${i} has an animal in it`);
      assert.ok(c[0] >= 0 && c[c.length - 1] < ANIMAL_W);
    }
    const top = (f: Uint8Array) => rows(f, ANIMAL_W)[0];
    assert.equal(top(right) - top(idleRight), SIT_DROP, "lowered by SIT_DROP");
    // the stool frames are cut to the top 20 rows as a person's are: nothing below row 19
    for (let i = POSE.stool; i < POSE.stool + 6; i++) { const r = rows(frameAt(row.rgba, i), ANIMAL_W); assert.ok(r[r.length - 1] <= 19); }
  });
  it("finds the head from the art: the ears down to the jumper, inside the frame (for a friends list or a card)", async () => {
    const s = await strip();
    const row = composeAnimal(s, animal)!;
    const h = row.head;
    assert.ok(h.w >= 12 && h.w <= ART_W && h.h >= 8 && h.h <= 17, JSON.stringify(h));
    assert.ok(h.x >= PAD && h.x + h.w <= ANIMAL_W - PAD && h.y >= 0 && h.y + h.h < ANIMAL_H, JSON.stringify(h));
  });
  it("refuses a strip that is not the animal's", async () => {
    const s = await strip();
    assert.equal(composeAnimal({ ...s, width: 100 }, animal), null);
  });
  it("grades the room's animal like its people and leaves the wardrobe's alone", async () => {
    const s = await strip();
    const a = composeAnimal(s, animal)!.rgba, b = composeAnimal(s, animal, { graded: false })!.rgba;
    assert.notDeepEqual([...a], [...b]);
    for (let i = 3; i < a.length; i += 4) assert.equal(a[i], b[i], "alpha is not graded");
  });
});
}

describe("the pose helpers", () => {
  const fox = ANIMALS[0];
  const j = jumperOf(fox.jumper);
  it("picks the frame with the feet together (the narrowest bottom rows)", async () => {
    const s = await stripOf(fox);
    for (let d = 0; d < 4; d++) {
      const frames = Array.from({ length: 6 }, (_, i) => stripFrame(s, d, i));
      const best = standingStep(frames);
      const width = (f: Uint8Array) => { const xs: number[] = []; for (let y = ANIMAL_H - 8; y < ANIMAL_H; y++) for (let x = 0; x < ART_W; x++) if (f[(y * ART_W + x) * 4 + 3]) xs.push(x); return Math.max(...xs) - Math.min(...xs); };
      for (const f of frames) assert.ok(width(frames[best]) <= width(f));
    }
  });
  it("breathes without moving the feet, lowers by whole rows, and finds the torso", async () => {
    const s = await stripOf(fox);
    const f = stripFrame(s, 0, 1);
    const up = breathe(f, 1, 27);
    assert.ok(same(up.subarray(27 * ART_W * 4), f.subarray(27 * ART_W * 4)), "below the seam is untouched");
    assert.ok(same(breathe(f, 0, 27), f));
    const dn = lowered(f, 2);
    assert.ok(same(dn.subarray(2 * ART_W * 4), f.subarray(0, (ANIMAL_H - 2) * ART_W * 4)));
    assert.ok(Math.abs(torsoX(f, j) - ART_W / 2) < 3);
    assert.equal(idleFrames(f, 0, j, fox.tail).length, 6);
    assert.equal(sitFrames(f).length, 6);
  });
  it("swishes only where a tail is named: with none it breathes and nothing else moves", async () => {
    const s = await stripOf(fox);
    const f = stripFrame(s, 1, 1);
    const none = { down: null, left: null, up: null, right: null } as const;
    const still = idleFrames(f, 1, j, none), swish = idleFrames(f, 1, j, { ...none, left: 5 });
    assert.equal(still.length, 6);
    // frames 1 and 4 of the swish differ from the still ones (the tail moved a row); frame 0 does not (no swish yet, no breath)
    assert.ok(same(still[0], swish[0]));
    assert.ok(!same(still[1], swish[1]));
  });
});
