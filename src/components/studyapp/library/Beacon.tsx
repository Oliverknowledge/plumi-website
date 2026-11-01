"use client";

import { useEffect } from "react";
import { accountsOn, useAccount } from "@/lib/account";
import { useLibrary } from "@/lib/library";
import { social } from "@/lib/social/browser";
import { totalHere } from "@/lib/social/lobby";
import { roomIsOpen } from "@/lib/studyapp/library/roomOpen";
import { publishLive } from "@/lib/studyapp/live";

/**
 * Lets the Desk say "N revising" without the library page open: once a minute, for a student who has joined, it reads the
 * library servers' counts (`lobby_servers`: counts only, nothing about who; it does not put the student in any library)
 * and publishes the total. While the library page is open it stands aside: the page knows more (friends by name) and
 * publishes it. It never publishes a friend list: the server's counts do not say who, so `friendsIn` stays empty here
 * and the Study badge shows only what the page has seen.
 *
 * Mount it once in the app's layout if the Desk should show the number before the student has visited Study.
 */
const EVERY_MS = 60_000;

export function LibraryBeacon() {
  const { user } = useAccount();
  const lib = useLibrary();
  const uid = user?.id ?? null;
  const joined = !!lib.profile;

  useEffect(() => {
    if (!accountsOn || !uid || !joined) return;
    let dead = false;
    const read = async () => {
      if (dead || roomIsOpen()) return;
      const r = await social.lobbyServers();
      if (dead || roomIsOpen() || !r.ok) return;
      publishLive({ state: "ready", revising: totalHere(r.value), friendsIn: [] });
    };
    void read();
    const t = setInterval(() => void read(), EVERY_MS);
    return () => { dead = true; clearInterval(t); };
  }, [uid, joined]);
  return null;
}
