import { useId, type CSSProperties } from "react";

/**
 * Plumi — the quill. The mascot, the logo character and the visible hand of the AI.
 *
 * Drawn once as SVG so it can be placed in any scene's coordinate space, bent,
 * dipped, re-inked and given an expression without swapping bitmaps. The nib
 * tip sits at the local origin (0,0) and the feather rises to about y=-120, so
 * `translate(x y)` puts the tip exactly where the ink is.
 *
 * Expression is data, not artwork: `data-mood` selects which eye/mouth layers
 * are shown (see quill.css). `--ink` (0..1) is how much ink is in the quill.
 */
export type QuillMood = "neutral" | "happy" | "focused" | "curious" | "tired" | "proud" | "smug" | "wink" | "sleepy";

/** The glyph alone, for use inside a scene's own <svg>. Tip at origin. */
export function QuillGlyph({ mood = "neutral", scale = 1, ink = 1, className = "" }: { mood?: QuillMood; scale?: number; ink?: number; className?: string }) {
  const id = `q${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return <g className={`quill ${className}`} data-mood={mood} style={{ "--ink": ink } as CSSProperties}>
    <g className="quill-body" style={{ "--qs": scale } as CSSProperties}>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="-120" x2="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#2158d4"/><stop offset=".45" stopColor="#5f95f0"/><stop offset=".8" stopColor="#dbe8fb"/><stop offset="1" stopColor="#ffffff"/></linearGradient>
        <linearGradient id={`${id}-l`} x1="0" y1="-118" x2="0" y2="-55" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#bfe9fb"/><stop offset="1" stopColor="#7fb7f5"/></linearGradient>
        <linearGradient id={`${id}-w`} x1="0" y1="-70" x2="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#eef3fb"/></linearGradient>
      </defs>
      <path className="quill-shadow" d="M1 2C-9 -16 -18 -40 -17 -62C-16 -87 -6 -107 5 -120C17 -105 25 -80 22 -57C20 -35 10 -13 1 2Z" fill="#16202e" opacity=".08" transform="translate(3 3)"/>
      <path className="quill-outline" d="M0 0C-9 -18 -18 -40 -17 -62C-16 -87 -6 -107 4 -118C16 -104 24 -80 22 -57C20 -35 10 -14 0 0Z" fill={`url(#${id}-w)`}/>
      <path className="quill-feather" d="M-16 -58C-16 -85 -7 -106 4 -118C15 -105 22 -84 20 -60C14 -57 -2 -55 -16 -58Z" fill={`url(#${id}-b)`}/>
      <path className="quill-lobe" d="M1 -66C6 -92 14 -108 20 -112C25 -96 24 -78 17 -60C12 -60 6 -62 1 -66Z" fill={`url(#${id}-l)`} opacity=".9"/>
      <path className="quill-lobe" d="M-14 -72C-11 -92 -4 -106 3 -114C2 -100 -2 -84 -6 -70Z" fill="#a9d3fa" opacity=".7"/>
      <path className="quill-rachis" d="M0 -6C2 -40 3 -80 4 -114" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity=".7"/>
      <path className="quill-ink" d="M0 0C-5 -9 -9 -18 -9 -26C-4 -22 4 -22 9 -26C9 -18 5 -9 0 0Z" fill="#2158d4"/>
      <path className="quill-nib" d="M0 0L-3.2 -9L0 -7L3.2 -9Z" fill="#16306e"/>
      <g className="quill-face" transform="translate(0 -36)">
        <g className="eye-open"><ellipse cx="-6.5" cy="0" rx="3.1" ry="4.1" fill="#16202e"/><ellipse cx="6.5" cy="-1.5" rx="3.1" ry="4.1" fill="#16202e"/><circle cx="-5.6" cy="-1.6" r="1" fill="#fff"/><circle cx="7.4" cy="-3.1" r="1" fill="#fff"/></g>
        <g className="eye-happy" fill="none" stroke="#16202e" strokeWidth="2" strokeLinecap="round"><path d="M-9.5 1c1.8-3.6 4.8-3.6 6.4 0"/><path d="M3.3 -.5c1.8-3.6 4.8-3.6 6.4 0"/></g>
        <g className="eye-closed" fill="none" stroke="#16202e" strokeWidth="2" strokeLinecap="round"><path d="M-9.5 0.5c1.8 2.6 4.8 2.6 6.4 0"/><path d="M3.3 -1c1.8 2.6 4.8 2.6 6.4 0"/></g>
        <g className="eye-half"><ellipse cx="-6.5" cy="1" rx="3.1" ry="2.2" fill="#16202e"/><ellipse cx="6.5" cy="-.5" rx="3.1" ry="2.2" fill="#16202e"/></g>
        <g className="eye-wink"><ellipse cx="-6.5" cy="0" rx="3.1" ry="4.1" fill="#16202e"/><circle cx="-5.6" cy="-1.6" r="1" fill="#fff"/><path d="M3.3 -.5c1.8-3.6 4.8-3.6 6.4 0" fill="none" stroke="#16202e" strokeWidth="2" strokeLinecap="round"/></g>
        <g className="brow" fill="none" stroke="#16202e" strokeWidth="1.8" strokeLinecap="round"><path d="M-10.5 -7l6 1.6"/><path d="M4 -7.5l6 -1.6"/></g>
        <g className="brow-curious" fill="none" stroke="#16202e" strokeWidth="1.6" strokeLinecap="round"><path d="M3.5 -9.5q3.5 -2.5 7 -.5"/></g>
        <path className="mouth-smile" d="M-3.2 8.5q3.2 3.2 6.4 0" fill="none" stroke="#16202e" strokeWidth="1.7" strokeLinecap="round"/>
        <path className="mouth-flat" d="M-2.8 8.5h5.6" fill="none" stroke="#16202e" strokeWidth="1.7" strokeLinecap="round"/>
        <path className="mouth-open" d="M-3.5 7.5q3.5 6.5 7 0z" fill="#16202e"/>
        <circle className="mouth-o" cx="0" cy="9" r="2" fill="#16202e"/>
        <path className="mouth-smug" d="M-1.5 8.5q3.5 3 6.5 -.6" fill="none" stroke="#16202e" strokeWidth="1.7" strokeLinecap="round"/>
        <g className="blush" fill="#f4a3b0" opacity=".55"><ellipse cx="-12" cy="6" rx="2.6" ry="1.5"/><ellipse cx="12" cy="4.5" rx="2.6" ry="1.5"/></g>
        <g className="zzz" fill="none" stroke="#6390ec" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M10 -18h4l-4 4h4"/><path d="M15.5 -24h3l-3 3h3"/></g>
      </g>
    </g>
  </g>;
}

/** A standalone quill for HTML layouts (hero, wordmark, blocked screen). */
export function Quill({ mood = "neutral", size = 120, ink = 1, className = "", label, style }: { mood?: QuillMood; size?: number; ink?: number; className?: string; label?: string; style?: CSSProperties }) {
  return <svg viewBox="-70 -132 140 150" width={size} height={size * 150 / 140} className={`quill-svg ${className}`} style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <QuillGlyph mood={mood} ink={ink}/>
  </svg>;
}
