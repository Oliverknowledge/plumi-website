"use client";
import { useSyncExternalStore } from "react";
import { appStoreUrl } from "@/config/site";
import { noteCtaClick } from "@/components/ui/CtaButton";
import { track } from "@/lib/analytics";

/**
 * Plumi is iPad only, and most ad traffic lands on a phone, where the App Store page
 * cannot install it. So every download control asks one question first: is this a
 * phone? On a phone it becomes "Send it to my iPad" (the share sheet where there is
 * one, otherwise an email to themselves); on an iPad or a computer it is Apple's badge.
 */
const noSubscribe = () => () => {};
function isPhoneClient() {
  const ua = navigator.userAgent;
  return /iPhone|iPod|Android/i.test(ua) && !/iPad|Tablet/i.test(ua);
}
function useIsPhone() {
  return useSyncExternalStore(noSubscribe, isPhoneClient, () => false);
}

const storeHref = () => appStoreUrl ?? "https://tryplumi.app";

async function sendToIPad(placement: string, label: string) {
  const href = storeHref();
  track("cta_clicked", { placement, cta_kind: "send_to_ipad", label, destination: href });
  if (navigator.share) {
    try { await navigator.share({ title: "Plumi for iPad", text: "Plumi: handwrite it, Plumi marks it.", url: href }); } catch { /* dismissed */ }
    return;
  }
  window.location.href = `mailto:?subject=${encodeURIComponent("Plumi for my iPad")}&body=${encodeURIComponent(href)}`;
}

export const phoneCopy = { line: "Plumi is for iPad.", button: "Send it to my iPad" } as const;

/**
 * Apple's own "Download on the App Store" artwork: never redrawn, recoloured or
 * animated (App Store marketing guidelines), at least 40px tall, with clear space of a
 * quarter of its height. Reports itself through the same funnel as every other CTA.
 */
export function AppStoreBadge({ placement, tone = "black", height = 52 }: { placement: string; tone?: "black" | "white"; height?: number }) {
  const isPhone = useIsPhone();
  if (isPhone) {
    return (
      <span className="hp-phone" data-testid={`${placement}-phone-hint`}>
        <button type="button" className="hp-phone-button" onClick={() => sendToIPad(placement, phoneCopy.button)}>{phoneCopy.button}</button>
        <span className="hp-phone-line">{phoneCopy.line}</span>
      </span>
    );
  }
  const href = storeHref();
  const width = Math.round((718 / 240) * height);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hp-badge"
      data-testid={`${placement}-app-store-badge`}
      onClick={() => noteCtaClick(placement, "app_store", "Download on the App Store", href)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Apple's artwork, served as-is */}
      <img src={`/site/app-store-badge-${tone}.png`} width={width} height={height} alt="Download Plumi on the App Store" />
    </a>
  );
}

/** A plain text link into the page, reported as a scroll CTA. */
export function HomeAnchor({ href, label, placement, className = "hp-link" }: { href: string; label: string; placement: string; className?: string }) {
  return (
    <a href={href} className={className} data-testid={`${placement}-link`}
      onClick={() => track("cta_clicked", { placement, cta_kind: "scroll", label, destination: "self" })}>
      {label}<span aria-hidden="true"> ›</span>
    </a>
  );
}

/** The header's small pill: the badge's destination, or the phone's send-on. */
export function HeaderDownload() {
  const isPhone = useIsPhone();
  if (isPhone) {
    return <button type="button" className="hp-pill" data-testid="header-cta-button" onClick={() => sendToIPad("header", "Send to iPad")}>Send to iPad</button>;
  }
  const href = storeHref();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hp-pill" data-testid="header-cta-button"
      onClick={() => noteCtaClick("header", "app_store", "Download", href)}>
      Download
    </a>
  );
}
