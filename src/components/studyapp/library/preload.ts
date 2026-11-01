"use client";

import { preloadRoom, type PreloadReport } from "@/lib/studyapp/library/entry";
import { peopleStore } from "@/lib/studyapp/library/people/store";
import type { SocialAvatar } from "@/lib/social/types";

/**
 * The browser's side of `preloadRoom`: the room engine's chunk (and the walking maths it loads beside it), its pictures (fetched and decoded, and kept so the engine's
 * own request is answered from memory), its layout, the people layers, and this student's own person built ahead, so the
 * room's first frame has nobody changing in it. Run once per page; a failed file is tried again the next time.
 */
const held: HTMLImageElement[] = [];
let once: Promise<PreloadReport> | null = null;

function picture(url: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { held.push(im); (im.decode ? im.decode() : Promise.resolve()).catch(() => { /* drawn on demand instead */ }).finally(() => resolve(true)); };
    im.onerror = () => reject(new Error(url));
    im.src = url;
  });
}

export function preloadEntry(you?: { avatar: SocialAvatar | null; colour: number; id: string }): Promise<PreloadReport> {
  once ??= preloadRoom({
    engine: () => Promise.all([import("@/components/landing/cafeScene"), import("@/lib/studyapp/library/walk")]),
    image: picture,
    json: (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); }),
    people: () => peopleStore().ready(),
  }).then((r) => { if (r.failed.length) once = null; return r; });
  const mine = once;
  if (you) {
    void mine.then(async () => {
      const store = peopleStore();
      const look = store.lookOf(you.avatar, you.colour, you.id);
      if (look) await store.make(look);
    }).catch(() => { /* the room builds it itself */ });
  }
  return mine;
}
