export type LegalBlock = { kind: "text"; text: string } | { kind: "list"; items: readonly string[] } | { kind: "todo"; text: string };
export interface LegalSection { heading: string; blocks: readonly LegalBlock[] }
export interface LegalDoc { title: string; description: string; updated: string; updatedIso: string; intro: string; sections: readonly LegalSection[] }
const updated = "14 October 2026";
const updatedIso = "2026-10-14";
const privacyUpdated = "27 October 2026";
const privacyUpdatedIso = "2026-10-27";
/**
 * Rewritten 27 October 2026 to cover the app as well as the website. The App Store listing and the
 * app's consent screen both link here, and the previous text said it covered the website only and that
 * "the app has its own privacy notice inside it": the app has none, so the policy a student was sent to
 * said nothing about accounts, the AI provider, the library or advert measurement. Everything below is
 * written from what the app and its servers do (the privacy manifest in the app, the Supabase
 * migrations and the AI relay). When a data flow is added or removed, this changes in the same commit.
 */
export const privacy: LegalDoc = {
  title: "Privacy Policy", description: "How the Plumi app and website handle your information: what we collect, why, who receives it, how long we keep it and what you can do.", updated: privacyUpdated, updatedIso: privacyUpdatedIso,
  intro: "This policy covers the Plumi app for iPad and iPhone and the Plumi website at tryplumi.app. It says what we collect, why, who receives it and what you can do about it. The short version: your notebook stays on your device, we never sell your information, the app shows no adverts, and you can delete your account inside the app.",
  sections: [
    { heading: "Who we are", blocks: [
      {kind:"text",text:"Plumi is made by Oliver Stevenson (“Plumi”, “we”). We decide how your personal information is used, which makes us the data controller. Contact us at hello@tryplumi.app for anything in this policy."},
    ] },
    { heading: "The short version", blocks: [{kind:"list",items:[
      "Your notebooks, handwriting and marked work are stored on your device. We do not keep a copy of them on our servers.",
      "When you ask Plumi to mark, explain or give a hint, the part of your work you asked about is sent, through Plumi, to our AI provider DeepSeek. This happens only after you agree, and you can say no or change your mind in Account.",
      "You do not need an account to use the app. An account lets you keep your subscription and use the social features.",
      "The social features (friends, groups, the Grand Library) are optional. In the Grand Library strangers see a random nickname, never your name, and nobody can message you privately.",
      "We never sell your information. The app shows no adverts, and nothing you write, draw or upload is shared for advertising.",
    ]}] },
    { heading: "What we collect", blocks: [
      {kind:"text",text:"Only what each feature needs."},
      {kind:"list",items:[
        "Your account, if you make one: your email address, your name if Sign in with Apple shares it, how you signed in (Apple, Google or an email code) and an account id. Your email is used to sign you in and to reach you about your account.",
        "Work you send to be marked or explained: a picture of the handwriting you asked about, text you typed, pictures or pages you placed on the notebook, text from your notes or a lecture recording when you ask Plumi to summarise it or make flashcards, and the question and mark scheme it belongs to. If you write your name or another person’s details on a page you ask us to mark, that is sent too, so please do not.",
        "What you set up for studying: your subjects, exam boards, exam dates and target grades, which stay on your device, and a small summary used to run the subscription.",
        "If you turn friends on: a display name, an avatar look, a friend code, your streak and level, your groups and the messages you send in them. In the Grand Library: a random nickname, where you are standing, whether you are seated, the subject you are studying and how long you have been studying. If you start a study session anywhere in the app while friends are on, you appear in the library as studying until the session ends. Chat messages are checked by automatic rules before they are sent.",
        "Reports and blocks: if you report or block someone, we keep the report and who made it so we can act on it.",
        "Your subscription: whether you have Plumi Pro and the plan, through Apple and our payments service. We never see your card details.",
        "Feedback you choose to send us.",
        "How the app is used: which screens were opened and which features were used, whether the app crashed, your app and iOS version, device type and the country your connection appears to be in. This does not include what you wrote or drew. Screen recording is off.",
        "If you agree to advert measurement: a random app id, whether you opened the app and started a free trial or subscription, and a rough location worked out from your connection, sent to Google so we can see which of our adverts worked.",
      ]},
      {kind:"text",text:"We do not collect your contacts, your precise location, your photos (except pictures you choose to place on a page) or your iPad’s advertising identifier. The microphone is used only when you record a lecture or dictate, and speech recognition for dictation is handled by Apple."},
    ] },
    { heading: "Why we use it, and our legal reasons", blocks: [{kind:"list",items:[
      "To run the app you asked for: accounts, sign-in, the subscription, the social features. Our legal reason is that it is needed to provide the service you signed up for (contract).",
      "To mark and explain your work with AI. Our legal reason is your consent, which you give in the app and can withdraw at any time in Account. Without it the AI features do not work and nothing is sent.",
      "To measure which adverts work. Our legal reason is your consent, asked separately in the app and again by Apple. You can say no and use everything.",
      "To keep the app safe and working: stopping abuse and spam in chat, fixing crashes, understanding which features help students and keeping our costs in check. Our legal reason is our legitimate interest in running a safe and sustainable service, balanced against your rights.",
      "To meet the law, for example keeping records we are required to keep.",
    ]}] },
    { heading: "Who receives it", blocks: [
      {kind:"text",text:"We use these services to run Plumi. Each receives only what it needs for its job, and none may use it to advertise to you."},
      {kind:"list",items:[
        "Supabase (hosting for accounts, the social features and the relay that passes AI requests on). Our database is in Frankfurt, Germany. The relay records how many tokens a request used and nothing of what it contained.",
        "DeepSeek (the AI that reads, marks and explains your work). It receives the work you asked about through Plumi’s relay. We do not add your name or email address to these requests. DeepSeek’s servers may be outside the UK and the EU, including in China. See “Moving information abroad” below.",
        "PostHog (usage and crash information), on its EU service.",
        "Superwall and Apple (the paywall, purchases and subscription status). Superwall receives your account id, your plan and general study settings such as subjects and exam year. It does not receive your name, email or anything you wrote.",
        "Apple (the App Store, Sign in with Apple, payments and dictation) and Google (Sign in with Google, and advert measurement if you agree).",
        "Our website hosting provider, Vercel, and Discord only if you choose to join the community from our website.",
        "Other people, only where you have chosen it: friends and group members see your display name and what you share; people in the Grand Library see your nickname and what you are studying; messages you send in a chat are seen by that chat.",
        "Authorities or others where the law requires, or to protect someone’s safety.",
      ]},
    ] },
    { heading: "Moving information abroad", blocks: [
      {kind:"text",text:"Some of these services are outside the UK. We use providers in the EU where we can (our database and usage information). Superwall and Google are in the United States and receive limited information as described above. DeepSeek may process the work you send to be marked on servers outside the UK and EU, including in China, which does not have the same data protection law as the UK. That is why it happens only after you agree, why we send only the work you ask about, and why you can say no and still use the rest of Plumi. If you do not want your work processed there, do not agree to the AI features."},
    ] },
    { heading: "How long we keep it", blocks: [{kind:"list",items:[
      "Your notebooks and marked work stay on your device until you delete them. We do not hold a copy.",
      "Account and social information is kept while your account exists and deleted when you delete your account.",
      "Chat messages are kept until they are removed or your account is deleted.",
      "Reports and blocks are kept as long as we need them to keep people safe.",
      "Usage and crash information is kept for a limited time and not longer than needed for the purposes above.",
      "What the AI provider keeps is governed by its own policy. We do not control it and cannot delete it for you, so please do not send anything you would not want a provider to hold.",
    ]}] },
    { heading: "Your choices and rights", blocks: [
      {kind:"text",text:"In the app, Account lets you change or withdraw your AI and advert-measurement choices, hide yourself from strangers in the Grand Library, sign out, and delete your account. Deleting your account removes your account and social information from our servers. You can also delete the work on your device when you delete the account, or delete the app."},
      {kind:"text",text:"You can ask us for a copy of the information we hold about you, to correct it, to delete it, to restrict or stop us using it, to move it, or to object to something we do on the basis of legitimate interests, by emailing hello@tryplumi.app. If you have given consent you can withdraw it at any time. We will reply within one month."},
      {kind:"text",text:"If you are unhappy with how we handle your information you can complain to the Information Commissioner’s Office at ico.org.uk. We would like the chance to put it right first."},
    ] },
    { heading: "Children and young people", blocks: [
      {kind:"text",text:"Plumi is for students preparing for GCSEs and A-levels, many of whom are under 18. We do not knowingly collect information from children under 13. If you are under 13, ask a parent or guardian before using Plumi, and do not create an account. Friends, groups and the Grand Library are off until you turn them on. There are no private messages with strangers, strangers see only a random nickname, chat is filtered, and you can report and block anyone. We do not use your information to show you adverts. A parent or guardian can email hello@tryplumi.app to ask for a child’s account and information to be deleted."},
    ] },
    { heading: "Keeping it safe", blocks: [
      {kind:"text",text:"Information is sent over encrypted connections. Our servers restrict each person to their own rows, and access to our systems is limited. No system is perfectly secure, so please use a sign-in method you trust and tell us at once if you think your account has been misused."},
    ] },
    /**
     * Rewritten 15 September 2026. The previous wording — "does not use a
     * signup form, advertising cookies, session recording or visitor
     * analytics" — was true when it was written and became false in three
     * places on the same day the launch-list form, the analytics and the Google
     * Ads tag went in. A privacy notice that describes an earlier version of a
     * site is worse than no notice, because it is a claim rather than an
     * omission. Whenever a measurement service is added or removed, this
     * section changes in the same commit.
     */
    { heading: "The website", blocks: [
      {kind:"text",text:"You can explore the website without creating an account or submitting an email address. Three measurement services run there and they do different things."},
      {kind:"list",items:[
        "Our own analytics records which sections of a page were read and which buttons were pressed, so we can tell whether the site explains Plumi well. It is hosted in the EU, it never creates a profile of you, it does not record your screen, and it never receives anything you type. Email addresses are stripped before any event leaves your browser.",
        "Vercel Web Analytics, from our hosting provider, counts page views and visitors so we can see how many people the site reaches. It sets no cookies and builds no profile: a visitor is recognised for one day by an anonymised value that is then discarded.",
        "Google Ads conversion tracking tells us which advert brought someone to the site, and whether they then went to the App Store or sent the link to their iPad. This one sets an advertising cookie and shares data with Google for advertising purposes. It is the only thing on this website that does.",
      ]},
      {kind:"text",text:"The analytics described above stores an anonymous identifier in your browser so that two page views in one visit are not counted as two visitors. The Google Ads tag sets an advertising cookie. You can clear or block both in your browser settings; the website works normally without them. Download buttons take you to the App Store, which is Apple’s service and is handled under Apple’s own terms and privacy policy. The Community link takes you to Discord, a separate service with its own policy, terms and age requirements. If you email us, we receive your address and what you choose to include so we can respond. Do not send sensitive personal information or private school records."},
    ] },
    { heading: "Advert measurement in the app", blocks: [{kind:"text",text:"Plumi advertises on Google and uses Google’s Firebase in the app to see which adverts work. The app asks once. Only if you say yes does Firebase send Google a random app id with the first open and with a free trial or subscription (the plan, not your name), and a rough location worked out from your connection. Only if you also allow tracking when your iPad asks can Google match a trial to the advert you saw. Google may not use any of it to show you personalised ads. Without a yes, Firebase may still tell Google the app was opened with no id attached, and Apple may tell Google that an advert led to a download without saying who. You can turn this off in the app’s Account page. Nothing you write, draw or upload is ever shared for advertising."}] },
    { heading: "Changes to this policy", blocks: [{kind:"text",text:"If what we do with your information changes we will update this page and its date, and tell you in the app if the change matters to you. Earlier versions are available on request."}] },
    { heading: "Contact", blocks: [{kind:"text",text:"Questions, requests and complaints: hello@tryplumi.app."}] },
  ],
};
export const terms: LegalDoc = {
  title:"Terms", description:"The terms for using the Plumi website, its free past papers and question bank, and its links to the Plumi community on Discord.", updated, updatedIso,
  intro:"This website introduces Plumi and links to the community. These terms concern the website, not the app.",
  sections:[
    {heading:"The product shown",blocks:[{kind:"text",text:"Product images are captures from the Plumi app. Features may change as the app is updated."}]},
    {heading:"Community access",blocks:[{kind:"text",text:"Joining the community does not reserve access, require a purchase or guarantee a particular feature. Discord’s own terms, community guidelines and minimum-age requirements apply. If you are not eligible to use Discord, you can continue to browse this website."}]},
    {heading:"Study information",blocks:[{kind:"text",text:"Examples explain how Plumi works and are not personalised academic advice or a guarantee of exam performance. The comparison describes general types of study tools; individual providers vary. Plumi is not endorsed by or affiliated with an exam board."}]},
    {heading:"Using the website",blocks:[{kind:"text",text:"Please do not interfere with the website, attempt unauthorised access or misrepresent its content. The Plumi name, product captures and mascot belong to their respective owners. You are welcome to link to the website and share screenshots for discussion."}]},
    {heading:"Availability and contact",blocks:[{kind:"text",text:"We aim to keep this website accurate and available, but it may occasionally be interrupted or updated. Nothing here limits rights or liability that cannot legally be limited. Contact the Plumi team at hello@tryplumi.app with questions."}]},
  ],
};
