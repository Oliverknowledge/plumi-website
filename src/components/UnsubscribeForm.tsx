"use client";

import { useState } from "react";

type State = { phase: "idle" } | { phase: "sending" } | { phase: "done" } | { phase: "error"; message: string };

/** "Leave the Android waitlist?" with one key. Nothing happens until it is pressed. */
export function UnsubscribeForm({ e, t }: { e: string; t: string }) {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function leave() {
    if (state.phase === "sending") return;
    setState({ phase: "sending" });
    try {
      const response = await fetch(`/api/unsubscribe?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setState(response.ok && body.ok ? { phase: "done" } : { phase: "error", message: body.message ?? "Something went wrong. Try again in a moment." });
    } catch {
      setState({ phase: "error", message: "Couldn't reach Plumi. Check your connection and try again." });
    }
  }

  if (state.phase === "done") {
    return (
      <div className="lp-aw-done" role="status" data-testid="unsubscribe-done">
        <strong>You&rsquo;re off the list.</strong>
        <span>We&rsquo;ve deleted your email address. You won&rsquo;t hear from us about Android.</span>
      </div>
    );
  }
  return (
    <div className="lp-aw-form">
      <div className="lp-aw-row">
        <button className="lp-btn" type="button" onClick={leave} disabled={state.phase === "sending"} data-testid="unsubscribe-button">
          {state.phase === "sending" ? "Leaving..." : "Leave the waitlist"}
        </button>
      </div>
      {state.phase === "error" && <p className="lp-aw-error" role="alert">{state.message}</p>}
    </div>
  );
}
