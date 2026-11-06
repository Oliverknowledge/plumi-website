"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, useAccount } from "@/lib/account";

/**
 * After paying. Arriving here proves nothing: anyone can type the address. Pro is granted only by Stripe's signed message to
 * our server, which can land a few seconds after the redirect. So this page asks the server (`account_pro_summary`, the same
 * answer the iPad uses, which takes no device slot) every two seconds for up to about a minute, and says "you're Pro" only
 * when the server does. If it never does, it says so plainly and offers a way to ask for help, rather than guessing.
 *
 * It names no pipeline word: no webhook, event or entitlement.
 */
type Summary = { pro: boolean; source: string | null; expires_at: string | null; ends_at_period_end: boolean };
type Phase = { kind: "checking" } | { kind: "pro"; s: Summary } | { kind: "waiting" } | { kind: "signed-out" };

const EVERY_MS = 2000;
const GIVE_UP_AFTER_MS = 60_000;

export function ProSuccess() {
  const { ready, user, on } = useAccount();
  const [asked, setAsked] = useState<Phase>({ kind: "checking" });
  // What can be known without asking the server is decided here, not in the effect.
  const phase: Phase = ready && !user ? { kind: "signed-out" } : ready && !on ? { kind: "waiting" } : asked;

  useEffect(() => {
    if (!ready || !user || !on) return;
    const sb = supabase();
    if (!sb) return;
    let stopped = false;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      let s: Summary | null = null;
      try {
        const { data } = await sb.rpc("account_pro_summary");
        const row = Array.isArray(data) ? data[0] : data;
        if (row && typeof row.pro === "boolean") s = row as Summary;
      } catch { /* a failed ask is just asked again */ }
      if (stopped) return;
      if (s?.pro) { setAsked({ kind: "pro", s }); return; }
      if (Date.now() - started > GIVE_UP_AFTER_MS) { setAsked({ kind: "waiting" }); return; }
      timer = setTimeout(ask, EVERY_MS);
    };
    void ask();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [ready, user, on]);

  return (
    <main className="pa-success" aria-live="polite">
      {phase.kind === "checking" && (
        <>
          <div className="ps-dots" aria-hidden="true"><i /><i /><i /></div>
          <h1>Checking your payment</h1>
          <p>This takes a few seconds.</p>
        </>
      )}
      {phase.kind === "pro" && (
        <>
          <div className="ps-mark" aria-hidden="true">&#10003;</div>
          <h1>You&rsquo;re all set</h1>
          <p>Plumi Pro is on for your account{phase.s.expires_at ? <>, until {formatDay(phase.s.expires_at)}</> : null}.</p>
          <div className="ps-actions">
            <Link className="ps-primary" href="/questions">Start practising</Link>
            <Link className="ps-link" href="/">Back to your desk</Link>
          </div>
        </>
      )}
      {phase.kind === "waiting" && (
        <>
          <h1>Still waiting for your payment to come through</h1>
          <p>Sometimes the bank is slow. You have not been charged twice, and nothing is lost. Refresh this page in a minute.</p>
          <div className="ps-actions">
            <button className="ps-primary" type="button" onClick={() => location.reload()}>Check again</button>
            <a className="ps-link" href="mailto:hello@tryplumi.app?subject=My%20Plumi%20Pro%20payment">Email us</a>
          </div>
        </>
      )}
      {phase.kind === "signed-out" && (
        <>
          <h1>Sign in to see your plan</h1>
          <p>Sign in with the account you paid with.</p>
          <div className="ps-actions"><Link className="ps-primary" href="/sign-in?next=%2Fsuccess">Sign in</Link></div>
        </>
      )}
    </main>
  );
}

/** "6 December 2026", in the student's own locale. */
function formatDay(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
