"use client";

import { AnnotView } from "./AnnotView";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

/**
 * One picture from the paper (a question, its setup, its mark scheme). Three jobs the bare <img> did not do:
 *  - Say so when it cannot load: a calm line, "Try again", and the PDF where there is one, never a broken-image icon.
 *    A failure (404, garbage, a connection that drops, or one that hangs for 20 s) is tried once more by itself after a moment,
 *    again when the device comes back online, and by the button.
 *  - Keep its place: the part's own size is known (`w`, `h`); for the others the size seen last time is remembered on the device,
 *    so nothing below jumps when the picture arrives. (The first time, before it is known, a placeholder of a typical shape is shown.)
 *  - Show a quiet placeholder until it has loaded.
 */
const DIM_KEY = "plumi-study-crops";
const DIM_MAX = 300;
const dims = new Map<string, number>();
let dimsRead = false;

function readDims() {
  if (dimsRead || typeof window === "undefined") return;
  dimsRead = true;
  try {
    const j = JSON.parse(localStorage.getItem(DIM_KEY) ?? "{}") as Record<string, unknown>;
    for (const [k, v] of Object.entries(j)) if (typeof v === "number" && v > 0.05 && v < 40) dims.set(k, v);
  } catch { /* nothing remembered */ }
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function rememberRatio(url: string, ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return;
  dims.delete(url);
  dims.set(url, Math.round(ratio * 1000) / 1000);
  while (dims.size > DIM_MAX) dims.delete(dims.keys().next().value as string);
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { localStorage.setItem(DIM_KEY, JSON.stringify(Object.fromEntries(dims))); } catch { /* full: next time it is measured again */ }
  }, 1500);
}

const withTry = (src: string, n: number) => (n === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}r=${n}`);

export interface CropProps {
  src: string;
  alt: string;
  /** The picture's own size, when the data has it. */
  w?: number;
  h?: number;
  className?: string;
  /** "the question picture", "the mark scheme": what the failure line names. */
  what?: string;
  /** Where the PDF is, if there is one to open instead. */
  pdf?: string;
  /** The opening words, shown in place of a picture that will not load. */
  words?: string;
  /** A shape for the placeholder when the size is not known yet (width over height). */
  guess?: number;
  eager?: boolean;
  /** A tap opens the picture large, scrollable and pinchable (a phone shows a question's printed words at 6 to 7 px). */
  zoom?: boolean;
  /** Drawn over the picture, filling it (the student's marks on a question). */
  overlay?: React.ReactNode;
  /** The ink key of marks to show, read-only, on the enlarged picture. */
  marksKey?: string;
  /** Told when the picture loads or gives up, for a mark scheme that must be seen before marking. */
  onState?(s: "ok" | "fail"): void;
}

export function Crop(props: CropProps) { return <CropInner key={props.src} {...props} />; }

function CropInner({ src, alt, w, h, className, what = "this question picture", pdf, words, guess = 3.2, eager, zoom, onState, overlay, marksKey }: CropProps) {
  readDims();
  const [big, setBig] = useState(false);
  const [st, setSt] = useState<"loading" | "ok" | "fail">("loading");
  const [n, setN] = useState(0);
  const [near, setNear] = useState(!!eager);
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const tell = useRef(onState);
  useEffect(() => { tell.current = onState; });
  const known = w && h ? w / h : dims.get(src);

  const failed = () => {
    if (n === 0) { setTimeout(() => setN((v) => (v === 0 ? 1 : v)), 1500); return; }
    setSt("fail"); tell.current?.("fail");
  };
  const loaded = (el: HTMLImageElement) => {
    if (!el.naturalWidth) { failed(); return; }
    rememberRatio(src, el.naturalWidth / el.naturalHeight);
    setSt("ok"); tell.current?.("ok");
  };

  // Already there before this ran (the cache, or the page was drawn first).
  useEffect(() => { const el = img.current; if (st === "loading" && el?.complete) { if (el.naturalWidth) loaded(el); else failed(); } });
  // Near the screen and still waiting after 20 seconds: treat it as failed.
  useEffect(() => {
    const el = box.current;
    if (!el || eager) return;
    const io = new IntersectionObserver((es) => { const e = es[es.length - 1]; if (e) setNear(e.isIntersecting); }, { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);
  useEffect(() => {
    if (st !== "loading" || !near) return;
    const t = setTimeout(() => { setSt("fail"); tell.current?.("fail"); }, 20_000);
    return () => clearTimeout(t);
  }, [st, near, n]);
  // Failed, and the device comes back online: try once more.
  useEffect(() => {
    if (st !== "fail") return;
    const on = () => { setN((v) => v + 1); setSt("loading"); };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [st]);

  const retry = () => { setN((v) => v + 1); setSt("loading"); };
  const zoomable = !!zoom && st === "ok";
  return (
    <>
    <div
      ref={box} className={`qs-cropbox${st === "ok" ? " is-ok" : ""}${st === "fail" ? " is-fail" : ""}${zoomable ? " is-zoomable" : ""}`}
      style={st === "loading" && !known ? { aspectRatio: String(guess) } : undefined} onClick={zoomable ? () => setBig(true) : undefined}
    >
      {st !== "fail" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img} key={n} className={`qs-crop${className ? ` ${className}` : ""}`} src={withTry(src, n)} alt={alt} width={w} height={h}
          style={known ? { aspectRatio: String(known) } : undefined} loading={eager ? "eager" : "lazy"} decoding="async"
          onLoad={(e) => loaded(e.currentTarget)} onError={failed}
        />
      )}
      {st !== "fail" && overlay}
      {st === "loading" && <span className="qs-cropwait" aria-hidden="true" />}
      {st === "fail" && (
        <div className="qs-cropfail" role="status">
          <p className="qs-cropfail-line">Could not load {what}.</p>
          {words ? <p className="qs-cropfail-words">{words}</p> : null}
          <div className="qs-cropfail-acts">
            <button type="button" className="qs-mini" onClick={retry} data-testid="crop-retry">Try again</button>
            {pdf ? <a className="qs-link" href={pdf} target="_blank" rel="noopener noreferrer">Open the PDF</a> : null}
          </div>
        </div>
      )}
      {zoomable && (
        <button type="button" className="qs-zoom" aria-label={`Zoom in on ${what}`} onClick={(e) => { e.stopPropagation(); setBig(true); }} data-testid="crop-zoom"><SearchIcon /><span className="qs-zoom-t" aria-hidden="true">Zoom</span></button>
      )}
    </div>
    {big && <ZoomDialog src={withTry(src, n)} alt={alt} fit={/mark scheme/.test(what)} marksKey={marksKey} onClose={() => setBig(false)} />}
    </>
  );
}

/** The picture large: a native modal dialog, scrollable both ways (and pinchable), closed by its button, Escape or a tap outside. */
/** `fit`: a mark scheme's table opens fitted to the width (its columns are read across), a question opens large and pans. */
function ZoomDialog({ src, alt, fit, marksKey, onClose }: { src: string; alt: string; fit?: boolean; marksKey?: string; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const close = () => { const d = ref.current; if (d?.open) d.close(); else onClose(); };
  // On a touch screen, once: one line that the picture can be dragged (a "[3 marks]" at the edge is otherwise cut off with no hint that there is more).
  const [hint, setHint] = useState(() => {
    try { return window.matchMedia("(pointer: coarse)").matches && localStorage.getItem("plumi-zoom-hint") === null; } catch { return false; }
  });
  useEffect(() => {
    if (!hint) return;
    try { localStorage.setItem("plumi-zoom-hint", "1"); } catch { /* shown again next time */ }
    const t = setTimeout(() => setHint(false), 5000);
    return () => clearTimeout(t);
  }, [hint]);
  return (
    <dialog ref={ref} className={`qs-zoomd${fit ? " is-fit" : ""}`} aria-label="The picture, larger" onClose={onClose} onClick={(e) => { if (e.target === ref.current) close(); }} data-testid="crop-zoom-dialog">
      <button type="button" className="btn ghost icon qs-zoomd-close" aria-label="Close" onClick={close} autoFocus><CloseIcon /></button>
      {hint && <p className="qs-zoomd-hint" role="status">Drag to look around</p>}
      <div className="qs-zoomd-body" tabIndex={0} role="region" aria-label="Scrolls sideways and down">
        <div className="qs-zoomd-pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qs-zoomd-img" src={src} alt={alt} />
          {marksKey && <AnnotView inkKey={marksKey} />}
        </div>
      </div>
    </dialog>
  );
}
