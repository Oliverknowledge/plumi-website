/**
 * npm run library:test
 *
 * The fox: its art (the invariants tools/art/check_fox.py asserts, run from here when Python is there), the 78 frames the
 * engine reads (count, order, frame size, feet, anchors), and the poses derived from the walk (idle, seated).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ART_W, FOX_H, FOX_ROW_W, FOX_W, PAD, SIT_BACK, SIT_DROP, STRIP_DIRS, breathe, composeFox, idleFrames, lowered, sitFrames, standingStep, stripFrame, torsoX, validStrip,
} from "./fox";
import { decodePng, type Bitmap } from "./png";
import { FRAMES, POSE } from "./sheet";

const file = (p: string) => new URL(`../../../../../public/library/${p}`, import.meta.url);
const meta = JSON.parse(readFileSync(file("characters/fox.json"), "utf8")) as { frame: [number, number]; frames: number; order: string[]; palette: string[]; anchor: { x: number; feetRow: number } };

async function strip(): Promise<Bitmap> { return decodePng(new Uint8Array(readFileSync(file("characters/fox.png")))); }
const frameAt = (rgba: Uint8ClampedArray, index: number, w = FOX_W) => {
  const f = new Uint8Array(w * FOX_H * 4);
  for (let y = 0; y < FOX_H; y++) f.set(rgba.subarray((y * FOX_ROW_W + index * w) * 4, (y * FOX_ROW_W + (index + 1) * w) * 4), y * w * 4);
  return f;
};
const rows = (f: Uint8Array, w: number) => { const ys: number[] = []; for (let y = 0; y < FOX_H; y++) for (let x = 0; x < w; x++) if (f[(y * w + x) * 4 + 3] > 0) { ys.push(y); break; } return ys; };
const cols = (f: Uint8Array, w: number) => { const xs: number[] = []; for (let x = 0; x < w; x++) for (let y = 0; y < FOX_H; y++) if (f[(y * w + x) * 4 + 3] > 0) { xs.push(x); break; } return xs; };
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

describe("the fox's art", () => {
  it("passes the checker the tool ships (24 frames, one size, feet on one row, binary alpha, at most 16 colours, no magenta, 1 px outline)", (t) => {
    const r = spawnSync("python3", ["-I", new URL("../../../../../tools/art/check_fox.py", import.meta.url).pathname], { encoding: "utf8" });
    if (r.error) { t.skip("python3 is not here"); return; }
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^ok: 24 frames/);
  });
  it("is the strip fox.json says: 24 frames of 24 x 32, down, left, up, right, six steps each", async () => {
    const s = await strip();
    assert.deepEqual(meta.frame, [ART_W, FOX_H]);
    assert.equal(meta.frames, 24);
    assert.equal(meta.order.length, 24);
    assert.deepEqual(meta.order.filter((_, i) => i % 6 === 0), STRIP_DIRS.map((d) => `${d}:0`));
    assert.equal(validStrip(s), true);
    assert.equal(validStrip({ ...s, width: s.width - 1 }), false);
    assert.ok(meta.palette.length <= 16);
    for (let i = 3; i < s.rgba.length; i += 4) assert.ok(s.rgba[i] === 0 || s.rgba[i] === 255);
  });
  it("faces the way its row says: the left row looks left (its face on the left half), the right row right", async () => {
    const s = await strip();
    const faceSide = (d: number) => {
      // the cheek blush is the one pink in the palette: it is on the side the face is
      let sum = 0, n = 0;
      for (let step = 0; step < 6; step++) {
        const f = stripFrame(s, d, step);
        for (let y = 6; y < 26; y++) for (let x = 0; x < ART_W; x++) { const i = (y * ART_W + x) * 4; if (f[i + 3] && f[i] > 240 && f[i + 1] > 150 && f[i + 1] < 190 && f[i + 2] < 175) { sum += x; n++; } }
      }
      return n ? sum / n : NaN;                              // the cheek blush
    };
    assert.ok(faceSide(1) < ART_W / 2, "left: the blush is on the left");
    assert.ok(faceSide(3) > ART_W / 2, "right: the blush is on the right");
  });
});

describe("the fox's 78 frames", () => {
  it("is 78 frames of FOX_W x 32 in the engine's order, the walk used as it is drawn", async () => {
    const s = await strip();
    const fox = composeFox(s, { graded: false })!;
    assert.ok(fox);
    assert.equal(FRAMES, 78);
    assert.equal(fox.rgba.length, FRAMES * FOX_W * FOX_H * 4);
    assert.equal(FOX_ROW_W, 78 * FOX_W);
    assert.equal(FOX_W, ART_W + 2 * PAD);
    // walk frames 24..47 are the strip's: engine order right, back, left, front = strip 3, 2, 1, 0
    [3, 2, 1, 0].forEach((strip_d, k) => {
      for (let i = 0; i < 6; i++) {
        const got = frameAt(fox.rgba, POSE.walk + k * 6 + i), want = stripFrame(s, strip_d, i);
        for (let y = 0; y < FOX_H; y++) for (let x = 0; x < ART_W; x++) {
          const a = (y * FOX_W + x + PAD) * 4, b = (y * ART_W + x) * 4;
          assert.deepEqual([...got.subarray(a, a + 4)], [...want.subarray(b, b + 4)], `walk ${STRIP_DIRS[strip_d]} ${i} at ${x},${y}`);
        }
      }
    });
  });
  it("keeps the feet on the bottom row in every walk and idle frame, and the body inside the frame", async () => {
    const fox = composeFox(await strip(), { graded: false })!;
    for (const base of [POSE.idle, POSE.walk]) {
      for (let i = 0; i < 24; i++) {
        const f = frameAt(fox.rgba, base + i), r = rows(f, FOX_W), c = cols(f, FOX_W);
        assert.equal(r[r.length - 1], FOX_H - 1, `frame ${base + i}: feet on the last row`);
        assert.ok(c[0] >= PAD - 1 && c[c.length - 1] <= FOX_W - PAD, `frame ${base + i}: inside the art's columns (${c[0]}..${c[c.length - 1]})`);
        const cx = c.reduce((s, x) => s + x, 0) / c.length;
        assert.ok(Math.abs(cx - FOX_W / 2) < 3.5, `frame ${base + i}: centred (${cx})`);
      }
    }
  });
  it("has an idle of six frames per direction that differ from each other a little and stand on the same feet", async () => {
    const fox = composeFox(await strip(), { graded: false })!;
    for (let d = 0; d < 4; d++) {
      const fr = Array.from({ length: 6 }, (_, i) => frameAt(fox.rgba, POSE.idle + d * 6 + i));
      assert.equal(new Set(fr.map((f) => f.join(","))).size >= 2, true, `direction ${d} animates`);
      // the feet (the bottom five rows, under the torso: the tail may swish beside them) do not move
      let sum = 0, n = 0;                                       // the torso's centre in the padded frame (the sweater's maroon)
      for (let y = 0; y < FOX_H; y++) for (let x = 0; x < FOX_W; x++) { const i = (y * FOX_W + x) * 4; if (fr[0][i + 3] && fr[0][i + 1] < 100 && fr[0][i] > fr[0][i + 1] + 40 && fr[0][i] < 200) { sum += x; n++; } }
      const cx = Math.round(sum / n);
      const feet = (f: Uint8Array) => { const o: number[] = []; for (let y = FOX_H - 5; y < FOX_H; y++) for (let x = cx - 3; x < cx + 3; x++) o.push(...f.subarray((y * FOX_W + x) * 4, (y * FOX_W + x + 1) * 4)); return o; };
      for (const f of fr.slice(1)) assert.deepEqual(feet(f), feet(fr[0]), `direction ${d}: the feet stay`);
    }
  });
  it("has the seated frames (right, then left; phone, read and stool facing the camera) lowered, inside the frame, and sitting back from the desk", async () => {
    const s = await strip();
    const fox = composeFox(s, { graded: false })!;
    const right = frameAt(fox.rgba, POSE.sit), left = frameAt(fox.rgba, POSE.sit + 6);
    const idleRight = frameAt(fox.rgba, POSE.idle), idleLeft = frameAt(fox.rgba, POSE.idle + 12);
    const mean = (f: Uint8Array) => { const c = cols(f, FOX_W); return c.reduce((a, x) => a + x, 0) / c.length; };
    assert.ok(mean(right) < mean(idleRight) - 1, "facing right it sits back to the left");
    assert.ok(mean(left) > mean(idleLeft) + 1, "facing left it sits back to the right");
    assert.equal(SIT_BACK >= 3, true);
    for (let i = POSE.sit; i < POSE.stool + 6; i++) {
      const f = frameAt(fox.rgba, i), r = rows(f, FOX_W), c = cols(f, FOX_W);
      assert.ok(r.length > 10, `frame ${i} has a fox in it`);
      assert.ok(c[0] >= 0 && c[c.length - 1] < FOX_W);
    }
    const top = (f: Uint8Array) => rows(f, FOX_W)[0];
    assert.equal(top(right) - top(idleRight), SIT_DROP, "lowered by SIT_DROP");
    // the stool frames are cut to the top 20 rows as a person's are: nothing below row 19
    for (let i = POSE.stool; i < POSE.stool + 6; i++) { const r = rows(frameAt(fox.rgba, i), FOX_W); assert.ok(r[r.length - 1] <= 19); }
  });
  it("finds the head from the art: the ears down to the sweater, inside the frame (for a friends list or a card)", async () => {
    const s = await strip();
    const fox = composeFox(s)!;
    const h = fox.head;
    assert.ok(h.w >= 14 && h.w <= ART_W && h.h >= 8 && h.h <= 16, JSON.stringify(h));
    assert.ok(h.x >= PAD && h.x + h.w <= FOX_W - PAD && h.y >= 0 && h.y + h.h < FOX_H);
    const front = frameAt(fox.rgba, POSE.idle + 18, FOX_W);
    // the box holds the face: its rows have the dark eyes
    let dark = 0;
    for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) { const i = (y * FOX_W + x) * 4; if (front[i + 3] && front[i] < 90 && front[i + 1] < 70) dark++; }
    assert.ok(dark >= 2, "the eyes are in the box");
  });
  it("refuses a strip that is not the fox's", async () => {
    const s = await strip();
    assert.equal(composeFox({ ...s, width: 100 }), null);
  });
  it("grades the room's fox like its people and leaves the wardrobe's alone", async () => {
    const s = await strip();
    const a = composeFox(s)!.rgba, b = composeFox(s, { graded: false })!.rgba;
    assert.notDeepEqual([...a], [...b]);
    for (let i = 3; i < a.length; i += 4) assert.equal(a[i], b[i], "alpha is not graded");
  });
});

describe("the pose helpers", () => {
  it("picks the frame with the feet together (the narrowest bottom rows)", async () => {
    const s = await strip();
    for (let d = 0; d < 4; d++) {
      const frames = Array.from({ length: 6 }, (_, i) => stripFrame(s, d, i));
      const best = standingStep(frames);
      const width = (f: Uint8Array) => { const xs: number[] = []; for (let y = FOX_H - 8; y < FOX_H; y++) for (let x = 0; x < ART_W; x++) if (f[(y * ART_W + x) * 4 + 3]) xs.push(x); return Math.max(...xs) - Math.min(...xs); };
      for (const f of frames) assert.ok(width(frames[best]) <= width(f));
    }
  });
  it("breathes without moving the feet, lowers by whole rows, and finds the torso", async () => {
    const s = await strip();
    const f = stripFrame(s, 0, 1);
    const up = breathe(f, 1, 27);
    assert.ok(same(up.subarray(27 * ART_W * 4), f.subarray(27 * ART_W * 4)), "below the seam is untouched");
    assert.ok(same(breathe(f, 0, 27), f));
    const dn = lowered(f, 2);
    assert.ok(same(dn.subarray(2 * ART_W * 4), f.subarray(0, (FOX_H - 2) * ART_W * 4)));
    assert.ok(Math.abs(torsoX(f) - ART_W / 2) < 3);
    assert.equal(idleFrames(f, 0).length, 6);
    assert.equal(sitFrames(f).length, 6);
  });
});
