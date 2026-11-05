import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { angleTo, constrain, CROP_SCALE, edgeDistance, farEnd, lengthPx, middle, moved, PX_PER_MM, pxPerMm, RULER_MM, knobPoint, snap, startPose, turn, wrap } from "./rulerMath";

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

describe("the ruler stays on the picture", () => {
  const box = { w: 1134, h: 800 };
  test("a ruler on the picture is left where it is", () => {
    const p = { x: 100, y: 300, angle: 20 };
    assert.deepEqual(constrain(p, box), p);
  });
  test("dragged off the left, the right, the top or the bottom, its middle comes back to 60 px (10 mm) inside", () => {
    for (const to of [{ x: -2000, y: 300, angle: 0 }, { x: 5000, y: 300, angle: 0 }, { x: 100, y: -900, angle: 0 }, { x: 100, y: 9000, angle: 0 }, { x: -50, y: -50, angle: 130 }]) {
      const c = constrain(to, box); const m = middle(c);
      assert.ok(m.x >= 60 - 1e-9 && m.x <= box.w - 60 + 1e-9 && m.y >= 60 - 1e-9 && m.y <= box.h - 60 + 1e-9, JSON.stringify([to, m]));
      near(c.angle, to.angle);
    }
  });
  test("whatever the angle, at least 120 px of the ruler lie on the picture once constrained", () => {
    const clipLen = (p: { x: number; y: number; angle: number }) => {
      let n = 0; const L = lengthPx();
      for (let t = 0; t <= L; t += 1) { const x = p.x + t * Math.cos((p.angle * Math.PI) / 180), y = p.y + t * Math.sin((p.angle * Math.PI) / 180); if (x >= 0 && x <= box.w && y >= 0 && y <= box.h) n++; }
      return n;
    };
    for (const a of [0, 30, 45, 90, 135, 180, -90]) for (const [x, y] of [[-5000, -5000], [5000, 5000], [-5000, 5000], [0, 400]]) assert.ok(clipLen(constrain({ x, y, angle: a }, box)) >= 120, `${a} ${x} ${y}`);
  });
  test("a tiny picture still holds the ruler's middle (inset by half its smaller side)", () => {
    const c = constrain({ x: 900, y: 900, angle: 0 }, { w: 80, h: 50 }); const m = middle(c);
    assert.ok(m.x >= 25 - 1e-9 && m.x <= 55 + 1e-9 && Math.abs(m.y - 25) < 1e-9, JSON.stringify(m));
  });
  test("it starts level, in from the left, in the lower part", () => {
    const s = startPose(box);
    assert.equal(s.angle, 0); assert.ok(s.x >= 0 && s.y > box.h / 2 && s.y < box.h);
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
  test("an upright ruler on a short picture has its far end on the picture, whatever the middle", () => {
    for (const my of [0, 100, 280, 560, 900]) {
      const c = constrain(turn({ x: 0, y: 0, angle: 0 }, 90), box, 60, 80, KNOB);
      const q = constrain({ ...c, y: my }, box, 60, 80, KNOB);
      const f = knobPoint(q, KNOB);
      assert.ok(f.x >= 80 - 1e-6 && f.x <= box.w - 80 + 1e-6 && f.y >= 80 - 1e-6 && f.y <= box.h - 80 + 1e-6, `far end ${f.x.toFixed(0)},${f.y.toFixed(0)}`);
    }
  });
  test("any angle and place: the far end is inside, and a second pass changes nothing", () => {
    for (let a = -180; a <= 180; a += 15) for (const [x, y] of [[-500, -500], [0, 0], [600, 300], [2000, 1500], [100, 900]]) {
      const q = constrain({ x, y, angle: a }, box, 60, 80, KNOB);
      const f = knobPoint(q, KNOB);
      assert.ok(f.x >= 80 - 1e-6 && f.x <= box.w - 80 + 1e-6 && f.y >= 80 - 1e-6 && f.y <= box.h - 80 + 1e-6, `${a}: far end ${f.x.toFixed(0)},${f.y.toFixed(0)}`);
      const again = constrain(q, box, 60, 80, KNOB);
      near(again.x, q.x, 1e-6); near(again.y, q.y, 1e-6);
    }
  });
  test("with no reach it is as before", () => {
    const p = { x: 100, y: 100, angle: 30 };
    assert.deepEqual(constrain(p, box, 60, 0), constrain(p, box));
  });
});
