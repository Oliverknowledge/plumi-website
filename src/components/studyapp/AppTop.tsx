"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signInHref, signOut, useAccount } from "@/lib/account";
import { canonicalPath, useAppHref } from "@/lib/studyapp/host";
import { useNow } from "@/lib/studyapp/clock";
import { useLiveSummary } from "@/lib/studyapp/live";
import { useDueCount } from "@/lib/studyapp/store";

/**
 * The top bar: Plumi, then the three places (Desk, Study, Flashcards), then the student. Study is the Grand
 * Library, and carries a badge when friends are in it; Flashcards carries how many are due. Nothing is badged
 * that is not true: no number is shown until the app actually knows it.
 */
const TABS = [
  { href: "/study", label: "Desk", on: (p: string) => p === "/study" },
  { href: "/study/library", label: "Study", on: (p: string) => p.startsWith("/study/library") },
  { href: "/study/flashcards", label: "Flashcards", on: (p: string) => p.startsWith("/study/flashcards") },
] as const;

export function AppTop() {
  // /library on study.tryplumi.app and /study/library everywhere else are the same place.
  const path = canonicalPath(usePathname() ?? "/");
  const to = useAppHref();
  const live = useLiveSummary();
  const now = useNow();
  const due = useDueCount(now);
  const friends = live.state === "ready" ? live.friendsIn.length : 0;

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
                {t.label}
                {badge > 0 && <span className="badge" title={title}>{badge > 99 ? "99+" : badge}</span>}
              </Link>
            );
          })}
        </nav>
        <Account />
      </div>
    </header>
  );
}

/** The student's button: who is signed in, and how to sign in or out. */
function Account() {
  const { ready, user, email, name } = useAccount();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname() ?? "/";
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const initial = ((name ?? email ?? "P").trim()[0] ?? "P").toUpperCase();
  return (
    <div className="acct" ref={box}>
      <button type="button" className="btn icon avatar" aria-label={user ? "Your account" : "Sign in"} aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="account-button">
        {ready && user ? initial : "P"}
      </button>
      {open && (
        <div className="ddp right acct-menu" role="menu">
          {user ? (
            <>
              <span className="lbl">Signed in</span>
              <span className="acct-who">{name ?? email}</span>
              <button type="button" className="mi" role="menuitem" onClick={() => { setOpen(false); void signOut(); }}>Sign out</button>
            </>
          ) : (
            <>
              <span className="lbl">Not signed in</span>
              <span className="acct-who">Your tasks and cards are saved on this device. Sign in to join the Grand Library.</span>
              <a className="mi" role="menuitem" href={signInHref("library", path)}>Sign in</a>
              <a className="mi" role="menuitem" href={signInHref("library", path, "sign-up")}>Make an account</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
