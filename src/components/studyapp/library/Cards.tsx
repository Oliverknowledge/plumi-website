"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { signInHref } from "@/lib/account";
import { COLOUR_NAMES, LIBRARY_COLOURS, colourOf, generatedName, joinLibrary, nameProblem, suggestedName } from "@/lib/library";

/**
 * The library before you are in it: for someone signed out (what it is, and a way in), and for a signed-in student
 * who has not joined (a name and a colour: the iPad's card at the library's door). Nothing is shared with anyone
 * until a student joins, and a student can leave again from the page.
 */

function Door() {
  return <Image className="lb-door" src="/library/library-door-still.webp" alt="" width={640} height={360} unoptimized priority />;
}

export function SignedOutCard({ accountsOn }: { accountsOn: boolean }) {
  return (
    <main className="wrap lb lb-solo" data-testid="library-signed-out">
      <header className="ph"><div><div className="crumb">Study</div><h1>The Grand Library</h1></div></header>
      <section className="card lb-gate">
        <Door />
        <div className="lb-gate-body">
          <h2>Study with real students</h2>
          <p>Walk in, take a seat and start a timer. Friends and strangers on iPad and the web are in the same room.</p>
          {accountsOn
            ? <Link className="btn gold" href={signInHref("library", "/study/library")}>Sign in</Link>
            : <p className="lb-hint">Opens when accounts are switched on.</p>}
          <p className="lb-hint">Nothing is shared until you join.</p>
        </div>
      </section>
    </main>
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
    <main className="wrap lb lb-solo" data-testid="library-join">
      <header className="ph"><div><div className="crumb">Study</div><h1>The Grand Library</h1></div></header>
      <form className="card lb-gate" onSubmit={submit}>
        <Door />
        <div className="lb-gate-body">
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
          <button type="submit" className="btn gold" disabled={busy || !!problem || !name.trim()}>{busy ? "Joining…" : fallback ? `Join as ${name.trim()}` : "Join"}</button>
          <p className="lb-hint">You can leave any time from this page.</p>
        </div>
      </form>
    </main>
  );
}

/** While the account is still being read: the page's frame, nothing claimed. */
export function Waiting() {
  return (
    <main className="wrap lb lb-solo" aria-busy="true">
      <header className="ph"><div><div className="crumb">Study</div><h1>The Grand Library</h1></div></header>
      <section className="card lb-gate lb-wait" aria-hidden="true"><Door /></section>
    </main>
  );
}
