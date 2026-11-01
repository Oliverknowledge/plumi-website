import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { AppearanceSwitch } from "@/components/study/AppearanceSwitch";
import { ControlsDemo, TopicMapDemo } from "@/components/study/DesignPlayground";
import { inkPalette, looks, lookTitle, modes, paperStocks, subjects, type Look, type Mode } from "@/components/study/tokens";
import {
  AppHeader, Avatar, Button, Card, Eyebrow, Inset, Legend, Mascot, MarkChip, Paper, PixelBlocks, PixelIcon,
  Says, Stat, StreakPill, SubjectCard, Tag, Tile, Tiles, WeekBars, masteryStates, pixelIconNames,
  type MascotPose, type MasteryState,
} from "@/components/study/ui";

export const metadata: Metadata = { title: "Study design system" };

const nav = [
  { href: "/study", label: "Desk" },
  { href: "/study/notebooks", label: "Notebooks" },
  { href: "/study/subjects", label: "Subjects" },
  { href: "/study/room", label: "Study room" },
] as const;

const gap = (n: number) => ({ ["--gap" as string]: `${n}px` }) as CSSProperties;

/** One section of the guide: a pixel heading, at most one short line, then the thing itself. */
function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} className="st-stack" style={{ ...gap(16), scrollMarginTop: 24 }}>
      <div>
        <h2 className="st-h2">{title}</h2>
        {note && <p className="st-small st-muted" style={{ marginTop: 4 }}>{note}</p>}
      </div>
      {children}
    </section>
  );
}

const tokenGroups: { title: string; names: string[] }[] = [
  { title: "Surfaces", names: ["ground", "ground-deep", "tab-off", "card", "card-2", "inset", "inset-2"] },
  { title: "Text", names: ["ink", "ink-2", "ink-3", "accent", "accent-strong", "accent-tint"] },
  { title: "Line", names: ["line", "shadow", "hairline", "hairline-strong", "sel-bg", "sel-fg", "focus"] },
  { title: "Marking", names: ["correct", "correct-bg", "partial", "partial-bg", "incorrect", "incorrect-bg", "tutor", "tutor-bg"] },
  { title: "Topic squares", names: ["m-attention", "m-rusty", "m-developing", "m-strong"] },
  { title: "Stationery", names: ["key-blue", "key-green", "mint", "yellow", "teal", "pink", "flame", "blue-tint", "lime-tint"] },
];

const poses: MascotPose[] = ["idle", "thinking", "celebrating", "curious", "encouraging", "welcoming", "explaining", "focused", "proud", "supportive", "surprised", "cool", "sleeping", "confused"];

const sampleTiles: MasteryState[] = ["strong", "strong", "developing", "rusty", "needsAttention", "notEnough", "developing", "strong", "notEnough", "notEnough", "rusty", "strong"];

/** One whole palette on one small desk: the quickest way to judge a look. */
function Sample({ look, mode }: { look: Look; mode: Mode }) {
  return (
    <div className="st-scope" data-look={look} data-mode={mode} style={{ padding: 20, borderRadius: 18, border: "3px solid var(--st-line)" }}>
      <div className="st-stack" style={gap(14)}>
        <div className="st-eyebrow">{lookTitle[look]} · {mode}</div>
        <Card inner className="st-stack" style={gap(10) as CSSProperties}>
          <div className="st-row" style={gap(8)}>
            <Tag>A-Level Physics · AQA</Tag>
            <Tag kind="live">Live</Tag>
          </div>
          <div className="st-h3">Circular motion</div>
          <Tiles states={sampleTiles} />
          <div className="st-row" style={gap(8)}>
            <MarkChip code="M1" state="earned" />
            <MarkChip code="A0" state="lost" />
            <MarkChip code="B1" state="partial" />
          </div>
        </Card>
        <div className="st-row" style={gap(10)}>
          <Button variant="primary" small>Start</Button>
          <Button variant="go" small>Continue</Button>
          <Button small>Not now</Button>
        </div>
        <PixelBlocks value={7} max={10} label="7 of 10 blocks" />
      </div>
    </div>
  );
}

export default function DesignPage() {
  return (
    <>
      <AppHeader nav={nav} current="/study" end={<><StreakPill days={8} /><Avatar initial="A" /></>} />
      <main className="st-page st-stack" style={gap(48)} id="main">
        <div className="st-stack" style={gap(14)}>
          <Eyebrow>study.tryplumi.app</Eyebrow>
          <h1 className="st-display">Design system</h1>
          <p className="st-lead">The iPad notebook, in a browser. Pick a look; everything below follows it.</p>
          <AppearanceSwitch />
        </div>

        <Section id="palettes" title="Four palettes" note="Blue is the app's main look. Lime is its option. Each has a dark mode.">
          <div className="st-grid" style={{ ["--min" as string]: "440px" } as CSSProperties}>
            {looks.flatMap((l) => modes.map((m) => <Sample key={`${l}-${m}`} look={l} mode={m} />))}
          </div>
        </Section>

        <Section id="colour" title="Colour" note="One line colour draws every border, shadow and chosen fill.">
          <div className="st-stack" style={gap(20)}>
            {tokenGroups.map((g) => (
              <div key={g.title} className="st-stack" style={gap(8)}>
                <Eyebrow>{g.title}</Eyebrow>
                <div className="st-row" style={gap(12)}>
                  {g.names.map((n) => (
                    <div key={n} style={{ width: 104 }}>
                      <div style={{ height: 52, background: `var(--st-${n})`, border: "var(--st-bw-sm) solid var(--st-line)" }} />
                      <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, lineHeight: 1.2 }}>{n}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="type" title="Type" note="Pixel is a voice. Nunito is for reading. Numbers are always Nunito.">
          <Card className="st-stack" style={gap(18) as CSSProperties}>
            <div><Eyebrow>Display · Pixelify 40</Eyebrow><div className="st-display">Evening, Alex.</div></div>
            <div><Eyebrow>Hero title · Pixelify 36</Eyebrow><div className="st-hero-title">Circular motion</div></div>
            <div><Eyebrow>Section · Pixelify 22</Eyebrow><div className="st-h2">Your notebooks</div></div>
            <div><Eyebrow>Card title · Pixelify 20</Eyebrow><div className="st-h3">Study room</div></div>
            <div><Eyebrow>Small heading · Nunito 800 17</Eyebrow><div className="st-h4">Physics Squad</div></div>
            <div><Eyebrow>Body · Nunito 600 16</Eyebrow><p className="st-body" style={{ maxWidth: "60ch" }}>You dropped marks on centripetal force last week, so Plumi wrote three fresh exam-style questions on it, diagrams included.</p></div>
            <div><Eyebrow>Label · Nunito 800 13, tracked</Eyebrow><div className="st-eyebrow">Tonight&rsquo;s session</div></div>
            <hr className="st-rule" />
            <div className="st-row" style={gap(40)}>
              <div>
                <Eyebrow>Pixel digits sit close to letters, so numbers are Nunito</Eyebrow>
                <div className="st-row" style={gap(28)}>
                  <div><div className="st-px" style={{ fontSize: 36 }}>5S 2Z 0O 8B 6G</div><div className="st-small">Pixelify</div></div>
                  <div><div className="st-num" style={{ fontSize: 36 }}>5S 2Z 0O 8B 6G</div><div className="st-small">Nunito</div></div>
                </div>
              </div>
              <div><Eyebrow>Timer</Eyebrow><div className="st-num-xl">24:37</div></div>
              <div><Eyebrow>Mark</Eyebrow><div className="st-num-lg">3<span className="st-unit"> / 5</span></div></div>
            </div>
          </Card>
        </Section>

        <Section id="keys" title="Keys" note="One primary per screen. Press one: it moves down by its own shadow.">
          <Card className="st-stack" style={gap(20) as CSSProperties}>
            <div className="st-row" style={gap(16)}>
              <Button variant="primary">Start session</Button>
              <Button variant="go" icon="arrowRight">Continue</Button>
              <Button variant="friendly">Join the room</Button>
              <Button>Do it in the study room</Button>
              <Button variant="flat" small>Upload a PDF</Button>
              <Button variant="ghost" icon="plus">Add a subject</Button>
            </div>
            <div className="st-row" style={gap(16)}>
              <Button small>Small</Button>
              <Button disabled>Disabled</Button>
              <Button variant="primary" disabled>Disabled primary</Button>
              <Button aria-label="Search" icon="search" />
              <Button aria-label="Add" icon="plus" variant="friendly" />
            </div>
          </Card>
        </Section>

        <Section id="surfaces" title="Surfaces and tags">
          <div className="st-grid" style={{ ["--min" as string]: "280px" } as CSSProperties}>
            <Card><Eyebrow>Card</Eyebrow><div className="st-h3" style={{ marginTop: 6 }}>3px line, 5px shadow</div></Card>
            <Card inner><Eyebrow>Inner card</Eyebrow><div className="st-h3" style={{ marginTop: 6 }}>4px shadow</div></Card>
            <Card flat><Eyebrow>Flat card</Eyebrow><div className="st-h3" style={{ marginTop: 6 }}>No shadow</div></Card>
            <Card><Eyebrow>Inset</Eyebrow><Inset style={{ marginTop: 8 }}>A panel inside a card: no line, no shadow.</Inset></Card>
          </div>
          <div className="st-row" style={gap(10)}>
            <Tag>A-Level Physics · AQA</Tag>
            <Tag kind="live">Live</Tag>
            <Tag kind="pro">Pro</Tag>
            <Tag kind="count">12 pages</Tag>
            <span className="st-soon">soon</span>
            <MarkChip code="M1" state="earned" />
            <MarkChip code="A1" state="earned" />
            <MarkChip code="B1" state="partial" />
            <MarkChip code="A0" state="lost" />
            <MarkChip code="M1" />
          </div>
        </Section>

        <Section id="controls" title="Controls">
          <ControlsDemo />
        </Section>

        <Section id="data" title="Data is squares" note="No rings, no smooth bars. The unit is a bordered square.">
          <div className="st-split">
            <TopicMapDemo />
            <div className="st-stack" style={gap(20)}>
              <Card inner className="st-stack" style={gap(12) as CSSProperties}>
                <Eyebrow>Today</Eyebrow>
                <div className="st-row" style={gap(14)}>
                  <div><span className="st-num-lg">42</span><span className="st-unit"> / 60 min</span></div>
                  <PixelBlocks value={7} max={10} label="42 of 60 minutes studied today" />
                </div>
                <PixelBlocks goal value={9} max={15} label="9 of 15 goal blocks" />
              </Card>
              <Card inner className="st-stack" style={gap(12) as CSSProperties}>
                <Eyebrow>This week</Eyebrow>
                <WeekBars height={96} values={[0, 12, 25, 0, 40, 18, 6]} label="Minutes studied each day this week" />
              </Card>
              <Card inner className="st-stats">
                <Stat label="Topics" value="14" unit="/ 94" />
                <Stat label="Streak" value="8" unit="days" />
                <Stat label="Goal" value="A*" goal />
              </Card>
            </div>
          </div>
          <Card inner className="st-stack" style={gap(10) as CSSProperties}>
            <Eyebrow>Each state has its own texture, so colour is never the only signal</Eyebrow>
            <div className="st-row" style={gap(28)}>
              {masteryStates.map((s) => (
                <div key={s.id} className="st-row" style={gap(10)}>
                  <Tile large state={s.id} />
                  <span className="st-small" style={{ color: "var(--st-ink)" }}>{s.label}</span>
                </div>
              ))}
            </div>
            <Legend />
          </Card>
        </Section>

        <Section id="subjects" title="Subjects" note="A subject is a colour on a spine. Each has a name, never a colour alone.">
          <div className="st-grid" style={{ ["--min" as string]: "260px" } as CSSProperties}>
            <SubjectCard subject="physics" name="Physics" meta="A-Level · AQA" now="B" headedFor="A" goal="A*" tiles={["strong", "strong", "developing", "rusty", "needsAttention", "strong", "notEnough", "developing", "strong", "strong", "notEnough", "developing"]} />
            <SubjectCard subject="maths" name="Maths" meta="A-Level · Edexcel" now="A" headedFor="A" goal="A*" tiles={["strong", "strong", "strong", "developing", "strong", "rusty", "strong", "strong", "notEnough", "strong"]} />
            <SubjectCard subject="chemistry" name="Chemistry" meta="A-Level · OCR A" now="C" headedFor="B" goal="A" tiles={["developing", "rusty", "needsAttention", "developing", "rusty", "notEnough", "notEnough", "developing", "needsAttention"]} />
            <SubjectCard subject="biology" name="Biology" meta="GCSE · AQA" now="6" headedFor="7" goal="9" tiles={["strong", "developing", "strong", "developing", "rusty", "notEnough", "strong", "developing", "notEnough", "notEnough"]} />
          </div>
          <div className="st-row" style={gap(14)}>
            {subjects.map((s) => (
              <div key={s.id} className="st-row" style={gap(8)} data-subject={s.id}>
                <span className="st-swatch" /> <span className="st-h4">{s.title}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="mascot" title="Plumi" note="Short, kind, first person. It promises the marking and never lectures.">
          <div className="st-split">
            <Card className="st-stack" style={gap(18) as CSSProperties}>
              <Says pose="thinking">Circular motion&rsquo;s been a bit rusty. Three quick ones? I&rsquo;ll mark every line.</Says>
              <Says pose="encouraging" side="left">Two to go. You&rsquo;ve got this.</Says>
              <Says pose="welcoming">Nothing marked yet. Two quick questions and I&rsquo;ll know where to start.</Says>
            </Card>
            <Card inner>
              <div className="st-row" style={gap(10)}>
                {poses.map((p) => (
                  <div key={p} style={{ textAlign: "center" }}>
                    <Mascot pose={p} height={80} label={p} />
                    <div className="st-eyebrow" style={{ fontSize: 11, marginTop: 2 }}>{p}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>

        <Section id="icons" title="Pixel icons" note="Eight squares by eight. Sizes in whole multiples of eight stay sharp.">
          <Card className="st-row" style={gap(26) as CSSProperties}>
            {pixelIconNames.map((n) => (
              <div key={n} style={{ textAlign: "center", width: 76 }}>
                <div className="st-row" style={{ ...gap(10), justifyContent: "center", flexWrap: "nowrap" }}>
                  <PixelIcon name={n} size={16} /> <PixelIcon name={n} size={24} /> <PixelIcon name={n} size={32} />
                </div>
                <div className="st-eyebrow" style={{ fontSize: 11, marginTop: 6 }}>{n}</div>
              </div>
            ))}
          </Card>
        </Section>

        <Section id="paper" title="Paper" note="The page keeps its own stock in every look and mode. The chrome never recolours it.">
          <div className="st-grid" style={{ ["--min" as string]: "280px" } as CSSProperties}>
            {paperStocks.map((p) => (
              <Paper key={p.id} stock={p.id} style={{ minHeight: 210 }}>
                <Eyebrow>{p.title}</Eyebrow>
                <div className="st-work" style={{ marginTop: 6 }}>v = r&omega;</div>
                <div className="st-work">v = 0.4 &times; 5 = 2.0</div>
                <div className="st-work st-work--wrong">a = v&sup2; / r&sup2;</div>
                <div className="st-tutor">Check which radius this uses.</div>
              </Paper>
            ))}
          </div>
          <Card inner className="st-stack" style={gap(12) as CSSProperties}>
            <Eyebrow>Pens and highlighters (the student&rsquo;s ink; no white pen)</Eyebrow>
            <div className="st-row" style={gap(10)}>
              {inkPalette.pens.map((p) => <span key={p.id} title={p.name} style={{ width: 34, height: 34, background: p.hex, border: "var(--st-bw-sm) solid var(--st-line)", display: "inline-block" }} />)}
              <span style={{ width: 16 }} />
              {inkPalette.highlighters.map((p) => <span key={p.id} title={p.name} style={{ width: 34, height: 34, background: p.hex, opacity: 0.85, border: "var(--st-bw-sm) solid var(--st-line)", display: "inline-block" }} />)}
            </div>
          </Card>
        </Section>

        <Section id="shape" title="Shape and press">
          <Card className="st-row" style={gap(28) as CSSProperties}>
            {[["18", "card"], ["14", "lg"], ["12", "md"], ["10", "sm"], ["8", "xs"], ["0", "pixel"]].map(([r, n]) => (
              <div key={n} style={{ textAlign: "center" }}>
                <div style={{ width: 64, height: 64, background: "var(--st-card)", border: "var(--st-bw) solid var(--st-line)", borderRadius: `${r}px`, boxShadow: "0 var(--st-sh-md) 0 var(--st-shadow)" }} />
                <div className="st-eyebrow" style={{ fontSize: 11, marginTop: 14 }}>{r}px · {n}</div>
              </div>
            ))}
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, background: "var(--st-card)", border: "var(--st-bw) solid var(--st-line)", borderRadius: 14, transform: "translateY(var(--st-sh-md))" }} />
              <div className="st-eyebrow" style={{ fontSize: 11, marginTop: 14 }}>pressed</div>
            </div>
          </Card>
        </Section>

        <Section id="desk" title="Put together" note="The Desk, drawn only from the parts above.">
          <div className="st-stack" style={{ ...gap(20), padding: "20px", border: "3px solid var(--st-line)", borderRadius: 18, background: "var(--st-ground)" }}>
            <div className="st-spread" style={{ alignItems: "flex-start" }}>
              <div className="st-stack" style={gap(4)}>
                <h3 className="st-display">Evening, Alex.</h3>
                <p className="st-lead">The rain&rsquo;s on and the lamp&rsquo;s lit. Fancy 25 minutes on circular motion?</p>
              </div>
              <Card inner className="st-row" style={gap(14) as CSSProperties}>
                <div><Eyebrow>Today</Eyebrow><span className="st-num-lg">42</span><span className="st-unit"> / 60 min</span></div>
                <PixelBlocks value={7} max={10} label="42 of 60 minutes studied today" />
              </Card>
            </div>
            <div className="st-split">
              <Card hero className="st-stack" style={gap(14) as CSSProperties}>
                <div className="st-aside-row">
                  <div className="st-stack" style={gap(10)}>
                    <div className="st-row" style={gap(10)}><Eyebrow>Tonight&rsquo;s session</Eyebrow><Tag>A-Level Physics · AQA</Tag></div>
                    <div className="st-hero-title">Circular motion</div>
                    <div className="st-row" style={gap(8)}><Tile large state="needsAttention" /><span className="st-h4">Needs attention</span></div>
                    <p className="st-body" style={{ maxWidth: "46ch" }}>You dropped marks on centripetal force last week, so Plumi wrote three fresh exam-style questions on it, diagrams included.</p>
                  </div>
                  <Says pose="thinking" stacked>Circular motion&rsquo;s been a bit rusty. Three quick ones? I&rsquo;ll mark every line.</Says>
                </div>
                <div className="st-seg">
                  <button className="st-chip" type="button" aria-pressed="false">10 min</button>
                  <button className="st-chip" type="button" aria-pressed="true">25 min</button>
                  <button className="st-chip" type="button" aria-pressed="false">45 min</button>
                </div>
                <div className="st-row" style={gap(14)}>
                  <Button variant="primary">Start session</Button>
                  <Button>Do it in the study room</Button>
                </div>
              </Card>
              <Card className="st-stack" style={gap(12) as CSSProperties}>
                <div className="st-row" style={gap(10)}><Tag kind="live">Live</Tag></div>
                <div className="st-h3">Study room</div>
                <p className="st-small" style={{ color: "var(--st-ink-2)" }}>Physics Squad · 3 studying now</p>
                <div className="st-row" style={gap(8)}><Avatar initial="A" tone="pink" /><Avatar initial="S" tone="yellow" /><Avatar initial="J" tone="green" /></div>
                <Button variant="friendly" block>Join the room</Button>
              </Card>
            </div>
            <div className="st-spread"><h3 className="st-h2">Your notebooks</h3><Legend /></div>
            <div className="st-grid" style={{ ["--min" as string]: "250px" } as CSSProperties}>
              <SubjectCard subject="physics" name="Physics" meta="A-Level · AQA" now="B" headedFor="A" goal="A*" tiles={sampleTiles} />
              <SubjectCard subject="maths" name="Maths" meta="A-Level · Edexcel" now="A" headedFor="A" goal="A*" tiles={["strong", "strong", "strong", "developing", "strong", "rusty", "strong", "strong"]} />
              <SubjectCard subject="chemistry" name="Chemistry" meta="A-Level · OCR A" now="C" headedFor="B" goal="A" tiles={["developing", "rusty", "needsAttention", "developing", "rusty", "notEnough"]} />
              <SubjectCard subject="biology" name="Biology" meta="GCSE · AQA" now="6" headedFor="7" goal="9" tiles={["strong", "developing", "strong", "developing", "rusty", "notEnough"]} />
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
