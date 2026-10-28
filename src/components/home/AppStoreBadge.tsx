"use client";
import { useEffect, useRef, useState } from "react";
import { appStoreLink } from "@/config/site";
import { noteCtaClick } from "@/lib/cta";
import { track } from "@/lib/analytics";
import { reportAdsConversion } from "@/lib/adsConversion";
import "@/app/send-to-ipad.css";

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
export function AppStoreBadge({ placement, tone = "black", height = 52, showLine = false, desktopSend = true }: { placement: string; tone?: "black" | "white"; height?: number; showLine?: boolean; desktopSend?: boolean }) {
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
      {desktopSend && <DesktopSend placement={placement} />}
    </>
  );
}

export const desktopCopy = {
  button: "Send to my iPad",
  scan: "Point your iPad’s camera here",
  share: "AirDrop or share",
  email: "Email me the link",
  close: "Close",
} as const;

/**
 * On a computer, beside the badge: Plumi is iPad only, so the link is handed across. The
 * panel shows the link as a QR code for the iPad's camera, the share sheet where the
 * browser has one (Safari on a Mac offers AirDrop), and an email to themselves. Hidden on a
 * phone, which has its own "Send it to my iPad" above. The code is drawn on first open, so
 * the library costs nothing to a visitor who never asks for it.
 */
function DesktopSend({ placement }: { placement: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [done, setDone] = useState<"sent" | "emailed" | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const href = storeHref(placement, "send");

  useEffect(() => {
    if (!open) return;
    let live = true;
    import("qrcode").then(QR => QR.toString(href, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2b2326", light: "#fffdf8" } }))
      .then(svg => { if (live) setQr(svg); }).catch(() => { if (live) setQr(null); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: MouseEvent) => { if (panel.current && !panel.current.parentElement?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => { live = false; window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [open, href]);

  return (
    <span className="hp-desk hp-not-phone">
      <button type="button" className="hp-desk-button" aria-expanded={open} data-testid={`${placement}-desktop-send`}
        onClick={() => {
          if (!open) {
            track("cta_clicked", { placement, cta_kind: "send_to_ipad_desktop", label: desktopCopy.button, destination: "panel" });
            setCanShare(!!navigator.share);
          }
          setOpen(!open);
        }}>
        <svg aria-hidden="true" width="16" height="20" viewBox="0 0 16 20"><rect x="1.5" y="1.5" width="13" height="17" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="8" cy="15.5" r="1" fill="currentColor" /></svg>
        {done === "sent" ? phoneCopy.sent : done === "emailed" ? phoneCopy.emailed : desktopCopy.button}
      </button>
      {open && (
        <div ref={panel} className="hp-desk-panel" role="dialog" aria-label={desktopCopy.button}>
          <div className="hp-desk-qr" aria-hidden={!qr}>
            {qr ? <span dangerouslySetInnerHTML={{ __html: qr }} /> : <span className="hp-desk-qr-wait" />}
          </div>
          <p className="hp-desk-scan">{desktopCopy.scan}</p>
          <div className="hp-desk-actions">
            {canShare && (
              <button type="button" onClick={async () => { const outcome = await sendToIPad(placement, desktopCopy.share); if (outcome !== "dismissed") { setDone(outcome); setOpen(false); } }}>
                {desktopCopy.share}
              </button>
            )}
            <button type="button" onClick={() => { track("cta_clicked", { placement, cta_kind: "email_to_ipad", label: desktopCopy.email, destination: "mailto" }); emailLink(placement); noteSendResult(placement, "emailed"); setDone("emailed"); setOpen(false); }}>
              {desktopCopy.email}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * The header's small pill: the badge's destination, or the phone's send-on (see above).
 * `download` is the wording on the App Store link ("Try on iPad" in the cosy header on
 * every page) and `className` the key's look; the destination, the phone's send-on and
 * the events are the same whatever they are.
 */
export function HeaderDownload({ download = "Download", className = "hp-pill" }: { download?: string; className?: string } = {}) {
  const [state, setState] = useState<SendState>("idle");
  const href = storeHref("header");
  const label = state === "sent" ? "Sent" : state === "emailed" ? "Check email" : "Send to iPad";
  return (
    <>
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${className} hp-not-phone`} data-testid="header-cta-button"
        onClick={() => noteCtaClick("header", "app_store", download, href)}>
        {download}
      </a>
      <button type="button" className={`${className} hp-only-phone`} data-testid="header-send-button" aria-live="polite"
        onClick={async () => setState(await sendToIPad("header", "Send to iPad"))}>{label}</button>
    </>
  );
}
