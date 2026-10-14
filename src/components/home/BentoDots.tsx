"use client";
import { useEffect, useState } from "react";

/**
 * Page dots for the feature carousel on a phone: which card is in view, and a tap
 * target for each. Hidden above 640px, where the cards sit in a grid.
 */
export function BentoDots({ count, target }: { count: number; target: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const row = document.getElementById(target);
    if (!row) return;
    const onScroll = () => {
      const card = row.firstElementChild as HTMLElement | null;
      if (!card) return;
      const step = card.offsetWidth + 12;
      setActive(Math.max(0, Math.min(count - 1, Math.round(row.scrollLeft / step))));
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    return () => row.removeEventListener("scroll", onScroll);
  }, [count, target]);
  const go = (i: number) => {
    const card = document.getElementById(target)?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };
  return (
    <div className="hp-dots" role="tablist" aria-label="Features">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" role="tab" aria-selected={i === active} aria-label={`Feature ${i + 1} of ${count}`}
          className={i === active ? "is-on" : ""} onClick={() => go(i)} />
      ))}
    </div>
  );
}
