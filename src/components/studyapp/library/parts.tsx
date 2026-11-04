"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { LibraryHandle } from "@/components/landing/cafeScene";
import { toast } from "@/components/studyapp/toast";
import * as spam from "@/lib/social/librarySpam";
import { MAX_LENGTH, tidy } from "@/lib/social/chatRules";
import {
  EMOTE_TITLE, LOBBY_CAP, LOBBY_EMOTES, SEAT_SUBJECTS, focusTag, listedServers, shownName,
  type LibraryMessage, type LobbyPerson,
} from "@/lib/social/lobby";
import type { MessageReportReason, UserReportReason } from "@/lib/social/types";
import { useNow } from "@/lib/studyapp/clock";
import { clearFromSeat, markFromSeat, setFocusIntent } from "@/lib/studyapp/focusIntent";
import { useAppHref } from "@/lib/studyapp/host";
import { face, settled } from "@/lib/studyapp/timer";
import { timer, useTimer } from "@/lib/studyapp/timerStore";
import { describe, viewOf, type View } from "@/components/studyapp/timer/TimerPanel";
import { Head } from "./Head";
import { startSubject, subjectWord } from "@/lib/studyapp/library/subject";
import { friendButton } from "@/lib/studyapp/library/friendRequest";
import { platformOf } from "@/lib/studyapp/library/platform";
import type { LibrarySession, Snapshot } from "@/lib/studyapp/library/session";

/** The panel beside the room: your seat, who is here, the libraries, the chat. Everything short; nothing a student cannot act on. */

const REPORT_USER: { id: UserReportReason; label: string }[] = [
  { id: "name", label: "Their name" }, { id: "bothering", label: "Bothering me" }, { id: "other", label: "Something else" },
];
const REPORT_MESSAGE: { id: MessageReportReason; label: string }[] = [
  { id: "language", label: "Bad language" }, { id: "link", label: "A link or contact details" }, { id: "bullying", label: "Unkind or bullying" }, { id: "other", label: "Something else" },
];

/* ── Your seat ───────────────────────────────────────────────────────── */

const SUBJECT_KEY = "plumi-library-subject";
/** What this browser chose before the timer remembered it (the seat card's old per-browser key): only a fallback. */
function savedSubject(): string | null | undefined {
  try { const v = window.localStorage.getItem(SUBJECT_KEY); return v === null ? undefined : v === "" ? null : v; } catch { return undefined; }
}

/** The two hands on the seat card: a drawn glyph (phones show it alone, wider screens show the word beside it). */
const Hand = ({ kind }: { kind: string }) => (
  <svg className="lb-ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6 10.500V5.200M9 10V3.800M12 10V4.600M15 10.500V7M6 10.500l-2.200-1.800a1.200 1.200 0 0 0-1.600 1.700L6 15a5 5 0 0 0 4 2h1.500a4 4 0 0 0 3.500-4v-2.500" />
    {kind === "wave" ? <path d="M17.500 3.200a4 4 0 0 1 1.300 2.600M1.800 3.200" /> : <path d="M3 2.500l.8 1.500M7 1.500l.2 1.600M1 6l1.400.4" />}
  </svg>
);
/** A pencil, drawn like the others (the seat card's second way to spend the focus: questions). */
const PencilIcon = () => (
  <svg className="lb-ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3.500 16.500l.9-3.700L13 4.200a1.700 1.700 0 0 1 2.400 0l.4.4a1.700 1.700 0 0 1 0 2.400L7.200 15.600l-3.700.9zM11.500 5.800l2.700 2.700" /></svg>
);
const StandIcon = () => (
  <svg className="lb-ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M10 16.500V4M5 9l5-5 5 5" /></svg>
);

/**
 * Your seat. The focus control here is the study timer, the same one as the chip: Start focus starts it with the
 * settings the student last chose (so a Pomodoro student gets a Pomodoro here), Stop stops it, and the library
 * is told by the timer, not by this card (see `useTimerFollow`). Standing up does not stop it.
 *
 * Start focus is always live once you sit: with no subject chosen yet it starts a plain "Focus" (`startSubject`),
 * and the chips are there to say more, not a step before it. As the full-screen DOCK (`dock`) it is a slim pill on a
 * phone: one row, the words shrink to icons, and the subject chips fold behind the subject button.
 */
export function SeatCard({ session, snap, handleRef, dock = false }: { session: LibrarySession; snap: Snapshot; handleRef: RefObject<LibraryHandle | null>; dock?: boolean }) {
  const now = useNow(1000);
  const { doc, ready } = useTimer();
  const [subjOpen, setSubjOpen] = useState(false);
  const chipsId = useId();
  const view: View = ready && now ? viewOf(doc.session, now) : "setup";
  const running = view !== "setup" && doc.session ? settled(doc.session, now) : null;
  // What you are on: the timer's, which is what you last chose (anywhere in the app), else the old per-browser choice.
  const subject = running ? running.subject : doc.subject !== undefined ? doc.subject : savedSubject();
  const router = useRouter();
  const to = useAppHref();
  // A seated student who has stood or sat again is no longer "away from a seat for questions".
  useEffect(() => { if (snap.seated) clearFromSeat(); }, [snap.seated]);
  /**
   * "Do Plumi questions": the focus session carries on (set up, it is started here with the chosen subject), and the Questions page opens on that subject's book.
   * It is a page change inside the app, so the timer is never interrupted and the library lets go of the seat as it does for any other page.
   */
  const doQuestions = () => {
    const on = running ? running.subject : startSubject(subject);
    if (view === "setup") timer.start({ subject: on });
    setFocusIntent(on);
    const id = running ? running.id : timer.snapshot().doc.session?.id ?? null;
    if (id) markFromSeat(id);
    router.push(to("/study/questions"));
  };
  const sit = () => { if (!handleRef.current?.sit()) toast("No free seat close by. Tap one in the room"); };
  const title = !snap.seated ? "You’re standing" : view === "work" ? "Focusing" : view === "paused" ? "Paused" : view === "break" ? "On a break" : view === "over" ? "Back to it?" : "You’re sitting";
  const clock = running && view !== "over" && now ? <b className="lb-clock" aria-live="off" data-testid="seat-clock">{face(running, now)}</b> : null;

  return (
    <section className={`card lb-card lb-seat${dock ? " is-dock" : ""}${subjOpen ? " has-open" : ""}${view !== "setup" ? " is-running" : ""}`} aria-label="Your seat">
      <div className="lb-head">
        <h2>{title}</h2>
        {snap.nickname && <span className="lb-me">as <b>{snap.nickname}</b></span>}
      </div>
      {!snap.seated ? (
        <>
          <div className="lb-row lb-main">
            <button type="button" className="btn gold" data-testid="seat-sit" onClick={sit}>Sit down</button>
            <span className="lb-hint">or tap a seat, or press E near one</span>
            <div className="lb-emotes" role="group" aria-label="Say hello">
              {LOBBY_EMOTES.map((k) => (
                <button key={k} type="button" className="btn lb-emote" aria-label={EMOTE_TITLE[k]} title={EMOTE_TITLE[k]} onClick={() => void session.emote(k)}><Hand kind={k} /><span className="lb-lab">{EMOTE_TITLE[k]}</span></button>
              ))}
            </div>
          </div>
          {running && <p className="lb-hint lb-walking" data-testid="seat-walking">{clock}Walking about. Your clock keeps running.</p>}
        </>
      ) : (
        <>
          <div className="lb-row lb-main">
            {clock}
            <button type="button" className={`chip lb-subj${subjOpen ? " is-on" : ""}`} aria-expanded={subjOpen} aria-controls={chipsId} onClick={() => setSubjOpen((o) => !o)}>
              {subjectWord(subject)}<svg className="lb-caret" viewBox="0 0 10 6" aria-hidden="true" focusable="false"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {view === "setup" && <button type="button" className="btn gold lb-go" onClick={() => timer.start({ subject: startSubject(subject) })} data-testid="seat-start">Start focus</button>}
            {view === "work" && <button type="button" className="btn" onClick={() => timer.pause()}>Pause</button>}
            {view === "paused" && <button type="button" className="btn gold" onClick={() => timer.resume()}>Resume</button>}
            {view === "break" && <button type="button" className="btn gold" onClick={() => timer.endBreak()}>End break</button>}
            {view === "over" && <button type="button" className="btn gold" onClick={() => timer.endBreak()} data-testid="seat-continue">Continue studying</button>}
            {view !== "setup" && <button type="button" className="btn" onClick={() => timer.stop()} data-testid="seat-stop">Stop</button>}
            <button type="button" className="btn lb-q" aria-label="Do Plumi questions" onClick={doQuestions} data-testid="seat-questions">
              <PencilIcon /><span className="lb-ql lb-ql-long" aria-hidden="true">Do Plumi questions</span><span className="lb-ql lb-ql-short" aria-hidden="true">Questions</span>
            </button>
            <button type="button" className="btn ghost lb-stand" aria-label="Stand up" title="Stand up" data-testid="seat-stand" onClick={() => handleRef.current?.stand()}><StandIcon /><span className="lb-lab">Stand up</span></button>
          </div>
          <div className={`lb-chips${subjOpen ? " is-open" : ""}`} id={chipsId} role="group" aria-label="What are you on?">
            {SEAT_SUBJECTS.map((s) => (
              <button key={s.label} type="button" className="chip" aria-pressed={subject !== undefined && subject === s.id} onClick={() => { timer.setSubject(s.id); setSubjOpen(false); }}>{s.label}</button>
            ))}
          </div>
          {view === "setup" && <p className="lb-hint lb-mode" data-testid="seat-mode">{describe(doc.settings)}, from the timer in the corner</p>}
          <div className="lb-emotes lb-emotes-seated" role="group" aria-label="Say hello">
            {LOBBY_EMOTES.map((k) => (
              <button key={k} type="button" className="btn lb-emote" aria-label={EMOTE_TITLE[k]} title={EMOTE_TITLE[k]} onClick={() => void session.emote(k)}><Hand kind={k} /><span className="lb-lab">{EMOTE_TITLE[k]}</span></button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ── Who is here ─────────────────────────────────────────────────────────
   The panel itself is People.tsx (requests, friends, the room); a person's card is here, shared by it. */

export function PersonCard({ session, person, now, onClose, onPullUp, onLook }: { session: LibrarySession; person: LobbyPerson; now: number; onClose: () => void; onPullUp: (id: string) => void; onLook?: (id: string) => void }) {
  const [asking, setAsking] = useState<"report" | "block" | null>(null);
  const [askLine, setAskLine] = useState<string | null>(null);
  const fb = friendButton(person);
  const tag = focusTag(person, now);
  const name = shownName(person);
  const platform = platformOf(person);
  return (
    <div className="lb-pcard" role="group" aria-label={name}>
      <div className="lb-ptop">
        <Head avatar={person.avatar} colour={person.colour} id={person.id} size={56} label={name} />
        <div>
          <b>{name}</b>
          <div className="lb-tags">
            {person.isFriend && <span className="lb-tag">Friend</span>}
            {platform && <span className="lb-tag lb-plat" data-testid="person-platform">On {platform}</span>}
            {person.pro && <span className="lb-tag lb-pro">Plumi Pro</span>}
          </div>
        </div>
        <button type="button" className="btn ghost icon lb-pclose" aria-label="Close" onClick={onClose}>{"×"}</button>
      </div>
      <dl className="lb-stats" data-testid="person-stats">
        <div><dt>Day streak</dt><dd>{person.streak === 1 ? "1 day" : `${person.streak} days`}</dd></div>
        <div><dt>Level</dt><dd>{person.level > 0 ? person.level : "New"}</dd></div>
        <div><dt>Right now</dt><dd>{tag ?? (person.seated ? "Sitting" : "Standing")}</dd></div>
      </dl>
      {person.groups.length > 0 && <p className="lb-line">In {person.groups.map((g) => g.name).join(", ")}</p>}
      {asking === null && (
        <div className="lb-row">
          {session.canRequestFriends && (fb === "add" || fb === "received") && (
            <button type="button" className="btn gold" data-testid="person-add-friend"
              onClick={async () => { setAskLine((await session.addFriend(person.id)).line); }}>
              {fb === "received" ? "Accept friend request" : "Add friend"}
            </button>
          )}
          {session.canRequestFriends && fb === "sent" && <span className="lb-tag" data-testid="person-request-sent">Friend request sent</span>}
          {onLook && <button type="button" className="btn" data-testid="person-find" onClick={() => onLook(person.id)}>Find them</button>}
          {person.seated && <button type="button" className="btn gold" onClick={() => onPullUp(person.id)}>Pull up a chair</button>}
          <button type="button" className="btn ghost" onClick={() => setAsking("report")}>Report</button>
          <button type="button" className="btn ghost" onClick={() => setAsking("block")}>Block</button>
        </div>
      )}
      {askLine && <p className="lb-line" role="status" data-testid="person-ask-line">{askLine}</p>}
      {asking === "report" && (
        <div className="lb-ask" role="group" aria-label="Why are you reporting them?">
          <span className="lbl">Why?</span>
          {REPORT_USER.map((r) => <button key={r.id} type="button" className="chip" onClick={() => { void session.reportPerson(person.id, r.id); setAsking(null); }}>{r.label}</button>)}
          <button type="button" className="btn ghost" onClick={() => setAsking(null)}>Back</button>
        </div>
      )}
      {asking === "block" && (
        <div className="lb-ask" role="group" aria-label={`Block ${name}?`}>
          <p>Block {name}? You won’t see each other, here or in chat.</p>
          <button type="button" className="btn gold" onClick={() => { void session.blockPerson(person.id); onClose(); }}>Block</button>
          <button type="button" className="btn ghost" onClick={() => setAsking(null)}>Back</button>
        </div>
      )}
    </div>
  );
}

/* ── The libraries ───────────────────────────────────────────────────── */

export function Servers({ session, snap }: { session: LibrarySession; snap: Snapshot }) {
  useEffect(() => { void session.refreshServers(); }, [session]);
  const list = snap.servers ? listedServers(snap.servers) : [];
  const cap = snap.servers?.cap ?? LOBBY_CAP;
  return (
    <section className="card lb-card" aria-label="Libraries">
      <div className="lb-head"><h2>Libraries</h2></div>
      {list.length === 0 && (
        <p className="lb-empty" data-testid="servers-none">{snap.servers ? "Just this library for now" : "Looking for libraries"}</p>
      )}
      <ul className="lb-servers">
        {list.map((s) => {
          const here = s.shard === snap.shard;
          const full = s.here >= cap && !here;
          return (
            <li key={s.shard}>
              <button type="button" className={`lb-server${here ? " on" : ""}`} disabled={full} aria-current={here ? "true" : undefined} onClick={() => void session.switchTo(s.shard)}>
                <span>Library {s.shard}</span>
                <span className="lb-sc">{s.here === 0 ? "empty" : full ? "full" : s.here}{s.friends > 0 && <small>{s.friends} friend{s.friends === 1 ? "" : "s"}</small>}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── The chat ────────────────────────────────────────────────────────── */

const RULES_KEY = "plumi-library-rules";
function rulesSeen(): boolean { try { return window.localStorage.getItem(RULES_KEY) === "1"; } catch { return false; } }

const hhmm = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function Chat({ session, snap, me }: { session: LibrarySession; snap: Snapshot; me: string }) {
  const now = useNow(5000);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const stick = useRef(true);
  const input = useId();
  const seen = acknowledged ?? (typeof window === "undefined" ? false : rulesSeen());

  const recent = snap.messages.filter((m) => m.senderId === me).map((m) => ({ body: m.body, at: m.createdAt }));
  const verdict = draft.trim() === "" ? null : spam.check(draft, recent, now);
  const hint = verdict && !verdict.ok ? spam.refusalLine(verdict.refusal) : null;
  const used = Array.from(tidy(draft)).length;

  // Stay at the newest message, unless you have scrolled up to read.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [snap.messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !verdict || !verdict.ok) return;
    setSending(true);
    setLine(null);
    const r = await session.send(draft);
    setSending(false);
    if (r.ok) { setDraft(""); stick.current = true; } else setLine(r.line);
  }

  const report = (m: LibraryMessage, reason: MessageReportReason, block: boolean) => { setMenu(null); void session.reportMessage(m, reason, block); };

  return (
    <section className="card lb-card lb-chat" aria-label="Library chat">
      <div className="lb-head"><h2>Library chat</h2><span className="lb-hint">Everyone in Library {snap.shard}</span></div>
      <ul className="lb-msgs" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages" tabIndex={0} ref={list} onScroll={(e) => { const t = e.currentTarget; stick.current = t.scrollHeight - t.scrollTop - t.clientHeight < 24; }}>
        {snap.messages.length === 0 && <li className="lb-empty">{snap.chatLoaded ? "Say hi to the library" : ""}</li>}
        {snap.messages.map((m) => {
          const mine = m.senderId === me;
          return (
            <li key={m.id} className={`lb-msg${mine ? " is-mine" : ""}`}>
              <div className="lb-mh">
                <b className={m.pro ? "lb-pro" : undefined}>{mine ? "You" : m.name}</b>
                <time dateTime={new Date(m.createdAt).toISOString()}>{hhmm(m.createdAt)}</time>
                {!mine && <button type="button" className="lb-more" aria-label={`Report or block ${m.name}`} aria-expanded={menu === m.id} onClick={() => setMenu(menu === m.id ? null : m.id)}>{"⋯"}</button>}
              </div>
              <p>{m.body}</p>
              {menu === m.id && (
                <div className="lb-ask" role="group" aria-label="Report this message">
                  <span className="lbl">Report</span>
                  {REPORT_MESSAGE.map((r) => <button key={r.id} type="button" className="chip" onClick={() => report(m, r.id, false)}>{r.label}</button>)}
                  <button type="button" className="chip" onClick={() => report(m, "other", true)}>Report and block</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!seen ? (
        <div className="lb-rules">
          <p><b>No links. No swearing. Be kind.</b> Everyone here is a student, and you only ever see nicknames.</p>
          <button type="button" className="btn gold" onClick={() => { try { window.localStorage.setItem(RULES_KEY, "1"); } catch { /* fine without */ } setAcknowledged(true); }}>Got it</button>
        </div>
      ) : (
        <form className="lb-form" onSubmit={send}>
          <label htmlFor={input} className="sr-only">Message the library</label>
          <input id={input} type="text" value={draft} autoComplete="off" enterKeyHint="send" placeholder="Say something kind" aria-describedby={`${input}-hint`}
            onChange={(e) => { setDraft(e.target.value); setLine(null); }} />
          <span className={`lb-n${used > MAX_LENGTH ? " over" : ""}`} aria-hidden="true">{used > 0 ? `${used}/${MAX_LENGTH}` : ""}</span>
          <button type="submit" className="btn gold" disabled={sending || !verdict || !verdict.ok}>Send</button>
          <p id={`${input}-hint`} className={`lb-rule${hint || line ? " bad" : ""}`} role={line ? "alert" : undefined}>{line ?? hint ?? "No links. No swearing. Be kind."}</p>
        </form>
      )}
    </section>
  );
}
