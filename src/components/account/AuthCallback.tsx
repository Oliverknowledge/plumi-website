"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import { useAccount } from "@/lib/account";

const noop = () => () => {};
/** Only somewhere on this site: "/question-bank/x?y", never "//elsewhere" or "https://…". */
const safe = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/question-bank");

export function AuthCallback() {
  const account = useAccount();
  // Google (or Supabase) says what went wrong in the address it sends the student back to.
  const search = useSyncExternalStore(noop, () => window.location.search, () => "");
  const problem = new URLSearchParams(search).get("error_description") ?? new URLSearchParams(search).get("error");
  const [timedOut, setTimedOut] = useState(false);
  const failed = problem ?? (timedOut ? "The sign-in didn’t finish." : null);

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
          <p>{failed} A sign-in link only works in the browser you asked for it from, so open it there, or try again.</p>
          <Link className="lp-btn" href="/question-bank">Back to the question bank</Link>
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
