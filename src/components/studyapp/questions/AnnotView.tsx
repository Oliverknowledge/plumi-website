"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { REF_W, type Ink } from "@/lib/studyapp/questions/ink";
import { drawInk } from "@/lib/studyapp/questions/draw";
import { loadInk } from "@/lib/studyapp/questions/inkDb";

/** The marks, read-only, on the enlarged picture: drawn at the size the picture is now (and again if it changes). */
export function AnnotView({ inkKey }: { inkKey: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ink, setInk] = useState<Ink>([]);
  useEffect(() => { let live = true; void loadInk(inkKey).then((i) => { if (live) setInk(i); }); return () => { live = false; }; }, [inkKey]);
  useLayoutEffect(() => {
    const el = wrap.current, c = canvas.current;
    if (!el || !c) return;
    const paint = () => {
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
      const d = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const cw = Math.round(w * d), ch = Math.round(h * d);
      if (cw * ch > 40_000_000) return;
      c.width = cw; c.height = ch;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, cw, ch);
      drawInk(ctx, ink, (w / REF_W) * d);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ink]);
  return <div ref={wrap} className="qs-annot-view" aria-hidden="true"><canvas ref={canvas} /></div>;
}
