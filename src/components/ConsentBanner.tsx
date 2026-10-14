"use client";
import { useState, useSyncExternalStore } from "react";
import { googleAdsEnabled } from "@/config/site";
import { CONSENT_KEY } from "@/lib/consent";


type Gtag = (...args: unknown[]) => void;
const granted = { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" };

const noSubscribe = () => () => {};
function storedChoice(): string | null {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return "unavailable"; }
}

/**
 * One question, asked once: may Plumi set the advertising cookie that tells it which
 * ads work? Nothing is set until the answer is yes (see GoogleAds.tsx). Small, at the
 * bottom, never over a download button for long, and gone for good after one tap.
 */
export function ConsentBanner() {
  const stored = useSyncExternalStore(noSubscribe, storedChoice, () => "server");
  const [answered, setAnswered] = useState(false);
  if (!googleAdsEnabled() || answered || stored !== null) return null;

  const answer = (choice: "granted" | "denied") => {
    try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* private mode: ask again next time */ }
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (choice === "granted" && gtag) gtag("consent", "update", granted);
    setAnswered(true);
  };

  return (
    <div className="consent" role="region" aria-label="Cookie choice" data-testid="consent-banner">
      <p>Can Plumi use an ad cookie to see which of its ads work? Nothing else is tracked.</p>
      <div className="consent-actions">
        <button type="button" onClick={() => answer("denied")} data-testid="consent-deny">No thanks</button>
        <button type="button" onClick={() => answer("granted")} className="is-primary" data-testid="consent-allow">Allow</button>
      </div>
    </div>
  );
}
