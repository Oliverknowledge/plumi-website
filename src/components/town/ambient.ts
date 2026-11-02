import { timeOfDay, type TimeOfDay } from "@/lib/studyapp/library/entry";
import type { TownObject } from "@/lib/town/types";

/**
 * The town's ambient life (docs/study/town.md "Ambient"). All of it is code drawn in the town's palette, allocates nothing per frame and costs a few
 * `fillRect`s: falling autumn leaves (0 to 30 on screen), smoke from the cottage and bakery chimneys (only the ones in view), a light tint for the
 * student's own hour (the library's dawn / day / evening / night, `timeOfDay`) and a warm glow round every lamp when it is not day.
 *
 *   leaves   a fixed pool; a leaf falls with a sway and is recycled at the bottom of the view; off under prefers-reduced-motion
 *   smoke    3 puffs a chimney on a 3.6 s cycle, stepped: the size and the opacity change in whole steps, so it reads as pixel art; off under reduced motion
 *   tint     a multiply fill (none by day); the glow is drawn after it, additively, so the lamps stay bright in the dark
 */
export const TINT: Record<TimeOfDay, { rgb: string; glow: number } | null> = {
  dawn: { rgb: "rgb(255,226,208)", glow: 0.3 },
  day: null,
  evening: { rgb: "rgb(255,208,168)", glow: 0.65 },
  night: { rgb: "rgb(118,130,190)", glow: 1 },
};
const LEAF = ["#d2691e", "#e8a317", "#b8341c", "#f0c14b", "#c97a1c"] as const;
export const MAX_LEAVES = 30;
/** Chimney pot positions as a share of the sprite's width, and rows down from its top. */
const CHIMNEY: [RegExp, number, number][] = [[/^cottage_/, 0.8, 4], [/^bakery$/, 0.9, 2]];

export interface View { x: number; y: number; w: number; h: number }

export class Ambient {
  readonly chimneys: Float32Array;       // x, y pairs (art px)
  readonly lamps: Float32Array;          // x, y pairs of the lamp heads
  tod: TimeOfDay;
  private leaves = new Float32Array(MAX_LEAVES * 6);   // x, y, phase, speed, size, colour
  private nLeaves = 0;
  private t = 0;
  private glowImg: HTMLCanvasElement | null = null;
  private seed = 1;
  private todCheck = 0;

  constructor(objects: readonly TownObject[], sprites: Record<string, { w: number; anchorX: number; anchorY: number; h: number }>, private reduced: boolean, tod?: TimeOfDay) {
    const ch: number[] = [], lp: number[] = [];
    for (const o of objects) {
      if (!o.sprite) continue;
      const sp = sprites[o.sprite];
      for (const [re, fx, dy] of CHIMNEY) if (re.test(o.sprite)) ch.push(o.sx + sp.w * fx, o.sy + dy);
      if (o.sprite.startsWith("lamp-post")) lp.push(o.x, o.sy + 10);
    }
    this.chimneys = Float32Array.from(ch); this.lamps = Float32Array.from(lp);
    this.tod = tod ?? timeOfDay(new Date().getHours());
  }

  private rnd() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  /** How many leaves the view holds: about one to 5200 art px squared, at most 30; none when motion is reduced. */
  targetLeaves(v: View): number { return this.reduced ? 0 : Math.max(8, Math.min(MAX_LEAVES, Math.round((v.w * v.h) / 5200))); }

  update(dt: number, v: View) {
    this.t += dt;
    if (this.t > this.todCheck) { this.todCheck = this.t + 30; if (!this.fixedTod) this.tod = timeOfDay(new Date().getHours()); }
    const want = this.targetLeaves(v), L = this.leaves;
    while (this.nLeaves < want) this.spawn(this.nLeaves++, v, true);
    this.nLeaves = Math.min(this.nLeaves, want);
    for (let i = 0; i < this.nLeaves; i++) {
      const o = i * 6;
      L[o + 1] += L[o + 3] * dt;
      L[o] += (Math.sin(this.t * 1.4 + L[o + 2]) * 9 + 5) * dt;
      if (L[o + 1] > v.y + v.h + 6 || L[o] > v.x + v.w + 12 || L[o] < v.x - 40 || L[o + 1] < v.y - 80) this.spawn(i, v, false);
    }
  }
  fixedTod = false;

  private spawn(i: number, v: View, anywhere: boolean) {
    const o = i * 6, L = this.leaves;
    L[o] = v.x - 20 + this.rnd() * (v.w + 40);
    L[o + 1] = anywhere ? v.y + this.rnd() * v.h : v.y - 6 - this.rnd() * 40;
    L[o + 2] = this.rnd() * 6.28; L[o + 3] = 13 + this.rnd() * 10; L[o + 4] = this.rnd() < 0.5 ? 2 : 3; L[o + 5] = Math.floor(this.rnd() * LEAF.length);
  }

  /** Smoke and leaves, over the scene. `k` device px to an art px, (cx, cy) the camera in device px. */
  drawMotion(ctx: CanvasRenderingContext2D, k: number, cx: number, cy: number, v: View) {
    if (this.reduced) return;
    // smoke: the chimneys in view only
    const C = this.chimneys, t = this.t;
    for (let i = 0; i < C.length; i += 2) {
      const x = C[i], y = C[i + 1];
      if (x < v.x - 12 || x > v.x + v.w + 12 || y < v.y - 4 || y > v.y + v.h + 40) continue;
      for (let p = 0; p < 3; p++) {
        const age = ((t / 3.6 + p / 3 + (i * 0.37)) % 1);             // 0 to 1 over the cycle
        const step = Math.min(3, Math.floor(age * 4));                // 0 to 3: grows, then thins out
        const size = step === 0 ? 3 : step === 1 ? 4 : 5;
        const a = step === 0 ? 0.95 : step === 1 ? 0.8 : step === 2 ? 0.58 : 0.34;
        const rise = Math.floor(age * 24), drift = Math.floor(age * 6) + (Math.floor(age * 8) % 2);
        ctx.globalAlpha = a;
        ctx.fillStyle = step >= 2 ? "#cfc8c0" : "#ece6df";
        ctx.fillRect(Math.round((x + drift - size / 2) * k) - cx, Math.round((y - rise - size) * k) - cy, size * k, size * k);
      }
    }
    // leaves
    const L = this.leaves;
    for (let i = 0; i < this.nLeaves; i++) {
      const o = i * 6, flip = Math.floor(this.t * 4 + L[o + 2]) & 1, w = flip ? L[o + 4] : 2, h = flip ? 1 : 2;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = LEAF[L[o + 5]];
      ctx.fillRect(Math.round(L[o] * k) - cx, Math.round(L[o + 1] * k) - cy, w * k, h * k);
    }
    ctx.globalAlpha = 1;
  }

  /** The hour's tint, then the lamps' glow on top of it. Nothing by day. */
  drawLight(ctx: CanvasRenderingContext2D, k: number, cx: number, cy: number, v: View, W: number, H: number) {
    const tint = TINT[this.tod];
    if (!tint) return;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tint.rgb;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    if (!this.glowImg) this.glowImg = makeGlow();
    const g = this.glowImg, S = 56, P = this.lamps;
    ctx.globalAlpha = tint.glow * 0.55;
    for (let i = 0; i < P.length; i += 2) {
      const x = P[i], y = P[i + 1];
      if (x < v.x - S || x > v.x + v.w + S || y < v.y - S || y > v.y + v.h + S) continue;
      ctx.drawImage(g, Math.round((x - S / 2) * k) - cx, Math.round((y - S / 2) * k) - cy, S * k, S * k);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}

/** A warm glow of three concentric steps (pixel art, not a gradient), 56 px: drawn once. */
function makeGlow(): HTMLCanvasElement {
  const S = 56, cv = document.createElement("canvas");
  cv.width = S; cv.height = S;
  const c = cv.getContext("2d")!;
  for (const [r, a] of [[26, 0.12], [18, 0.2], [10, 0.34], [4, 0.6]] as [number, number][]) {
    c.fillStyle = `rgba(255,190,90,${a})`;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x + 0.5 - S / 2) ** 2 + ((y + 0.5 - S / 2) * 1.15) ** 2 <= r * r) c.fillRect(x, y, 1, 1);
  }
  return cv;
}
