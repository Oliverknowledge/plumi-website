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

/** You, dressed on the iPad: blue hair (a hairstyle the web does not give out), a shirt, red headphones, and Pro. */
const ME_AVATAR: Record<string, string> = { body: "03", eyes: "02", outfit: "12_03", hair: "29_04", acc: "none", phones: "red", pro: "1", feather: "blue", top: "hoodie", colour: "#7cc6c2", hat: "headphones", hat_colour: "#e0605a", glasses: "none" };
/** Who else is here, dressed: a different person each, one with only the old keys, some with none at all (drawn from their id). */
const AVATARS: Record<number, Record<string, string>> = {
  2: { body: "05", eyes: "03", outfit: "04_02", hair: "06_03", acc: "15_glasses_01", phones: "teal" },
  3: { body: "01", eyes: "05", outfit: "24_01", hair: "19_04", acc: "none", phones: "none" },
  4: { body: "07", eyes: "01", outfit: "02_01", hair: "12_06", acc: "none", phones: "lilac" },
  5: { body: "04", eyes: "06", outfit: "10_02", hair: "05_01", acc: "none", phones: "cream", pro: "1" },
  7: { feather: "pink", top: "hoodie", colour: "#5a86bf", hat: "none", glasses: "round" },
};

/** What the demo adds, for the browser checks (`?people=40&friends=30`, `?friends=none`): more strangers on the floor, more friends, or none at all. */
export interface DemoOptions { people?: number; friends?: number | "none" }

const ADJ = ["Quiet", "Brave", "Bright", "Calm", "Clever", "Cosy", "Eager", "Gentle", "Happy", "Jolly", "Keen", "Kind", "Lucky", "Merry", "Mighty", "Nimble", "Plucky", "Proud", "Rapid", "Sunny"];
const ANIMAL = ["Badger", "Falcon", "Finch", "Gecko", "Hedgehog", "Ibis", "Jackal", "Koala", "Lemur", "Magpie", "Narwhal", "Ocelot", "Puffin", "Quokka", "Robin", "Stoat", "Tapir", "Urchin", "Vole", "Walrus"];
const FIRST = ["Ada", "Ben", "Cleo", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jess", "Kit", "Lena", "Milo", "Nia", "Omar", "Pia", "Quinn", "Rafi", "Sade", "Tom"];
const pad2 = (n: number) => String(n).padStart(2, "0");
/** A dressed person for the n-th extra student: some with no person keys at all, so the derived look is drawn too. */
const dressed = (n: number): Record<string, string> | null => n % 5 === 4 ? null : ({
  body: pad2(1 + (n % 7)), eyes: pad2(1 + ((n * 3) % 7)), outfit: `${pad2(1 + ((n * 7) % 30))}_0${1 + (n % 3)}`, hair: `${pad2(1 + ((n * 5) % 29))}_0${1 + (n % 4)}`,
  acc: n % 6 === 0 ? "15_glasses_01" : "none", phones: ["none", "teal", "red", "lilac"][n % 4],
});

export function demoDriver(o: DemoOptions = {}): LibraryDriver {
  const world = new FakeLibraryWorld();
  const hub = new FakeRealtimeHub();
  world.add(DEMO_ME, { nickname: "Quiet Otter", display: "You", colour: 1, avatar: ME_AVATAR });
  const cast = [
    { id: uuid(2), nickname: "Bold Fox", display: "Maya", colour: 2, friend: true, subject: "chemistry", seatIdx: 9, mins: 24 },
    { id: uuid(3), nickname: "Calm Heron", display: "Josh", colour: 3, friend: true, subject: null, seatIdx: null, mins: 0 },
    { id: uuid(4), nickname: "Brave Wren", display: "Wren", colour: 4, friend: false, subject: "physics", seatIdx: 22, mins: 12 },
    { id: uuid(5), nickname: "Golden Lark", display: "Lark", colour: 5, friend: false, subject: "maths", seatIdx: 36, mins: 47, pro: true },
    { id: uuid(6), nickname: "Merry Newt", display: "Newt", colour: 6, friend: false, subject: null, seatIdx: null, mins: 0 },
    { id: uuid(7), nickname: "Snowy Owl", display: "Owl", colour: 7, friend: false, subject: "biology", seatIdx: 49, mins: 5 },
  ];
  const noFriends = o.friends === "none";
  for (const c of cast) {
    world.add(c.id, { nickname: c.nickname, display: c.display, colour: c.colour, pro: c.pro ?? false, avatar: AVATARS[Number(c.id.slice(-2))] ?? null, streak: 3 + c.colour * 2, level: 4 + c.colour });
    if (c.friend && !noFriends) world.befriend(DEMO_ME, c.id);
  }
  // friends who are not in this library: one studying Maths somewhere else, the rest quiet (nothing is said of them)
  const away = [
    { id: uuid(30), nickname: "Rosy Finch", display: "Priya", colour: 5, streak: 12, avatar: dressed(3), studying: "maths" },
    { id: uuid(31), nickname: "Keen Gecko", display: "Sam", colour: 0, streak: 0, avatar: null, studying: null },
    { id: uuid(32), nickname: "Wise Ibis", display: "Ava", colour: 6, streak: 31, avatar: dressed(8), studying: null },
  ];
  for (const f of away) {
    world.add(f.id, { nickname: f.nickname, display: f.display, colour: f.colour, streak: f.streak, avatar: f.avatar, level: 6 });
    if (!noFriends) { world.befriend(DEMO_ME, f.id); if (f.studying) world.studying(f.id, f.studying, 40); }
  }
  // two requests waiting: one by friend code (a name), one made in a library (a nickname and nothing else)
  world.add(uuid(40), { nickname: "Swift Hare", display: "Dana", colour: 2, streak: 4, avatar: dressed(11) });
  world.add(uuid(41), { nickname: "Gentle Panda", display: "Gentle Panda Real", colour: 4, streak: 9, avatar: dressed(14), level: 5 });
  if (!noFriends) { world.plainAsk(uuid(40), DEMO_ME); world.libraryAsk(uuid(41), DEMO_ME); }
  // a crowd, for the scrolling checks: more strangers on the floor, and more friends (a third in the library, a third studying elsewhere)
  const crowd: string[] = [];
  for (let i = 0; i < (o.people ?? 0); i++) {
    const id = uuid(100 + i);
    world.add(id, { nickname: `${ADJ[i % ADJ.length]} ${ANIMAL[Math.floor(i / ADJ.length) % ANIMAL.length]}`, display: `Real Name ${i}`, colour: i % 8, avatar: dressed(i + 20), streak: i % 9, level: 1 + (i % 12), pro: i % 11 === 0 });
    crowd.push(id);
  }
  const more: { id: string; here: boolean }[] = [];
  for (let i = 0; !noFriends && i < (typeof o.friends === "number" ? o.friends : 0); i++) {
    const id = uuid(200 + i);
    world.add(id, { nickname: `${ADJ[(i + 7) % ADJ.length]} ${ANIMAL[(i + 3) % ANIMAL.length]}`, display: `${FIRST[i % FIRST.length]}${i >= FIRST.length ? ` ${ANIMAL[i % ANIMAL.length]}` : ""}`, colour: i % 8, avatar: dressed(i + 60), streak: i % 4 === 0 ? 0 : i, level: 2 });
    world.befriend(DEMO_ME, id);
    if (i % 3 === 1) world.studying(id, ["physics", "chemistry", "biology"][i % 3], 30);
    more.push({ id, here: i % 3 === 0 });
  }
  // another library with a few in it, for the picker
  for (let i = 0; i < 3; i++) { const id = uuid(20 + i); world.add(id, { nickname: ["Kind Seal", "Wise Hare", "Keen Lynx"][i], display: `S${i}` }); world.place(id, 2); }

  return {
    social: world.social(DEMO_ME),
    realtime: () => hub.client(DEMO_ME),
    me: DEMO_ME,
    mine: { avatar: ME_AVATAR, colour: 1 },
    scene() {
      // the browser checks reach into the scripted world (to make a friend sit down, say); the demo page does not exist in production
      if (typeof window !== "undefined") (window as unknown as { __plumiDemo?: unknown }).__plumiDemo = { world, me: DEMO_ME, uuid };
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
      const SUBJECTS = ["maths", "physics", "biology"];
      const placeExtras = () => {
        crowd.forEach((id, i) => world.place(id, 1, { seated: i % 3 !== 0, subject: i % 3 === 1 ? SUBJECTS[i % SUBJECTS.length] : null, focusSince: i % 3 === 1 ? t0 - (5 + (i % 40)) * 60_000 : null }));
        more.forEach((f, i) => { if (f.here) world.place(f.id, 1, { seated: i % 2 === 0, subject: i % 2 === 0 ? "chemistry" : null, focusSince: i % 2 === 0 ? t0 - (3 + i) * 60_000 : null }); });
      };
      placeExtras();
      // each beat: keep the server's rows fresh, and send each person's place on the floor (as the iPad's 10 second resend does)
      const beat = () => {
        for (const c of cast) world.place(c.id, 1, { seated: c.seatIdx !== null, subject: c.subject, focusSince: c.seatIdx !== null ? t0 - c.mins * 60_000 : null });
        for (const c of cast.filter((x) => x.seatIdx !== null)) bots.get(c.id)!.at({ ...seat(c.seatIdx!), path: [] });
        for (const id of [uuid(20), uuid(21), uuid(22)]) world.place(id, 2);
        placeExtras();
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
