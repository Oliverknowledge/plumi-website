"use client";
import { useState } from "react";
import { appStoreLink } from "@/config/site";
import { noteCtaClick } from "@/components/ui/CtaButton";
import { track } from "@/lib/analytics";
import { reportAdsConversion } from "@/lib/adsConversion";

/**
 * Plumi is iPad only, and most ad traffic lands on a phone, where the App Store page
 * cannot install it. Every download control is therefore rendered twice, from the
 * server: Apple's badge, and a "Send it to my iPad" button (the share sheet where
 * there is one, otherwise an email to themselves). CSS shows one of them: the button
 * on a small touch screen, the badge everywhere else, so a phone never sees, or taps,
 * a badge that leads nowhere, not even for a moment before the page hydrates.
 *
 * The link carries Apple's campaign tokens once a provider token is configured
 * (`appStoreLink`), including the one that is sent on: opened on the iPad, it still
 * says it came from the website's send-on, so App Analytics can count those installs.
 */
const storeHref = (placement: string, via: "link" | "send" = "link") => appStoreLink(placement, via) ?? "https://tryplumi.app";

function emailLink(placement: string) {
  window.location.href = `mailto:?subject=${encodeURIComponent("Plumi for my iPad")}&body=${encodeURIComponent(storeHref(placement, "send"))}`;
}

/** The send-on's outcome, in our own analytics and, when it got the link out, as a Google Ads conversion. */
function noteSendResult(placement: string, outcome: "sent" | "emailed" | "dismissed") {
  track("send_to_ipad_result", { placement, outcome });
  if (outcome !== "dismissed") reportAdsConversion("sendToIpad");
}

/** Sends the link on: "sent" by the share sheet, "emailed" when a mail draft was opened, "dismissed" when the sheet was closed. */
async function sendToIPad(placement: string, label: string): Promise<"sent" | "emailed" | "dismissed"> {
  const href = storeHref(placement, "send");
  track("cta_clicked", { placement, cta_kind: "send_to_ipad", label, destination: href });
  if (navigator.share) {
    try { await navigator.share({ title: "Plumi for iPad", text: "Plumi marks your handwritten answers on iPad.", url: href }); noteSendResult(placement, "sent"); return "sent"; }
    catch { noteSendResult(placement, "dismissed"); return "dismissed"; }
  }
  emailLink(placement);
  noteSendResult(placement, "emailed");
  return "emailed";
}

export const phoneCopy = { line: "It’s free and iPad only, so send it there.", button: "Send it to my iPad", sent: "Sent. Open it on your iPad.", emailed: "Now send that email to yourself.", email: "Email me the link instead" } as const;

type SendState = "idle" | "sent" | "emailed" | "dismissed";
const sendLabel = (state: SendState, idle: string) => state === "sent" ? phoneCopy.sent : state === "emailed" ? phoneCopy.emailed : idle;

/**
 * Apple's own "Download on the App Store" artwork: never redrawn, recoloured or
 * animated (App Store marketing guidelines), at least 40px tall, with clear space of a
 * quarter of its height. Reports itself through the same funnel as every other CTA.
 */
export function AppStoreBadge({ placement, tone = "black", height = 52, showLine = false }: { placement: string; tone?: "black" | "white"; height?: number; showLine?: boolean }) {
  const [state, setState] = useState<SendState>("idle");
  const href = storeHref(placement);
  const width = Math.round((718 / 240) * height);
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="hp-badge hp-not-phone"
        data-testid={`${placement}-app-store-badge`}
        onClick={() => noteCtaClick(placement, "app_store", "Download on the App Store", href)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Apple's artwork, served as-is */}
        <img src={`/site/app-store-badge-${tone}.png`} width={width} height={height} alt="Download Plumi on the App Store" />
      </a>
      <span className="hp-phone hp-only-phone" data-testid={`${placement}-phone-hint`}>
        <button type="button" className="hp-phone-button" onClick={async () => setState(await sendToIPad(placement, phoneCopy.button))}>
          {sendLabel(state, phoneCopy.button)}
        </button>
        {state === "dismissed"
          ? <button type="button" className="hp-phone-email" onClick={() => { track("cta_clicked", { placement, cta_kind: "email_to_ipad", label: phoneCopy.email, destination: "mailto" }); emailLink(placement); noteSendResult(placement, "emailed"); }}>{phoneCopy.email}</button>
          : showLine && <span className="hp-phone-line" aria-live="polite">{phoneCopy.line}</span>}
      </span>
    </>
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

/** The header's small pill: the badge's destination, or the phone's send-on (see above). */
export function HeaderDownload() {
  const [state, setState] = useState<SendState>("idle");
  const href = storeHref("header");
  const label = state === "sent" ? "Sent" : state === "emailed" ? "Check email" : "Send to iPad";
  return (
    <>
      <a href={href} target="_blank" rel="noopener noreferrer" className="hp-pill hp-not-phone" data-testid="header-cta-button"
        onClick={() => noteCtaClick("header", "app_store", "Download", href)}>
        Download
      </a>
      <button type="button" className="hp-pill hp-only-phone" data-testid="header-send-button" aria-live="polite"
        onClick={async () => setState(await sendToIPad("header", "Send to iPad"))}>{label}</button>
    </>
  );
}
