import { CosyPage } from "@/components/cosy/Chrome";
import type { LegalDoc } from "@/content/legal";
import "@/app/pages.css";

/**
 * The page both legal notices share: one sheet of the cosy notebook, a comfortable
 * measure, generous leading, ordinary-sized body text and headings a student can scan.
 * A legal page that nobody can read is the same as no legal page.
 *
 * `todo` blocks render visibly and look like what they are: an unfilled gap,
 * not a fact. See the note at the top of src/content/legal.ts.
 */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <CosyPage>
      <article className="lp-legal">
        <div className="lp-wrap">
          <div className="lp-card lp-doc">
            <header>
              <h1>{doc.title}</h1>
              <p className="lp-doc-date">
                Last updated <time dateTime={doc.updatedIso}>{doc.updated}</time>
              </p>
              <p className="lp-doc-intro">{doc.intro}</p>
            </header>

            {doc.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>

                {section.blocks.map((block, index) => {
                  const key = `${section.heading}-${index}`;
                  if (block.kind === "list") {
                    return <ul key={key}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
                  }
                  if (block.kind === "todo") {
                    return <p key={key} className="lp-doc-todo">{block.text}</p>;
                  }
                  return <p key={key}>{block.text}</p>;
                })}
              </section>
            ))}
          </div>
        </div>
      </article>
    </CosyPage>
  );
}
