"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Reports every past paper a visitor opens, with one listener for the whole page
 * rather than a client component per link: a board page has hundreds of links,
 * and they stay plain server-rendered anchors.
 *
 * `paper_opened` carries which page, paper, session and kind of file, so "which
 * papers bring people in" and "do people who open mark schemes go on to the App
 * Store" are questions with answers.
 */
export function PaperClickTracker({ page }: { page: string }) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[data-paper]");
      if (!(link instanceof HTMLAnchorElement)) return;
      track("paper_opened", {
        page,
        paper: link.dataset.paper,
        kind: link.dataset.kind,
        session: link.dataset.session,
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [page]);
  return null;
}
