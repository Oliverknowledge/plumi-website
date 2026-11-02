import type { LibrarySession } from "./session";

/**
 * What the page tells the visit about itself, so the visit can keep the server's picture of the student true:
 *
 *   pagehide          the tab is closing or going into the back/forward cache: leave now. Nothing else on the page runs
 *                     in time, which is why the leave is a request that outlives the page (farewell.ts). Before this the
 *                     student stayed on the others' screens for the 30 seconds the server waits.
 *   pageshow          coming back from the back/forward cache: go in again.
 *   visibilitychange  the tab is put in the background (only the position goes out) or brought back (everything is read
 *                     at once). A hidden tab is NOT left: a student who sits with the timer running and works in another
 *                     tab is still in the library.
 *   online / resume   the network came back, or the browser thawed the page: the same as being brought back.
 *   input             any key, tap or movement tells the visit the student is here; ten minutes of none (and no study
 *                     timer running) ends the visit with an offer to rejoin.
 *
 * Returns what takes the listeners off again.
 */
export function bindPage(session: LibrarySession, env: { win?: Window; doc?: Document } = {}): () => void {
  const win = env.win ?? window, doc = env.doc ?? document;
  const shown = () => doc.visibilityState !== "hidden";
  const hide = () => session.pageHidden();
  const show = (e: Event) => session.pageShown((e as PageTransitionEvent).persisted === true);
  const see = () => session.visible(shown());
  const back = () => { if (shown()) session.visible(true); };
  const touch = () => session.touch();
  const touches = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
  for (const t of touches) win.addEventListener(t, touch, { passive: true });
  win.addEventListener("pagehide", hide);
  win.addEventListener("pageshow", show);
  win.addEventListener("online", back);
  doc.addEventListener("visibilitychange", see);
  doc.addEventListener("resume", back);
  if (!shown()) session.visible(false);
  return () => {
    for (const t of touches) win.removeEventListener(t, touch);
    win.removeEventListener("pagehide", hide);
    win.removeEventListener("pageshow", show);
    win.removeEventListener("online", back);
    doc.removeEventListener("visibilitychange", see);
    doc.removeEventListener("resume", back);
  };
}
