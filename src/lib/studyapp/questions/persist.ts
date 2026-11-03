/**
 * How the Questions data is kept on the device, as pure functions (the browser parts are in store.ts, so every rule here is tested).
 *
 * It lives in its own localStorage key, not in the app's one document (`plumi-study-app`). Three reasons: the document was
 * re-serialised whole on every stroke and keystroke (134 ms at the caps), it shared the 5 MB quota with the flashcards, and a tab
 * still running the site from before the Questions tab shipped re-saves that document without `questions` and so wiped them.
 *
 * Reading never loses anything:
 *  - the new key, if it holds a readable version-1 record;
 *  - otherwise, once, the `questions` the old document held (the migration; the old copy is dropped from the app's document only
 *    after the new key has been written and read back);
 *  - a blob that cannot be read (corrupt, or from a newer version) is handed back as `keep`, for the caller to put under the
 *    recovery key before anything is written over it. The tab then starts empty rather than crashing.
 */
import { EMPTY_QUESTIONS, sanitiseQuestions, type QuestionsData } from "./model";

export const QUESTIONS_KEY = "plumi-study-questions";
export const QUESTIONS_RECOVERY_KEY = "plumi-study-questions-recovery";
/** Room for a few unreadable records: the first is `QUESTIONS_RECOVERY_KEY`, then `-2` to `-5`. A new one never replaces an older one. */
export const RECOVERY_SLOTS = 5;
export const recoveryKey = (i: number) => (i === 0 ? QUESTIONS_RECOVERY_KEY : `${QUESTIONS_RECOVERY_KEY}-${i + 1}`);
export const APP_KEY = "plumi-study-app";
export const STORED_VERSION = 1;

export interface Loaded {
  data: QuestionsData;
  /** Where it came from: its own key, the app's old document (migrated), or nowhere (a new student). */
  origin: "own" | "migrated" | "empty";
  /** Raw text that could not be read and must be kept before it is overwritten. */
  keep: string | null;
}

/** Where an unreadable record is kept: the first recovery key that is free, or none if this very text is kept already (a reload must not fill the slots) or all are taken. */
export function chooseRecoveryKey(read: (key: string) => string | null, raw: string): string | null {
  let free: string | null = null;
  for (let i = 0; i < RECOVERY_SLOTS; i++) {
    const held = read(recoveryKey(i));
    if (held === raw) return null;
    if (held === null && free === null) free = recoveryKey(i);
  }
  return free;
}

export const serialise = (q: QuestionsData): string => JSON.stringify({ v: STORED_VERSION, q });

const parse = (raw: string): unknown => { try { return JSON.parse(raw); } catch { return undefined; } };

/** A record this version can read, or why not. */
function readOwn(raw: string): { ok: true; data: QuestionsData } | { ok: false } {
  const j = parse(raw) as { v?: unknown; q?: unknown } | null | undefined;
  if (!j || typeof j !== "object" || j.v !== STORED_VERSION || !j.q || typeof j.q !== "object") return { ok: false };
  return { ok: true, data: sanitiseQuestions(j.q) };
}

/** `questions` out of the old app document, sanitised; null if it held none worth moving. */
export function questionsOfAppDocument(raw: string | null): QuestionsData | null {
  if (!raw) return null;
  const j = parse(raw) as { questions?: unknown } | null | undefined;
  if (!j || typeof j !== "object" || !j.questions || typeof j.questions !== "object") return null;
  const q = sanitiseQuestions(j.questions);
  return q.sets.length || Object.keys(q.answers).length || q.recent.length ? q : null;
}

export function readQuestions(own: string | null, appDocument: string | null): Loaded {
  let keep: string | null = null;
  if (own !== null && own !== "") {
    const r = readOwn(own);
    if (r.ok) return { data: r.data, origin: "own", keep: null };
    keep = own;
  }
  const old = questionsOfAppDocument(appDocument);
  if (old) return { data: old, origin: "migrated", keep };
  return { data: EMPTY_QUESTIONS, origin: "empty", keep };
}

/** Another tab changed the key: its new value, if readable (a missing or unreadable value changes nothing here). */
export function readIncoming(raw: string | null): QuestionsData | null {
  if (raw === null || raw === "") return null;
  const r = readOwn(raw);
  return r.ok ? r.data : null;
}

/**
 * The app's document as it should be written once the Questions data has its own home: without `questions`.
 * Only call this when the Questions store has the data safely in its own key.
 */
export function withoutQuestions<T extends { questions: QuestionsData }>(doc: T): T {
  return doc.questions === EMPTY_QUESTIONS ? doc : { ...doc, questions: EMPTY_QUESTIONS };
}

/** Set by the Questions store once the data is safely in its own key; read by the app's store before it writes its document. */
let durable = false;
export const setQuestionsDurable = (v: boolean) => { durable = v; };
export const questionsAreDurable = () => durable;

/** The app's store calls this with what the Questions key holds when it starts: a record in the format this version writes means the move has been made. */
export function noteQuestionsKey(raw: string | null) {
  if (raw && raw.startsWith(`{"v":${STORED_VERSION},"q":`)) durable = true;
}
