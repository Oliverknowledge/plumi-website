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

/**
 * Keeps the ruler where it can be used. Its middle may not go nearer an edge than `inset` pixels, so at least `inset` pixels of it lie on the picture on each side of its middle in any
 * direction (`inset` is 60 natural pixels, 10 mm of paper, and never more than half the picture). And with `reach` (a finger's room, in natural pixels) the turning knob, at `knob` on the
 * ruler, is kept that far inside the picture too: a ruler turned upright on a wide, short picture is longer than the picture is high, and its knob must not go where a finger cannot
 * follow. (The knob wins where the two cannot both hold.)
 */
export function constrain(p: RulerPose, box: { w: number; h: number }, inset = 60, reach = 0, knob: KnobAt = { along: lengthPx(), across: 0 }): RulerPose {
  const i = Math.min(inset, box.w / 2, box.h / 2);
  const m = middle(p);
  const cx = Math.min(Math.max(m.x, i), Math.max(i, box.w - i));
  const cy = Math.min(Math.max(m.y, i), Math.max(i, box.h - i));
  let q = cx === m.x && cy === m.y ? p : { ...p, x: p.x + (cx - m.x), y: p.y + (cy - m.y) };
  if (reach > 0) {
    const r = Math.min(reach, box.w / 2, box.h / 2);
    const f = knobPoint(q, knob);
    const fx = Math.min(Math.max(f.x, r), Math.max(r, box.w - r));
    const fy = Math.min(Math.max(f.y, r), Math.max(r, box.h - r));
    if (fx !== f.x || fy !== f.y) q = { ...q, x: q.x + (fx - f.x), y: q.y + (fy - f.y) };
  }
  return q;
}

/** Where the ruler first lies: across the picture's lower part, a little in from the left, level. */
export function startPose(box: { w: number; h: number }): RulerPose {
  const L = lengthPx();
  return constrain({ x: Math.max(0, (box.w - L) / 2), y: box.h * 0.72, angle: 0 }, box);
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
