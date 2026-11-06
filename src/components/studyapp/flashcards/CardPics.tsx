"use client";

import { useEffect, useRef, useState } from "react";
import { picUrl, type Pic } from "@/lib/studyapp/cardPics";

/**
 * The pictures of a card side (a "From my mistakes" card: the question, or the mark scheme), from the bank. Lazy, retried once if it did not come, and a calm
 * line if it still does not (never an error). They are plain `<img>`s so the app's dark mode turns them back like every question crop: paper stays paper.
 */
export function CardPics({ pics }: { pics: readonly Pic[] }) {
  return (
    <div className="cpics" data-testid="card-pics">
      {pics.map((p, i) => <CardPic key={`${p.k}:${p.id}:${i}`} pic={p} />)}
    </div>
  );
}

function CardPic({ pic }: { pic: Pic }) {
  const [n, setN] = useState(0);
  const [bad, setBad] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const src = picUrl(pic);
  if (bad) return <p className="cpic-bad">The picture did not load.</p>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="cpic" src={n ? `${src}${src.includes("?") ? "&" : "?"}t=${n}` : src} alt={pic.alt ?? ""} loading="lazy" decoding="async" draggable={false}
      onError={() => { if (n === 0) timer.current = setTimeout(() => setN(1), 1500); else setBad(true); }}
    />
  );
}
