"use client";

import { useCallback, useEffect, useState } from "react";
import type { Angles } from "@/lib/studyapp/questions/angles";
import { getAngles, peekAngles } from "@/lib/studyapp/questions/anglesLoad";

export type AnglesState = { state: "idle" } | { state: "loading" } | { state: "failed"; retry(): void } | { state: "ready"; data: Angles };

/** A subject's Angles data, asked for only once `wanted` (a Pro student opened an Angles panel). One quiet second go if it fails, then "failed" with a retry. */
export function useAngles(slug: string | null, wanted: boolean): AnglesState {
  const [got, setGot] = useState<{ slug: string; res: Angles | "failed" } | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!slug || !wanted) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    getAngles(slug)
      .then((res) => { if (live) setGot({ slug, res }); })
      .catch(() => {
        if (!live) return;
        if (tries === 0) timer = setTimeout(() => { if (live) setTries(1); }, 1500);
        else setGot({ slug, res: "failed" });
      });
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [slug, wanted, tries]);
  const retry = useCallback(() => { setGot(null); setTries((t) => t + 1); }, []);
  const cached = slug ? peekAngles(slug) : null;
  if (cached) return { state: "ready", data: cached };
  if (!slug || (!wanted && (!got || got.slug !== slug))) return { state: "idle" };
  if (got && got.slug === slug) return got.res === "failed" ? { state: "failed", retry } : { state: "ready", data: got.res };
  return { state: "loading" };
}
