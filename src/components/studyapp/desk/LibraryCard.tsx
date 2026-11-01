"use client";

import Link from "next/link";
import { useAccount, signInHref } from "@/lib/account";
import { colourOf } from "@/lib/library";
import { useAppHref } from "@/lib/studyapp/host";
import { useLiveSummary, type LiveFriend } from "@/lib/studyapp/live";

/**
 * The Desk's door into the Grand Library: the room, how many are revising, and which friends are in. It says
 * only what the app knows. Not signed in, or not joined, it says how to get in and shows no number; a count
 * appears once the library itself has asked the server (src/lib/studyapp/live.ts).
 */
function who(friends: LiveFriend[]): string {
  const names = friends.map((f) => f.name);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is in`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are in`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are in`;
}

export function LibraryCard() {
  const live = useLiveSummary();
  const { user } = useAccount();
  const showCount = live.state === "ready" && live.revising !== null;
  const line = live.state === "ready" ? who(live.friendsIn) || "Come and study alongside others" : user ? "Join to study alongside others" : "Sign in to study alongside others";
  const to = useAppHref();
  const href = !user && live.state !== "off" ? signInHref("library", to("/study/library")) : to("/study/library");
  const label = `Enter the Grand Library${showCount ? `: ${live.revising} revising` : ""}`;
  return (
    <Link className="card lib" href={href} aria-label={label} data-testid="library-card">
      {showCount && <span className="lib-live"><span className="dot" />{live.revising} revising</span>}
      <span className="lib-foot">
        <b>The Grand Library</b>
        <span className="faces">
          {live.state === "ready" && live.friendsIn.length > 0 && (
            <span>{live.friendsIn.slice(0, 3).map((f) => (
              <i key={f.id} className="face" style={{ background: colourOf(f.colour) }} aria-hidden="true">{(f.name[0] ?? "?").toUpperCase()}</i>
            ))}</span>
          )}
          {line}
        </span>
        <span className="btn">{!user && live.state !== "off" ? "sign in" : "enter"}</span>
      </span>
    </Link>
  );
}
