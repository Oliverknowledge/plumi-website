import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AppearanceSwitch } from "./AppearanceSwitch";
import {
  AppHeader, Avatar, Button, Card, Eyebrow, Legend, Mascot, PixelBlocks, PixelIcon, Says, Stat, StreakPill,
  SubjectCard, Tag, Tile, Tiles, WeekBars, type MasteryState, type PixelIconName, type MascotPose,
} from "./ui";

/**
 * Five answers to "what is the first screen?", all drawn from the same parts. The sample
 * student, subjects and numbers are placeholders for layout; nothing here is real data.
 */

export const variants = [
  { id: "desk", title: "Desk", line: "Tonight's session, the room, your notebooks." },
  { id: "focus", title: "Focus", line: "One thing only." },
  { id: "map", title: "Map", line: "The topic map leads." },
  { id: "squad", title: "Squad", line: "Multiplayer leads." },
  { id: "wardrobe", title: "Wardrobe", line: "Plumi leads." },
] as const;
export type VariantId = (typeof variants)[number]["id"];

/** The five places. Three open a variation that shows them; the other two are not drawn yet. */
export const dashNav = [
  { href: "/study/dashboards/squad", label: "Multiplayer" },
  { href: "/study/dashboards/map", label: "Subjects" },
  { href: "/study/dashboards/wardrobe", label: "Wardrobe" },
  { href: "#insights", label: "Insights" },
  { href: "#settings", label: "Settings" },
] as const;

const g = (n: number) => ({ ["--gap" as string]: `${n}px` }) as CSSProperties;
const cols = (min: number) => ({ ["--min" as string]: `${min}px` }) as CSSProperties;

/** A repeatable, plausible mix of states, for sample squares. */
function sample(n: number, seed = 3): MasteryState[] {
  const order: MasteryState[] = ["notEnough", "strong", "developing", "strong", "rusty", "notEnough", "needsAttention", "developing", "strong", "notEnough"];
  return Array.from({ length: n }, (_, i) => order[(i * seed + (i >> 1)) % order.length]);
}

function Frame({ id, current, children }: { id: VariantId; current?: string; children: ReactNode }) {
  return (
    <>
      <div className="st-variantbar">
        <Eyebrow>Dashboard variations</Eyebrow>
        <nav className="st-seg" aria-label="Variation">
          {variants.map((v) => (
            <Link key={v.id} className="st-chip st-chip--sm" href={`/study/dashboards/${v.id}`} aria-current={v.id === id ? "page" : undefined}>{v.title}</Link>
          ))}
        </nav>
        <div style={{ marginLeft: "auto" }}><AppearanceSwitch /></div>
      </div>
      <AppHeader nav={dashNav} current={current} end={<><StreakPill days={8} /><Avatar initial="A" /></>} />
      <main id="main" className="st-page st-stack" style={g(24)}>{children}</main>
    </>
  );
}

const greeting = (
  <div className="st-stack" style={g(4)}>
    <h1 className="st-display">Evening, Alex.</h1>
    <p className="st-lead">The rain&rsquo;s on and the lamp&rsquo;s lit. Fancy 25 minutes on circular motion?</p>
  </div>
);

const todayCard = (
  <Card inner className="st-row" style={g(14) as CSSProperties}>
    <div><Eyebrow>Today</Eyebrow><span className="st-num-lg">42</span><span className="st-unit"> / 60 min</span></div>
    <PixelBlocks value={7} max={10} label="42 of 60 minutes studied today" />
  </Card>
);

/* 1 ─ Desk: the home of the iPad app, with the new places. */
function Desk() {
  return (
    <Frame id="desk">
      <div className="st-spread" style={{ alignItems: "flex-start" }}>{greeting}{todayCard}</div>
      <div className="st-split">
        <Card hero className="st-stack" style={g(14) as CSSProperties}>
          <div className="st-aside-row">
            <div className="st-stack" style={g(10)}>
              <div className="st-row" style={g(10)}><Eyebrow>Tonight&rsquo;s session</Eyebrow><Tag>A-Level Physics · AQA</Tag></div>
              <div className="st-hero-title">Circular motion</div>
              <div className="st-row" style={g(8)}><Tile large state="needsAttention" /><span className="st-h4">Needs attention</span></div>
              <p className="st-body" style={{ maxWidth: "46ch" }}>You dropped marks on centripetal force last week, so Plumi wrote three fresh exam-style questions on it, diagrams included.</p>
            </div>
            <Says pose="thinking" stacked>Circular motion&rsquo;s been a bit rusty. Three quick ones? I&rsquo;ll mark every line.</Says>
          </div>
          <div className="st-seg">
            <button className="st-chip" type="button" aria-pressed="false">10 min</button>
            <button className="st-chip" type="button" aria-pressed="true">25 min</button>
            <button className="st-chip" type="button" aria-pressed="false">45 min</button>
          </div>
          <div className="st-row" style={g(14)}><Button variant="primary">Start session</Button><Button>Do it in the study room</Button></div>
        </Card>
        <Card className="st-stack" style={g(12) as CSSProperties}>
          <div><Tag kind="live">Live</Tag></div>
          <div className="st-h3">Study room</div>
          <p className="st-small">Physics Squad · 3 studying now</p>
          <div className="st-row" style={g(8)}><Avatar initial="A" tone="pink" /><Avatar initial="S" tone="yellow" /><Avatar initial="J" tone="green" /></div>
          <Button variant="friendly" block>Join the room</Button>
        </Card>
      </div>
      <div className="st-spread"><h2 className="st-h2">Your notebooks</h2><Legend /></div>
      <div className="st-grid" style={cols(250)}>
        <SubjectCard subject="physics" name="Physics" meta="A-Level · AQA" now="B" headedFor="A" goal="A*" tiles={sample(12)} />
        <SubjectCard subject="maths" name="Maths" meta="A-Level · Edexcel" now="A" headedFor="A" goal="A*" tiles={sample(10, 5)} />
        <SubjectCard subject="chemistry" name="Chemistry" meta="A-Level · OCR A" now="C" headedFor="B" goal="A" tiles={sample(9, 7)} />
        <SubjectCard subject="biology" name="Biology" meta="GCSE · AQA" now="6" headedFor="7" goal="9" tiles={sample(10, 4)} />
      </div>
    </Frame>
  );
}

/* 2 ─ Focus: the whole screen is one decision. */
function Focus() {
  return (
    <Frame id="focus">
      <div className="st-solo st-stack" style={g(20)}>
        <div className="st-stack" style={{ ...g(4), textAlign: "center" }}>
          <Eyebrow>Tonight</Eyebrow>
          <h1 className="st-display">Circular motion</h1>
        </div>
        <Card hero className="st-stack" style={{ ...g(18), alignItems: "center", textAlign: "center" } as CSSProperties}>
          <Mascot pose="focused" height={120} />
          <div className="st-num-xl" aria-label="25 minutes">25:00</div>
          <div className="st-seg" role="group" aria-label="Session length" style={{ justifyContent: "center" }}>
            <button className="st-chip" type="button" aria-pressed="false">10 min</button>
            <button className="st-chip" type="button" aria-pressed="true">25 min</button>
            <button className="st-chip" type="button" aria-pressed="false">45 min</button>
          </div>
          <Button variant="primary" block>Start session</Button>
          <p className="st-small">Three questions, marked line by line.</p>
        </Card>
        <div className="st-row" style={{ ...g(14), justifyContent: "center" }}>
          <PixelBlocks value={7} max={10} label="42 of 60 minutes studied today" />
          <span className="st-small">42 / 60 min today</span>
        </div>
      </div>
    </Frame>
  );
}

/* 3 ─ Map: Subjects. The topic map is the dashboard. */
const mapGroups = [
  ["Mechanics", 12], ["Circular motion", 8], ["Waves", 10], ["Fields", 14], ["Electricity", 11], ["Thermal", 7], ["Nuclear", 9], ["Materials", 6],
] as const;

function MapView() {
  return (
    <Frame id="map" current="/study/dashboards/map">
      <div className="st-spread">
        <div className="st-tabs" role="tablist" aria-label="Subject">
          {(["physics", "maths", "chemistry", "biology"] as const).map((s, i) => (
            <span key={s} className="st-tab" role="tab" aria-selected={i === 0} tabIndex={0}>
              <span className="st-swatch" data-subject={s} aria-hidden="true" />{s[0].toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
        <Tag>A-Level · AQA</Tag>
      </div>
      <Card className="st-spread" style={g(16) as CSSProperties}>
        <div className="st-stack" style={g(4)}>
          <Eyebrow>Do this next</Eyebrow>
          <div className="st-hero-title">Circular motion</div>
          <p className="st-small">You stopped on question 1 of 3 · Centripetal force</p>
        </div>
        <Button variant="primary">Pick it up</Button>
      </Card>
      <div className="st-split">
        <Card className="st-stack" style={g(18) as CSSProperties}>
          <div className="st-spread"><h2 className="st-h2">Topic map</h2><Legend /></div>
          <div className="st-grid" style={{ ...cols(240), ["--gap" as string]: "18px 28px" } as CSSProperties}>
            {mapGroups.map(([name, n], gi) => (
              <div key={name} className="st-stack" style={g(6)}>
                <div className="st-h4">{name} <span className="st-unit">{n}</span></div>
                <Tiles large states={sample(n, gi + 2)} />
              </div>
            ))}
          </div>
        </Card>
        <div className="st-stack" style={g(20)}>
          <Card inner className="st-stack" style={g(10) as CSSProperties}>
            <Eyebrow>Where you stand</Eyebrow>
            <div className="st-says"><Mascot pose="encouraging" height={64} /><p className="st-body" style={{ fontWeight: 700 }}>Strong on mechanics. Circular motion needs a look.</p></div>
            <Button variant="friendly" block>Find your level · 10 min</Button>
          </Card>
          <Card inner className="st-stack" style={g(12) as CSSProperties}>
            <div className="st-stats"><Stat label="Now" value="B" /><Stat label="Headed for" value="A" /><Stat label="Goal" value="A*" goal /></div>
            <PixelBlocks goal value={9} max={15} label="9 of 15 goal blocks" />
          </Card>
          <Card inner className="st-stack" style={g(10) as CSSProperties}>
            <h3 className="st-h3">Past papers</h3>
            <p className="st-small">Add your own and Plumi marks it.</p>
            <div className="st-row" style={g(8)}><Button small variant="flat">Upload a PDF</Button><Button small variant="flat">Sat one on paper</Button></div>
          </Card>
        </div>
      </div>
    </Frame>
  );
}

/* 4 ─ Squad: Multiplayer. The room and the people in it lead. */
const friends: { name: string; note: string; tone?: "pink" | "yellow" | "green"; initial: string; live?: boolean }[] = [
  { name: "Sam", note: "Chemistry · 24 min", tone: "yellow", initial: "S", live: true },
  { name: "Jo", note: "Physics · 12 min", tone: "green", initial: "J", live: true },
  { name: "Ayo", note: "on a break", tone: "pink", initial: "A" },
];

function Squad() {
  return (
    <Frame id="squad" current="/study/dashboards/squad">
      <div className="st-spread" style={{ alignItems: "flex-start" }}>
        <div className="st-stack" style={g(4)}>
          <h1 className="st-display">Physics Squad</h1>
          <p className="st-lead">3 studying now. Join them, the kettle&rsquo;s on.</p>
        </div>
        <Button variant="go" icon="arrowRight">Join the room</Button>
      </div>
      <div className="st-split">
        <Card hero className="st-stack" style={g(18) as CSSProperties}>
          <div className="st-spread"><div className="st-row" style={g(10)}><Tag kind="live">Live</Tag><span className="st-h3">The room</span></div><Tag kind="count">Round 2 of 4</Tag></div>
          <div className="st-row" style={{ ...g(24), alignItems: "flex-end" }}>
            <Mascot pose="idle" height={120} animate />
            <div className="st-num-xl" aria-label="Twelve minutes left">12:40</div>
          </div>
          <div className="st-eyebrow">Squad goal today</div>
          <PixelBlocks goal value={11} max={15} label="11 of 15 squad goal blocks" />
          <div className="st-divided">
            {[["Circular motion Q1", true], ["Circular motion Q2", true], ["Circular motion Q3", false]].map(([t, done]) => (
              <div key={t as string} className={`st-task${done ? " is-done" : ""}`}>
                <span className={`st-box${done ? " is-on" : ""}`}>{done && <PixelIcon name="check" size={16} />}</span>
                <span>{t as string}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="st-stack" style={g(20)}>
          <Card inner className="st-stack" style={g(6) as CSSProperties}>
            <Eyebrow>In the room</Eyebrow>
            {friends.map((f) => (
              <div key={f.name} className="st-friend">
                <Avatar initial={f.initial} tone={f.tone} />
                <div className="st-grow"><div className="st-friend-name">{f.name}</div><div className="st-friend-note">{f.note}</div></div>
                {f.live && <Tile state="strong" />}
              </div>
            ))}
          </Card>
          <Card inner className="st-stack" style={g(10) as CSSProperties}>
            <Eyebrow>Minutes this week</Eyebrow>
            <WeekBars height={84} values={[20, 35, 0, 50, 28, 62, 14]} label="Squad minutes each day this week" />
          </Card>
          <Card inner className="st-stack" style={g(8) as CSSProperties}>
            <Eyebrow>Invite a friend</Eyebrow>
            <div className="st-field st-field--code"><input aria-label="Invite code" readOnly value="PLUMI7" /></div>
            <Button variant="friendly" small block icon="plus">Start a group</Button>
          </Card>
        </div>
      </div>
    </Frame>
  );
}

/* 5 ─ Wardrobe: Plumi leads; what you have earned is what it wears. */
const slots: { id: string; label: string; icon: PixelIconName; tint: string; state: "worn" | "owned" | "locked"; how?: string }[] = [
  { id: "shades", label: "Shades", icon: "sun", tint: "var(--st-yellow)", state: "worn" },
  { id: "nightcap", label: "Night cap", icon: "moon", tint: "var(--st-key-blue)", state: "owned" },
  { id: "scarf", label: "Scarf", icon: "star", tint: "var(--st-pink)", state: "owned" },
  { id: "pencil", label: "Pencil", icon: "pencil", tint: "var(--st-mint)", state: "owned" },
  { id: "book", label: "Stack of books", icon: "book", tint: "var(--st-key-green)", state: "locked", how: "10 day streak" },
  { id: "lamp", label: "Desk lamp", icon: "home", tint: "var(--st-teal)", state: "locked", how: "20 hours" },
];

function Wardrobe() {
  const pose: MascotPose = "cool";
  return (
    <Frame id="wardrobe" current="/study/dashboards/wardrobe">
      <div className="st-split">
        <Card hero className="st-stack" style={{ ...g(16), alignItems: "center", textAlign: "center" } as CSSProperties}>
          <Eyebrow>Plumi, today</Eyebrow>
          <Mascot pose={pose} height={200} />
          <Says pose="proud" height={40}>Eight days in a row. Shades earned.</Says>
          <div className="st-row" style={{ ...g(10), justifyContent: "center" }}><Button variant="primary">Save</Button><Button>Undo</Button></div>
        </Card>
        <div className="st-stack" style={g(20)}>
          <Card className="st-stack" style={g(14) as CSSProperties}>
            <div className="st-spread"><h2 className="st-h2">Wardrobe</h2><Tag kind="count">4 of 6</Tag></div>
            <div className="st-row" style={g(12)}>
              {slots.map((s) => (
                <button key={s.id} type="button" className={`st-slot${s.state === "locked" ? " st-slot--locked" : ""}`} aria-pressed={s.state === "worn"} aria-disabled={s.state === "locked"} aria-label={`${s.label}${s.state === "locked" ? `, unlocks at ${s.how}` : s.state === "worn" ? ", worn" : ""}`}>
                  <span className="st-slot-tint" style={{ ["--tint" as string]: s.tint }}><PixelIcon name={s.state === "locked" ? "lock" : s.icon} size={24} /></span>
                  <span>{s.label}</span>
                  {s.how && <span className="st-friend-note">{s.how}</span>}
                </button>
              ))}
            </div>
          </Card>
          <Card inner className="st-stack" style={g(10) as CSSProperties}>
            <Eyebrow>Next unlock</Eyebrow>
            <div className="st-row" style={g(12)}><span className="st-slot-tint" style={{ ["--tint" as string]: "var(--st-key-green)" }}><PixelIcon name="book" size={24} /></span><div className="st-grow"><div className="st-h4">Stack of books</div><div className="st-friend-note">2 more days of studying</div></div></div>
            <PixelBlocks goal value={8} max={10} label="8 of 10 streak days" />
          </Card>
          <Card inner className="st-stats">
            <Stat label="Streak" value="8" unit="days" />
            <Stat label="Studied" value="14" unit="hours" />
            <Stat label="Topics" value="14" unit="/ 94" />
          </Card>
        </div>
      </div>
    </Frame>
  );
}

export const dashboards: Record<VariantId, () => ReactNode> = {
  desk: Desk, focus: Focus, map: MapView, squad: Squad, wardrobe: Wardrobe,
};
