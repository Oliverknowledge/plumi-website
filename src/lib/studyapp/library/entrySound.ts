"use client";

/**
 * The two small sounds of the front door, made with WebAudio (no files): the key's "thock" and a soft three-note
 * library bell as the door opens. They are only ever made from the press of Enter (a tap, so the browser lets the
 * audio start), never on arrival. No WebAudio, a suspended context or any error: silence, and nothing else changes.
 */
type Ctx = AudioContext;
type Win = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: Ctx | null = null;

function context(): Ctx | null {
  try {
    const w = globalThis as Win;
    const Make = w.AudioContext ?? w.webkitAudioContext;
    if (!Make) return null;
    const c = (ctx ??= new Make());
    if (c.state === "suspended") void c.resume().catch(() => { /* fine */ });
    return c;
  } catch { return null; }
}

/** The key going down, and the bell. Call from the press itself. Returns whether any sound could be made. */
export function playEnter(): boolean {
  const c = context();
  if (!c) return false;
  try {
    const t = c.currentTime + 0.01;
    const master = c.createGain();
    master.gain.value = 0.55;
    master.connect(c.destination);

    // thock: a short low knock and a puff of filtered noise
    const knock = c.createOscillator();
    const kg = c.createGain();
    knock.type = "sine";
    knock.frequency.setValueAtTime(190, t);
    knock.frequency.exponentialRampToValueAtTime(62, t + 0.09);
    kg.gain.setValueAtTime(0.0001, t);
    kg.gain.exponentialRampToValueAtTime(0.34, t + 0.006);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    knock.connect(kg).connect(master);
    knock.start(t); knock.stop(t + 0.14);

    const len = Math.floor(c.sampleRate * 0.05);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const noise = c.createBufferSource();
    noise.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass"; filter.frequency.value = 1700; filter.Q.value = 0.9;
    const ng = c.createGain();
    ng.gain.value = 0.16;
    noise.connect(filter).connect(ng).connect(master);
    noise.start(t); noise.stop(t + 0.06);

    // the bell: C, E, G, a little apart, each a pair of soft partials that ring out as the door opens
    [523.25, 659.25, 783.99].forEach((hz, i) => {
      const at = t + 0.11 + i * 0.1;
      for (const [mult, peak] of [[1, 0.1], [2.003, 0.035]] as const) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        o.frequency.value = hz * mult;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 1.25);
        o.connect(g).connect(master);
        o.start(at); o.stop(at + 1.3);
      }
    });
    return true;
  } catch { return false; }
}
