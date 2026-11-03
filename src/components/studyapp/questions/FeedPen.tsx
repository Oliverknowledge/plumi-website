"use client";

import type { QPrefs } from "@/lib/studyapp/questions/model";
import { useInkCaps } from "./inkBus";
import { PenTray } from "./PenTray";

/**
 * The pen tray for the feed: only after a writing space has been used (a pen, a mouse or a finger on one), so it never covers a picture or writing the student
 * has not reached for it on; the stylesheet puts it in the left margin of a wide screen and hides it while a mark scheme is open.
 */
export function FeedPen({ prefs }: { prefs: QPrefs }) {
  const caps = useInkCaps();
  if (!caps.key?.startsWith("feed-")) return null;
  return <div className="qf-pen"><PenTray prefs={prefs} /></div>;
}
