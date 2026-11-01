import type { SocialAvatar } from "@/lib/social/types";
import type { LobbyRealtime } from "@/lib/studyapp/library/lobbyWatch";
import type { LibrarySocial } from "@/lib/studyapp/library/session";

/**
 * What a visit stands on: the server's calls, Realtime, who you are. The page builds the real one from the
 * website's Supabase client (`browserDriver`); the dev-only demo (`/study/library/demo`) and the tests hand in a
 * scripted one (src/lib/studyapp/library/fake.ts), so the same room runs on both.
 */
export interface LibraryDriver {
  social: LibrarySocial;
  realtime: () => LobbyRealtime | null;
  /** Your id, as the server and the Realtime topics spell it. */
  me: string;
  /** Your colour and avatar when the page already holds them (the demo's); else the signed-in profile's. */
  mine?: { avatar: SocialAvatar | null; colour: number };
  /** Called once the room is up (the demo starts its scripted students here), and returns what to stop. */
  scene?: () => (() => void) | void;
}
