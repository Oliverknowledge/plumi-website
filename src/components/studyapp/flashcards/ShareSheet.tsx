"use client";

import { useRef, useState } from "react";
import { signInHref } from "@/lib/account";
import { canRetry, reasonLine, shareLink, sharePayload, SHARE_LIMITS, type ShareReason, type SharedRow } from "@/lib/studyapp/sharing";
import { useSharing } from "@/lib/studyapp/sharing/client";
import { useApp } from "@/lib/studyapp/store";
import { toast } from "../toast";
import { Sheet } from "./Sheet";

const plural = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;
const origin = () => (typeof window === "undefined" ? null : window.location.origin);

/** The link in a pill, and the ways to send it: Copy, and the phone's own share sheet where there is one. */
function LinkPill({ code, title }: { code: string; title: string }) {
  const link = shareLink(code, origin());
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const canSend = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      toast("Link copied");
    } catch {
      input.current?.focus();
      input.current?.select();
      toast("Press Ctrl+C or hold to copy the link");
    }
  };
  const send = async () => {
    try { await navigator.share({ title, url: link }); } catch { /* closed without sending, or not allowed: nothing to say */ }
  };

  return (
    <div className="shr-link">
      <input ref={input} className="shr-pill" readOnly value={link} aria-label="Link to this deck" onFocus={(e) => e.currentTarget.select()} data-testid="share-link" />
      <div className="shr-btns">
        <button type="button" className="btn gold" onClick={() => void copy()} data-testid="share-copy">{copied ? "Copied" : "Copy"}</button>
        {canSend && <button type="button" className="btn" onClick={() => void send()} data-testid="share-send">Send</button>}
      </div>
    </div>
  );
}

/**
 * Share one deck. Tap "Make a link" (the one tap that puts the deck's title and card text on our servers) and the sheet shows the
 * link, the way to send it, and "Stop sharing". Every failure is one calm line, with a retry where trying again can work.
 */
export function ShareSheet({ deckId, onClose, onList }: { deckId: string; onClose: () => void; onList: () => void }) {
  const { data } = useApp();
  const sharing = useSharing();
  const [busy, setBusy] = useState<"making" | "stopping" | null>(null);
  const [problem, setProblem] = useState<ShareReason | null>(null);
  const deck = data.decks.find((d) => d.id === deckId);
  const payload = sharePayload(data, deckId);
  const code = sharing.codeFor(deckId);
  const liveRow: SharedRow | undefined = code ? sharing.live?.find((r) => r.code === code) : undefined;

  if (!deck || !payload) return <Sheet title="Share this deck" onClose={onClose}><p className="sheet-line">This deck cannot be shared.</p></Sheet>;

  const make = async () => {
    setBusy("making"); setProblem(null);
    const r = await sharing.share(data, deckId);
    setBusy(null);
    if (!r.ok) setProblem(r.reason);
  };
  const stop = async () => {
    if (!code) return;
    setBusy("stopping"); setProblem(null);
    const r = await sharing.stop(code);
    setBusy(null);
    if (!r.ok) setProblem(r.reason);
    else toast("Stopped sharing");
  };

  let body: React.ReactNode;
  if (sharing.signedIn !== "real") {
    body = (
      <>
        <p className="sheet-line" data-testid="share-signin-line">Sign in to share</p>
        <div className="sheet-acts">
          <a className="btn gold" href={signInHref("header")} data-autofocus data-testid="share-signin">Sign in</a>
        </div>
      </>
    );
  } else if (code) {
    body = (
      <>
        <LinkPill code={code} title={deck.title} />
        <p className="sheet-line" data-testid="share-line">{plural(liveRow?.cardCount ?? payload.count)}. Anyone with the link can read it.</p>
        <div className="sheet-acts">
          <button type="button" className="btn ghost danger" onClick={() => void stop()} disabled={busy !== null} data-testid="share-stop">{busy === "stopping" ? "Stopping" : "Stop sharing"}</button>
        </div>
      </>
    );
  } else if (payload.count === 0) {
    body = <p className="sheet-line" data-testid="share-empty">{reasonLine("empty_deck")}</p>;
  } else {
    const line = payload.overLimit > 0
      ? `The first ${SHARE_LIMITS.maxCards} of ${payload.count + payload.overLimit} cards. Anyone with the link can read it.`
      : `${plural(payload.count)}. Anyone with the link can read it.`;
    body = (
      <>
        <p className="sheet-line" data-testid="share-line">{line}</p>
        <div className="sheet-acts">
          <button type="button" className="btn gold" onClick={() => void make()} disabled={busy !== null} data-autofocus data-testid="share-make">{busy === "making" ? "Making your link" : "Make a link"}</button>
        </div>
      </>
    );
  }

  return (
    <Sheet title="Share this deck" hint={deck.title} onClose={onClose}>
      {body}
      {problem && (
        <p className="shr-problem" role="status" data-testid="share-problem">
          {reasonLine(problem)}
          {canRetry(problem) && <button type="button" className="shr-retry" onClick={() => void (code ? stop() : make())} data-testid="share-retry">Try again</button>}
        </p>
      )}
      {sharing.signedIn === "real" && (sharing.live?.length ?? 0) > 0 && (
        <button type="button" className="side-link shr-list" onClick={onList} data-testid="share-list-open">Your shared decks ({sharing.live!.length})</button>
      )}
    </Sheet>
  );
}

/** Every deck of the student's that has a live link, from the server (a link made on another device is here too), each with Copy and Stop sharing. */
export function SharedDecksSheet({ onClose }: { onClose: () => void }) {
  const sharing = useSharing();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<ShareReason | null>(null);
  const rows = sharing.live;

  const stop = async (code: string) => {
    setBusy(code); setProblem(null);
    const r = await sharing.stop(code);
    setBusy(null);
    if (!r.ok) setProblem(r.reason); else toast("Stopped sharing");
  };
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(shareLink(code, origin())); toast("Link copied"); }
    catch { toast("Open the deck to copy its link"); }
  };

  return (
    <Sheet title="Your shared decks" onClose={onClose}>
      {rows === null && <p className="sheet-line" role="status">One moment</p>}
      {rows !== null && rows.length === 0 && <p className="sheet-line" data-testid="shared-none">Nothing is shared right now.</p>}
      {rows !== null && rows.length > 0 && (
        <ul className="shr-rows" data-testid="shared-list">
          {rows.map((r) => (
            <li key={r.code} data-testid="shared-row">
              <div className="shr-row-t"><b>{r.title}</b><small>{plural(r.cardCount)}</small></div>
              <button type="button" className="btn shr-small" onClick={() => void copy(r.code)} aria-label={`Copy link to ${r.title}`} data-testid="shared-copy">Copy link</button>
              <button type="button" className="btn ghost danger shr-small" onClick={() => void stop(r.code)} disabled={busy !== null} aria-label={`Stop sharing ${r.title}`} data-testid="shared-stop">{busy === r.code ? "Stopping" : "Stop sharing"}</button>
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="shr-problem" role="status" data-testid="share-problem">{reasonLine(problem)}</p>}
    </Sheet>
  );
}
