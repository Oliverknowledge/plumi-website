/** Test helper: walk for `secs` at `hz` display frames a second with per-frame jitter of +-`jitterMs`; the length in frames of every complete pose slot. */
export function slotLengths(slot: (stride: number) => number, hz: number, secs: number, jitterMs: number, seed = 1): number[] {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let t = 0, last = slot(0), run = 0, first = true;
  const out: number[] = [];
  for (let f = 0; f < hz * secs; f++) {
    t = f / hz + ((rnd() * 2 - 1) * jitterMs) / 1000;      // frame f is presented at its vsync, give or take; the stride is the time since the walk began
    const v = slot(t);
    if (v === last) run++;
    else { if (!first) out.push(run); first = false; last = v; run = 1; }
  }
  return out;
}
