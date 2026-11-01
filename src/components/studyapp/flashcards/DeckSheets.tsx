"use client";

import { useState } from "react";
import { SUBJECTS, subjectIn } from "@/lib/studyapp/model";
import { actions, useApp } from "@/lib/studyapp/store";
import { toast } from "../toast";
import { CardFields } from "./CardFields";
import { Sheet } from "./Sheet";
import { StarterPicker } from "./StarterPicker";

/** "+ New deck": a name and a subject. */
export function NewDeckSheet({ onClose, onMade }: { onClose: () => void; onMade: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const make = () => {
    const id = actions.addDeck(title, subject || subjectIn(title));
    if (id) onMade(id);
  };
  return (
    <Sheet title="New deck" onClose={onClose}>
      <form className="sheet-form" onSubmit={(e) => { e.preventDefault(); make(); }}>
        <label htmlFor="nd-name" className="lbl">Name</label>
        <input id="nd-name" value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chemistry, Rates" data-autofocus data-testid="new-deck-name" />
        <label htmlFor="nd-subject" className="lbl">Subject</label>
        <select id="nd-subject" value={subject} onChange={(e) => setSubject(e.target.value)} data-testid="new-deck-subject">
          <option value="">{subjectIn(title) ? `${subjectIn(title)} (from the name)` : "No subject"}</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="sheet-acts">
          <button type="submit" className="btn gold" disabled={!title.trim()} data-testid="new-deck-go">Make deck</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Sheet>
  );
}

/** The ready-made decks, in a sheet. */
export function StartersSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Ready-made decks" hint="Ten cards each. Yours to edit once added." onClose={onClose} wide>
      <StarterPicker compact />
    </Sheet>
  );
}

/** "+ Card" on the desk: the deck it is for (asked only when there is a choice), the two boxes, the symbol bar. */
export function AddCardSheet({ deckIds, current, onClose, onNeedDeck }: { deckIds: string[]; current: string | null; onClose: () => void; onNeedDeck: () => void }) {
  const { data } = useApp();
  const options = data.decks.filter((d) => deckIds.includes(d.id));
  const [picked, setPicked] = useState(current && options.some((d) => d.id === current) ? current : options[0]?.id ?? "");
  const deck = options.find((d) => d.id === picked);
  if (options.length === 0) {
    return (
      <Sheet title="Add a card" onClose={onClose}>
        <p className="sheet-line">A card needs a deck to live in.</p>
        <div className="sheet-acts"><button type="button" className="btn gold" onClick={onNeedDeck} data-autofocus>Make a deck</button></div>
      </Sheet>
    );
  }
  return (
    <Sheet title="Add a card" onClose={onClose} wide>
      {options.length > 1 ? (
        <div className="sheet-form">
          <label htmlFor="ac-deck" className="lbl">Which deck?</label>
          <select id="ac-deck" value={picked} onChange={(e) => setPicked(e.target.value)} data-testid="add-card-deck">
            {options.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
      ) : <p className="sheet-line">Into <b>{deck?.title}</b></p>}
      <CardFields key={picked} idPrefix="add" submitLabel="Add card" resetOnSubmit onSubmit={(f, b) => { actions.addCard(picked, f, b); toast("Card added"); }} />
      <div className="sheet-acts"><button type="button" className="btn ghost" onClick={onClose} data-testid="add-card-done">Done</button></div>
    </Sheet>
  );
}
