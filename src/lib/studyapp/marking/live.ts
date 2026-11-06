import { supabase } from "@/lib/account";
import type { Deps } from "./api";

/**
 * AI marking is off unless this is exactly "on". The consent wording is a draft for a lawyer and the function behind it is not deployed:
 * shipping this code with the flag unset changes nothing a student can see.
 */
export const aiMarkingOn = process.env.NEXT_PUBLIC_PLUMI_AI_MARKING === "on";

const URL = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_PLUMI_SUPABASE_KEY;

/** The real wiring of api.ts: the project's `mark` function, the signed-in student's token. */
export function liveDeps(): Deps | null {
  if (!URL || !KEY) return null;
  return {
    base: `${URL.replace(/\/$/, "")}/functions/v1/mark`,
    apikey: KEY,
    token: async () => (await supabase()?.auth.getSession())?.data.session?.access_token ?? null,
    fetch: (input, init) => fetch(input, init),
  };
}
