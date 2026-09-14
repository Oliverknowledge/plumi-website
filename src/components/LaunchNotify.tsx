"use client";

import { useId, useRef, useState } from "react";
import { waitlist } from "@/content/copy";
import { track } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";

/**
 * The secondary call to action: one email, sent on launch day.
 *
 * ── Why it sits beside Discord rather than replacing it ──────────────────────
 * Discord is the primary CTA and stays that way until the app ships: the value
 * of the next stretch is a small number of students we can actually watch use
 * Plumi, and an address on a list gives us none of that. But a Discord join is
 * unreachable for anyone who does not already use Discord, and it cannot reach
 * a parent, so the two are offered together and measured separately.
 *
 * ── It never fakes a success ────────────────────────────────────────────────
 * Every branch here either shows the success panel because the server said
 * `ok`, or shows the exact error for the code it returned — including the case
 * where persistence is not configured, which says so plainly and leaves what
 * was typed in the field. A list that quietly drops addresses is worse than no
 * list, because nobody finds out until the day it matters.
 *
 * ── Subject and board ───────────────────────────────────────────────────────
 * Optional, and pills rather than a `<select>`, because a native select on iOS
 * is a picker wheel and a picker wheel at eleven at night is a tap, a scroll, a
 * Done and a measurable number of students who never come back. They are worth
 * asking for: the topic tree for each specification is built by hand, so what
 * people ask for genuinely changes the order they get built in.
 */

type ErrorKey = keyof typeof waitlist.errors;

/** The API's `code` → the string a student sees. A map, so an unrecognised
 *  code cannot fall through to "success". */
const ERROR_FOR_CODE: Record<string, ErrorKey> = {
  invalid_email: "invalid",
  rate_limited: "rateLimited",
  unconfigured: "unconfigured",
  server_error: "server",
  bad_request: "server",
};

export function LaunchNotify({ placement }: { placement: string }) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [board, setBoard] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [joined, setJoined] = useState(false);

  const emailId = useId();
  const errorId = useId();
  const subjectId = useId();
  const boardId = useId();
  const field = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLParagraphElement>(null);
  const started = useRef(false);

  function noteStarted() {
    if (started.current) return;
    started.current = true;
    track("launch_notify_started", { placement });
  }

  function fail(code: string, key: ErrorKey) {
    setPending(false);
    setError(key);
    // The address itself never leaves the browser through this path.
    track("launch_notify_failed", { placement, code });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const address = email.trim();
    if (!address) {
      setError("empty");
      field.current?.focus();
      return;
    }

    setError(null);
    setPending(true);

    let response: Response;
    try {
      response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, subject, board, honeypot, attribution: getAttribution() }),
      });
    } catch {
      fail("network", "network");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { ok?: boolean; code?: string } | null;

    if (response.ok && payload?.ok === true) {
      setPending(false);
      setJoined(true);
      // Never the address, and never the course as free text — only whether one
      // was given, which is all the funnel needs.
      track("launch_notify_completed", { placement, has_course: Boolean(subject || board) });
      // Success replaces the form in place, so focus has to move deliberately.
      requestAnimationFrame(() => done.current?.focus());
      return;
    }

    const code = typeof payload?.code === "string" ? payload.code : `http_${response.status}`;
    fail(code, ERROR_FOR_CODE[code] ?? "server");
  }

  if (joined) {
    const course = [subject, board].filter(Boolean).join(waitlist.courseSeparator);
    return (
      <div className="notify-done" data-testid="launch-notify-done">
        <p ref={done} tabIndex={-1}><strong>{waitlist.successTitle}</strong></p>
        <p>{course ? waitlist.successBodyCourse.replace("{course}", course) : waitlist.successBodyGeneric}</p>
        <p className="notify-fine">{waitlist.successBody}</p>
      </div>
    );
  }

  return (
    <form className="notify-form" onSubmit={submit} noValidate data-testid="launch-notify-form">
      <div className="notify-row">
        <label htmlFor={emailId} className="sr-only">{waitlist.emailLabel}</label>
        <input
          ref={field}
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={waitlist.emailPlaceholder}
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={noteStarted}
          onChange={(e) => { setEmail(e.target.value); noteStarted(); }}
        />
        <button type="submit" className="story-button primary" disabled={pending} data-testid="launch-notify-submit">
          {pending ? waitlist.submitPending : "Notify me"}
        </button>
      </div>

      {/* Looks like a real field to a parser, is never seen and never read out. */}
      <div aria-hidden="true" className="notify-honeypot">
        <label htmlFor={`${emailId}-hp`}>{waitlist.honeypotLabel}</label>
        <input id={`${emailId}-hp`} name="school" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      {error && <p id={errorId} className="notify-error" role="alert" data-testid="launch-notify-error">{waitlist.errors[error]}</p>}

      <div className="notify-pills">
        <Pills id={subjectId} label={waitlist.subjectLabel} options={waitlist.subjects} value={subject} onChange={setSubject} />
        <Pills id={boardId} label={waitlist.boardLabel} options={waitlist.boards} value={board} onChange={setBoard} />
      </div>

      <p className="notify-fine">{waitlist.reassurance} {waitlist.privacy}</p>
    </form>
  );
}

/** A tappable radio group. Tapping the chosen pill again clears it, because the
 *  question is optional and there has to be a way back out of answering it. */
function Pills({ id, label, options, value, onChange }: { id: string; label: string; options: readonly string[]; value: string | null; onChange: (next: string | null) => void }) {
  return (
    <div className="pill-group">
      <span id={id} className="pill-label">{label} <i>{waitlist.optionalHint}</i></span>
      <div role="radiogroup" aria-labelledby={id}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={option === value}
            onClick={() => onChange(option === value ? null : option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
