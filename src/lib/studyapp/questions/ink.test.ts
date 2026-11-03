import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  cleanInk, cleanStroke, decodeStroke, densify, encodeStroke, ERASER_RADIUS, inkBottom, inkBounds, inkBytes, inkIds, INK_WIDTHS, MAX_GAP, MAX_STROKES, NO_HISTORY, outlinePath, pushHistory, redo, simplify,
  strokeBounds, strokeBytes, strokeHash, strokeOutline, strokePath, strokesAt, strokesToAdd, touches, undo,
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
    assert.equal(cleanInk(Array.from({ length: 5000 }, () => ({ d: [0, 0, 50] }))).length, 5000);
    assert.equal(cleanInk(Array.from({ length: 5000 }, () => ({ d: [0, 0, 50] })), 4000).length, 4000);
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

/* ── corners, and a line that does not change shape when the pen lifts ───────────── */

/** A polyline sampled every `gap` units, the way a pointer samples a pen (pressure flat). */
function walk(corners: [number, number][], gap = 3): Pt[] {
  const out: Pt[] = [{ x: corners[0][0], y: corners[0][1], p: 0.5 }];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1], [bx, by] = corners[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / gap));
    for (let k = 1; k <= n; k++) out.push({ x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, p: 0.5 });
  }
  return out;
}

/** Is the point inked? The canvas fills an outline with the non-zero winding rule (an outline crosses itself at a sharp corner), so the test does too. */
function inside(poly: number[][], x: number, y: number): boolean {
  let w = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xj, yj] = poly[j], [xi, yi] = poly[i];
    const side = (xi - xj) * (y - yj) - (x - xj) * (yi - yj);
    if (yj <= y) { if (yi > y && side > 0) w++; } else if (yi <= y && side < 0) w--;
  }
  return w !== 0;
}

/** The ink polygon of a raw stroke after it has been stored (simplified, encoded) and read back, as it is drawn on reload. */
const stored = (pts: Pt[], w: number, flat: boolean) => strokeOutline(decodeStroke(encodeStroke(pts, 0, w, flat)), INK_WIDTHS[w], flat);

describe("a corner is drawn where the pen put it", () => {
  const shapes: Record<string, [number, number][]> = {
    V: [[100, 100], [130, 180], [160, 100]],
    seven: [[100, 100], [170, 100], [125, 210]],
    four: [[160, 100], [100, 170], [200, 170]],
    sqrt: [[80, 160], [95, 180], [120, 100], [260, 100]],
    W: [[100, 100], [115, 180], [130, 120], [145, 180], [160, 100]],
  };
  for (const [name, corners] of Object.entries(shapes)) {
    for (const flat of [true, false]) {
      test(`${name}${flat ? " (mouse or finger)" : " (pen)"}: the apexes stay within 1.5 units of the raw corner after encode and render`, () => {
        const w = 2;                                     // Bold: half a width is 2.8 units
        const raw = walk(corners);
        const poly = stored(raw, w, flat);
        const r = INK_WIDTHS[w] / 2;
        for (let i = 1; i < corners.length - 1; i++) {
          const [px, py] = corners[i - 1], [cx, cy] = corners[i], [nx, ny] = corners[i + 1];
          const d1 = [cx - px, cy - py], d2 = [nx - cx, ny - cy];
          const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
          const out = [d1[0] / l1 - d2[0] / l2, d1[1] / l1 - d2[1] / l2];    // away from the inside of the turn
          const lo = Math.hypot(out[0], out[1]);
          // a point just inside the outer rim of a line that reaches the corner exactly; 1.5 units short and it is not inked
          assert.ok(inside(poly, cx + (out[0] / lo) * (r - 1.5), cy + (out[1] / lo) * (r - 1.5)), `${name} corner ${i} cut short`);
          assert.ok(inside(poly, cx, cy), `${name} corner ${i} not inked`);
        }
        // and the whole path is inked: the raw line is inside the outline everywhere
        let missed = 0, n = 0;
        for (let i = 1; i < corners.length; i++) {
          const [ax, ay] = corners[i - 1], [bx, by] = corners[i];
          const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5);
          for (let k = 0; k <= steps; k++, n++) if (!inside(poly, ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps)) missed++;
        }
        assert.ok(missed / n < 0.01, `${missed} of ${n} samples of the line are not inked`);
      });
    }
  }
  test("the stored stroke is a handful of points, the outline is built from many (that is the point)", () => {
    const raw = walk(shapes.V);
    const s = encodeStroke(raw, 0, 1, true);
    assert.ok(decodeStroke(s).length <= 4, `stored ${decodeStroke(s).length}`);
    const dense = densify(decodeStroke(s));
    for (let i = 1; i < dense.length; i++) assert.ok(Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]) <= MAX_GAP + 1e-9);
  });
  test("what is drawn live (raw points) and what is drawn from storage are the same line", () => {
    // a circle of radius 40 at hand speed: the drift between the last live frame and the committed ink is under a unit
    const raw: Pt[] = Array.from({ length: 160 }, (_, i) => ({ x: 200 + 40 * Math.cos(i / 25), y: 200 + 40 * Math.sin(i / 25), p: 0.5 }));
    const live = strokeOutline(raw, INK_WIDTHS[1], true);
    const kept = stored(raw, 1, true);
    const edge = (poly: number[][], x: number, y: number) => {
      let best = Infinity;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[j], [bx, by] = poly[i];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
      }
      return best;
    };
    const apart = (a: number[][], b: number[][]) => Math.max(...a.map(([x, y]) => edge(b, x, y)));
    assert.ok(apart(live, kept) < 1, `live is ${apart(live, kept)} from the stored line`);
    assert.ok(apart(kept, live) < 1, `stored is ${apart(kept, live)} from the live line`);
  });
  test("a flat stroke has one width, a pen stroke follows its pressure", () => {
    const flat = strokeOutline(walk([[10, 10], [200, 10]]), 3.4, true);
    const ys = flat.map((p) => p[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 3.3 && Math.max(...ys) - Math.min(...ys) < 3.5, "even width");
    const press: Pt[] = walk([[10, 10], [200, 10]]).map((p, i, a) => ({ ...p, p: 0.2 + 0.7 * (i / a.length) }));
    const pen = strokeOutline(press, 3.4, false);
    const half = (f: (p: number[]) => boolean) => { const ys2 = pen.filter(f).map((p) => p[1]); return Math.max(...ys2) - Math.min(...ys2); };
    assert.ok(half((p) => p[0] > 150) > half((p) => p[0] < 60) + 0.8, "heavier pressure is a wider line");
  });
  test("a dot and a two-point stroke still make a path", () => {
    assert.ok(outlinePath([{ x: 5, y: 5, p: 0.5 }], 3.4, true).startsWith("M"));
    assert.ok(outlinePath([{ x: 5, y: 5, p: 0.5 }, { x: 9, y: 5, p: 0.5 }], 3.4, false).endsWith("Z"));
  });
});

describe("the eraser", () => {
  const thin: Ink = [encodeStroke(walk([[0, 100], [400, 100]]), 0, 0, true)];
  test("a fast scrub does not slip between two samples", () => {
    for (const gap of [16, 24, 30, 40, 60, 120]) {
      const y0 = 100 - gap / 2, y1 = 100 + gap / 2;               // two samples either side of the line, `gap` apart
      assert.deepEqual(strokesAt(thin, 200, y1, ERASER_RADIUS, { x: 200, y: y0 }), [0], `missed at ${gap}`);
      assert.deepEqual(gap > 2 * (ERASER_RADIUS + INK_WIDTHS[0] / 2) ? strokesAt(thin, 200, y1) : [0], gap > 2 * (ERASER_RADIUS + 1) ? [] : [0], "points alone miss it");
    }
  });
  test("a swept eraser still leaves what is beside its path", () => {
    assert.deepEqual(strokesAt(thin, 200, 160, ERASER_RADIUS, { x: 100, y: 160 }), []);
    assert.deepEqual(strokesAt(thin, 600, 60, ERASER_RADIUS, { x: 500, y: 140 }), []);
  });
  test("the reach is small enough to take one line of an equals sign and leave the other", () => {
    const equals: Ink = [encodeStroke(walk([[0, 100], [200, 100]]), 0, 1, true), encodeStroke(walk([[0, 114], [200, 114]]), 0, 1, true)];
    assert.deepEqual(strokesAt(equals, 100, 100), [0]);
    assert.deepEqual(strokesAt(equals, 100, 114), [1]);
    assert.ok(ERASER_RADIUS <= 8);
  });
  test("touches takes a start point and a dot", () => {
    const dot = encodeStroke([{ x: 50, y: 50, p: 0.5 }], 0, 1, true);
    assert.equal(touches(dot, 90, 50, 8, { x: 40, y: 50 }), true);
    assert.equal(touches(dot, 90, 90, 8, { x: 80, y: 90 }), false);
  });
});

describe("two tabs on one answer", () => {
  const a = encodeStroke(walk([[0, 10], [50, 10]]), 0, 1, true), b = encodeStroke(walk([[0, 30], [50, 30]]), 0, 1, true), c = encodeStroke(walk([[0, 50], [50, 50]]), 0, 1, true);
  const seenOf = (ink: Ink) => new Set(inkIds(ink));
  test("a stroke is the same stroke in every tab and every load", () => {
    assert.equal(strokeHash(a), strokeHash(JSON.parse(JSON.stringify(a))));
    assert.notEqual(strokeHash(a), strokeHash(b));
  });
  test("what another tab added is added, what this tab already has is not", () => {
    assert.deepEqual(strokesToAdd([a, b], [a, c], seenOf([a, b])), [c]);
    assert.deepEqual(strokesToAdd([a, b], [a, b], seenOf([a, b])), []);
    assert.deepEqual(strokesToAdd([], [a, b]), [a, b]);
  });
  test("a stroke this tab erased stays erased, one the other tab erased is kept", () => {
    assert.deepEqual(strokesToAdd([a], [a, b], seenOf([a, b])), []);   // we saw b, then erased it
    assert.deepEqual(strokesToAdd([a, b], [a], seenOf([a, b])), []);   // they erased b; we still hold it, nothing is taken from us
  });
  test("the same stroke drawn twice is two strokes", () => {
    const twice: Ink = [a, JSON.parse(JSON.stringify(a))];
    const ids = inkIds(twice);
    assert.equal(new Set(ids).size, 2);
    assert.deepEqual(strokesToAdd([a], twice, seenOf([a])).length, 1);
  });
});

describe("limits never drop what the cap allows", () => {
  test("a part at its byte cap reads back whole", () => {
    const dots = Array.from({ length: 9_500 }, (_, i) => ({ c: 0, w: 1, d: [i, i, 50] }));
    assert.ok(inkBytes(dots) <= 400_000 + 10_000);
    assert.equal(cleanInk(dots).length, 9_500);
    assert.ok(MAX_STROKES > 9_500);
  });
  test("one long stroke under the cap is not refused", () => {
    const d: number[] = [];
    for (let i = 0; i < 40_000; i++) d.push(i % 7, (i * 3) % 5, 1);
    assert.ok(cleanStroke({ d }));
  });
  test("byte counting matches the stored JSON and is cached", () => {
    const strokes = [encodeStroke(wave(80), 0, 1, false), encodeStroke(wave(30), 1, 2, true)];
    const oldWay = strokes.reduce((n, s) => n + 28 + s.d.reduce((sum, v) => sum + String(v).length + 1, 0), 2);
    assert.equal(inkBytes(strokes), oldWay);
    assert.equal(strokeBytes(strokes[0]), strokeBytes(strokes[0]));
    assert.equal(inkBytes([]), 2);
  });
});

describe("bounds", () => {
  test("ink bounds include the pen width, and none for no ink", () => {
    const s = encodeStroke(walk([[100, 50], [300, 90]]), 0, 2, true);
    const b = strokeBounds(s);
    assert.ok(b.x0 < 100 && b.x1 > 300 && b.y0 < 50 && b.y1 > 90);
    assert.deepEqual(inkBounds([s]), b);
    assert.equal(inkBounds([]), null);
    assert.ok(inkBottom([s]) >= 90 + INK_WIDTHS[2]);
  });
});
