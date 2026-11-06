"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Reports every booklet opened from /maths-booklets, with one listener for the page (as PaperClickTracker
 * does for past papers): the links stay plain server-rendered anchors. `booklet_opened` carries the page,
 * the booklet, its group and which file (`full`, or `questions` for the questions-only version).
 */
export function BookletClickTracker({ page }: { page: string }) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[data-booklet]");
      if (!(link instanceof HTMLAnchorElement)) return;
      track("booklet_opened", { page, booklet: link.dataset.booklet, group: link.dataset.group, kind: link.dataset.kind });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [page]);
  return null;
}
