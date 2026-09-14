"use client";
import { useEffect, useRef, useState } from "react";
import { QuillGlyph } from "@/components/quill/Quill";
import { useQuillScene, type Step } from "@/lib/quill/scene";
import { useMotionReady } from "@/lib/useMotionReady";

const nodes = {
  root: { x: 320, y: 42, w: 168, label: "A-Level Maths" },
  mech: { x: 320, y: 122, w: 130, label: "Mechanics" },
  forces: { x: 320, y: 202, w: 104, label: "Forces" },
  resolving: { x: 140, y: 300, w: 176, label: "Resolving forces", state: "weak", chip: "weak" },
  friction: { x: 320, y: 300, w: 116, label: "Friction", state: "strong", chip: "✓ strong" },
  connected: { x: 500, y: 300, w: 206, label: "Connected particles", state: "improving", chip: "✓ improving" },
} as const;
const H = 36;
const pot = { x: 46, y: 374 };

function Node({ n, id }: { n: { x: number; y: number; w: number; label: string; state?: string }; id: string }) {
  return <g className={`tree-node node-${id}`} data-state={n.state} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
    <rect x={n.x - n.w / 2} y={n.y - H / 2} width={n.w} height={H} rx="10"/>
    <text x={n.x} y={n.y + 5.5} textAnchor="middle">{n.label}</text>
  </g>;
}

function steps(setCard: (v: boolean) => void): Step[] {
  const r = nodes.resolving, f = nodes.friction, c = nodes.connected;
  return [
    { ink: 0.3, dur: 0 },
    { enter: [-40, 150], mood: "tired" },
    { reveal: "pot", dur: 0.5 },
    { move: [pot.x, pot.y - 62], dur: 1.7, lift: 6 },
    { hold: 0.5, mood: "curious" },
    { move: [pot.x, pot.y - 22], dur: 0.35, lift: 0 },
    { cls: "dip", add: "is-dipping" },
    { move: [pot.x, pot.y - 6], dur: 0.3, lift: 0 },
    { reveal: "ripple", dur: 0.25 },
    { ink: 1, dur: 0.55 },
    { hold: 0.15 },
    { cls: "risen", add: "has-risen" },
    { move: [pot.x, pot.y - 70], dur: 0.4, lift: 0, mood: "happy" },
    { reveal: "drop", dur: 0.2 },
    { hold: 0.45 },
    { move: [f.x + 28, f.y - 30], dur: 0.6, lift: 40, mood: "focused" },
    { draw: "tick-friction", dur: 0.3, mood: "proud" },
    { reveal: "chip-friction", dur: 0.3 },
    { move: [c.x + 70, c.y - 30], dur: 0.5, lift: 30, mood: "focused" },
    { draw: "mark-connected", dur: 0.3, mood: "happy" },
    { reveal: "chip-connected", dur: 0.3 },
    { move: [r.x + r.w / 2 + 6, r.y], dur: 0.7, lift: 50, mood: "focused" },
    { draw: "ring-weak", dur: 0.8 },
    { reveal: "chip-weak", dur: 0.3 },
    { cls: "open", add: "weak-open" },
    { hold: 0.35 },
    { move: [r.x, r.y - 6], dur: 0.25, lift: 0 },
    { move: [r.x, r.y + 2], dur: 0.12, lift: 0 },
    { move: [r.x, r.y - 6], dur: 0.14, lift: 0 },
    { call: () => setCard(true) },
    { hold: 0.5, mood: "happy" },
    { exit: [680, 420], dur: 1 },
  ];
}

export function LearnerTree() {
  const motion = useMotionReady();
  const svg = useRef<SVGSVGElement>(null);
  const [card, setCard] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const mq = window.matchMedia("(max-width: 700px)"); const f = () => setNarrow(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  const scene = useQuillScene(svg, () => steps(setCard), { motion, speed: narrow ? 1.5 : 1 });
  const showCard = !motion || card || scene.done;
  const r = nodes.resolving;
  const branch = (x: number) => `M320 ${nodes.forces.y + H / 2}C320 ${nodes.forces.y + 60} ${x} ${nodes.forces.y + 50} ${x} ${r.y - H / 2}`;
  return <section id="learner-model" className="tree-section" data-testid="learner-tree-section">
    <div className="story-container tree-layout">
      <div className="tree-copy"><div className="scene-eyebrow"><span>05</span> EVERY ANSWER TEACHES PLUMI ABOUT YOU</div><h2>You don’t have to know<br/><span className="muted-line">what you’re weak at.</span></h2><p>Every marked answer updates a model of your course. Plumi notices the branch that needs you, and turns it into the next thing to do.</p>
        {/* The line that keeps the tree from reading as a personality quiz. It is
            true: the learner model is written only from work a student was
            already doing, and there is no survey anywhere in the app. */}
        <p className="tree-aside">Nothing here is a survey you fill in. It is the work you were doing anyway.</p>
        <div className="tree-controls"><button className="replay-control" data-testid="tree-replay-button" onClick={() => { setCard(false); scene.replay(); }}>Replay ↻</button></div></div>
      <div className="tree-stage" data-card={showCard}>
        <svg ref={svg} viewBox="0 0 640 400" className="learner-tree" role="img" aria-label="A three-level curriculum tree: A-Level Maths, Mechanics, Forces, then Resolving forces (weak), Friction (strong) and Connected particles (improving).">
          <g className="tree-lines" fill="none" stroke="#c9d3e0" strokeWidth="1.6"><path d={`M320 ${nodes.root.y + H / 2}V${nodes.mech.y - H / 2}`}/><path d={`M320 ${nodes.mech.y + H / 2}V${nodes.forces.y - H / 2}`}/><path d={branch(r.x)}/><path d={branch(nodes.friction.x)}/><path d={branch(nodes.connected.x)}/></g>
          <Node n={nodes.root} id="root"/><Node n={nodes.mech} id="mech"/><Node n={nodes.forces} id="forces"/>
          <Node n={nodes.resolving} id="resolving"/><Node n={nodes.friction} id="friction"/><Node n={nodes.connected} id="connected"/>
          <path data-ink="tick-friction" d={`M${nodes.friction.x + 28} ${nodes.friction.y - 30}l7 7 14-17`} fill="none" stroke="#0f9d6b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <path data-ink="mark-connected" d={`M${nodes.connected.x + 70} ${nodes.connected.y - 30}l10 -12m0 0v10m0-10h-10`} fill="none" stroke="#2158d4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path data-ink="ring-weak" d={`M${r.x + r.w / 2 + 6} ${r.y}C${r.x + r.w / 2 + 8} ${r.y - 30} ${r.x - r.w / 2 - 4} ${r.y - 32} ${r.x - r.w / 2 - 10} ${r.y - 2}C${r.x - r.w / 2 - 12} ${r.y + 28} ${r.x + r.w / 2 + 4} ${r.y + 30} ${r.x + r.w / 2 + 8} ${r.y + 4}`} fill="none" stroke="#c8791a" strokeWidth="2.2" strokeLinecap="round"/>
          <g className="tree-chips" fontSize="13" fontWeight="500" textAnchor="middle"><text data-reveal="chip-weak" x={r.x} y={r.y + 42} fill="#a45f12">weak</text><text data-reveal="chip-friction" x={nodes.friction.x} y={nodes.friction.y + 42} fill="#0b7a53">strong</text><text data-reveal="chip-connected" x={nodes.connected.x} y={nodes.connected.y + 42} fill="#2158d4">improving</text></g>
          <g data-reveal="pot" className="ink-pot"><path d={`M${pot.x - 22} ${pot.y - 20}h44l-4 26q-18 6-36 0z`} fill="#1a46ac"/><path d={`M${pot.x - 14} ${pot.y - 30}h28v10h-28z`} fill="#16306e"/><ellipse cx={pot.x} cy={pot.y - 20} rx="22" ry="5" fill="#3b70e2"/><ellipse cx={pot.x} cy={pot.y - 20} rx="15" ry="3" fill="#6390ec" opacity=".7"/></g>
          <ellipse data-reveal="ripple" className="ink-ripple" cx={pot.x} cy={pot.y - 20} rx="6" ry="1.6" fill="none" stroke="#bed2f9" strokeWidth="1.4"/>
          <circle data-reveal="drop" className="ink-drop" cx={pot.x} cy={pot.y - 66} r="2.4" fill="#2158d4"/>
          <QuillGlyph scale={0.62} mood="tired" ink={0.3} className="scene-quill"/>
        </svg>
        <div className="next-card" data-testid="next-card" aria-hidden={!showCard}><span className="next-card-kicker"><span className="small-blue-dot"/>NEXT · 8 MIN</span><strong>Resolving forces on inclined planes</strong><span className="next-card-arrow" aria-hidden="true">↓</span></div>
      </div>
    </div>
  </section>;
}
