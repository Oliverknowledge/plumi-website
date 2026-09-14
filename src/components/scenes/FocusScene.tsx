"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Quill } from "@/components/quill/Quill";
import { useMotionReady } from "@/lib/useMotionReady";

const apps = [
  { id: "plumi", name: "Plumi", blocked: false },
  { id: "messages", name: "Messages", blocked: true },
  { id: "social", name: "Social", blocked: true },
  { id: "video", name: "Video", blocked: true },
  { id: "browser", name: "Browser", blocked: true },
  { id: "music", name: "Music", blocked: true },
  { id: "games", name: "Games", blocked: true },
  { id: "photos", name: "Photos", blocked: false },
];

const glyphs: Record<string, React.ReactNode> = {
  plumi: <Quill mood="focused" size={30}/>,
  messages: <path d="M6 9h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H14l-6 5v-5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z" fill="#fff"/>,
  social: <><rect x="6" y="6" width="20" height="20" rx="6" fill="none" stroke="#fff" strokeWidth="2.2"/><circle cx="16" cy="16" r="4.5" fill="none" stroke="#fff" strokeWidth="2.2"/><circle cx="22" cy="10" r="1.4" fill="#fff"/></>,
  video: <path d="M11 8l14 8-14 8z" fill="#fff"/>,
  browser: <><circle cx="16" cy="16" r="10" fill="none" stroke="#fff" strokeWidth="2.2"/><path d="M20.5 11.5 18 18l-6.5 2.5L14 14z" fill="#fff"/></>,
  music: <path d="M12 24a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10-3a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15 21V8l10-2v13" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round"/>,
  games: <><rect x="5" y="10" width="22" height="13" rx="6.5" fill="none" stroke="#fff" strokeWidth="2.2"/><path d="M11 14v5m-2.5-2.5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="15" r="1.3" fill="#fff"/><circle cx="23" cy="18" r="1.3" fill="#fff"/></>,
  photos: <><circle cx="16" cy="10" r="4" fill="#fff" opacity=".9"/><circle cx="21" cy="19" r="4" fill="#fff" opacity=".7"/><circle cx="11" cy="19" r="4" fill="#fff" opacity=".8"/></>,
};

/**
 * Whether the website is allowed to say Plumi blocks other apps.
 *
 * ── The state of the claim, checked in the app repo rather than in a document ─
 * `com.apple.developer.family-controls` **is** declared, in both
 * `Sources/Plumi/Plumi.entitlements` and `Sources/PlumiShield/PlumiShield.entitlements`,
 * and the shield extension is built and embedded (`project.yml:164`, `:257`).
 * The blocking is genuinely written. What is not established is Apple granting
 * the *distribution* entitlement, and `FocusShield.capability` degrades honestly
 * to `.timerOnly` / `.unauthorised` without it — which means on a shipping build
 * today Focus is a study timer.
 *
 * So the claim is conditionally true, and it becomes false for every user on
 * launch day if the grant has not landed. A caption saying "illustrative
 * recreation" does not repair that. The wording and the artwork therefore live
 * behind one flag, **off by default**, and the timer band ships in their place.
 * Turn it on the day blocking is verified working on a shipping build on a real
 * device, and not before.
 */
export const FOCUS_BLOCKING = process.env.NEXT_PUBLIC_FOCUS_BLOCKING === "true";

/**
 * The band inside the notebook chapter.
 *
 * Focus used to be numbered chapter 06, which put it in the middle of the
 * tightest causal run on the page — learner model, next question, exam mode.
 * It is a good feature and it is not part of that argument, so it is a band in
 * chapter 08 now.
 */
export function FocusBand() {
  if (FOCUS_BLOCKING) return <FocusScene />;
  return <div className="focus-band" data-testid="focus-band">
    <div className="focus-band-copy">
      <span className="tiny-label">FOCUS</span>
      <h3>Focus protects the time.</h3>
      {/* Exactly what a shipping build does today: it counts real study and it
          tells you honestly what you did with it. No blocking is claimed. */}
      <p>Start a session, set the length, and Plumi tells you honestly what you actually did with it.</p>
    </div>
    <figure className="focus-band-proof">
      <Image src="/product/focus-strip.webp" width={1072} height={120} alt="Real Plumi Focus session strip: 9 of 30 minutes studied." sizes="(max-width: 700px) 90vw, 520px"/>
      <figcaption>The real Focus timer · Development capture</figcaption>
    </figure>
  </div>;
}

/**
 * The blocked-app demonstration. Good work, and true the day Apple grants the
 * distribution entitlement — so it is held behind the flag rather than deleted.
 */
export function FocusScene() {
  const motion = useMotionReady();
  const [rawStage, setStage] = useState(0);
  const stage = motion ? rawStage : 3;
  const [tapped, setTapped] = useState("video");
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!root.current) return; const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 }); obs.observe(root.current); return () => obs.disconnect(); }, []);
  useEffect(() => { if (!motion || !visible || held) return; const script: [number, number][] = [[0, 900], [1, 1900], [2, 800], [3, 3800]]; let i = 0; let id: ReturnType<typeof setTimeout>; const next = () => { const [s, ms] = script[i]; setStage(s); if (s === 2) setTapped("video"); i = (i + 1) % script.length; id = setTimeout(next, ms); }; next(); return () => clearTimeout(id); }, [motion, visible, held]);
  const tap = (id: string, blocked: boolean) => { if (!blocked) return; setTapped(id); setStage(3); setHeld(true); };
  const close = () => { setStage(1); setHeld(false); };
  const focusing = stage >= 1;
  return <section id="focus" className="focus-section" data-testid="focus-section"><div className="story-container focus-layout">
    <div className="focus-copy"><div className="scene-eyebrow"><span>06</span> FOCUS</div><h2>When it’s time to focus,<br/><span className="muted-line">Plumi means it.</span></h2><p>Start a Focus session and the apps that usually win go quiet until you’re done. Not a nag. A promise you made, kept.</p>
      <figure className="focus-proof"><Image src="/product/focus-strip.webp" width={1072} height={120} alt="Real Plumi Focus session strip: 9 of 30 minutes studied." sizes="(max-width: 700px) 90vw, 420px"/><figcaption>The real Focus timer · Development capture</figcaption></figure></div>
    <div className="focus-stage" ref={root}><div className="focus-device" data-stage={stage} data-testid="focus-device">
      <div className="focus-screen">
        <div className="focus-statusbar"><span>9:41</span><span>Tuesday 14 October</span><span>●●● ▮</span></div>
        <div className="focus-banner" data-active={focusing}><Quill mood={focusing ? "focused" : "neutral"} size={22}/><span>{focusing ? "Focus session · 18:42 left" : "Focus session · Ready"}</span><b>{focusing ? "ON" : "OFF"}</b></div>
        <div className="app-grid">{apps.map((a, i) => <button key={a.id} className={`app-icon kind-${a.id}`} data-blocked={focusing && a.blocked} data-tapped={stage === 2 && tapped === a.id} style={{ "--i": i } as React.CSSProperties} onClick={() => tap(a.id, focusing && a.blocked)} aria-label={`${a.name}${focusing && a.blocked ? ", blocked during focus" : ""}`} data-testid={`focus-app-${a.id}`}><span className="icon-art">{a.id === "plumi" ? glyphs.plumi : <svg viewBox="0 0 32 32" aria-hidden="true">{glyphs[a.id]}</svg>}<span className="lock-badge" aria-hidden="true"><svg viewBox="0 0 12 12"><rect x="2" y="5" width="8" height="6" rx="1.5" fill="#16202e"/><path d="M4 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="#16202e" strokeWidth="1.4"/></svg></span></span><small>{a.name}</small></button>)}</div>
        <div className="blocked-sheet" data-open={stage === 3} data-testid="focus-blocked-sheet" aria-hidden={stage !== 3}><Quill mood="smug" size={78} className="sheet-quill"/><h3>Not yet.</h3><p>Finish your focus session first.</p><span className="sheet-app">{apps.find(a => a.id === tapped)?.name} · opens in 18:42</span><button onClick={close} data-testid="focus-back-button">Back to Plumi</button></div>
      </div>
    </div><p className="capture-caption">Illustrative recreation of Focus Mode blocking · Not an app recording</p></div>
  </div></section>;
}
