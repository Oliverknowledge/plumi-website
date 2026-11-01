"use client";

import { useState } from "react";
import { toast } from "../toast";
import { STARTER_DECKS } from "@/lib/studyapp/starterDecks";
import { actions, useApp } from "@/lib/studyapp/store";

/** The ready-made decks, added only when a student chooses them. Ten cards each; every card can be edited once it is theirs. */
export function StarterPicker({ compact = false }: { compact?: boolean }) {
  const { data } = useApp();
  const [picked, setPicked] = useState<string[]>([]);
  const has = (id: string) => data.decks.some((d) => d.starter === id);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const add = () => {
    actions.addStarters(picked);
    toast(picked.length === 1 ? "Deck added" : `${picked.length} decks added`);
    setPicked([]);
  };
  return (
    <div className={`starters${compact ? " compact" : ""}`} data-testid="starter-picker">
      <ul>
        {STARTER_DECKS.map((s) => (
          <li key={s.id}>
            <label className={has(s.id) ? "added" : undefined}>
              <input type="checkbox" className="cbx" disabled={has(s.id)} checked={has(s.id) || picked.includes(s.id)} onChange={() => toggle(s.id)} data-testid={`starter-${s.id}`} />
              <span className="stk" style={{ background: `var(--t-${s.subject === "Chemistry" ? "chem" : s.subject === "Biology" ? "bio" : s.subject === "Maths" ? "maths" : "fm"})` }}>{s.subject}</span>
              <span className="name"><b>{s.title}</b><small>{has(s.id) ? "Added" : `${s.cards.length} cards · ${s.level}`}</small></span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn gold" disabled={picked.length === 0} onClick={add} data-testid="starter-add">
        {picked.length === 0 ? "Choose a deck" : picked.length === 1 ? "Add 1 deck" : `Add ${picked.length} decks`}
      </button>
      <p className="starter-note">Written by Plumi to match any exam board. Check a card against your own spec and edit it if it differs.</p>
    </div>
  );
}
