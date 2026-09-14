"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useMotionReady } from "@/lib/useMotionReady";
import { trackOnceWhenVisible, track } from "@/lib/analytics";
import { countdownAt } from "@/lib/countdown";
import { tutorFrames, tutorMedia, notebookViews, comparison, type Mark } from "@/content/story";
import { Quill } from "@/components/quill/Quill";

export function LaunchCountdown({ variant = "hero" }: { variant?: "hero" | "footer" }) {
  const [time, setTime] = useState<ReturnType<typeof countdownAt> | null>(null);
  useEffect(() => { const update = () => setTime(countdownAt(Date.now())); update(); const id = setInterval(update, 30000); return () => clearInterval(id); }, []);
  if (variant === "footer") return <span className="community-date" data-testid="footer-launch-status">{time?.ended ? "Follow launch updates in Discord" : "Coming to iPad · 25 September 2026"}</span>;
  return <div className="launch-countdown" data-testid="launch-countdown"><span className="launch-dot" />{time?.ended ? <span>Get launch updates in Discord</span> : <><span>Launching 25 September</span>{time && <span className="countdown-digits"><b>{time.days}</b>d <b>{String(time.hours).padStart(2,"0")}</b>h <b>{String(time.minutes).padStart(2,"0")}</b>m</span>}</>}</div>;
}

export function TutorMedia() {
  const motion = useMotionReady();
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const hasVideo = Boolean(tutorMedia.videoMp4 || tutorMedia.videoWebm) && !videoFailed;
  const active = motion ? frame : 4;
  const playing = motion && !paused && visible;
  useEffect(() => { if (!root.current) return; const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 }); observer.observe(root.current); return () => observer.disconnect(); }, []);
  useEffect(() => { if (!playing || hasVideo) return; const id = setInterval(() => setFrame(v => (v + 1) % tutorFrames.length), 4200); return () => clearInterval(id); }, [playing, hasVideo]);
  useEffect(() => { if (!video.current || !hasVideo) return; if (playing) video.current.play().catch(() => setPaused(true)); else video.current.pause(); }, [playing, hasVideo]);
  // Manual stepping also works with reduced motion. Auto motion never resumes on its own.
  const [manual, setManual] = useState<number | null>(null);
  const displayed = manual ?? active;
  // Whether the hero media is touched at all is the one question the slideshow
  // has to answer before it is replaced by a film: a stepper nobody steps is a
  // stepper, and a stepper everybody steps is a demo.
  const choose = (i: number) => { setFrame(i); setManual(i); setPaused(true); track("product_demo_interacted", { placement: "hero_media", action: "step", step: i + 1 }); };
  return <div ref={root} className="tutor-theatre" data-testid="hero-media" data-frame={displayed}>
    <div className="device-desk"><div className="ipad-device"><div className="ipad-camera"/><div className="ipad-screen">
      {/* Frame 5 is what the server renders (`active` is 4 until motion is
          confirmed), so it is the LCP element on a cold load — and it was the
          one frame not carrying a priority hint, which put the largest paint on
          this page behind every other request. Frame 1 keeps its hint because
          it is what appears the instant hydration allows motion. */}
      {hasVideo ? <video ref={video} className="tutor-video" muted loop playsInline preload="none" poster={tutorMedia.poster} onError={() => setVideoFailed(true)} data-testid="hero-video">{tutorMedia.videoWebm && <source src={tutorMedia.videoWebm} type="video/webm"/>}{tutorMedia.videoMp4 && <source src={tutorMedia.videoMp4} type="video/mp4"/>}</video> : tutorFrames.map((item, i) => <picture key={item.title} className={`tutor-frame ${displayed === i ? "is-current" : ""}`}>
        <source media="(max-width: 600px)" srcSet={`/product/tutor-${i+1}-mobile.webp`} />
        {/* Pre-optimised art-directed sources; native picture avoids downloading both crops. */}
        <img src={`/product/tutor-${i+1}.webp`} width="1600" height="1045" alt={displayed === i ? item.alt : ""} aria-hidden={displayed !== i} loading={i === 0 || i === 4 ? "eager" : "lazy"} fetchPriority={i === 0 || i === 4 ? "high" : "auto"}/>
      </picture>)}
    </div></div><div className="pencil-prop" aria-hidden="true"><span/></div></div>
    <div className="media-controls"><div className="media-caption"><span className="tiny-label">{hasVideo ? "ON THE PAGE" : `${String(displayed+1).padStart(2,"0")} / 05`}</span><strong>{hasVideo ? "Plumi Tutor" : tutorFrames[displayed].title}</strong><p>{hasVideo ? "Your work. A little guidance." : tutorFrames[displayed].detail}</p></div>
      <div className="media-actions">{!hasVideo && <div className="media-dots" aria-label="Tutor demonstration steps">{tutorFrames.map((item, i) => <button key={item.title} aria-label={item.title} aria-pressed={displayed === i} data-testid={`hero-media-step-${i+1}`} onClick={() => choose(i)}><span/></button>)}</div>}<button className="round-control" aria-label={playing ? "Pause tutor demonstration" : "Play tutor demonstration"} aria-pressed={!playing} data-testid="hero-media-pause-button" onClick={() => {setManual(null); setPaused(v=>!v); track("product_demo_interacted", { placement: "hero_media", action: playing ? "pause" : "play" });}} disabled={!motion}><span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span></button></div>
    </div><p className="capture-caption">{hasVideo ? "A real Plumi Tutor session." : "Real Plumi captures. Not a generated interface."}</p>
  </div>;
}

export function NotebookGallery() {
  const [active, setActive] = useState(0);
  return <div className="notebook-gallery"><div className="gallery-tabs" aria-label="Notebook views">{notebookViews.map((view,i)=><button key={view.id} data-testid={`notebook-tab-${view.id}`} aria-pressed={active===i} onClick={()=>setActive(i)}>{view.label}</button>)}</div>
    <div className="gallery-window" data-view={notebookViews[active].id} data-testid="notebook-gallery"><Image src={`/product/${notebookViews[active].image}.webp`} alt={notebookViews[active].alt} width={1600} height={1045} sizes="(max-width: 700px) 850px, 1100px"/>
    </div><p className="capture-caption">The real Plumi notebook · Free to write. Free to organise.</p></div>;
}

function Cell({ mark }: { mark: Mark }) {
  return <span className={`mark ${mark.ok ? "yes" : "no"}`} title={mark.note} aria-label={mark.ok ? "Yes" : mark.note ? `No. ${mark.note}` : "No"}>{mark.ok ? "✓" : "✕"}</span>;
}

/**
 * Four ways to get help, side by side.
 *
 * The mobile switcher collapses the three alternatives to one at a time — the
 * correct solution to the hardest responsive problem on this page, and the
 * reason this can stay a real `<table>` with `scope` attributes rather than
 * becoming a stack of cards that a screen reader reads as prose.
 *
 * The last row is prose rather than marks, because "free to write in" against
 * "paid by the hour" is a difference in kind and a tick cannot carry it.
 */
export function Comparison() {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => trackOnceWhenVisible(root.current, "comparison_viewed"), []);
  return <div className="comparison-wrap" ref={root}><div className="compare-mobile-switch" aria-label="Compare Plumi with">{comparison.alternatives.map((name,i)=><button key={name} onClick={()=>setActive(i)} aria-pressed={active===i} data-testid={`compare-option-${i}`}>{name}</button>)}</div>
    <table className={`comparison-table alternative-${active}`} data-testid="comparison-table"><caption className="sr-only">How Plumi fits beside other ways to study. General categories; individual services vary.</caption><thead><tr><th scope="col"><span className="tiny-label">AT A GLANCE</span></th><th scope="col" className="plumi-column"><Quill mood="happy" size={22}/> Plumi</th>{comparison.alternatives.map((name,i)=><th scope="col" key={name} className={`alternative col-${i}`}>{name}</th>)}</tr></thead><tbody>{comparison.rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td className="plumi-column"><Cell mark={row.plumi}/></td>{row.others.map((value,i)=><td className={`alternative col-${i}`} key={i}><Cell mark={value}/></td>)}</tr>)}
      <tr className="cost-row"><th scope="row">{comparison.cost.label}</th><td className="plumi-column">{comparison.cost.plumi}</td>{comparison.cost.others.map((value,i)=><td className={`alternative col-${i}`} key={i}>{value}</td>)}</tr></tbody></table><p className="capture-caption">General categories, not specific providers. Hover a ✕ for the detail. Individual services vary.</p>
  </div>;
}
