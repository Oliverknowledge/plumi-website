"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { deleteOwnAccountCall, signInHref, signOut, signOutLocal, useAccount } from "@/lib/account";
import { CONFIRM_WORD, clearPlumiKeys, confirmOk, deleteAccount } from "@/lib/studyapp/accountDelete";
import { readDark, subscribeAppearance, writeDark } from "@/components/study/appearance";
import { ProPlanSection } from "@/components/pro/ProPlan";

/** Everything Plumi saved on this device, except its look and the ad choice (accountDelete.ts): its keys, and the databases of handwriting and answers. */
async function clearThisDevice() {
  try { clearPlumiKeys(localStorage); } catch { /* storage blocked */ }
  try { clearPlumiKeys(sessionStorage); } catch { /* as above */ }
  try {
    const dbs = (await indexedDB.databases?.()) ?? [];
    const names = new Set(dbs.map((d) => d.name ?? "").filter((n) => n.startsWith("plumi")));
    names.add("plumi-study-ink");
    // (a database that is still open waits for the page to go: the page is about to leave, so do not wait for it)
    await Promise.race([
      Promise.all([...names].map((n) => new Promise<void>((done) => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => done(); }))),
      new Promise<void>((done) => setTimeout(done, 1500)),
    ]);
  } catch { /* nothing more to clear */ }
}

const Sun = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></svg>;
const Moon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z" /></svg>;
const Cross = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
const Tick = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>;

/** A small drawn page for each look: always drawn as it will be (the dark page is dark even when the screen is not). */
function Page({ dark }: { dark: boolean }) {
  return (
    <span className={`stg-page${dark ? " is-dark" : ""}`} aria-hidden="true">
      <i /><i /><i /><b />
    </span>
  );
}

/**
 * Settings, a sheet over whatever the student is doing: the look (light or dark), their Plumi Pro plan, and, if they have an account, who it is, signing out and deleting it. Opened from the account
 * menu; Escape closes it (a delete in progress holds it open); focus goes back to the account button.
 */
export function Settings({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { user, email, name } = useAccount();
  const path = usePathname() ?? "/";
  const dark = useSyncExternalStore(subscribeAppearance, readDark, () => false);
  const [step, setStep] = useState<"main" | "delete">("main");
  const [typed, setTyped] = useState("");
  const [clear, setClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = useRef<HTMLInputElement>(null);
  const title = useId();

  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const close = () => { const d = ref.current; if (d?.open) d.close(); else onClose(); };
  useEffect(() => { if (step === "delete") word.current?.focus(); }, [step]);

  const remove = async () => {
    if (busy || !confirmOk(typed)) return;
    setBusy(true); setError(null);
    const r = await deleteAccount({ rpc: deleteOwnAccountCall, signOutLocal, clearDevice: clearThisDevice }, { typed, clearDevice: clear });
    if (!r.ok) { setBusy(false); setError(r.message); return; }
    // a full load of the sign-in page on purpose (not a client navigation): nothing of the account is left in memory, open handwriting databases close so clearing them can finish, and the page says so
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${signInHref("header", "/")}&deleted=1`;
  };

  const who = name ?? email;
  return (
    <dialog
      ref={ref} className="stg" aria-labelledby={title} data-testid="settings"
      onClose={onClose}
      onCancel={(e) => { if (busy) e.preventDefault(); else if (step === "delete") { e.preventDefault(); setStep("main"); setTyped(""); setError(null); } }}
      onClick={(e) => { if (e.target === ref.current && !busy) close(); }}
    >
      {step === "main" ? (
        <div className="stg-body">
          <div className="stg-head">
            <h2 id={title}>Settings</h2>
            <button type="button" className="btn ghost icon" aria-label="Close settings" onClick={close} data-testid="settings-close"><Cross /></button>
          </div>

          <section className="stg-sec" aria-labelledby={`${title}-look`}>
            <h3 id={`${title}-look`}>Look</h3>
            <div className="stg-looks" role="radiogroup" aria-label="Look">
              <button type="button" role="radio" aria-checked={!dark} className={`stg-look${!dark ? " on" : ""}`} onClick={() => writeDark(false)} data-testid="settings-light">
                <Page dark={false} /><span className="stg-lab"><Sun />Light</span>
              </button>
              <button type="button" role="radio" aria-checked={dark} className={`stg-look${dark ? " on" : ""}`} onClick={() => writeDark(true)} data-testid="settings-dark">
                <Page dark /><span className="stg-lab"><Moon />Dark</span>
              </button>
            </div>
          </section>

          <ProPlanSection path={path} />

          {!user && (
            <section className="stg-sec" aria-labelledby={`${title}-acct`}>
              <h3 id={`${title}-acct`}>Account</h3>
              <p className="stg-who">Your tasks and cards are saved on this device.</p>
              <div className="stg-row">
                <a className="btn" href={signInHref("library", path)} data-testid="settings-signin">Sign in</a>
                <a className="btn" href={signInHref("library", path, "sign-up")} data-testid="settings-signup">Make an account</a>
              </div>
            </section>
          )}

          {user && (
            <section className="stg-sec" aria-labelledby={`${title}-acct`}>
              <h3 id={`${title}-acct`}>Account</h3>
              <p className="stg-who" data-testid="settings-who">{who}</p>
              <div className="stg-row">
                <button type="button" className="btn" onClick={() => { close(); void signOut(); }} data-testid="settings-signout">Sign out</button>
                <button type="button" className="btn stg-danger-link" onClick={() => setStep("delete")} data-testid="settings-delete">Delete account</button>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="stg-body" aria-busy={busy || undefined}>
          <div className="stg-head">
            <h2 id={title}>Delete your account?</h2>
          </div>
          <p className="stg-line">This cannot be undone.</p>
          <div className="stg-cols">
            <div className="stg-col is-goes">
              <h3>Deleted</h3>
              <ul>
                <li><Cross />Your account and sign-in</li>
                <li><Cross />Your profile, friends and Grand Library data</li>
                <li><Cross />Your marked-question progress saved online</li>
                <li><Cross />The links to decks you shared</li>
              </ul>
            </div>
            <div className="stg-col is-stays">
              <h3>Stays</h3>
              <ul>
                <li><Tick />Work saved only on this device, unless you clear it below</li>
                <li><Tick />Copies of your decks that friends already added</li>
              </ul>
            </div>
          </div>
          <label className="stg-field">
            <span>Type {CONFIRM_WORD} to confirm</span>
            <input ref={word} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} autoComplete="off" autoCapitalize="characters" spellCheck={false} data-testid="settings-confirm-word" />
          </label>
          <label className="stg-check">
            <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} disabled={busy} data-testid="settings-clear-device" />
            <span>Also clear Plumi on this device</span>
          </label>
          {error && <p className="stg-error" role="alert" data-testid="settings-error">{error}</p>}
          <div className="stg-row stg-foot">
            <button type="button" className="btn" onClick={() => { setStep("main"); setTyped(""); setError(null); }} disabled={busy} data-testid="settings-keep">Keep my account</button>
            <button type="button" className="btn stg-delete" onClick={() => void remove()} disabled={!confirmOk(typed) || busy} data-testid="settings-delete-go">{busy ? "Deleting…" : "Delete my account"}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
