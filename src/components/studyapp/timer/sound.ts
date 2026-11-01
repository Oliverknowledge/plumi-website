/**
 * The soft chime at a phase change. Browsers refuse sound before the student has touched the page, so nothing is
 * created, resumed or played until the first tap or key press; before that `chime()` is silent. Everything is in
 * try/catch: a missing or blocked audio device is never an error the student, or the console, hears about.
 */
type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let touched = false;

/** Listens for the first tap or key press, then creates the audio context inside it (which is what lets it play). */
export function armChime(): () => void {
  if (typeof window === "undefined" || touched) return () => {};
  const events = ["pointerdown", "keydown", "touchend"] as const;
  const unlock = () => {
    touched = true;
    for (const e of events) window.removeEventListener(e, unlock, true);
    try {
      const AC: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      ctx.resume().catch(() => {});
    } catch { ctx = null; }
  };
  for (const e of events) window.addEventListener(e, unlock, { capture: true, passive: true });
  return () => { for (const e of events) window.removeEventListener(e, unlock, true); };
}

/** Two soft notes, a fifth apart, about a second in all. */
export function chime(): void {
  if (!touched || !ctx) return;
  try {
    const c = ctx;
    const play = () => {
      const t0 = c.currentTime + 0.02;
      [[659.25, 0], [987.77, 0.18]].forEach(([freq, delay]) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(0.14, t0 + delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.9);
        osc.connect(gain).connect(c.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + 1);
      });
    };
    if (c.state === "suspended") c.resume().then(play, () => {});
    else play();
  } catch { /* no sound is fine */ }
}
