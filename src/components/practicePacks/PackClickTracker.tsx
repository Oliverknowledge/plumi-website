"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Reports every practice pack file a visitor opens, with one listener for the page (as
 * PaperClickTracker does for past papers), so the download buttons stay plain
 * server-rendered anchors wherever they sit.
 */
export function PackClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[data-pack]");
      if (!(link instanceof HTMLAnchorElement)) return;
      track("pack_downloaded", { pack: link.dataset.pack, file: link.dataset.file, placement: link.dataset.placement });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
