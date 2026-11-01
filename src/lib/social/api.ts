import type { ApiError } from "./failure";

/**
 * The transport the social service stands on: two verbs, so the service is tested without a network
 * and the browser binding (browser.ts) is a few lines. Reads are table reads under row-level security
 * (`rest/v1/<table>`); every write is an RPC (`rest/v1/rpc/<name>`), as on the iPad. Nothing here
 * decides who may see what: the database does, in one place (`can_see`, 0104).
 */
export type Row = Record<string, unknown>;

export type Filter =
  | ["eq", column: string, value: string]
  | ["in", column: string, values: string[]]
  | ["gt", column: string, value: string]
  | ["or", expression: string]
  | ["order", column: string, direction: "asc" | "desc"]
  | ["limit", count: number];

export interface Api {
  /** False when the site has no Supabase project configured: every call is then `notConfigured`. */
  readonly configured: boolean;
  /** The signed-in student's id, or null. */
  userId(): string | null;
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: ApiError | null }>;
  select(table: string, columns: string, filters?: Filter[]): Promise<{ data: Row[] | null; error: ApiError | null }>;
}

/**
 * Every RPC the web calls, with its parameter names exactly as the migrations declare them. Written as
 * data so `npm run social:contract` can hold each one against the app repo's SQL: a renamed parameter
 * there fails here before it fails for a student.
 */
export const RPC = {
  optIn: { name: "social_opt_in", args: ["display_name", "colour"] },
  optOut: { name: "social_opt_out", args: [] },
  sendFriendRequest: { name: "send_friend_request", args: ["code"] },
  respondFriendRequest: { name: "respond_friend_request", args: ["from_user", "accept"] },
  removeFriend: { name: "remove_friend", args: ["user"] },
  block: { name: "block_user", args: ["user"] },
  unblock: { name: "unblock_user", args: ["user"] },
  reportUser: { name: "report_user", args: ["user", "reason", "group"] },
  createGroup: { name: "create_group", args: ["name"] },
  joinGroup: { name: "join_group", args: ["code"] },
  leaveGroup: { name: "leave_group", args: ["group"] },
  removeMember: { name: "remove_member", args: ["group", "user"] },
  rotateGroupCode: { name: "rotate_group_code", args: ["group"] },
  renameGroup: { name: "rename_group", args: ["group", "name"] },
  setPresence: { name: "set_presence", args: ["subject", "mode", "phase", "started_at", "ends_at"] },
  clearPresence: { name: "clear_presence", args: [] },
  publishSummaryWeek: { name: "publish_summary_week", args: ["today_seconds", "week_seconds", "week_xp", "level"] },
  publishStreak: { name: "publish_streak", args: ["days"] },
  setGroupHall: { name: "set_group_hall", args: ["group", "emblem", "hall_theme", "weekly_goal_hours"] },
  setGroupVisibility: { name: "set_group_visibility", args: ["group", "visibility"] },
  sendReaction: { name: "send_reaction", args: ["group", "user", "kind"] },
  markReactionsSeen: { name: "mark_reactions_seen", args: [] },
  setAvatar: { name: "set_avatar", args: ["avatar"] },
  sendGroupMessage: { name: "send_group_message", args: ["group", "body"] },
  reportGroupMessage: { name: "report_group_message", args: ["message", "reason", "block"] },
  setHallPosition: { name: "set_hall_position", args: ["hall", "x", "y"] },
  clearHallPosition: { name: "clear_hall_position", args: [] },
  hallPositions: { name: "hall_positions", args: ["hall"] },
  // The public lobby and the Grand Library (0117, 0119, 0121): the same functions the iPad's library calls.
  lobbyMe: { name: "lobby_me", args: [] },
  setLobbyVisible: { name: "set_lobby_visible", args: ["visible"] },
  regenerateNickname: { name: "regenerate_nickname", args: [] },
  lobbyJoin: { name: "lobby_join", args: ["x", "y", "want"] },
  lobbyServers: { name: "lobby_servers", args: [] },
  lobbySetPosition: { name: "lobby_set_position", args: ["shard", "x", "y", "seated", "subject", "focus_since"] },
  lobbyLeave: { name: "lobby_leave", args: [] },
  lobbyPeople: { name: "lobby_people", args: ["shard"] },
  lobbyEmote: { name: "lobby_emote", args: ["kind"] },
  libraryMessages: { name: "library_messages", args: ["shard", "since"] },
  sendLibraryMessage: { name: "send_library_message", args: ["shard", "body"] },
  reportLibraryMessage: { name: "report_library_message", args: ["message", "reason", "block"] },
} as const;

export type RpcKey = keyof typeof RPC;

/**
 * The tables the web reads, and the columns it asks for, newest first. A server that has not had a later
 * migration refuses a read that names its columns, so the service tries each set in turn and uses the first
 * the server accepts: the same ladder the iPad climbs down (SupabaseSocialService.groups and .people).
 * One place, so `npm run social:contract` can hold every column to the migrations.
 */
const base = "user_id,day,today_seconds,week_start,week_xp,level,updated_at";
const hall = "id,name,invite_code,owner_id,created_at,emblem,hall_theme,weekly_goal_hours";
export const READS = {
  profile: { table: "social_profile", ladder: ["user_id,display_name,colour,friend_code,opted_in_at,avatar", "user_id,display_name,colour,friend_code,opted_in_at"] },
  people: { table: "social_profile", ladder: ["user_id,display_name,colour,avatar", "user_id,display_name,colour"] },
  friendship: { table: "friendship", ladder: ["user_id,friend_id,status,created_at"] },
  groups: { table: "study_group", ladder: [`${hall},visibility`, hall, "id,name,invite_code,owner_id,created_at"] },
  members: { table: "group_member", ladder: ["user_id,joined_at,role"] },
  memberCounts: { table: "group_member", ladder: ["group_id,user_id"] },
  presence: { table: "study_presence", ladder: ["user_id,subject_id,mode,phase,started_at,ends_at,expires_at"] },
  summary: { table: "social_summary", ladder: [`${base},week_seconds,streak,streak_day`, `${base},week_seconds`, base] },
  messages: { table: "group_message", ladder: ["id,group_id,sender,body,created_at,hidden"] },
  reactions: { table: "group_reaction", ladder: ["id,group_id,user_id,to_user,kind,created_at,seen_at"] },
} as const satisfies Record<string, { table: string; ladder: readonly string[] }>;
