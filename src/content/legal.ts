export type LegalBlock = { kind: "text"; text: string } | { kind: "list"; items: readonly string[] } | { kind: "todo"; text: string };
export interface LegalSection { heading: string; blocks: readonly LegalBlock[] }
export interface LegalDoc { title: string; description: string; updated: string; updatedIso: string; intro: string; sections: readonly LegalSection[] }
const updated = "14 October 2026";
const updatedIso = "2026-10-14";
export const privacy: LegalDoc = {
  title: "Privacy", description: "How the Plumi marketing website handles information and links to our community.", updated, updatedIso,
  intro: "This notice covers the Plumi marketing website. You can explore it without creating an account or submitting an email address.",
  sections: [
    { heading: "About this website", blocks: [{kind:"text",text:"Plumi is a GCSE and A-Level revision app for iPad, on the App Store. For questions about this website or your information, contact hello@tryplumi.app."}] },
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
    { heading: "Measuring the website", blocks: [
      {kind:"text",text:"Two measurement services run here and they do different things."},
      {kind:"list",items:[
        "Our own analytics records which sections of a page were read and which buttons were pressed, so we can tell whether the site explains Plumi well. It is hosted in the EU, it never creates a profile of you, it does not record your screen, and it never receives anything you type. Email addresses are stripped before any event leaves your browser.",
        "Google Ads conversion tracking tells us which advert brought someone to the site, and whether they then went to the App Store or sent the link to their iPad. This one sets an advertising cookie and shares data with Google for advertising purposes. It is the only thing on this website that does.",
      ]},
      {kind:"text",text:"Our hosting provider processes request information to deliver and secure the website."},
    ] },
    { heading: "Joining the community", blocks: [{kind:"text",text:"Download buttons take you to the App Store, which is Apple\u2019s service and is handled under Apple\u2019s own terms and privacy policy. The Community link in the footer takes you to Discord. Discord is a separate service with its own privacy policy, terms and age requirements. Any account or information you provide there is handled under those policies. You do not need to join Discord to browse this website."}] },
    { heading: "Contacting us", blocks: [{kind:"text",text:"If you email us, we receive your address and the information you choose to include so we can respond. Do not send sensitive personal information or private school records."}] },
    { heading: "Cookies", blocks: [{kind:"text",text:"The analytics described above stores an anonymous identifier in your browser so that two page views in one visit are not counted as two visitors. The Google Ads tag sets an advertising cookie. You can clear or block both in your browser settings; the website works normally without them."}] },
    { heading: "Your rights", blocks: [{kind:"text",text:"You can contact hello@tryplumi.app about access to, correction of or deletion of information you have shared with the team. Where UK data protection law applies, you can also raise a concern with the Information Commissioner’s Office at ico.org.uk."}] },
    { heading: "The app", blocks: [{kind:"text",text:"This notice covers the website. The Plumi app has its own privacy notice inside it. The app shows no adverts, never reads your iPad’s advertising identifier and never sells your work. Plumi advertises on Google and uses Google’s Firebase in the app to see which adverts work. The app asks once. Only if you say yes does Firebase send Google a random app id with the first open and with a free trial or subscription (the plan, not your name), and a rough location worked out from your connection. Only if you also allow tracking when your iPad asks can Google match a trial to the advert you saw. Google may never use any of it to show you personalised ads. Without a yes, Firebase may still tell Google the app was opened with no id attached, and Apple may tell Google that an advert led to a download without saying who. You can turn this off on the app’s Account page. Nothing you write, draw or upload is ever shared for advertising."}] },
  ],
};
export const terms: LegalDoc = {
  title:"Terms", description:"Using the Plumi marketing website and community links.", updated, updatedIso,
  intro:"This website introduces Plumi and links to the community. These terms concern the website, not a purchase or subscription to the app.",
  sections:[
    {heading:"The product shown",blocks:[{kind:"text",text:"Product images are captures from the Plumi app. Features may change as the app is updated."}]},
    {heading:"Community access",blocks:[{kind:"text",text:"Joining the community does not reserve access, require a purchase or guarantee a particular feature. Discord’s own terms, community guidelines and minimum-age requirements apply. If you are not eligible to use Discord, you can continue to browse this website."}]},
    {heading:"Study information",blocks:[{kind:"text",text:"Examples explain how Plumi works and are not personalised academic advice or a guarantee of exam performance. The comparison describes general types of study tools; individual providers vary. Plumi is not endorsed by or affiliated with an exam board."}]},
    {heading:"Using the website",blocks:[{kind:"text",text:"Please do not interfere with the website, attempt unauthorised access or misrepresent its content. The Plumi name, product captures and mascot belong to their respective owners. You are welcome to link to the website and share screenshots for discussion."}]},
    {heading:"Availability and contact",blocks:[{kind:"text",text:"We aim to keep this website accurate and available, but it may occasionally be interrupted or updated. Nothing here limits rights or liability that cannot legally be limited. Contact the Plumi team at hello@tryplumi.app with questions."}]},
  ],
};
