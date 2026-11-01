"use client";

import { useId, useState } from "react";
import { signInHref, signOut } from "@/lib/account";
import { COLOUR_NAMES, LIBRARY_COLOURS, colourOf, generatedName, joinLibrary, nameProblem, suggestedName } from "@/lib/library";
import { FrontScene, Key, KeyLink, Plaque, Wordmark } from "./Front";

/**
 * The library before you are in it, in the same scene as the Enter screen (Front.tsx): for someone signed out (what it
 * is, and a way in), and for a signed-in student who has not joined (a name and a colour: the iPad's card at the
 * library's door). Nothing is shared with anyone until a student joins, and a student can leave again from the page.
 */

export function SignedOutCard({ accountsOn }: { accountsOn: boolean }) {
  return (
    <FrontScene testid="library-signed-out">
      <div className="en-col">
        <Wordmark small />
        <Plaque>
          <h2>Study with real students</h2>
          <p>Take a seat and start a timer, in a room shared with iPad students.</p>
          {accountsOn
            ? <KeyLink label="Sign in" href={signInHref("library", "/study/library")} small testid="front-signin" />
            : <p className="lb-hint">Opens when accounts are switched on.</p>}
          <p className="lb-hint">Nothing is shared until you join.</p>
        </Plaque>
      </div>
    </FrontScene>
  );
}

export function JoinCard({ accountName }: { accountName: string | null }) {
  const ids = { name: useId(), err: useId() };
  const [name, setName] = useState(() => suggestedName(accountName));
  const [colour, setColour] = useState(() => Math.floor(Math.random() * 8));
  const [tries, setTries] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = name ? nameProblem(name) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const r = await joinLibrary(name, colour);
    setBusy(false);
    if (r.ok) return;                       // the page now shows the room
    setError(r.message);
    if (r.refused) {
      const n = tries + 1;
      setTries(n);
      // Three refused names and the field becomes a made-up one that always passes: nobody is stuck at the door.
      if (n >= 3 && !fallback) { setFallback(true); setName(generatedName(name)); setError("You can change it later"); }
    }
  }

  return (
    <FrontScene testid="library-join" onLogOut={() => void signOut()}>
      <div className="en-col">
        <Wordmark small />
        <Plaque as="form" onSubmit={submit}>
          <h2>Join the library</h2>
          <p>Friends see your name, everyone else a nickname.</p>
          <label htmlFor={ids.name} className="lbl">Your name</label>
          <div className="lb-name">
            <span className="lb-badge" style={{ background: colourOf(colour) }} aria-hidden="true">{(name.trim()[0] ?? "?").toUpperCase()}</span>
            <input id={ids.name} type="text" autoComplete="given-name" maxLength={24} value={name} placeholder="Your name"
              aria-invalid={!!problem || undefined} aria-describedby={ids.err} onChange={(e) => { setName(e.target.value); setError(null); }} />
            <button type="button" className="btn ghost" onClick={() => { setName(generatedName(name)); setError(null); }}>Make one up</button>
          </div>
          <p id={ids.err} className="lb-rule bad" role={error ? "alert" : undefined}>{error ?? problem ?? " "}</p>
          <fieldset className="lb-colours">
            <legend className="lbl">Your colour</legend>
            <div>
              {LIBRARY_COLOURS.map((c, i) => (
                <label key={c} className="lb-swatch" style={{ background: c }}>
                  <input type="radio" name="lb-colour" checked={colour === i} onChange={() => setColour(i)} aria-label={COLOUR_NAMES[i]} />
                </label>
              ))}
            </div>
          </fieldset>
          <Key type="submit" small label={busy ? "Joining…" : fallback ? `Join as ${name.trim()}` : "Join"} disabled={busy || !!problem || !name.trim()} testid="join-library" />
          <p className="lb-hint">You can leave any time from this page.</p>
        </Plaque>
      </div>
    </FrontScene>
  );
}

/** While the account is still being read: the same scene and lettering, nothing claimed, and the key's place held so nothing moves. */
export function Waiting() {
  return (
    <FrontScene busy>
      <div className="en-col">
        <Wordmark />
        <div className="en-cta" aria-hidden="true"><span className="en-key is-ghost"><span className="en-key-cap" /></span></div>
      </div>
    </FrontScene>
  );
}
