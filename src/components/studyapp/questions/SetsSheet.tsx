"use client";

import { useEffect, useRef, useState } from "react";
import { INK_TOTAL_CAP } from "@/lib/studyapp/questions/ink";
import { inkOfSet, inkTotal, progress, type QuestionsData } from "@/lib/studyapp/questions/model";
import { qa } from "@/lib/studyapp/questions/store";
import { CloseIcon } from "./icons";

const size = (b: number) => (b < 1000 ? "none" : b < 1_000_000 ? `${Math.round(b / 1000)} KB` : `${(b / 1_000_000).toFixed(1)} MB`);
const when = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Every set kept on this device, how much room its handwriting takes, and a way to clear the old ones. */
export function SetsSheet({ q, onClose }: { q: QuestionsData; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [asking, setAsking] = useState<string | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();   // (leaving the page takes it off the top layer; closing here would fire `close` into the parent)
  }, []);
  const used = inkTotal(q);
  return (
    <dialog ref={ref} className="qs-dialog card" aria-label="Your sets" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="qs-dialog-head">
        <h2>Your sets</h2>
        <button type="button" className="btn ghost icon" aria-label="Close" onClick={onClose}><CloseIcon /></button>
      </div>
      <p className="qs-dialog-sub">Kept on this device. Handwriting uses {size(used) === "none" ? "almost no" : size(used)} of {size(INK_TOTAL_CAP)}.</p>
      {q.sets.length === 0 ? <p className="qs-empty-line">No sets yet.</p> : (
        <ul className="qs-sets">
          {q.sets.map((s) => {
            const p = progress(s, q.answers);
            return (
              <li key={s.id}>
                <div className="qs-sets-info">
                  <b>{s.name}</b>
                  <span>{when(s.updatedAt || s.createdAt)} · {p.done}/{p.of} marked · {size(inkOfSet(q, s.id))}{s.finishedAt ? " · finished" : ""}</span>
                </div>
                {asking === s.id ? (
                  <span className="qs-ask"><span>Delete it and its answers?</span>
                    <button type="button" className="qs-mini danger" onClick={() => { qa.remove(s.id); setAsking(null); }}>Delete</button>
                    <button type="button" className="qs-mini" onClick={() => setAsking(null)}>Keep</button>
                  </span>
                ) : (
                  <span className="qs-sets-acts">
                    <button type="button" className="qs-mini" onClick={() => { qa.open(s.id); onClose(); }}>Open</button>
                    <button type="button" className="qs-mini" onClick={() => setAsking(s.id)} aria-label={`Delete ${s.name}`}>Delete</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
