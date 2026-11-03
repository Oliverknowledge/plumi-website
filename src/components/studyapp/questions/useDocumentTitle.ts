"use client";

import { useEffect } from "react";

/**
 * The tab's title while this view is on screen ("Set done, Forces · Plumi"), and the page's own title again when it leaves.
 * The framework writes the route's title into <head> after a page mounts, so the title element is watched and ours put back.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    const put = () => { if (document.title !== title) document.title = title; };
    put();
    const el = document.querySelector("title");
    const watch = el ? new MutationObserver(put) : null;
    watch?.observe(el as Node, { childList: true, characterData: true, subtree: true });
    return () => { watch?.disconnect(); document.title = before; };
  }, [title]);
}
