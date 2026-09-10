/**
 * The two legal pages.
 *
 * Written to be read, not to be survived: short sentences, no defined terms, no
 * "the Company reserves the right". A student who is about to hand over an
 * email address should be able to find out what happens to it in under a
 * minute.
 *
 * ── The rule that governs this file ──────────────────────────────────────────
 * Every sentence describes something the site actually does, checkable against
 * the code: `src/app/api/waitlist/route.ts`, `src/lib/waitlist/store.ts`,
 * `src/lib/attribution.ts` and `src/lib/analytics.ts`.
 *
 * Where a real-world fact is needed and nobody has decided it yet — the legal
 * entity, the registered address, the governing law — there is a `todo` block
 * that renders visibly on the page. An obvious gap is a smaller problem than an
 * invented company number, which is a false statement in a legal document.
 * There is no invented postal address, no invented registration number and no
 * invented data-protection officer anywhere below.
 */

export type LegalBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: readonly string[] }
  /** Renders as a visible, clearly-marked gap. Founder must fill it in. */
  | { kind: "todo"; text: string };

export interface LegalSection {
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDoc {
  /** Page title, used for <h1> and metadata. */
  title: string;
  description: string;
  /** Displayed, and used as the machine-readable date. */
  updated: string;
  updatedIso: string;
  intro: string;
  sections: readonly LegalSection[];
}

const UPDATED = "10 September 2026";
const UPDATED_ISO = "2026-09-10";

/** Both documents need it, and it is the only address on the site. */
const CONTACT = "hello@tryplumi.app";

export const privacy: LegalDoc = {
  title: "Privacy",
  description:
    "What Plumi's website collects when you join the waitlist, what it doesn't, and how to be removed.",
  updated: UPDATED,
  updatedIso: UPDATED_ISO,
  intro:
    "Plumi hasn't launched. Right now this website does one thing that involves you: it takes an email address for the waitlist. This page is about that, and about the analytics behind it.",
  sections: [
    {
      heading: "Who is responsible for this",
      blocks: [
        {
          kind: "text",
          text: `Plumi is a small team building an iPad app for GCSE and A-Level students. Anything on this page, you can ask us about at ${CONTACT}.`,
        },
        {
          kind: "todo",
          text: "TODO(founder): name the legal entity that controls this data, and its registered address. UK GDPR requires the controller to be identifiable, and this page must say who that is before the site takes a single real signup.",
        },
        {
          kind: "todo",
          text: "TODO(founder): confirm whether the ICO data-protection fee applies to us and, if it does, add the registration number here.",
        },
      ],
    },
    {
      heading: "What we collect when you join the waitlist",
      blocks: [
        { kind: "text", text: "Only this:" },
        {
          kind: "list",
          items: [
            "Your email address.",
            "The subject and exam board you picked, if you picked them. Both are optional, and the form works without them. We only accept the exact options the form offers — anything else is thrown away rather than stored.",
            "Where you came from: the utm_source, utm_medium, utm_campaign, utm_content and utm_term parameters that were on the link you clicked, any advertising click identifier it carried, which version of the page you saw, and the host name of the site that linked to you. Not the full address of that page — just the host.",
            "A two-letter country code, worked out at the edge by our host.",
            "Your browser's user-agent string, and the date and time.",
          ],
        },
        {
          kind: "text",
          text: "Your IP address is used for a few milliseconds to rate-limit the form, and then discarded. It is not written down. We don't ask for your name, your age, your school or your phone number, and there is nowhere on this site to give them to us.",
        },
        {
          kind: "text",
          text: "The list lives in a Supabase database that only our server can read. The key that reads it never reaches your browser.",
        },
        {
          kind: "todo",
          text: "TODO(founder): once the Supabase project exists, state its region here — students and their parents are entitled to know which country their email address is sitting in. See docs/WAITLIST.md.",
        },
      ],
    },
    {
      heading: "Why we ask what you study",
      blocks: [
        {
          kind: "text",
          text: "Because we build the topic tree for each course by hand from the exam board's own specification, and we can only do a few at a time. Which courses people ask for decides the order we build them in. That's the entire use. It is not a profile, and it is not passed to anyone.",
        },
      ],
    },
    {
      heading: "What we do with your email address",
      blocks: [
        {
          kind: "text",
          text: "We send you two emails: one when your course is ready, one when we launch. That's what the list is for and that's all it does. We don't sell it, rent it, share it or use it for advertising.",
        },
        {
          kind: "text",
          text: "We keep it until you ask us to remove you, or until the waitlist has done its job after launch — whichever comes first.",
        },
      ],
    },
    {
      heading: "Analytics, and the line we don't cross",
      blocks: [
        {
          kind: "text",
          text: "We use PostHog, on its EU servers, to count how many people reach the page and how many get as far as the form. It is set up deliberately narrowly:",
        },
        {
          kind: "list",
          items: [
            "Person profiles are off, so PostHog is not building a record of you as an individual.",
            "Session recording is off. Nothing you type or point at is played back to us — and the only thing you can type on this site is your email address.",
            "Autocapture is off. We send a short list of named events we chose in advance, not everything you touch.",
            "Your email address is never sent to it. When you join the list we record that a signup happened and whether a course was picked. The address itself is stripped in code before anything leaves your browser.",
          ],
        },
        {
          kind: "text",
          text: "If analytics isn't configured for a deployment, or your browser blocks it, nothing about the site changes.",
        },
      ],
    },
    {
      heading: "Cookies and things stored in your browser",
      blocks: [
        {
          kind: "text",
          text: "No advertising cookies, no third-party trackers, no cookie banner to dismiss. Two things are stored on your device:",
        },
        {
          kind: "list",
          items: [
            "The link parameters you arrived with, kept in your browser's local and session storage so that the first thing that brought you here still gets the credit if you come back a week later.",
            "PostHog's own identifier for this browser, kept in local storage and a cookie, so a returning visit isn't counted twice.",
          ],
        },
        {
          kind: "text",
          text: "Clearing your browser data removes both, and the site carries on working.",
        },
      ],
    },
    {
      heading: "The app is a separate thing",
      blocks: [
        {
          kind: "text",
          text: "Plumi itself is local-first: it works offline and needs no account, and what you write stays on your iPad. When the app ships it will have its own privacy notice covering how it handles your work. This page covers the website only.",
        },
      ],
    },
    {
      heading: "Your rights, and the quick way to use them",
      blocks: [
        {
          kind: "text",
          text: "Under UK data protection law you can ask to see what we hold about you, correct it, or have it deleted, and you can object to us holding it at all. There is no form for this.",
        },
        {
          kind: "text",
          text: `Reply to any email we send you and say the word, and you're off the list. Or write to ${CONTACT}. Deleting a waitlist row takes seconds and we'd rather do it than argue.`,
        },
        {
          kind: "text",
          text: "If you think we've handled your data badly, you can complain to the Information Commissioner's Office at ico.org.uk. We'd appreciate the chance to fix it first.",
        },
      ],
    },
    {
      heading: "Changes to this page",
      blocks: [
        {
          kind: "text",
          text: "If this changes in a way that matters — a new thing collected, a new company involved — we'll email the people on the list rather than quietly editing the date at the top.",
        },
      ],
    },
  ],
};

export const terms: LegalDoc = {
  title: "Terms",
  description:
    "The terms for using Plumi's website and joining the waitlist, before the app has launched.",
  updated: UPDATED,
  updatedIso: UPDATED_ISO,
  intro:
    "This website describes an app that hasn't launched yet, and lets you join a waitlist. These terms cover the website. They are not the terms for the app, which will have its own when it ships.",
  sections: [
    {
      heading: "What this site is",
      blocks: [
        {
          kind: "text",
          text: "A description of Plumi, an iPad notebook for GCSE and A-Level students, and a form to hear about it. Everything shown is the real app rather than a mock-up, but it is a product still being built: features described here can change before release, and some may not ship at all.",
        },
        {
          kind: "text",
          text: "Nothing on this site is an offer, a contract or a promise to supply anything. There is no launch date on this site because we haven't set one, and there are no prices because none have been set.",
        },
      ],
    },
    {
      heading: "Joining the waitlist",
      blocks: [
        {
          kind: "text",
          text: "Joining costs nothing and gets you two emails: one when your course is ready, one when we launch. It doesn't reserve you a place, guarantee access, or entitle you to a price.",
        },
        {
          kind: "text",
          text: "Use an address you actually control. Please don't put someone else's email in the form.",
        },
        {
          kind: "text",
          text: "You can leave at any time by replying to any email from us. See the privacy page for what we hold and how to have it deleted.",
        },
      ],
    },
    {
      heading: "If you're under 18",
      blocks: [
        {
          kind: "text",
          text: "Most of the people this app is for are at school, and that's fine — the site is written for them. If you're under 13, please ask a parent or guardian before giving us your email address.",
        },
      ],
    },
    {
      heading: "Using the site sensibly",
      blocks: [
        {
          kind: "text",
          text: "Don't attack it, scrape it wholesale, or automate the form. The waitlist is rate-limited and repeated submissions will simply be refused.",
        },
      ],
    },
    {
      heading: "What belongs to whom",
      blocks: [
        {
          kind: "text",
          text: "The words, design, illustrations and code on this site are ours. You're welcome to link to it, quote it and screenshot it — including to argue with it.",
        },
        {
          kind: "text",
          text: "AQA, OCR, Pearson Edexcel, WJEC and every other exam board named here are named because students take their qualifications. Their names and specifications belong to them. Plumi is not endorsed by, affiliated with or approved by any exam board, and we don't claim to be.",
        },
      ],
    },
    {
      heading: "No guarantees about the site itself",
      blocks: [
        {
          kind: "text",
          text: "The site is provided as it is. We try to keep it accurate and available, but we can't promise it will always be up, or that everything described will ship exactly as described. To the extent the law allows, we're not liable for loss arising from relying on a pre-launch marketing page.",
        },
        {
          kind: "text",
          text: "Nothing here limits liability that cannot legally be limited.",
        },
      ],
    },
    {
      heading: "Law and contact",
      blocks: [
        {
          kind: "todo",
          text: "TODO(founder): name the legal entity these terms are with, its registered address, and the governing law and courts (England and Wales is the expected answer, but it should be confirmed rather than assumed).",
        },
        { kind: "text", text: `Questions about any of this: ${CONTACT}.` },
      ],
    },
  ],
};
