"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { LibraryHandle } from "@/components/landing/cafeScene";
import { toast } from "@/components/studyapp/toast";
import { colourOf } from "@/lib/library";
import * as spam from "@/lib/social/librarySpam";
import { MAX_LENGTH, tidy } from "@/lib/social/chatRules";
import {
  EMOTE_TITLE, LOBBY_CAP, LOBBY_EMOTES, SEAT_SUBJECTS, focusClock, focusTag, listedServers, shownName, subjectName,
  type LibraryMessage, type LobbyPerson,
} from "@/lib/social/lobby";
import type { MessageReportReason, UserReportReason } from "@/lib/social/types";
import { useNow } from "@/lib/studyapp/clock";
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
function savedSubject(): string | null | undefined {
  try { const v = window.localStorage.getItem(SUBJECT_KEY); return v === null ? undefined : v === "" ? null : v; } catch { return undefined; }
}

export function SeatCard({ session, snap, handleRef }: { session: LibrarySession; snap: Snapshot; handleRef: RefObject<LibraryHandle | null> }) {
  const now = useNow(1000);
  // What you are on: what you last chose (per browser), until you choose.
  const [chosen, setChosen] = useState<string | null | undefined>(undefined);
  const subject = chosen !== undefined ? chosen : snap.subject !== null ? snap.subject : savedSubject();
  const timing = snap.seated && snap.focusSince !== null;
  const elapsed = timing && now ? (now - snap.focusSince!) / 1000 : 0;

  const choose = (id: string | null) => {
    setChosen(id);
    try { window.localStorage.setItem(SUBJECT_KEY, id ?? ""); } catch { /* fine without */ }
    if (timing) session.setSubject(id);
  };
  const sit = () => { if (!handleRef.current?.sit()) toast("No free seat close by. Tap one in the room"); };

  return (
    <section className="card lb-card lb-seat" aria-label="Your seat">
      <div className="lb-head">
        <h2>{snap.seated ? (timing ? "Focusing" : "You’re sitting") : "You’re standing"}</h2>
        {snap.nickname && <span className="lb-me">as <b>{snap.nickname}</b></span>}
      </div>
      {!snap.seated ? (
        <div className="lb-row">
          <button type="button" className="btn gold" onClick={sit}>Sit down</button>
          <span className="lb-hint">or tap a seat</span>
        </div>
      ) : (
        <>
          <div className="lb-chips" role="group" aria-label="What are you on?">
            {SEAT_SUBJECTS.map((s) => (
              <button key={s.label} type="button" className="chip" aria-pressed={subject === s.id && subject !== undefined} onClick={() => choose(s.id)}>{s.label}</button>
            ))}
          </div>
          <div className="lb-row">
            {timing ? <b className="lb-clock" aria-live="off">{focusClock(elapsed)}</b> : null}
            {timing
              ? <button type="button" className="btn" onClick={() => session.stopFocus()}>Stop</button>
              : <button type="button" className="btn gold" disabled={subject === undefined} onClick={() => session.startFocus(subject ?? null)}>Start focus</button>}
            <button type="button" className="btn ghost" onClick={() => handleRef.current?.stand()}>Stand up</button>
          </div>
        </>
      )}
      <div className="lb-row lb-emotes">
        {LOBBY_EMOTES.map((k) => (
          <button key={k} type="button" className="btn lb-emote" onClick={() => void session.emote(k)}>{EMOTE_TITLE[k]}</button>
        ))}
      </div>
    </section>
  );
}

/* ── Who is here ─────────────────────────────────────────────────────── */

export function WhoHere({ session, snap, picked, onPick, onPullUp }: { session: LibrarySession; snap: Snapshot; picked: string | null; onPick: (id: string | null) => void; onPullUp: (id: string) => void }) {
  const now = useNow(1000);
  const friends = snap.people.filter((p) => p.isFriend).length;
  const open = snap.people.find((p) => p.id === picked) ?? null;
  return (
    <section className="card lb-card" aria-label="Who is here">
      <div className="lb-head">
        <h2>Who’s here</h2>
        <span className="lb-count">{snap.people.length + 1}{friends ? ` · ${friends} friend${friends === 1 ? "" : "s"}` : ""}</span>
      </div>
      {open && <PersonCard key={open.id} session={session} person={open} now={now} onClose={() => onPick(null)} onPullUp={onPullUp} />}
      <ul className="lb-people">
        <li className="lb-person is-you"><i style={{ background: "var(--gold)" }} aria-hidden="true" /><span className="lb-pn">You</span><span className="lb-pt">{snap.seated ? (snap.focusSince !== null ? `${subjectName(snap.subject) ?? "Focusing"}` : "Sitting") : "Standing"}</span></li>
        {snap.people.map((p) => (
          <li key={p.id}>
            <button type="button" className={`lb-person${p.id === picked ? " is-picked" : ""}`} aria-pressed={p.id === picked} onClick={() => onPick(p.id === picked ? null : p.id)}>
              <i style={{ background: colourOf(p.colour) }} aria-hidden="true" />
              <span className="lb-pn">{shownName(p)}{p.isFriend && <small>Friend</small>}{p.pro && <small className="lb-pro">Pro</small>}</span>
              <span className="lb-pt">{focusTag(p, now) ?? (p.seated ? "Sitting" : "")}</span>
            </button>
          </li>
        ))}
      </ul>
      {snap.people.length === 0 && <p className="lb-empty">Just you for now</p>}
    </section>
  );
}

function PersonCard({ session, person, now, onClose, onPullUp }: { session: LibrarySession; person: LobbyPerson; now: number; onClose: () => void; onPullUp: (id: string) => void }) {
  const [asking, setAsking] = useState<"report" | "block" | null>(null);
  const [askLine, setAskLine] = useState<string | null>(null);
  const fb = friendButton(person);
  const tag = focusTag(person, now);
  const name = shownName(person);
  const platform = platformOf(person);
  return (
    <div className="lb-pcard" role="group" aria-label={name}>
      <div className="lb-ptop">
        <i style={{ background: colourOf(person.colour) }} aria-hidden="true" />
        <div>
          <b>{name}</b>
          <div className="lb-tags">
            {person.isFriend && <span className="lb-tag">Friend</span>}
            {platform && <span className="lb-tag lb-plat" data-testid="person-platform">On {platform}</span>}
            {person.pro && <span className="lb-tag lb-pro">Plumi Pro</span>}
          </div>
        </div>
        <button type="button" className="btn ghost icon" aria-label="Close" onClick={onClose}>{"×"}</button>
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
  if (list.length === 0) return null;
  return (
    <section className="card lb-card" aria-label="Libraries">
      <div className="lb-head"><h2>Libraries</h2></div>
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
      <ul className="lb-msgs" ref={list} onScroll={(e) => { const t = e.currentTarget; stick.current = t.scrollHeight - t.scrollTop - t.clientHeight < 24; }}>
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
