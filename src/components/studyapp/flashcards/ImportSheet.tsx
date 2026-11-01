"use client";

import { useMemo, useRef, useState } from "react";
import { deckNameFromFile, importProblemText, MAX_IMPORT_BYTES, parseImport } from "@/lib/studyapp/ankiImport";
import { SUBJECTS, subjectIn } from "@/lib/studyapp/model";
import { actions, useApp } from "@/lib/studyapp/store";
import { toast } from "../toast";
import { Sheet } from "./Sheet";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * Bring cards in: pick a file or paste, see what was found, choose the deck, add. Anki's "Notes in Plain Text"
 * export is read properly (src/lib/studyapp/ankiImport.ts); packages are not, and the sheet says so.
 */
export function ImportSheet({ deckId, onClose, onDone }: { deckId?: string; onClose: () => void; onDone: (deckId: string) => void }) {
  const { data } = useApp();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileProblem, setFileProblem] = useState("");
  const [mode, setMode] = useState<"new" | "existing">(deckId ? "existing" : "new");
  const [existing, setExisting] = useState(deckId ?? data.decks[0]?.id ?? "");
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [subjectInput, setSubjectInput] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const parse = useMemo(() => (text.trim() || fileName ? parseImport(text, fileName) : null), [text, fileName]);
  const suggested = parse?.deckName ?? (fileName ? deckNameFromFile(fileName) : null) ?? "Imported cards";
  const name = nameInput ?? suggested;
  const subject = subjectInput ?? subjectIn(name) ?? "";
  const ready = !!parse && parse.problem === null && parse.cards.length > 0;
  const target = mode === "existing" && data.decks.some((d) => d.id === existing) ? { deckId: existing } : { title: name, subject: subject || null };
  const canAdd = ready && ("deckId" in target || name.trim().length > 0);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFileProblem("");
    if (file.size > MAX_IMPORT_BYTES) { setFileName(""); setText(""); setFileProblem(importProblemText("too_big")); return; }
    setFileName(file.name);
    setNameInput(null);
    if (/\.(apkg|colpkg)$/i.test(file.name)) { setText(""); return; }
    try { setText(await file.text()); } catch { setText(""); setFileProblem("That file could not be read. Try exporting it again."); }
  };

  const add = () => {
    if (!parse || !canAdd) return;
    const r = actions.importInto(target, parse.cards);
    if (!r.deckId || r.added === 0) { toast("Nothing was added"); return; }
    toast(`${plural(r.added, "card")} added`);
    onDone(r.deckId);
  };

  return (
    <Sheet title="Bring your cards in" hint="From Anki, a spreadsheet, or a list you typed." onClose={onClose} wide>
      <div className="imp-how" data-testid="import-how">
        <p><b>From Anki:</b> File, then Export. Set the format to <b>Notes in Plain Text</b>, then pick that file here.</p>
        <p>Anki packages (<code>.apkg</code>) are not supported.</p>
      </div>

      <div className="imp-src">
        <input ref={picker} type="file" accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values" className="sr" tabIndex={-1} aria-label="Choose a file" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} data-testid="import-file" />
        <button type="button" className="btn" onClick={() => picker.current?.click()} data-autofocus>Choose a file</button>
        <span className="imp-file" data-testid="import-filename">{fileName || "or paste below"}</span>
      </div>
      {fileProblem && <p className="imp-problem" role="alert">{fileProblem}</p>}
      <label htmlFor="imp-paste" className="sr">Paste your cards</label>
      <textarea id="imp-paste" className="imp-paste" rows={5} value={text} onChange={(e) => { setText(e.target.value); setFileName(""); setFileProblem(""); }} placeholder={"What is the SI unit of force?\tThe newton (N)\nWhat is a catalyst?\tIt speeds up a reaction and is not used up."} data-testid="import-paste" />

      {parse && (
        <div className="imp-preview" aria-live="polite" data-testid="import-preview">
          {parse.problem ? (
            <p className="imp-problem">{importProblemText(parse.problem)}{parse.problem === "no_cards" && parse.skipped > 0 ? ` (${plural(parse.skipped, "line")} skipped.)` : ""}</p>
          ) : (
            <>
              <p className="imp-count"><b>{plural(parse.cards.length, "card")} found</b>{parse.skipped > 0 && `, ${parse.skipped} skipped`}</p>
              {parse.cut > 0 && <p className="imp-note">{parse.cut === 1 ? "1 card is" : `${parse.cut} cards are`} longer than a card holds and will be cut short.</p>}
              <ul className="imp-sample">
                {parse.cards.slice(0, 3).map(([f, b], i) => <li key={i}><span>{f}</span><span>{b}</span></li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {ready && (
        <fieldset className="imp-to">
          <legend>Add them to</legend>
          <div className="imp-modes">
            <label><input type="radio" name="imp-mode" checked={mode === "new"} onChange={() => setMode("new")} data-testid="import-new" /> A new deck</label>
            {data.decks.length > 0 && <label><input type="radio" name="imp-mode" checked={mode === "existing"} onChange={() => setMode("existing")} data-testid="import-existing" /> A deck I have</label>}
          </div>
          {mode === "new" || data.decks.length === 0 ? (
            <div className="imp-new">
              <input value={name} maxLength={50} onChange={(e) => setNameInput(e.target.value)} aria-label="Deck name" data-testid="import-deck-name" />
              <select value={subject} onChange={(e) => setSubjectInput(e.target.value)} aria-label="Subject" data-testid="import-subject">
                <option value="">No subject</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : (
            <select value={existing} onChange={(e) => setExisting(e.target.value)} aria-label="Deck" data-testid="import-deck-pick">
              {data.decks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          )}
        </fieldset>
      )}

      <div className="sheet-acts">
        <button type="button" className="btn gold" disabled={!canAdd} onClick={add} data-testid="import-go">{ready ? `Add ${plural(parse.cards.length, "card")}` : "Add cards"}</button>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
