"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import {
  addOwnPaper, cleanLink, cleanTitle, noOwnPapers, OWN_TITLE_MAX, readOwnPapers, removeOwnPaper, subscribeOwnPapers, updateOwnPaper,
  type OwnPaper,
} from "@/lib/ownPapers";
import { DoneTick, setPaperDone } from "./DoneTick";

const ADD = "add";

/**
 * "Your own papers" on a board page: entries a student adds for papers Plumi doesn't host, ticked off
 * like the board's own. Everything here stays in the browser (lib/ownPapers.ts). The links carry no
 * data-paper, so PaperClickTracker ignores them, and analytics never gets a name or a link.
 * The page passes the card's `bar` in, which keeps the server-only Chrome.tsx out of this client bundle.
 */
export function OwnPapers({ board, heading, bar }: { board: string; heading: string; bar: ReactNode }) {
  const papers = useSyncExternalStore(subscribeOwnPapers, () => readOwnPapers(board), noOwnPapers);
  const [open, setOpen] = useState<string | null>(null);
  const focusNext = useRef<string | null>(null);
  const links = papers.some(p => p.url);
  const paperKey = `own:${board}`;

  useEffect(() => {
    if (focusNext.current) document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  }, [open]);

  const close = (focus: string) => { focusNext.current = focus; setOpen(null); };

  return (
    <section id="own-papers" aria-labelledby="own-papers-title" className="pp-group pp-own">
      <div className="lp-wrap">
        <h2 id="own-papers-title" className="pp-group-title">Your own papers</h2>
        <p className="lp-lead">Got a paper that isn’t on this page, like a practice set or one from your teacher? Add its name and tick it off with the others.</p>
        <div className="lp-card pp-paper">
          {bar}
          <div className="pp-paper-body">
            {papers.length > 0 && (
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <thead>
                    <tr>
                      <th scope="col" className="pp-done-head"><span className="pp-done-mark" aria-hidden="true">✓</span><span className="sr-only">Done</span></th>
                      <th scope="col">Paper</th>
                      {links && <th scope="col">Link</th>}
                      <th scope="col"><span className="sr-only">Edit</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {papers.map(paper => (open === paper.id ? (
                      <tr key={paper.id}>
                        <td colSpan={links ? 4 : 3}>
                          <EntryForm paper={paper} save="Save"
                            onSave={(title, url) => { updateOwnPaper(board, paper.id, title, url); close(`own-edit-${paper.id}`); }}
                            onCancel={() => close(`own-edit-${paper.id}`)}
                            onDelete={() => { setPaperDone(`${paperKey}|${paper.id}`, false); removeOwnPaper(board, paper.id); close("own-add"); }} />
                        </td>
                      </tr>
                    ) : (
                      <tr key={paper.id}>
                        <td className="pp-done-cell"><DoneTick paper={paperKey} session={paper.id} label={`${heading} ${paper.title}`} /></td>
                        <th scope="row">{paper.title}</th>
                        {links && (
                          <td>
                            {paper.url
                              ? <a className="pp-file is-qp" href={paper.url} target="_blank" rel="noopener noreferrer" aria-label={`${paper.title}: open your link in a new tab`}>Open</a>
                              : <span className="pp-none" aria-label="No link">·</span>}
                          </td>
                        )}
                        <td className="pp-own-edit">
                          <button type="button" id={`own-edit-${paper.id}`} className="pp-file" aria-label={`Edit ${paper.title}`} onClick={() => setOpen(paper.id)}>Edit</button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
            {open === ADD ? (
              <EntryForm save="Add paper"
                onSave={(title, url) => {
                  addOwnPaper(board, title, url);
                  track("own_paper_added", { page: board, has_link: Boolean(url) });
                  close("own-add");
                }}
                onCancel={() => close("own-add")} />
            ) : (
              <button type="button" id="own-add" className="lp-btn pp-own-add" onClick={() => setOpen(ADD)}>+ Add a paper</button>
            )}
            <p className="pp-own-note">Only the name and link are saved, in this browser, the same as your ticks. No file is uploaded, nobody else can see them, and they won’t follow you to another device.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EntryForm({ paper, save, onSave, onCancel, onDelete }: {
  paper?: OwnPaper;
  save: string;
  onSave: (title: string, url: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(paper?.title ?? "");
  const [link, setLink] = useState(paper?.url ?? "");
  const [error, setError] = useState<"title" | "link" | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => { titleInput.current?.focus(); }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = cleanTitle(title);
    if (!name) { setError("title"); titleInput.current?.focus(); return; }
    const url = cleanLink(link);
    if (url === null) { setError("link"); linkInput.current?.focus(); return; }
    onSave(name, url);
  };
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };

  return (
    <form className="pp-own-form" noValidate onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="pp-own-field">
        <label htmlFor={`${id}-title`}>Name</label>
        <input ref={titleInput} id={`${id}-title`} value={title} maxLength={OWN_TITLE_MAX} placeholder="Practice paper Set 1" autoComplete="off"
          aria-invalid={error === "title"} aria-describedby={error === "title" ? `${id}-error` : undefined}
          onChange={e => { setTitle(e.target.value); setError(null); }} />
      </div>
      <div className="pp-own-field">
        <label htmlFor={`${id}-link`}>Link to your copy <span>(optional)</span></label>
        <input ref={linkInput} id={`${id}-link`} value={link} inputMode="url" placeholder="drive.google.com/…" autoComplete="off" autoCapitalize="none" spellCheck={false}
          aria-invalid={error === "link"} aria-describedby={error === "link" ? `${id}-error` : undefined}
          onChange={e => { setLink(e.target.value); setError(null); }} />
      </div>
      {error && (
        <p id={`${id}-error`} className="pp-own-error" role="alert">
          {error === "title" ? "Give it a name first." : "That isn’t a web link. Try a share link from Google Drive or OneDrive."}
        </p>
      )}
      <div className="pp-own-actions">
        <button type="submit" className="lp-btn pp-own-add">{save}</button>
        <button type="button" className="pp-own-text" onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className="pp-own-text is-delete" onClick={onDelete}>Delete</button>}
      </div>
    </form>
  );
}
