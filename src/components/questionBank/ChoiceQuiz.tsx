"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { recordMark } from "@/lib/bankProgress";
import { useDarkCrop } from "@/lib/darkCrops";
import { paperName, partImage, seriesLabel, stemImage, type BankPart, type BankSubject } from "@/content/questionBank";

/**
 * A multiple-choice quiz from the questions in view (a Discord ask, 2 November 2026: "a question set only
 * for multiple choice"). One at a time, a tap (or a key) to answer, right or wrong at once, the score as it
 * goes; at the end, the ones missed, to try again. Every answer is recorded as a tap on the list's own A–D
 * keys would be (bankProgress), so it counts on My board. Timed, it keeps OCR's Section A pace, about 80
 * seconds a question.
 */

const LETTERS = ["A", "B", "C", "D"];
const PER_QUESTION_S = 80;
const SIZES = [10, 15, 30];

type Phase = "start" | "run" | "end";
const right = (p: BankPart, letter: string) => (p.k ?? "").split(/\s+or\s+/i).includes(letter);

function shuffled<T>(list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function ChoiceQuiz({ subject, pool, open, onClose }: { subject: BankSubject; pool: BankPart[]; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const photo = useDarkCrop();
  const [phase, setPhase] = useState<Phase>("start");
  // How many: a number, 0 for all of them, or null for the default (15, or all if fewer).
  const [size, setSize] = useState<number | null>(null);
  const [shuffle, setShuffle] = useState(true);
  const [timed, setTimed] = useState(false);
  const [queue, setQueue] = useState<BankPart[]>([]);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // The clock, while a timed quiz runs; at nought the quiz ends where it is.
  useEffect(() => {
    if (phase !== "run" || deadline == null) return;
    const t = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= deadline) setPhase("end");
    }, 250);
    return () => clearInterval(t);
  }, [phase, deadline]);

  const count = size === null ? Math.min(15, pool.length) : size || pool.length;
  const part = queue[index];
  const picked = part ? picks[part.id] : undefined;
  const score = queue.filter(p => picks[p.id] && right(p, picks[p.id])).length;
  const answered = queue.filter(p => picks[p.id]).length;
  const missed = queue.filter(p => picks[p.id] && !right(p, picks[p.id]));
  const left = deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));

  function begin(list: BankPart[]) {
    const at = Date.now();
    setQueue(list);
    setIndex(0);
    setPicks({});
    setNow(at);
    setDeadline(timed ? at + list.length * PER_QUESTION_S * 1000 : null);
    setPhase("run");
    track("bank_quiz_started", { subject: subject.slug, questions: list.length, timed: timed ? 1 : 0 });
  }

  function start() {
    const list = shuffle ? shuffled(pool) : pool;
    begin(list.slice(0, count));
  }

  function pick(letter: string) {
    if (!part || picked) return;
    setPicks(p => ({ ...p, [part.id]: letter }));
    recordMark({ subject: subject.slug, part: part.id, topics: part.t, score: right(part, letter) ? 1 : 0, outOf: 1, kind: "choice", choice: letter });
  }

  function next() {
    if (index + 1 < queue.length) setIndex(index + 1);
    else finish();
  }

  function finish() {
    setPhase("end");
    track("bank_quiz_finished", { subject: subject.slug, questions: queue.length, score, answered, timed: deadline != null ? 1 : 0 });
  }

  function close() {
    setPhase("start");
    onClose();
  }

  // Keys: A–D (or 1–4) to answer, Enter or → for the next question.
  useEffect(() => {
    if (!open || phase !== "run") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const letter = LETTERS.includes(k) ? k : "1234".includes(k) && k.length === 1 ? LETTERS[Number(k) - 1] : null;
      if (letter && !picked) { e.preventDefault(); pick(letter); }
      else if ((e.key === "Enter" || e.key === "ArrowRight") && picked) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const where = (p: BankPart) => `${seriesLabel(subject, p.s)} · ${paperName(subject, p.p)} · Q${p.l}`;
  const clock = left == null ? null : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <dialog ref={ref} className="qb-zoom qb-quiz" aria-label="Multiple-choice quiz" onCancel={e => { e.preventDefault(); close(); }}>
      <header className="qb-zoom-head">
        <p className="qb-zoom-title">
          {phase === "run" && part ? <><b>{index + 1}</b> of {queue.length} · {score} right{clock && <> · <span className={left! <= 30 ? "qb-quiz-low" : undefined}>{clock} left</span></>}</> : "Multiple-choice quiz"}
        </p>
        <button type="button" className="qb-zoom-x" onClick={close} aria-label="Close the quiz">×</button>
      </header>

      {phase === "start" && (
        <div className="qb-quiz-stage qb-quiz-card">
          <h2>Quiz yourself</h2>
          <p>{pool.length.toLocaleString("en-GB")} multiple-choice {pool.length === 1 ? "question" : "questions"} in view. Answer each, see if you’re right, and try the ones you miss again.</p>
          <div className="qb-quiz-sizes" role="group" aria-label="How many questions">
            {[...SIZES.filter(n => n < pool.length), 0].map(n => (
              <button key={n} type="button" className={`qb-self-key is-wide${count === (n || pool.length) ? " is-on" : ""}`} aria-pressed={count === (n || pool.length)} onClick={() => setSize(n)}>
                {n || `All ${pool.length}`}
              </button>
            ))}
          </div>
          <label className="qb-quiz-opt"><input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} /> Shuffle them</label>
          <label className="qb-quiz-opt"><input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} /> Timed, at exam pace (about 80 seconds a question)</label>
          <button type="button" className="lp-btn qb-zoom-go" onClick={start}>Start</button>
        </div>
      )}

      {phase === "run" && part && (
        <>
          <div className="qb-quiz-stage">
            <p className="qb-quiz-where">{where(part)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {part.st && <img {...photo} src={stemImage(part, subject.cropVersion)} alt={`The start of question ${part.l}`} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={part.id} {...photo} src={partImage(part.id, "qp", subject.cropVersion)} width={part.w} height={part.h} alt={`Question ${part.l}: ${part.x}`} />
          </div>
          <footer className="qb-zoom-foot">
            <div className="qb-self-keys qb-quiz-keys" role="group" aria-label="Your answer">
              {LETTERS.map(l => {
                const state = !picked ? "" : picked === l ? (right(part, l) ? " is-right" : " is-wrong") : right(part, l) ? " is-key" : " is-off";
                return <button key={l} type="button" className={`qb-self-key${state}`} aria-pressed={picked === l} disabled={!!picked} onClick={() => pick(l)}>{l}</button>;
              })}
            </div>
            {picked && (
              <div className="qb-quiz-after" role="status">
                <span>{right(part, picked) ? "Right." : <>It’s <strong>{part.k}</strong>.</>}</span>
                <button type="button" className="lp-btn qb-zoom-go" onClick={next} autoFocus>{index + 1 < queue.length ? "Next →" : "See your score"}</button>
              </div>
            )}
          </footer>
        </>
      )}

      {phase === "end" && (
        <div className="qb-quiz-stage qb-quiz-card">
          <h2>{score} out of {queue.length}</h2>
          {answered < queue.length && <p>Time ran out with {queue.length - answered} still to answer.</p>}
          {missed.length > 0 ? (
            <>
              <p>The {missed.length === 1 ? "one" : `${missed.length}`} you missed:</p>
              <ul className="qb-quiz-missed">
                {missed.map(p => <li key={p.id}>{where(p)}: you said {picks[p.id]}, it’s <strong>{p.k}</strong></li>)}
              </ul>
              <button type="button" className="lp-btn qb-zoom-go" onClick={() => begin(missed)}>Try the {missed.length === 1 ? "one" : missed.length} I got wrong</button>
            </>
          ) : answered ? <p>Every one right.</p> : null}
          <button type="button" className="lp-btn" onClick={() => setPhase("start")}>New quiz</button>
        </div>
      )}
    </dialog>
  );
}
