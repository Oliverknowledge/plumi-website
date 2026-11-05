"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useAccount } from "@/lib/account";
import { canonicalPath, useAppHref } from "@/lib/studyapp/host";
import { useNow } from "@/lib/studyapp/clock";
import { useLiveSummary } from "@/lib/studyapp/live";
import { useRoomFull } from "@/lib/studyapp/library/roomOpen";
import { useDueCount } from "@/lib/studyapp/store";
import { TimerChip } from "./timer/TimerChip";
import { Settings } from "./Settings";

/**
 * The top bar: Plumi, then the four places (Desk, Study, Questions, Flashcards), then the student. Study is the Grand
 * Library, and carries a badge when friends are in it; Flashcards carries how many are due. Nothing is badged
 * that is not true: no number is shown until the app actually knows it. On the narrowest phones Flashcards is written "Cards" (the full word is still what a screen
 * reader hears), so the four places and a running timer fit without anything scrolling or hiding.
 */
const TABS = [
  { href: "/study", label: "Desk", on: (p: string) => p === "/study" },
  { href: "/study/library", label: "Study", on: (p: string) => p.startsWith("/study/library") },
  { href: "/study/questions", label: "Questions", on: (p: string) => p.startsWith("/study/questions") },
  { href: "/study/flashcards", label: "Flashcards", short: "Cards", on: (p: string) => p.startsWith("/study/flashcards") },
] as const;

export function AppTop() {
  // /library on study.tryplumi.app and /study/library everywhere else are the same place.
  const path = canonicalPath(usePathname() ?? "/");
  const to = useAppHref();
  const live = useLiveSummary();
  const now = useNow();
  const due = useDueCount(now);
  const friends = live.state === "ready" ? live.friendsIn.length : 0;
  const covered = useRoomFull();       // the full-screen library covers this bar and carries its own timer chip

  return (
    <header className="top" data-testid="app-top">
      <div className="wrap">
        <Link className="brand" href={to("/study")} aria-label="Plumi, Desk">
          <Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={36} height={36} unoptimized />
          <span>plumi</span>
        </Link>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => {
            const on = t.on(path);
            const badge = t.label === "Study" ? friends : t.label === "Flashcards" ? (now ? due : 0) : 0;
            const title = t.label === "Study" ? `${friends} friend${friends === 1 ? "" : "s"} in the library now` : `${due} card${due === 1 ? "" : "s"} due`;
            return (
              <Link key={t.href} className={`tab${on ? " on" : ""}`} href={to(t.href)} aria-current={on ? "page" : undefined} data-testid={`tab-${t.label.toLowerCase()}`}>
                {"short" in t ? <><span className="tab-long">{t.label}</span><span className="tab-short" aria-hidden="true">{t.short}</span></> : t.label}
                {badge > 0 && <span className="badge" title={title}>{badge > 99 ? "99+" : badge}</span>}
              </Link>
            );
          })}
        </nav>
        {!covered && <TimerChip where="top" />}
        <Account />
      </div>
    </header>
  );
}

/** The student's button: one tap opens Settings straight away (look, sign in or out, delete account). No menu in between. */
function Account() {
  const { ready, user, email, name } = useAccount();
  const [settings, setSettings] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const initial = ((name ?? email ?? "P").trim()[0] ?? "P").toUpperCase();
  return (
    <div className="acct">
      <button ref={button} type="button" className="btn icon avatar" aria-label="Settings" aria-haspopup="dialog" onClick={() => setSettings(true)} data-testid="account-button">
        {ready && user ? initial : "P"}
      </button>
      {settings && <Settings onClose={() => { setSettings(false); button.current?.focus({ preventScroll: true }); }} />}
    </div>
  );
}
