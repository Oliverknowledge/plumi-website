import { track } from "@/lib/analytics";
import { reportAdsConversion } from "@/lib/adsConversion";
import type { CtaKind } from "@/config/site";

/**
 * Reports a call to action, wherever it appears (AppStoreBadge, HeaderDownload).
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
