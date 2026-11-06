"use client";

import { useEffect, useId, useRef } from "react";
import { signInHref, signOut, useAccount } from "@/lib/account";
import { track } from "@/lib/analytics";
import { usePro } from "@/lib/pro/client";
import { proFeature } from "@/lib/pro/features";

/**
 * The calm panel a locked Pro thing opens: a title, one short line, and a Sign in link only when signed out. A modal dialog (Escape closes it, focus goes back to
 * what opened it, the page behind cannot be reached), in the pattern of Settings. No price, no way to buy, no "cheaper on the web": Pro is bought only in the iPad
 * app, and the website only learns of it when the student signs in (Apple's rules). `feature` is the id in lib/pro/features.ts (analytics, and the title of what
 * is locked).
 */
export function ProLockedPanel({ feature, onClose, next = "/study" }: { feature: string; onClose: () => void; next?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { user } = useAccount();
  const title = useId();
  const signedOut = !user || !!user.is_anonymous;
  // The server would not take the sign-in: the plan is not known, so never "Pro is bought in the app". Sign in again (signing out first: /sign-in sends a signed-in student straight back).
  const pro = usePro();
  const expired = !signedOut && pro.state === "session";
  const f = proFeature(feature);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    track("pro_panel_opened", { feature });
  }, [feature]);
  // (React lets a dialog's close and cancel bubble up its tree: stopped here so a panel opened from inside another sheet closes only itself.)
  const close = () => { const d = ref.current; if (d?.open) d.close(); else onClose(); };
  const again = async () => { await signOut(); window.location.assign(signInHref("header", next)); };

  return (
    <dialog ref={ref} className="pro-panel" aria-labelledby={title} data-testid="pro-panel" onClose={(e) => { e.stopPropagation(); onClose(); }} onCancel={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (e.target === ref.current) close(); }}>
      <div className="pro-panel-in">
        <h2 id={title}>Part of Plumi Pro</h2>
        {f && <p className="pro-panel-what" data-testid="pro-panel-feature">{f.title}</p>}
        <p className="pro-panel-how" data-testid="pro-panel-how">{expired ? "Your sign-in has run out. Sign in again, then it will work here." : "Pro is bought in the Plumi app on iPad, then it works here when you sign in."}</p>
        <div className="pro-panel-acts">
          {expired && <button type="button" className="btn gold" onClick={() => void again()} data-testid="pro-signin-again">Sign in</button>}
          {signedOut && <a className="btn gold" href={signInHref("header", next)} data-testid="pro-signin">Sign in</a>}
          <button type="button" className={signedOut || expired ? "btn ghost" : "btn gold"} onClick={close} data-autofocus data-testid="pro-back">Close</button>
        </div>
      </div>
    </dialog>
  );
}
