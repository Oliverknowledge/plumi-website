"use client";

import type { QPrefs } from "@/lib/studyapp/questions/model";
import { useInkCaps, useInkZoneVisible } from "./inkBus";
import { PenTray } from "./PenTray";

/**
 * The pen tray for the feed: only after a writing space has been used (a pen, a mouse or a finger on one), so it never covers a picture or writing the student
 * has not reached for it on; the stylesheet puts it in the left margin of a wide screen. Where it lies along the foot of the screen, it stands aside while a mark scheme is on the screen (see Check).
 */
export function FeedPen({ prefs, subject }: { prefs: QPrefs; subject?: string | null }) {
  const caps = useInkCaps();
  const here = useInkZoneVisible();
  // (the tray is there once the student has touched an answer here, or while a picture they can mark up, or an answer, is on the screen)
  if (!caps.key?.startsWith("feed-") && !here) return null;
  return <div className="qf-pen"><PenTray prefs={prefs} subject={subject} /></div>;
}
