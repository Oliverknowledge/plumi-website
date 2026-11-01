"use client";

import { useState } from "react";
import { demoDriver, type DemoOptions } from "@/lib/studyapp/library/demo";
import { LibraryRoom } from "./Library";

/** `?people=40&friends=30` or `?friends=none` (what the browser checks add to the scripted world). Nothing on the server render. */
function demoOptions(): DemoOptions {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && v > 0 ? Math.min(150, Math.floor(v)) : undefined; };
  return { people: n("people"), friends: q.get("friends") === "none" ? "none" : n("friends") };
}

/** The real room and panel on a scripted world (dev only: see library/demo/page.tsx). */
export function DemoLibrary() {
  const [driver] = useState(() => demoDriver(demoOptions()));
  return <LibraryRoom driver={driver} onLeave={async () => true} />;
}
