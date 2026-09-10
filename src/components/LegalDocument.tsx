import type { LegalDoc } from "@/content/legal";

/**
 * The frame both legal pages share.
 *
 * One narrow column, generous leading, headings a student can scan. A legal
 * page that nobody can read is the same as no legal page, and this site is
 * collecting email addresses from sixteen-year-olds.
 *
 * `todo` blocks render visibly and look like what they are: an unfilled gap,
 * not a fact. See the note at the top of src/content/legal.ts.
 */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <article className="container-plumi pt-[calc(var(--header-height)+3rem)] pb-24 sm:pb-32">
      <header className="measure">
        <h1 className="text-h1 font-medium text-balance">{doc.title}</h1>
        <p className="mt-4 text-sm text-[var(--color-ink-tertiary)]">
          Last updated <time dateTime={doc.updatedIso}>{doc.updated}</time>
        </p>
        <p className="mt-6 text-lead text-[var(--color-ink-secondary)] text-pretty">{doc.intro}</p>
      </header>

      <div className="measure mt-14">
        {doc.sections.map((section) => (
          <section key={section.heading} className="mt-12 first:mt-0">
            <h2 className="text-h3 font-medium text-balance">{section.heading}</h2>

            {section.blocks.map((block, index) => {
              const key = `${section.heading}-${index}`;

              if (block.kind === "list") {
                return (
                  <ul key={key} className="mt-4 space-y-3">
                    {block.items.map((item) => (
                      <li
                        key={item}
                        className="relative pl-6 text-[var(--color-ink-secondary)] text-pretty before:absolute before:top-[0.6em] before:left-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--color-hairline-strong)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                );
              }

              if (block.kind === "todo") {
                return (
                  <p
                    key={key}
                    className="mt-4 rounded-[var(--radius-card)] border border-dashed border-[var(--color-hairline-strong)] bg-[var(--color-fill)] px-4 py-3 font-mono text-sm text-[var(--color-ink-secondary)] text-pretty"
                  >
                    {block.text}
                  </p>
                );
              }

              return (
                <p key={key} className="mt-4 text-[var(--color-ink-secondary)] text-pretty">
                  {block.text}
                </p>
              );
            })}
          </section>
        ))}
      </div>
    </article>
  );
}
