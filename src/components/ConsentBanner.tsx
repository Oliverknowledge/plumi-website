"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
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
 * bottom, and gone for good after one tap. It waits until the visitor has scrolled a
 * little (or tapped something), so it never covers the first screen of the page.
 */
export function ConsentBanner() {
  const stored = useSyncExternalStore(noSubscribe, storedChoice, () => "server");
  const [answered, setAnswered] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const wake = () => { if (window.scrollY > 400) setReady(true); };
    const tap = () => setReady(true);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("pointerdown", tap, { once: true });
    return () => { window.removeEventListener("scroll", wake); window.removeEventListener("pointerdown", tap); };
  }, []);
  const showing = googleAdsEnabled() && !answered && stored === null && ready;
  // While the card is up, the page gains room at the bottom so the card never sits on
  // the last download button or the footer.
  useEffect(() => {
    document.body.classList.toggle("has-consent", showing);
    return () => document.body.classList.remove("has-consent");
  }, [showing]);
  if (!showing) return null;

  const answer = (choice: "granted" | "denied") => {
    try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* private mode: ask again next time */ }
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (choice === "granted" && gtag) gtag("consent", "update", granted);
    setAnswered(true);
  };

  return (
    <div className="consent" role="region" aria-label="Cookie choice" data-testid="consent-banner">
      <p>Can Plumi use an ad cookie to see which ads work? <a href="/privacy" className="consent-link">How we use it</a><span className="consent-more"> Our own visit counts stay anonymous either way.</span></p>
      <div className="consent-actions">
        <button type="button" onClick={() => answer("denied")} data-testid="consent-deny">No thanks</button>
        <button type="button" onClick={() => answer("granted")} data-testid="consent-allow">Allow</button>
      </div>
    </div>
  );
}
