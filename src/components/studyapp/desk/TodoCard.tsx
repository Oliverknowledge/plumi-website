"use client";

import { useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/studyapp/AppLink";
import { useNow } from "@/lib/studyapp/clock";
import { leftToday, subjectColour, tasksFor, weekChoices, type Task, type TodoTab } from "@/lib/studyapp/model";
import { actions, useApp } from "@/lib/studyapp/store";
import { dayOf, dueLabel, weekdayShort } from "@/lib/studyapp/time";

/**
 * The to-do list, on notebook paper. Today holds what is due today or late, with the coming week under it;
 * This week and Done are their own tabs. Type a task and press Enter (or press N anywhere to start one).
 * Saved on this device. The play button opens the Grand Library to study it.
 */
const TABS: { id: TodoTab; label: string }[] = [{ id: "today", label: "Today" }, { id: "week", label: "This week" }, { id: "done", label: "Done" }];
const MIN_ROWS = 7;

function Row({ t, today, play }: { t: Task; today: string; play: boolean }) {
  return (
    <div className="row" data-testid="task-row">
      <input type="checkbox" className="cbx" checked={t.done} onChange={() => actions.toggleTask(t.id)} aria-label={`${t.done ? "Not done" : "Done"}: ${t.text}`} />
      <span className="task" title={t.text}>{t.text}</span>
      {t.subject && <span className="stk" style={{ background: subjectColour(t.subject) }}>{t.subject}</span>}
      <span className="due">{dueLabel(t.due, today)}</span>
      {play && !t.done
        ? <AppLink className="play" href="/study/library" aria-label={`Study: ${t.text}`}><svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="#22304d" /></svg></AppLink>
        : <span style={{ width: 32, flex: "none" }} />}
      <button type="button" className="rm" onClick={() => actions.removeTask(t.id)} aria-label={`Remove: ${t.text}`}>&times;</button>
    </div>
  );
}

export function TodoCard() {
  const { ready, data } = useApp();
  const now = useNow();
  const [tab, setTab] = useState<TodoTab>("today");
  const [text, setText] = useState("");
  const [dueDay, setDueDay] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const today = now ? dayOf(now) : "";

  // N starts a new task from anywhere on the Desk, unless the student is already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setTab((x) => (x === "done" ? "today" : x));
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const live = ready && !!today;
  const choices = live ? weekChoices(today, weekdayShort) : [];
  const due = tab === "week" ? (dueDay || choices[0]?.[0] || today) : today;
  const list = live ? tasksFor(data, tab, today) : [];
  const coming = live && tab === "today" ? tasksFor(data, "week", today).slice(0, 4) : [];
  const left = live ? leftToday(data, today) : 0;
  const count = !live ? "" : tab === "today" ? (left === 0 ? "Nothing left today" : `${left} left today`) : tab === "week" ? `${tasksFor(data, "week", today).length} coming up` : `${list.length} done`;

  const submit = () => {
    if (!text.trim() || !live) return;
    actions.addTask(text, due);
    setText("");
  };
  const empty = live && list.length === 0;
  const shown = list.length + (tab === "today" ? 1 + (coming.length ? 1 + coming.length : 0) : 0);
  const pad = Math.max(0, MIN_ROWS - shown);

  return (
    <section className="todo" aria-label="To do">
      <span className="tape" style={{ left: 40, top: -9, background: "var(--gold)", transform: "rotate(-5deg)" }} />
      <div className="card paper">
        <div className="td-head">
          <h2>To do</h2>
          <div className="mini-seg" role="tablist" aria-label="Which list">
            {TABS.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} data-testid={`todo-tab-${x.id}`}>{x.label}</button>
            ))}
          </div>
          <span className="td-count" data-testid="todo-count" aria-live="polite">{count}</span>
        </div>
        <div className="list">
          {list.map((t) => <Row key={t.id} t={t} today={today} play={tab !== "done"} />)}
          {empty && tab === "today" && <div className="row hint"><span>Nothing on for today. Type a task below.</span></div>}
          {empty && tab === "week" && <div className="row hint"><span>Nothing coming up. Add something for later in the week.</span></div>}
          {empty && tab === "done" && <div className="row hint"><span>Ticked-off tasks land here.</span></div>}
          {tab !== "done" && (
            <div className="row new">
              <span className="ghost" aria-hidden="true" />
              <input
                ref={input} id="newTask" type="text" value={text} maxLength={140} autoComplete="off" disabled={!live}
                placeholder={tab === "week" ? "Type something for later this week" : "Type your next task here"} aria-label="New task"
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} data-testid="new-task"
              />
              {tab === "week" && (
                <select className="daypick" value={due} onChange={(e) => setDueDay(e.target.value)} aria-label="Which day">
                  {choices.map(([iso, label]) => <option key={iso} value={iso}>{label}</option>)}
                </select>
              )}
              <kbd title="Press N to start a task">N</kbd>
            </div>
          )}
          {coming.length > 0 && (
            <>
              <div className="row sec"><span>Coming up this week</span></div>
              {coming.map((t) => <Row key={t.id} t={t} today={today} play />)}
            </>
          )}
          {Array.from({ length: pad }, (_, i) => <div key={i} className="row" aria-hidden="true" />)}
        </div>
      </div>
    </section>
  );
}
