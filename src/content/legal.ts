export type LegalBlock = { kind: "text"; text: string } | { kind: "list"; items: readonly string[] } | { kind: "todo"; text: string };
export interface LegalSection { heading: string; blocks: readonly LegalBlock[] }
export interface LegalDoc { title: string; description: string; updated: string; updatedIso: string; intro: string; sections: readonly LegalSection[] }
const updated = "11 September 2026";
const updatedIso = "2026-09-11";
export const privacy: LegalDoc = {
  title: "Privacy", description: "How the Plumi marketing website handles information and links to our community.", updated, updatedIso,
  intro: "This notice covers the Plumi marketing website. You can explore it without creating an account or submitting an email address.",
  sections: [
    { heading: "About this website", blocks: [{kind:"text",text:"Plumi is an iPad study app being built for students. For questions about this website or your information, contact the Plumi team at hello@tryplumi.app."}] },
    { heading: "Browsing the site", blocks: [{kind:"text",text:"This version of the website does not use a signup form, advertising cookies, session recording or visitor analytics. The interactive demonstrations run in your browser and do not send your answers to an AI service. Our hosting provider processes request information to deliver and secure the website."}] },
    { heading: "Joining the community", blocks: [{kind:"text",text:"Community buttons take you to Discord. Discord is a separate service with its own privacy policy, terms and age requirements. Any account or information you provide there is handled under those policies. You do not need to join Discord to browse this website."}] },
    { heading: "Contacting us", blocks: [{kind:"text",text:"If you email us, we receive your address and the information you choose to include so we can respond. Do not send sensitive personal information or private school records."}] },
    { heading: "Your rights", blocks: [{kind:"text",text:"You can contact hello@tryplumi.app about access to, correction of or deletion of information you have shared with the team. Where UK data protection law applies, you can also raise a concern with the Information Commissioner’s Office at ico.org.uk."}] },
    { heading: "The app is separate", blocks: [{kind:"text",text:"This website is a product introduction, not the Plumi app. The app’s own privacy information will explain how notebook content and AI requests are handled. The screenshots here are supplied development captures; the mechanics sequence is an illustrative demonstration."}] },
  ],
};
export const terms: LegalDoc = {
  title:"Terms", description:"Using the Plumi marketing website and community links.", updated, updatedIso,
  intro:"This website introduces Plumi and links to the community. These terms concern the website, not a purchase or subscription to the app.",
  sections:[
    {heading:"The product shown",blocks:[{kind:"text",text:"Product imagery comes from development versions of Plumi. The mechanics learning sequence is an illustration, not a recording of the app. The planned launch date is 25 September 2026. Features and availability may change as development continues; a countdown is not confirmation that the app has been released."}]},
    {heading:"Community access",blocks:[{kind:"text",text:"Joining the community does not reserve access, require a purchase or guarantee a particular feature. Discord’s own terms, community guidelines and minimum-age requirements apply. If you are not eligible to use Discord, you can continue to browse this website."}]},
    {heading:"Study information",blocks:[{kind:"text",text:"Examples explain how Plumi works and are not personalised academic advice or a guarantee of exam performance. The comparison describes general types of study tools; individual providers vary. Plumi is not endorsed by or affiliated with an exam board."}]},
    {heading:"Using the website",blocks:[{kind:"text",text:"Please do not interfere with the website, attempt unauthorised access or misrepresent its content. The Plumi name, product captures and mascot belong to their respective owners. You are welcome to link to the website and share screenshots for discussion."}]},
    {heading:"Availability and contact",blocks:[{kind:"text",text:"We aim to keep this website accurate and available, but it may occasionally be interrupted or updated. Nothing here limits rights or liability that cannot legally be limited. Contact the Plumi team at hello@tryplumi.app with questions."}]},
  ],
};
