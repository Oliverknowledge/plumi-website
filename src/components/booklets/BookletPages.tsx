import Link from "next/link";
import { CosyPage } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { intentFor } from "@/config/routes";
import {
  bookletCopy, bookletGroupPath, bookletGroups, bookletPdf, bookletPreview, bookletQuestionsPdf, bookletSource,
  bookletsPath, bookletTotals, fileSize, groupCopy, groupCount, starRange, type Booklet, type BookletGroup,
} from "@/content/booklets";
import { BookletClickTracker } from "./BookletClickTracker";
import "@/app/pages.css";
import "@/app/past-papers.css";
import "@/app/booklets.css";

/**
 * /maths-booklets and /maths-booklets/<group>: MadAsMaths' topic booklets (src/content/booklets.ts).
 * The hub is a card per group and every booklet's name, so a crawler and a student both reach every
 * one; a group's page has each booklet as a card, with a preview of its first questions and the
 * files themselves. Every link to a file is a plain anchor, reported by one listener (BookletClickTracker).
 */

const questionsTotal = (g: BookletGroup) => g.shelves.reduce((n, s) => n + s.booklets.reduce((m, b) => m + b.questions, 0), 0);
const number = (n: number) => n.toLocaleString("en-GB");

function Credit() {
  return (
    <p className="lp-card bk-credit">
      {bookletCopy.credit}{" "}
      <a href={bookletSource} rel="noopener" target="_blank" data-testid="booklets-source-link">{bookletCopy.creditLink}</a>
    </p>
  );
}

export function BookletHub() {
  const intent = intentFor(bookletsPath);
  return (
    <CosyPage after={<>
      <PageStructuredData path={bookletsPath} name={intent.title} description={intent.description} type="CollectionPage"
        breadcrumb={[{ name: bookletCopy.section, path: bookletsPath }]} />
      <BookletClickTracker page="hub" />
    </>}>
      <article className="pp bk">
        <header className="lp-wrap pp-hero">
          <nav className="pp-crumbs" aria-label="Breadcrumb"><span aria-current="page">{bookletCopy.section}</span></nav>
          <span className="lp-eyebrow">{bookletCopy.eyebrow}</span>
          <h1>{bookletCopy.hubTitle} <em>{bookletCopy.hubTitleEm}</em></h1>
          <p className="lp-lead">
            {number(bookletTotals.booklets)} topic booklets, from the first steps of algebra to beyond A‑Level, with over{" "}
            {number(Math.floor(bookletTotals.questions / 1000) * 1000)} questions between them. {bookletCopy.solutions} Open any of them, free.
          </p>
          <ul className="pp-facts" aria-label="At a glance">
            <li><strong>{number(bookletTotals.booklets)}</strong><span>booklets</span></li>
            <li><strong>{number(bookletTotals.questions)}</strong><span>questions</span></li>
            <li><strong>{bookletTotals.groups}</strong><span>topic groups</span></li>
            <li><strong>£0</strong><span>no sign‑up</span></li>
          </ul>
          <Credit />
        </header>

        <section aria-label="Topic groups" className="pp-group">
          <div className="lp-wrap">
            <ul className="bk-groups">
              {bookletGroups.map(g => (
                <li key={g.slug}>
                  <Link className="lp-card bk-group" href={bookletGroupPath(g.slug)} data-testid={`booklets-group-${g.slug}`}>
                    <small>{groupCopy[g.slug].level} · {g.name} topics</small>
                    <b>{groupCopy[g.slug].heading}</b>
                    <span>{groupCopy[g.slug].blurb}</span>
                    <span className="bk-group-count">{groupCount(g)} booklets · {number(questionsTotal(g))} questions</span>
                    <span className="pp-board-go">See the booklets ›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="all-title" className="pp-group">
          <div className="lp-wrap">
            <h2 id="all-title" className="pp-group-title">Every booklet</h2>
            <div className="bk-index">
              {bookletGroups.map(g => (
                <section key={g.slug} aria-labelledby={`index-${g.slug}`} className="bk-index-group">
                  <h3 id={`index-${g.slug}`}><Link href={bookletGroupPath(g.slug)}>{groupCopy[g.slug].heading}</Link></h3>
                  <ul>
                    {g.shelves.flatMap(s => s.booklets).map(b => (
                      <li key={b.slug}><Link href={`${bookletGroupPath(g.slug)}#${b.slug}`}>{label(b)}</Link></li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>
      </article>
    </CosyPage>
  );
}

/** "Logarithms (exam questions)", "Collisions (M2)". */
const label = (b: Booklet) => [b.title, b.kind?.toLowerCase(), b.modules?.join("/")].filter(Boolean).reduce((t, x, i) => (i ? `${t} (${x})` : t));

function BookletCard({ group, booklet: b }: { group: string; booklet: Booklet }) {
  const pdf = bookletPdf(group, b);
  return (
    <li id={b.slug} className="lp-card bk-card">
      <a className="bk-preview" href={pdf} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true"
        data-booklet={b.slug} data-group={group} data-kind="full">
        {/* eslint-disable-next-line @next/next/no-img-element -- served from R2 beside the PDFs, already sized */}
        <img src={bookletPreview(group, b)} width={b.preview[0]} height={b.preview[1]} alt="" loading="lazy" decoding="async" />
      </a>
      <div className="bk-body">
        <h3>{b.title}</h3>
        {(b.kind || b.modules || b.stars) && (
          <p className="bk-tags">
            {b.kind && <span className="bk-tag">{b.kind}</span>}
            {b.modules && <span className="bk-tag">{b.modules.join(" · ")}</span>}
            {b.stars && <span className="bk-stars" title="Difficulty, in MadAsMaths' stars">{starRange(b.stars)}</span>}
          </p>
        )}
        <p className="bk-meta">{number(b.questions)} {b.questions === 1 ? "question" : "questions"} · {b.pages} pages · {fileSize(b.bytes)}</p>
        <p className="bk-get">
          <a className="pp-file is-qp" href={pdf} target="_blank" rel="noopener" data-booklet={b.slug} data-group={group} data-kind="full"
            aria-label={`${bookletCopy.open}: ${label(b)}, with answers and worked solutions (PDF, ${fileSize(b.bytes)})`}>{bookletCopy.open}</a>
          {b.questionsOnly && (
            <a className="pp-file is-ms" href={bookletQuestionsPdf(group, b)} target="_blank" rel="noopener" data-booklet={b.slug} data-group={group} data-kind="questions"
              aria-label={`${label(b)}, questions only (PDF, ${fileSize(b.questionsOnly.bytes)})`}>{bookletCopy.questionsOnly}</a>
          )}
        </p>
      </div>
    </li>
  );
}

export function BookletGroupPage({ group }: { group: BookletGroup }) {
  const path = bookletGroupPath(group.slug);
  const copy = groupCopy[group.slug];
  const meta = groupPageMeta(group);
  const others = bookletGroups.filter(g => g.slug !== group.slug);
  const hasQuestionsOnly = group.shelves.some(s => s.booklets.some(b => b.questionsOnly));
  return (
    <CosyPage after={<>
      <PageStructuredData path={path} name={meta.title} description={meta.description} type="CollectionPage"
        breadcrumb={[{ name: bookletCopy.section, path: bookletsPath }, { name: copy.heading, path }]} />
      <BookletClickTracker page={group.slug} />
    </>}>
      <article className="pp bk">
        <header className="lp-wrap pp-hero">
          <nav className="pp-crumbs" aria-label="Breadcrumb">
            <Link href={bookletsPath}>{bookletCopy.section}</Link><span aria-hidden="true">›</span>
            <span aria-current="page">{copy.heading}</span>
          </nav>
          <span className="lp-eyebrow">{copy.level} · {group.name} topics · free</span>
          <h1>{copy.heading} <em>booklets</em></h1>
          <p className="lp-lead">{copy.blurb} {bookletCopy.solutions}</p>
          <ul className="pp-facts" aria-label="At a glance">
            <li><strong>{groupCount(group)}</strong><span>booklets</span></li>
            <li><strong>{number(questionsTotal(group))}</strong><span>questions</span></li>
            <li><strong>£0</strong><span>no sign‑up</span></li>
          </ul>
          {group.shelves.length > 1 && (
            <nav className="pp-jump" aria-label="Jump to">
              {group.shelves.map((s, i) => <a key={s.name} href={`#shelf-${i}`}>{s.name}</a>)}
            </nav>
          )}
          <Credit />
          {hasQuestionsOnly && <p className="pp-note">{bookletCopy.questionsOnlyNote}</p>}
        </header>

        {group.shelves.map((s, i) => (
          <section key={s.name} aria-labelledby={`shelf-${i}`} className="pp-group">
            <div className="lp-wrap">
              {group.shelves.length > 1 && <h2 id={`shelf-${i}`} className="pp-group-title">{s.name}</h2>}
              <ul className="bk-cards" aria-labelledby={group.shelves.length > 1 ? `shelf-${i}` : undefined} aria-label={group.shelves.length > 1 ? undefined : copy.heading}>
                {s.booklets.map(b => <BookletCard key={b.slug} group={group.slug} booklet={b} />)}
              </ul>
            </div>
          </section>
        ))}

        <section aria-labelledby="more-title" className="pp-more">
          <div className="lp-wrap">
            <h2 id="more-title" className="pp-group-title">More booklets</h2>
            <nav className="lp-sp-more" aria-label="More booklets">
              {others.map(g => <Link key={g.slug} href={bookletGroupPath(g.slug)}>{groupCopy[g.slug].heading} booklets</Link>)}
              <Link href={bookletsPath}>All maths booklets</Link>
              <Link href="/question-bank">Exam questions by topic</Link>
            </nav>
            <Credit />
          </div>
        </section>
      </article>
    </CosyPage>
  );
}

const withBrand = (title: string) => (title.length + 8 <= 60 ? `${title} | Plumi` : title);
const titleCase = (s: string) => s.replace(/\b([a-z])/g, c => c.toUpperCase());

/** One query per group, the way it's searched: "Year 13 pure maths booklets with worked solutions". */
export function groupPageMeta(g: BookletGroup) {
  const copy = groupCopy[g.slug];
  const title = withBrand(`${titleCase(copy.heading)} Booklets With Worked Solutions`);
  // Mid-sentence, "University maths" reads "university maths"; "Year 13" and "Further Maths" keep their capitals.
  const phrase = /^(Year|Further)\b/.test(copy.heading) ? copy.heading : copy.heading[0].toLowerCase() + copy.heading.slice(1);
  let description = `${groupCount(g)} free ${phrase} booklets from MadAsMaths: ${number(questionsTotal(g))} questions by topic, each with its answer and a worked solution. No sign-up.`;
  if (description.length > 158) description = `${groupCount(g)} free ${phrase} booklets from MadAsMaths, every question with its answer and a worked solution. No sign-up.`;
  return { title, description };
}
