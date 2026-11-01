/** npm run app:test. The timer's store: the log, the London day, a reload, and two tabs. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, dayOf, startOfDay, weekStartOf } from "./time";
import { KEY, LOG_DAYS, createTimerStore, noticeOf, prune, record, reconcile, sanitiseDoc, workedThisWeek, workedToday, EMPTY_DOC, type Interval, type Notice } from "./timerStore";
import { CEILING, makeSettings, settle, startSession } from "./timer";

const MIN = 60_000, HOUR = 3_600_000;
/** Wednesday 21 October 2026, 10:00 BST (09:00 UTC). */
const T0 = Date.UTC(2026, 9, 21, 9, 0, 0);

class Disk {
  map = new Map<string, string>();
  writes = 0;
  broken = false;
  getItem = (k: string) => { if (this.broken) throw new Error("blocked"); return this.map.get(k) ?? null; };
  setItem = (k: string, v: string) => { if (this.broken) throw new Error("full"); if (this.map.get(k) !== v) this.writes++; this.map.set(k, v); };
}

/** A tab: its own store over a shared disk, with a clock the test moves. */
function tab(disk: Disk | null, clock: { t: number }, ids = "a") {
  let n = 0;
  const store = createTimerStore({ storage: disk, now: () => clock.t, id: () => `${ids}${n++}` });
  const notices: Notice[] = [];
  store.onNotice((x) => notices.push(x));
  return { store, notices, doc: () => store.snapshot().doc };
}
const pom = (w = 25, b = 5) => makeSettings("pomodoro", w, b, null);
const total = (log: Interval[]) => log.reduce((t, i) => t + (i.e - i.s), 0);

describe("the London day", () => {
  it("starts at midnight UK time, in summer and in winter", () => {
    assert.equal(startOfDay("2026-10-21"), Date.UTC(2026, 9, 20, 23, 0, 0), "BST: midnight is 23:00 UTC the evening before");
    assert.equal(startOfDay("2026-11-02"), Date.UTC(2026, 10, 2, 0, 0, 0), "GMT: midnight is midnight UTC");
    assert.equal(startOfDay("2026-10-25"), Date.UTC(2026, 9, 24, 23, 0, 0), "the day the clocks go back begins in BST");
    assert.equal(startOfDay("2026-10-26"), Date.UTC(2026, 9, 26, 0, 0, 0), "and the next in GMT: a 25 hour day between them");
    assert.equal(startOfDay("2026-03-29"), Date.UTC(2026, 2, 29, 0, 0, 0), "the day the clocks go forward begins in GMT");
    for (const iso of ["2026-03-28", "2026-03-29", "2026-03-30", "2026-10-24", "2026-10-25", "2026-10-26", "2026-12-25"]) {
      assert.equal(dayOf(startOfDay(iso)), iso);
      assert.notEqual(dayOf(startOfDay(iso) - 1), iso);
    }
  });
  it("starts the week on Monday", () => {
    assert.equal(weekStartOf("2026-10-21"), "2026-10-19");
    assert.equal(weekStartOf("2026-10-19"), "2026-10-19");
    assert.equal(weekStartOf("2026-10-25"), "2026-10-19", "Sunday is the last day of the week");
    assert.equal(weekStartOf("2026-10-26"), "2026-10-26");
  });
});

describe("the log", () => {
  it("records the same stretch once, however many times it is told", () => {
    const events = [{ type: "worked" as const, start: T0, end: T0 + 25 * MIN }];
    const once = record([], "physics", "s1", events);
    const twice = record(once, "physics", "s1", events);
    assert.equal(twice.length, 1);
    assert.equal(record(twice, "physics", "s2", events).length, 2, "another session's stretch is its own");
  });

  it("ignores a blink of work", () => {
    assert.deepEqual(record([], null, "s", [{ type: "worked", start: T0, end: T0 + 400 }]), []);
  });

  it("is capped to 90 London days", () => {
    const now = T0;
    const old: Interval = { id: "o", s: now - 95 * 24 * HOUR, e: now - 95 * 24 * HOUR + 30 * MIN, sub: null };
    const edge: Interval = { id: "e", s: startOfDay(addDays(dayOf(now), -LOG_DAYS)) + HOUR, e: startOfDay(addDays(dayOf(now), -LOG_DAYS)) + 2 * HOUR, sub: null };
    const recent: Interval = { id: "r", s: now - 2 * HOUR, e: now - HOUR, sub: null };
    assert.deepEqual(prune([old, edge, recent], now), [edge, recent]);
  });

  it("totals today by the London day, splitting a stretch at midnight", () => {
    const night: Interval = { id: "n", s: Date.UTC(2026, 9, 21, 22, 30), e: Date.UTC(2026, 9, 21, 23, 30), sub: null };   // 23:30 to 00:30 BST
    const doc = { log: [night], session: null };
    assert.equal(workedToday(doc, Date.UTC(2026, 9, 21, 21, 0)), 30 * MIN, "the evening half is Wednesday's");
    assert.equal(workedToday(doc, Date.UTC(2026, 9, 21, 23, 40)), 30 * MIN, "the half after midnight is Thursday's");
    assert.equal(workedToday(doc, Date.UTC(2026, 9, 21, 12, 0)), 30 * MIN, "noon on Thursday morning's side is Wednesday: the evening half again");
  });

  it("counts the run in progress, and only while work runs", () => {
    const run = startSession(pom(), T0, { id: "live" });
    const doc = { log: [{ id: "x", s: T0 - 2 * HOUR, e: T0 - HOUR, sub: null }], session: run };
    assert.equal(workedToday(doc, T0 + 10 * MIN), 70 * MIN);
    assert.equal(workedToday(doc, T0 + 27 * MIN), 60 * MIN + 25 * MIN, "the page is counted the moment it ends, before anything has recorded it");
    assert.equal(workedToday(doc, T0 + 40 * MIN), 60 * MIN + 25 * MIN, "and the break after it is not work");
  });

  it("totals the week from Monday, and a Sunday is still this week", () => {
    const mon: Interval = { id: "m", s: Date.UTC(2026, 9, 19, 8), e: Date.UTC(2026, 9, 19, 9), sub: null };
    const lastSun: Interval = { id: "l", s: Date.UTC(2026, 9, 18, 8), e: Date.UTC(2026, 9, 18, 9), sub: null };
    const doc = { log: [mon, lastSun], session: null };
    assert.equal(workedThisWeek(doc, Date.UTC(2026, 9, 21, 12)), HOUR);
    assert.equal(workedThisWeek(doc, Date.UTC(2026, 9, 25, 12)), HOUR, "Sunday 25th");
    assert.equal(workedThisWeek(doc, Date.UTC(2026, 9, 26, 12)), 0, "Monday 26th starts a new week");
  });
});

describe("a stored document", () => {
  it("drops what is not a document and keeps what is", () => {
    assert.deepEqual(sanitiseDoc(null, T0), EMPTY_DOC);
    assert.deepEqual(sanitiseDoc("junk", T0), EMPTY_DOC);
    const doc = sanitiseDoc({
      v: 1, settings: { mode: "pomodoro", workMinutes: 40, breakMinutes: 10, countdownMinutes: null }, subject: "physics", chime: false, notify: true,
      session: { nope: 1 },
      log: [
        { id: "a", s: T0 - HOUR, e: T0, sub: "physics" },
        { id: "a", s: T0 - HOUR, e: T0, sub: "physics" },          // the same stretch twice
        { id: "b", s: T0, e: T0 - 1, sub: null },                  // backwards
        { id: "c", s: T0, e: T0 + 10 * HOUR, sub: null },          // longer than any session may be
        { id: "d", s: T0 + 5 * HOUR, e: T0 + 6 * HOUR, sub: null }, // in the future
        { id: "e", s: T0 - 2 * HOUR, e: T0 - HOUR, sub: "knitting" },
        "junk", null, { id: 5 },
      ],
    }, T0);
    assert.deepEqual(doc.settings, makeSettings("pomodoro", 40, 10, null));
    assert.equal(doc.subject, "physics");
    assert.deepEqual([doc.chime, doc.notify, doc.session], [false, true, null]);
    assert.deepEqual(doc.log.map((i) => [i.id, i.sub]), [["a", "physics"], ["e", null]]);
  });
});

describe("one session, remembered settings", () => {
  it("starts with the remembered settings and is one at a time", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    a.store.setSettings(pom(40, 10));
    a.store.start({ subject: "physics" });
    const s = a.doc().session!;
    assert.deepEqual([s.mode, s.workLength, s.breakLength, s.subject], ["pomodoro", 40 * MIN, 10 * MIN, "physics"]);
    a.store.start({ subject: "maths" });
    assert.equal(a.doc().session, s, "starting again while one runs changes nothing");
  });

  it("remembers the settings and the subject between sessions", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    a.store.setSettings(pom(50, 10));
    a.store.start({ subject: "chemistry" });
    clock.t += 5 * MIN;
    a.store.stop();
    a.store.dismiss();
    const again = tab(disk, clock);
    assert.deepEqual(again.doc().settings, makeSettings("pomodoro", 50, 10, null));
    assert.equal(again.doc().subject, "chemistry");
    assert.equal(again.doc().session, null);
  });

  it("stop records the work so far and keeps a finished session to show until it is put away", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    a.store.start({ subject: "maths" });
    clock.t += 12 * MIN;
    a.store.stop();
    assert.equal(total(a.doc().log), 12 * MIN);
    assert.equal(a.doc().log[0].sub, "maths");
    assert.ok(a.doc().session!.isOver);
    a.store.stop();
    assert.equal(total(a.doc().log), 12 * MIN, "stopping again records nothing more");
    a.store.dismiss();
    assert.equal(a.doc().session, null);
    assert.equal(a.store.workedToday(clock.t), 12 * MIN);
    assert.equal(a.store.workedThisWeek(clock.t), 12 * MIN);
  });

  it("pause is not work, and the pause survives a reload", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    a.store.setSettings(pom());
    a.store.start({});
    clock.t += 10 * MIN;
    a.store.pause();
    clock.t += HOUR;
    const b = tab(disk, clock);                                       // a reload an hour later
    assert.ok(b.doc().session!.clock.runningSince === null);
    b.store.resume();
    clock.t += 15 * MIN;
    b.store.tick();
    assert.equal(b.doc().session!.phase, "break");
    assert.equal(total(b.doc().log), 25 * MIN, "ten before the pause and fifteen after");
  });

  it("changing subject mid-run records the old stretch under the old subject", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    a.store.start({ subject: "physics" });
    clock.t += 10 * MIN;
    a.store.setSubject("maths");
    clock.t += 5 * MIN;
    a.store.stop();
    assert.deepEqual(a.doc().log.map((i) => [i.sub, i.e - i.s]), [["physics", 10 * MIN], ["maths", 5 * MIN]]);
  });
});

describe("a reload", () => {
  it("resumes a session left running", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    a.store.setSettings(pom());
    a.store.start({ subject: "biology" });
    clock.t += 7 * MIN;
    const b = tab(disk, clock);
    assert.equal(b.doc().session!.phase, "work");
    assert.equal(b.doc().session!.subject, "biology");
    assert.equal(b.doc().log.length, 0, "nothing recorded while the work is still running");
  });

  it("records work only up to the boundary when the tab was closed past it", () => {
    const disk = new Disk(), clock = { t: T0 };
    tab(disk, clock).store.setSettings(pom());
    const a = tab(disk, clock);
    a.store.start({});
    clock.t += 3 * HOUR;                                              // closed for three hours
    const b = tab(disk, clock);
    assert.deepEqual(b.doc().log.map((i) => [i.s, i.e]), [[T0, T0 + 25 * MIN]]);
    assert.equal(b.doc().session!.phase, "break_over", "and it waits");
    assert.equal(b.notices.length, 0, "a reload does not announce what happened while it was closed");
    clock.t += 5 * HOUR;
    const c = tab(disk, clock);
    assert.equal(total(c.doc().log), 25 * MIN, "still 25 minutes five hours on");
  });

  it("holds a forgotten stopwatch to the ceiling", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    a.store.start({});
    clock.t += 14 * HOUR;
    const b = tab(disk, clock);
    assert.equal(total(b.doc().log), CEILING);
    assert.ok(b.doc().session!.isOver);
    assert.equal(b.store.workedToday(T0 + 4 * HOUR), CEILING, "all of it is that Wednesday's");
    assert.equal(b.store.workedToday(T0 + 14 * HOUR), 0, "and none of it is Thursday's");
  });

  it("survives a document it cannot read", () => {
    const disk = new Disk(), clock = { t: T0 };
    disk.map.set(KEY, "{not json");
    const a = tab(disk, clock);
    assert.deepEqual(a.doc().session, null);
    a.store.start({});
    assert.ok(a.doc().session);
  });
});

describe("two tabs", () => {
  it("both notice the same boundary: the work is recorded once and announced once", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock, "a"), b = tab(disk, clock, "b");
    a.store.setSettings(pom());
    a.store.start({ subject: "physics" });
    b.store.refresh();                                                // the storage event
    assert.equal(b.doc().session?.id, a.doc().session?.id);
    clock.t += 25 * MIN + 1000;
    a.store.tick(); b.store.tick();
    a.store.tick(); b.store.tick();
    assert.equal(total(a.doc().log), 25 * MIN);
    assert.equal(total(b.doc().log), 25 * MIN);
    assert.equal(a.notices.length + b.notices.length, 1, "one tab announced it");
    assert.deepEqual([a.notices[0]?.kind ?? b.notices[0]?.kind], ["break"]);
    assert.equal(JSON.parse(disk.map.get(KEY)!).log.length, 1);
  });

  it("both press Stop: recorded once", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock, "a"), b = tab(disk, clock, "b");
    a.store.start({});
    b.store.refresh();
    clock.t += 10 * MIN;
    a.store.stop();
    clock.t += 3000;
    b.store.stop();                                                    // b still thinks it is running until the event arrives
    assert.deepEqual(JSON.parse(disk.map.get(KEY)!).log.map((i: Interval) => i.e - i.s), [10 * MIN]);
  });

  it("a stale tab acts on what the other did, not on its old copy", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock, "a"), b = tab(disk, clock, "b");
    a.store.setSettings(pom());
    a.store.start({});
    b.store.refresh();
    clock.t += 5 * MIN;
    a.store.pause();
    clock.t += 20 * MIN;
    b.store.pause();                                                   // b's copy says running; the disk says paused
    assert.deepEqual(JSON.parse(disk.map.get(KEY)!).log.map((i: Interval) => i.e - i.s), [5 * MIN], "the twenty minutes of the pause were not counted");
  });

  it("two tabs started at once make one session", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock, "a"), b = tab(disk, clock, "b");
    a.store.start({});
    b.store.start({});                                                 // b has not heard yet
    assert.equal(JSON.parse(disk.map.get(KEY)!).session.id, "a0", "the first one stands");
  });

  it("does not echo: a tab that learns of a change writes nothing back", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock, "a"), b = tab(disk, clock, "b");
    a.store.start({});
    const before = disk.writes;
    b.store.refresh(); b.store.refresh();
    assert.equal(disk.writes, before);
  });
});

describe("without storage", () => {
  it("works for the visit", () => {
    const clock = { t: T0 };
    const a = tab(null, clock);
    a.store.start({});
    clock.t += 5 * MIN;
    a.store.stop();
    assert.equal(total(a.doc().log), 5 * MIN);
    assert.equal(a.store.snapshot().persisted, false);
  });

  it("works when storage refuses to be written", () => {
    const disk = new Disk(), clock = { t: T0 };
    const a = tab(disk, clock);
    disk.broken = true;
    a.store.start({});
    clock.t += 5 * MIN;
    a.store.stop();
    assert.equal(total(a.doc().log), 5 * MIN);
    assert.equal(a.store.snapshot().persisted, false);
  });
});

describe("what the clock announces", () => {
  const s = startSession(makeSettings("pomodoro", 25, 5, null), T0, { id: "n" });
  it("names the last thing that happened", () => {
    const events = settle(s, T0 + HOUR).events;
    assert.equal(noticeOf(events, s)?.kind, "break_over", "a long absence announces where it ended up");
    assert.equal(noticeOf(settle(s, T0 + 26 * MIN).events, s)?.kind, "break");
    assert.equal(noticeOf(settle(startSession(makeSettings("timer", 25, 5, 10), T0, { id: "t" }), T0 + HOUR).events, s)?.kind, "finished");
    assert.equal(noticeOf([], s), null);
  });
  it("is not made by the student's own presses", () => {
    const r = reconcile({ ...EMPTY_DOC, session: s }, T0 + 10 * MIN);
    assert.deepEqual(r.events, []);
  });
});
