"use client";

import { useEffect, useRef, useState } from "react";
import { SEAT_SUBJECTS, subjectName } from "@/lib/social/lobby";
import { subjectColour } from "@/lib/studyapp/model";
import {
  KINDS, adjustBreak, adjustCountdown, adjustWork, breakSuggestion, canFinishPage, countsUp, elapsedOf, face, formatStudied, kindOf, phaseElapsed,
  settled, withKind, type TimerKind, type TimerSession, type TimerSettings,
} from "@/lib/studyapp/timer";
import { timer, useTimer, workedThisWeek, workedToday, type TimerDoc } from "@/lib/studyapp/timerStore";

/** The subject's chip colour: the app's own task colours, by the name the library gives the subject. */
const colourOf = (label: string) => subjectColour(label === "Other" ? null : label);

export type View = "setup" | "work" | "paused" | "break" | "over";

/** Which card the session calls for. */
export function viewOf(session: TimerSession | null, now: number): View {
  if (!session) return "setup";
  const s = settled(session, now);
  if (s.isOver) return "setup";
  if (s.phase === "break_over") return "over";
  if (s.phase === "break") return "break";
  return s.clock.runningSince === null ? "paused" : "work";
}

/** "counts up", "Pomodoro 25 + 5": the remembered settings in a few words. */
export function describe(s: TimerSettings): string {
  const kind = kindOf(s);
  return kind === "stopwatch" ? "Stopwatch" : kind === "timer" ? `Timer ${s.countdownMinutes} min` : `Pomodoro ${s.workMinutes} + ${s.breakMinutes}`;
}

/** The phase and round, in the iPad's words: "Focus 2", "Break". */
export function phaseLabel(s: TimerSession): string {
  if (s.phase === "break") return "Break";
  if (s.phase === "break_over") return "Break over";
  return countsUp(s) ? "Stopwatch" : `Focus ${s.round + 1}`;
}

export function Totals({ doc, now }: { doc: TimerDoc; now: number }) {
  if (!now) return null;
  return (
    <p className="tm-totals" data-testid="timer-totals">
      <span>Studied today <b>{formatStudied(workedToday(doc, now))}</b></span>
      <span>This week <b>{formatStudied(workedThisWeek(doc, now))}</b></span>
    </p>
  );
}

function Stepper({ label, value, id, onLess, onMore }: { label: string; value: number; id: string; onLess: () => void; onMore: () => void }) {
  return (
    <div className="tm-step" data-testid={`step-${id}`}>
      <div>
        <span className="lbl">{label}</span>
        <b className="tm-val" data-testid={`val-${id}`}>{value} min</b>
      </div>
      <button type="button" className="btn icon tm-pm" aria-label={`Less ${label.toLowerCase()}`} onClick={onLess} data-testid={`less-${id}`}>{"−"}</button>
      <button type="button" className="btn icon tm-pm" aria-label={`More ${label.toLowerCase()}`} onClick={onMore} data-testid={`more-${id}`}>+</button>
    </div>
  );
}

/** Idle: the three keys, the lengths, what you are on, Start. */
function Setup({ doc, now }: { doc: TimerDoc; now: number }) {
  const settings = doc.settings;
  const kind = kindOf(settings);
  const [label, setLabel] = useState("");
  const set = (s: TimerSettings) => timer.setSettings(s);
  const over = doc.session?.isOver ? doc.session : null;
  return (
    <>
      {over && (
        <div className="tm-done" data-testid="timer-done">
          <b>Session done</b>
          <span>{formatStudied(doc.log.filter((i) => i.id === over.id).reduce((n, i) => n + (i.e - i.s), 0))} studied</span>
          <button type="button" className="btn ghost" onClick={() => timer.dismiss()}>Got it</button>
        </div>
      )}
      <div className="tm-kinds" role="group" aria-label="How to time it">
        {KINDS.map((k) => (
          <button key={k.id} type="button" className="tm-kind" aria-pressed={kind === k.id} onClick={() => set(withKind(settings, k.id as TimerKind))} data-testid={`kind-${k.id}`}>
            <b>{k.title}</b><small>{k.line}</small>
          </button>
        ))}
      </div>
      {kind === "timer" && <>
        <Stepper label="Length" id="length" value={settings.countdownMinutes ?? settings.workMinutes} onLess={() => set(adjustCountdown(settings, false))} onMore={() => set(adjustCountdown(settings, true))} />
        <Stepper label="Then a break of" id="break" value={settings.breakMinutes} onLess={() => set(adjustBreak(settings, false))} onMore={() => set(adjustBreak(settings, true))} />
      </>}
      {kind === "pomodoro" && <>
        <Stepper label="Focus" id="focus" value={settings.workMinutes} onLess={() => set(adjustWork(settings, false))} onMore={() => set(adjustWork(settings, true))} />
        <Stepper label="Break" id="break" value={settings.breakMinutes} onLess={() => set(adjustBreak(settings, false))} onMore={() => set(adjustBreak(settings, true))} />
      </>}
      <div className="tm-subjects" role="group" aria-label="What are you on?">
        {SEAT_SUBJECTS.map((s) => (
          <button key={s.label} type="button" className="chip tm-chip" aria-pressed={doc.subject !== undefined && doc.subject === s.id} onClick={() => timer.setSubject(s.id)}>
            <i style={{ background: colourOf(s.label) }} aria-hidden="true" />{s.label}
          </button>
        ))}
      </div>
      <input className="tm-label" value={label} maxLength={60} placeholder="What are you working on? (optional)" aria-label="What are you working on? (optional)"
        onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") timer.start({ label: label.trim() || null }); }} />
      <button type="button" className="btn gold tm-go" onClick={() => timer.start({ label: label.trim() || null })} data-testid="timer-start">Start</button>
      <Totals doc={doc} now={now} />
    </>
  );
}

/** Work, paused, break or waiting: the clock and what can be done to it. */
function Running({ doc, session, view, now }: { doc: TimerDoc; session: TimerSession; view: Exclude<View, "setup">; now: number }) {
  const s = settled(session, now);
  const subject = subjectName(s.subject);
  const sub = [subject, s.label].filter(Boolean).join(" · ");
  const length = s.clock.duration;
  const share = s.phase === "work" && countsUp(s) ? 0 : length > 0 ? Math.min(1, elapsedOf(s.clock, now) / length) : 0;
  return (
    <>
      <div className="tm-head">
        <span className="tm-phase" data-testid="timer-phase">{view === "paused" ? `${phaseLabel(s)} · paused` : phaseLabel(s)}</span>
        {sub && <span className="tm-sub">{sub}</span>}
      </div>
      {view === "over" ? (
        <p className="tm-big tm-ask" data-testid="timer-ask">Back to it?</p>
      ) : (
        <p className="tm-big" data-testid="timer-clock" aria-live="off">{face(s, now)}</p>
      )}
      {view !== "over" && !(s.phase === "work" && countsUp(s)) && <div className="tm-bar" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></div>}
      {view === "break" && <p className="tm-tip">{breakSuggestion(phaseElapsed(s, now) / 1000)}</p>}
      <div className="tm-acts">
        {view === "over" && <button type="button" className="btn gold" onClick={() => timer.endBreak()} data-testid="timer-continue">Continue studying</button>}
        {view === "break" && <button type="button" className="btn gold" onClick={() => timer.endBreak()} data-testid="timer-endbreak">End break</button>}
        {(view === "break" || view === "over") && <button type="button" className="btn" onClick={() => timer.extendBreak()} data-testid="timer-plus5">+5 min</button>}
        {view === "work" && <button type="button" className="btn gold" onClick={() => timer.pause()} data-testid="timer-pause">Pause</button>}
        {view === "paused" && <button type="button" className="btn gold" onClick={() => timer.resume()} data-testid="timer-resume">Resume</button>}
        {view === "work" && canFinishPage(s, now) && <button type="button" className="btn" onClick={() => timer.finishPage()} data-testid="timer-finish">Finish page</button>}
        {view !== "over" && view !== "break" && <button type="button" className="btn" onClick={() => timer.stop()} data-testid="timer-stop">Stop</button>}
        {(view === "break" || view === "over") && <button type="button" className="btn ghost" onClick={() => timer.stop()} data-testid="timer-stop">Stop</button>}
      </div>
      {view === "work" && <SubjectRow doc={doc} />}
      <Totals doc={doc} now={now} />
    </>
  );
}

/** While work runs the subject can still be changed; the work so far is kept under the old one. */
function SubjectRow({ doc }: { doc: TimerDoc }) {
  return (
    <div className="tm-subjects" role="group" aria-label="What are you on?">
      {SEAT_SUBJECTS.map((s) => (
        <button key={s.label} type="button" className="chip tm-chip" aria-pressed={doc.subject !== undefined && doc.session?.subject === s.id} onClick={() => timer.setSubject(s.id)}>
          <i style={{ background: colourOf(s.label) }} aria-hidden="true" />{s.label}
        </button>
      ))}
    </div>
  );
}

/** Sound and notification choices: small, at the bottom, off by the student's say-so. */
function Options({ doc }: { doc: TimerDoc }) {
  const [askable] = useState(() => typeof Notification !== "undefined" && Notification.permission !== "denied");
  const notifyOn = doc.notify && askable && typeof Notification !== "undefined" && Notification.permission === "granted";
  const toggleNotify = async () => {
    try {
      if (notifyOn) { timer.setNotify(false); return; }
      const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();   // asked here, on the tap, never on load
      timer.setNotify(p === "granted");
    } catch { timer.setNotify(false); }
  };
  return (
    <div className="tm-opts">
      <button type="button" className="btn ghost tm-opt" aria-pressed={doc.chime} onClick={() => timer.setChime(!doc.chime)} data-testid="timer-chime">{doc.chime ? "Chime on" : "Chime off"}</button>
      {askable && <button type="button" className="btn ghost tm-opt" aria-pressed={notifyOn} onClick={() => void toggleNotify()} data-testid="timer-notify">{notifyOn ? "Notifications on" : "Notify me"}</button>}
    </div>
  );
}

/** The card the chip opens. */
export function TimerPanel({ now, onClose, id }: { now: number; onClose: () => void; id: string }) {
  const { doc, ready } = useTimer();
  const root = useRef<HTMLDivElement>(null);
  const view = viewOf(doc.session, now);
  // When the card changes under the student's finger (Start becomes Pause), focus stays in the card instead of falling to the page.
  useEffect(() => {
    const el = root.current;
    if (el && (!document.activeElement || document.activeElement === document.body)) el.focus({ preventScroll: true });
  }, [view]);
  return (
    <div className="card tm-pop" id={id} ref={root} tabIndex={-1} role="dialog" aria-label="Study timer" data-testid="timer-panel" data-view={view}>
      <div className="tm-top">
        <h2>Study timer</h2>
        <button type="button" className="btn ghost icon" aria-label="Close timer" onClick={onClose} data-testid="timer-close">{"×"}</button>
      </div>
      {!ready ? null : view === "setup" ? <Setup doc={doc} now={now} /> : <Running doc={doc} session={doc.session!} view={view} now={now} />}
      {ready && <Options doc={doc} />}
    </div>
  );
}
