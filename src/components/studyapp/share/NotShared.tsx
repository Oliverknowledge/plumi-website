import Image from "next/image";
import { AppLink } from "@/components/studyapp/AppLink";

/**
 * The page for a deck that is not there: unknown, stopped, hidden, or a project that cannot share yet. It says the same
 * thing for all of them (the database does too), and never a code, a status or the word error.
 */
export function NotShared({ variant = "gone" }: { variant?: "gone" | "busy" | "crowded" }) {
  const busy = variant !== "gone";
  return (
    <main id="main" className="sh-main sh-gone" data-testid="not-shared">
      <div className="sh-scene" aria-hidden="true">
        <div className="sh-empty-card"><i /><i /><i /></div>
        <Image src={busy ? "/study/mascot/plumi-lofi-sleepy.svg" : "/study/mascot/plumi-sad-but-supportive.svg"} alt="" width={132} height={132} unoptimized priority />
      </div>
      <h1>{variant === "crowded" ? "Lots of people are looking right now." : busy ? "This deck is taking a nap." : "This deck is not shared any more."}</h1>
      {busy && <p className="sh-soft">{variant === "crowded" ? "Try again in a minute." : "Try again in a moment."}</p>}
      <div className="sh-acts">
        {busy && <a className="btn" href="" data-testid="try-again">Try again</a>}
        <AppLink href="/study" className="btn gold" data-testid="open-app">Open Plumi</AppLink>
      </div>
    </main>
  );
}
