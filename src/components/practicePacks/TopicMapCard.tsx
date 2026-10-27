import Image from "next/image";
import { AppStoreBadge } from "@/components/home/AppStoreBadge";
import { DiscordButton } from "@/components/cosy/DiscordButton";
import { Tape } from "@/components/cosy/Chrome";
import { packCopy } from "@/content/practicePacks";
import "@/app/past-papers.css";
import "@/app/practice-packs.css";

/**
 * The get-it-marked card for the Practice papers pages: past paper pages' MarkItCard, with
 * the topic map in place of the Papers tab, since a pack's questions land on your topic map.
 */
export function TopicMapCard({ placement }: { placement: string }) {
  const c = packCopy.markIt;
  return (
    <aside className="lp-card pp-mark pk-topics" aria-labelledby={`${placement}-title`}>
      <Tape />
      <div className="pp-mark-copy">
        <span className="lp-eyebrow">{c.eyebrow}</span>
        <h2 id={`${placement}-title`}>{c.title} <em>{c.titleEm}</em></h2>
        <p className="lp-lead">{c.lead}</p>
        <div className="lp-cta-row">
          <AppStoreBadge placement={placement} height={52} />
          <DiscordButton placement={`${placement}-discord`} />
        </div>
        <p className="lp-cta-note">{c.note}</p>
      </div>
      <figure className="pp-mark-shot">
        <Image src={c.image.src} width={c.image.w} height={c.image.h} sizes="(max-width: 980px) 90vw, 520px" alt={c.image.alt} />
      </figure>
    </aside>
  );
}
