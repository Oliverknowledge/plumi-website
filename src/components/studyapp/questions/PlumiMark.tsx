"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { supabase, useAccount } from "@/lib/account";
import { markable, type QAnswer, type QPart, type QSet } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { fetchAvailable, fetchEnabled, MAX_ANSWER_CHARS, requestMark, requestTranscript, type Allowance, type MarkReply } from "@/lib/studyapp/marking/api";
import { answerPicture } from "@/lib/studyapp/marking/picture";
import { markSource } from "@/lib/studyapp/marking/source";
import { answerKey, getCached, putCached, type KV } from "@/lib/studyapp/marking/cache";
import { CONSENT_COPY, giveConsent, hasConsent, type AgeBand } from "@/lib/studyapp/marking/consent";
import { lineFor } from "@/lib/studyapp/marking/copy";
import { aiMarkingOn, liveDeps } from "@/lib/studyapp/marking/live";
import "../../../app/study/(app)/questions-plumimark.css";

/**
 * "Mark with Plumi": a typed answer, marked against the board's own mark scheme. It is offered only where it can work: a signed-in account, a
 * part the server holds a mark scheme for (never a guess), and something typed. Everything that decides a mark is on the server; this file
 * sends the answer, draws the result and keeps the student's own self-marking exactly as it was. The mark is a suggestion: "Use this mark"
 * is a tap the student makes, and a mark with a point Plumi was unsure of is never offered to be used.
 *
 * A student sees: the score, which points, their own words that earned each, one line of why, and what is left. Never a code or a
 * hold reason. A held point reads "Compare this with the mark scheme."
 */

const storage = (): KV | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

// Is marking on for this account (the server decides, per account), and does THIS part have a mark scheme there? Parts are asked about as they
// appear (the question list does not hold a subject's parts up front, so there is no list to ask about in one go): a short wait gathers
// the parts on screen into one request. An answer is kept; a failure is not remembered, so the next draw asks again. A student the server
// has not switched marking on for is never shown the button.
interface Slot { has: Set<string>; done: Set<string>; queue: Set<string>; timer: ReturnType<typeof setTimeout> | null }
const slots = new Map<string, Slot>();
const accountOn = new Map<string, boolean>();
const accountAsk = new Map<string, Promise<boolean | null>>();
const watchers = new Set<() => void>();
const GATHER_MS = 60;
const slotFor = (key: string): Slot => { let s = slots.get(key); if (!s) { s = { has: new Set(), done: new Set(), queue: new Set(), timer: null }; slots.set(key, s); } return s; };
const tell = () => watchers.forEach((w) => w());

async function isOn(userId: string): Promise<boolean | null> {
  const known = accountOn.get(userId);
  if (known !== undefined) return known;
  let p = accountAsk.get(userId);
  if (!p) {
    const deps = liveDeps();
    if (!deps) return null;
    p = fetchEnabled(deps).then((on) => { if (on !== null) accountOn.set(userId, on); return on; }).finally(() => accountAsk.delete(userId));
    accountAsk.set(userId, p);
  }
  return p;
}

function gather(key: string, userId: string, subject: string, cv: number, partId: string) {
  const s = slotFor(key);
  s.queue.add(partId);
  if (s.timer) return;
  s.timer = setTimeout(async () => {
    s.timer = null;
    const ids = [...s.queue].filter((x) => !s.done.has(x));
    s.queue.clear();
    if (!ids.length) return;
    const on = await isOn(userId);
    if (on === null) { tell(); return; }
    if (on) {
      const deps = liveDeps();
      const found = deps ? await fetchAvailable(deps, subject, cv, ids) : null;
      if (found) { found.forEach((x) => s.has.add(x)); ids.forEach((x) => s.done.add(x)); }
    }
    tell();
  }, GATHER_MS);
}

function useAvailable(set: QSet, part: QPart, enabled: boolean, userId: string | null): boolean {
  const key = `${userId}|${set.subject}|${set.cv ?? 0}`;
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!enabled || !userId) return;
    const w = () => redraw((n) => n + 1);
    watchers.add(w);
    if (!slotFor(key).done.has(part.id)) gather(key, userId, set.subject, set.cv ?? 0, part.id);
    return () => { watchers.delete(w); };
  }, [enabled, userId, key, set.subject, set.cv, part.id]);
  return enabled && !!userId && accountOn.get(userId) !== false && slots.get(key)?.has.has(part.id) === true;
}

type View =
  | { k: "idle" }
  | { k: "consent" }
  | { k: "marking" }
  | { k: "reading" }
  | { k: "confirm"; key: string; text: string }
  | { k: "result"; key: string; reply: MarkReply; allowance: Allowance | null }
  | { k: "note"; text: string; signin?: boolean; again?: boolean };

export interface PlumiMarkUi {
  /** Goes in the row of buttons under the question. Null when marking is not on offer for this part. */
  button: ReactNode;
  /** The result, the one-line note and the consent dialog: goes under the row. */
  panel: ReactNode;
}

export function usePlumiMark(set: QSet, part: QPart, answer: QAnswer | undefined): PlumiMarkUi {
  const { ready, user, on } = useAccount();
  const signedIn = aiMarkingOn && on && ready && !!user && user.is_anonymous !== true;
  const available = useAvailable(set, part, signedIn, user?.id ?? null);
  // Which of the student's three places to write is the answer: what they can SEE (source.ts). Handwriting, in the answer zone or on the printed question's lines,
  // is read into words first (the student checks them), and only those words are marked.
  const source = markSource(answer);
  const offered = signedIn && available && markable(part) && source !== null;
  const viaInk = source === "ink" || source === "ann";
  const text = answer?.text ?? "";
  const bank = set.subject, cv = set.cv ?? 0;
  const stamp = source === "ann" ? `ann:${answer?.ann?.n}.${answer?.ann?.b}` : `ink:${answer?.ink?.n}.${answer?.ink?.b}`;
  const key = answerKey(bank, part.id, cv, viaInk ? stamp : text);
  const [view, setView] = useState<View>({ k: "idle" });
  const pending = useRef<string | null>(null);   // the words the student confirmed, kept so "Try again" does not read the page twice

  const markText = async (words: string, viewKey: string) => {
    const kv = storage();
    const wordsKey = answerKey(bank, part.id, cv, words);
    const cached = getCached(kv, wordsKey);
    if (cached) { pending.current = null; setView({ k: "result", key: viewKey, reply: cached, allowance: null }); return; }
    const deps = liveDeps();
    const sb = supabase();
    if (!deps || !sb) { setView({ k: "note", text: lineFor({ kind: "unavailable" }) }); return; }
    setView({ k: "marking" });
    // Ask for consent BEFORE the answer is sent anywhere. (The server refuses without it as well.)
    if (!(await hasConsent(sb))) { setView({ k: "consent" }); return; }
    const o = await requestMark(deps, { bank, partId: part.id, cropVersion: cv, answer: words });
    if (o.kind === "marked") { pending.current = null; putCached(kv, wordsKey, o.reply); setView({ k: "result", key: viewKey, reply: o.reply, allowance: o.allowance }); return; }
    if (o.kind === "consent") { setView({ k: "consent" }); return; }
    setView({ k: "note", text: lineFor(o), signin: o.kind === "signin", again: o.kind === "failed" || o.kind === "rate" });
  };

  const run = async () => {
    if (!viaInk) { await markText(text, key); return; }
    if (pending.current) { await markText(pending.current, key); return; }
    const deps = liveDeps();
    const sb = supabase();
    if (!deps || !sb) { setView({ k: "note", text: lineFor({ kind: "unavailable" }) }); return; }
    setView({ k: "reading" });
    // Consent BEFORE the picture of the handwriting is sent anywhere.
    if (!(await hasConsent(sb))) { setView({ k: "consent" }); return; }
    const picture = await answerPicture(part.id, set.id, source === "ann").catch(() => null);
    if (!picture) { setView({ k: "note", text: lineFor({ kind: "failed" }), again: true }); return; }
    const o = await requestTranscript(deps, picture);
    if (o.kind === "read") { setView({ k: "confirm", key, text: o.text }); return; }
    if (o.kind === "consent") { setView({ k: "consent" }); return; }
    setView({ k: "note", text: lineFor(o), signin: o.kind === "signin", again: o.kind === "failed" || o.kind === "rate" });
  };

  const markConfirmed = async (words: string) => { pending.current = words; await markText(words, key); };

  const agree = async (age: AgeBand, parent: boolean) => {
    const sb = supabase();
    if (!sb || !(await giveConsent(sb, age, parent))) { setView({ k: "note", text: "That didn’t save. Try again.", again: true }); return; }
    await run();
  };

  if (!offered) return { button: null, panel: null };

  const stale = (view.k === "result" || view.k === "confirm") && view.key !== key;
  const shown: View = stale ? { k: "idle" } : view;
  const marking = shown.k === "marking" || shown.k === "reading";
  const button = (
    <button type="button" className={`qs-schemebtn qs-pmbtn${shown.k === "result" ? " is-open" : ""}`} aria-busy={marking} disabled={marking} onClick={() => void run()} data-testid="plumi-mark">
      {shown.k === "reading" ? "Reading your writing..." : marking ? "Marking..." : "Mark with Plumi"}
    </button>
  );
  const panel = (
    <div className="qs-pm" aria-live="polite">
      {shown.k === "confirm" && (
        <ConfirmWords text={shown.text} onChange={(t) => setView({ k: "confirm", key: shown.key, text: t })} onMark={() => void markConfirmed(shown.text.trim())} onCancel={() => { pending.current = null; setView({ k: "idle" }); }} />
      )}
      {shown.k === "result" && <ResultCard part={part} answer={answer} reply={shown.reply} allowance={shown.allowance} set={set} onClose={() => setView({ k: "idle" })} />}
      {shown.k === "note" && (
        <p className="qs-pm-note" data-testid="plumi-mark-note">
          {shown.text}{" "}
          {shown.signin && <a className="qs-link" href={`/sign-in?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}&why=marks`}>Sign in</a>}
          {shown.again && <button type="button" className="qs-link" onClick={() => void run()}>Try again</button>}
        </p>
      )}
      {shown.k === "consent" && <ConsentDialog onYes={agree} onNo={() => setView({ k: "idle" })} />}
    </div>
  );
  return { button, panel };
}

// ---------------------------------------------------------------------------------------
// The result
// ---------------------------------------------------------------------------------------

const Tick = () => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Cross = () => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
const Ring = () => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="3 3.4" /></svg>;
const WORD = { awarded: "Earned", not_awarded: "Not earned", held: "Check this one yourself" } as const;

function left(a: Allowance | null): string | null {
  if (!a) return null;
  const n = Math.max(0, a.limit - a.used);
  return `${n} left ${a.window === "day" ? "today" : "this week"}`;
}

function ResultCard({ set, part, answer, reply, allowance, onClose }: { set: QSet; part: QPart; answer: QAnswer | undefined; reply: MarkReply; allowance: Allowance | null; onClose(): void }) {
  const used = answer?.got === reply.marks;
  // Offered only when every point was settled and the total is for this very part: a held point makes the total incomplete.
  const canUse = !reply.anyHeld && part.m === reply.outOf;
  const remaining = left(allowance);
  return (
    <section className="qs-pmcard" data-testid="plumi-mark-result" aria-label={`Plumi marked this ${reply.marks} out of ${reply.outOf}`}>
      <button type="button" className="qs-pm-x" onClick={onClose} aria-label="Close">&times;</button>
      <p className="qs-pm-score" aria-hidden="true"><b>{reply.marks}</b><span>/ {reply.outOf}</span></p>
      <ul className="qs-pm-points">
        {reply.points.map((p) => (
          <li key={p.n} className={`qs-pm-pt is-${p.status}`}>
            <span className="qs-pm-ic" role="img" aria-label={WORD[p.status]}>{p.status === "awarded" ? <Tick /> : p.status === "held" ? <Ring /> : <Cross />}</span>
            <span className="qs-pm-body">
              {p.status === "awarded" && p.evidence && <q className="qs-pm-quote">{p.evidence}</q>}
              <span className="qs-pm-why">{p.reason}</span>
            </span>
          </li>
        ))}
      </ul>
      {reply.anyHeld && <p className="qs-pm-held">Plumi wasn&rsquo;t sure about one. Check it against the mark scheme.</p>}
      <div className="qs-pm-foot">
        {remaining && <span className="qs-pm-left">{remaining}</span>}
        {canUse && (
          <button type="button" className="qs-mini qs-pm-use" disabled={used} onClick={() => qa.mark(set.id, part.id, reply.marks)} data-testid="plumi-mark-use">
            {used ? "Using this mark" : "Use this mark"}
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------
// Checking the words Plumi read from the student's handwriting
// ---------------------------------------------------------------------------------------

/** The words Plumi read, in a box the student can fix. Nothing is marked until they tap "Mark this": a misread word must never cost a mark. */
function ConfirmWords({ text, onChange, onMark, onCancel }: { text: string; onChange(t: string): void; onMark(): void; onCancel(): void }) {
  const id = useId();
  const unsure = text.includes("[?]");
  return (
    <section className="qs-pmcard qs-pmedit" data-testid="plumi-mark-confirm" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="qs-pme-title">Is this what you wrote?</h3>
      <textarea className="qs-pme-text" value={text} maxLength={MAX_ANSWER_CHARS} rows={Math.min(8, Math.max(3, text.split("\n").length + 1))} onChange={(e) => onChange(e.target.value)} aria-label="What Plumi read from your writing" data-testid="plumi-mark-words" />
      {unsure && <p className="qs-pme-note">Plumi couldn&rsquo;t read a word. Replace each [?] with it.</p>}
      <div className="qs-pm-foot">
        <button type="button" className="qs-mini qs-pm-use" disabled={text.trim() === ""} onClick={onMark} data-testid="plumi-mark-this">Mark this</button>
        <button type="button" className="qs-link" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------------------

/** First tap only. "Not now" leaves marking yourself exactly as it was, and asks nothing again until the student taps Mark with Plumi. */
function ConsentDialog({ onYes, onNo }: { onYes(age: AgeBand, parent: boolean): Promise<void>; onNo(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const name = useId();
  const [age, setAge] = useState<AgeBand | null>(null);
  const [parent, setParent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const close = (fn: () => void) => { const d = ref.current; if (d?.open) d.close(); fn(); };
  const ok = age === "18_plus" || (age === "under_18" && parent);
  return (
    <dialog ref={ref} className="qs-confirm qs-pmconsent card" aria-labelledby={`${name}-t`} data-testid="plumi-mark-consent"
      onCancel={(e) => { e.preventDefault(); close(onNo); }} onClick={(e) => { if (e.target === ref.current) close(onNo); }}>
      <h2 id={`${name}-t`} className="qs-pmc-title">{CONSENT_COPY.title}</h2>
      <p className="qs-pmc-line">{CONSENT_COPY.line}</p>
      <ul className="qs-pmc-points">{CONSENT_COPY.points.map((t) => <li key={t}>{t}</li>)}</ul>
      <fieldset className="qs-pmc-age">
        <legend>{CONSENT_COPY.ageLabel}</legend>
        <label className={age === "18_plus" ? "on" : ""}><input type="radio" name={name} checked={age === "18_plus"} onChange={() => { setAge("18_plus"); setParent(false); }} />{CONSENT_COPY.adult}</label>
        <label className={age === "under_18" ? "on" : ""}><input type="radio" name={name} checked={age === "under_18"} onChange={() => setAge("under_18")} />{CONSENT_COPY.minor}</label>
      </fieldset>
      {age === "under_18" && (
        <label className="qs-pmc-parent"><input type="checkbox" checked={parent} onChange={(e) => setParent(e.target.checked)} />{CONSENT_COPY.parentAsk} {CONSENT_COPY.parentTick}</label>
      )}
      <div className="qs-confirm-acts">
        <button type="button" className="btn qs-keep" disabled={!ok || busy} onClick={async () => { if (!age) return; setBusy(true); const d = ref.current; if (d?.open) d.close(); await onYes(age, parent); }} data-testid="plumi-mark-yes">{CONSENT_COPY.yes}</button>
        <button type="button" className="btn ghost" autoFocus onClick={() => close(onNo)} data-testid="plumi-mark-no">{CONSENT_COPY.no}</button>
      </div>
      <p className="qs-pmc-foot">{CONSENT_COPY.foot}</p>
    </dialog>
  );
}
