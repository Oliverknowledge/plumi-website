"use client";

import { useState } from "react";
import { useNow } from "@/lib/studyapp/clock";
import {
  deckStats, dueNow, SESSION_NAME_MAX, subjectColour, subjectsInUse, suggestSessionName, type AppData, type Deck, type Session,
} from "@/lib/studyapp/model";
import { actions, useApp } from "@/lib/studyapp/store";

/** What the desk is showing, so its row in the list can say so. */
export type Source = { kind: "scope" } | { kind: "deck"; id: string } | { kind: "session"; id: string };

export const ALL = "all";
export const NONE = "none";
/** The subject a scope names: a subject, null (decks with no subject), or undefined for all of them. */
export const subjectOf = (scope: string): string | null | undefined => (scope === ALL ? undefined : scope === NONE ? null : scope);
export const decksInScope = (data: AppData, scope: string): Deck[] => {
  const subject = subjectOf(scope);
  return subject === undefined ? data.decks : data.decks.filter((d) => (d.subject ?? null) === subject);
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A quiet line under a deck's name: how many cards, how many are new, how many are known well. */
function statLine(st: { total: number; fresh: number; mature: number }) {
  if (st.total === 0) return "No cards yet";
  return [plural(st.total, "card"), st.fresh > 0 ? `${st.fresh} new` : "", st.mature > 0 ? `${st.mature} known` : ""].filter(Boolean).join(" · ");
}

function NameForm({ initial, label, submit, onSubmit, onCancel, onDelete }: { initial: string; label: string; submit: string; onSubmit: (name: string) => void; onCancel: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(initial);
  return (
    <form className="side-name" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name); }} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}>
      <label htmlFor="side-name-input" className="sr">{label}</label>
      <input id="side-name-input" value={name} maxLength={SESSION_NAME_MAX} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Name this session" data-testid="session-name" />
      <div className="side-name-acts">
        <button type="submit" className="btn gold" disabled={!name.trim()} data-testid="session-save">{submit}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className="btn ghost danger" onClick={onDelete} data-testid="session-delete">Delete session</button>}
      </div>
    </form>
  );
}

export function SidePanel({
  scope, onScope, source, ticked, onTick, onClearTicks, onReviewTicked, onPickDeck, onPickSession, onEdit, onImport, onNewDeck, onStarters,
}: {
  scope: string; onScope: (s: string, pointer: boolean) => void; source: Source; ticked: string[];
  onTick: (id: string, on: boolean) => void; onClearTicks: () => void; onReviewTicked: () => void;
  onPickDeck: (id: string) => void; onPickSession: (id: string) => void; onEdit: (id: string) => void;
  onImport: () => void; onNewDeck: () => void; onStarters: () => void;
}) {
  const { data } = useApp();
  const now = useNow(1000);
  const [naming, setNaming] = useState<"new" | string | null>(null);

  const subjects = subjectsInUse(data);
  const dueFor = (ids: readonly string[]) => (now ? dueNow(data, now, ids).ids.length : 0);
  const decks = decksInScope(data, scope);
  const groups = scope === ALL ? subjects.map((s) => ({ subject: s, decks: data.decks.filter((d) => (d.subject ?? null) === s) })) : [{ subject: subjectOf(scope) ?? null, decks }];
  const sessions = data.sessions.filter((s) => scope === ALL || s.deckIds.some((id) => decks.some((d) => d.id === id)));
  const tickedDecks = data.decks.filter((d) => ticked.includes(d.id));
  const scopeName = (s: string | null) => s ?? "No subject";

  const createSession = (name: string) => {
    const id = actions.addSession(name, tickedDecks.map((d) => d.id));
    if (id) { setNaming(null); onClearTicks(); onPickSession(id); }
  };

  const sessionRow = (s: Session) => {
    const ids = s.deckIds;
    const due = dueFor(ids);
    const on = source.kind === "session" && source.id === s.id;
    if (naming === s.id) {
      return (
        <li key={s.id} className="sess editing">
          <NameForm initial={s.name} label="Session name" submit="Rename" onCancel={() => setNaming(null)} onSubmit={(n) => { actions.renameSession(s.id, n); setNaming(null); }} onDelete={() => { actions.deleteSession(s.id); setNaming(null); }} />
        </li>
      );
    }
    return (
      <li key={s.id} className={`sess${on ? " on" : ""}`} data-testid="session-row">
        <button type="button" className="sess-main" onClick={() => onPickSession(s.id)} aria-current={on ? "true" : undefined}>
          <b>{s.name}</b>
          <small>{plural(ids.length, "deck")}</small>
        </button>
        {due > 0 ? <span className="due-n" role="img" aria-label={`${due} due`}>{due}</span> : <span aria-hidden="true" />}
        <button type="button" className="row-more" onClick={() => setNaming(s.id)} aria-label={`Rename or delete ${s.name}`} data-testid="session-edit"><span aria-hidden="true">&#9998;</span></button>
      </li>
    );
  };

  const deckRow = (d: Deck) => {
    const st = now ? deckStats(data, d.id, now) : { total: 0, due: 0, fresh: 0, learning: 0, mature: 0 };
    const on = source.kind === "deck" && source.id === d.id;
    const checked = ticked.includes(d.id);
    return (
      <li key={d.id} className={`dbox${on ? " on" : ""}${checked ? " ticked" : ""}`} data-testid="deck-row">
        <label className="tick">
          <input type="checkbox" checked={checked} onChange={(e) => onTick(d.id, e.target.checked)} data-testid="deck-tick" />
          <span className="sr">Mix {d.title}</span>
        </label>
        <button type="button" className="dbox-main" onClick={() => onPickDeck(d.id)} aria-current={on ? "true" : undefined} data-testid="deck-open" title={d.title}>
          <b>{d.title}</b>
          <small>{statLine(st)}</small>
          <span className="known" aria-hidden="true"><i style={{ width: `${st.total ? Math.round((st.mature / st.total) * 100) : 0}%` }} /></span>
        </button>
        {st.due > 0 ? <span className="due-n" role="img" aria-label={`${st.due} due`}>{st.due}</span> : <span aria-hidden="true" />}
        <button type="button" className="row-more" onClick={() => onEdit(d.id)} aria-label={`Edit ${d.title}`} data-testid="deck-edit"><span aria-hidden="true">&#8943;</span></button>
      </li>
    );
  };

  return (
    <aside className="fcl-side" aria-label="Decks and sessions">
      <div className="side-scope" role="group" aria-label="Which decks">
        <button type="button" aria-pressed={scope === ALL} onClick={(e) => onScope(ALL, e.detail > 0)} data-testid="scope-all">All subjects</button>
        {subjects.map((s) => {
          const key = s ?? NONE;
          const ids = data.decks.filter((d) => (d.subject ?? null) === s).map((d) => d.id);
          const due = dueFor(ids);
          return (
            <button key={key} type="button" aria-pressed={scope === key} onClick={(e) => onScope(key, e.detail > 0)} data-testid={`scope-${key}`}>
              <i aria-hidden="true" style={{ background: subjectColour(s) }} />{scopeName(s)}{due > 0 && <small role="img" aria-label={`${due} due`}>{due}</small>}
            </button>
          );
        })}
      </div>

      <section className="side-sec" aria-labelledby="side-sessions">
        <div className="side-h">
          <h2 id="side-sessions">My sessions</h2>
          <button type="button" className="mini" disabled={tickedDecks.length === 0 || naming === "new"} onClick={() => setNaming("new")} data-testid="new-session">+ New session</button>
        </div>
        {naming === "new" && tickedDecks.length > 0 && (
          <NameForm initial={suggestSessionName(tickedDecks.map((d) => d.title))} label="Name for the new session" submit="Save session" onCancel={() => setNaming(null)} onSubmit={createSession} />
        )}
        {sessions.length === 0 && !(naming === "new" && tickedDecks.length > 0) && <p className="side-note">{tickedDecks.length === 0 ? "Tick decks below to mix them into a session you can run again" : "Mix these decks into a session you can run again"}</p>}
        {sessions.length > 0 && <ul className="side-list" data-testid="sessions">{sessions.map(sessionRow)}</ul>}
      </section>

      {groups.map((g, gi) => (
        <section key={g.subject ?? NONE} className="side-sec" aria-labelledby={`side-decks-${gi}`}>
          <div className="side-h">
            <h2 id={`side-decks-${gi}`}>
              {scope === ALL && <i aria-hidden="true" className="sq" style={{ background: subjectColour(g.subject) }} />}
              {scope === ALL ? scopeName(g.subject) : `${scopeName(g.subject)} decks`}
            </h2>
            {gi === 0 && <span className="side-aside">Tick to mix</span>}
          </div>
          {g.decks.length === 0
            ? <p className="side-note" data-testid="no-decks">No decks yet. Make one, or bring yours in from Anki.</p>
            : <ul className="side-list" data-testid="decks">{g.decks.map(deckRow)}</ul>}
        </section>
      ))}
      {groups.length === 0 && (
        <section className="side-sec" aria-labelledby="side-decks-none">
          <div className="side-h"><h2 id="side-decks-none">Decks</h2><span className="side-aside">Tick to mix</span></div>
          <p className="side-note" data-testid="no-decks">No decks yet. Make one, or bring yours in from Anki.</p>
        </section>
      )}

      {tickedDecks.length > 0 && (
        <div className="side-sel" data-testid="selection">
          <div className="side-sel-h"><b>{plural(tickedDecks.length, "deck")} ticked</b><span>{dueFor(tickedDecks.map((d) => d.id))} due</span></div>
          <div className="side-sel-acts">
            <button type="button" className="btn gold" disabled={dueFor(tickedDecks.map((d) => d.id)) === 0} onClick={onReviewTicked} data-testid="review-ticked">Review the mix</button>
            <button type="button" className="btn ghost" onClick={onClearTicks} data-testid="clear-ticks">Clear</button>
          </div>
        </div>
      )}

      <button type="button" className="side-link" onClick={onStarters} data-testid="starters-open">Ready-made decks</button>

      <div className="side-dock">
        <button type="button" className="dock wide" onClick={onImport} data-testid="import-open"><span aria-hidden="true">&darr;</span> Import</button>
        <button type="button" className="dock" onClick={onNewDeck} data-testid="new-deck-open">+ New deck</button>
        <button type="button" className="dock off" disabled><span>From my notes</span><small>On iPad</small></button>
        <button type="button" className="dock off wide" disabled><span>From my mistakes</span><small>On iPad</small></button>
      </div>

      <label className="side-set">
        <span>New cards a day</span>
        <select value={data.perDay} onChange={(e) => actions.setPerDay(Number(e.target.value))} data-testid="per-day">
          {[0, 5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n === 0 ? "None (reviews only)" : n}</option>)}
        </select>
      </label>
    </aside>
  );
}
