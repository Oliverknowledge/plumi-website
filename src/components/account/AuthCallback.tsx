"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { safeNext, signInHref, useAccount } from "@/lib/account";

const noop = () => () => {};
const safe = safeNext;

export function AuthCallback() {
  const account = useAccount();
  // Google (or Supabase) says what went wrong in the address it sends the student back to.
  const search = useSyncExternalStore(noop, () => window.location.search, () => "");
  const params = new URLSearchParams(search);
  const code = params.get("error_code");
  const problem = params.get("error_description") ?? params.get("error");
  const [timedOut, setTimedOut] = useState(false);
  // In our words, not the server's: a used or replaced link is the common one.
  const failed = code === "otp_expired" || /expired|invalid/i.test(problem ?? "")
    ? "That sign-in link has expired or has already been used. Each new email replaces the last link, so use the newest one, or sign in again."
    : problem ? "Signing in didn’t finish. Try again, and if it keeps happening, sign in with Google instead."
    : timedOut ? "Signing in didn’t finish. A sign-in link only works in the browser you asked for it from, so open it there, or try again." : null;

  useEffect(() => {
    if (!account.ready) return;
    if (account.user) {
      // "email:marks", "google:header": how they signed in and what asked them to, saved before they left.
      let started = "link:header";
      try { started = sessionStorage.getItem("plumi.signin.reason") ?? started; sessionStorage.removeItem("plumi.signin.reason"); } catch { /* fine without */ }
      const [method, reason] = started.split(":");
      track("signin_completed", { method, reason });
      window.location.replace(safe(new URLSearchParams(window.location.search).get("next")));
      return;
    }
    // The client trades the code for a session as it starts; give it a moment before saying it didn't work.
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, [account.ready, account.user]);

  return (
    <section className="lp-wrap lp-callback" aria-live="polite">
      {failed ? (
        <>
          <h1>That didn’t work</h1>
          <p>{failed}</p>
          <span className="lp-callback-btns">
            <Link className="lp-btn" href={signInHref("header", safe(params.get("next")))}>Sign in again</Link>
            <Link className="qb-link" href={safe(params.get("next"))}>Back to where you were</Link>
          </span>
        </>
      ) : (
        <>
          <h1>Signing you in…</h1>
          <p>One moment, then you’re back where you were.</p>
        </>
      )}
    </section>
  );
}
