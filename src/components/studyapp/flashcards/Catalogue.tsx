"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { boardFor, entriesOf, GROUPS, loadMarkScheme, loadMarkSchemeIndex, loadPremade, MarkSchemeDenied, msEntriesFromIndex, MS_BOARDS, orderSpecs, PREMADE_SUBJECTS, toAdd, type MsIndexSpec, type PremadeEntry, type PremadeGroup, type PremadeSlug } from "@/lib/studyapp/premade";
import type { PremadeSubject } from "@/lib/studyapp/premadeBuild";
import { accessToken } from "@/lib/account";
import { usePro } from "@/lib/pro/client";
import { useProLock } from "../../pro/ProGate";
import { ProTag } from "../../pro/ProTag";
import { useQuestionsValue } from "@/lib/studyapp/questions/store";
import { actions, useApp } from "@/lib/studyapp/store";
import { toast } from "../toast";
import { StarterPicker } from "./StarterPicker";

type Tab = PremadeSlug | "free";
const TINT: Record<PremadeSlug, string> = { biology: "var(--t-bio)", chemistry: "var(--t-chem)", physics: "var(--t-fm)" };

/**
 * The ready-made decks: Biology, Chemistry and Physics module decks and the free starters. Key wording decks (Plumi's definitions) are free. Mark scheme decks
 * (the exam boards' own wording) are Plumi Pro only: everyone sees what exists (module names and card counts), but the cards are fetched from the server
 * only for a Pro account (lib/studyapp/proServer.ts), so a locked deck has no text behind it. A student's own board, from the Questions setup, is opened first.
 */
export function Catalogue() {
  const mine = useQuestionsValue((q) => q.mine);
  const sets = useQuestionsValue((q) => q.sets);
  const recent = useMemo(() => sets.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((s) => s.subject).filter((s): s is string => !!s), [sets]);
  const own = (slug: PremadeSlug, group: PremadeGroup) => boardFor(slug, mine, recent, group);
  const first = (): Tab => PREMADE_SUBJECTS.find((s) => own(s.slug, "kw") || own(s.slug, "ms"))?.slug ?? "biology";
  const [tab, setTab] = useState<Tab>(first);
  
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("premade_opened");
  }, []);

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
          : <SubjectDecks key={tab} slug={tab} own={(g) => own(tab, g)} />}
      </div>
    </div>
  );
}

type Loaded<T> = { key: string; status: "loading" | "failed" | "ready"; data?: T };

function SubjectDecks({ slug, own }: { slug: PremadeSlug; own: (g: PremadeGroup) => string | null }) {
  const { data: app } = useApp();
  const pro = usePro();
  const lock = useProLock("mark-scheme-decks");
  // Open on the kind the student's own board has decks of (a GCSE student has mark scheme decks only), else Key wording.
  const [group, setGroup] = useState<PremadeGroup>(() => (own("kw") || !own("ms") ? "kw" : "ms"));
  const [picked, setPicked] = useState<Partial<Record<PremadeGroup, string>>>({});
  const board = picked[group] ?? own(group);
  const [kw, setKw] = useState<Loaded<PremadeSubject>>({ key: "", status: "loading" });
  const [index, setIndex] = useState<Loaded<MsIndexSpec[]>>({ key: "", status: "loading" });
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);

  // Key wording: the subject's one file. Mark scheme: only the public index (names and counts), never card text.
  useEffect(() => {
    let live = true;
    if (group === "kw") loadPremade(slug).then((data) => { if (live) setKw({ key: slug, status: "ready", data }); }, () => { if (live) setKw({ key: slug, status: "failed" }); });
    else loadMarkSchemeIndex().then((data) => { if (live) setIndex({ key: "ms", status: "ready", data }); }, () => { if (live) setIndex({ key: "ms", status: "failed" }); });
    return () => { live = false; };
  }, [group, slug, tries]);

  const kwReady = kw.status === "ready" && kw.key === slug ? kw.data! : null;
  const failed = group === "kw" ? kw.status === "failed" && kw.key === slug : index.status === "failed";
  const msSpec = group === "ms" && index.status === "ready" ? index.data!.find((s) => s.id === board) ?? null : null;
  const kwSpec = kwReady && group === "kw" ? kwReady.specs.find((s) => s.id === board) ?? null : null;
  const entries: PremadeEntry[] = group === "ms" ? (msSpec ? msEntriesFromIndex(msSpec) : []) : kwReady && kwSpec ? entriesOf(kwReady, kwSpec) : [];
  const chips = group === "ms"
    ? [...MS_BOARDS[slug]].sort((a, b) => Number(b.id === own("ms")) - Number(a.id === own("ms")))
    : kwReady ? orderSpecs(kwReady.specs, own("kw")).map((s) => ({ id: s.id, label: s.label, code: s.code })) : [];
  const most = Math.max(1, ...entries.map((e) => e.count));
  const has = (key: string) => app.decks.some((d) => d.starter === key);
  const loadedList = group === "ms" ? !!msSpec : !!kwSpec;

  const tap = async (entry: PremadeEntry) => {
    if (busy) return;
    if (group === "kw") {
      actions.addPremade(toAdd(kwReady!, entry));
      track("premade_deck_added", { subject: slug, deck: entry.key, group });
      toast("Deck added");
      return;
    }
    // Mark scheme: Pro only. The tile only says so; the server is what decides. A free student gets the panel; if the plan could not be read, ask the server anyway.
    const plan = pro.state === "unknown" ? await pro.ready() : pro.plan;
    if (plan.state === "free" || plan.state === "session") { lock.tap(); return; }
    setBusy(true);
    try {
      const token = await accessToken();
      if (!token) { lock.tap(); return; }
      const full = await loadMarkScheme(board!, token);
      const e = entriesOf(full, full.specs[0]).find((x) => x.key === entry.key);
      if (!e) throw new Error("module");
      actions.addPremade(toAdd(full, e));
      track("premade_deck_added", { subject: slug, deck: entry.key, group });
      toast("Deck added");
    } catch (err) {
      if (err instanceof MarkSchemeDenied) { await pro.refresh(); lock.tap(); }   // (asked again first, so the panel says the true reason: a sign-in that has run out is not "buy Pro")
      else toast("That deck didn\u2019t open. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="cat-sub" data-testid={`cat-${slug}`}>
      <div className="cat-groups" role="group" aria-label="Kind of deck">
        {GROUPS.map((g) => (
          <button key={g.id} type="button" className="cat-group" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} data-testid={`cat-group-${g.id}`}>
            {g.name}{g.id === "ms" && <ProTag className="sm" />}
          </button>
        ))}
      </div>
      {chips.length > 0 && (
        <div className="cat-boards" role="group" aria-label="Exam board">
          {chips.map((s) => (
            <button key={s.id} type="button" className="cat-chip" aria-pressed={s.id === board} onClick={() => setPicked((p) => ({ ...p, [group]: s.id }))} data-testid={`cat-board-${s.id}`} title={`${s.label} ${s.code}`}>
              {s.label}<small>{s.code}</small>{s.id === own(group) && <i aria-label="your board">yours</i>}
            </button>
          ))}
        </div>
      )}
      {failed ? (
        <div className="cat-empty" data-testid="cat-failed">
          <p>These decks didn&rsquo;t open.</p>
          <button type="button" className="btn gold" onClick={() => { setKw({ key: "", status: "loading" }); setIndex({ key: "", status: "loading" }); setTries((n) => n + 1); }}>Try again</button>
        </div>
      ) : !board ? (
        <p className="cat-pick" data-testid="cat-pick-board">Pick your board.</p>
      ) : !loadedList ? (
        <ul className="cat-grid" aria-busy="true" aria-label="Loading decks" data-testid="cat-loading">{[0, 1, 2, 3].map((i) => <li key={i} className="cat-tile ghosty" aria-hidden="true" />)}</ul>
      ) : (
        <ul className="cat-grid" data-testid="cat-decks">
          {entries.map((e) => {
            const added = has(e.key);
            const locked = group === "ms" && (pro.state === "free" || pro.state === "session");
            const waiting = group === "ms" && pro.state === "unknown";
            return (
              <li key={e.key}>
                <button type="button" className={`cat-tile${added ? " added" : ""}${locked ? " locked" : ""}`} disabled={added} onClick={() => void tap(e)} data-testid={`cat-deck-${e.key}`} aria-label={`${e.title}, ${e.count} cards${added ? ", added" : locked ? ", Pro" : ""}`}>
                  <span className="cat-name"><b>{e.module}</b><small>{e.count} cards</small></span>
                  <span className="cat-end" aria-hidden="true">
                    {added ? <span className="cat-done">Added</span>
                      : locked ? <ProTag />
                      : waiting ? <span className="cat-wait" />
                      : <span className="cat-plus">+</span>}
                  </span>
                  <span className="cat-bar" aria-hidden="true"><i style={{ width: `${Math.max(8, Math.round((e.count / most) * 100))}%`, background: TINT[slug] }} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {lock.panel}
      <p className="starter-note" data-testid="cat-note">{group === "ms" ? "Each exam board’s own mark scheme wording, from past papers. The key words are in bold." : "Written by Plumi, not yet checked by a teacher. Check a card against your own spec and edit it if it differs."}</p>
    </div>
  );
}
