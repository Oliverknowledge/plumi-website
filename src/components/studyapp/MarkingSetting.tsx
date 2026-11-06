"use client";

import { useEffect, useId, useState } from "react";
import { supabase, useAccount } from "@/lib/account";
import { hasConsent, withdrawConsent } from "@/lib/studyapp/marking/consent";
import { aiMarkingOn } from "@/lib/studyapp/marking/live";

/**
 * The way back out of "Mark with Plumi": the consent screen promises the student can change their mind in Account, so this is that
 * switch. It only ever turns marking OFF (a withdrawal takes effect on the next request, server side). Turning it on again is the consent
 * screen itself, the next time they tap Mark with Plumi, so the wording they agree to is always the one on screen.
 * Nothing is drawn unless marking is switched on for the site and the student is signed in with a real account.
 */
export function MarkingSetting() {
  const { ready, user, on } = useAccount();
  const id = useId();
  const [state, setState] = useState<"unknown" | "on" | "off" | "failed">("unknown");
  const eligible = aiMarkingOn && on && ready && !!user && user.is_anonymous !== true;

  useEffect(() => {
    if (!eligible) return;
    const sb = supabase();
    if (!sb) return;
    let live = true;
    void hasConsent(sb).then((granted) => { if (live) setState(granted ? "on" : "off"); });
    return () => { live = false; };
  }, [eligible]);

  if (!eligible || state === "unknown") return null;
  const turnOff = async () => {
    const sb = supabase();
    setState((await (sb ? withdrawConsent(sb) : Promise.resolve(false))) ? "off" : "failed");
  };
  return (
    <section className="stg-sec" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`}>Plumi marking</h3>
      <div className="stg-row">
        {state === "on" || state === "failed" ? (
          <>
            <button type="button" role="switch" aria-checked="true" className="btn" onClick={() => void turnOff()} data-testid="settings-marking-off">On. Turn off</button>
            {state === "failed" && <p className="stg-who" role="status">That didn&rsquo;t save. Try again.</p>}
          </>
        ) : (
          <p className="stg-who" data-testid="settings-marking-is-off">Off. Plumi asks again if you tap Mark with Plumi.</p>
        )}
      </div>
    </section>
  );
}
