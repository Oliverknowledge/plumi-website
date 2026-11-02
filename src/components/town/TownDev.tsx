"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { toast } from "@/components/studyapp/toast";
import { STARTER, type PersonLook } from "@/lib/studyapp/library/people/look";
import { peopleStore } from "@/lib/studyapp/library/people/store";
import { ANIMAL_IDS } from "@/lib/studyapp/library/people/animals";
import { TOWN_DATA_URL } from "@/lib/town/assets.generated";
import type { AtlasName, TownData } from "@/lib/town/types";
import { TownEngine } from "./TownEngine";

/**
 * The town's dev page (/study/town/dev): `?body=fox|capybara|...|person` (person is the default), `?bots=N`, `?debug=1` (collision cells, the navigation
 * grid, doors, sit spots, placeholders, the FPS and draw-ms HUD), `?furniture=0` (hide the placeholder furniture, drawn by default until the art exists).
 * It exposes the engine as `window.__town` for the browser checks.
 */
const num = (v: string | null, d: number, max: number) => { const n = Number(v); return Number.isFinite(n) && v !== null ? Math.max(0, Math.min(max, Math.floor(n))) : d; };

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("image " + src)); i.src = src; });
}

function Stage({ q }: { q: URLSearchParams }) {
  const cv = useRef<HTMLCanvasElement>(null), ov = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = cv.current, overlay = ov.current;
    if (!canvas || !overlay) return;
    let dead = false;
    let engine: TownEngine | null = null;
    (async () => {
      const t0 = performance.now();
      const data = (await (await fetch(TOWN_DATA_URL)).json()) as TownData;
      const [premade, ...imgs] = await Promise.all([load(data.premade.url), ...(["ground", "nature", "cafe", "cottage", "props"] as const).map((k) => load(data.atlases[k].url))]);
      if (dead) return;
      const names: (AtlasName | "ground")[] = ["ground", "nature", "cafe", "cottage", "props"];
      const images = Object.fromEntries(names.map((n, i) => [n, imgs[i]])) as Record<AtlasName | "ground", CanvasImageSource>;
      const font = getComputedStyle(document.body).getPropertyValue("--pa-font-digit").trim() || "ui-monospace, monospace";
      engine = new TownEngine({
        canvas, overlay, data, images, premade, premadeRows: data.premade.rows,
        bots: num(q.get("bots"), 0, 12), debug: q.get("debug") === "1", placeholders: q.get("furniture") !== "0", reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        font: `${font}, ui-monospace, monospace`,
        onEvent: (e) => {
          if (e.kind === "knock") toast("Knock knock.");
          else if (e.kind === "enter") toast("The cafe opens soon.");
        },
      });
      (window as unknown as { __town?: TownEngine; __townT0?: number }).__town = engine;
      (window as unknown as { __townT0?: number }).__townT0 = t0;
      engine.start();
      // you: the animal or the person asked for, built after the first frame (the premade person stands in)
      const body = q.get("body") ?? "person";
      const store = peopleStore();
      const look: PersonLook | null = ANIMAL_IDS.includes(body) ? { ...STARTER, species: body } : await store.ready().then(() => store.lookOf(null, 0, "town-you"));
      if (look && !dead) {
        const drawn = await store.make(look);
        if (drawn && !dead) engine.setYou({ img: drawn.sheet, sy: 0, fw: drawn.frame.w });
      }
    })().catch(() => { /* the page shows an empty field; nothing to tell a student on a dev page */ });
    return () => { dead = true; engine?.dispose(); delete (window as unknown as { __town?: TownEngine }).__town; };
  }, [q]);
  const fill: React.CSSProperties = { position: "fixed", inset: 0, width: "100vw", height: "100dvh", display: "block", zIndex: 40 };
  return (
    <>
      <canvas ref={cv} style={{ ...fill, background: "#6d8f3c", touchAction: "none", imageRendering: "pixelated" }} aria-label="The town" />
      <canvas ref={ov} style={{ ...fill, pointerEvents: "none" }} aria-hidden />
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
