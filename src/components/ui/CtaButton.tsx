"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { activeCta, primaryCtaHref, primaryCtaKind, type CtaKind } from "@/config/site";
import { track } from "@/lib/analytics";
import { reportAdsConversion } from "@/lib/adsConversion";

/**
 * The primary call to action, wherever it appears.
 *
 * Every instance reports itself. `placement` is the only thing a call site has
 * to supply and it is required rather than defaulted, because an unlabelled
 * button in a funnel is a click nobody can act on.
 *
 * Two events fire, not one. `cta_clicked` is the funnel step and carries the
 * placement, the kind and the destination host; `discord_clicked` and
 * `app_store_clicked` are the destination-specific counts, so "how many people
 * went to Discord" is a question with an answer rather than a filter someone has
 * to remember to apply. The label is sent too, but nothing is keyed on it.
 * An App Store click is also a Google Ads conversion (`lib/adsConversion.ts`),
 * which sends nothing until its label is configured and nothing from a phone.
 */
export function noteCtaClick(placement: string, kind: CtaKind, label: string, destination: string) {
  const host = safeHost(destination);
  track("cta_clicked", { placement, cta_kind: kind, label, destination: host });
  if (kind === "discord") track("discord_clicked", { placement });
  if (kind === "app_store") {
    track("app_store_clicked", { placement });
    reportAdsConversion("appStoreClick");
  }
}

/** The host only. A full URL in an event is a query string waiting to leak. */
function safeHost(destination: string): string {
  if (destination.startsWith("#") || destination.startsWith("/")) return "self";
  try {
    return new URL(destination).hostname;
  } catch {
    return "unknown";
  }
}

export function CtaButton({ placement, variant = "primary", size = "default", label, className = "", children }: { placement: string; variant?: "primary" | "secondary" | "ghost"; size?: "default" | "large" | "compact"; label?: string; className?: string; children?: ReactNode }) {
  const href = primaryCtaHref(placement);
  const kind = primaryCtaKind();
  const text = label ?? activeCta.primary;
  return <a href={href} target="_blank" rel="noopener noreferrer" data-testid={`${placement}-cta-button`} className={`story-button ${variant} ${size} ${className}`} onClick={() => noteCtaClick(placement, kind, text, href)}>
    {children ?? text}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </a>;
}

/**
 * An in-page link that is still a call to action — "Watch it click", "See how a
 * mark is decided". Instrumented identically, with `cta_kind: "scroll"`, so the
 * two can be compared without either being invisible.
 */
export function SecondaryCta({ label, href = "/#the-mark", placement }: { label: string; href?: string; placement: string }) {
  return <Link href={href} className="story-text-link" data-testid={`${placement}-secondary-link`} onClick={() => track("cta_clicked", { placement, cta_kind: "scroll", label, destination: "self" })}>{label}<span aria-hidden="true">↗</span></Link>;
}
