"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TILE, type DoorKind, type Hub, type TownData } from "@/lib/town/types";
import { allObjects } from "@/lib/town/objects";
import { unrle } from "@/lib/town/plan";
import type { TownEngine } from "./TownEngine";

/**
 * The minimap and the hubs (dev page only, docs/study/town.md "Navigation aids"). A baked low resolution map (one pixel per 8 px cell of the
 * ground material, trees as dots, landmarks as little houses), a live layer on top (you as an arrow, the bots as dots, the camera's rectangle,
 * the place you asked to walk to), a click or tap to walk there, a tooltip with the building's name on hover, and the hubs: Library, Cafe, Bakery,
 * Bookshop, Plaza, Park, each a Walk button and a Teleport button with an 8 second cooldown (the page does the fade). Desktop: a corner panel.
 * Phone: a button that opens a sheet. Touch targets are 44 px; the canvas has a name and the hubs are the keyboard's way in.
 */
export const TELEPORT_COOLDOWN_S = 8;
const COLOUR: Record<DoorKind, string> = { library: "#2c4a7a", cafe: "#d9772b", bakery: "#b8442e", bookshop: "#46618f", cottage: "#8b5a3a" };
const GRASS = [185, 209, 122], PATH = [232, 207, 154], PLAZA = [243, 230, 192];

export function bakeMinimap(d: TownData): HTMLCanvasElement {
  const { cols, rows } = d.mat, cv = document.createElement("canvas");
  cv.width = cols; cv.height = rows;
  const c = cv.getContext("2d")!, img = c.createImageData(cols, rows), mat = unrle(d.mat.rle, cols * rows);
  for (let i = 0; i < mat.length; i++) { const k = mat[i] === 1 ? PATH : mat[i] === 2 ? PLAZA : GRASS; img.data[i * 4] = k[0]; img.data[i * 4 + 1] = k[1]; img.data[i * 4 + 2] = k[2]; img.data[i * 4 + 3] = 255; }
  c.putImageData(img, 0, 0);
  const cell = TILE / 4;
  for (const o of allObjects(d)) {
    if (o.zone === "treeline") continue;
    const x = o.x / cell, y = o.y / cell;
    if (o.kind === "tree") { c.fillStyle = "#c98a2b"; c.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 2); }
    else if (o.kind === "bush" || o.kind === "log") { c.fillStyle = "#9a9a3a"; c.fillRect(Math.round(x), Math.round(y) - 1, 1, 1); }
  }
  for (const o of d.objects) {
    if (o.kind !== "building" || !o.door) continue;
    const big = o.door.kind !== "cottage", sp = d.sprites[o.sprite as string];
    const w = Math.round((big ? sp.w : sp.w * 0.7) / cell), h = Math.round((big ? Math.min(sp.h, 150) : sp.h * 0.6) / cell), x = Math.round(o.x / cell - w / 2), y = Math.round(o.y / cell - h);
    c.fillStyle = COLOUR[o.door.kind]; c.fillRect(x, y + 3, w, h - 3);
    c.beginPath(); c.moveTo(x - 1, y + 3); c.lineTo(x + w / 2, y - 1); c.lineTo(x + w + 1, y + 3); c.closePath(); c.fillStyle = "#3a2a22"; c.fill();
    c.fillStyle = "#fff4d6"; c.fillRect(Math.round(x + w / 2 - 1), y + h - 3, 2, 3);
  }
  return cv;
}

const Icon = {
  map: (<svg className="tw-ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5l5-2 4 2 5-2v12l-5 2-4-2-5 2z M8 3v12 M12 5v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>),
  close: (<svg className="tw-ico" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /></svg>),
  walk: (<svg className="tw-ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h10 M10 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  jump: (<svg className="tw-ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M11 2L4 11h5l-1 7 7-9h-5z" fill="currentColor" /></svg>),
};

export function Minimap({ engine, hubs, cooldown, onWalkHub, onTeleportHub, phone }: {
  engine: TownEngine; hubs: Hub[]; cooldown: number; onWalkHub: (h: Hub) => void; onTeleportHub: (h: Hub) => void; phone: boolean;
}) {
  const d = engine.data;
  const base = useRef<HTMLCanvasElement | null>(null), dyn = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null), baked = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem("plumi-town-map"); return v === null ? !phone : v === "1"; } catch { return !phone; } });
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const dest = useRef<{ x: number; y: number; t: number } | null>(null);
  const names = useRef<{ x: number; y: number; w: number; h: number; label: string }[]>([]);
  const remember = (v: boolean) => { setOpen(v); try { localStorage.setItem("plumi-town-map", v ? "1" : "0"); } catch { /* private window: the map just opens as usual */ } };

  // the baked layer, once per engine
  useEffect(() => {
    const cv = base.current;
    if (!cv || !open) return;
    baked.current = baked.current ?? bakeMinimap(d);
    cv.width = baked.current.width; cv.height = baked.current.height;
    cv.getContext("2d")!.drawImage(baked.current, 0, 0);
    names.current = d.objects.filter((o) => o.door && o.door.kind !== "cottage").map((o) => { const sp = d.sprites[o.sprite as string]; return { x: (o.x - sp.anchorX) / 8, y: (o.y - sp.anchorY) / 8, w: sp.w / 8, h: sp.h / 8, label: o.door!.label }; })
      .concat(d.plazas.filter((p) => /grove|meadow|park|clearing/.test(p.id)).map((p) => ({ x: p.rect.x / 8, y: p.rect.y / 8, w: p.rect.w / 8, h: p.rect.h / 8, label: p.id.replace(/-clearing$/, "").replace(/-/g, " ").replace(/^./, (s) => s.toUpperCase()) })));
  }, [d, open]);

  // the live layer, 8 times a second (the engine is read, not rendered through React)
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      const cv = dyn.current, host = base.current;
      if (!cv || !host) return;
      if (cv.width !== Math.round(host.width * 1.5)) { cv.width = Math.round(host.width * 1.5); cv.height = Math.round(host.height * 1.5); }
      const c = cv.getContext("2d")!, S = 1.5 / 8;      // art px -> dyn px: one cell (8 art px) is 1.5 dyn px (the live layer is small: it is redrawn 8 times a second)
      c.clearRect(0, 0, cv.width, cv.height);
      const v = engine.viewRect();
      c.strokeStyle = "#fff"; c.lineWidth = 1.6; c.strokeRect(v.x * S, v.y * S, v.w * S, v.h * S);
      c.strokeStyle = "#22304d"; c.lineWidth = 0.8; c.strokeRect(v.x * S - 1, v.y * S - 1, v.w * S + 2, v.h * S + 2);
      for (const b of engine.botPositions()) { c.beginPath(); c.arc(b.x * S, (b.y - 8) * S, 2.2, 0, 7); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 1; c.strokeStyle = "#22304d"; c.stroke(); }
      const t = dest.current;
      if (t) { const k = (performance.now() - t.t) / 1400; if (k >= 1) dest.current = null; else { c.beginPath(); c.arc(t.x * S, t.y * S, 2 + 8 * k, 0, 7); c.lineWidth = 1.4; c.strokeStyle = `rgba(217,119,43,${1 - k})`; c.stroke(); c.beginPath(); c.arc(t.x * S, t.y * S, 1.8, 0, 7); c.fillStyle = "#d9772b"; c.fill(); } }
      const p = engine.youPos(), x = p.x * S, y = (p.y - 8) * S, a = p.dir === "right" ? 0 : p.dir === "front" ? Math.PI / 2 : p.dir === "left" ? Math.PI : -Math.PI / 2;
      c.save(); c.translate(x, y); c.rotate(a);
      c.beginPath(); c.moveTo(5, 0); c.lineTo(-3.5, -3.6); c.lineTo(-1.6, 0); c.lineTo(-3.5, 3.6); c.closePath();
      c.fillStyle = "#f2c96b"; c.fill(); c.lineWidth = 1.3; c.strokeStyle = "#22304d"; c.lineJoin = "round"; c.stroke(); c.restore();
    }, 125);
    return () => clearInterval(id);
  }, [engine, open]);

  const toWorld = useCallback((e: { clientX: number; clientY: number }) => {
    const r = (dyn.current ?? base.current)!.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    return { x: fx * d.cols * TILE, y: fy * d.rows * TILE, fx, fy, w: r.width };
  }, [d]);

  const move = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    const p = toWorld(e), cx = p.x / 8, cy = p.y / 8;
    const hit = names.current.find((n) => cx >= n.x - 2 && cx <= n.x + n.w + 2 && cy >= n.y - 2 && cy <= n.y + n.h + 2);
    const r = box.current!.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: hit ? `${hit.label}: walk here` : "Walk here" });
  };
  const go = (e: React.PointerEvent) => {
    const p = toWorld(e);
    if (engine.walkTo(p.x, p.y)) dest.current = { x: p.x, y: p.y, t: performance.now() };
    if (e.pointerType === "touch") setTip(null);
  };

  const panel = (
    <div className={`tw-panel${phone ? " tw-sheet" : ""}`} role="region" aria-label="Town map">
      <div className="tw-head"><span>Town map</span><button type="button" className="btn" aria-label="Close the map" onClick={() => remember(false)}>{Icon.close}</button></div>
      <div className="tw-mapwrap" ref={box} onPointerLeave={() => setTip(null)}>
        <canvas ref={base} role="img" aria-label="Map of the town. Click or tap a place to walk there; the places below do the same." onPointerMove={move} onPointerUp={go} data-testid="town-minimap" />
        <canvas ref={dyn} className="tw-dyn" aria-hidden />
        {tip && <span className="tw-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</span>}
      </div>
      <div className="tw-hubs">
        {hubs.map((h) => (
          <div className="tw-hub" key={h.id}>
            <button type="button" className="btn tw-walk" aria-label={`Walk to the ${h.label}`} onClick={() => { onWalkHub(h); if (phone) remember(false); }} data-testid={`hub-walk-${h.id}`}><span>{h.label}</span></button>
            <button type="button" className="btn tw-jump" aria-label={cooldown > 0 ? `Teleport to the ${h.label}, ready in ${cooldown} seconds` : `Teleport to the ${h.label}`} disabled={cooldown > 0} onClick={() => { onTeleportHub(h); if (phone) remember(false); }} data-testid={`hub-jump-${h.id}`}>
              {cooldown > 0 ? <span className="tw-cd">{cooldown}</span> : Icon.jump}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="tw-map" data-testid="town-map" data-open={open || undefined}>
      {open ? panel : <button type="button" className="btn tw-fab" aria-label="Open the town map" onClick={() => remember(true)} data-testid="town-map-open">{Icon.map}<span className="lb-hlab">Map</span></button>}
    </div>
  );
}
