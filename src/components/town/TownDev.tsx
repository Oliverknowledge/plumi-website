"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "@/components/studyapp/toast";
import { STARTER, type PersonLook } from "@/lib/studyapp/library/people/look";
import { peopleStore } from "@/lib/studyapp/library/people/store";
import { ANIMAL_IDS } from "@/lib/studyapp/library/people/animals";
import { TOWN_ASSET_URLS, TOWN_DATA_URL } from "@/lib/town/assets.generated";
import { FADE_MS, initialPlace, stepPlace, type PlaceEffect, type PlaceEvent, type PlaceState } from "@/lib/town/place";
import type { AtlasName, Hub, TownData } from "@/lib/town/types";
import { Minimap, TELEPORT_COOLDOWN_S } from "./Minimap";
import { TownEngine, type PlayerArt } from "./TownEngine";

const Interior = lazy(() => import("./TownInterior"));
const preloadInterior = () => { void import("./TownInterior"); };

/**
 * The town's dev page (/study/town/dev): `?body=fox|capybara|...|person` (person is the default), `?bots=N`, `?debug=1` (collision cells, the navigation
 * grid, doors, sit spots, placeholders, the FPS and draw-ms HUD), `?furniture=0` (hide the placeholder furniture, drawn by default until the art exists),
 * `?map=0` (no minimap), `?hz=30|60|auto`, `?backing=0.5..1` (starts at a lower backing scale), `?tod=dawn|day|evening|night` (pins the hour's tint; absent: the student's own clock). It exposes the engine as `window.__town` and the place machine as `window.__townPlace` for the browser checks.
 *
 * DOORS. E at a door (or a tap on it) fades out in 0.35 s, mounts the room (the library's or the cafe's, on the fake world), and Escape, the Town button
 * or "Leave the library" fade back to the door you came in by, as the same body. The town engine is DISPOSED while you are inside (its chunk canvases, loops
 * and listeners go) and built again on the way out. Bakery, bookshop and cottage doors say "Closed for now". `src/lib/town/place.ts` is the state machine.
 */
const num = (v: string | null, d: number, max: number) => { const n = Number(v); return Number.isFinite(n) && v !== null ? Math.max(0, Math.min(max, Math.floor(n))) : d; };

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("image " + src)); i.src = src; });
}
interface Loaded { data: TownData; images: Record<AtlasName | "ground", CanvasImageSource>; premade: HTMLImageElement; font: string }

function Stage({ q }: { q: URLSearchParams }) {
  const cv = useRef<HTMLCanvasElement>(null), ov = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [engine, setEngine] = useState<TownEngine | null>(null);
  const [ps, setPs] = useState<PlaceState>(initialPlace);
  const stateRef = useRef<PlaceState>(initialPlace);
  const art = useRef<PlayerArt | null>(null);
  const live = useRef<TownEngine | null>(null);
  const [veil, setVeil] = useState(false), [quick, setQuick] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [phone, setPhone] = useState(false);
  const reduced = useRef(false);
  const t0 = useRef(0);

  // the page's one load: the map, the atlases and the premade people; your own body is built after the first frame
  useEffect(() => {
    let dead = false;
    t0.current = performance.now();
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      // the map and the atlases are asked for at the same time (the atlas urls are in assets.generated.ts); the cottage and cafe atlases are not waited for:
      // the first view is the library's plaza, and a sprite whose image has not arrived is simply not drawn yet (drawImage on an image still loading draws nothing)
      const FIRST = ["ground", "nature", "props", "landmark"] as const, LATER = ["cottage", "cafe"] as const;
      const urls = TOWN_ASSET_URLS as Record<string, string>;
      const first = Promise.all(FIRST.map((k) => load(urls[k])));
      const premadeP = load(urls.premade);
      const later = LATER.map((k) => { const i = new Image(); i.src = urls[k]; return i; });
      const data = (await (await fetch(TOWN_DATA_URL)).json()) as TownData;
      const [premade, imgs] = await Promise.all([premadeP, first]);
      if (dead) return;
      const images = { ...Object.fromEntries(FIRST.map((n, i) => [n, imgs[i]])), cottage: later[0], cafe: later[1] } as Loaded["images"];
      const font = getComputedStyle(document.body).getPropertyValue("--pa-font-digit").trim() || "ui-monospace, monospace";
      setLoaded({ data, images, premade, font: `${font}, ui-monospace, monospace` });
      (window as unknown as { __townT0?: number }).__townT0 = t0.current;
      const body = q.get("body") ?? "person", store = peopleStore();
      const look: PersonLook | null = ANIMAL_IDS.includes(body) ? { ...STARTER, species: body } : await store.ready().then(() => store.lookOf(null, 0, "town-you"));
      if (look && !dead) {
        const drawn = await store.make(look);
        if (drawn && !dead) { art.current = { img: drawn.sheet, img2: drawn.sheet2, sy: 0, fw: drawn.frame.w }; live.current?.setYou(art.current); }
      }
      if ("requestIdleCallback" in window) (window as unknown as { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(preloadInterior); else setTimeout(preloadInterior, 1500);
    })().catch(() => { /* the page shows an empty field; nothing to tell a student on a dev page */ });
    return () => { dead = true; };
  }, [q]);
  useEffect(() => {
    const on = () => setPhone(window.innerWidth < 560);
    on(); window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  /* the place machine: events in, effects out */
  const send = useCallback((e: PlaceEvent) => {
    const r = stepPlace(stateRef.current, e);
    stateRef.current = r.state; setPs(r.state);
    const fx: PlaceEffect = r.effect;
    if (fx?.t === "toast") toast(fx.text);
  }, []);
  useEffect(() => {
    (window as unknown as { __townPlace?: unknown }).__townPlace = { state: () => stateRef.current, send };
    return () => { delete (window as unknown as { __townPlace?: unknown }).__townPlace; };
  }, [send]);
  useEffect(() => {
    if (ps.phase === "idle") return;
    const t = setTimeout(() => send({ t: "fade-done" }), reduced.current ? 0 : FADE_MS);
    return () => clearTimeout(t);
  }, [ps.phase, ps.place, send]);

  /* the town engine lives only while you are in the town */
  const inTown = ps.place.kind === "town";
  useEffect(() => {
    const canvas = cv.current, overlay = ov.current;
    if (!inTown || !loaded || !canvas || !overlay) return;
    const { data } = loaded;
    const doorId = stateRef.current.door, door = doorId ? data.objects.find((o) => o.id === doorId)?.door : null;
    const eng = new TownEngine({
      canvas, overlay, data, images: loaded.images, premade: loaded.premade, premadeRows: data.premade.rows,
      bots: num(q.get("bots"), 0, 12), debug: q.get("debug") === "1", placeholders: q.get("furniture") !== "0", reduced: reduced.current, font: loaded.font,
      start: door ? { x: door.entry.x, y: door.entry.y + 12, dir: 3 } : undefined,
      hz: q.get("hz") ?? undefined,
      backing: q.get("backing") ? Number(q.get("backing")) : undefined,
      tod: ((v) => (v === "dawn" || v === "day" || v === "evening" || v === "night" ? v : undefined))(q.get("tod")),
      onEvent: (e) => { if (e.kind === "enter" || e.kind === "knock") send({ t: "door", id: e.id, kind: e.door ?? "cottage" }); },
    });
    if (art.current) eng.setYou(art.current);
    live.current = eng;
    (window as unknown as { __town?: TownEngine }).__town = eng;
    eng.start();
    setEngine(eng);
    return () => { eng.dispose(); live.current = null; setEngine(null); delete (window as unknown as { __town?: TownEngine }).__town; };
  }, [inTown, loaded, q, send]);

  /* hubs: walk, or teleport after a fade, then 8 seconds before the next */
  const walkHub = useCallback((h: Hub) => { if (!live.current?.walkTo(h.x, h.y)) toast("No way through right now"); }, []);
  const tp = useRef(0);
  const teleportHub = useCallback((h: Hub) => {
    if (cooldown > 0 || !live.current) return;
    setQuick(true); setVeil(true); setCooldown(TELEPORT_COOLDOWN_S);
    setTimeout(() => {
      const p = h.spawn[tp.current++ % h.spawn.length] ?? h;
      live.current?.teleport(p.x, p.y);
      setVeil(false); setTimeout(() => setQuick(false), 260);
    }, reduced.current ? 0 : 200);
  }, [cooldown]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const fill: React.CSSProperties = { position: "fixed", inset: 0, width: "100vw", height: "100dvh", display: "block", zIndex: 40 };
  const inside = ps.place.kind === "interior";
  return (
    <>
      <canvas ref={cv} style={{ ...fill, background: "#6d8f3c", touchAction: "none", imageRendering: "pixelated", visibility: inside ? "hidden" : "visible" }} aria-label="The town" />
      <canvas ref={ov} style={{ ...fill, pointerEvents: "none", visibility: inside ? "hidden" : "visible" }} aria-hidden />
      {engine && inTown && q.get("map") !== "0" && <Minimap engine={engine} hubs={engine.data.hubs} cooldown={cooldown} onWalkHub={walkHub} onTeleportHub={teleportHub} phone={phone} />}
      {inside && ps.place.kind === "interior" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#f2f7fd", overflow: "auto" }} data-testid="town-interior" data-interior={ps.place.id}>
          <Suspense fallback={null}><Interior id={ps.place.id} onExit={() => send({ t: "exit" })} /></Suspense>
        </div>
      )}
      <div className={`tw-veil${ps.phase === "fadeOut" || veil ? " is-on" : ""}${quick ? " is-quick" : ""}`} aria-hidden />
    </>
  );
}

function StageFor({ search }: { search: string }) {
  const q = useMemo(() => new URLSearchParams(search), [search]);
  return <Stage q={q} />;
}

export function TownDev() {
  const search = useSyncExternalStore(() => () => {}, () => window.location.search, () => null);
  if (search === null) return null;
  return <StageFor search={search} />;
}
