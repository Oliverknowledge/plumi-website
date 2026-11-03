"use client";

import { useEffect, useRef, useState } from "react";
import { INK_TOTAL_CAP } from "@/lib/studyapp/questions/ink";
import { inkOfSet, inkTotal, progress, type QuestionsData } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { subjectTint } from "@/lib/studyapp/questions/subject";
import { CloseIcon, TrashIcon } from "./icons";

const size = (b: number) => (b < 1000 ? "" : b < 1_000_000 ? `${Math.round(b / 1000)} KB` : `${(b / 1_000_000).toFixed(1)} MB`);
/** "AQA GCSE Physics" is Physics: the colour of the set's folder (best effort; a name we do not know still gets a steady tint). */
const subjectOfTitle = (title: string) => title.replace(/\b(AQA|Edexcel|OCR|WJEC|Eduqas|CCEA|Pearson|Cambridge|International|IGCSE|GCSE|A-Level|AS|Level \d(\/\d)?)\b/g, "").replace(/\s+/g, " ").trim() || title;
const when = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * Every set kept on this device, how much room its handwriting takes, and a way to clear the old ones. A native modal
 * <dialog>: focus is kept inside, Escape closes it, and focus goes back to the button that opened it. It is always closed
 * through the dialog itself (`close()`), so that return of focus happens.
 */
export function SetsSheet({ q, onClose }: { q: QuestionsData; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();   // (leaving the page takes it off the top layer; closing here would fire `close` into the parent)
  }, []);
  useEffect(() => { if (asking) keep.current?.focus(); }, [asking]);
  const close = () => { const d = ref.current; if (d?.open) d.close(); else onClose(); };
  const used = inkTotal(q);
  const line = used < 1000 ? "Handwriting uses almost no room." : `Handwriting uses ${size(used)} of ${size(INK_TOTAL_CAP)}.`;
  return (
    <dialog
      ref={ref} className="qs-dialog card" aria-labelledby="qs-sets-title" aria-describedby="qs-sets-sub" onClose={onClose}
      onCancel={(e) => { if (asking) { e.preventDefault(); setAsking(null); } }}
      onClick={(e) => { if (e.target === ref.current) close(); }}
    >
      <div className="qs-dialog-head">
        <h2 id="qs-sets-title">Your sets</h2>
        <button type="button" className="btn ghost icon" aria-label="Close" onClick={close}><CloseIcon /></button>
      </div>
      <p className="qs-dialog-sub" id="qs-sets-sub">Kept on this device. {line}</p>
      {q.sets.length === 0 ? <p className="qs-empty-line">No sets yet.</p> : (
        <ul className="qs-sets">
          {q.sets.map((s) => {
            const p = progress(s, q.answers);
            const ink = size(inkOfSet(q, s.id));
            return (
              <li key={s.id} className={`qs-set${s.finishedAt ? " is-finished" : ""}`} style={{ "--tint": subjectTint(subjectOfTitle(s.title)) } as React.CSSProperties}>
                {asking === s.id ? (
                  <span className="qs-ask" role="group" aria-label={`Delete ${s.name}?`}><span>Delete it and its answers?</span>
                    <button ref={keep} type="button" className="qs-mini" onClick={() => setAsking(null)}>Keep</button>
                    <button type="button" className="qs-mini danger" onClick={() => { qa.remove(s.id); setAsking(null); }}>Delete</button>
                  </span>
                ) : (
                  <>
                    <button type="button" className="qs-set-open" onClick={() => { qa.open(s.id); close(); }} aria-label={`Open ${s.name}${p.of > 0 ? `, ${p.done} of ${p.of} marked` : ""}${s.finishedAt ? ", finished" : ""}`}>
                      <span className="qs-set-name">{s.name}</span>
                      <span className="qs-set-meta">{when(s.updatedAt || s.createdAt)}{ink ? ` · ${ink}` : ""}{s.finishedAt ? " · finished" : ""}</span>
                      {p.of > 0 && (
                        <span className="qs-set-prog" aria-hidden="true"><span className="qs-set-bar"><i style={{ width: `${Math.round((p.done / p.of) * 100)}%` }} /></span><span className="qs-set-n">{p.done} of {p.of}</span></span>
                      )}
                    </button>
                    <button type="button" className="qs-set-del" onClick={() => setAsking(s.id)} aria-label={`Delete ${s.name}`} title="Delete"><TrashIcon /></button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
