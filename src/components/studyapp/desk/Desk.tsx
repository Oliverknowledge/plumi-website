"use client";

import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/lib/studyapp/clock";
import { continueTarget, examDays } from "@/lib/studyapp/model";
import { quoteFor } from "@/lib/studyapp/quotes";
import { actions, useApp } from "@/lib/studyapp/store";
import { dayOf, greeting, isEvening, longDate } from "@/lib/studyapp/time";
import { DeckCard } from "./DeckCard";
import { LibraryCard } from "./LibraryCard";
import { TodoCard } from "./TodoCard";

/**
 * The Desk: your desk by the window (the room changes with the time), a greeting and the day's line, where to
 * carry on, how long until your exam, then the to-do list on notebook paper with the library and your flashcards
 * beside it. Everything is the student's own and saved on this device; nothing here is a placeholder.
 */
function ExamChip() {
  const { data } = useApp();
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const days = now ? examDays(data, dayOf(now)) : null;
  const open = () => { setName(data.exam?.name ?? ""); setDate(data.exam?.date ?? ""); setEditing(true); };
  return (
    <span className="exam-wrap">
      {days !== null && data.exam ? (
        <button type="button" className="examchip" onClick={open} data-testid="exam-chip" aria-label={`${days} days to ${data.exam.name}. Change`}>
          <b>{days}</b> {days === 1 ? "day" : "days"} to {data.exam.name}
        </button>
      ) : (
        <button type="button" className="examchip add" onClick={open} data-testid="exam-add">+ Set an exam date</button>
      )}
      {editing && (
        <form className="card exam-form" onSubmit={(e) => { e.preventDefault(); actions.setExam({ name, date }); setEditing(false); }}>
          <label className="lbl" htmlFor="examName">Exam</label>
          <input id="examName" value={name} maxLength={40} placeholder="Further Maths P1" onChange={(e) => setName(e.target.value)} autoFocus />
          <label className="lbl" htmlFor="examDate">Date</label>
          <input id="examDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="exam-acts">
            <button type="submit" className="btn gold" disabled={!name.trim() || !date}>Save</button>
            {data.exam && <button type="button" className="btn ghost" onClick={() => { actions.setExam(null); setEditing(false); }}>Remove</button>}
            <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Cancel</button>
          </span>
        </form>
      )}
    </span>
  );
}

export function Desk() {
  const { data } = useApp();
  const now = useNow();
  const q = now ? quoteFor(dayOf(now)) : null;
  const next = now ? continueTarget(data, now) : { label: "Continue", href: "/study/flashcards" };
  return (
    <main className="wrap desk">
      <section className="scene card" aria-label="Your desk">
        {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, drawn with nearest-neighbour scaling */}
        <img className="art" src={now && isEvening(now) ? "/study/scene/desk-evening.png" : "/study/scene/desk-day.png"} alt="A cosy desk by a window: a lamp, a laptop, tea, a pinboard and shelves of books" width={1296} height={264} />
        <div className={`greet${now ? "" : " pending"}`}>
          <span className="lbl">{now ? longDate(now) : " "}</span>
          <h1>{now ? greeting(now) : "Hello."}</h1>
          <p>{q ? <>&ldquo;{q.text}&rdquo; <small>{q.by}</small></> : " "}</p>
          <div className="acts">
            <Link className="cont" href={next.href} data-testid="continue">{next.label}<i><svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="#3f322e" /></svg></i></Link>
            <ExamChip />
          </div>
        </div>
      </section>
      <div className="desk-grid">
        <TodoCard />
        <aside className="side" aria-label="Today">
          <LibraryCard />
          <DeckCard />
        </aside>
      </div>
    </main>
  );
}
