import type { LibraryDriver } from "@/components/studyapp/library/driver";
import { FakeBot, FakeLibraryWorld, FakeRealtimeHub } from "./fake";
import { ANIMALS } from "./people/animals";
import type { SeatDef } from "./room";
import { cafeSeats } from "./rooms";
import layout from "../../../../public/rooms/cafe/layout.json";
import { centreOf, gridOf, plan, reach, type Grid, type Pt, type Tile } from "./walk";

/**
 * A scripted cafe for the dev-only page `/study/cafe/demo` and for screenshots: the cafe interior with students who walk in
 * through the door, sit down at the tables, study a while, and leave, with no Supabase project. It is the same fake server and
 * Realtime hub the library demo uses (fake.ts), driving the same room engine and panel; only the room and the script differ.
 * The cafe is not multiplayer: this is the whole of its "world" until the town exists. Never reachable in production.
 *
 * How a bot is made to look alive on a server that lists people only every 12 seconds: a bot is LISTED a little before it comes in
 * (but has said it left, so the room does not draw it), and its first step on the floor is what shows it, at the door and
 * walking. So nobody pops into being, and nobody waits to be listed.
 */

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const CAFE_ME = uuid(1);
/** The walking speed of everyone in the room (art pixels a second; the engine's LIVE_SPEED). */
const SPEED = 70;
/** How long before a bot walks in that it is listed (the list is read every 12 s: a new face shows within about 15). */
const LEAD_MS = 16_000;
/** The server forgets someone it has not heard from in 30 s: the script says so again this often. */
const BEAT_MS = 8_000;

const ME_PERSON: Record<string, string> = { body: "03", eyes: "02", outfit: "12_03", hair: "29_04", acc: "none", phones: "red" };
const NAMES = ["Maya", "Josh", "Wren", "Lark", "Newt", "Owl", "Ada", "Ben", "Cleo", "Dev", "Eli", "Fay"];
const NICK = ["Bold Fox", "Calm Heron", "Brave Wren", "Golden Lark", "Merry Newt", "Snowy Owl", "Quiet Finch", "Kind Seal", "Wise Hare", "Keen Lynx", "Jolly Otter", "Plucky Stoat"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const dressed = (n: number): Record<string, string> => ({
  body: pad2(1 + (n % 7)), eyes: pad2(1 + ((n * 3) % 7)), outfit: `${pad2(1 + ((n * 7) % 30))}_0${1 + (n % 3)}`, hair: `${pad2(1 + ((n * 5) % 29))}_0${1 + (n % 4)}`,
  acc: n % 6 === 0 ? "15_glasses_01" : "none", phones: ["none", "teal", "red", "lilac"][n % 4],
});
const SUBJECTS = ["maths", "physics", "chemistry", "biology"];

export interface CafeDemoOptions {
  /** How many other students (6 to 12; default 9). */ bots?: number;
  /** `?me=badger`: you are that animal. */ me?: string;
  /** `?zoo=1`: the students are the nine animals. */ zoo?: boolean;
  /** `?alone=1`: nobody else (the empty room, for screenshots). */ alone?: boolean;
  /** `?seed=N`: the same script every time. */ seed?: number;
}

/** What the script needs of layout.json. */
export interface CafeLayout {
  door: { x: number; y: number; tile: [number, number] }; walk: string[]; cols: number;
  spots: { role: string; pose: string; face: string; x: number; y: number; tile: [number, number]; id?: string }[];
}

/** A small seeded random, so `?seed=` repeats a script. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** A feet point as the wire sends a place: the sprite's top left, in room points (two to an art pixel). */
const wire = ([fx, fy]: Pt): Pt => [Math.round((fx - 8) * 2), Math.round((fy - 31) * 2)];
const length = (pts: readonly Pt[]) => pts.reduce((n, p, i) => n + (i ? Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** The feet's way in: from the door to the chair's standing tile, then into the chair. Null when the chair cannot be reached. */
export function wayIn(grid: Grid, L: CafeLayout, seat: SeatDef): Pt[] | null {
  const walk = plan(grid, [L.door.x, L.door.y], L.spots[seat.spot!].tile);
  return walk ? [...walk, [seat.x + 8, seat.y + 31]] : null;
}
/** The way out: from the chair to its standing tile, along the floor, to the door. */
export function wayOut(grid: Grid, L: CafeLayout, seat: SeatDef): Pt[] | null {
  const tile = L.spots[seat.spot!].tile as Tile, start = centreOf(tile);
  const walk = plan(grid, start, L.door.tile);
  return walk ? [start, ...walk, [L.door.x, L.door.y]] : null;
}

export function cafeDemoDriver(o: CafeDemoOptions = {}): LibraryDriver {
  const world = new FakeLibraryWorld();
  const hub = new FakeRealtimeHub();
  const meAvatar = o.me && ANIMALS.some((a) => a.id === o.me) ? { ...ME_PERSON, body: o.me } : ME_PERSON;
  world.add(CAFE_ME, { nickname: "Quiet Otter", display: "You", colour: 1, avatar: meAvatar });
  const n = Math.max(6, Math.min(12, o.bots ?? 9));
  const cast = Array.from({ length: n }, (_, i) => {
    const animal = o.zoo ? ANIMALS[i % ANIMALS.length].id : i % 3 === 2 ? ANIMALS[(i * 2) % ANIMALS.length].id : null;
    return { id: uuid(10 + i), nickname: NICK[i % NICK.length], display: NAMES[i % NAMES.length], colour: 2 + (i % 6), avatar: animal ? { body: animal } : dressed(i + 3), subject: SUBJECTS[i % SUBJECTS.length] };
  });
  for (const c of cast) world.add(c.id, { nickname: c.nickname, display: c.display, colour: c.colour, avatar: c.avatar, streak: 2 + c.colour, level: 3 + c.colour });
  world.add(uuid(2), { nickname: "Kind Seal", display: "S", colour: 1 });

  return {
    social: world.social(CAFE_ME),
    realtime: () => hub.client(CAFE_ME),
    me: CAFE_ME,
    mine: { avatar: meAvatar, colour: 1 },
    scene() {
      // the browser checks reach into the scripted world; the demo page does not exist in production
      if (typeof window !== "undefined") (window as unknown as { __plumiDemo?: unknown }).__plumiDemo = { world, me: CAFE_ME, uuid };
      if (o.alone) return () => {};
      let dead = false;
      const timers = new Set<ReturnType<typeof setTimeout>>();
      const later = (fn: () => void, ms: number) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); };
      const rand = rng(o.seed ?? Math.floor(Math.random() * 1e9));
      const between = (a: number, b: number) => a + rand() * (b - a);
      // what the server says of each bot: listed or not, seated since when
      const st = cast.map(() => ({ listed: false, seated: false, since: null as number | null }));
      const sync = () => cast.forEach((c, i) => {
        const s = st[i];
        if (s.listed) world.place(c.id, 1, { seated: s.seated, subject: s.seated ? c.subject : null, focusSince: s.since });
        else world.students.get(c.id)!.shard = null;
      });
      const beat = setInterval(sync, BEAT_MS);
      {
        const L = layout as unknown as CafeLayout;
        const grid = gridOf(L.walk, L.cols);
        const here = new Set(reach(grid, L.door.tile));
        const seats = cafeSeats(L.spots).filter((s) => here.has(L.spots[s.spot!].tile[1] * L.cols + L.spots[s.spot!].tile[0]));
        const taken = new Set<number>();
        const bot = (id: string) => new FakeBot(hub.client(id), id, 1, `walk:lobby-1:${id}`);

        /** One bot's day: in (walking, or already there), sit, study, up, out, and back after a while. */
        const visit = (k: number, already: boolean) => {
          const c = cast[k], s = st[k];
          const free = seats.filter((q) => !taken.has(q.ipad!));
          const seat = free[Math.floor(rand() * free.length)];
          const inn = seat && wayIn(grid, L, seat), out = seat && wayOut(grid, L, seat);
          if (!seat || !inn || !out) { later(() => visit(k, false), 8000); return; }
          taken.add(seat.ipad!);
          const sitAt = (b: FakeBot) => b.at({ x: seat.x * 2, y: seat.y * 2, seat: seat.ipad, path: [] });
          const study = (b: FakeBot) => {
            s.listed = true; s.seated = true; s.since = Date.now() - Math.floor(between(1, 25) * 60_000); sync();
            sitAt(b);
            const again = setInterval(() => { if (!dead) sitAt(b); }, 2_000);     // often: the room only listens to someone once the list has named them
            timers.add(again as unknown as ReturnType<typeof setTimeout>);
            later(() => {
              clearInterval(again);
              s.seated = false; s.since = null; sync();
              b.at({ x: wire(out[0])[0], y: wire(out[0])[1], seat: null, path: out.slice(1).map(wire) });
              const gone = (length(out) / SPEED) * 1000 + 600;
              later(() => { b.leave(); taken.delete(seat.ipad!); s.listed = false; sync(); }, gone);
              later(() => visit(k, false), gone + between(6_000, 30_000));
            }, between(40_000, 150_000));
          };
          if (already) { study(bot(c.id)); return; }
          // listed now but out of sight; walks in LEAD_MS later
          s.listed = true; s.seated = false; s.since = null; sync();
          bot(c.id).leave();
          later(() => {
            const b = bot(c.id);
            b.at({ x: wire([L.door.x, L.door.y])[0], y: wire([L.door.x, L.door.y])[1], seat: null, path: inn.map(wire) });
            later(() => study(b), (length([[L.door.x, L.door.y], ...inn]) / SPEED) * 1000 + 1200);
          }, LEAD_MS);
        };
        // the first few are at their tables when the page opens; the rest come in over the next minute or so
        cast.forEach((_, k) => {
          if (k < Math.ceil(n / 2)) visit(k, true);
          else later(() => visit(k, false), (k - Math.floor(n / 2)) * between(3_000, 8_000));
        });
      }
      return () => { dead = true; clearInterval(beat); timers.forEach((t) => { clearTimeout(t); clearInterval(t as unknown as number); }); };
    },
  };
}
