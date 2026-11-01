import type { Metadata } from "next";

export const metadata: Metadata = { title: "Study" };

/** Study is the Grand Library. Being built: see docs/study/app.md. */
export default function StudyPage() {
  return (
    <main className="wrap" style={{ paddingBlock: 40 }}>
      <h1 style={{ font: "700 34px var(--f-px)" }}>The Grand Library</h1>
      <p>Coming in a moment.</p>
    </main>
  );
}
