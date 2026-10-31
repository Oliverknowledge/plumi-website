"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { openSignIn, useAccount } from "@/lib/account";
import { track } from "@/lib/analytics";
import { COLOUR_NAMES, LIBRARY_COLOURS, colourOf, generatedName, joinLibrary, leaveLibrary, nameProblem, suggestedName, useLibrary } from "@/lib/library";

/**
 * "Join the library" on the website: a name, a colour and Join, as the iPad's card at the
 * library's door (LibraryJoinCard.swift). Any page can open it (`openJoinLibrary`); a
 * signed-out student is asked to sign in first and comes back to it. Three refused names
 * and the field becomes a made-up name that always passes, so nobody is stuck at the door
 * (the app's rule, founder 29 October).
 */

let open = false;
let pending = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const useOpen = () => useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => open, () => false);

/** Open the card; signed out, sign in first and it opens after. */
export function openJoinLibrary(signedIn: boolean) {
  if (!signedIn) { pending = true; openSignIn("library"); return; }
  open = true; emit();
}
const closeJoin = () => { open = false; emit(); };

/** The account menu's line: join, or who you are in the library with Change and Leave. */
export function LibraryMenuRow({ onAction }: { onAction: () => void }) {
  const lib = useLibrary();
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!lib.checked) return null;
  if (!lib.profile) {
    return (
      <div className="lp-acct-lib">
        <p><b>Grand Library</b> Study alongside students on iPad and the web.</p>
        <button type="button" className="lp-acct-libgo" onClick={() => { onAction(); openJoinLibrary(true); }}>Join the library</button>
      </div>
    );
  }
  return (
    <div className="lp-acct-lib">
      <p className="lp-acct-libme">
        <span className="lp-acct-dot" style={{ background: colourOf(lib.profile.colour) }} aria-hidden="true" />
        <span>In the library as <b>{lib.profile.name}</b></span>
      </p>
      {leaving ? (
        <div className="lp-acct-leave">
          <p>Leaving also removes you from your Plumi friends and groups, on iPad too.</p>
          <span>
            <button type="button" className="qb-link" disabled={busy} onClick={async () => { setBusy(true); await leaveLibrary(); setBusy(false); setLeaving(false); }}>Leave the library</button>
            <button type="button" className="qb-link" onClick={() => setLeaving(false)}>Stay</button>
          </span>
        </div>
      ) : (
        <span className="lp-acct-libbtns">
          <button type="button" className="qb-link" onClick={() => { onAction(); openJoinLibrary(true); }}>Change name or colour</button>
          <button type="button" className="qb-link" onClick={() => setLeaving(true)}>Leave</button>
        </span>
      )}
    </div>
  );
}

/** The card itself, a native <dialog> like the sign-in sheet. */
export function JoinLibrarySheet() {
  const isOpen = useOpen();
  const account = useAccount();
  const lib = useLibrary();
  const ref = useRef<HTMLDialogElement>(null);
  const ids = { name: useId(), err: useId() };
  const [name, setName] = useState("");
  const [colour, setColour] = useState(0);
  const [tries, setTries] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in after "Join the library" sent them to sign in: carry on to the card.
  useEffect(() => { if (account.user && pending) { pending = false; open = true; emit(); } }, [account.user]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) {
      // Each opening starts from what they have, or a suggestion.
      setName(lib.profile?.name ?? suggestedName(account.name));
      setColour(lib.profile?.colour ?? Math.floor(Math.random() * 8));
      setTries(0); setFallback(false); setError(null); setBusy(false);
      d.showModal();
      if (!lib.profile) track("library_join_shown", {});
    }
    if (!isOpen && d.open) d.close();
  }, [isOpen, lib.profile, account.name]);

  const changing = !!lib.profile;
  const problem = name ? nameProblem(name) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    const r = await joinLibrary(name, colour);
    setBusy(false);
    if (r.ok) { closeJoin(); return; }
    setError(r.message);
    if (r.refused) {
      const n = tries + 1;
      setTries(n);
      if (n >= 3 && !fallback) { setFallback(true); setName(generatedName(name)); setError("You can change it later"); }
    }
  }

  return (
    <dialog ref={ref} className="lp-signin lp-join" aria-labelledby="lp-join-title" onClose={closeJoin}
      onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <form className="lp-signin-card" onSubmit={submit}>
        <button type="button" className="lp-signin-x" aria-label="Close" onClick={() => ref.current?.close()}>×</button>
        <span className="lp-join-badge" style={{ background: colourOf(colour) }} aria-hidden="true">{(name.trim()[0] ?? "?").toUpperCase()}</span>
        <h2 id="lp-join-title">{changing ? "Your name in the library" : "Join the library"}</h2>
        <p className="lp-signin-lead">Friends see your name, others a nickname. You can leave any time from your account.</p>

        <div className="lp-signin-form">
          <label htmlFor={ids.name}>Your name</label>
          <div className="lp-join-name">
            <input id={ids.name} type="text" autoComplete="given-name" maxLength={24} value={name} placeholder="Your name"
              aria-invalid={!!problem || undefined} aria-describedby={ids.err}
              onChange={e => { setName(e.target.value); setError(null); }} />
            <button type="button" className="lp-join-shuffle" onClick={() => { setName(generatedName(name)); setError(null); }}>Make one up</button>
          </div>
          <p id={ids.err} className="lp-join-why" role={error ? "alert" : undefined}>{error ?? problem ?? " "}</p>
        </div>

        <fieldset className="lp-join-colours">
          <legend>Your colour</legend>
          <div>
            {LIBRARY_COLOURS.map((c, i) => (
              <label key={c} className="lp-join-swatch" style={{ background: c }}>
                <input type="radio" name="lp-join-colour" checked={colour === i} onChange={() => setColour(i)} aria-label={COLOUR_NAMES[i]} />
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="lp-btn lp-signin-go" disabled={busy || !!problem || !name.trim()}>
          {busy ? "Joining…" : changing ? "Save" : fallback ? `Join as ${name.trim()}` : "Join"}
        </button>
        {!changing && <p className="lp-signin-legal">The Grand Library is open in Plumi on iPad now, and comes to the website next.</p>}
      </form>
    </dialog>
  );
}
