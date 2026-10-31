"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { closeSignIn, openSignIn, sendCode, signInWithGoogle, signOut, useAccount, useSignInSheet, verifyCode, type SignInReason } from "@/lib/account";
import { startSync } from "@/lib/bankSync";
import { JoinLibrarySheet, LibraryMenuRow } from "@/components/account/JoinLibrary";

/**
 * The account, in the header of every page: "Sign in" or your initial, the sign-in
 * sheet any page can open (`openSignIn`), and the Grand Library's "Join the library"
 * (components/account/JoinLibrary). Rendered only in the browser; with accounts
 * switched off (no project configured) it renders nothing at all. It also starts the
 * marks sync (lib/bankSync), once, wherever the student is on the site.
 */

const TITLES: Record<SignInReason, string> = {
  header: "Sign in to Plumi",
  marks: "Keep your marks on every device",
  library: "Join the Grand Library",
};

export function AccountButton() {
  const account = useAccount();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (account.on) startSync(); }, [account.on]);
  // The menu closes on a click or tap anywhere else, as a dropdown would.
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  if (!account.on || !account.ready) return <><SignInSheet /><JoinLibrarySheet /></>;

  const initial = (account.name ?? account.email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="lp-acct" ref={ref}>
      {account.user ? (
        <>
          <button type="button" className="lp-acct-me" aria-expanded={menu} aria-label="Your account" onClick={() => setMenu(m => !m)}>{initial}</button>
          {menu && (
            <div className="lp-acct-menu" role="menu">
              <p className="lp-acct-who">{account.name ?? "Signed in"}<small>{account.email}</small></p>
              <p className="lp-acct-note">Your marks are saved to your account.</p>
              <LibraryMenuRow onAction={() => setMenu(false)} />
              <button type="button" role="menuitem" className="lp-acct-out" onClick={() => { setMenu(false); void signOut(); }}>Sign out</button>
            </div>
          )}
        </>
      ) : (
        <button type="button" className="lp-acct-in" onClick={() => openSignIn("header")}>Sign in</button>
      )}
      <SignInSheet />
      <JoinLibrarySheet />
    </div>
  );
}

/** A small "Sign in" link for a line of copy, shown only to a signed-out student when accounts are on. */
export function SignInLink({ reason, children }: { reason: SignInReason; children: React.ReactNode }) {
  const account = useAccount();
  if (!account.on || !account.ready || account.user) return null;
  return <button type="button" className="qb-link lp-acct-link" onClick={() => openSignIn(reason)}>{children}</button>;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * The sign-in sheet. One screen: confirm you're 13 or over, then Google or an email
 * code. The code step replaces the email step in place, and the sheet closes itself
 * once you're in. A native <dialog>, so focus, Escape and the backdrop behave.
 */
function SignInSheet() {
  const reason = useSignInSheet();
  const account = useAccount();
  const ref = useRef<HTMLDialogElement>(null);
  const [age, setAge] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"start" | "code">("start");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { age: useId(), email: useId(), code: useId() };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (reason && !d.open) d.showModal();
    if (!reason && d.open) d.close();
  }, [reason]);
  // Signed in: the sheet's job is done.
  useEffect(() => { if (account.user && reason) closeSignIn(); }, [account.user, reason]);

  function reset() { setStep("start"); setCode(""); setError(null); setBusy(false); }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || busy) return;
    setBusy(true); setError(null);
    const r = await sendCode(email.trim(), reason);
    setBusy(false);
    if (r.error) setError(r.error); else setStep("code");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || busy) return;
    setBusy(true); setError(null);
    const r = await verifyCode(email.trim(), code.replace(/\D/g, ""), reason);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  return (
    <dialog ref={ref} className="lp-signin" aria-labelledby="lp-signin-title" onClose={() => { closeSignIn(); reset(); }}
      onClick={e => { if (e.target === e.currentTarget) ref.current?.close(); }}>
      <div className="lp-signin-card">
        <button type="button" className="lp-signin-x" aria-label="Close" onClick={() => ref.current?.close()}>×</button>
        <Image className="lp-signin-quill" src="/landing/plumi-mood-happy.svg" alt="" width={64} height={64} unoptimized />
        <h2 id="lp-signin-title">{TITLES[reason ?? "header"]}</h2>
        <p className="lp-signin-lead">Free, and the same account works in Plumi on iPad. Everything you’ve marked in this browser comes with you.</p>

        {step === "start" ? (
          <>
            <label className="lp-signin-age" htmlFor={ids.age}>
              <input id={ids.age} type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} />
              I’m 13 or older
            </label>
            <button type="button" className="lp-signin-google" disabled={!age} onClick={() => reason && void signInWithGoogle(reason)}>
              <GoogleMark /> Continue with Google
            </button>
            <p className="lp-signin-or"><span>or</span></p>
            <form className="lp-signin-form" onSubmit={send}>
              <label htmlFor={ids.email}>Email</label>
              <input id={ids.email} type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <button type="submit" className="lp-btn lp-signin-go" disabled={!age || busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
            </form>
            {!age && <p className="lp-signin-hint">Tick the box above to continue.</p>}
          </>
        ) : (
          <form className="lp-signin-form" onSubmit={verify}>
            <div className="lp-signin-sent">
              <p><strong>Check your email.</strong> We sent a sign-in link to <strong>{email}</strong>.</p>
              <p>Open it on this device, in this browser, and you’ll come straight back here signed in.</p>
            </div>
            <label htmlFor={ids.code}>Got a 6-digit code instead? Type it here.</label>
            <input id={ids.code} className="lp-signin-code" type="text" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]*" maxLength={7}
              placeholder="123456" value={code} onChange={e => setCode(e.target.value)} autoFocus />
            <button type="submit" className="lp-btn lp-signin-go" disabled={busy || code.replace(/\D/g, "").length < 6}>{busy ? "Checking…" : "Sign in with the code"}</button>
            <p className="lp-signin-alt">
              <button type="button" className="qb-link" onClick={reset}>Use a different email</button>
              <button type="button" className="qb-link" disabled={busy} onClick={e => void send(e as unknown as React.FormEvent)}>Send it again</button>
            </p>
          </form>
        )}
        {error && <p className="lp-signin-error" role="alert">{error}</p>}
        <p className="lp-signin-legal">By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </dialog>
  );
}
