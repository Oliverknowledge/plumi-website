import { IPAD_SEATS } from "./ipadSeats";
import { FakeBot, FakeLibraryWorld, FakeRealtimeHub } from "./fake";
import type { LibraryDriver } from "@/components/studyapp/library/driver";

/**
 * A scripted library for the dev-only page `/study/library/demo` and for screenshots: a room with students in it
 * that walk, sit, time themselves, wave and talk, with no Supabase project. It is the same room and the same
 * panel as the real page, driven by the fake server and Realtime hub of fake.ts. Never reachable in production.
 */

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const DEMO_ME = uuid(1);

const seat = (i: number) => ({ x: IPAD_SEATS[i][0], y: IPAD_SEATS[i][1], seat: i });
/** A tile of the ground floor's open row (y 34 in the layout's grid) as a sprite top-left on the wire: x = tile * 32, y = tile row * 32 - 38. */
const row = (tx: number, ty = 34) => ({ x: tx * 32, y: ty * 32 - 38 });

export function demoDriver(): LibraryDriver {
  const world = new FakeLibraryWorld();
  const hub = new FakeRealtimeHub();
  world.add(DEMO_ME, { nickname: "Quiet Otter", display: "You", colour: 1 });
  const cast = [
    { id: uuid(2), nickname: "Bold Fox", display: "Maya", colour: 2, friend: true, subject: "chemistry", seatIdx: 9, mins: 24 },
    { id: uuid(3), nickname: "Calm Heron", display: "Josh", colour: 3, friend: true, subject: null, seatIdx: null, mins: 0 },
    { id: uuid(4), nickname: "Brave Wren", display: "Wren", colour: 4, friend: false, subject: "physics", seatIdx: 22, mins: 12 },
    { id: uuid(5), nickname: "Golden Lark", display: "Lark", colour: 5, friend: false, subject: "maths", seatIdx: 36, mins: 47, pro: true },
    { id: uuid(6), nickname: "Merry Newt", display: "Newt", colour: 6, friend: false, subject: null, seatIdx: null, mins: 0 },
    { id: uuid(7), nickname: "Snowy Owl", display: "Owl", colour: 7, friend: false, subject: "biology", seatIdx: 49, mins: 5 },
  ];
  for (const c of cast) {
    world.add(c.id, { nickname: c.nickname, display: c.display, colour: c.colour, pro: c.pro ?? false, streak: 3 + c.colour * 2, level: 4 + c.colour });
    if (c.friend) world.befriend(DEMO_ME, c.id);
  }
  // another library with a few in it, for the picker
  for (let i = 0; i < 3; i++) { const id = uuid(20 + i); world.add(id, { nickname: ["Kind Seal", "Wise Hare", "Keen Lynx"][i], display: `S${i}` }); world.place(id, 2); }

  return {
    social: world.social(DEMO_ME),
    realtime: () => hub.client(DEMO_ME),
    me: DEMO_ME,
    scene() {
      const t0 = Date.now();
      const bots = new Map<string, FakeBot>();
      const timers: ReturnType<typeof setInterval>[] = [];
      const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms) as unknown as ReturnType<typeof setInterval>); };
      const walkers = cast.filter((c) => c.seatIdx === null);
      const state = new Map<string, { x: number; y: number; to: number; dir: 1 | -1 }>();
      cast.forEach((c, k) => {
        const bot = new FakeBot(hub.client(c.id), c.id, 1, `walk:lobby-1:${c.id}`);
        bots.set(c.id, bot);
        world.place(c.id, 1, { seated: c.seatIdx !== null, subject: c.subject, focusSince: c.seatIdx !== null ? t0 - c.mins * 60_000 : null });
        if (c.seatIdx !== null) later(() => bot.at({ ...seat(c.seatIdx!), path: [] }), 600 + k * 150);
      });
      walkers.forEach((c, k) => {
        const start = row(24 + k * 6);
        state.set(c.id, { ...start, to: 24 + k * 6, dir: k % 2 ? -1 : 1 });
      });
      // each beat: keep the server's rows fresh, and send each person's place on the floor (as the iPad's 10 second resend does)
      const beat = () => {
        for (const c of cast) world.place(c.id, 1, { seated: c.seatIdx !== null, subject: c.subject, focusSince: c.seatIdx !== null ? t0 - c.mins * 60_000 : null });
        for (const c of cast.filter((x) => x.seatIdx !== null)) bots.get(c.id)!.at({ ...seat(c.seatIdx!), path: [] });
        for (const id of [uuid(20), uuid(21), uuid(22)]) world.place(id, 2);
      };
      timers.push(setInterval(beat, 8000));
      // walkers: a leg along the open row every few seconds
      const leg = () => {
        for (const c of walkers) {
          const s = state.get(c.id)!;
          const next = Math.max(21, Math.min(43, s.to + s.dir * (5 + Math.floor(Math.random() * 8))));
          const dir: 1 | -1 = next >= 43 ? -1 : next <= 21 ? 1 : s.dir;
          bots.get(c.id)!.at({ x: s.x, y: s.y, seat: null, path: [[row(next).x, row(next).y]] });
          state.set(c.id, { ...row(next), to: next, dir });
        }
      };
      later(leg, 900);
      timers.push(setInterval(leg, 7000));
      // talk, and a wave
      const lines: [number, string][] = [
        [1, "anyone doing the paper 2 mock tomorrow?"], [2, "just finished q4, the last part was nasty"], [0, "good luck everyone"], [3, "40 minutes on maths then a break, join me"],
        [2, "does anyone get why the gradient is negative here?"], [1, "yes, think about the direction of the force"],
      ];
      let n = 0;
      const talk = () => { const [who, text] = lines[n++ % lines.length]; world.say(cast[who].id, 1, text); };
      later(talk, 1500); later(talk, 4000);
      timers.push(setInterval(talk, 14_000));
      const fox = world.students.get(cast[4].id)!;
      timers.push(setInterval(() => { fox.emote = "wave"; fox.emoteAt = Date.now(); }, 30_000));
      return () => { timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); bots.forEach((b) => b.leave()); };
    },
  };
}
