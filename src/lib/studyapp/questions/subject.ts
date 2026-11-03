/** What the picker needs of a bank subject: its names and its topic tree. Made on the server (the route in app/study/(app)/questions/subjects), read by the browser. */
export interface SubjectTopic { code: string; ref?: string; title: string; short?: string; section: string; count: number }
export interface SubjectMeta {
  slug: string;
  title: string;
  board: string;
  level: string;
  subject: string;
  cv?: number;
  /** Examiner's reports are keyed by question (Edexcel). */
  rq?: 1;
  topics: SubjectTopic[];
  sections: { code: string; title: string }[];
  papers: { id: string; name: string }[];
  series: { id: string; label: string }[];
}

/** One line of the subject chooser. */
export interface CatalogueSubject { slug: string; title: string; board: string; level: string; subject: string; count: number }

/** "3.1.2 Amount of substance", "Momentum": how a topic reads on a chip. */
export const topicLabel = (t: SubjectTopic) => { const ref = t.ref ?? t.code; return ref && ref !== t.title ? `${ref} ${t.short ?? t.title}` : t.short ?? t.title; };
