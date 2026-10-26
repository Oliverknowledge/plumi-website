import Image from "next/image";
import Link from "next/link";
import { CosyPage, FaqSchema, SectionHead, Tape, WindowBar } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { MarkItCard } from "@/components/pastPapers/PastPaperChrome";
import { display } from "@/content/pastPapers";
import { intentFor } from "@/config/routes";
import {
  packCopy, packImage, packName, packShareImage, packPath, packTotals, practicePacks, type PracticePack,
} from "@/content/practicePacks";
import { levelClass, PackCover, PackDownloads, PackLadder } from "./Pack";
import { PackClickTracker } from "./PackClickTracker";
import { PastPapersCard } from "./PastPapersCard";
import "@/app/pages.css";
import "@/app/past-papers.css";

/**
 * /practice-papers and /practice-papers/<slug>: Plumi's own practice papers. The hub is a
 * pack per card; a pack's page shows everything in it before the download (its sections,
 * all thirty questions with their difficulty, a page of the paper and of the scheme), then
 * how it compares and the way to get it marked. Words: src/content/practicePacks.ts.
 */

const tick = <svg viewBox="0 0 26 22" aria-hidden="true"><path d="M3 12 L10 19 L23 3" stroke="#d33a2f" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

const withBrand = (title: string) => (title.length + 8 <= 60 ? `${title} | Plumi` : title);

/** One query per pack, the way students type it: "free OCR A-Level Physics practice paper". */
export const packPageMeta = (p: PracticePack) => ({
  title: withBrand(`Free ${p.board} A-Level ${p.subject} Practice Paper & Mark Scheme`),
  description: `A free ${packName(p)} practice pack by Plumi: ${p.questions.length} exam-style questions, ${p.marks} marks, easy to super hard, with a full mark scheme. No sign-up.`,
});

function Proof({ grid = false }: { grid?: boolean }) {
  return grid
    ? <ul className="pk-proof-grid">{packCopy.proof.map(p => <li key={p.title} className="lp-card pk-section"><b>{p.title}</b><p>{p.line}</p></li>)}</ul>
    : <ul className="pk-proof">{packCopy.proof.map(p => <li key={p.title}>{tick}<span><b>{p.title}.</b> <span className="pk-proof-line">{p.line}</span></span></li>)}</ul>;
}

function Compare() {
  return (
    <section aria-labelledby="compare-title">
      <div className="lp-wrap">
        <SectionHead id="compare-title" title={packCopy.compare.title} titleEm={packCopy.compare.titleEm} lead={packCopy.compare.lead} />
        <Proof grid />
        <div className="lp-card pk-compare">
          <table>
            <thead><tr><th scope="col"><span className="sr-only">What you get</span></th><th scope="col">Plumi pack</th><th scope="col">Typical paid pack</th></tr></thead>
            <tbody>{packCopy.compare.rows.map(([what, ours, theirs]) => <tr key={what}><th scope="row">{what}</th><td>{ours}</td><td>{theirs}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section aria-labelledby="faq-title">
      <div className="lp-wrap">
        <SectionHead id="faq-title" title="Questions" />
        <div className="lp-faq">{packCopy.faq.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
      </div>
      <FaqSchema faq={packCopy.faq} />
    </section>
  );
}

export function PackHub() {
  const intent = intentFor("/practice-papers");
  return (
    <CosyPage after={<>
      <PageStructuredData path="/practice-papers" name={intent.title} description={intent.description} type="CollectionPage" breadcrumb={[{ name: packCopy.section, path: "/practice-papers" }]} />
      <PackClickTracker />
    </>}>
      <article className="pp">
        <header className="lp-wrap pp-hero">
          <span className="lp-eyebrow">{packCopy.section} · free, no sign-up</span>
          <h1>{packCopy.hubTitle} <em>{packCopy.hubTitleEm}</em></h1>
          <p className="lp-lead">{packCopy.hubLead}</p>
          <ul className="pp-facts" aria-label="At a glance">
            <li><strong>{practicePacks.length}</strong><span>packs</span></li>
            <li><strong>{packTotals.questions}</strong><span>questions</span></li>
            <li><strong>{packTotals.marks.toLocaleString("en-GB")}</strong><span>marks</span></li>
            <li><strong>£0</strong><span>no sign-up</span></li>
          </ul>
        </header>

        <section aria-label="The packs" className="pp-group">
          <div className="lp-wrap">
            <ul className="pk-hub-packs">
              {practicePacks.map(p => (
                <li key={p.slug} className="lp-card pk-hub-pack">
                  <Link href={packPath(p.slug)} tabIndex={-1} aria-hidden="true"><PackCover pack={p} small /></Link>
                  <div className="pk-hub-pack-copy">
                    <h2><Link href={packPath(p.slug)}>{display(`${p.board}-style ${p.title}`)}</Link></h2>
                    <p>{p.questions.length} questions · {p.marks} marks · about {p.hours} hours, in three sittings. {p.sections.map(s => s.name).join(", ")}.</p>
                    <PackLadder pack={p} legend />
                    <PackDownloads pack={p} placement="packs-hub" />
                    <p className="pk-small"><Link href={packPath(p.slug)}>See all {p.questions.length} questions ›</Link> · {p.disclaimer}</p>
                  </div>
                </li>
              ))}
              <li className="pk-soon"><span><b>More subjects soon</b>We’re writing packs for more subjects and boards.</span></li>
            </ul>
          </div>
        </section>

        <section className="pp-mark-wrap" aria-label="Past papers">
          <div className="lp-wrap"><PastPapersCard placement="packs-hub" /></div>
        </section>

        <Compare />

        <section className="pp-mark-wrap" aria-label="Get your answers marked">
          <div className="lp-wrap"><MarkItCard level="A-Level" placement="packs-hub" /></div>
        </section>

        <Faq />
      </article>
    </CosyPage>
  );
}

export function PackPage({ pack }: { pack: PracticePack }) {
  const path = packPath(pack.slug);
  const meta = packPageMeta(pack);
  const others = practicePacks.filter(p => p.slug !== pack.slug);

  return (
    <CosyPage after={<>
      <PageStructuredData path={path} name={meta.title} description={meta.description} image={packShareImage(pack)}
        breadcrumb={[{ name: packCopy.section, path: "/practice-papers" }, { name: packName(pack), path }]} />
      <PackClickTracker />
    </>}>
      <article className="pp">
        <header className="lp-wrap pk-hero">
          <div className="pk-hero-copy">
            <nav className="pp-crumbs" aria-label="Breadcrumb">
              <Link href="/practice-papers">{packCopy.section}</Link><span aria-hidden="true">›</span>
              <span aria-current="page">{display(`${pack.board}-style ${pack.title}`)}</span>
            </nav>
            <span className="lp-eyebrow">{packCopy.eyebrow}</span>
            <h1>{display(pack.title)} practice pack, <em>{pack.board}-style</em></h1>
            <p className="lp-lead">
              {pack.questions.length} exam-style questions across {pack.sections.map(s => s.name).join(", ").replace(/, ([^,]*)$/, " and $1")}, climbing from easy to super hard, with a full mark scheme. Free to download, no sign-up.
            </p>
            <ul className="pp-facts" aria-label="At a glance">
              <li><strong>{pack.questions.length}</strong><span>questions</span></li>
              <li><strong>{pack.marks}</strong><span>marks</span></li>
              <li><strong>~{pack.hours}h</strong><span>in 3 sittings</span></li>
              <li><strong>{pack.spec}</strong><span>{pack.board} specification</span></li>
            </ul>
            <PackDownloads pack={pack} placement="pack-hero" />
            <p className="pk-small">You need {pack.equipment}. {pack.disclaimer}</p>
          </div>
          <div className="pk-hero-cover">
            <Tape />
            <Image src={packImage(pack, "cover")} width={900} height={1274} priority sizes="(max-width: 980px) 320px, 360px"
              alt={`The cover of Plumi's ${packName(pack)} practice pack: ${pack.questions.length} questions, ${pack.marks} marks, in three sections.`} />
            <span className="pk-stamp" aria-hidden="true">Free</span>
          </div>
        </header>

        <section aria-labelledby="inside-title">
          <div className="lp-wrap">
            <SectionHead id="inside-title" eyebrow="What’s inside" title="Every question," titleEm="before you download."
              lead="Three sections, ten questions each. Each one starts with a warm-up and ends with three stretch-and-challenge questions." />
            <ul className="pk-sections">
              {pack.sections.map(s => (
                <li key={s.letter} className="lp-card pk-section">
                  <small>Section {s.letter} · {s.marks} marks</small>
                  <b>{s.name}</b>
                  <p>{s.content}</p>
                </li>
              ))}
            </ul>
            <div className="lp-card pk-contents">
              <div className="pk-contents-head">
                <h3 className="pp-group-title">All {pack.questions.length} questions</h3>
                <PackLadder pack={pack} legend />
              </div>
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead><tr><th scope="col">Q</th><th scope="col">Level</th><th scope="col">Topic</th><th scope="col">Marks</th></tr></thead>
                  <tbody>
                    {pack.sections.flatMap(s => [
                      <tr key={s.letter} className="pk-sec-row"><th colSpan={4} scope="rowgroup">Section {s.letter}: {s.name}</th></tr>,
                      ...pack.questions.filter(q => q.section === s.letter).map(q => (
                        <tr key={q.n}>
                          <th scope="row">{q.n}</th>
                          <td><span className={`pk-pill ${levelClass(q.level)}`}>{q.level}</span></td>
                          <td>{q.topic}{q.spec && <> <span className="pk-spec">· {q.spec}</span></>}</td>
                          <td>{q.marks}</td>
                        </tr>
                      )),
                    ])}
                  </tbody>
                  <tfoot><tr><th scope="row" colSpan={3}>Total</th><td>{pack.marks}</td></tr></tfoot>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="pages-title">
          <div className="lp-wrap">
            <SectionHead id="pages-title" eyebrow="A look inside" title="Set out like the" titleEm="real thing." lead={pack.checked} />
            <div className="pk-samples">
              <figure className="lp-card pk-sample">
                <WindowBar label="questions.pdf" />
                <Image src={packImage(pack, "question")} width={900} height={1274} sizes="(max-width: 980px) 92vw, 560px" alt={`A page of the question paper: ${pack.samples.question}.`} />
                <figcaption>{pack.samples.question}</figcaption>
              </figure>
              <figure className="lp-card pk-sample">
                <WindowBar label="mark-scheme.pdf" />
                <Image src={packImage(pack, "scheme")} width={900} height={1274} sizes="(max-width: 980px) 92vw, 560px" alt={`A page of the mark scheme: ${pack.samples.scheme}.`} />
                <figcaption>{pack.samples.scheme}</figcaption>
              </figure>
            </div>
            <div style={{ marginTop: 30 }}><PackDownloads pack={pack} placement="pack-samples" /></div>
          </div>
        </section>

        <Compare />

        <section className="pp-mark-wrap" aria-label="Get your answers marked">
          <div className="lp-wrap"><MarkItCard level="A-Level" placement={`pack-${pack.slug}`} /></div>
        </section>

        <section aria-labelledby="more-title" className="pp-more">
          <div className="lp-wrap">
            <h2 id="more-title" className="pp-group-title">More practice</h2>
            <nav className="lp-sp-more" aria-label="More practice">
              {others.map(p => <Link key={p.slug} href={packPath(p.slug)}>{display(`${p.board}-style ${p.title}`)} pack</Link>)}
              <Link href={pack.pastPapers}>{pack.board} {display(pack.title.replace(/ [AB]$/, ""))} past papers</Link>
              <Link href={pack.bank}>{pack.board} {display(pack.title)} question bank</Link>
              <Link href="/practice-papers">All practice papers</Link>
            </nav>
          </div>
        </section>

        <Faq />
      </article>
    </CosyPage>
  );
}
