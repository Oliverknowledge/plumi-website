"use client";
import { useEffect, useRef, useState } from "react";
import { Ink } from "@/components/product/Ink";
import { useMotionReady } from "@/lib/useMotionReady";

const beats = [
  { label: "THE QUESTION", title: "Big ideas.\nDrawn simply.", text: "Plumi builds questions with diagrams that make the problem clear." },
  { label: "THE UNDERSTANDING", title: "Not just a mistake.\nA place to grow.", text: "What you get right matters. So does knowing exactly where you got stuck." },
  { label: "THE NEXT STEP", title: "Your next question\nstarts here.", text: "Practice the idea your work revealed. Not another random topic." },
];

function MechanicsFigure({ phase, animate }: { phase: number; animate: boolean }) {
  const theta = phase === 2 ? 40 : 30;
  const a = theta * Math.PI / 180;
  const d = { x: Math.cos(a), y: -Math.sin(a) };
  const n = { x: -Math.sin(a), y: -Math.cos(a) };
  const base = { x: 85, y: 305 };
  const top = { x: base.x + d.x*365, y: base.y + d.y*365 };
  const b = { x: base.x+d.x*205+n.x*22, y: base.y+d.y*205+n.y*22 };
  const p = { x: top.x+n.x*28, y: top.y+n.y*28 };
  const stringStart = { x:b.x+d.x*36+n.x*22, y:b.y+d.y*36+n.y*22 };
  const tangent = { x:p.x+n.x*16, y:p.y+n.y*16 };
  const end = { x:p.x+16,y:p.y };
  const arrow = (x:number,y:number,dx:number,dy:number) => `M${x} ${y} l${dx} ${dy}`;
  return <svg viewBox="0 0 640 385" className={`mechanics-figure ${animate ? "is-building" : ""}`} role="img" aria-labelledby="mechanics-figure-title">
    <title id="mechanics-figure-title">{`A two kilogram block moving up a rough ${theta} degree slope, connected by a light string over a smooth pulley to a three kilogram hanging mass. Friction acts down the slope; reaction acts perpendicular to it.`}</title>
    <defs><marker id="force-arrow" markerWidth="7" markerHeight="7" refX="5.6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="currentColor" strokeWidth="1.2"/></marker><pattern id="paper-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V9" stroke="#d1d3d2" strokeWidth="1"/></pattern></defs>
    <g className="build-part part-plane"><path d={`M${base.x} ${base.y}L${top.x} ${top.y}V${base.y}Z`} fill="url(#paper-hatch)" stroke="#a6abae" strokeWidth="1.2"/><path d={`M${base.x} ${base.y}L${top.x} ${top.y}`} fill="none" stroke="#202b36" strokeWidth="2.4"/><path d={`M${base.x-15} ${base.y}H${top.x+65}`} stroke="#525b63" strokeWidth="1.3"/></g>
    <g className="build-part part-block"><g transform={`translate(${b.x} ${b.y}) rotate(${-theta})`}><rect x="-36" y="-22" width="72" height="44" rx="2" fill="#fcfcf9" stroke="#202b36" strokeWidth="2"/><text y="6" textAnchor="middle" fontSize="20" fontFamily="Georgia">2 kg</text></g></g>
    <g className="build-part part-pulley"><path d={`M${top.x} ${top.y}L${p.x} ${p.y}`} stroke="#535c64" strokeWidth="2"/><circle cx={p.x} cy={p.y} r="16" fill="#fcfcf9" stroke="#202b36" strokeWidth="2"/><circle cx={p.x} cy={p.y} r="2.5" fill="#202b36"/></g>
    <g className="build-part part-mass"><rect x={end.x-24} y={end.y+160} width="48" height="53" rx="2" fill="#fcfcf9" stroke="#202b36" strokeWidth="2"/><text x={end.x} y={end.y+191} textAnchor="middle" fontFamily="Georgia" fontSize="19">3 kg</text></g>
    <g className="build-part part-string"><path d={`M${stringStart.x} ${stringStart.y}L${tangent.x} ${tangent.y}A16 16 0 0 1 ${end.x} ${end.y}V${end.y+160}`} stroke="#202b36" strokeWidth="1.8" fill="none"/></g>
    <g className="build-part part-angle" fontFamily="Georgia" fontStyle="italic" fontSize="19"><path d={`M${base.x+54} ${base.y}A54 54 0 0 0 ${base.x+d.x*54} ${base.y+d.y*54}`} fill="none" stroke="#343d47" strokeWidth="1.2"/><text x={base.x+65} y={base.y-13}>θ = {theta}°</text><text x={top.x-55} y="337" fill="#535c64">μ = 0.2</text></g>
    <g className="build-part part-forces" fill="none" stroke="currentColor" strokeWidth="1.5" color="#26323c">
      <path d={arrow(b.x,b.y,n.x*87,n.y*87)} markerEnd="url(#force-arrow)"/><path d={arrow(b.x,b.y,0,100)} markerEnd="url(#force-arrow)"/><path d={arrow(b.x,b.y,d.x*88,d.y*88)} markerEnd="url(#force-arrow)"/><path d={arrow(b.x,b.y,-d.x*91,-d.y*91)} markerEnd="url(#force-arrow)"/>
      <g fill="#26323c" stroke="none" fontFamily="Georgia" fontStyle="italic" fontSize="23"><text x={b.x+n.x*103-5} y={b.y+n.y*103}>R</text><text x={b.x+10} y={b.y+115}>mg</text><text x={b.x+d.x*102} y={b.y+d.y*102}>T</text><text x={b.x-d.x*111-10} y={b.y-d.y*111+6}>F</text></g>
    </g>
    {animate && <g className="diagram-pen" aria-hidden="true"><path d="M0 0L10 -40Q12 -46 17 -44Q23 -42 21 -36L7 3Z" fill="#e8eaf0" stroke="#969ca5" strokeWidth="1"/><path d="M0 0L7 3L0 10Z" fill="#24313f"/><path d="M13 -39L17 -38" stroke="#2158d4" strokeWidth="3"/></g>}
  </svg>;
}

export function MechanicsStory() {
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [replay, setReplay] = useState(0);
  const [answer, setAnswer] = useState(false);
  const motion = useMotionReady();
  const root = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(()=>{ if(!root.current)return; const obs=new IntersectionObserver(([e])=>setVisible(e.isIntersecting),{threshold:0.08});obs.observe(root.current);return()=>obs.disconnect();},[]);
  useEffect(()=>{ if(!rail.current)return; const obs=new IntersectionObserver(entries=>{ if(!window.matchMedia("(min-width: 1100px)").matches || !motion)return; for(const e of entries)if(e.isIntersecting){setPhase(Number((e.target as HTMLElement).dataset.phase));setAnswer(false);} },{rootMargin:"-30% 0px -38% 0px",threshold:0});rail.current.querySelectorAll("[data-phase]").forEach(e=>obs.observe(e));return()=>obs.disconnect();},[motion]);
  const choose=(i:number)=>{setPhase(i);setAnswer(false);};
  return <section id="how-it-works" ref={root} className="mechanics-section" data-testid="mechanics-story">
    <div className="story-container mechanics-layout"><div className="mechanics-rail" ref={rail}>{beats.map((beat,i)=><article key={beat.label} data-phase={i} className={`story-beat ${phase===i?"active-beat":""}`}><div className="scene-eyebrow"><span>0{i+2}</span>{beat.label}</div><h2>{beat.title.split("\n").map((line,j)=><span key={line} className={j?"muted-line":""}>{line}</span>)}</h2><p>{beat.text}</p><div className="beat-thread" aria-hidden="true"><span className={i>=0?"filled":""}/><i/><span className={i>=1?"filled":""}/><i/><span className={i>=2?"filled":""}/></div></article>)}</div>
    <div className="mechanics-sticky"><div className="physics-paper" data-testid="mechanics-paper" data-phase={phase} data-paused={paused || !visible}>
      <div className="paper-heading"><span>A-LEVEL MATHEMATICS</span><span>MECHANICS / {phase===2?"02":"01"}</span></div>
      <MechanicsFigure key={`${phase===0?replay:"settled"}-${visible}`} phase={phase} animate={phase===0 && motion && visible}/>
      <div className="physics-content">{phase===0?<div className="exam-question"><span className="question-number">1.</span><p>A 2 kg block moves up a rough 30° slope, connected to a 3 kg mass by a light string over a smooth pulley. Find the normal reaction and frictional force.<small>μ = 0.2 · g = 9.8 m s⁻² <span>[4 marks]</span></small></p></div>:phase===1?<div className="evidence-work"><div className="work-line"><svg viewBox="0 0 230 48" role="img" aria-label="F equals mu R, correct friction law"><Ink text="F =" x={3} y={9} size={32} still/><path data-testid="friction-mu-glyph" d="M83 16l-6 24M82 20q-2 15 5 10q6-3 8-14q-3 14 3 16" stroke="#16202e" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Ink text="R" x={103} y={9} size={32} still/><path d="M180 22l9 9 18-24" stroke="#0b7a53" fill="none" strokeWidth="2.5"/></svg><div><span className="evidence-label correct">Friction law</span><small>Evidence strengthened</small></div></div><div className="work-line"><svg viewBox="0 0 230 48" role="img" aria-label="R equals mg is incorrect on this slope"><Ink text="R = mg" x={3} y={9} size={32} still/><path d="M57 41q35 4 80-2" stroke="#a45f12" fill="none" strokeWidth="2.5"/><path d="M187 13l19 20m-19 0 19-20" stroke="#a45f12" fill="none" strokeWidth="2"/></svg><div><span className="evidence-label partial">Normal reaction</span><small>A concept to revisit</small></div></div><p className="tutor-note">Resolve perpendicular to the slope: <b>R = mg cos θ</b></p></div>:<div className="next-physics"><div className="next-topic"><span className="small-blue-dot"/>NEXT UP · NORMAL REACTION</div><p>Same system. Now θ = 40°.<br/>What is the normal reaction?</p>{answer?<div className="worked-answer" data-testid="mechanics-answer">R = 2 × 9.8 × cos 40° ≈ <b>15.0 N</b></div>:<button className="worked-reveal" data-testid="mechanics-reveal-answer" onClick={()=>setAnswer(true)}>Reveal the worked step <span aria-hidden="true">↗</span></button>}</div>}</div>
      <div className="paper-foot"><span>{phase===0?"A question takes shape.":phase===1?"One answer. Two different insights.":"Your work decides what comes next."}</span><span>plumi</span></div>
    </div><div className="mechanics-controls"><div className="scene-switch" aria-label="Learning story steps">{["Build","Understand","Practise"].map((label,i)=><button key={label} aria-pressed={phase===i} data-testid={`mechanics-phase-${i}`} onClick={()=>choose(i)}><span>0{i+1}</span>{label}</button>)}</div><div className="mechanics-transport"><button data-testid="mechanics-step-prev-button" className="round-control" aria-label="Previous learning step" disabled={phase===0} onClick={()=>choose(phase-1)}>←</button><button data-testid="mechanics-step-next-button" className="round-control" aria-label="Next learning step" disabled={phase===2} onClick={()=>choose(phase+1)}>→</button><button data-testid="mechanics-step-pause-button" className="round-control" aria-label={paused?"Resume diagram animation":"Pause diagram animation"} aria-pressed={paused} disabled={!motion || phase!==0} onClick={()=>setPaused(v=>!v)}>{paused?"▷":"Ⅱ"}</button><button className="replay-control" data-testid="mechanics-replay-button" onClick={()=>{choose(0);setPaused(false);setReplay(v=>v+1);}}>Replay ↻</button></div></div><p className="capture-caption">Illustrative learning sequence · Not an app recording</p></div></div>
  </section>;
}
