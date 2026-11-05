"use client";

import { useCallback, useEffect, useState } from "react";
import { getInsights, peekInsights, type Loaded } from "@/lib/studyapp/questions/insightsLoad";

export type InsightsState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "failed"; retry(): void }
  | ({ state: "ready" } & Loaded);

const IDLE: InsightsState = { state: "idle" };
const LOADING: InsightsState = { state: "loading" };

/**
 * A subject's topic analysis, asked for only once `wanted` (a remembered form filter, the filters opened, the analysis opened). Until then it is idle and nothing is fetched. One quiet second
 * go if it fails; after that it says failed and offers a retry (the feed then simply does not apply the form filter, and says so).
 */
export function useInsights(slug: string | null, wanted: boolean): InsightsState {
  const [got, setGot] = useState<{ slug: string; res: Loaded | "failed" } | null>(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!slug || !wanted) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    getInsights(slug)
      .then((res) => { if (live) setGot({ slug, res }); })
      .catch(() => {
        if (!live) return;
        if (tries === 0) timer = setTimeout(() => { if (live) setTries(1); }, 1500);
        else setGot({ slug, res: "failed" });
      });
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [slug, wanted, tries]);
  const retry = useCallback(() => { setGot(null); setTries((t) => t + 1); }, []);
  const cached = slug ? peekInsights(slug) : null;
  if (cached) return { state: "ready", ...cached };
  if (!slug || (!wanted && (!got || got.slug !== slug))) return IDLE;
  if (got && got.slug === slug) return got.res === "failed" ? { state: "failed", retry } : { state: "ready", ...got.res };
  return LOADING;
}
