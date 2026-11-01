import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AppearanceSwitch } from "./AppearanceSwitch";
import {
  AppHeader, Avatar, Button, Card, Eyebrow, Legend, Logo, Mascot, MarkChip, PixelBlocks, PixelIcon, Says, Stat, StreakPill,
  SubjectCard, Tag, Tile, Tiles, WeekBars, type MarkState, type MasteryState, type PixelIconName,
} from "./ui";

/**
 * Six answers to "how is the dashboard framed?": where the five places live, what is pinned beside
 * them, and where the student's own character sits. Same parts as everywhere else. The student,
 * numbers and friends are placeholders for layout.
 *
 * The character is Plumi as the student's own. The sprites have no accessory layers yet, so "what it
 * is wearing" is a label next to the pose, not drawn on it.
 */

export const shells = [
  { id: "topbar", title: "Top bar", line: "Five places across the top. The character leads the greeting." },
  { id: "sidebar", title: "Sidebar", line: "A left sidebar with your character and today pinned at its foot." },
  { id: "rail", title: "Icon rail", line: "A slim rail of icons, subject tabs on top, the topic map in the middle." },
  { id: "panels", title: "Three column", line: "Sidebar, search bar and a right panel for your character and friends." },
  { id: "tabs", title: "Bottom tabs", line: "The phone shape: your character on top, five tabs below." },
  { id: "notebooks", title: "Notebooks side", line: "Five places on top, your subjects down the side." },
] as const;
export type ShellId = (typeof shells)[number]["id"];

const places: { id: string; label: string; icon: PixelIconName }[] = [
  { id: "multiplayer", label: "Multiplayer", icon: "gamepad" },
  { id: "subjects", label: "Subjects", icon: "book" },
  { id: "wardrobe", label: "Wardrobe", icon: "shirt" },
  { id: "insights", label: "Insights", icon: "chart" },
  { id: "settings", label: "Settings", icon: "gear" },
];

const g = (n: number) => ({ ["--gap" as string]: `${n}px` }) as CSSProperties;
const cols = (min: number) => ({ ["--min" as string]: `${min}px` }) as CSSProperties;

function sample(n: number, seed = 3): MasteryState[] {
  const order: MasteryState[] = ["notEnough", "strong", "developing", "strong", "rusty", "notEnough", "needsAttention", "developing", "strong", "notEnough"];
  return Array.from({ length: n }, (_, i) => order[(i * seed + (i >> 1)) % order.length]);
}

/* ── Navigation chromes ─────────────────────────────────────────────────── */
function SideNav({ current }: { current?: string }) {
  return (
    <nav className="st-side-nav" aria-label="Plumi">
      {places.map((p) => (
        <a key={p.id} href={`#${p.id}`} className="st-side-link" aria-current={current === p.id ? "page" : undefined}>
          <PixelIcon name={p.icon} size={24} />{p.label}
        </a>
      ))}
    </nav>
  );
}

function RailNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Plumi" style={{ display: "contents" }}>
      {places.map((p) => (
        <a key={p.id} href={`#${p.id}`} className="st-rail-link" title={p.label} aria-current={current === p.id ? "page" : undefined}>
          <PixelIcon name={p.icon} size={32} /><span>{p.label}</span>
        </a>
      ))}
    </nav>
  );
}

function TabNav({ current }: { current?: string }) {
  return (
    <nav className="st-tabbar" aria-label="Plumi">
      {places.map((p) => (
        <a key={p.id} href={`#${p.id}`} className="st-tab-link" aria-current={current === p.id ? "page" : undefined}>
          <PixelIcon name={p.icon} size={24} />{p.label}
        </a>
      ))}
    </nav>
  );
}

/* ── The character ──────────────────────────────────────────────────────── */
function Character({ height = 120, row, label = "Your Plumi" }: { height?: number; row?: boolean; label?: string }) {
  return (
    <div className={`st-character${row ? " st-character--row" : ""}`}>
      <Mascot pose="cool" height={height} />
      <div className="st-stack" style={{ ...g(2), alignItems: row ? "flex-start" : "center" }}>
        <span className="st-h4">{label}</span>
        <span className="st-wearing"><PixelIcon name="sun" size={16} />Wearing shades</span>
      </div>
    </div>
  );
}

/* ── Modules: the things a dashboard can show ───────────────────────────── */
const Greeting = ({ aside }: { aside?: ReactNode }) => (
  <div className="st-spread" style={{ alignItems: "flex-start" }}>
    <div className="st-stack" style={g(4)}>
      <h1 className="st-display">Evening, Alex.</h1>
      <p className="st-lead">The rain&rsquo;s on and the lamp&rsquo;s lit. Fancy 25 minutes on circular motion?</p>
    </div>
    {aside}
  </div>
);

const TodayCard = () => (
  <Card inner className="st-row" style={g(14) as CSSProperties}>
    <div><Eyebrow>Today</Eyebrow><span className="st-num-lg">42</span><span className="st-unit"> / 60 min</span></div>
    <PixelBlocks value={7} max={10} label="42 of 60 minutes studied today" />
  </Card>
);

const SessionCard = ({ says }: { says?: boolean }) => (
  <Card hero className="st-stack" style={g(14) as CSSProperties}>
    <div className={says ? "st-aside-row" : undefined}>
      <div className="st-stack" style={g(10)}>
        <div className="st-row" style={g(10)}><Eyebrow>Tonight&rsquo;s session</Eyebrow><Tag>A-Level Physics · AQA</Tag></div>
        <div className="st-hero-title">Circular motion</div>
        <div className="st-row" style={g(8)}><Tile large state="needsAttention" /><span className="st-h4">Needs attention</span></div>
        <p className="st-body" style={{ maxWidth: "46ch" }}>You dropped marks on centripetal force last week, so Plumi wrote three fresh questions on it.</p>
      </div>
      {says && <Says pose="thinking" stacked>Three quick ones? I&rsquo;ll mark every line.</Says>}
    </div>
    <div className="st-seg">
      <button className="st-chip" type="button" aria-pressed="false">10 min</button>
      <button className="st-chip" type="button" aria-pressed="true">25 min</button>
      <button className="st-chip" type="button" aria-pressed="false">45 min</button>
    </div>
    <div className="st-row" style={g(14)}><Button variant="primary">Start session</Button><Button>Do it in the study room</Button></div>
  </Card>
);

const RoomCard = () => (
  <Card className="st-stack" style={g(12) as CSSProperties}>
    <div><Tag kind="live">Live</Tag></div>
    <div className="st-h3">Study room</div>
    <p className="st-small">Physics Squad · 3 studying now</p>
    <div className="st-row" style={g(8)}><Avatar initial="A" tone="pink" /><Avatar initial="S" tone="yellow" /><Avatar initial="J" tone="green" /></div>
    <Button variant="friendly" block>Join the room</Button>
  </Card>
);

const Notebooks = ({ n = 4 }: { n?: number }) => (
  <>
    <div className="st-spread"><h2 className="st-h2">Your notebooks</h2><Legend /></div>
    <div className="st-grid" style={cols(250)}>
      {[
        <SubjectCard key="p" subject="physics" name="Physics" meta="A-Level · AQA" now="B" headedFor="A" goal="A*" tiles={sample(12)} />,
        <SubjectCard key="m" subject="maths" name="Maths" meta="A-Level · Edexcel" now="A" headedFor="A" goal="A*" tiles={sample(10, 5)} />,
        <SubjectCard key="c" subject="chemistry" name="Chemistry" meta="A-Level · OCR A" now="C" headedFor="B" goal="A" tiles={sample(9, 7)} />,
        <SubjectCard key="b" subject="biology" name="Biology" meta="GCSE · AQA" now="6" headedFor="7" goal="9" tiles={sample(10, 4)} />,
      ].slice(0, n)}
    </div>
  </>
);

const WeekCard = ({ height = 96 }: { height?: number }) => (
  <Card inner className="st-stack" style={g(10) as CSSProperties}>
    <Eyebrow>This week</Eyebrow>
    <WeekBars height={height} values={[0, 12, 25, 0, 40, 18, 6]} label="Minutes studied each day this week" />
  </Card>
);

const FriendsCard = () => (
  <Card inner className="st-stack" style={g(4) as CSSProperties}>
    <Eyebrow>In the room</Eyebrow>
    {[["S", "Sam", "Chemistry · 24 min", "yellow"], ["J", "Jo", "Physics · 12 min", "green"], ["A", "Ayo", "on a break", "pink"]].map(([i, n, note, tone]) => (
      <div key={n} className="st-friend">
        <Avatar initial={i} tone={tone as "pink" | "yellow" | "green"} />
        <div className="st-grow"><div className="st-friend-name">{n}</div><div className="st-friend-note">{note}</div></div>
      </div>
    ))}
  </Card>
);

const UpNext = () => (
  <Card inner className="st-stack" style={g(4) as CSSProperties}>
    <Eyebrow>Up next</Eyebrow>
    {[["Circular motion", "Q1 to Q3 · 25 min", "needsAttention"], ["Standing waves", "2 questions · 10 min", "rusty"], ["Integration by parts", "3 questions · 25 min", "developing"]].map(([t, note, s]) => (
      <div key={t} className="st-recent">
        <Tile large state={s as MasteryState} />
        <div className="st-grow"><div className="st-recent-title">{t}</div><div className="st-friend-note">{note}</div></div>
        <Button small variant="flat">Start</Button>
      </div>
    ))}
  </Card>
);

const marked: { t: string; note: string; chips: [string, MarkState][]; got: string }[] = [
  { t: "Circular motion Q2", note: "Physics · yesterday", chips: [["M1", "earned"], ["A1", "earned"], ["A0", "lost"]], got: "2" },
  { t: "Differentiation Q4", note: "Maths · 2 days ago", chips: [["M1", "earned"], ["M1", "earned"], ["A1", "earned"]], got: "3" },
  { t: "Titration Q1", note: "Chemistry · 3 days ago", chips: [["B1", "earned"], ["B1", "partial"], ["B0", "lost"]], got: "1" },
];
const RecentMarking = () => (
  <Card className="st-stack" style={g(4) as CSSProperties}>
    <div className="st-spread"><h2 className="st-h3">Recently marked</h2><Button small variant="flat">See all</Button></div>
    <div className="st-divided">
      {marked.map((m) => (
        <div key={m.t} className="st-recent">
          <div className="st-grow"><div className="st-recent-title">{m.t}</div><div className="st-friend-note">{m.note}</div></div>
          <div className="st-row" style={g(6)}>{m.chips.map(([c, s], i) => <MarkChip key={i} code={c} state={s} />)}</div>
          <span className="st-num-lg" style={{ fontSize: 20, minWidth: 28, textAlign: "right" }}>{m.got}<span className="st-unit"> / 3</span></span>
        </div>
      ))}
    </div>
  </Card>
);

const GoalCard = () => (
  <Card inner className="st-stack" style={g(10) as CSSProperties}>
    <div className="st-stats"><Stat label="Now" value="B" /><Stat label="Headed for" value="A" /><Stat label="Goal" value="A*" goal /></div>
    <PixelBlocks goal value={9} max={15} label="9 of 15 goal blocks" />
  </Card>
);

const mapGroups = [["Mechanics", 12], ["Circular motion", 8], ["Waves", 10], ["Fields", 14], ["Electricity", 11], ["Thermal", 7]] as const;
const TopicMap = () => (
  <Card className="st-stack" style={g(16) as CSSProperties}>
    <div className="st-spread"><h2 className="st-h2">Topic map</h2><Legend /></div>
    <div className="st-grid" style={{ ...cols(230), ["--gap" as string]: "16px 26px" } as CSSProperties}>
      {mapGroups.map(([name, n], gi) => (
        <div key={name} className="st-stack" style={g(6)}>
          <div className="st-h4">{name} <span className="st-unit">{n}</span></div>
          <Tiles large states={sample(n, gi + 2)} />
        </div>
      ))}
    </div>
  </Card>
);

const NextBar = () => (
  <Card className="st-spread" style={g(16) as CSSProperties}>
    <div className="st-stack" style={g(4)}>
      <Eyebrow>Do this next</Eyebrow>
      <div className="st-hero-title">Circular motion</div>
      <p className="st-small">You stopped on question 1 of 3 · Centripetal force</p>
    </div>
    <Button variant="primary">Pick it up</Button>
  </Card>
);

const SearchBox = () => (
  <div className="st-field"><PixelIcon name="search" size={16} /><input aria-label="Search" placeholder="Find a topic or a notebook" /></div>
);

/* ── The six shells ─────────────────────────────────────────────────────── */

/** 1. Top bar: the five places across the top; the character leads the greeting. */
function Topbar() {
  return (
    <div className="st-app st-app--top" style={{ display: "block" }}>
      <AppHeader
        nav={places.map((p) => ({ href: `#${p.id}`, label: p.label }))}
        end={<><StreakPill days={8} /><Avatar initial="A" /></>}
      />
      <main className="st-page st-stack" style={g(24)}>
        <Greeting aside={<div className="st-row" style={g(14)}><TodayCard /><Character height={96} /></div>} />
        <div className="st-split"><SessionCard says /><RoomCard /></div>
        <Notebooks />
      </main>
    </div>
  );
}

/** 2. Sidebar: your character and today are pinned at its foot, so every screen carries them. */
function Sidebar() {
  return (
    <div className="st-app st-app--side">
      <aside className="st-side">
        <Logo />
        <SideNav />
        <div className="st-side-extra">
          <Card inner className="st-stack" style={{ ...g(10), alignItems: "center" }}>
            <Character height={120} />
            <div className="st-row" style={g(8)}><PixelIcon name="flame" size={24} /><span className="st-num">8</span><span className="st-small">day streak</span></div>
          </Card>
          <div className="st-stack" style={g(6)}>
            <Eyebrow>Today · 42 / 60 min</Eyebrow>
            <PixelBlocks value={7} max={10} label="42 of 60 minutes studied today" />
          </div>
        </div>
      </aside>
      <main className="st-page st-stack" style={g(24)}>
        <Greeting />
        <SessionCard />
        <div className="st-split"><UpNext /><WeekCard height={120} /></div>
        <Notebooks n={3} />
      </main>
    </div>
  );
}

/** 3. Icon rail: nothing but icons at the edge, your portrait on top, the map gets the room. */
function Rail() {
  return (
    <div className="st-app st-app--rail">
      <aside className="st-rail" aria-label="Plumi">
        <a href="#home" aria-label="Plumi, home" className="st-portrait"><Mascot pose="cool" height={56} /></a>
        <RailNav current="subjects" />
        <div className="st-rail-gap" />
        <span className="st-rail-streak" aria-label="8 day streak"><PixelIcon name="flame" size={24} /><span className="st-num">8</span></span>
      </aside>
      <div className="st-col">
        <div className="st-topbar">
          <div className="st-tabs" role="tablist" aria-label="Subject">
            {(["physics", "maths", "chemistry", "biology"] as const).map((s, i) => (
              <span key={s} className="st-tab" role="tab" aria-selected={i === 0} tabIndex={0}>
                <span className="st-swatch" data-subject={s} aria-hidden="true" />{s[0].toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
          <div className="st-topbar-end"><Tag>A-Level · AQA</Tag><Avatar initial="A" /></div>
        </div>
        <main className="st-page st-stack" style={g(20)}>
          <NextBar />
          <div className="st-main3">
            <TopicMap />
            <div className="st-stack" style={g(20)}>
              <Card inner><Says pose="encouraging" height={64}>Strong on mechanics. Circular motion needs a look.</Says></Card>
              <GoalCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/** 4. Three column: sidebar, a search bar, a feed in the middle, and your character and friends on the right. */
function Panels() {
  return (
    <div className="st-app st-app--panels">
      <aside className="st-side">
        <Logo />
        <SideNav />
        <div className="st-side-extra">
          <Button variant="go" block icon="arrowRight">Join the room</Button>
        </div>
      </aside>
      <div className="st-col">
        <div className="st-topbar">
          <SearchBox />
          <div className="st-topbar-end"><StreakPill days={8} /><Avatar initial="A" /></div>
        </div>
        <main className="st-page st-main3">
          <div className="st-stack" style={g(20)}>
            <Greeting />
            <SessionCard />
            <RecentMarking />
          </div>
          <div className="st-stack" style={g(20)}>
            <Card className="st-stack" style={{ ...g(10), alignItems: "center" }}>
              <Character height={140} />
              <Button small block icon="shirt">Change what it wears</Button>
            </Card>
            <FriendsCard />
            <TodayCard />
            <WeekCard />
          </div>
        </main>
      </div>
    </div>
  );
}

/** 5. Bottom tabs: the phone shape. Your character is the header; the five places are thumb height. */
function Tabs() {
  return (
    <div className="st-phone">
      <div className="st-phone-body">
        <div className="st-spread">
          <StreakPill days={8} />
          <Avatar initial="A" />
        </div>
        <Card className="st-stack" style={{ ...g(6), alignItems: "center", textAlign: "center" } as CSSProperties}>
          <Says pose="cool" stacked center height={120}>Evening, Alex. 25 minutes on circular motion?</Says>
          <span className="st-wearing"><PixelIcon name="sun" size={16} />Wearing shades</span>
        </Card>
        <Card inner className="st-stack" style={g(10) as CSSProperties}>
          <Eyebrow>Tonight</Eyebrow>
          <div className="st-h3">Circular motion</div>
          <div className="st-row" style={g(8)}><Tile large state="needsAttention" /><span className="st-h4">Needs attention</span></div>
          <Button variant="primary" block>Start session</Button>
        </Card>
        <TodayCard />
        <div className="st-row" style={g(8)}>
          <span className="st-eyebrow">Room</span><Tag kind="live">3 studying</Tag>
          <Avatar initial="S" tone="yellow" /><Avatar initial="J" tone="green" />
        </div>
      </div>
      <TabNav />
    </div>
  );
}

/** 6. Notebooks side: the five places across the top, your subjects down the side, one open. */
function NotebooksShell() {
  const rows = [
    { s: "physics", n: "Physics", m: "A-Level · AQA", t: sample(5) },
    { s: "maths", n: "Maths", m: "A-Level · Edexcel", t: sample(5, 5) },
    { s: "chemistry", n: "Chemistry", m: "A-Level · OCR A", t: sample(5, 7) },
    { s: "biology", n: "Biology", m: "GCSE · AQA", t: sample(5, 4) },
  ];
  return (
    <div className="st-app st-app--subjects">
      <AppHeader nav={places.map((p) => ({ href: `#${p.id}`, label: p.label }))} current="#subjects" end={<><StreakPill days={8} /><Avatar initial="A" /></>} />
      <div className="st-app-body">
        <aside className="st-subnav" aria-label="Your notebooks">
          <Eyebrow>Your notebooks</Eyebrow>
          {rows.map((r, i) => (
            <a key={r.s} href={`#${r.s}`} className="st-subrow" aria-current={i === 0 ? "page" : undefined}>
              <span className="st-subrow-top"><span className="st-swatch" data-subject={r.s} aria-hidden="true" /><span className="st-h4">{r.n}</span></span>
              <span className="st-friend-note">{r.m}</span>
              <Tiles states={r.t} />
            </a>
          ))}
          <Button variant="ghost" icon="plus" block>Add a subject</Button>
          <div className="st-side-extra">
            <Card inner><Character height={88} row /></Card>
          </div>
        </aside>
        <main className="st-page st-stack" style={g(20)}>
          <div className="st-spread"><h1 className="st-display">Physics</h1><Tag>A-Level · AQA</Tag></div>
          <NextBar />
          <div className="st-main3">
            <div className="st-stack" style={g(20)}><TopicMap /></div>
            <div className="st-stack" style={g(20)}>
              <GoalCard />
              <Card inner className="st-stack" style={g(8) as CSSProperties}>
                <h3 className="st-h3">Past papers</h3>
                <p className="st-small">Add your own and Plumi marks it.</p>
                <div className="st-row" style={g(8)}><Button small variant="flat">Upload a PDF</Button><Button small variant="flat">Sat one on paper</Button></div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export const shellViews: Record<ShellId, () => ReactNode> = {
  topbar: Topbar, sidebar: Sidebar, rail: Rail, panels: Panels, tabs: Tabs, notebooks: NotebooksShell,
};

/** The bar above a shell exploration: not part of the product. */
export function ShellBar({ id }: { id: ShellId }) {
  return (
    <>
      <div className="st-variantbar">
        <Eyebrow>Dashboard shells</Eyebrow>
        <nav className="st-seg" aria-label="Shell">
          {shells.map((s) => (
            <Link key={s.id} className="st-chip st-chip--sm" href={`/study/shells/${s.id}`} aria-current={s.id === id ? "page" : undefined}>{s.title}</Link>
          ))}
        </nav>
        <div style={{ marginLeft: "auto" }}><AppearanceSwitch /></div>
      </div>
      <div className="st-small" style={{ padding: "10px var(--st-gutter)" }}>{shells.find((s) => s.id === id)?.line}</div>
    </>
  );
}
