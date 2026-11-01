/** npm run app:test */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCard, addDeck, addStarters, addTask, continueTarget, deckStats, deleteCard, deleteDeck, dueNow, EMPTY, editCard, examDays, exportDeck, gradeCard, importCards,
  leftToday, parseCards, reviewStreak, sanitise, setExam, setPerDay, subjectIn, tasksFor, toggleTask, weekChoices, type AppData,
} from "./model";
import { QUOTES, quoteFor } from "./quotes";
import { STARTER_DECKS } from "./starterDecks";
import { addDays, dayOf, daysBetween, dueLabel, greeting, hourOf, isEvening, longDate, weekdayShort } from "./time";

const T = Date.UTC(2026, 10, 1, 10, 0, 0); // Sunday 1 November 2026, 10:00 GMT
const TODAY = "2026-11-01";
const withDeck = (): { data: AppData; deckId: string } => {
  const r = addDeck(EMPTY, "Chemistry · Rates", T);
  return { data: r.data, deckId: r.deck!.id };
};

describe("London days", () => {
  it("counts the day in UK time, not UTC", () => {
    assert.equal(dayOf(Date.UTC(2026, 6, 1, 23, 30)), "2026-07-02", "23:30 UTC in July is already tomorrow in London");
    assert.equal(dayOf(Date.UTC(2026, 10, 1, 23, 30)), "2026-11-01", "and in November it is not");
  });
  it("does day arithmetic across the clocks changing", () => {
    assert.equal(addDays("2026-10-24", 2), "2026-10-26");
    assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2);
    assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
    assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  });
  it("names the weekday, the long date and the greeting", () => {
    assert.equal(weekdayShort("2026-11-02"), "Mon");
    assert.equal(longDate(T), "Sunday 1 November");
    assert.equal(greeting(Date.UTC(2026, 10, 1, 8, 0)), "Good morning.");
    assert.equal(greeting(Date.UTC(2026, 10, 1, 13, 0)), "Good afternoon.");
    assert.equal(greeting(Date.UTC(2026, 10, 1, 19, 0)), "Good evening.");
    assert.equal(hourOf(Date.UTC(2026, 6, 1, 23, 30)), 0, "the London hour, not the UTC one");
  });
  it("shows the evening room from six until five", () => {
    assert.ok(!isEvening(Date.UTC(2026, 10, 1, 12, 0)));
    assert.ok(isEvening(Date.UTC(2026, 10, 1, 18, 0)));
    assert.ok(isEvening(Date.UTC(2026, 10, 2, 2, 0)));
    assert.ok(!isEvening(Date.UTC(2026, 10, 2, 5, 0)));
  });
  it("words a due date for the list", () => {
    assert.deepEqual(["2026-10-30", "2026-11-01", "2026-11-03", "2026-11-20"].map((d) => dueLabel(d, TODAY)), ["overdue", "today", "Tue", "20 Nov"]);
  });
});

describe("the daily quote", () => {
  it("is the same all day and always a real, attributed line", () => {
    assert.deepEqual(quoteFor(TODAY), quoteFor(TODAY));
    for (const q of QUOTES) assert.ok(q.text.length > 10 && q.by.length > 2 && !/[–—]/.test(q.text));
  });
});

describe("to do", () => {
  it("adds, trims, and finds a subject in the words", () => {
    const d = addTask(EMPTY, "  Chemistry   homework Q4-7 ", TODAY, T);
    assert.equal(d.tasks[0].text, "Chemistry homework Q4-7");
    assert.equal(d.tasks[0].subject, "Chemistry");
    assert.equal(addTask(d, "   ", TODAY, T).tasks.length, 1, "an empty task is not added");
    assert.equal(addTask(EMPTY, "x".repeat(300), TODAY, T).tasks[0].text.length, 140);
    assert.equal(subjectIn("Further Maths exercise 2B"), "Further Maths");
    assert.equal(subjectIn("revise maths"), "Maths");
    assert.equal(subjectIn("tidy my room"), null);
  });
  it("puts what is due today or late under Today, the next six days under This week, and finished work under Done", () => {
    let d = EMPTY;
    d = addTask(d, "late", "2026-10-30", T);
    d = addTask(d, "today", TODAY, T);
    d = addTask(d, "tomorrow", "2026-11-02", T);
    d = addTask(d, "friday", "2026-11-06", T);
    const names = (tab: "today" | "week" | "done") => tasksFor(d, tab, TODAY).map((t) => t.text);
    assert.deepEqual(names("today"), ["late", "today"]);
    assert.deepEqual(names("week"), ["tomorrow", "friday"]);
    assert.equal(leftToday(d, TODAY), 2);
    d = toggleTask(d, d.tasks[1].id, T);
    assert.deepEqual(names("today"), ["late", "today"], "a task ticked today stays on Today, after the open ones");
    assert.equal(leftToday(d, TODAY), 1, "but no longer counts as left");
    assert.deepEqual(names("done"), ["today"]);
    assert.deepEqual(tasksFor(d, "today", "2026-11-02").map((t) => t.text), ["late", "tomorrow"], "the ticked one is gone from Today the next day, and what was due that day has arrived");
    d = toggleTask(d, d.tasks[1].id, T);
    assert.deepEqual(names("done"), [], "unticking puts it back");
    assert.equal(leftToday(d, TODAY), 2);
  });
  it("offers the next six days for This week", () => {
    const c = weekChoices(TODAY, weekdayShort);
    assert.deepEqual(c.map((x) => x[1]), ["Tomorrow", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    assert.equal(c[0][0], "2026-11-02");
  });
});

describe("the exam countdown", () => {
  it("counts the days, and goes quiet once it has passed", () => {
    const d = setExam(EMPTY, { name: "  Further Maths P1 ", date: "2027-06-03" });
    assert.equal(d.exam?.name, "Further Maths P1");
    assert.equal(examDays(d, TODAY), 214);
    assert.equal(examDays(d, "2027-06-03"), 0);
    assert.equal(examDays(d, "2027-06-04"), null);
    assert.equal(examDays(EMPTY, TODAY), null);
  });
  it("refuses an exam with no name or a bad date", () => {
    assert.equal(setExam(EMPTY, { name: "", date: "2027-06-03" }).exam, null);
    assert.equal(setExam(EMPTY, { name: "x", date: "June" }).exam, null);
    assert.equal(setExam(setExam(EMPTY, { name: "x", date: "2027-06-03" }), null).exam, null);
  });
});

describe("decks and cards", () => {
  it("adds, edits (keeping the schedule), and deletes", () => {
    const made = withDeck();
    let data = made.data;
    const deckId = made.deckId;
    data = addCard(data, deckId, " Why? ", " Because. ", T);
    assert.deepEqual([data.cards[0].front, data.cards[0].back], ["Why?", "Because."]);
    const graded = gradeCard(data, data.cards[0].id, 3, T);
    const edited = editCard(graded, data.cards[0].id, "Why so?", "Because.");
    assert.equal(edited.cards[0].front, "Why so?");
    assert.deepEqual(edited.cards[0].sch, graded.cards[0].sch, "fixing a typo keeps what was learned");
    assert.equal(addCard(data, deckId, "", "x", T).cards.length, 1, "a card needs both sides");
    assert.equal(addCard(data, "nope", "a", "b", T).cards.length, 1, "and a deck that exists");
    assert.equal(deleteCard(data, data.cards[0].id).cards.length, 0);
    assert.equal(deleteDeck(data, deckId).cards.length, 0, "deleting a deck deletes its cards");
  });
  it("adds each starter deck once, only when asked, and every card is complete", () => {
    assert.deepEqual(EMPTY.decks, []);
    let d = addStarters(EMPTY, ["chem-carbonyls", "phys-mechanics"], T);
    assert.equal(d.decks.length, 2);
    assert.equal(d.cards.length, 20);
    d = addStarters(d, ["chem-carbonyls", "nonsense"], T);
    assert.equal(d.decks.length, 2, "not twice, and an unknown id is ignored");
    for (const s of STARTER_DECKS) {
      assert.ok(s.cards.length >= 10);
      for (const [f, b] of s.cards) assert.ok(f.length > 5 && b.length > 1 && !/[—]/.test(f + b), f);
    }
    assert.equal(new Set(STARTER_DECKS.flatMap((s) => s.cards.map((c) => c[0]))).size, STARTER_DECKS.reduce((n, s) => n + s.cards.length, 0), "no repeated question");
  });
  it("reads pasted cards split by a tab, a semicolon or a bar, and counts what it skipped", () => {
    const r = parseCards("What is x?\tAnswer one\nQ two; A two\nQ three | A three\n\nno separator here\n;missing front");
    assert.deepEqual(r.cards, [["What is x?", "Answer one"], ["Q two", "A two"], ["Q three", "A three"]]);
    assert.equal(r.skipped, 2);
    const { data, deckId } = withDeck();
    const done = importCards(data, deckId, "a;b\nc;d\nbad", T);
    assert.deepEqual([done.added, done.skipped, done.data.cards.length], [2, 1, 2]);
  });
});

describe("reviewing", () => {
  it("counts a graded card, a new card started, and where the student was", () => {
    const made = withDeck();
    let data = made.data;
    const deckId = made.deckId;
    data = addCard(data, deckId, "q1", "a1", T);
    data = addCard(data, deckId, "q2", "a2", T + 1);
    const after = gradeCard(data, data.cards[0].id, 3, T);
    assert.deepEqual(after.log[TODAY], { n: 1, right: 1, fresh: 1 });
    assert.equal(after.last?.kind, "cards");
    assert.equal(after.cards[0].sch.state, "learning");
    const again = gradeCard(after, after.cards[0].id, 1, T + 1000);
    assert.deepEqual(again.log[TODAY], { n: 2, right: 1, fresh: 1 }, "grading it again does not start another new card");
  });
  it("stops introducing new cards at the daily cap, counting cards already started", () => {
    const made = withDeck();
    let data = made.data;
    const deckId = made.deckId;
    for (let i = 0; i < 15; i++) data = addCard(data, deckId, `q${i}`, `a${i}`, T + i);
    assert.equal(dueNow(data, T).fresh, 10);
    for (let i = 0; i < 4; i++) data = gradeCard(data, data.cards[i].id, 4, T);
    assert.equal(dueNow(data, T).fresh, 6, "four started, six left of the ten");
    assert.equal(dueNow({ ...data, perDay: 3 }, T).fresh, 0);
  });
  it("brings an Again card back, and a Good card in a day", () => {
    const made = withDeck();
    let data = made.data;
    const deckId = made.deckId;
    data = addCard(data, deckId, "q", "a", T);
    const id = data.cards[0].id;
    data = gradeCard(data, id, 1, T);
    assert.equal(dueNow(data, T).due, 0, "not yet");
    assert.equal(dueNow(data, T + 61_000).due, 1, "a minute on");
    assert.deepEqual(deckStats(data, deckId, T + 61_000), { total: 1, due: 1, fresh: 0, learning: 1, mature: 0 });
  });
  it("says what Continue should be", () => {
    assert.deepEqual(continueTarget(EMPTY, T), { label: "Enter the Grand Library", href: "/study/library" });
    const made = withDeck();
    let data = made.data;
    const deckId = made.deckId;
    data = addCard(addCard(data, deckId, "q1", "a1", T), deckId, "q2", "a2", T);
    assert.deepEqual(continueTarget(data, T), { label: "Start · 2 flashcards", href: "/study/flashcards" });
    const graded = gradeCard(data, data.cards[0].id, 4, T);
    assert.equal(continueTarget(graded, T).label, "Continue · Chemistry · Rates");
    const finished = gradeCard(graded, graded.cards[1].id, 4, T);
    assert.equal(continueTarget(finished, T).label, "Enter the Grand Library", "nothing left to continue");
  });
});

describe("what comes out of storage", () => {
  it("survives anything", () => {
    for (const bad of [null, undefined, 5, "x", [], {}, { v: 2 }]) assert.deepEqual(sanitise(bad), EMPTY);
    const odd = sanitise({ v: 1, tasks: [{ id: 1 }, { id: "t", text: "ok", due: TODAY }], decks: [{ id: "d", title: "T" }, null], cards: [{ id: "c", deckId: "gone", sch: { due: 1 } }, "x"], exam: { name: 5 }, perDay: 9999 });
    assert.deepEqual([odd.tasks.length, odd.decks.length, odd.cards.length, odd.exam, odd.perDay], [1, 1, 0, null, 10]);
  });
  it("round-trips through JSON", () => {
    const made = withDeck();
    let data = made.data;
    const deckId = made.deckId;
    data = gradeCard(addCard(data, deckId, "q", "a", T), addCard(data, deckId, "q", "a", T).cards[0]?.id ?? "", 3, T);
    data = addTask(setExam(addCard(data, deckId, "x", "y", T), { name: "P1", date: "2027-06-03" }), "task", TODAY, T);
    assert.deepEqual(sanitise(JSON.parse(JSON.stringify(data))), data);
  });
});

describe("settings, streak and export", () => {
  it("clamps new cards a day", () => {
    assert.equal(setPerDay(EMPTY, 25).perDay, 25);
    assert.equal(setPerDay(EMPTY, -4).perDay, 0);
    assert.equal(setPerDay(EMPTY, 9999).perDay, 100);
    assert.equal(setPerDay(EMPTY, Number.NaN).perDay, EMPTY.perDay);
  });
  it("counts the review streak, keeping today open until it ends", () => {
    const log = (days: string[]): AppData => ({ ...EMPTY, log: Object.fromEntries(days.map((d) => [d, { n: 3, right: 2, fresh: 0 }])) });
    assert.equal(reviewStreak(EMPTY, TODAY), 0);
    assert.equal(reviewStreak(log([TODAY]), TODAY), 1);
    assert.equal(reviewStreak(log(["2026-10-31", "2026-10-30"]), TODAY), 2, "not yet today, but yesterday keeps it alive");
    assert.equal(reviewStreak(log([TODAY, "2026-10-31", "2026-10-29"]), TODAY), 2, "a gap ends it");
    assert.equal(reviewStreak(log(["2026-10-29"]), TODAY), 0);
  });
  it("exports what the import reads back", () => {
    const made = withDeck();
    let data = made.data;
    const deckId = made.deckId;
    data = addCard(addCard(data, deckId, "Line one\nline two", "Tab\tinside", T), deckId, "Plain q", "Plain a", T);
    const text = exportDeck(data, deckId);
    assert.equal(text, "Line one line two\tTab inside\nPlain q\tPlain a");
    assert.equal(importCards(data, deckId, text, T).added, 2);
  });
});
