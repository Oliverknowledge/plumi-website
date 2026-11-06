"use client";

import { useId, useState } from "react";
import { signInHref, useAccount } from "@/lib/account";
import { usePro } from "@/lib/pro/client";
import { PRO_FEATURES, type ProFeature } from "@/lib/pro/features";
import { describePlan } from "@/lib/pro/plan";
import { ProTag } from "./ProTag";

const Tick = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
const Lock = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;

/**
 * Settings' "Plumi Pro" section: what plan the student has (from the server, through `usePro`), what Pro includes (lib/pro/features.ts), and "Check again" for the
 * minute after they buy on iPad. Signed out it only says to sign in. No price and no way to buy: Pro is bought in the iPad app (Apple's rules).
 */
export function ProPlanSection({ path }: { path: string }) {
  const { user } = useAccount();
  const pro = usePro();
  const [checking, setChecking] = useState(false);
  const id = useId();
  const signedIn = !!user && !user.is_anonymous;
  const line = describePlan(pro.plan, { signedIn, loading: pro.loading });
  const isPro = line.tone === "pro";
  const free = line.tone === "free";

  const again = async () => { setChecking(true); try { await pro.refresh(); } finally { setChecking(false); } };

  return (
    <section className="stg-sec pro-plan" aria-labelledby={`${id}-h`} data-testid="pro-plan" data-tone={line.tone}>
      <h3 id={`${id}-h`}>Plumi Pro</h3>
      <div className="pro-plan-card">
        <p className="pro-plan-head" data-testid="pro-plan-head" role="status">{isPro && <ProTag />}{line.headline}</p>
        {line.detail && <p className="pro-plan-detail" data-testid="pro-plan-detail">{line.detail}</p>}
      </div>

      {line.tone === "signedout" ? (
        <div className="stg-row"><a className="btn" href={signInHref("library", path)} data-testid="pro-plan-signin">Sign in</a></div>
      ) : (
        <>
          {line.tone !== "checking" && (
            <ul className="pro-list" aria-label="What Plumi Pro includes" data-testid="pro-list">
              {(PRO_FEATURES as readonly ProFeature[]).map((f) => (
                <li key={f.id} className={isPro ? "on" : "off"} data-feature={f.id}>
                  <span className="pro-list-mark" aria-hidden="true">{isPro ? <Tick /> : <Lock />}</span>
                  <span className="pro-list-text"><b>{f.title}</b><small>{f.line}</small></span>
                  {f.status === "soon" && <i className="pro-list-soon">Soon</i>}
                </li>
              ))}
            </ul>
          )}
          {free && <p className="pro-plan-how">Pro is bought in the Plumi app on iPad, then it works here when you sign in.</p>}
          <div className="stg-row pro-plan-acts">
            <button type="button" className="btn" onClick={() => void again()} disabled={checking} data-testid="pro-check-again">{checking ? "Checking…" : "Check again"}</button>
          </div>
          {free && <p className="pro-plan-note" data-testid="pro-plan-note">Still free? Sign in to the same account in the app, then check again.</p>}
        </>
      )}
    </section>
  );
}
