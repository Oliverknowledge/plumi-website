"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { enterEmbedMode, track } from "@/lib/analytics";
import { embedAppStoreHref, isAppleTouchDevice, partnerFromSearch, sortNewest, withEmbedParams } from "@/lib/embed";
import { bankDataPath, bankOwner, bankTitle, bankTopicPath, topicName, type BankPart, type BankSubject, type BankTopic } from "@/content/questionBank";
import { QuestionRow } from "./QuestionRow";

const PAGE = 20;
const noSubscribe = () => () => {};

/**
 * One topic's questions for a partner's iframe (/embed/question-bank/...): the topic
 * page's own question rows (the paper, "Mark scheme", the examiner's report), without
 * the site around them, and a link into Plumi under every question.
 *
 * The server sends the newest twenty. "Show more" fetches the subject's list, the
 * same file the bank itself reads, and keeps the topic's parts.
 *
 * It tells the page that frames it how tall it is, and nothing else (public/embed.js
 * is the other half). It sets no cookies and writes no storage: see enterEmbedMode.
 */
export function EmbedQuestionList({ subject, topic, initial, total }: { subject: BankSubject; topic: BankTopic; initial: BankPart[]; total: number }) {
  const [all, setAll] = useState<BankPart[] | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);

  // Server and first paint: no partner, not an Apple device, ordinary page links. Then the real values.
  const partner = useSyncExternalStore(noSubscribe, () => partnerFromSearch(window.location.search), () => null);
  const apple = useSyncExternalStore(noSubscribe, isAppleTouchDevice, () => false);

  const slug = topic.slug;
  const pageHref = withEmbedParams(bankTopicPath(subject.slug, slug), partner, slug);
  const storeHref = apple ? embedAppStoreHref(partner, slug) : null;
  const href = storeHref ?? pageHref;
  const destination = storeHref ? "app_store" : "topic_page";

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    enterEmbedMode({ partner: partnerFromSearch(window.location.search) ?? "direct", subject: subject.slug, topic: slug });
    track("embed_view");
  }, [subject.slug, slug]);

  // Tell the framing page how tall this is. Height only, to the page's own origin where the browser says what that is.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || window.parent === window) return;
    let target = "*";
    try {
      const ancestor = window.location.ancestorOrigins?.[0];
      target = ancestor && ancestor !== "null" ? ancestor : document.referrer ? new URL(document.referrer).origin : "*";
    } catch { /* an unreadable referrer: the height is not secret */ }
    let last = 0;
    let frame = 0;
    const send = () => {
      frame = 0;
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height > 0 && height !== last) {
        last = height;
        window.parent.postMessage({ plumiEmbedHeight: height }, target);
      }
    };
    const watch = new ResizeObserver(() => { if (!frame) frame = requestAnimationFrame(send); });
    watch.observe(el);
    send();
    return () => { watch.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);

  function clicked(placement: "question" | "footer", part?: string) {
    track("embed_cta_click", { placement, destination, part });
  }

  async function more() {
    setBusy(true);
    try {
      if (!all) {
        const parts: BankPart[] = await fetch(bankDataPath(subject.slug, "parts")).then(r => r.json());
        setAll(sortNewest(subject.papers, parts.filter(p => p.t.includes(topic.code))));
      }
      setShown(n => n + PAGE);
    } catch { /* stay as we are; the button is still there to try again */ } finally {
      setBusy(false);
    }
  }

  const list = all ?? initial;
  const count = all?.length ?? total;

  return (
    <div className="lp embed" id="plumi-embed" ref={rootRef}>
      <header className="embed-head">
        <Image src="/landing/plumi-mood-happy.svg" alt="" width={28} height={28} unoptimized />
        <span>Practice questions from Plumi</span>
      </header>
      <main id="main" className="embed-main">
        <div className="embed-title">
          <h1>{topicName(topic)}</h1>
          <p>{bankTitle(subject)} · {count} {count === 1 ? "question" : "questions"}</p>
        </div>
        <ol className="qb-rows">
          {list.slice(0, shown).map((p, i) => (
            <QuestionRow key={p.id} n={i + 1} parts={[p]} subject={subject} inSet={false} onToggleSet={() => {}}
              embed={{
                cta: (
                  <a className="embed-cta" href={href} target="_blank" rel="noopener" onClick={() => clicked("question", p.id)}>
                    Answer this on iPad and get it marked <span aria-hidden="true">→</span> Plumi
                  </a>
                ),
              }} />
          ))}
        </ol>
        {count > shown && (
          <div className="embed-more">
            <button type="button" className="lp-btn" onClick={more} disabled={busy}>Show {Math.min(PAGE, count - shown)} more</button>
          </div>
        )}
      </main>
      <footer className="embed-foot">
        <p>Questions and mark schemes © {bankOwner(subject)}, from published past papers. Plumi isn’t affiliated with any exam board.</p>
        <a href={href} target="_blank" rel="noopener" onClick={() => clicked("footer")}>Powered by Plumi</a>
      </footer>
    </div>
  );
}
