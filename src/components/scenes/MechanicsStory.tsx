"use client";
import { useEffect, useRef, useState } from "react";
import { Ink } from "@/components/product/Ink";
import { QuillGlyph } from "@/components/quill/Quill";
import { useQuillScene, type Step } from "@/lib/quill/scene";
import { useMotionReady } from "@/lib/useMotionReady";

const beats = [
  { label: "PLUMI BUILDS WHAT IT TEACHES", title: "Big ideas.\nDrawn simply.", text: "Plumi draws the diagram stroke by stroke, the way a tutor would beside you at the desk. Then asks the question." },
  { label: "THE UNDERSTANDING", title: "Not just a mistake.\nA place to grow.", text: "What you get right matters. So does knowing exactly where you got stuck." },
];

export function geometry(theta: number) {
  const a = theta * Math.PI / 180;
  const d = { x: Math.cos(a), y: -Math.sin(a) };
  const n = { x: -Math.sin(a), y: -Math.cos(a) };
  const base = { x: 85, y: 305 };
  const top = { x: base.x + d.x * 365, y: base.y + d.y * 365 };
  const b = { x: base.x + d.x * 205 + n.x * 22, y: base.y + d.y * 205 + n.y * 22 };
  const p = { x: top.x + n.x * 28, y: top.y + n.y * 28 };
  const stringStart = { x: b.x + d.x * 36 + n.x * 22, y: b.y + d.y * 36 + n.y * 22 };
  const tangent = { x: p.x + n.x * 16, y: p.y + n.y * 16 };
  const end = { x: p.x + 16, y: p.y };
  const lift = 14;
  const corner = (u: number, v: number) => `${(b.x + d.x * u + n.x * (v + lift)).toFixed(1)} ${(b.y + d.y * u + n.y * (v + lift)).toFixed(1)}`;
  const block = `M${corner(-36, -22)}L${corner(36, -22)}L${corner(36, 22)}L${corner(-36, 22)}Z`;
  const hang = 130;
  const mass = `M${end.x - 24} ${end.y + hang}h48v53h-48z`;
  const arrow = (ux: number, uy: number, len: number) => {
    const tx = b.x + ux * len, ty = b.y + uy * len; const px = -uy, py = ux;
    return { line: `M${b.x} ${b.y}L${tx} ${ty}`, head: `M${tx - ux * 9 + px * 5} ${ty - uy * 9 + py * 5}L${tx} ${ty}L${tx - ux * 9 - px * 5} ${ty - uy * 9 - py * 5}` };
  };
  return { theta, d, n, base, top, b, p, stringStart, tangent, end, block, mass, hang,
    forces: { R: arrow(n.x, n.y, 87), mg: arrow(0, 1, 100), T: arrow(d.x, d.y, 88), F: arrow(-d.x, -d.y, 91) } };
}

export function MechanicsFigure({ theta, live, showForces = true }: { theta: number; live?: boolean; showForces?: boolean }) {
  const g = geometry(theta);
  const { base, top, b, p, stringStart, tangent, end, d, n } = g;
  const stroke = { fill: "none", stroke: "#202b36", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const fStroke = { ...stroke, stroke: "#26323c", strokeWidth: 1.6 };
  return <svg viewBox="0 0 640 385" className="mechanics-figure" role="img" aria-labelledby={`mech-title-${theta}`}>
    <title id={`mech-title-${theta}`}>{`A two kilogram block on a rough ${theta} degree slope, connected by a light string over a smooth pulley to a three kilogram hanging mass.`}</title>
    <defs><pattern id={`hatch-${theta}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V9" stroke="#d1d3d2" strokeWidth="1"/></pattern></defs>
    <path data-reveal="hatch" d={`M${base.x} ${base.y}L${top.x} ${top.y}V${base.y}Z`} fill={`url(#hatch-${theta})`} stroke="none"/>
    <path data-ink="ground" d={`M${base.x - 15} ${base.y}H${top.x + 65}`} {...stroke} stroke="#525b63" strokeWidth={1.4}/>
    <path data-ink="incline" d={`M${base.x} ${base.y}L${top.x} ${top.y}`} {...stroke} strokeWidth={2.4}/>
    <path data-ink="wall" d={`M${top.x} ${top.y}V${base.y}`} {...stroke} stroke="#a6abae" strokeWidth={1.2}/>
    <g className="part-block" style={{ "--nx": n.x * 14, "--ny": n.y * 14 } as React.CSSProperties}><path data-ink="block" d={g.block} {...stroke} fill="#fcfcf9"/><text data-reveal="block-label" transform={`translate(${b.x + n.x * 14} ${b.y + n.y * 14}) rotate(${-theta})`} y="6" textAnchor="middle" fontSize="20" fontFamily="Georgia">2 kg</text></g>
    <path data-ink="bracket" d={`M${top.x} ${top.y}L${p.x} ${p.y}`} {...stroke} stroke="#535c64"/>
    <path data-ink="pulley" d={`M${p.x + 16} ${p.y}A16 16 0 1 1 ${p.x - 16} ${p.y}A16 16 0 1 1 ${p.x + 16} ${p.y}`} {...stroke} fill="#fcfcf9"/>
    <circle data-reveal="axle" cx={p.x} cy={p.y} r="2.5" fill="#202b36"/>
    <path data-ink="string" d={`M${stringStart.x} ${stringStart.y}L${tangent.x} ${tangent.y}A16 16 0 0 1 ${end.x} ${end.y}V${end.y + g.hang}`} {...stroke} strokeWidth={1.8}/>
    <path data-ink="mass" d={g.mass} {...stroke} fill="#fcfcf9"/>
    <text data-reveal="mass-label" x={end.x} y={end.y + g.hang + 33} textAnchor="middle" fontFamily="Georgia" fontSize="19">3 kg</text>
    <path data-ink="angle" d={`M${base.x + 54} ${base.y}A54 54 0 0 0 ${base.x + d.x * 54} ${base.y + d.y * 54}`} {...stroke} stroke="#343d47" strokeWidth={1.3}/>
    <g data-reveal="angle-label" fontFamily="Georgia" fontStyle="italic" fontSize="19"><text x={base.x + 65} y={base.y - 13}>θ = {theta}°</text><text x={top.x - 55} y="337" fill="#535c64">μ = 0.2</text></g>
    {showForces && <g className="part-forces" fontFamily="Georgia" fontStyle="italic" fontSize="23" fill="#26323c">
      <path data-ink="R" d={g.forces.R.line} {...fStroke}/><path data-ink="R-head" d={g.forces.R.head} {...fStroke}/><text data-reveal="R" x={b.x + n.x * 103 - 5} y={b.y + n.y * 103}>R</text>
      <path data-ink="mg" d={g.forces.mg.line} {...fStroke}/><path data-ink="mg-head" d={g.forces.mg.head} {...fStroke}/><text data-reveal="mg" x={b.x + 10} y={b.y + 115}>mg</text>
      <path data-ink="T" d={g.forces.T.line} {...fStroke}/><path data-ink="T-head" d={g.forces.T.head} {...fStroke}/><text data-reveal="T" x={b.x + d.x * 102} y={b.y + d.y * 102}>T</text>
      <path data-ink="F" d={g.forces.F.line} {...fStroke}/><path data-ink="F-head" d={g.forces.F.head} {...fStroke}/><text data-reveal="F" x={b.x - d.x * 111 - 10} y={b.y - d.y * 111 + 6}>F</text>
    </g>}
    {live && <QuillGlyph scale={0.6} mood="focused" className="scene-quill"/>}
  </svg>;
}

function buildSteps(setWritten: (v: boolean) => void): Step[] {
  const g = geometry(30);
  const { base, top, b, p, stringStart, end, n, d } = g;
  const force = (k: "R" | "mg" | "T" | "F"): Step[] => [{ move: [b.x, b.y], dur: 0.35, lift: 8 }, { draw: k, dur: 0.42 }, { draw: `${k}-head`, dur: 0.18 }, { reveal: k, dur: 0.3 }];
  const blockStart: [number, number] = [b.x - 36 * d.x - 22 * n.x + n.x * 14, b.y - 36 * d.y - 22 * n.y + n.y * 14];
  return [
    { enter: [base.x - 60, base.y + 40], mood: "focused" },
    { move: [base.x - 15, base.y], dur: 0.6 },
    { draw: "ground", dur: 0.9 },
    { move: [base.x, base.y], dur: 0.45, lift: 20 },
    { draw: "incline", dur: 0.85 },
    { draw: "wall", dur: 0.4 },
    { reveal: "hatch", dur: 0.5 },
    { cls: "lift", add: "block-lifted" },
    { move: blockStart, dur: 0.5, lift: 30 },
    { draw: "block", dur: 0.8 },
    { cls: "snap", add: "block-snapped" },
    { hold: 0.3, mood: "happy" },
    { reveal: "block-label", dur: 0.3 },
    { move: [top.x, top.y], dur: 0.5, mood: "focused" },
    { draw: "bracket", dur: 0.25 },
    { move: [p.x + 16, p.y], dur: 0.2, lift: 4 },
    { draw: "pulley", dur: 0.6 },
    { reveal: "axle", dur: 0.2 },
    { move: [stringStart.x, stringStart.y], dur: 0.5, lift: 22 },
    { draw: "string", dur: 1.1 },
    { move: [end.x - 24, end.y + g.hang], dur: 0.2, lift: 4 },
    { draw: "mass", dur: 0.6 },
    { reveal: "mass-label", dur: 0.3 },
    { move: [base.x + 54, base.y], dur: 0.6, lift: 40, mood: "curious" },
    { draw: "angle", dur: 0.4 },
    { reveal: "angle-label", dur: 0.35 },
    ...force("R"), ...force("mg"), ...force("T"), ...force("F"),
    { hold: 0.5, mood: "proud" },
    { call: () => setWritten(true) },
    { exit: [610, 30], dur: 0.9 },
  ];
}

export function MechanicsStory() {
  const [phase, setPhase] = useState(0);
  const [written, setWritten] = useState(false);
  const motion = useMotionReady();
  const svgWrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const mq = window.matchMedia("(max-width: 700px)"); const f = () => setNarrow(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  useEffect(() => { svg.current = svgWrap.current?.querySelector("svg") ?? null; }, [phase]);
  const scene = useQuillScene(svg, () => buildSteps(setWritten), { motion: motion && phase === 0, speed: narrow ? 1.45 : 1, deps: [phase] });
  const railLock = useRef(false);
  const railUpdate = useRef<() => void>(() => {});
  useEffect(() => { if (scene.done) { railLock.current = false; railUpdate.current(); } }, [scene.done]);
  useEffect(() => {
    const el = rail.current; if (!el) return;
    const second = el.querySelector<HTMLElement>('[data-phase="1"]'); if (!second) return;
    railUpdate.current = () => { if (railLock.current || !window.matchMedia("(min-width: 1100px)").matches) return; setPhase(second.getBoundingClientRect().top < window.innerHeight * 0.42 ? 1 : 0); };
    const obs = new IntersectionObserver(() => railUpdate.current(), { rootMargin: "0px 0px -58% 0px", threshold: [0, 1] });
    obs.observe(second); return () => obs.disconnect();
  }, []);
  const replay = () => { railLock.current = true; setPhase(0); setWritten(false); scene.replay(); };
  const showQuestion = !motion || written || scene.done || phase === 1;
  return <section id="how-it-works" className="mechanics-section" data-testid="mechanics-story">
    <div className="story-container mechanics-layout"><div className="mechanics-rail" ref={rail}>{beats.map((beat, i) => <article key={beat.label} data-phase={i} className={`story-beat ${phase === i ? "active-beat" : ""}`}><div className="scene-eyebrow"><span>0{i + 2}</span>{beat.label}</div><h2>{beat.title.split("\n").map((line, j) => <span key={line} className={j ? "muted-line" : ""}>{line}</span>)}</h2><p>{beat.text}</p></article>)}</div>
    <div className="mechanics-sticky"><div className="physics-paper" data-testid="mechanics-paper" data-phase={phase} data-written={showQuestion}>
      <div className="paper-heading"><span>A-LEVEL MATHEMATICS</span><span>MECHANICS / 01</span></div>
      <div ref={svgWrap} className="figure-wrap"><MechanicsFigure key={phase} theta={30} live={phase === 0}/></div>
      <div className="physics-content">{phase === 0 ? <div className="exam-question" data-testid="mechanics-question"><span className="question-number">1.</span><p>A 2 kg block moves up a rough 30° slope, connected to a 3 kg mass by a light string over a smooth pulley. Find the normal reaction and frictional force.<small>μ = 0.2 · g = 9.8 m s⁻² <span>[4 marks]</span></small></p></div> : <div className="evidence-work"><div className="work-line"><svg viewBox="0 0 230 48" role="img" aria-label="F equals mu R, correct friction law"><Ink text="F =" x={3} y={9} size={32} still/><path d="M83 16l-6 24M82 20q-2 15 5 10q6-3 8-14q-3 14 3 16" stroke="#16202e" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Ink text="R" x={103} y={9} size={32} still/><path d="M180 22l9 9 18-24" stroke="#0b7a53" fill="none" strokeWidth="2.5"/></svg><div><span className="evidence-label correct">Friction law</span><small>Evidence strengthened</small></div></div><div className="work-line"><svg viewBox="0 0 230 48" role="img" aria-label="R equals mg is incorrect on this slope"><Ink text="R = mg" x={3} y={9} size={32} still/><path d="M57 41q35 4 80-2" stroke="#a45f12" fill="none" strokeWidth="2.5"/><path d="M187 13l19 20m-19 0 19-20" stroke="#a45f12" fill="none" strokeWidth="2"/></svg><div><span className="evidence-label partial">Normal reaction</span><small>A concept to revisit</small></div></div><p className="tutor-note">Resolve perpendicular to the slope: <b>R = mg cos θ</b></p></div>}</div>
      <div className="paper-foot"><span>{phase === 0 ? "A question takes shape." : "One answer. Two different insights."}</span><span>plumi</span></div>
    </div><div className="mechanics-controls"><div className="scene-switch" aria-label="Learning story steps">{["Build", "Understand"].map((label, i) => <button key={label} aria-pressed={phase === i} data-testid={`mechanics-phase-${i}`} onClick={() => setPhase(i)}><span>0{i + 1}</span>{label}</button>)}</div><div className="mechanics-transport"><button data-testid="mechanics-step-pause-button" className="round-control" aria-label={scene.paused ? "Resume diagram animation" : "Pause diagram animation"} aria-pressed={scene.paused} disabled={!motion || phase !== 0} onClick={scene.togglePause}>{scene.paused ? "▷" : "Ⅱ"}</button><button className="replay-control" data-testid="mechanics-replay-button" onClick={replay}>Replay ↻</button></div></div><p className="capture-caption">Illustrative learning sequence · Not an app recording</p></div></div>
  </section>;
}
