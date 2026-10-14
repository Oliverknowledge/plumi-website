"use client";
import { appStoreUrl } from "@/config/site";
import { noteCtaClick } from "@/components/ui/CtaButton";
import { track } from "@/lib/analytics";

/**
 * Apple's own "Download on the App Store" artwork: never redrawn, recoloured or
 * animated (App Store marketing guidelines), at least 40px tall, with clear space of a
 * quarter of its height. Reports itself through the same funnel as every other CTA.
 */
export function AppStoreBadge({ placement, tone = "black", height = 52 }: { placement: string; tone?: "black" | "white"; height?: number }) {
  const href = appStoreUrl ?? "#";
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

/** The header's small "Download" pill: the same destination and funnel as the badge. */
export function HeaderDownload() {
  const href = appStoreUrl ?? "#";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="hp-pill" data-testid="header-cta-button"
      onClick={() => noteCtaClick("header", "app_store", "Download", href)}>
      Download
    </a>
  );
}
