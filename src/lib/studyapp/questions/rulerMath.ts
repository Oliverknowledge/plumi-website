/**
 * The virtual ruler's arithmetic, pure. A question's picture is a crop of the printed paper cut at 2.2 times the PDF's own size (scripts/question-bank/cut.py `SCALE`, and every other
 * cutter's: cut_pearson, cut_eduqas, cut_eduqas_gcse, cut_eduqas_rs, ms_fallback and the ones that call `cut.render`), and a PDF point is 1/72 inch, so ONE MILLIMETRE of the printed
 * paper is `2.2 * 72 / 25.4` = 6.236 pixels of the picture at its natural width (the part's `w`). On screen the picture is drawn at some width, and the ruler is drawn in the picture's own
 * coordinates, so a millimetre on the ruler is `shownWidth / naturalWidth * 6.236` screen pixels, whatever the screen, the zoom or the turn of the device. The ruler is a straight edge
 * and nothing more: it reads out nothing and measures nothing.
 *
 * (Calibrated on OCR A-Level Biology A, June 2025 Paper 1, Q23: the printed "10 µm" and "8 µm" scale bars are 180.53 pt and 120.72 pt between their end ticks in the PDF; in the crop
 * of 23(a)(i) they are 397.21 and 265.66 px between tick centres: 2.2 times the points within 0.1 px. The mark scheme measures the 8 µm bar as 42 mm: 120.72 pt is 42.6 mm.)
 */
export const CROP_SCALE = 2.2;
/** Millimetres of the printed paper to crop pixels at the picture's natural width. */
export const PX_PER_MM = (CROP_SCALE * 72) / 25.4;
/** The ruler is 15 cm, as a school ruler is. */
export const RULER_MM = 150;
/** ... and 30 mm across, a little deeper than a real one so that its numbers can be read. */
export const RULER_DEPTH_MM = 30;

/** Screen pixels to the millimetre for a picture of `naturalW` pixels drawn `shownW` pixels wide. 0 for a picture with no known size (no ruler is drawn then). */
export function pxPerMm(shownW: number, naturalW: number): number {
  return shownW > 0 && naturalW > 0 ? (shownW / naturalW) * PX_PER_MM : 0;
}

export interface Pt { x: number; y: number }
/** The ruler as the picture holds it: where its 0 end is, in the picture's natural pixels, and its angle in degrees (0 along the picture's top edge, positive turning clockwise on screen). */
export interface RulerPose { x: number; y: number; angle: number }

/** The ruler's length in natural pixels. */
export const lengthPx = (): number => RULER_MM * PX_PER_MM;
const rad = (d: number) => (d * Math.PI) / 180;

/** The far end of the ruler (where the turning knob is), in natural pixels. */
export function farEnd(p: RulerPose): Pt {
  const L = lengthPx();
  return { x: p.x + L * Math.cos(rad(p.angle)), y: p.y + L * Math.sin(rad(p.angle)) };
}
/** The middle of the ruler's long edge. */
export function middle(p: RulerPose): Pt {
  const L = lengthPx() / 2;
  return { x: p.x + L * Math.cos(rad(p.angle)), y: p.y + L * Math.sin(rad(p.angle)) };
}

/** An angle taken to (-180, 180]. */
export function wrap(deg: number): number {
  let a = ((deg % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a === -0 ? 0 : a;
}

/** A soft snap: within `tol` degrees of a multiple of 45 the angle is that multiple (so 0, 45, 90 and the rest of the eight ways), else it is left as it was. */
export function snap(deg: number, tol = 3): number {
  const a = wrap(deg);
  const n = Math.round(a / 45) * 45;
  return Math.abs(a - n) <= tol ? wrap(n) : a;
}

/** The angle of the ruler when its far end is taken to `to`, its 0 end staying where it is (turning by the knob). Null for a point on the 0 end itself. */
export function angleTo(origin: Pt, to: Pt): number | null {
  const dx = to.x - origin.x, dy = to.y - origin.y;
  return Math.hypot(dx, dy) < 1e-6 ? null : wrap((Math.atan2(dy, dx) * 180) / Math.PI);
}

/** Where the turning knob sits on the ruler: `along` its length from the 0 end and `across` from the long edge (the body side), in natural pixels. */
export interface KnobAt { along: number; across: number }
/** The point of the picture the knob is at. */
export function knobPoint(p: RulerPose, k: KnobAt): Pt {
  const c = Math.cos(rad(p.angle)), s = Math.sin(rad(p.angle));
  return { x: p.x + k.along * c - k.across * s, y: p.y + k.along * s + k.across * c };
}

/** How far past the picture's edge a ruler's end may go: 3 mm of paper, so its 0 can lie on the very edge of the figure and a little beyond. */
export const MARGIN_PX = 3 * PX_PER_MM;
/** How much of the ruler must stay on the picture, one end included: 25 mm of paper. */
export const KEEP_PX = 25 * PX_PER_MM;

const inBox = (q: Pt, box: { w: number; h: number }, m: number) => q.x >= -m - 1e-6 && q.x <= box.w + m + 1e-6 && q.y >= -m - 1e-6 && q.y <= box.h + m + 1e-6;
/** The smallest shift that brings all of `pts` into the picture (widened by `m`); where they cannot all fit, the middle of what would. */
function shiftInto(pts: Pt[], box: { w: number; h: number }, m: number): Pt {
  const ax = (vs: number[], size: number) => {
    const lo = -m - Math.min(...vs), hi = size + m - Math.max(...vs);
    return lo <= hi ? Math.min(Math.max(0, lo), hi) : (lo + hi) / 2;
  };
  return { x: ax(pts.map((q) => q.x), box.w), y: ax(pts.map((q) => q.y), box.h) };
}

/**
 * Where a ruler may lie: EITHER end (the 0 or the 15) can be put on any point of the picture, its edges and corners included and up to 3 mm past them, and the ruler can never be lost, since
 * 25 mm of it, from one end, always lies on the picture. (So the 0 can be put on the very left of a figure with the ruler running right over it, and the rest hangs off the picture's right
 * edge, drawn over the sheet.) A pose that does not meet this is moved the least that makes it.
 */
export function fit(p: RulerPose, box: { w: number; h: number }): RulerPose {
  const c = Math.cos(rad(p.angle)), s = Math.sin(rad(p.angle));
  const L = lengthPx(), K = Math.min(KEEP_PX, L);
  const o = { x: p.x, y: p.y }, a0 = { x: p.x + K * c, y: p.y + K * s };
  const f = { x: p.x + L * c, y: p.y + L * s }, a1 = { x: p.x + (L - K) * c, y: p.y + (L - K) * s };
  if ((inBox(o, box, MARGIN_PX) && inBox(a0, box, MARGIN_PX)) || (inBox(f, box, MARGIN_PX) && inBox(a1, box, MARGIN_PX))) return p;
  const A = shiftInto([o, a0], box, MARGIN_PX), B = shiftInto([f, a1], box, MARGIN_PX);
  const d = Math.hypot(A.x, A.y) <= Math.hypot(B.x, B.y) ? A : B;
  return { ...p, x: p.x + d.x, y: p.y + d.y };
}

/** After a TURN: the knob, which the student's finger follows, is kept `reach` natural pixels inside the picture (a ruler turned upright on a short picture would take it away). Then `fit`. */
export function keepKnob(p: RulerPose, box: { w: number; h: number }, reach: number, knob: KnobAt): RulerPose {
  const r = Math.min(reach, box.w / 2, box.h / 2);
  const f = knobPoint(p, knob);
  const fx = Math.min(Math.max(f.x, r), Math.max(r, box.w - r));
  const fy = Math.min(Math.max(f.y, r), Math.max(r, box.h - r));
  return fit(fx !== f.x || fy !== f.y ? { ...p, x: p.x + (fx - f.x), y: p.y + (fy - f.y) } : p, box);
}

/** A level ruler laid across the picture with its middle at `c` (the centre of what the student can see of the picture). */
export function poseAround(c: Pt, box: { w: number; h: number }): RulerPose {
  return fit({ x: c.x - lengthPx() / 2, y: c.y, angle: 0 }, box);
}
/** Where the ruler first lies when nothing else is known: level, across the middle of the picture. */
export function startPose(box: { w: number; h: number }): RulerPose {
  return poseAround({ x: box.w / 2, y: box.h / 2 }, box);
}

/** A move by screen pixels (a drag, an arrow key) as a move in natural pixels. */
export function moved(p: RulerPose, dxScreen: number, dyScreen: number, shownW: number, naturalW: number): RulerPose {
  const k = shownW > 0 ? naturalW / shownW : 1;
  return { ...p, x: p.x + dxScreen * k, y: p.y + dyScreen * k };
}

/** The ruler turned to `angle` about its middle (which stays where it is), as the turning knob and the [ and ] keys do. */
export function turn(p: RulerPose, angle: number): RulerPose {
  const m = middle(p);
  const L = lengthPx() / 2;
  const a = wrap(angle);
  return { x: m.x - L * Math.cos(rad(a)), y: m.y - L * Math.sin(rad(a)), angle: a };
}

/** The distance of a point from the ruler's long edge (the 0 to 150 line), in natural pixels, and whether it falls along the ruler's length. */
export function edgeDistance(p: RulerPose, q: Pt): { d: number; along: number; onRuler: boolean } {
  const L = lengthPx();
  const dx = q.x - p.x, dy = q.y - p.y;
  const c = Math.cos(rad(p.angle)), s = Math.sin(rad(p.angle));
  const along = dx * c + dy * s;
  const d = -dx * s + dy * c;
  return { d, along, onRuler: along >= 0 && along <= L };
}
