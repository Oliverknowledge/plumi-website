import { DiscordButton } from "@/components/cosy/DiscordButton";
import { askForSubject as ask } from "@/content/community";
import "@/app/ask-for-subject.css";

/**
 * "Missing a subject? Ask for it in our Discord", with what else happens there (src/content/community.ts). It goes right after
 * a hub's subjects, where a student who didn't find theirs stops scrolling. `placement` names the page in `discord_clicked`, so
 * each spot's clicks can be compared.
 */
export function AskForSubject({ placement }: { placement: string }) {
  return (
    <section id={ask.id} className="lp-card lp-ask" aria-labelledby="lp-ask-h">
      <div className="lp-tape" aria-hidden="true" />
      <div className="lp-ask-copy">
        <span className="lp-ask-eyebrow">{ask.eyebrow}</span>
        <h2 id="lp-ask-h">{ask.title} <em>{ask.titleEm}</em></h2>
        <p>{ask.line}</p>
        <DiscordButton placement={placement} label={ask.cta} />
        <small>{ask.note}</small>
      </div>
      <div className="lp-ask-more">
        <h3>{ask.moreTitle}</h3>
        <ul>
          {ask.more.map(m => (
            <li key={m.title}><i aria-hidden="true">{m.icon}</i><b>{m.title}</b><span>{m.line}</span></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** One line under a hub's lead that jumps to the card, for the student who looks for their subject before scrolling. */
export function AskForSubjectHint() {
  return <p className="lp-ask-hint">{ask.hint} <a href={`#${ask.id}`}>{ask.hintLink} ↓</a></p>;
}
