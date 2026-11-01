/** npm run app:test. The iPad's StudyTimerSessionTests, ported 1:1 where they apply, plus the web-only rules. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BREAK_SUGGESTIONS, CEILING, KINDS, SUGGESTION_SECONDS, STANDARD, adjustBreak, adjustCountdown, adjustWork, breakStage, breakSuggestion, canFinishPage,
  compactFace, countsUp, endBreak, extendBreak, face, faceCompact, faceHms, faceLong, finishPage, formatStudied, isPaused, isRunning, kindOf,
  libraryFocus, makeSettings, openRun, pageCounts, pause, phaseRemaining, resume, sanitiseSession, sanitiseSettings, setSubject, settle, settled,
  startSession, step, stop, withKind, workMs, type TimerEvent, type TimerSession, type TimerSettings,
} from "./timer";

const T0 = Date.UTC(2026, 9, 21, 10, 0, 0);
const at = (seconds: number) => T0 + seconds * 1000;
const pomodoro = (work = 25, rest = 5): TimerSettings => makeSettings("pomodoro", work, rest, null);
let n = 0;
const begin = (settings: TimerSettings, o: { subject?: string | null; rests?: boolean } = {}) =>
  startSession(settings, T0, { id: `s${n++}`, subject: o.subject ?? null, restsAfterBlock: o.rests });
const worked = (events: TimerEvent[]) => events.reduce((t, e) => (e.type === "worked" ? t + (e.end - e.start) : t), 0);
const near = (a: number, b: number, why?: string) => assert.ok(Math.abs(a - b) < 1, why ?? `${a} is not ${b}`);
const SUBJECTS = ["maths", "physics", "chemistry", "biology", null];

describe("the timer: wall time, and boundaries passed while nobody looked", () => {
  it("a count-up keeps counting while nothing watches", () => {
    const s = begin(STANDARD, { subject: "physics" });
    assert.ok(countsUp(s));
    near(workMs(s, at(3_600)), 3_600_000);
    assert.equal(face(s, at(3_725)), "1:02:05");
    assert.ok(isRunning(s, at(3_600)));
  });

  it("a count-up left running overnight is four hours, recorded up to the ceiling", () => {
    const { session, events } = settle(begin(STANDARD), at(12 * 3_600));
    near(worked(events), CEILING, "a forgotten timer was credited past the ceiling");
    assert.ok(events.some((e) => e.type === "finished" && e.at === at(4 * 3_600)));
    assert.ok(session.isOver);
  });

  it("a countdown finishes at its boundary", () => {
    const s = begin(makeSettings("timer", 25, 5, 40));
    assert.equal(face(s, at(60)), "39:00");
    assert.deepEqual(settle(s, at(5_000)).events, [{ type: "worked", start: T0, end: at(2_400) }, { type: "finished", at: at(2_400) }]);
  });

  it("a Timer that rests after its block takes its break, then waits", () => {
    const s = begin(makeSettings("timer", 25, 5, 40), { rests: true });
    assert.deepEqual(settle(s, at(5_000)).events, [
      { type: "worked", start: T0, end: at(2_400) }, { type: "phase", phase: "break", at: at(2_400) }, { type: "phase", phase: "break_over", at: at(2_700) },
    ]);
  });

  it("Pomodoro work ends at the boundary, not when looked at", () => {
    const { session, events } = settle(begin(pomodoro()), at(3_600));
    assert.deepEqual(events, [
      { type: "worked", start: T0, end: at(1_500) }, { type: "phase", phase: "break", at: at(1_500) }, { type: "phase", phase: "break_over", at: at(1_800) },
    ]);
    near(workMs(session, at(3_600)), 1_500_000);
    assert.equal(session.round, 1);
  });

  it("an unattended Pomodoro stops accruing: the next work waits for the student", () => {
    const s = settled(begin(pomodoro()), at(1_800));
    assert.equal(s.phase, "break_over");
    assert.ok(!isRunning(s, at(9_000)));
    near(workMs(s, at(9_000)), 1_500_000);
    const r = endBreak(s, at(9_000));
    assert.deepEqual(r.events, [{ type: "phase", phase: "work", at: at(9_000) }]);
    near(phaseRemaining(r.session, at(9_060)), 1_440_000);
  });

  it("a pause is never work, and pausing twice does not record twice", () => {
    const a = pause(begin(pomodoro()), at(600));
    const b = resume(a.session, at(1_800));                                  // twenty minutes paused
    const c = settle(b.session, at(2_700));                                  // 25 of work done at 2_700
    near(worked([...a.events, ...b.events, ...c.events]), 1_500_000, "the pause was counted");
    assert.equal(c.session.phase, "break");
    const first = pause(begin(STANDARD), at(100));
    const second = pause(first.session, at(200));
    near(worked(first.events), 100_000);
    assert.deepEqual(second.events, []);
  });

  it("skipping the break starts work now, and ending a break is never recorded as work", () => {
    const s = settled(begin(pomodoro()), at(1_560));                         // a minute into the break
    assert.equal(s.phase, "break");
    const r = endBreak(s, at(1_560));
    assert.deepEqual(r.events, [{ type: "phase", phase: "work", at: at(1_560) }]);
    near(workMs(r.session, at(1_620)), 1_560_000);
    assert.equal(worked(r.events), 0);
  });

  it("+5 min is wall clock, before the break ends and after", () => {
    const s = extendBreak(settled(begin(pomodoro()), at(1_620)), at(1_620)).session;   // two minutes into a five-minute break
    near(phaseRemaining(s, at(1_620)), 480_000);
    const done = settled(s, at(3_000));
    assert.equal(done.phase, "break_over");
    const r = extendBreak(done, at(3_000));
    assert.deepEqual(r.events, [{ type: "phase", phase: "break", at: at(3_000) }]);
    near(phaseRemaining(r.session, at(3_060)), 240_000);
  });

  it("lengths are used and clamped", () => {
    assert.deepEqual(settle(begin(pomodoro(50, 10)), at(3_600 + 600)).events, [
      { type: "worked", start: T0, end: at(3_000) }, { type: "phase", phase: "break", at: at(3_000) }, { type: "phase", phase: "break_over", at: at(3_600) },
    ]);
    const wild = makeSettings("timer", 900, 0, 10_000);
    assert.deepEqual([wild.workMinutes, wild.breakMinutes, wild.countdownMinutes], [90, 1, 240]);
  });

  it("the ceiling holds across Pomodoro rounds: the last page is cut short to fit, then the session ends", () => {
    let s = begin(pomodoro(90, 5));
    let now = T0, total = 0, finished = false;
    for (let i = 0; i < 6 && !s.isOver; i++) {
      now = s.clock.runningSince! + s.clock.duration;                       // exactly at the end of this work phase
      const r = settle(s, now + 1_000);
      total += worked(r.events);
      finished = r.events.some((e) => e.type === "finished");
      s = r.session;
      if (s.isOver) break;
      now += 10 * 60_000;                                                   // back after the break, ten minutes late
      s = endBreak(s, now).session;
    }
    assert.ok(s.isOver && finished);
    near(total, CEILING, "two 90 minute pages and one of 60 make exactly the ceiling");
    assert.equal(s.round, 3);
  });
});

describe("the lengths, and the + and - rule", () => {
  it("steps by ones then fives, back onto the grid", () => {
    const w: readonly [number, number] = [5, 90];
    assert.equal(step(25, true, w), 30);
    assert.equal(step(25, false, w), 20);
    assert.equal(step(12, true, w), 15);
    assert.equal(step(12, false, w), 10);
    assert.equal(step(7, true, [1, 30]), 8);
    assert.equal(step(10, false, [1, 30]), 9);
    assert.equal(step(9, true, [1, 30]), 10);
    assert.equal(step(10, true, [1, 30]), 15);
    assert.equal(step(90, true, w), 90);
    assert.equal(step(5, false, w), 5);
    assert.equal(step(30, true, [1, 30]), 30);
    assert.equal(step(1, false, [1, 30]), 1);
  });

  it("each adjuster moves its own length", () => {
    const s = pomodoro();
    assert.equal(adjustWork(s, true).workMinutes, 30);
    assert.equal(adjustBreak(s, false).breakMinutes, 4);
    assert.equal(adjustCountdown(withKind(s, "timer"), true).countdownMinutes, 30);
    assert.equal(adjustCountdown(STANDARD, true).countdownMinutes, 30, "a stopwatch starts a countdown from 25");
  });

  it("the three keys are views over the two stored modes and keep every length", () => {
    assert.deepEqual(KINDS.map((k) => [k.title, k.line]), [["Stopwatch", "counts up"], ["Timer", "counts down"], ["Pomodoro", "focus and breaks"]]);
    assert.equal(kindOf(STANDARD), "stopwatch");
    const t = withKind(makeSettings("timer", 40, 8, null), "timer");
    assert.deepEqual([kindOf(t), t.countdownMinutes, t.breakMinutes], ["timer", 40, 8]);
    assert.equal(kindOf(withKind(t, "pomodoro")), "pomodoro");
    assert.equal(withKind(withKind(t, "pomodoro"), "stopwatch").countdownMinutes, null);
  });
});

describe("Finish page", () => {
  it("counts only at 80% of the page", () => {
    assert.ok(!pageCounts(0, 25 * 60_000));
    assert.ok(!pageCounts(19 * 60_000, 25 * 60_000));
    assert.ok(pageCounts(20 * 60_000, 25 * 60_000));
    assert.ok(!pageCounts(5, 0));
    const s = begin(pomodoro());
    assert.ok(!canFinishPage(s, at(60)));
    assert.ok(canFinishPage(s, at(1_200)));
    assert.ok(!canFinishPage(begin(STANDARD), at(3_000)), "only a Pomodoro has pages");
  });

  it("four taps never make a page out of four seconds", () => {
    const s = begin(pomodoro());
    const r = finishPage(s, at(4));
    assert.deepEqual(r.events, []);
    assert.equal(r.session.phase, "work");
    assert.equal(r.session.round, 0);
  });

  it("banks and records only what was worked, and starts the break from now", () => {
    const s = begin(pomodoro());
    const r = finishPage(s, at(1_260));                                      // 21 of 25 minutes
    assert.deepEqual(r.events, [{ type: "worked", start: T0, end: at(1_260) }, { type: "phase", phase: "break", at: at(1_260) }]);
    assert.equal(r.session.round, 1);
    near(workMs(r.session, at(1_260)), 1_260_000, "the missing four minutes were credited");
    near(phaseRemaining(r.session, at(1_260)), 300_000);
  });

  it("does nothing on a break or once over", () => {
    const onBreak = settled(begin(pomodoro()), at(1_600));
    assert.deepEqual(finishPage(onBreak, at(1_600)).events, []);
    assert.deepEqual(finishPage(stop(begin(pomodoro()), at(1_400)).session, at(1_450)).events, []);
  });
});

describe("stop, setSubject, resume", () => {
  it("stop records the work so far and ends the session", () => {
    const r = stop(begin(pomodoro()), at(900));
    assert.deepEqual(r.events, [{ type: "worked", start: T0, end: at(900) }]);
    assert.ok(r.session.isOver);
    assert.deepEqual(stop(r.session, at(1_000)).events, [], "stopping twice records nothing more");
  });

  it("stop during a break records nothing new", () => {
    const r = stop(settled(begin(pomodoro()), at(1_600)), at(1_600));
    assert.equal(worked(r.events), 0);
    assert.ok(r.session.isOver);
  });

  it("a paused session does not resume past a finished clock, and a pause during a break holds it", () => {
    const b = pause(settled(begin(pomodoro()), at(1_560)), at(1_560));
    assert.ok(isPaused(b.session, at(2_000)));
    near(phaseRemaining(b.session, at(2_000)), 240_000);
    const r = resume(b.session, at(2_000));
    near(phaseRemaining(r.session, at(2_060)), 180_000);
  });

  it("changing subject records the work so far under the old one and carries on", () => {
    const s = begin(STANDARD, { subject: "physics" });
    const r = setSubject(s, "maths", at(600));
    assert.deepEqual(r.events, [{ type: "worked", start: T0, end: at(600) }]);
    assert.equal(r.session.subject, "maths");
    assert.equal(r.session.runStart, at(600));
    const done = stop(r.session, at(900));
    assert.deepEqual(done.events, [{ type: "worked", start: at(600), end: at(900) }]);
    assert.deepEqual(setSubject(s, "physics", at(10)).events, [], "the same subject is no change");
  });
});

describe("what the library is told", () => {
  it("focusing since the work phase began, only while work runs", () => {
    const s = begin(pomodoro(), { subject: "physics" });
    assert.deepEqual(libraryFocus(s, at(100)), { subject: "physics", since: T0 });
    const p = pause(s, at(600)).session;
    assert.equal(libraryFocus(p, at(700)), null, "paused is not focusing");
    const r = resume(p, at(1_200)).session;                                  // ten minutes done, resumed at 1_200
    assert.deepEqual(libraryFocus(r, at(1_300)), { subject: "physics", since: at(600) }, "others see minutes worked, not the pause");
    assert.equal(libraryFocus(settled(s, at(1_600)), at(1_600)), null, "a break is not focusing");
    assert.equal(libraryFocus(settled(s, at(9_000)), at(9_000)), null, "waiting is not focusing");
    assert.equal(libraryFocus(stop(s, at(10)).session, at(20)), null);
    assert.equal(libraryFocus(null, at(0)), null);
  });

  it("the focus start is the same on every look while the work runs", () => {
    const s = begin(pomodoro());
    assert.equal(libraryFocus(s, at(1))!.since, libraryFocus(s, at(1_000))!.since);
  });
});

describe("faces", () => {
  it("fit their places", () => {
    assert.equal(faceHms(0), "0:00:00");
    assert.equal(faceHms(3_725), "1:02:05");
    assert.equal(faceLong(59), "0:59");
    assert.equal(faceCompact(1_499), "24:59");
    assert.equal(faceCompact(3_900), "1h05");
    for (const sec of [0, 59, 1_499, 3_599, 3_600, 14_400]) assert.ok(faceCompact(sec).length <= 5, `the chip's face does not fit at ${sec}`);
    const s = begin(pomodoro());
    assert.equal(face(s, T0 + 400), "25:00", "a countdown rounds up, so it reads 25:00 at the start, not 24:59");
    assert.equal(compactFace(begin(STANDARD), at(3_700)), "1h01");
  });

  it("says studied time in whole minutes", () => {
    assert.deepEqual([0, 59_000, 60_000, 25 * 60_000, 60 * 60_000, 85 * 60_000, 120 * 60_000].map(formatStudied), ["0m", "0m", "1m", "25m", "1h", "1h 25m", "2h"]);
  });
});

describe("the break screen", () => {
  it("shows the card at zero", () => {
    const s = begin(pomodoro());
    assert.deepEqual(breakStage(s, at(600)), { stage: "none" });
    const b = breakStage(s, at(1_560));
    assert.equal(b.stage === "onBreak" && Math.round(b.remaining / 1000), 240);
    assert.deepEqual(breakStage(s, at(1_800)), { stage: "over" }, "the card did not appear at zero");
    const after = endBreak(settled(s, at(1_900)), at(1_900)).session;
    assert.deepEqual(breakStage(after, at(1_901)), { stage: "none" });
    assert.deepEqual(breakStage(null, T0), { stage: "none" });
  });

  it("suggestions rotate one at a time, short, and without an em dash", () => {
    const first = breakSuggestion(0);
    assert.equal(breakSuggestion(19), first);
    assert.notEqual(breakSuggestion(20), first);
    assert.equal(breakSuggestion(SUGGESTION_SECONDS * BREAK_SUGGESTIONS.length), first);
    for (const line of BREAK_SUGGESTIONS) {
      assert.ok(!line.includes("—"), `an em dash reaches a student: ${line}`);
      assert.ok(line.length <= 60, `not one short line: ${line}`);
    }
  });
});

describe("a stored value", () => {
  it("survives encoding, still counting", () => {
    let s = begin(pomodoro(), { subject: "biology" });
    s = pause(s, at(300)).session;
    s = resume(s, at(400)).session;
    const read = sanitiseSession(JSON.parse(JSON.stringify(s)), SUBJECTS);
    assert.deepEqual(read, s);
    near(workMs(read!, at(1_000)), 900_000);
  });

  it("is dropped when it is not a session, and held inside its limits when it nearly is", () => {
    assert.equal(sanitiseSession(null, SUBJECTS), null);
    assert.equal(sanitiseSession({ id: "x" }, SUBJECTS), null);
    const s = JSON.parse(JSON.stringify(begin(pomodoro())));
    assert.equal(sanitiseSession({ ...s, phase: "sleeping" }, SUBJECTS), null);
    assert.equal(sanitiseSession({ ...s, clock: { ...s.clock, duration: "long" } }, SUBJECTS), null);
    assert.equal(sanitiseSession({ ...s, subject: "knitting" }, SUBJECTS)!.subject, null, "an unknown subject is Other");
    assert.equal(sanitiseSession({ ...s, workBanked: 1e12 }, SUBJECTS)!.workBanked, CEILING);
    assert.deepEqual(sanitiseSettings({ mode: "pomodoro", workMinutes: 900, breakMinutes: "x" }), makeSettings("pomodoro", 90, 5, null));
    assert.deepEqual(sanitiseSettings(undefined), STANDARD);
  });

  it("a corrupt value can never spin the settle loop", () => {
    const s = begin(pomodoro());
    s.clock.duration = 0;
    s.breakLength = 0;
    const r = settle(s, at(5));
    assert.ok(r.events.length <= 64);
  });
});

describe("the open run", () => {
  it("is the work running now, nothing while paused or on a break", () => {
    const s = begin(pomodoro());
    assert.deepEqual(openRun(s, at(100)), { start: T0, end: at(100) });
    assert.equal(openRun(pause(s, at(100)).session, at(200)), null);
    assert.equal(openRun(s, at(1_600)), null, "on a break");
    assert.equal(openRun(null, at(1)), null);
  });
});

describe("types", () => {
  it("a session is plain JSON", () => {
    const s: TimerSession = begin(STANDARD);
    assert.equal(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s));
  });
});
