"use client";

import { useState } from "react";
import { signInHref, signOut } from "@/lib/account";
import { generatedName, joinLibrary, suggestedName } from "@/lib/library";
import { entryMemory } from "@/lib/studyapp/library/entry";
import { playEnter } from "@/lib/studyapp/library/entrySound";
import { enterBrowserFullscreen } from "@/lib/studyapp/library/fullscreen";
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

/**
 * A signed-in student who has not joined yet: the same scene as the door, with one key. Pressing it puts them in the
 * library (the name is their first name when it passes the rule, else a made-up one; the colour is picked for them;
 * both can be changed later from the library) and straight on into the room, with no second key to press. The press
 * is still the student's own act: nobody is put in a shared room by loading a page.
 */
export function JoinCard({ accountName }: { accountName: string | null }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function enter() {
    if (busy) return;
    setBusy(true); setFailed(false);
    enterBrowserFullscreen();
    playEnter();
    const colour = Math.floor(Math.random() * 8);
    let name = suggestedName(accountName);
    let r = await joinLibrary(name, colour);
    // A refused name (the server has a blocklist the page cannot see) is swapped for a made-up one that always passes.
    for (let tries = 0; !r.ok && r.refused && tries < 3; tries++) { name = generatedName(name); r = await joinLibrary(name, colour); }
    if (r.ok) {
      entryMemory.entered(); entryMemory.left();   // the door has just been pressed: the room opens without a second key
      return;                                       // the page now shows the room
    }
    setBusy(false); setFailed(true);
  }

  return (
    <FrontScene testid="library-join" onLogOut={() => void signOut()} busy={busy}>
      <div className="en-col">
        <Wordmark />
        <div className="en-cta">
          <Key label="Enter" glyph pressed={busy} onClick={() => void enter()} disabled={busy} aria-label="Enter the Grand Library" testid="join-library" />
          {failed && <p className="lb-hint" role="alert">That did not go through. Press Enter to try again.</p>}
        </div>
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
