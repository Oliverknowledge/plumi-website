"use client";

import { useRef, useState, type CSSProperties } from "react";

import { useInViewOnce } from "@/lib/useInViewOnce";
import { useMotionReady } from "@/lib/useMotionReady";

import { Section } from "@/components/ui/Section";
import { sections } from "@/content/copy";
import {
  bandColours,
  bandLabels,
  courseHeading,
  courseTree,
  coverageNote,
  defaultOpenCodes,
  evidenceLabel,
  granularityNote,
  treeCopy,
  type Band,
  type TopicNode,
} from "@/content/course";

/**
 * "It knows things" → "it knows MY course".
 *
 * The section is an expandable list rather than a tree diagram, and that is a
 * phone decision before it is a taste decision: a node-and-edge diagram of a
 * four-level specification has nowhere to go at 390px. A list indents, wraps and
 * collapses, and it is what the app's own Progress screen looks like anyway.
 *
 * Three things carry the argument, and all three are literal:
 *   · the board named in full, with its own specification code;
 *   · the board's own topic codes beside each title;
 *   · the fourth level, which is Plumi's, called out on its own.
 *
 * There are no percentages and no rings here, because there are none in the
 * app. A band is a word and four bars, and the bars are the app's own.
 */

const BARS: Record<Band, number> = {
  "not-started": 0,
  seen: 0,
  weak: 1,
  developing: 2,
  secure: 3,
  mastered: 4,
};

function panelId(code: string): string {
  return `topic-${code.replaceAll(".", "-")}`;
}

/**
 * The app's band indicator, off the Progress screen: four bars, filled to the
 * band, coloured by the band. Aria-hidden — the word beside it says the same
 * thing, and a screen reader should not have to sit through four rectangles.
 */
function BandBars({ band }: { band: Band }) {
  const filled = BARS[band];
  return (
    <span className="flex shrink-0 items-center gap-[3px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="block h-[5px] w-3 rounded-full"
          style={{
            backgroundColor: i < filled ? bandColours[band] : "var(--color-mastery-unseen)",
          }}
        />
      ))}
    </span>
  );
}

function BandCell({ band }: { band?: Band }) {
  if (!band) return null;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2.5 sm:order-1 sm:mt-[2px]">
      <span className="text-right text-[13px] leading-tight text-[var(--color-ink-secondary)]">
        {bandLabels[band]}
      </span>
      <BandBars band={band} />
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className={`mt-[3px] shrink-0 text-[var(--color-ink-tertiary)] transition-transform duration-200 ${
        open ? "rotate-90" : ""
      }`}
    >
      <path
        d="M6 3.5 L10.5 8 L6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Everything in a row except its marker, as loose flex items so the line breaks
 * can differ between the phone and the laptop without duplicating the markup.
 *
 *   phone   title                        laptop   title · CODE     Secure ▮▮▮▯
 *           3 pieces of evidence  Secure ▮▮▮▯     3 pieces of evidence
 *
 * The zero-height `basis-full` span is a flexbox line break, on the phone only.
 * Without it the band sits beside short titles and under long ones, and a list
 * that wraps differently row by row reads as a broken table.
 */
function RowBody({ node, depth }: { node: TopicNode; depth: number }) {
  return (
    <>
      <span className="flex min-w-0 grow basis-0 flex-wrap items-baseline gap-x-2.5">
        <span
          className={
            depth === 0
              ? "text-[15px] font-semibold text-[var(--color-ink)]"
              : depth === 1
                ? "text-[15px] font-medium text-[var(--color-ink)]"
                : "text-[15px] text-[var(--color-ink)]"
          }
        >
          {node.title}
        </span>
        {/* The board's own code. Muted and monospaced, because it is a reference
            rather than a label — but visible, because it is the proof. */}
        <span className="hidden font-mono text-[11px] tracking-tight text-[var(--color-ink-tertiary)] sm:inline">
          {node.code}
        </span>
      </span>

      <span className="basis-full sm:hidden" aria-hidden="true" />

      {node.evidence !== undefined && (
        <span className="text-[12px] leading-tight text-[var(--color-ink-tertiary)] sm:order-2 sm:basis-full sm:pl-7">
          {evidenceLabel(node.evidence)}
        </span>
      )}
    </>
  );
}

interface RowProps {
  node: TopicNode;
  depth: number;
  isOpen: (code: string) => boolean;
  toggle: (code: string) => void;
}

function Row({ node, depth, isOpen, toggle }: RowProps) {
  const children = node.children;
  const open = children ? isOpen(node.code) : false;

  // Indent comes off one custom property so the ladder stays proportional and
  // the phone gets a shallower one than the laptop.
  const style = { "--depth": depth } as CSSProperties;
  const pad =
    "pl-[calc(0.875rem+var(--depth)*0.875rem)] pr-4 sm:pl-[calc(1.25rem+var(--depth)*1.5rem)] sm:pr-6";

  return (
    <li className="border-t border-[var(--color-hairline)] first:border-t-0">
      {children ? (
        <button
          type="button"
          onClick={() => toggle(node.code)}
          aria-expanded={open}
          aria-controls={panelId(node.code)}
          style={style}
          className={`flex min-h-[46px] w-full flex-wrap items-start gap-x-3 gap-y-1 py-3 text-left transition-colors hover:bg-[var(--color-fill)] ${pad}`}
        >
          <Chevron open={open} />
          <RowBody node={node} depth={depth} />
          <BandCell band={node.band} />
          <span className="sr-only">{open ? treeCopy.collapseHint : treeCopy.expandHint}</span>
        </button>
      ) : (
        <div
          style={style}
          className={`flex min-h-[46px] w-full flex-wrap items-start gap-x-3 gap-y-1 py-3 ${pad}`}
        >
          {/* A leaf. The short rule says the ladder stops here. */}
          <span className="flex h-[22px] w-4 shrink-0 items-center justify-center" aria-hidden="true">
            <span className="block h-px w-2 bg-[var(--color-hairline-strong)]" />
          </span>
          <RowBody node={node} depth={depth} />
          <BandCell band={node.band} />
        </div>
      )}

      {children && (
        // Always in the DOM so `aria-controls` always resolves to something.
        <ul id={panelId(node.code)} hidden={!open}>
          {children.map((child) => (
            <Row
              key={child.code}
              node={child}
              depth={depth + 1}
              isOpen={isOpen}
              toggle={toggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function YourCourse() {
  // Deferred by one commit so the server and the first client render agree.
  // Branching straight off `useReducedMotion()` gives motion a different
  // `initial` on each side and leaves a hydration mismatch behind.
  const animate = useMotionReady();
  const tree = useRef<HTMLOListElement>(null);
  const shown = useInViewOnce(tree, { amount: 0.08 });
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(defaultOpenCodes));

  const isOpen = (code: string) => open.has(code);
  const toggle = (code: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });

  return (
    <Section copy={sections.yourCourse} tone="surface">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          {/* The board, named. This is the whole point of the section, so it is
              set at heading size and not tucked into a caption. */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-h3 font-medium text-[var(--color-ink)]">{courseHeading.course}</h3>
            <p className="font-mono text-[13px] tracking-tight text-[var(--color-blue-600)]">
              {courseHeading.spec}
            </p>
          </div>
          <p className="mt-2 text-sm text-[var(--color-ink-tertiary)]">{courseHeading.nodes}</p>

          <ol
            ref={tree}
            data-shown={animate ? shown : true}
            aria-label={treeCopy.listLabel}
            className="tree-reveal mt-6 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] shadow-[var(--shadow-resting)]"
          >
            {courseTree.map((node) => (
              <Row
                key={node.code}
                node={node}
                depth={0}
                isOpen={isOpen}
                toggle={toggle}
              />
            ))}
          </ol>
        </div>

        <div className="lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
          {/* The fourth level, called out. It is the only part of the tree that
              is Plumi's rather than the board's, and it is checkable against
              spec point 8.5 in about ten seconds. */}
          <div className="rounded-[var(--radius-card)] border border-[var(--color-hairline-strong)] bg-[var(--color-paper)] p-5 sm:p-6">
            <p className="eyebrow">{granularityNote.eyebrow}</p>
            <p className="mt-3 text-[15px] font-medium text-[var(--color-ink)]">
              “{granularityNote.boardWording}”
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-secondary)] text-pretty">
              {granularityNote.body}
            </p>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-[var(--color-ink-tertiary)] text-pretty">
            {coverageNote}
          </p>
        </div>
      </div>
    </Section>
  );
}
