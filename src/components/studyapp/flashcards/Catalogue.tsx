"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { signInHref, useAccount } from "@/lib/account";
import { track } from "@/lib/analytics";
import { entriesOf, boardFor, loadPremade, orderSpecs, PREMADE_SUBJECTS, toAdd, type PremadeEntry, type PremadeSlug } from "@/lib/studyapp/premade";
import type { PremadeSubject } from "@/lib/studyapp/premadeBuild";
import { isLocked, onTap, PREMADE_GATE_ON, usePro } from "@/lib/studyapp/pro";
import { useQuestionsValue } from "@/lib/studyapp/questions/store";
import { actions, useApp } from "@/lib/studyapp/store";
import { toast } from "../toast";
import { StarterPicker } from "./StarterPicker";

type Tab = PremadeSlug | "free";
const TINT: Record<PremadeSlug, string> = { biology: "var(--t-bio)", chemistry: "var(--t-chem)", physics: "var(--t-fm)" };

/**
 * The ready-made decks: Biology, Chemistry and Physics module decks (built from the iPad's definitions, lazily loaded: nothing here is fetched
 * until a subject tab is on screen) and the free starters. A student's own board, from the Questions setup, is opened first; the others are one tap away.
 */
export function Catalogue() {
  const mine = useQuestionsValue((q) => q.mine);
  const sets = useQuestionsValue((q) => q.sets);
  const recent = useMemo(() => sets.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((s) => s.subject).filter((s): s is string => !!s), [sets]);
  const own = (slug: PremadeSlug) => boardFor(slug, mine, recent);
  const first = (): Tab => PREMADE_SUBJECTS.find((s) => own(s.slug))?.slug ?? "biology";
  const [tab, setTab] = useState<Tab>(first);
  const [picked, setPicked] = useState<Partial<Record<PremadeSlug, string>>>({});
  const [locked, setLocked] = useState<{ slug: PremadeSlug; entry: PremadeEntry } | null>(null);

  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("premade_opened", { gate: PREMADE_GATE_ON ? "on" : "off" });
  }, []);

  if (locked) return <ProPanel onBack={() => setLocked(null)} />;
  return (
    <div className="cat" data-testid="catalogue">
      <div className="seg cat-tabs" role="tablist" aria-label="Subject">
        {PREMADE_SUBJECTS.map((s) => (
          <button key={s.slug} type="button" role="tab" id={`cat-tab-${s.slug}`} aria-selected={tab === s.slug} aria-controls="cat-panel" onClick={() => setTab(s.slug)} data-testid={`cat-tab-${s.slug}`}>{s.name}</button>
        ))}
        <button type="button" role="tab" id="cat-tab-free" aria-selected={tab === "free"} aria-controls="cat-panel" onClick={() => setTab("free")} data-testid="cat-tab-free" aria-label="Free starters">Free<span className="cat-long"> starters</span></button>
      </div>
      <div id="cat-panel" role="tabpanel" aria-labelledby={`cat-tab-${tab}`}>
        {tab === "free"
          ? <StarterPicker compact />
          : <SubjectDecks key={tab} slug={tab} own={own(tab)} board={picked[tab] ?? own(tab)} onBoard={(b) => setPicked((p) => ({ ...p, [tab]: b }))} onLocked={(entry) => setLocked({ slug: tab, entry })} />}
      </div>
    </div>
  );
}

function SubjectDecks({ slug, own, board, onBoard, onLocked }: { slug: PremadeSlug; own: string | null; board: string | null; onBoard: (spec: string) => void; onLocked: (e: PremadeEntry) => void }) {
  const { data: app } = useApp();
  const pro = usePro();
  const [state, setState] = useState<{ status: "loading" } | { status: "failed" } | { status: "ready"; data: PremadeSubject }>({ status: "loading" });
  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    loadPremade(slug).then((data) => { if (live) setState({ status: "ready", data }); }, () => { if (live) setState({ status: "failed" }); });
    return () => { live = false; };
  }, [slug, tries]);

  if (state.status === "failed") {
    return (
      <div className="cat-empty" data-testid="cat-failed">
        <p>These decks didn&rsquo;t open.</p>
        <button type="button" className="btn gold" onClick={() => { setState({ status: "loading" }); setTries((n) => n + 1); }}>Try again</button>
      </div>
    );
  }
  if (state.status === "loading") return <ul className="cat-grid" aria-busy="true" aria-label="Loading decks" data-testid="cat-loading">{[0, 1, 2, 3].map((i) => <li key={i} className="cat-tile ghosty" aria-hidden="true" />)}</ul>;

  const data = state.data;
  const specs = orderSpecs(data.specs, own);
  const spec = specs.find((s) => s.id === board) ?? null;
  const entries = spec ? entriesOf(data, spec) : [];
  const most = Math.max(1, ...entries.map((e) => e.count));
  const has = (key: string) => app.decks.some((d) => d.starter === key);

  const tap = async (entry: PremadeEntry) => {
    let action = onTap(pro.gateOn, pro.state, entry.free);
    if (action === "wait") action = onTap(pro.gateOn, await pro.ask(), entry.free);
    if (action === "locked") {
      track("premade_locked_tapped", { subject: slug, deck: entry.key });
      onLocked(entry);
      return;
    }
    actions.addPremade(toAdd(data, entry));
    track("premade_deck_added", { subject: slug, deck: entry.key, gated: pro.gateOn && !entry.free });
    toast("Deck added");
  };

  return (
    <div className="cat-sub" data-testid={`cat-${slug}`}>
      <div className="cat-boards" role="group" aria-label="Exam board">
        {specs.map((s) => (
          <button key={s.id} type="button" className="cat-chip" aria-pressed={s.id === board} onClick={() => onBoard(s.id)} data-testid={`cat-board-${s.id}`} title={`${s.label} ${s.code}`}>
            {s.label}<small>{s.code}</small>{s.id === own && <i aria-label="your board">yours</i>}
          </button>
        ))}
      </div>
      {!spec ? (
        <p className="cat-pick" data-testid="cat-pick-board">Pick your board.</p>
      ) : (
        <ul className="cat-grid" data-testid="cat-decks">
          {entries.map((e) => {
            const added = has(e.key);
            const lock = isLocked(pro.gateOn, pro.state, e.free);
            return (
              <li key={e.key}>
                <button type="button" className={`cat-tile${added ? " added" : ""}${lock ? " locked" : ""}`} disabled={added} onClick={() => void tap(e)} data-testid={`cat-deck-${e.key}`} aria-label={`${e.title}, ${e.count} cards${added ? ", added" : lock ? ", Pro" : ""}`}>
                  <span className="cat-name"><b>{e.title}</b><small>{e.count} cards</small></span>
                  <span className="cat-end" aria-hidden="true">
                    {added ? <span className="cat-done">Added</span>
                      : lock ? <span className="cat-pro">Pro</span>
                      : pro.gateOn && e.free ? <span className="cat-free">Free</span>
                      : <span className="cat-plus">+</span>}
                  </span>
                  <span className="cat-bar" aria-hidden="true"><i style={{ width: `${Math.max(8, Math.round((e.count / most) * 100))}%`, background: TINT[slug] }} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="starter-note" data-testid="cat-note">Written by Plumi, not yet checked by a teacher. Check a card against your own spec and edit it if it differs.</p>
    </div>
  );
}

/** What a tap on a locked deck shows. No price and no way to buy: Pro is bought in the iPad app, and the website only learns of it at sign-in. */
function ProPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAccount();
  const signedOut = !user || !!user.is_anonymous;
  return (
    <div className="cat-pro-panel" data-testid="pro-panel" role="region" aria-labelledby="pro-h">
      <div className="cat-pro-art" aria-hidden="true">{PREMADE_SUBJECTS.map((s) => <span key={s.slug} className="stk" style={{ background: TINT[s.slug] }}>{s.name}</span>)}</div>
      <h3 id="pro-h">Part of Plumi Pro</h3>
      <p>Pro adds every module deck, on every board we cover.</p>
      <p className="cat-pro-how">Pro is bought in the Plumi app on iPad, then it works here when you sign in.</p>
      <div className="sheet-acts">
        {signedOut && <a className="btn gold" href={signInHref("header", "/study/flashcards")} data-testid="pro-signin">Sign in</a>}
        <button type="button" className={signedOut ? "btn ghost" : "btn gold"} onClick={onBack} data-autofocus data-testid="pro-back">Back to the decks</button>
      </div>
    </div>
  );
}
