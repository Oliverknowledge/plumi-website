"use client";

import { useState, type FormEvent } from "react";

import { track } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";

/**
 * The Android waitlist: one email field, posted to /api/waitlist as `platform: "android"`, which
 * writes the same Supabase table the iPad waitlist uses with `source = 'android'`.
 *
 * The page never says a student is on the list unless the server said so. Every failure is said in
 * plain words and leaves the form as it was, so they can try again.
 */
type State =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "done" }
  | { phase: "error"; message: string };

export function AndroidWaitlist() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [started, setStarted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.phase === "sending") return;
    setState({ phase: "sending" });
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, honeypot, platform: "android", attribution: getAttribution() }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (response.ok && body.ok) {
        track("launch_notify_completed", { platform: "android" });
        setState({ phase: "done" });
      } else {
        track("launch_notify_failed", { platform: "android", status: response.status });
        setState({ phase: "error", message: body.message ?? "Something went wrong. Try again in a moment." });
      }
    } catch {
      track("launch_notify_failed", { platform: "android", status: 0 });
      setState({ phase: "error", message: "Couldn't reach Plumi. Check your connection and try again." });
    }
  }

  if (state.phase === "done") {
    return (
      <div className="lp-aw-done" role="status" data-testid="android-waitlist-done">
        <strong>You&rsquo;re on the list.</strong>
        <span>We&rsquo;ll email you once, when Plumi is on Android.</span>
      </div>
    );
  }

  return (
    <form className="lp-aw-form" onSubmit={submit} noValidate data-testid="android-waitlist-form">
      <label className="lp-aw-label" htmlFor="android-email">Your email</label>
      <div className="lp-aw-row">
        <input
          id="android-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (!started) {
              setStarted(true);
              track("launch_notify_started", { platform: "android" });
            }
          }}
          aria-invalid={state.phase === "error"}
          aria-describedby={state.phase === "error" ? "android-error" : undefined}
          required
        />
        {/* A field no student sees. A bot that fills it is told it worked and nothing is written. */}
        <input
          className="lp-aw-hp"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
        <button className="lp-btn" type="submit" disabled={state.phase === "sending"}>
          {state.phase === "sending" ? "Joining..." : "Join the waitlist"}
        </button>
      </div>
      {state.phase === "error" && (
        <p id="android-error" className="lp-aw-error" role="alert">{state.message}</p>
      )}
    </form>
  );
}
