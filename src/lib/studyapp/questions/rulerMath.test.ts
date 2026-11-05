import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { angleTo, fit, keepKnob, poseAround, MARGIN_PX, KEEP_PX, CROP_SCALE, edgeDistance, farEnd, lengthPx, middle, moved, PX_PER_MM, pxPerMm, RULER_MM, knobPoint, snap, startPose, turn, wrap } from "./rulerMath";

const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

describe("the scale of the printed picture", () => {
  test("a millimetre of paper is 6.236 pixels of the crop (cut at 2.2 times the PDF's points, 72 to the inch)", () => {
    near(PX_PER_MM, 6.2362, 1e-3);
    near(PX_PER_MM, CROP_SCALE * (72 / 25.4));
  });
  test("calibrated on OCR Biology Q23: the 8 and 10 micrometre bars (120.72 and 180.53 pt) are 265.6 and 397.2 px, the mark scheme's 42 mm", () => {
    near(120.72 * CROP_SCALE, 265.58, 0.01);
    near(180.53 * CROP_SCALE, 397.17, 0.01);
    near((120.72 / 72) * 25.4, 42.59, 0.01);
    assert.ok(Math.abs(265.66 - 120.72 * CROP_SCALE) < 1 && Math.abs(397.21 - 180.53 * CROP_SCALE) < 1, "the pixels measured in the crop agree within a pixel");
  });
  test("on screen a millimetre is the shown width over the natural width times that, at any width", () => {
    near(pxPerMm(1134, 1134), PX_PER_MM);
    near(pxPerMm(567, 1134), PX_PER_MM / 2);
    near(pxPerMm(342, 1134), (342 / 1134) * PX_PER_MM);
    near(pxPerMm(2268, 1134), PX_PER_MM * 2);
    assert.equal(pxPerMm(0, 1134), 0);
    assert.equal(pxPerMm(300, 0), 0);
  });
  test("the 150 mm ruler is 150 mm of the picture at every width: its drawn length is 150 times the millimetre", () => {
    for (const shown of [342, 560, 698, 1134, 1800]) near((lengthPx() * shown) / 1134, RULER_MM * pxPerMm(shown, 1134));
  });
  test("the ruler fits a picture of the usual width (1134 is 181.8 mm of paper, the ruler 150) but is not shrunk for a narrower one", () => {
    assert.ok(lengthPx() < 1134 && lengthPx() < 1086);
    near(lengthPx(), 935.43, 0.01);
  });
});

describe("turning and snapping", () => {
  test("angles are taken to the half turn either side", () => {
    assert.equal(wrap(190), -170); assert.equal(wrap(-190), 170); assert.equal(wrap(360), 0); assert.equal(wrap(180), 180); assert.equal(wrap(-180), 180);
  });
  test("within 3 degrees of 0, 45 or 90 (or any multiple of 45) the angle snaps, outside it is left alone", () => {
    assert.equal(snap(2.9), 0); assert.equal(snap(-2.9), 0); assert.equal(snap(3.5), 3.5);
    assert.equal(snap(43), 45); assert.equal(snap(48.5), 48.5); assert.equal(snap(47.5), 45); assert.equal(snap(91.9), 90); assert.equal(snap(94), 94);
    assert.equal(snap(-44), -45); assert.equal(snap(177.5), 180); assert.equal(snap(359), 0);
  });
  test("the angle from the 0 end to a point", () => {
    near(angleTo({ x: 10, y: 10 }, { x: 110, y: 10 })!, 0);
    near(angleTo({ x: 10, y: 10 }, { x: 10, y: 110 })!, 90);
    near(angleTo({ x: 10, y: 10 }, { x: 0, y: 10 })!, 180);
    near(angleTo({ x: 0, y: 0 }, { x: 5, y: -5 })!, -45);
    assert.equal(angleTo({ x: 3, y: 3 }, { x: 3, y: 3 }), null);
  });
  test("the far end and the middle follow the angle", () => {
    const L = lengthPx();
    const f = farEnd({ x: 100, y: 100, angle: 90 }); near(f.x, 100); near(f.y, 100 + L);
    const m = middle({ x: 0, y: 0, angle: 0 }); near(m.x, L / 2); near(m.y, 0);
  });
});

describe("the ruler stays where it can be used", () => {
  const box = { w: 1134, h: 560 };
  const M = MARGIN_PX, K = KEEP_PX;
  test("a ruler on the picture is left where it is", () => {
    const p = { x: 100, y: 200, angle: 10 };
    assert.deepEqual(fit(p, box), p);
  });
  test("the 0 end can lie on any point of the picture, edges and corners included, and 3 mm past them, with the ruler running inwards", () => {
    for (const [x, y] of [[0, 0], [0, 560], [1134 - K, 0], [300, 280], [-M, 100], [100, -M], [0, 280], [500, 560 + M]]) {
      const p = { x, y, angle: 0 };
      assert.deepEqual(fit(p, box), p, `0 at ${x},${y}`);
    }
    const down = { x: 400, y: -M, angle: 90 }; assert.deepEqual(fit(down, box), down);
  });
  test("the 15 end can lie on the right and bottom edges, with the ruler running inwards", () => {
    const right = { x: 1134 - lengthPx(), y: 300, angle: 0 };
    assert.deepEqual(fit(right, box), right);
    const f = farEnd({ x: 700, y: 560 - lengthPx() + 0, angle: 0 });
    assert.ok(f.x > 0);
    const up = { x: 600, y: 560 + M, angle: -90 }; assert.deepEqual(fit(up, box), up);
    const edge = { x: 1134 + M - lengthPx(), y: 560 + M, angle: 0 }; assert.deepEqual(fit(edge, box), edge);
  });
  test("past 3 mm it is brought back; the 0 can be put 'on the left end' of a bar in the figure to within a hair", () => {
    // the far end is on the picture, so the ruler may hang off the left: either end will do
    const hang = { x: -M - 30, y: 100, angle: 0 }; assert.deepEqual(fit(hang, box), hang);
    // both ends past it: brought back by the least that puts 25 mm of it, from the nearer end, on the picture
    const gone = fit({ x: -2000, y: 100, angle: 0 }, { w: 1134, h: 560 });
    assert.ok(farEnd(gone).x >= KEEP_PX - MARGIN_PX - 1e-6, 'the far end is back with 25 mm on the picture');
    // the 8 micrometre bar of Q23(a)(i) starts about here, well inside: any such point is reachable exactly
    for (const [x, y] of [[150.3, 212.7], [902.25, 88.6]]) { const q = { x, y, angle: 0 }; assert.deepEqual(fit(q, box), q); }
  });
  test("it can never be lost: at any angle and place, 25 mm of it from one end lie on the picture, and a second pass changes nothing", () => {
    const L = lengthPx();
    for (const bx of [box, { w: 1134, h: 150 }, { w: 400, h: 400 }]) for (let a = -180; a <= 180; a += 15) for (const [x, y] of [[-5000, -5000], [5000, 5000], [-2000, 300], [600, 9000], [0, 0], [1134, 560]]) {
      const q = fit({ x, y, angle: a }, bx);
      const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
      const pts = [[0, 0], [K, K], [L, L - K]].map(([u]) => ({ x: q.x + u * c, y: q.y + u * s }));
      const near0 = [pts[0], { x: q.x + K * c, y: q.y + K * s }], near1 = [{ x: q.x + L * c, y: q.y + L * s }, { x: q.x + (L - K) * c, y: q.y + (L - K) * s }];
      const okIn = (list: { x: number; y: number }[]) => list.every((r) => r.x >= -M - 1e-6 && r.x <= bx.w + M + 1e-6 && r.y >= -M - 1e-6 && r.y <= bx.h + M + 1e-6);
      if (bx.w >= K * 2 && bx.h >= K * 2) assert.ok(okIn(near0) || okIn(near1), `${a} ${x} ${y}`);
      const again = fit(q, bx); near(again.x, q.x, 1e-6); near(again.y, q.y, 1e-6);
    }
  });
  test("it starts level, across the middle of the picture", () => {
    const s = startPose(box);
    assert.equal(s.angle, 0); near(middle(s).x, 567, 1e-6); near(middle(s).y, 280, 1e-6);
  });
  test("and around any point: level, with its middle there where the picture allows", () => {
    const s = poseAround({ x: 300, y: 400 }, box); assert.equal(s.angle, 0); near(middle(s).x, 300, 1e-6); near(middle(s).y, 400, 1e-6);
  });
});

describe("moving by the screen's pixels", () => {
  test("a drag of 10 screen pixels on a picture drawn at a third of its size is 30 natural pixels", () => {
    const p = moved({ x: 5, y: 5, angle: 7 }, 10, -10, 378, 1134);
    near(p.x, 35); near(p.y, -25); near(p.angle, 7);
  });
  test("the distance of a point from the ruler's edge, level and turned", () => {
    const L = lengthPx();
    const level = edgeDistance({ x: 100, y: 100, angle: 0 }, { x: 150, y: 112 });
    near(level.d, 12); near(level.along, 50); assert.ok(level.onRuler);
    const turned = edgeDistance({ x: 0, y: 0, angle: 90 }, { x: -7, y: 40 });
    near(turned.d, 7); near(turned.along, 40);
    assert.ok(!edgeDistance({ x: 0, y: 0, angle: 0 }, { x: L + 5, y: 0 }).onRuler);
    assert.ok(!edgeDistance({ x: 0, y: 0, angle: 0 }, { x: -5, y: 0 }).onRuler);
  });
});

describe("turning about the middle", () => {
  test("the middle stays and the length is kept, at any angle", () => {
    const p = { x: 100, y: 200, angle: 0 };
    const m = middle(p);
    for (const a of [-170, -90, -45, 0, 30, 45, 90, 135, 180]) {
      const t = turn(p, a);
      near(middle(t).x, m.x, 1e-9); near(middle(t).y, m.y, 1e-9);
      near(Math.hypot(farEnd(t).x - t.x, farEnd(t).y - t.y), lengthPx(), 1e-9);
      near(wrap(t.angle), wrap(a));
    }
  });
  test("turning to the angle the pointer is at puts the far end on the line from the middle to the pointer", () => {
    const p = { x: 0, y: 0, angle: 0 };
    const to = { x: middle(p).x + 40, y: middle(p).y + 40 };
    const a = angleTo(middle(p), to)!;
    near(a, 45);
    const t = turn(p, a);
    near(farEnd(t).x - middle(t).x, farEnd(t).y - middle(t).y, 1e-6);
  });
});

describe("keeping the turning knob within reach", () => {
  const box = { w: 1134, h: 560 };
  const KNOB = { along: lengthPx() - 40, across: 90 };
  test("after a turn the knob is on the picture at any angle and place, and a second pass changes nothing", () => {
    for (let a = -180; a <= 180; a += 15) for (const [x, y] of [[-500, -500], [0, 0], [600, 300], [2000, 1500], [100, 900]]) {
      const q = keepKnob(turn({ x, y, angle: 0 }, a), box, 80, KNOB);
      const f = knobPoint(q, KNOB);
      assert.ok(f.x >= 80 - 1e-6 && f.x <= box.w - 80 + 1e-6 && f.y >= 80 - 1e-6 && f.y <= box.h - 80 + 1e-6, `${a}: knob ${f.x.toFixed(0)},${f.y.toFixed(0)}`);
      const again = keepKnob(q, box, 80, KNOB); near(again.x, q.x, 1e-6); near(again.y, q.y, 1e-6);
    }
  });
});
