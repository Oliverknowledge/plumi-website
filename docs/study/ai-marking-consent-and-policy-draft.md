# AI marking on the web: consent screen and privacy policy wording (DRAFT for a lawyer)

**Status: draft. Not live, not wired up, not legal advice.** Nothing here is in `src/content/legal.ts`. Putting it there before the
feature exists would make the policy say something untrue, and the website deploys from the `production` branch, so a merge to
`main` changes nothing live. Items marked **[LAWYER]** are questions I cannot answer.

The record behind it exists: migration `0129_aiConsent.sql` in the app repo (`ai_consents`, `ai_consent_status / give / withdraw`,
and the server-only `ai_consent_valid`). The marking function will refuse any request without a current consent at the wording
version it requires. Raise that version when the wording below changes materially, and every student is asked again.

## 1. The consent screen (version 1)

Shown the first time a signed-in student taps Mark, and only then. Rules from CLAUDE.md apply: a title, at most one short line,
the rest drawn; no em dashes; no pipeline words.

> **Let Plumi mark your answer?**
> Your answer is sent to DeepSeek, our AI provider, to be marked against the real mark scheme.
>
> - DeepSeek's computers may be outside the UK and the EU, including in China.  **[LAWYER]**
> - We don't send your name or email, and we don't keep your answer.
> - Never sold. Never used for adverts.
>
> **I am:**  (o) 18 or over   (o) Under 18
> *If under 18:* "Please show this to a parent or carer first."  [ ] I have shown a parent or carer.
>
> [ Yes, mark my answers ]   [ Not now ]  (mark yourself instead)
>
> *You can change your mind any time in Account.* Privacy policy (link)

Behaviour: "Not now" leaves self-marking exactly as it is, with no nagging. "Yes" calls `ai_consent_give('web_marking', 1, age_band,
parent_note_shown)`; under 18 cannot be recorded without the box ticked (the database refuses). Withdrawal in Account calls
`ai_consent_withdraw` and takes effect on the next request. The student chooses their own age band; no date of birth is collected.

## 2. Privacy policy changes (`src/content/legal.ts`, `privacy`)

Line references are to the version updated 5 Nov 2026.

| Line | Now | Replace with |
|---|---|---|
| 41 | "Answers you type into the question bank stay in your browser and are never sent to us." | "Answers you type into the question bank stay in your browser unless you ask Plumi to mark one. If you have turned on AI marking and you tap Mark, that answer (or a picture of your handwriting) is sent, through Plumi, to our AI provider DeepSeek, which marks it against the official mark scheme. Plumi does not keep a copy of it. We keep a count of how many marks you have used today and a record that you agreed." |
| ~107 | repeats that web answers never leave the browser | Same change; check every place the claim appears. |
| 25 / 36 | marking "in the app" | Add "or on the website" wherever marking is described, so the policy covers both. |
| 51 | consent "which you give in the app and can withdraw at any time in Account" | "...which you give in the app or on the website, and can withdraw at any time in Account." |
| 61 / 62 / 73 | Supabase relays AI requests; DeepSeek may be outside the UK and the EU | Keep. Add that on the website the request also passes through a Plumi server function, which records only how many tokens were used. |
| 83 | "What the AI provider keeps is governed by its own policy." | Keep. **[LAWYER]** this is the weakest sentence: we have not verified DeepSeek's retention or training terms for API data. |
| new | (none) | "Your age band (under 18 or 18 and over) and the version of this notice you agreed to are stored with your account, so we can show you agreed. They are deleted when you delete your account." |
| 91 | children | Add: "If you are under 18, we ask you to show a parent or carer before you turn on AI marking. This is not a substitute for their permission." |

## 3. Questions for a lawyer or Daniel

1. **Is consent alone a valid basis to send under-18s' work to DeepSeek, which may process in China?** UK GDPR Chapter V needs an
   adequacy decision, appropriate safeguards (an IDTA and a transfer risk assessment) or a derogation. The derogation for explicit
   consent is meant for occasional, not systematic, transfers; a daily marking service is systematic. If this fails, the answer is a UK
   or EU-hosted model, not better wording.
2. **A DPIA** is expected before a service likely to be used by children sends their data to a new processor (ICO Children's Code).
   None exists. It should be signed off before any real student's answer is sent.
3. **Parental involvement.** The note asks a student to show a parent or carer. Is that enough, or is parental consent needed
   for 13 to 15 year olds (digital age of consent in the UK is 13)? The iPad's own screen says it is "NOT PARENTAL CONSENT".
4. **DeepSeek's terms:** retention, training use, sub-processors, deletion on request.
5. **Exam board content.** Mark scheme text is sent to the model and stored as structured packs. Board reuse terms.
6. **The App Privacy label** on the App Store lists User Content as not collected (founder-morning-steps.md); check it against reality.
7. Does the marketing rule "no prices, plans or Pro on any page" need a carve-out for the consent screen and the success page?

## 4. Not built

The consent screen component, the Account toggle to withdraw, the policy edits, and the marking function that calls
`ai_consent_valid`. Each waits for this wording to be approved.
