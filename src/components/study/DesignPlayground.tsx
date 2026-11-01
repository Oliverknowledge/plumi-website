"use client";

import { useState } from "react";
import { Card, Chip, Legend, Segmented, Switch, Tabs, Tile, TextField, masteryStates, type MasteryState } from "./ui";

/** The style guide's working controls: each one is the real component, with real state. */
export function ControlsDemo() {
  const [length, setLength] = useState("25");
  const [pomodoro, setPomodoro] = useState(true);
  const [nudges, setNudges] = useState(false);
  const [tab, setTab] = useState("physics");
  const [topics, setTopics] = useState<Record<string, boolean>>({ Mechanics: true, Statistics: false, Discrete: true });
  const [code, setCode] = useState("");
  return (
    <div className="st-grid" style={{ ["--min" as string]: "300px" }}>
      <Card inner className="st-stack" style={{ ["--gap" as string]: "14px" } as React.CSSProperties}>
        <div className="st-eyebrow">Choose one</div>
        <Segmented
          label="Session length"
          value={length}
          onChange={setLength}
          options={[{ value: "10", label: "10 min" }, { value: "25", label: "25 min" }, { value: "45", label: "45 min" }]}
        />
        <div className="st-eyebrow">Choose any</div>
        <div className="st-seg">
          {Object.entries(topics).map(([name, on]) => (
            <Chip key={name} small selected={on} onClick={() => setTopics((t) => ({ ...t, [name]: !t[name] }))}>{name}</Chip>
          ))}
        </div>
      </Card>
      <Card inner className="st-stack" style={{ ["--gap" as string]: "14px" } as React.CSSProperties}>
        <div className="st-eyebrow">Switches</div>
        <div className="st-spread"><span className="st-h4">Pomodoro</span><Switch label="Pomodoro" checked={pomodoro} onChange={setPomodoro} /></div>
        <div className="st-spread"><span className="st-h4">Nudges</span><Switch label="Nudges" checked={nudges} onChange={setNudges} /></div>
        <div className="st-spread"><span className="st-h4 st-muted">Disabled</span><Switch label="Disabled" checked={false} onChange={() => {}} disabled /></div>
      </Card>
      <Card inner className="st-stack" style={{ ["--gap" as string]: "14px" } as React.CSSProperties}>
        <div className="st-eyebrow">Fields</div>
        <TextField label="Search" icon="search" placeholder="Find a topic" />
        <TextField label="Join code" code value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" hint="Six characters" />
        <TextField label="Your name" defaultValue="Alex" error="Use at least two letters" />
      </Card>
      <Card inner className="st-stack" style={{ ["--gap" as string]: "14px", gridColumn: "1 / -1" } as React.CSSProperties}>
        <div className="st-eyebrow">Subject tabs</div>
        <Tabs
          label="Subject"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "physics", label: "Physics", subject: "physics" },
            { value: "maths", label: "Maths", subject: "maths" },
            { value: "chemistry", label: "Chemistry", subject: "chemistry" },
            { value: "biology", label: "Biology", subject: "biology" },
          ]}
        />
      </Card>
    </div>
  );
}

/** A tappable topic map: each square is a button, and its state cycles so the textures can be seen. */
export function TopicMapDemo() {
  const order: MasteryState[] = masteryStates.map((s) => s.id);
  const [grid, setGrid] = useState<MasteryState[]>(() => Array.from({ length: 94 }, (_, i) => order[(i * 7 + (i >> 2)) % order.length]));
  return (
    <Card className="st-stack" style={{ ["--gap" as string]: "14px" } as React.CSSProperties}>
      <div className="st-spread">
        <div className="st-h3">Topic map</div>
        <Legend />
      </div>
      <div className="st-tiles st-tiles--lg">
        {grid.map((s, i) => (
          <Tile key={i} large state={s} label={`Topic ${i + 1}`}
            onSelect={() => setGrid((g) => g.map((v, j) => (j === i ? order[(order.indexOf(v) + 1) % order.length] : v)))} />
        ))}
      </div>
    </Card>
  );
}
