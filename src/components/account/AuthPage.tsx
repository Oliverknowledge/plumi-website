"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useState } from "react";
import { GoogleMark } from "@/components/account/Account";
import { safeNext, sendCode, sendReset, setPassword, signInHref, signInWithGoogle, signInWithPassword, signUpWithPassword, useAccount, verifyCode, type SignInReason } from "@/lib/account";
import { track } from "@/lib/analytics";

/**
 * /sign-in and /sign-up: the form on one side and the Grand Library on the other, students
 * writing at its tables (founder, 31 October 2026, after lofi.town's sign-in). Google, an
 * email and password, or a code by email; "Forgot password?" is a code and a new password.
 * The code matters most to students who made their account on iPad, which has no passwords.
 *
 * Everything is one page with a few views, so going from "Sign in" to "Sign in with a code"
 * keeps the email typed. Signed in already, it goes straight on to `next`; the one view
 * that wants a signed-in student is "set", the new password after a reset link.
 */

type View = "sign-in" | "code" | "code-sent" | "forgot" | "reset-sent" | "sign-up" | "confirm" | "set";

const HEADINGS: Record<View, string> = {
  "sign-in": "Sign in",
  code: "Sign in with a code",
  "code-sent": "Check your email",
  forgot: "Forgot your password?",
  "reset-sent": "Check your email",
  "sign-up": "Make your account",
  confirm: "Check your email",
  set: "Set a new password",
};
const LEADS: Partial<Record<SignInReason, string>> = {
  marks: "Keep your marks on every device.",
  library: "Take a seat in the Grand Library.",
};

/** The page: prerendered as it is, with the form (which reads the address) filled in in the browser. */
export function AuthPage({ start }: { start: "sign-in" | "sign-up" }) {
  return (
    <main className="lp au">
      <section className="au-form">
        <Link className="au-logo" href="/" aria-label="Plumi home">
          <Image src="/landing/plumi-mood-happy.svg" alt="" width={34} height={34} unoptimized priority />plumi
        </Link>
        <Suspense fallback={<div className="au-card" />}>
          <AuthForm start={start} />
        </Suspense>
      </section>
      <div className="au-art" aria-hidden="true">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcSet="/library/library-door-still.webp" />
          <img src="/library/library-door.webp" alt="" width={660} height={600} />
        </picture>
      </div>
    </main>
  );
}

function AuthForm({ start }: { start: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const account = useAccount();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const reason = (["marks", "library"].includes(params.get("why") ?? "") ? params.get("why") : "header") as SignInReason;
  const setting = params.get("set") === "1";

  const [view, setView] = useState<View>(start);
  const [email, setEmail] = useState("");
  const [password, setPw] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const ids = { email: useId(), password: useId(), code: useId() };

  useEffect(() => { track("signin_prompted", { reason, page: start }); }, [reason, start]);
  // Back from a reset link, signed in: straight to a new password.
  const shown: View = setting && account.user && view !== "set" && view !== "reset-sent" ? "set" : view;
  // Signed in (and not setting a password): on to wherever they were going.
  // Not while busy: a reset's code signs them in a moment before the new password is saved.
  useEffect(() => {
    if (account.ready && account.user && shown !== "set" && !busy) router.replace(next);
  }, [account.ready, account.user, shown, busy, next, router]);

  function go(v: View) { setView(v); setError(null); setNote(null); setCode(""); }
  async function run(task: () => Promise<{ error: string | null }>, then?: () => void) {
    if (busy) return;
    setBusy(true); setError(null);
    const r = await task();
    setBusy(false);
    if (r.error) setError(r.error); else then?.();
  }
  const digits = code.replace(/\D/g, "");
  const mail = email.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    switch (shown) {
      case "sign-in": return void run(() => signInWithPassword(mail, password, reason));
      case "code": return void run(() => sendCode(mail, reason, next), () => go("code-sent"));
      case "code-sent": case "confirm": return void run(() => verifyCode(mail, digits, reason));
      case "forgot": return void run(() => sendReset(mail), () => go("reset-sent"));
      case "reset-sent": return void run(async () => {
        const v = await verifyCode(mail, digits, reason, "recovery");
        return v.error ? v : setPassword(password);
      }, () => router.replace(next));
      case "sign-up": return void run(async () => {
        const r = await signUpWithPassword(mail, password, reason, next);
        if (!r.error && r.confirm) go("confirm");
        return r;
      });
      case "set": return void run(() => setPassword(password), () => router.replace(next));
    }
  }

  const emailField = (
    <label className="au-field" htmlFor={ids.email}>
      <span>Email</span>
      <input id={ids.email} type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com"
        value={email} onChange={e => setEmail(e.target.value)} />
    </label>
  );
  // `fresh`: a password being chosen (sign-up, or a new one after a reset), so the browser offers to make one.
  const passwordField = (fresh: boolean, label = fresh ? "New password" : "Password") => (
    <label className="au-field" htmlFor={ids.password}>
      <span>{label}</span>
      <input id={ids.password} type="password" required minLength={6} autoComplete={fresh ? "new-password" : "current-password"}
        placeholder={fresh ? "At least 6 characters" : "Your password"} value={password} onChange={e => setPw(e.target.value)} />
    </label>
  );
  const codeField = (
    <label className="au-field" htmlFor={ids.code}>
      <span>Code</span>
      {/* The project's code length is a dashboard setting (6 to 10 digits), so any of those is taken. */}
      <input id={ids.code} className="au-code" type="text" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]*" maxLength={12}
        placeholder="••••••" value={code} onChange={e => setCode(e.target.value)} autoFocus />
    </label>
  );
  const sentTo = <p className="au-sent">We sent a code to <strong>{mail}</strong>. It can take a minute, and it might be in spam.</p>;

  const google = (
    <>
      <button type="button" className="au-google" onClick={() => void signInWithGoogle(reason, next)}>
        <GoogleMark /> Continue with Google
      </button>
      <p className="au-or"><span>or</span></p>
    </>
  );

  let body: React.ReactNode;
  switch (shown) {
    case "sign-in":
      body = <>{google}{emailField}{passwordField(false)}
        <button type="submit" className="au-go" disabled={busy || !mail.includes("@") || !password}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="au-links">
          <button type="button" className="au-link" onClick={() => go("forgot")}>Forgot password?</button>
          <button type="button" className="au-link" onClick={() => go("code")}>Email me a code instead</button>
        </p></>;
      break;
    case "code":
      body = <>{google}{emailField}
        <button type="submit" className="au-go" disabled={busy || !mail.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
        <p className="au-links"><button type="button" className="au-link" onClick={() => go("sign-in")}>Use a password instead</button></p></>;
      break;
    case "code-sent": case "confirm":
      body = <>{sentTo}{codeField}
        <button type="submit" className="au-go" disabled={busy || digits.length < 6}>{busy ? "Checking…" : shown === "confirm" ? "Confirm my email" : "Sign in"}</button>
        <p className="au-links">
          <button type="button" className="au-link" disabled={busy}
            onClick={() => void run(() => sendCode(mail, reason, next), () => setNote("Sent. Use the newest code."))}>Send a new code</button>
          <button type="button" className="au-link" onClick={() => go(shown === "confirm" ? "sign-up" : "code")}>Use a different email</button>
        </p></>;
      break;
    case "forgot":
      body = <><p className="au-sent">Type your email and we’ll send you a code to set a new one.</p>{emailField}
        <button type="submit" className="au-go" disabled={busy || !mail.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
        <p className="au-links"><button type="button" className="au-link" onClick={() => go("sign-in")}>Back to sign in</button></p></>;
      break;
    case "reset-sent":
      body = <>{sentTo}{codeField}{passwordField(true)}
        <button type="submit" className="au-go" disabled={busy || digits.length < 6 || password.length < 6}>{busy ? "Saving…" : "Set password and sign in"}</button>
        <p className="au-links"><button type="button" className="au-link" onClick={() => go("forgot")}>Send a new code</button></p></>;
      break;
    case "sign-up":
      body = <>{google}{emailField}{passwordField(true, "Password")}
        <button type="submit" className="au-go" disabled={busy || !mail.includes("@") || password.length < 6}>{busy ? "Making it…" : "Make my account"}</button></>;
      break;
    case "set":
      body = <>{passwordField(true)}
        <button type="submit" className="au-go" disabled={busy || password.length < 6}>{busy ? "Saving…" : "Save password"}</button></>;
      break;
  }

  const signUpPage = shown === "sign-up" || shown === "confirm";
  return (
    <form className="au-card" onSubmit={submit}>
      <h1>{HEADINGS[shown]}</h1>
      <p className="au-lead">{LEADS[reason] ?? "Free, and the same account as Plumi on iPad."}</p>
      {body}
      {error && <p className="au-error" role="alert">{error}</p>}
      {note && !error && <p className="au-note" role="status">{note}</p>}
      <hr />
      <p className="au-switch">
        {signUpPage
          ? <>Already have an account? <Link href={signInHref(reason, next)}>Sign in</Link></>
          : <>Don’t have an account? <Link href={signInHref(reason, next, "sign-up")}>Sign up</Link></>}
      </p>
      <p className="au-legal">By continuing you confirm you’re 13 or over and agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </form>
  );
}
