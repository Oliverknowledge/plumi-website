"use client";
import { useMemo, useRef } from "react";
import { write, strokePath, strokeLength } from "@/lib/hand";
import { QuillGlyph } from "@/components/quill/Quill";
import { useQuillScene, type Step } from "@/lib/quill/scene";
import { useMotionReady } from "@/lib/useMotionReady";

const pot = { x: 44, y: 262 };
const underline = "M92 232C210 222 400 218 560 228";

/**
 * The closing line, written by the quill in Plumi's own hand.
 *
 * The words changed with the page's ending. "Help write the next chapter" asked
 * for a favour; this asks the visitor to do the one thing the whole page has
 * been about. The printed half of the sentence — "Write like you always have."
 * — sits above in ordinary type, so the handwriting carries only the payoff.
 */
export function InkSignature() {
  const motion = useMotionReady();
  const svg = useRef<SVGSVGElement>(null);
  const strokes = useMemo(() => [
    ...write("Find out", { size: 62, box: { x: 92, y: 56, width: 560 }, maxLines: 1, seed: 21 }),
    ...write("what it proves.", { size: 62, box: { x: 92, y: 140, width: 560 }, maxLines: 1, seed: 22 }),
  ], []);
  const scene = useQuillScene(svg, () => {
    const steps: Step[] = [
      { enter: [700, 40], mood: "neutral" },
      { reveal: "pot", dur: 0.4 },
      { move: [pot.x, pot.y - 60], dur: 1.1, lift: 10 },
      { move: [pot.x, pot.y - 8], dur: 0.35, lift: 0, mood: "curious" },
      { cls: "dip", add: "is-dipping" },
      { reveal: "ripple", dur: 0.25 },
      { hold: 0.25 },
      { cls: "risen", add: "has-risen" },
      { move: [pot.x, pot.y - 60], dur: 0.35, lift: 0, mood: "happy" },
    ];
    strokes.forEach((s, i) => { const [x, y] = s.points[0]; steps.push({ move: [x, y], dur: i === 0 ? 0.35 : 0.06, lift: i === 0 ? 30 : 5, mood: "focused" }, { draw: `s${i}`, dur: Math.max(0.06, strokeLength(s) / 600) }); });
    steps.push({ move: [92, 232], dur: 0.25, lift: 8 }, { draw: "underline", dur: 0.4 }, { hold: 0.4, mood: "proud" }, { move: [612, 262], dur: 0.6, lift: 40, mood: "wink" });
    return steps;
  }, { motion, deps: [strokes] });
  return <div className="ink-signature" data-done={scene.done}>
    <svg ref={svg} viewBox="0 0 680 300" role="img" aria-label="Find out what it proves.">
      <g className="ink-pot" data-reveal="pot"><path d={`M${pot.x - 22} ${pot.y - 20}h44l-4 26q-18 6-36 0z`} fill="#eaf1ff"/><path d={`M${pot.x - 14} ${pot.y - 30}h28v10h-28z`} fill="#c7d9fb"/><ellipse cx={pot.x} cy={pot.y - 20} rx="22" ry="5" fill="#fff"/><ellipse cx={pot.x} cy={pot.y - 20} rx="14" ry="3" fill="#dce7fc"/></g>
      <ellipse data-reveal="ripple" className="ink-ripple" cx={pot.x} cy={pot.y - 20} rx="6" ry="1.6" fill="none" stroke="#fff" strokeWidth="1.4"/>
      {strokes.map((s, i) => <path key={i} data-ink={`s${i}`} d={strokePath(s)} fill="none" stroke="#fcfcf9" strokeWidth={s.width * 1.15} strokeLinecap="round" strokeLinejoin="round"/>)}
      <path data-ink="underline" d={underline} fill="none" stroke="#93b4f4" strokeWidth="3" strokeLinecap="round"/>
      <QuillGlyph scale={0.72} mood="neutral" className="scene-quill on-blue"/>
    </svg>
  </div>;
}
