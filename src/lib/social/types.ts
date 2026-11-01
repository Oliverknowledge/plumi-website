/**
 * The values of friends, groups and the study hall, as the web holds them. Shapes and names
 * follow the iPad's (Sources/PlumiKit/Social/SocialTypes.swift) and, underneath it, the server's
 * (Supabase/migrations/0104 to 0123 in the app repo), which is the one contract both clients
 * speak. The rows below are what those migrations return, checked against a real Postgres.
 */

export type UserId = string;
export type GroupId = string;

/** The student's own profile (`social_opt_in` returns it; `social_profile` holds it). */
export interface SocialProfile {
  userId: UserId;
  displayName: string;
  /** 0 to 15 on the server; the app draws `colour % 8`. */
  colour: number;
  /** Eight characters, shown as XXXX-XXXX. */
  friendCode: string;
  optedInAt: string | null;
}

export type StudyMode = "timer" | "pomodoro";
export type StudyPhase = "work" | "break";

/** What a friend is doing now (`study_presence`). Expires on the server after a while. */
export interface StudyPresence {
  subjectId: string;
  mode: StudyMode;
  phase: StudyPhase;
  startedAt: string;
  endsAt: string | null;
  expiresAt: string | null;
}

/** Seconds studied, from `social_summary`. A friend's streak counts only while it can still be alive. */
export interface SocialSummary {
  day: string | null;
  todaySeconds: number;
  weekSeconds: number;
  weekXp: number;
  level: number;
  streak: number;
  streakDay: string | null;
  updatedAt: string | null;
}

/** The cosmetic keys of a student's avatar (0108, 0115): identifiers and colours only, no free text. */
export type SocialAvatar = Record<string, string>;

export interface SocialPerson {
  id: UserId;
  displayName: string;
  colour: number;
  avatar: SocialAvatar | null;
  presence?: StudyPresence;
  summary?: SocialSummary;
}

export interface FriendRequest {
  otherUserId: UserId;
  direction: "incoming" | "outgoing";
  person: SocialPerson | null;
  createdAt: string;
}

export interface FriendsSnapshot {
  friends: SocialPerson[];
  requests: FriendRequest[];
}

/**
 * What `send_friend_request` came to. The server answers with a word rather than raising: pending (waiting
 * on them), accepted (they had already asked you), already_friends, self; not_found and blocked are the
 * same quiet "that code didn't work" so a blocked student cannot tell, and rate_limited is a refusal.
 */
export type FriendRequestOutcome = "sent" | "now_friends" | "already_friends" | "own_code";

export type HallTheme = "oak" | "blue" | "night" | "cafe";
export interface GroupHall {
  /** One of six emblems, 0 to 5. */
  emblem: number;
  theme: HallTheme;
  /** 5 to 100. */
  weeklyGoalHours: number;
}

export interface StudyGroup {
  id: GroupId;
  name: string;
  /** Null for a student who is not the owner on a server that hides it; members see it. */
  inviteCode: string | null;
  ownerId: UserId;
  createdAt: string;
  memberCount: number;
  hall: GroupHall;
  isPublic: boolean;
}

export type GroupRole = "owner" | "member";
export interface GroupMember {
  person: SocialPerson;
  joinedAt: string;
  role: GroupRole;
}

export type ReactionKind = "high_five" | "you_got_this" | "nudge";
export const REACTION_KINDS: readonly ReactionKind[] = ["high_five", "you_got_this", "nudge"];
export const REACTION_TITLE: Record<ReactionKind, string> = { high_five: "High five", you_got_this: "You got this", nudge: "Nudge" };

/** What `send_reaction` came to: one per pair per ten minutes and sixty a day, only between members. */
export type ReactionOutcome = "sent" | "too_soon" | "rate_limited" | "not_found";
export function reactionLine(outcome: ReactionOutcome, kind: ReactionKind): string {
  switch (outcome) {
    case "sent": return `${REACTION_TITLE[kind]} sent`;
    case "too_soon": return "Sent one already. Try later";
    case "rate_limited": return "That\u2019s plenty for today";
    case "not_found": return "They\u2019re not in this group now";
  }
}

export interface GroupReaction {
  id: number;
  groupId: GroupId;
  fromUserId: UserId;
  toUserId: UserId;
  kind: ReactionKind;
  createdAt: string;
  seenAt: string | null;
}

export interface GroupMessage {
  id: string;
  groupId: GroupId;
  senderId: UserId;
  body: string;
  createdAt: string;
  hidden: boolean;
}

export type MessageReportReason = "language" | "link" | "bullying" | "other";
export type UserReportReason = "name" | "bothering" | "other";

/** Where someone stands in a hall (`hall_positions`): a tile of the world, 0 to 255. */
export interface HallSpot {
  userId: UserId;
  x: number;
  y: number;
  updatedAt: string;
}

/** The friends' hall's key; a group's hall is its lower-case id (HallPositions.hallKey). */
export const FRIENDS_HALL = "friends";
export const hallKey = (groupId?: GroupId | null) => (groupId ? groupId.toLowerCase() : FRIENDS_HALL);
export const MAX_TILE = 255;

/** What a student sets with `set_presence`. */
export interface PresenceUpdate {
  subjectId: string;
  mode: StudyMode;
  phase: StudyPhase;
  startedAt: Date;
  endsAt?: Date | null;
}

/** What `publish_summary_week` and `publish_streak` carry. */
export interface SummaryFigures {
  todaySeconds: number;
  weekSeconds: number;
  weekXp: number;
  level: number;
  streak: number;
}
