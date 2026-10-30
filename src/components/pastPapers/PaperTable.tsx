import { fileKindLabel, fileKinds, fileUrl, type FileKind, type Paper, type PaperRow } from "@/content/pastPapers";
import { DoneTick } from "./DoneTick";

/** Sittings shown before the rest fold away. Cambridge papers run past a hundred. */
const RECENT = 12;

/**
 * One paper's sessions, newest first: a row per sitting, a column per kind of file
 * the paper actually has. A column no session fills is left out, so a page of
 * question papers and mark schemes is two columns, not six with four empty.
 *
 * The visible labels are short ("QP", "MS") so the table fits a phone; the
 * accessible name of each link is the whole thing ("AQA A-Level Chemistry Paper 1,
 * June 2024, mark scheme (PDF)"), which is what a screen reader says.
 *
 * Long histories show the latest twelve sittings and fold the rest into a
 * <details>: still in the HTML, so still found, but not a wall to scroll past.
 *
 * Each sitting starts with a tickbox, to keep track of the papers done (`DoneTick`, kept in the browser).
 */
export function PaperTable({ paper, heading, track }: { paper: Paper; heading: string; track: string }) {
  const kinds = fileKinds.filter(kind => paper.rows.some(row => row.files[kind]));
  const more = paper.rows.some(row => row.more?.length);
  const recent = paper.rows.slice(0, RECENT);
  const older = paper.rows.slice(RECENT);
  const props = { paper, heading, track, kinds, more };
  return (
    <div className="pp-table-wrap">
      <Table rows={recent} {...props} />
      {older.length > 0 && (
        <details className="pp-older">
          <summary>{older.length} older sessions, back to {older.at(-1)?.session}</summary>
          <Table rows={older} {...props} />
        </details>
      )}
    </div>
  );
}

function Table({ rows, paper, heading, track, kinds, more }: { rows: PaperRow[]; paper: Paper; heading: string; track: string; kinds: FileKind[]; more: boolean }) {
  return (
    <table className="pp-table">
      <thead>
        <tr>
          <th scope="col" className="pp-done-head"><span className="pp-done-mark" aria-hidden="true">✓</span><span className="sr-only">Done</span></th>
          <th scope="col">Session</th>
          {kinds.map(kind => <th key={kind} scope="col"><abbr title={fileKindLabel[kind].long}>{fileKindLabel[kind].short}</abbr></th>)}
          {more && <th scope="col">More</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.session}>
            <td className="pp-done-cell"><DoneTick paper={track} session={row.session} label={`${heading} ${paper.name}, ${row.session}`} /></td>
            <th scope="row">{row.session}</th>
            {kinds.map(kind => {
              const href = row.files[kind];
              if (!href) return <td key={kind}><span className="pp-none" aria-label="Not available">·</span></td>;
              const name = `${heading} ${paper.name}, ${row.session}, ${fileKindLabel[kind].long.toLowerCase()}`;
              return (
                <td key={kind}>
                  <a className={`pp-file is-${kind}`} href={fileUrl(href)} target="_blank" rel="noopener" title={name}
                    aria-label={`${name} (PDF)`}
                    data-paper={track} data-kind={kind} data-session={row.session}>
                    {fileKindLabel[kind].short}
                  </a>
                </td>
              );
            })}
            {more && (
              <td className="pp-more-files">
                {row.more?.map(x => (
                  <a key={x.href} className="pp-file is-more" href={fileUrl(x.href)} target="_blank" rel="noopener"
                    aria-label={`${heading} ${paper.name}, ${row.session}, ${x.label} (PDF)`} data-paper={track} data-kind="more" data-session={row.session}>
                    {x.label}
                  </a>
                ))}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
