"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signInHref, signOut, useAccount, type SignInReason } from "@/lib/account";
import { startSync } from "@/lib/bankSync";
import { JoinLibrarySheet, LibraryMenuRow } from "@/components/account/JoinLibrary";
import { OpenApp, StudyEntry } from "@/components/account/StudyEntry";

/**
 * The account, in the header of every page: "Log in" and "Get started" (to the web app, study.tryplumi.app:
 * components/account/StudyEntry) or your initial with a small menu, and the Grand Library's "Join the library"
 * (components/account/JoinLibrary). Rendered only in the browser; with accounts switched
 * off (no project configured) it renders nothing at all. It also starts the marks sync
 * (lib/bankSync), once, wherever the student is on the site.
 */

export function AccountButton() {
  const account = useAccount();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (account.on) startSync(); }, [account.on]);
  // The menu closes on a click or tap anywhere else, as a dropdown would.
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  // Signed out, or not known yet: the way into the web app (study.tryplumi.app), which has the sign-in page.
  if (!account.on || !account.ready || !account.user) return <div className="lp-acct"><StudyEntry /><JoinLibrarySheet /></div>;

  const initial = (account.name ?? account.email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="lp-acct" ref={ref}>
      <button type="button" className="lp-acct-me" aria-expanded={menu} aria-label="Your account" onClick={() => setMenu(m => !m)}>{initial}</button>
      {menu && (
        <div className="lp-acct-menu" role="menu">
          <p className="lp-acct-who">{account.name ?? "Signed in"}<small>{account.email}</small></p>
          <p className="lp-acct-note">Your marks, bookmarks and notes are saved to your account.</p>
          <OpenApp />
          <LibraryMenuRow onAction={() => setMenu(false)} />
          <button type="button" role="menuitem" className="lp-acct-out" onClick={() => { setMenu(false); void signOut(); }}>Sign out</button>
        </div>
      )}
      <JoinLibrarySheet />
    </div>
  );
}

/** A small "Sign in" link for a line of copy, shown only to a signed-out student when accounts are on. */
export function SignInLink({ reason, children }: { reason: SignInReason; children: React.ReactNode }) {
  const account = useAccount();
  const path = usePathname();
  if (!account.on || !account.ready || account.user) return null;
  return <Link className="qb-link lp-acct-link" href={signInHref(reason, path)} prefetch={false}>{children}</Link>;
}

/**
 * Apple's logo, for its button: one path, drawn in the button's text colour (`currentColor`), because Apple's rules for
 * web buttons want it white on black or black on white, never coloured. Inline so there is no image to fetch.
 */
export function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** Google's own mark, for its button (its brand rules ask for the coloured G). */
export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
