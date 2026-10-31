"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

/**
 * Plumi accounts on the website: the same Supabase project, and so the same accounts,
 * as the iPad app. A student who signs in with the same Google account or email on both
 * is one person: their marks, their place in the Grand Library and (later) friends follow them.
 *
 * Everything here runs in the browser, so every page stays static: no cookies are read
 * on the server and nothing in the shared layout changes. With no project configured
 * (NEXT_PUBLIC_PLUMI_SUPABASE_URL and _KEY), accounts are simply off and the site works
 * as before, saving to this browser only.
 *
 * The names are Plumi's own, not NEXT_PUBLIC_SUPABASE_URL, because the waitlist
 * (lib/waitlist) falls back to that one and may live in a different project.
 *
 * Sign-in is an email code or Google. The emails ("Confirm sign up" for a new address,
 * "Magic link or OTP" otherwise) carry the code and a link; the code works anywhere,
 * while the link brings the student back to /auth/callback, signed in, only in the
 * browser they asked from (PKCE). Supabase's default templates carry only the link, and
 * they can be edited only once the project sends through its own email sender (custom
 * SMTP): supabase/email-templates/ has ours. Apple on the web needs its own Services
 * ID, so it waits. The key here is the publishable one, which the app ships too: what it can
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
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "plumi-auth" },
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
  sb.auth.getSession().then(({ data }) => set(data.session));
  sb.auth.onAuthStateChange((_event, session) => set(session));
}
function set(session: Session | null) {
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
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null;
  return { ready: s.ready, user, email: user?.email ?? null, name, on: accountsOn };
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

export type SignInReason = "header" | "marks" | "library";

/** Where a sign-in link or Google sends the student back to: /auth/callback, then this page. */
function callbackUrl(reason: SignInReason, method: "email" | "google") {
  try { sessionStorage.setItem("plumi.signin.reason", `${method}:${reason}`); } catch { /* fine without */ }
  const back = `${window.location.pathname}${window.location.search}`;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(back)}`;
}

/** Email a sign-in link (and code, where the template has one). New addresses become accounts, marked as made on the website by someone 13 or over. */
export async function sendCode(email: string, reason: SignInReason) {
  const sb = supabase();
  if (!sb) return { error: "Sign-in isn’t switched on here yet." };
  track("signin_started", { method: "email", reason });
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: callbackUrl(reason, "email"), data: { age_band: "13_plus", signed_up_on: "web" } } });
  if (!error) return { error: null };
  return { error: /rate|seconds/i.test(error.message) ? "Codes are limited to one a minute. Try again shortly." : "That didn’t send. Check the address and try again." };
}

export async function verifyCode(email: string, token: string, reason: SignInReason) {
  const sb = supabase();
  if (!sb) return { error: "Sign-in isn’t switched on here yet." };
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: /expired/i.test(error.message) ? "That code has expired. Send a new one." : "That code doesn’t match. Check it and try again." };
  track("signin_completed", { method: "email", reason });
  return { error: null };
}

/** Off to Google, and back to /auth/callback, which finishes and returns to this page. */
export async function signInWithGoogle(reason: SignInReason) {
  const sb = supabase();
  if (!sb) return;
  track("signin_started", { method: "google", reason });
  await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(reason, "google") } });
}

export async function signOut() {
  await supabase()?.auth.signOut();
  track("signed_out", {});
}

/* The sign-in sheet: any page can open it, and say why, so the sheet's words fit the moment. */
let sheet: SignInReason | null = null;
const sheetListeners = new Set<() => void>();
export function openSignIn(reason: SignInReason) {
  sheet = reason;
  track("signin_prompted", { reason });
  sheetListeners.forEach(l => l());
}
export function closeSignIn() { sheet = null; sheetListeners.forEach(l => l()); }
export const useSignInSheet = () => useSyncExternalStore(cb => { sheetListeners.add(cb); return () => { sheetListeners.delete(cb); }; }, () => sheet, () => null);
