"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { displayName } from "@/lib/accountName";
import { track } from "@/lib/analytics";
import { isDeadSession, isOfflineError } from "@/lib/authErrors";
import { isSitePath } from "@/lib/safePath";
import { browserSessionStorage } from "@/lib/sessionStorage";
import { isStudyHostname } from "@/lib/studyapp/routing";
import { timedFetch } from "@/lib/social/serverTime";
import { rememberToken } from "@/lib/studyapp/library/farewell";

/**
 * Plumi accounts on the website: the same Supabase project, and so the same accounts,
 * as the iPad app. A student who signs in with the same Google account or email on both
 * is one person: their marks, their place in the Grand Library and (later) friends follow them.
 *
 * The session is kept in a cookie shared by tryplumi.app and study.tryplumi.app (lib/sessionStorage), so
 * signing in on one is signing in on both. Everything here runs in the browser, so every page stays static:
 * no cookies are read on the server and nothing in the shared layout changes. With no project configured
 * (NEXT_PUBLIC_PLUMI_SUPABASE_URL and _KEY), accounts are simply off and the site works
 * as before, saving to this browser only.
 *
 * The names are Plumi's own, not NEXT_PUBLIC_SUPABASE_URL, because the waitlist
 * (lib/waitlist) falls back to that one and may live in a different project.
 *
 * Sign-in is an email code, Google or (once switched on, lib/appleSignIn) Apple. The emails ("Confirm sign up" for a new address,
 * "Magic link or OTP" otherwise) carry the code and a link; the code works anywhere,
 * while the link brings the student back to /auth/callback, signed in, only in the
 * browser they asked from (PKCE). Supabase's default templates carry only the link, and
 * they can be edited only once the project sends through its own email sender (custom
 * SMTP): supabase/email-templates/ has ours. Apple on the web needs its own Services
 * ID (docs/study/sign-in-with-apple.md). The key here is the publishable one, which the app ships too: what it can
 * touch is decided by row-level security, not by keeping it secret.
 */

const URL = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_KEY;
export const accountsOn = !!URL && !!KEY;

let client: SupabaseClient | null = null;
/** The one client, made on first use in the browser. Null when accounts are off. */
export function supabase(): SupabaseClient | null {
  if (!accountsOn || typeof window === "undefined") return null;
  client ??= createClient(URL!, KEY!, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "plumi-auth", storage: browserSessionStorage() },
    // a timeout on every call to the data API, and the server's clock from each answer (see serverTime.ts)
    global: { fetch: timedFetch() },
  });
  return client;
}

/* The session, as a store: every component that asks is told when it changes. */
type State = { ready: boolean; session: Session | null };
let state: State = { ready: false, session: null };
const listeners = new Set<() => void>();
let started = false;
function start() {
  if (started) return;
  started = true;
  const sb = supabase();
  if (!sb) { state = { ready: true, session: null }; return; }
  // No valid session and an error that says it is gone for good (a refresh token the server has ended): forget it here, so the app shows signed out, not signed in with a dead session. Never for a network error.
  sb.auth.getSession().then(({ data, error }) => {
    if (error && isDeadSession(error)) void signOutLocal();
    set(data.session);
  }, () => set(null));
  sb.auth.onAuthStateChange((_event, session) => set(session));
}
function set(session: Session | null) {
  if (session) rememberToken(session.user.id, session.access_token);   // so a visit can still leave as THIS student after another account signs in (library/farewell.ts)
  if (state.ready && state.session?.access_token === session?.access_token) return;
  state = { ready: true, session };
  listeners.forEach(l => l());
}
function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const SERVER: State = { ready: false, session: null };

/** Who's signed in, if anyone. `ready` is false until the browser has checked. */
export function useAccount() {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  const user = s.session?.user ?? null;
  const name = displayName(user?.user_metadata);
  return { ready: s.ready, user, email: user?.email ?? null, name, on: accountsOn, token: s.session?.access_token ?? null };
}

/** Subscribe outside React (the sync engine): called with the user id, or null, whenever it changes. */
export function onUser(cb: (userId: string | null) => void) {
  let last: string | null | undefined;
  const run = () => {
    if (!state.ready) return;
    const id = state.session?.user.id ?? null;
    if (id !== last) { last = id; cb(id); }
  };
  const off = subscribe(run);
  run();
  return off;
}

/* ── Signing in ──────────────────────────────────────────────────────────── */

/**
 * Signing in happens on its own page, /sign-in (and /sign-up), the library on one side and
 * the form on the other (founder, 31 October 2026, after lofi.town's). Ways in: Google, an
 * email and password, or a code sent by email. The code is there for every student who
 * made their account on iPad, which has no passwords (Apple, Google or an email code).
 */
export type SignInReason = "header" | "marks" | "library";

/** Only somewhere on this site: "/question-bank/x?y", never "//elsewhere", "/\\elsewhere", "https://…" or a path with control characters (lib/safePath). */
export const safeNext = (next: string | null | undefined) => (isSitePath(next) ? next : defaultNext());
/** Where a sign-in goes with nowhere in mind: the Desk on the app's host, the question bank on the main site. */
const defaultNext = () => (typeof window !== "undefined" && isStudyHostname(window.location.hostname) ? "/" : "/question-bank");

/** The sign-in page, coming back to `next` (this page, by default). */
export function signInHref(reason: SignInReason, next?: string, page: "sign-in" | "sign-up" = "sign-in") {
  const back = next ?? (typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`);
  return `/${page}?next=${encodeURIComponent(back)}${reason === "header" ? "" : `&why=${reason}`}`;
}

/** Where an email link, Google or Apple sends the student back to: /auth/callback, then `next`. */
function callbackUrl(reason: SignInReason, method: "email" | "google" | "apple", next: string) {
  try { sessionStorage.setItem("plumi.signin.reason", `${method}:${reason}`); } catch { /* fine without */ }
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

const META = { age_band: "13_plus", signed_up_on: "web" };
const off = { error: "Sign-in isn’t switched on here yet." };
const done = (method: string, reason: SignInReason) => { track("signin_completed", { method, reason }); return { error: null }; };
const codeTrouble = (message: string) => /rate|seconds/i.test(message) ? "Emails are limited to one a minute. Try again shortly." : "That didn’t send. Check the address and try again.";
const codeWrong = (message: string) => /expired/i.test(message) ? "That code has expired. Send a new one." : "That code doesn’t match. Check it and try again.";

/** Email a code (and a link). New addresses become accounts, marked as made on the website by someone 13 or over. */
export async function sendCode(email: string, reason: SignInReason, next: string) {
  const sb = supabase();
  if (!sb) return off;
  track("signin_started", { method: "email", reason });
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: callbackUrl(reason, "email", next), data: META } });
  return { error: error ? codeTrouble(error.message) : null };
}

/** The emailed code, for signing in, finishing signing up, or (`recovery`) setting a new password. */
export async function verifyCode(email: string, token: string, reason: SignInReason, type: "email" | "recovery" = "email") {
  const sb = supabase();
  if (!sb) return off;
  let { error } = await sb.auth.verifyOtp({ email, token, type });
  // A password sign-up's confirmation is a "signup" code to older servers.
  if (error && type === "email") ({ error } = await sb.auth.verifyOtp({ email, token, type: "signup" }));
  if (error) return { error: codeWrong(error.message) };
  return type === "email" ? done("email", reason) : { error: null };
}

export async function signInWithPassword(email: string, password: string, reason: SignInReason) {
  const sb = supabase();
  if (!sb) return off;
  track("signin_started", { method: "password", reason });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) return done("password", reason);
  if (/confirm/i.test(error.message)) return { error: "Confirm your email first: use the code we sent when you signed up, or sign in with a code." };
  if (/invalid/i.test(error.message)) return { error: "That email and password don’t match. Made your account on iPad? Sign in with a code instead." };
  return { error: "That didn’t work. Check your connection and try again." };
}

/** A new account with a password. The email that follows carries a code to confirm it. */
export async function signUpWithPassword(email: string, password: string, reason: SignInReason, next: string) {
  const sb = supabase();
  if (!sb) return { ...off, confirm: false };
  track("signin_started", { method: "password_signup", reason });
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl(reason, "email", next), data: META } });
  if (error) {
    if (/password/i.test(error.message)) return { error: "Use a longer password: at least 6 characters.", confirm: false };
    return { error: codeTrouble(error.message), confirm: false };
  }
  if (data.session) { done("password_signup", reason); return { error: null, confirm: false }; }
  return { error: null, confirm: true };
}

/** "Forgot password?": a code by email, then a new password. */
export async function sendReset(email: string) {
  const sb = supabase();
  if (!sb) return off;
  track("password_reset_started", {});
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/sign-in?set=1")}` });
  return { error: error ? codeTrouble(error.message) : null };
}

export async function setPassword(password: string) {
  const sb = supabase();
  if (!sb) return off;
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: /different|same/i.test(error.message) ? "Pick a password you haven’t used here before." : "Use a longer password: at least 6 characters." };
  track("password_set", {});
  return { error: null };
}

/**
 * Off to a provider, and back to /auth/callback, which finishes and goes on to `next`. The browser leaves the page, so
 * the answer matters only when it does not: accounts off, or the client could not start the trip.
 *
 * Both providers go to the same /auth/callback?next=... (safeNext keeps `next` on this site). Apple, unlike Google, answers
 * Supabase with a POST and Supabase sends the student on with an ordinary redirect, so nothing here handles a POST. If the
 * student cancels at Apple (or Google), Supabase redirects to the same callback with error params, which AuthCallback shows
 * in Plumi's words.
 */
async function signInWithProvider(provider: "google" | "apple", reason: SignInReason, next: string) {
  const sb = supabase();
  if (!sb) return off;
  track("signin_started", { method: provider, reason });
  try {
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(reason, provider, next) } });
    return { error: error ? `That didn’t start. Check your connection and try again, or use a different way in.` : null };
  } catch {
    return { error: `That didn’t start. Check your connection and try again, or use a different way in.` };
  }
}

export const signInWithGoogle = (reason: SignInReason, next: string) => signInWithProvider("google", reason, next);
/**
 * Apple only sends the student's name the first time they sign in, and only if they share it; Supabase puts it in
 * `user_metadata` (lib/accountName reads it, falling back to the email, which may be Apple's private relay address).
 */
export const signInWithApple = (reason: SignInReason, next: string) => signInWithProvider("apple", reason, next);

/** Delete the signed-in account: the server call the iPad app makes (`delete_own_account`), with this session's token (the client adds it). */
export async function deleteOwnAccountCall(): Promise<{ error: { message?: string; code?: string; status?: number } | null }> {
  const sb = supabase();
  if (!sb) return { error: { message: "accounts are off" } };
  const { error, status } = await sb.rpc("delete_own_account");
  return { error: error ? { message: error.message, code: error.code, status } : null };
}
/** Forget the session in this browser only (the account is gone: there is nobody to tell the server about). */
export async function signOutLocal() {
  await supabase()?.auth.signOut({ scope: "local" });
}

export async function signOut() {
  await supabase()?.auth.signOut();
  track("signed_out", {});
}

/** The stored access token, if signed in (null if not, or if accounts are off). `getSession` renews an expired one first. */
export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  try { return (await sb.auth.getSession()).data.session?.access_token ?? null; } catch { return null; }
}

/**
 * How a renewal of the sign-in went. `dead`: the server has ended the session for good (an invalid refresh token); it is signed out in this browser here, so the
 * app shows signed out. `offline`: the network or the server did not answer, nothing is known or changed. `refused`: some other refusal; nothing changed.
 */
export type Refreshed = { kind: "ok"; token: string } | { kind: "dead" } | { kind: "offline" } | { kind: "refused" };

let renewing: Promise<Refreshed> | null = null;
/** Renew the session once (a renewal already under way is shared, so tabs of one page never stack them). Never throws. */
export function refreshAccessToken(): Promise<Refreshed> {
  renewing ??= (async (): Promise<Refreshed> => {
    const sb = supabase();
    if (!sb) return { kind: "offline" };
    try {
      const { data, error } = await sb.auth.refreshSession();
      if (error) {
        if (isDeadSession(error)) { await signOutLocal(); return { kind: "dead" }; }
        return isOfflineError(error) ? { kind: "offline" } : { kind: "refused" };
      }
      const token = data.session?.access_token;
      if (token) return { kind: "ok", token };
      await signOutLocal();
      return { kind: "dead" };
    } catch { return { kind: "offline" }; }
  })().finally(() => { renewing = null; });
  return renewing;
}
