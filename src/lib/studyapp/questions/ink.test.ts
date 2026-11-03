import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  cleanInk, cleanStroke, decodeStroke, encodeStroke, inkBottom, inkBytes, NO_HISTORY, outlinePath, pushHistory, redo, simplify, strokePath, strokesAt, touches, undo,
  type Ink, type Pt,
} from "./ink";

const line = (n: number, y = 10): Pt[] => Array.from({ length: n }, (_, i) => ({ x: 10 + i * 2, y, p: 0.5 }));
const wave = (n: number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: 20 + i * 1.5, y: 40 + 12 * Math.sin(i / 6), p: 0.3 + 0.4 * Math.abs(Math.sin(i / 20)) }));

describe("simplify", () => {
  test("a straight line collapses to its ends", () => {
    const s = simplify(line(200));
    assert.equal(s.length, 2);
    assert.deepEqual(s[0], { x: 10, y: 10, p: 0.5 });
    assert.equal(s[1].x, 10 + 199 * 2);
  });
  test("a curve keeps its shape within the tolerance", () => {
    const pts = wave(300);
    const s = simplify(pts, 0.45);
    assert.ok(s.length < pts.length / 3, `kept ${s.length} of ${pts.length}`);
    // every original point is within tolerance of the simplified polyline (x,y only)
    for (const p of pts) {
      let best = Infinity;
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1], b = s[i];
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
        best = Math.min(best, Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y));
      }
      assert.ok(best <= 0.46, `point strays ${best}`);
    }
  });
  test("one or two points are left alone, and a huge stroke does not overflow the stack", () => {
    assert.equal(simplify([{ x: 1, y: 1, p: 1 }]).length, 1);
    assert.equal(simplify(wave(50_000)).length > 2, true);
  });
});

describe("encode and decode", () => {
  test("round trip stays within a tenth of a unit and a hundredth of pressure", () => {
    const pts = wave(120);
    const s = encodeStroke(pts, 1, 2, false);
    const back = decodeStroke(s);
    assert.ok(back.length <= pts.length);
    assert.equal(back[0].x, Math.round(pts[0].x * 10) / 10);
    assert.equal(back[back.length - 1].x, Math.round(pts[pts.length - 1].x * 10) / 10);
    assert.equal(s.c, 1);
    assert.equal(s.w, 2);
    assert.equal(s.sp, undefined);
  });
  test("deltas rebuild the same points after a JSON trip", () => {
    const s = encodeStroke(wave(80), 0, 1, true);
    const copy = JSON.parse(JSON.stringify(s));
    assert.deepEqual(decodeStroke(copy), decodeStroke(s));
    assert.equal(copy.sp, 1);
  });
  test("a single tap is a stroke of one point and still draws", () => {
    const s = encodeStroke([{ x: 50, y: 60, p: 0.5 }], 0, 1, true);
    assert.equal(s.d.length, 3);
    assert.ok(strokePath(s).startsWith("M"));
  });
  test("colour and width are clamped to what exists", () => {
    const s = encodeStroke(line(3), 9, -4, false);
    assert.equal(s.c, 2);
    assert.equal(s.w, 0);
  });
  test("a page of handwriting is small", () => {
    const strokes: Ink = Array.from({ length: 300 }, (_, i) => encodeStroke(wave(60).map((p) => ({ ...p, x: p.x + (i % 20) * 30, y: p.y + Math.floor(i / 20) * 14 })), 0, 1, false));
    assert.ok(inkBytes(strokes) < 100_000, `bytes ${inkBytes(strokes)}`);
  });
});

describe("what comes back from storage is cleaned", () => {
  test("bad strokes are dropped, odd ones tidied", () => {
    assert.equal(cleanStroke(null), null);
    assert.equal(cleanStroke({ d: [1, 2] }), null);
    assert.equal(cleanStroke({ d: [1, 2, "x"] }), null);
    assert.equal(cleanStroke({ d: [1, 2, NaN] }), null);
    assert.deepEqual(cleanStroke({ c: 99, w: -3, d: [1, 2, 3], sp: 1 }), { c: 2, w: 0, d: [1, 2, 3], sp: 1 });
    assert.equal(cleanInk("nope").length, 0);
    assert.equal(cleanInk([{ d: [0, 0, 50] }, 3, { d: [] }]).length, 1);
    assert.equal(cleanInk(Array.from({ length: 5000 }, () => ({ d: [0, 0, 50] }))).length, 4000);
  });
});

describe("eraser", () => {
  const ink: Ink = [encodeStroke(line(40, 100), 0, 1, false), encodeStroke(line(40, 200), 0, 1, false)];
  test("finds the stroke under it, not the one beside it", () => {
    assert.deepEqual(strokesAt(ink, 30, 102), [0]);
    assert.deepEqual(strokesAt(ink, 30, 198), [1]);
    assert.deepEqual(strokesAt(ink, 30, 150), []);
    assert.deepEqual(strokesAt(ink, 400, 100), []);
  });
  test("a scrub across both takes both", () => {
    const hit = new Set([...strokesAt(ink, 30, 100), ...strokesAt(ink, 30, 200)]);
    assert.deepEqual([...hit].sort(), [0, 1]);
  });
  test("touches reaches a dot", () => {
    const dot = encodeStroke([{ x: 50, y: 50, p: 0.5 }], 0, 1, true);
    assert.equal(touches(dot, 52, 52), true);
    assert.equal(touches(dot, 90, 90), false);
  });
  test("inkBottom is the lowest edge", () => {
    assert.ok(inkBottom(ink) >= 200 && inkBottom(ink) < 210);
    assert.equal(inkBottom([]), 0);
  });
});

describe("undo and redo", () => {
  const a: Ink = [];
  const b: Ink = [encodeStroke(line(5), 0, 0, false)];
  const c: Ink = [...b, encodeStroke(line(5, 30), 0, 0, false)];
  test("each action is one step, and a new action clears redo", () => {
    let h = pushHistory(NO_HISTORY, a);       // drew b
    h = pushHistory(h, b);                    // drew c
    const u1 = undo(h, c)!;
    assert.equal(u1.ink, b);
    const u2 = undo(u1.h, u1.ink)!;
    assert.equal(u2.ink, a);
    assert.equal(undo(u2.h, u2.ink), null);
    const r1 = redo(u2.h, u2.ink)!;
    assert.equal(r1.ink, b);
    const r2 = redo(r1.h, r1.ink)!;
    assert.equal(r2.ink, c);
    assert.equal(redo(r2.h, r2.ink), null);
    const fresh = pushHistory(u1.h, u1.ink);
    assert.equal(fresh.future.length, 0);
  });
  test("history is bounded", () => {
    let h = NO_HISTORY;
    for (let i = 0; i < 500; i++) h = pushHistory(h, a);
    assert.equal(h.past.length, 120);
  });
});

describe("outline", () => {
  test("a stroke has a closed SVG path, and nothing for no points", () => {
    const d = outlinePath(wave(30), 3.4, false);
    assert.match(d, /^M [\d.-]+ [\d.-]+ Q/);
    assert.ok(d.endsWith("Z"));
    assert.equal(outlinePath([], 3, false), "");
  });
});
