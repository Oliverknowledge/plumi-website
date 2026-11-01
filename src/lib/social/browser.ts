"use client";

import { accountsOn, onUser, supabase } from "@/lib/account";
import type { Api, Filter, Row } from "./api";
import type { ApiError } from "./failure";
import type { RealtimeLike } from "./realtime";
import { createSocial, type SocialService } from "./service";

/**
 * The browser's binding: the website's one Supabase client (the same project, session and accounts as the
 * iPad, src/lib/account.ts) behind the Api the service is written against. Nothing else lives here, so the
 * service and its tests need no browser.
 */

let me: string | null = null;
let following = false;
function follow() {
  if (following || typeof window === "undefined") return;
  following = true;
  onUser((id) => { me = id; });
}

interface Chain extends PromiseLike<{ data: Row[] | null; error: { message: string; code?: string } | null; status: number }> {
  eq(c: string, v: string): Chain;
  in(c: string, v: string[]): Chain;
  gt(c: string, v: string): Chain;
  or(e: string): Chain;
  order(c: string, o: { ascending: boolean }): Chain;
  limit(n: number): Chain;
}

const toError = (e: { message: string; code?: string }, status: number): ApiError => ({ message: e.message, code: e.code, status });

export const browserApi: Api = {
  get configured() { follow(); return accountsOn; },
  userId() { follow(); return me; },
  async rpc(name, args) {
    const sb = supabase();
    if (!sb) return { data: null, error: { message: "not configured" } };
    const r = await sb.rpc(name, args ?? {});
    return { data: r.data, error: r.error ? toError(r.error, r.status) : null };
  },
  async select(table, columns, filters: Filter[] = []) {
    const sb = supabase();
    if (!sb) return { data: null, error: { message: "not configured" } };
    let q = sb.from(table).select(columns) as unknown as Chain;
    for (const f of filters) {
      if (f[0] === "eq") q = q.eq(f[1], f[2]);
      else if (f[0] === "in") q = q.in(f[1], f[2]);
      else if (f[0] === "gt") q = q.gt(f[1], f[2]);
      else if (f[0] === "or") q = q.or(f[1]);
      else if (f[0] === "order") q = q.order(f[1], { ascending: f[2] === "asc" });
      else q = q.limit(f[1]);
    }
    const r = await q;
    return { data: r.data, error: r.error ? toError(r.error, r.status) : null };
  },
};

/** The one service for the page, over the website's own client. */
export const social: SocialService = createSocial(browserApi);

/** Supabase Realtime for the hall and the chat; null when accounts are off. Joined on private channels with the student's own token. */
export function realtime(): RealtimeLike | null {
  const sb = supabase();
  if (!sb) return null;
  void sb.realtime.setAuth().catch(() => {});
  return sb as unknown as RealtimeLike;
}
