"use client";

import { useSyncExternalStore } from "react";
import { onUser, supabase } from "@/lib/account";
import { track } from "@/lib/analytics";
import type { SocialAvatar } from "@/lib/social/types";

/**
 * "Join the library": the step that puts a signed-in student in the Grand Library, the
 * shared study room iPad students already sit in (founder, 31 October 2026, step 1 of
 * bringing it to the website). It is the iPad's own opt-in, the same server call
 * (`social_opt_in`, Supabase/migrations/0104_social.sql in the app) with the same name
 * rule and colours, so joining here is joining there and the other way round. Nothing is
 * shared with anyone until a student joins (children's privacy: the app's rule too).
 *
 * The app's copy of all this is Sources/PlumiKit/Social/LibraryJoinCard.swift,
 * DisplayNameRule.swift and SocialAvatarColours.swift. The server has the last word on a
 * name (its blocklist is not repeated here); this only catches what a student can fix
 * before sending.
 */

/** The app's eight avatar colours. The server keeps 0 to 15; the app draws `index % 8`. */
export const LIBRARY_COLOURS = ["#2158D4", "#2E8A45", "#C25A0A", "#7A4EE0", "#C9472C", "#137486", "#C23B78", "#4B5A73"];
export const colourOf = (index: number) => LIBRARY_COLOURS[((index % 8) + 8) % 8];
export const COLOUR_NAMES = ["Blue", "Green", "Orange", "Purple", "Coral", "Teal", "Pink", "Slate"];

/* ── Names ─────────────────────────────────────────────────────────────── */

const ADJECTIVES = ["Quiet", "Brave", "Bright", "Calm", "Clever", "Cosy", "Eager", "Gentle", "Happy", "Jolly",
  "Keen", "Kind", "Lucky", "Merry", "Mighty", "Nimble", "Plucky", "Proud", "Rapid", "Sunny",
  "Swift", "Steady", "Witty", "Wise", "Bold", "Cheery", "Daring", "Golden", "Lively", "Patient"];
const ANIMALS = ["Otter", "Owl", "Fox", "Badger", "Hare", "Robin", "Wren", "Heron", "Panda", "Koala",
  "Lynx", "Puffin", "Seal", "Falcon", "Hedgehog", "Squirrel", "Dolphin", "Penguin", "Tiger", "Llama",
  "Beaver", "Raven", "Swan", "Moose", "Gecko", "Bison", "Lemur", "Walrus", "Turtle", "Whale"];

/** A friendly made-up name ("Quiet Otter") other than `avoiding`. */
export function generatedName(avoiding?: string) {
  for (;;) {
    const name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}`;
    if (name !== avoiding) return name;
  }
}

const normalise = (raw: string) => raw.normalize("NFC").replace(/\s+/g, " ").trim();

/** The app's DisplayNameRule, short of its blocklist: the line to show, or null when the name can be sent. */
export function nameProblem(raw: string): string | null {
  const name = normalise(raw);
  const length = [...name].length;
  if (length < 2) return "At least 2 characters";
  if (length > 20) return "20 characters at most";
  if (/[^\p{L}\p{M}\p{N} .'&-]/u.test(name)) return "Letters, numbers, spaces and . ' & - only";
  if (!/\p{L}/u.test(name)) return "Use at least one letter";
  if ((name.match(/\p{N}/gu) ?? []).length > 4 || /\.[A-Za-z]/.test(name)) return "No contact details in a name";
  return null;
}

/** The account's first name, when it passes the rule; else a made-up one. Never an email. */
export function suggestedName(signInName: string | null) {
  const first = signInName && !signInName.includes("@") ? normalise(signInName).split(" ")[0] : "";
  return first && !nameProblem(first) ? first : generatedName();
}

/* ── The student's place in the library, as a store ────────────────────── */

export interface LibraryProfile {
  name: string;
  colour: number;
  /** The cosmetic keys the student dressed with (`social_profile.avatar`: body, eyes, outfit, hair, acc, phones, pro and the older keys), or null if none are saved. Draws them in the Grand Library. */
  avatar?: SocialAvatar | null;
}
type State = { checked: boolean; profile: LibraryProfile | null };
let state: State = { checked: false, profile: null };
const listeners = new Set<() => void>();
let started = false;
let user: string | null = null;

/** Strings only, as the social service reads an avatar; null when there is nothing. */
function avatarOf(v: unknown): SocialAvatar | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: SocialAvatar = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
  return Object.keys(out).length > 0 ? out : null;
}

function set(next: State) { state = next; listeners.forEach(l => l()); }

async function load(uid: string) {
  const sb = supabase();
  if (!sb) return;
  // The avatar column came with the app's 0108; a server without it answers an error, so ask again without it (the same ladder as the social service's profile read).
  let { data, error } = await sb.from("social_profile").select("display_name,colour,avatar").eq("user_id", uid).maybeSingle();
  if (error) ({ data, error } = await sb.from("social_profile").select("display_name,colour").eq("user_id", uid).maybeSingle());
  if (user !== uid) return;
  if (error) { set({ checked: true, profile: null }); return; }
  set({ checked: true, profile: data ? { name: data.display_name as string, colour: data.colour as number, avatar: avatarOf((data as { avatar?: unknown }).avatar) } : null });
}

function subscribe(cb: () => void) {
  if (!started && typeof window !== "undefined") {
    started = true;
    onUser(id => {
      user = id;
      set({ checked: !id, profile: null });
      if (id) void load(id);
    });
  }
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
const SERVER: State = { checked: false, profile: null };

/** Whether the signed-in student has joined, and as whom. `checked` is false until the server has said. */
export const useLibrary = () => useSyncExternalStore(subscribe, () => state, () => SERVER);

/** The avatar the student just saved, so the room draws it at once without another read. */
export function rememberAvatar(avatar: SocialAvatar) {
  if (state.profile) set({ checked: true, profile: { ...state.profile, avatar } });
}

/** Join (or change name and colour). The server's refusal of a name comes back as `refused`. */
export async function joinLibrary(name: string, colour: number): Promise<{ ok: true } | { ok: false; refused: boolean; message: string }> {
  const sb = supabase();
  if (!sb || !user) return { ok: false, refused: false, message: "Sign in first." };
  const clean = normalise(name);
  const problem = nameProblem(clean);
  if (problem) { track("library_name_refused", { why: problem }); return { ok: false, refused: true, message: problem }; }
  const { data, error } = await sb.rpc("social_opt_in", { display_name: clean, colour });
  if (error) {
    const refused = /name_refused/.test(error.message);
    if (refused) track("library_name_refused", { why: "server" });
    return { ok: false, refused, message: refused ? "Try another name" : "That didn’t go through. Check your connection and try again." };
  }
  const joined = state.profile === null;
  set({ checked: true, profile: { name: (data?.display_name as string) ?? clean, colour: (data?.colour as number) ?? colour, avatar: state.profile?.avatar ?? null } });
  if (joined) track("library_joined", { colour });
  return { ok: true };
}

/**
 * Leave the library: the app's "Turn off". It removes the student from friends and
 * groups as well (the server's social_opt_out), so the button that calls this says so.
 */
export async function leaveLibrary() {
  const sb = supabase();
  if (!sb || !user) return false;
  const { error } = await sb.rpc("social_opt_out");
  if (error) return false;
  set({ checked: true, profile: null });
  track("library_left", {});
  return true;
}
