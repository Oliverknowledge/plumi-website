"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Mascot } from "@/components/ui/Mascot";
import { Section } from "@/components/ui/Section";
import { sections, waitlist } from "@/content/copy";
import { track } from "@/lib/analytics";
import { getAttribution } from "@/lib/attribution";

/**
 * The close, and the only form on the site.
 *
 * Three decisions worth defending:
 *
 *  1. **Subject and board are pills, not a `<select>`.** A native select on iOS
 *     is a picker wheel; a picker wheel at eleven at night is a tap, a scroll, a
 *     Done and a measurable number of students who never come back to the form.
 *     Both groups are optional — an email on its own is a complete submission.
 *
 *  2. **A failure is never dressed as a success.** Every branch below either
 *     shows the success panel because the server said `ok`, or shows the exact
 *     error for the code the server returned. If persistence is not configured
 *     the student is told so, and what they typed is left in the field. A
 *     waitlist that quietly drops addresses is worse than no waitlist, because
 *     nobody finds out until launch day.
 *
 *  3. **The bird is asleep.** Every other waitlist confetti-cannons at you and
 *     then asks you to tweet about it. Plumi's whole habit layer is a bird that
 *     goes to sleep rather than nagging; celebrating an email address would be
 *     out of character on the one screen where character is all we have.
 */

type ErrorKey = keyof typeof waitlist.errors;

/**
 * The API's `code` → the string a student sees. Kept as a map rather than a
 * switch so an unrecognised code cannot silently fall through to "success".
 */
const ERROR_FOR_CODE: Record<string, ErrorKey> = {
  invalid_email: "invalid",
  rate_limited: "rateLimited",
  unconfigured: "unconfigured",
  server_error: "server",
  bad_request: "server",
};

const fieldBase =
  "w-full rounded-[var(--radius-control)] border bg-[var(--color-elevated-dark)] " +
  "border-[var(--color-hairline-dark)] px-4 text-[var(--color-ink-inverse)] " +
  "placeholder:text-[var(--color-ink-inverse-tertiary)] transition-colors duration-150 " +
  "hover:border-[var(--color-ink-inverse-tertiary)] focus-visible:border-[var(--color-blue-400)] " +
  // Plumi blue at 2:1 against #0d0e11 is not a focus ring anyone can see. On the
  // dark panel the ring steps up the ramp; everywhere else the global rule wins.
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-blue-300)]";

/** A tappable radio group. Arrow keys move and select, exactly as radios do. */
function PillGroup({
  labelId,
  options,
  value,
  onChange,
}: {
  labelId: string;
  options: readonly string[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  // Roving tabindex: one stop for the whole group, on the chosen pill if there
  // is one. Tabbing lands on the answer, not on the first option.
  const selectedIndex = value === null ? -1 : options.indexOf(value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  function move(index: number, delta: number) {
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!);
    buttons.current[next]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(index, -1);
        break;
      case "Home":
        event.preventDefault();
        move(-1, 1);
        break;
      case "End":
        event.preventDefault();
        move(0, -1);
        break;
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="mt-3 flex flex-wrap gap-2">
      {options.map((option, index) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === tabStop ? 0 : -1}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            // Tapping the chosen pill again clears it. The question is optional,
            // so there has to be a way back out of having answered it.
            onClick={() => onChange(selected ? null : option)}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out-soft)] active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-blue-300)] ${
              selected
                ? "border-[var(--color-blue-500)] bg-[var(--color-blue-600)] font-medium text-white"
                : "border-[var(--color-hairline-dark)] bg-[var(--color-elevated-dark)] text-[var(--color-ink-inverse-secondary)] hover:border-[var(--color-ink-inverse-tertiary)] hover:text-[var(--color-ink-inverse)]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [board, setBoard] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [joined, setJoined] = useState(false);

  const emailId = useId();
  const subjectLabelId = useId();
  const boardLabelId = useId();
  const errorId = useId();

  const emailField = useRef<HTMLInputElement>(null);
  const successPanel = useRef<HTMLDivElement>(null);
  const startedFired = useRef(false);

  // Success replaces the form in place, so focus has to be moved deliberately
  // or a keyboard user is left focused on a button that no longer exists.
  useEffect(() => {
    if (joined) successPanel.current?.focus();
  }, [joined]);

  function noteStarted() {
    if (startedFired.current) return;
    startedFired.current = true;
    track("waitlist_started");
  }

  function fail(code: string, key: ErrorKey) {
    setPending(false);
    setError(key);
    // The email address itself never leaves the browser through this path.
    track("waitlist_failed", { code });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const address = email.trim();
    if (!address) {
      setError("empty");
      track("waitlist_failed", { code: "empty" });
      emailField.current?.focus();
      return;
    }

    setError(null);
    setPending(true);

    let response: Response;
    try {
      response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          subject,
          board,
          honeypot,
          attribution: getAttribution(),
        }),
      });
    } catch {
      // Offline, DNS, a blocked request. Nothing the student did.
      fail("network", "network");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; code?: string }
      | null;

    if (response.ok && payload?.ok === true) {
      setPending(false);
      setJoined(true);
      track("waitlist_completed", { has_course: Boolean(subject || board) });
      return;
    }

    const code = typeof payload?.code === "string" ? payload.code : `http_${response.status}`;
    fail(code, ERROR_FOR_CODE[code] ?? "server");
  }

  const course = [subject, board].filter(Boolean).join(waitlist.courseSeparator);

  return (
    <Section copy={sections.close} tone="dark" centred>
      <div className="mx-auto max-w-2xl">
        {joined ? (
          <div
            ref={successPanel}
            role="status"
            tabIndex={-1}
            className="rounded-[var(--radius-sheet)] border border-[var(--color-hairline-dark)] bg-[var(--color-elevated-dark)] px-6 py-9 text-center sm:px-10"
          >
            {/* Asleep, not celebrating. See the note at the top of this file. */}
            <Mascot pose="sleeping" size={140} className="mx-auto" />

            <h3 className="mt-4 text-h3 font-medium text-[var(--color-ink-inverse)]">
              {waitlist.successTitle}
            </h3>

            <p className="mx-auto mt-4 max-w-md text-[var(--color-ink-inverse-secondary)] text-pretty">
              {course
                ? waitlist.successBodyCourse.replace("{course}", course)
                : waitlist.successBodyGeneric}
            </p>

            <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-ink-inverse-secondary)] text-pretty">
              {waitlist.successBody}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="rounded-[var(--radius-sheet)] border border-[var(--color-hairline-dark)] bg-[color-mix(in_srgb,var(--color-elevated-dark)_60%,transparent)] p-6 text-left sm:p-8">
              <label
                htmlFor={emailId}
                className="block text-sm font-medium text-[var(--color-ink-inverse)]"
              >
                {waitlist.emailLabel}
              </label>

              <input
                id={emailId}
                ref={emailField}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={waitlist.emailPlaceholder}
                value={email}
                disabled={pending}
                aria-invalid={error === "empty" || error === "invalid"}
                aria-describedby={error ? errorId : undefined}
                onFocus={noteStarted}
                onChange={(event) => {
                  noteStarted();
                  setEmail(event.target.value);
                }}
                className={`${fieldBase} mt-2 h-12 text-base`}
              />

              {/* The honeypot. Off-screen rather than display:none, because the
                  crawlers worth stopping skip fields that are display:none —
                  and hidden from assistive technology so no student ever meets
                  it. The API answers a filled one with a polite fake success. */}
              <div
                aria-hidden="true"
                className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
              >
                <label htmlFor={`${emailId}-school`}>{waitlist.honeypotLabel}</label>
                <input
                  id={`${emailId}-school`}
                  name="school"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                />
              </div>

              <fieldset className="mt-7 border-0 p-0">
                <legend className="text-sm font-medium text-[var(--color-ink-inverse)]">
                  {waitlist.studyingLabel}
                </legend>
                <p className="mt-1 text-sm text-[var(--color-ink-inverse-secondary)]">
                  {waitlist.studyingHelper}
                </p>

                <div className="mt-5">
                  <span
                    id={subjectLabelId}
                    className="eyebrow !text-[var(--color-blue-300)] block"
                  >
                    {waitlist.subjectLabel}
                    <span className="ml-2 font-medium tracking-normal text-[var(--color-ink-inverse-tertiary)] normal-case">
                      {waitlist.optionalHint}
                    </span>
                  </span>
                  <PillGroup
                    labelId={subjectLabelId}
                    options={waitlist.subjects}
                    value={subject}
                    onChange={setSubject}
                  />
                </div>

                <div className="mt-6">
                  <span id={boardLabelId} className="eyebrow !text-[var(--color-blue-300)] block">
                    {waitlist.boardLabel}
                    <span className="ml-2 font-medium tracking-normal text-[var(--color-ink-inverse-tertiary)] normal-case">
                      {waitlist.optionalHint}
                    </span>
                  </span>
                  <PillGroup
                    labelId={boardLabelId}
                    options={waitlist.boards}
                    value={board}
                    onChange={setBoard}
                  />
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={pending}
                // Not <CtaButton>: that renders a <Link>, and the one control on
                // this site that submits something has to be a real submit
                // button. Shape, height and press behaviour are kept identical.
                className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-[var(--color-blue-600)] px-7 text-lg font-medium text-white shadow-[var(--shadow-resting)] transition-[transform,opacity,background-color] duration-150 ease-[var(--ease-out-soft)] hover:bg-[var(--color-blue-700)] active:scale-[0.97] active:opacity-[0.86] disabled:cursor-progress disabled:opacity-70 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-blue-300)]"
              >
                {pending ? waitlist.submitPending : waitlist.submitIdle}
              </button>

              {/* Always in the tree so the live region exists before it has
                  anything to say — a role="alert" added at the same moment as
                  its text is announced unreliably. */}
              <div id={errorId} role="alert" aria-live="assertive" className="empty:hidden">
                {error && (
                  <p className="mt-4 rounded-[var(--radius-control)] border-l-2 border-[var(--color-incorrect)] bg-[color-mix(in_srgb,var(--color-incorrect)_16%,transparent)] px-4 py-3 text-sm text-[var(--color-ink-inverse)]">
                    {waitlist.errors[error]}
                  </p>
                )}
              </div>

              <p className="mt-6 text-sm text-[var(--color-ink-inverse-secondary)] text-pretty">
                {waitlist.reassurance}
              </p>
              <p className="mt-1.5 text-sm text-[var(--color-ink-inverse-tertiary)] text-pretty">
                {waitlist.privacy}
              </p>
            </div>
          </form>
        )}
      </div>
    </Section>
  );
}
