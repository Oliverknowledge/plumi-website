"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { addSubjectBoard, practiseWith, setSubjectHidden, TopicBoard, useBoardLook, useSubjectsOnBoard, type BoardSubject } from "./TopicBoard";

/**
 * My board (/my-board): every subject a student revises on one revision board (the founder, 31 October
 * 2026: boards scattered across subjects would be high friction). The cards are each subject's own, the
 * same ones its bank page shows; this page fetches each subject's topics and papers as it needs them
 * (/my-board/subjects/<slug>) and adds a chip a subject to show one at a time. Kept in this browser.
 */

export interface CatalogueSubject { slug: string; title: string; colour: string }

const loaded = new Map<string, BoardSubject>();
const fetchSubject = (slug: string): Promise<BoardSubject> => loaded.has(slug)
  ? Promise.resolve(loaded.get(slug)!)
  : fetch(`/my-board/subjects/${slug}`).then(r => r.json()).then((s: BoardSubject) => { loaded.set(slug, s); return s; });

const practise = practiseWith();

export function MyBoard({ catalogue }: { catalogue: CatalogueSubject[] }) {
  const look = useBoardLook();
  const slugs = useSubjectsOnBoard().filter(s => catalogue.some(c => c.slug === s));
  const [data, setData] = useState<Record<string, BoardSubject>>({});
  const [failed, setFailed] = useState(false);
  const want = slugs.filter(s => !data[s]).join(",");
  useEffect(() => {
    if (!want) return;
    let live = true;
    Promise.all(want.split(",").map(fetchSubject))
      .then(list => { if (live) setData(d => ({ ...d, ...Object.fromEntries(list.map(s => [s.slug, s])) })); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [want]);
  const subjects = slugs.map(s => data[s]).filter(Boolean);
  const add = async (slug: string) => {
    const s = await fetchSubject(slug);
    setData(d => ({ ...d, [slug]: s }));
    addSubjectBoard(s);
    setSubjectHidden(slug, false);
  };
  const picker = <AddSubject catalogue={catalogue.filter(c => !slugs.includes(c.slug))} onAdd={add} first={!slugs.length} />;

  if (!slugs.length) {
    return (
      <div className="mb-empty lp-card">
        <h2>Put your subjects on one board</h2>
        <p>Pick the subjects you’re revising. Each one starts with the three topics that come up most, ready in Up next.</p>
        {picker}
      </div>
    );
  }
  if (failed) return <p className="mb-wait">Your board couldn’t load. Check your connection and refresh.</p>;
  if (subjects.length < slugs.length) return <p className="mb-wait" role="status">Laying out your board…</p>;
  return <TopicBoard look={look}subjects={subjects} mine practise={practise} onHide={slug => setSubjectHidden(slug, true)} extra={picker} />;
}

/** "+ Add a subject": a search of every subject in the bank, the way "Your subjects" adds one on the bank's front page. */
function AddSubject({ catalogue, onAdd, first }: { catalogue: CatalogueSubject[]; onAdd: (slug: string) => void; first: boolean }) {
  const [open, setOpen] = useState(first);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? catalogue.filter(c => terms.every(t => c.title.toLowerCase().includes(t))).slice(0, 8) : [];
  useEffect(() => {
    if (!open || first) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, first]);
  return (
    <div className={`mb-add${first ? " is-first" : ""}`} ref={box}>
      {!first && <button type="button" className="tb-subject is-add" aria-expanded={open} onClick={() => setOpen(o => !o)}><span aria-hidden="true">+</span> Add a subject</button>}
      {open && (
        <div className="mb-add-pick" role="group" aria-label="Add a subject" onKeyDown={e => { if (e.key === "Escape" && !first) setOpen(false); }}>
          <label className="qb-find-box">
            <span className="qb-sr">Find a subject</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. “aqa chemistry”" autoComplete="off" autoFocus
              onKeyDown={e => { if (e.key === "Enter" && hits[0]) { e.preventDefault(); onAdd(hits[0].slug); setQ(""); } }} />
          </label>
          {hits.length > 0 && (
            <ul>
              {hits.map(c => (
                <li key={c.slug}><button type="button" style={{ "--tag": c.colour } as CSSProperties} onClick={() => { onAdd(c.slug); setQ(""); if (!first) setOpen(false); }}>
                  <i aria-hidden="true" />{c.title}<span aria-hidden="true">+</span>
                </button></li>
              ))}
            </ul>
          )}
          {!hits.length && <p className="mb-add-hint">{terms.length ? "No subject matches that." : <>Type a subject or a board. Or browse the <Link href="/question-bank">question bank</Link>.</>}</p>}
        </div>
      )}
    </div>
  );
}
