"use client";
import { useEffect, useRef } from "react";
import { QuillGlyph, type QuillMood } from "@/components/quill/Quill";
import { useInViewOnce } from "@/lib/useInViewOnce";
import { useMotionReady } from "@/lib/useMotionReady";

/**
 * A quill crossing the whitespace between two scenes. Desktop only, one pass,
 * SMIL motion along the same path the faint ink trail is drawn on, so the
 * character and its trace scale together with the section.
 */
export function QuillFlight({ d, mood = "neutral", duration = 2.8, className = "", viewBox = "0 0 1200 260" }: { d: string; mood?: QuillMood; duration?: number; className?: string; viewBox?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInViewOnce(ref, { amount: 0.5 });
  const motion = useMotionReady();
  const live = seen && motion;
  useEffect(() => { if (!live || !ref.current) return; ref.current.querySelectorAll<SVGAnimateMotionElement>("animateMotion").forEach(a => a.beginElement()); }, [live]);
  return <svg ref={ref} className={`quill-flight ${className}`} viewBox={viewBox} data-shown={live} aria-hidden="true" style={{ "--dur": `${duration}s` } as React.CSSProperties}>
    <path className="flight-trail" d={d} pathLength="1"/>
    {[0.35, 0.7].map((delay, i) => <g key={i} className="flight-frag"><animateMotion dur={`${duration + 0.4}s`} begin="indefinite" fill="freeze" path={d} calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" keyPoints="0;1"/><path d={`M${-6 + i * 4} 0l7-5 1 8z`} fill="#93b4f4" opacity=".6" style={{ animationDelay: `${delay}s` }}/></g>)}
    <g className="flight-quill"><animateMotion dur={`${duration}s`} begin="indefinite" fill="freeze" path={d} rotate="auto" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" keyPoints="0;1"/><QuillGlyph scale={0.7} mood={mood}/></g>
  </svg>;
}
