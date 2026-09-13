# Content plan — ten articles, ranked

Ten good articles beat a hundred generic ones, and not by a little. Google
treats scaled content produced mainly for rankings as spam, and a pre-launch
site with no authority is exactly the kind of site that gets caught doing it.

**The test each of these has to pass:** could Plumi write this better than a
content agency could? If the answer is no — if it is a summary of information
freely available on the exam board's own site — it is not on this list.

**Cadence:** one per fortnight, starting after the pages in
[keyword-map.md](./keyword-map.md) are indexed. Do not batch-publish.
Twenty articles appearing on a two-month-old domain in one week is a pattern.

**Where they live:** `/learn/<slug>`. Add each to `src/config/routes.ts` when
written, which puts it in the sitemap automatically.

---

## The ranking

Ordered by (student value × product fit) ÷ difficulty. The first three are the
ones to write even if you never get to the rest.

### 1. How A-Level Maths method marks actually work

- **Primary intent:** "method marks A-Level Maths", "how are A-Level Maths papers marked"
- **Why a student wants it:** Nearly every student has lost marks on a question
  they got right and does not understand why. This is genuinely confusing and
  badly explained everywhere.
- **Product fit:** Maximal. Plumi reads *method*, not answers. This article is
  the argument for the product without being an advert for it.
- **First-hand material:** Yes — real marked working from Tutor sessions,
  showing a wrong final answer that keeps most of its marks.
- **Links to:** `/ai-tutor-for-a-level-maths`, `/how-it-works`
- **CTA:** See how Plumi marks working → `/ai-tutor-for-a-level-maths`

### 2. How to find your weak topics before the exam, when everything feels equally familiar

- **Primary intent:** "how to find weak topics A-Level", "what should I revise"
- **Why a student wants it:** It is the actual problem. Choosing what to revise
  is the decision students are least equipped to make and it is made daily.
- **Product fit:** Maximal — this is the learner model's entire reason to exist.
- **First-hand material:** Yes. The seen-versus-secure distinction is a real
  product mechanic and a genuinely useful idea on its own.
- **Links to:** `/gcse-maths`, `/ai-tutor-for-a-level-maths`, `/how-it-works`
- **CTA:** Let Plumi find them → `/`

### 3. AI tutor vs ChatGPT for A-Level Maths: an honest comparison

- **Primary intent:** "ChatGPT for A-Level Maths", "is ChatGPT good for maths"
- **Why a student wants it:** They are already using ChatGPT and half-suspect it
  is not helping. High search volume, high commercial intent.
- **Product fit:** Strong, but **only if it is honest**. ChatGPT is genuinely
  good at some of this. Say so, clearly, and the piece on where it falls down
  becomes credible. A hatchet job reads as marketing and converts worse.
- **First-hand material:** Yes — run the same question through both and show it.
- **Links to:** `/ai-tutor-for-a-level-maths`, `/ai-handwriting-tutor`
- **CTA:** Try the one that reads your working → `/ai-tutor-for-a-level-maths`

### 4. Integration by parts: the four mistakes that cost the most marks

- **Primary intent:** "integration by parts mistakes", "integration by parts A-Level"
- **Why a student wants it:** Specific, painful, searched constantly.
- **Product fit:** Strong. Plumi's captures are already integration working.
- **First-hand material:** Yes, and this is where it gets interesting — once
  there is usage data, "the four mistakes" can be *measured* rather than
  guessed. That version of this article is linkable in a way the guessed version
  is not.
- **Links to:** `/ai-tutor-for-a-level-maths`
- **CTA:** Practise the one you keep getting wrong → `/`

### 5. The best way to use an iPad for A-Level Maths

- **Primary intent:** "iPad for A-Level Maths", "iPad study setup"
- **Why a student wants it:** They have just been given an iPad and want to set
  it up properly. Buying-adjacent intent, and it converts.
- **Product fit:** Strong via `/ipad-study-app`.
- **First-hand material:** Partly. Be genuinely useful about Split View, PDF
  past papers and folder structure, not just about Plumi.
- **Links to:** `/ipad-study-app`, `/goodnotes-alternative-for-students`
- **CTA:** The notebook half is free → `/ipad-study-app`

### 6. Goodnotes vs Notability vs Plumi for students

- **Primary intent:** "Goodnotes vs Notability", "best note app for students"
- **Why a student wants it:** Very high volume, permanently searched.
- **Product fit:** Strong, with the same caveat as #3 — those are good apps, and
  a comparison that pretends otherwise is worthless. The honest version is the
  persuasive one.
- **First-hand material:** Partly. Needs real hands-on with both.
- **Links to:** `/goodnotes-alternative-for-students`, `/ipad-study-app`
- **CTA:** Notes free, tutoring paid → `/goodnotes-alternative-for-students`

### 7. How to revise when you do not know what you do not know

- **Primary intent:** "how to revise effectively", "revision techniques that work"
- **Why a student wants it:** Broad and heavily contested, but it is the
  emotional core of the product.
- **Product fit:** Strong conceptually, weak commercially — this attracts
  readers rather than buyers.
- **First-hand material:** Some. Lean on the retrieval-practice literature and
  cite it properly; the citations are what make it linkable.
- **Links to:** `/how-it-works`, `/gcse-maths`
- **CTA:** soft — `/about`

### 8. What "secure" in a topic actually means, and why reading your notes is not it

- **Primary intent:** "active recall vs rereading", "why rereading notes doesn't work"
- **Why a student wants it:** Counterintuitive, well-supported by research, and
  most students are doing the wrong thing.
- **Product fit:** Direct — it is the seen-versus-secure mechanic, argued from
  evidence rather than from product design.
- **First-hand material:** Cite the literature honestly. Do not overclaim.
- **Links to:** `/how-it-works`, `/gcse-maths`
- **CTA:** soft — `/how-it-works`

### 9. Every A-Level Maths exam board compared: Edexcel, AQA, OCR

- **Primary intent:** "Edexcel vs AQA maths", "A-Level Maths exam board differences"
- **Why a student wants it:** Genuinely hard to find in one place.
- **Product fit:** Moderate, and it doubles as the honest home for Plumi's real
  specification coverage.
- **First-hand material:** Research-heavy rather than experience-heavy.
- **Why it is here anyway:** It is the most **linkable** thing on this list. A
  properly maintained comparison table is the kind of resource teachers and
  tutors link to without being asked — see
  [authority-plan.md](./authority-plan.md).
- **Links to:** `/ai-tutor-for-a-level-maths`, `/gcse-maths`
- **CTA:** soft

### 10. How to stop losing marks to careless slips

- **Primary intent:** "careless mistakes in maths exams", "silly mistakes maths"
- **Why a student wants it:** Universal frustration.
- **Product fit:** Moderate. Honest, and honestly hard to make non-generic —
  which is why it is tenth.
- **First-hand material:** Only once there is real data on where slips cluster.
  **Do not write this one until that data exists**; without it, it becomes
  exactly the generic filler this list is meant to avoid.
- **Links to:** `/ai-tutor-for-a-level-maths`
- **CTA:** soft

---

## Rules for writing these

- **British English.** Maths, practise (verb), practice (noun), revision.
- **Concrete nouns.** "Integration by parts", "three marks", "OCR H556". The
  same rule the rest of the site follows, for the same reason: specificity is
  the only affordable proof when there are no testimonials.
- **No claim the product cannot support.** Plumi has not launched. If an article
  implies otherwise it damages the only asset a pre-launch site has.
- **A word count is not a target.** Say the thing and stop. A 700-word article
  that answers the question outranks 2,000 words of preamble.
- **One clear CTA**, at the end, to the relevant landing page — not a banner
  every three paragraphs.
- **Do not publish a draft an LLM wrote unedited.** Every one of these is
  supposed to contain something only Plumi knows.
