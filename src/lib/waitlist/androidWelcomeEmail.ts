import { discordUrl, site } from "@/config/site";

/**
 * The email an Android student gets the moment they join the waitlist: Plumi's notebook look (cream paper, the
 * brown outlined card with its hard shadow, the orange accent, the mascot) and one key, "Join the Plumi Discord".
 * No block of copy: a title, one line, the key.
 *
 * Email clients cannot load the site's pixel font or run its CSS, so this is a table with inline styles and a bold
 * monospace for the title, which sits closest to it. The mascot is a PNG at /email (clients do not draw SVG or WebP).
 * No em dashes anywhere a student reads.
 */

const INK = "#4a3a36";
const SOFT = "#7a665d";
const LINE = "#5b4741";
const PAPER = "#f6efe1";
const CARD = "#fdf9f1";
const ORANGE = "#d9702f";
const DISCORD = "#5865f2";
const MONO = "'Courier New', Courier, monospace";
const BODY = "'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

export const androidWelcomeSubject = "You're on the Plumi Android waitlist";

export function androidWelcomeHtml(): string {
  const mascot = `${site.domain}/email/plumi-celebrating.png`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${androidWelcomeSubject}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">We'll email you once, the day Plumi reaches Android.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:36px 16px 44px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
    <tr><td style="padding:0 4px 18px;font-family:${MONO};font-weight:bold;font-size:30px;color:${INK};letter-spacing:-0.5px;">plumi</td></tr>
    <tr><td style="background:${CARD};border:3px solid ${LINE};border-bottom:8px solid ${LINE};border-radius:20px;padding:34px 32px 36px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="left" style="padding-bottom:18px;"><img src="${mascot}" width="96" alt="Plumi" style="display:block;border:0;width:96px;height:auto;"></td></tr>
        <tr><td style="font-family:${MONO};font-weight:bold;font-size:36px;line-height:1.1;color:${INK};padding-bottom:12px;">You're on the <span style="color:${ORANGE};">list.</span></td></tr>
        <tr><td style="font-family:${BODY};font-size:18px;line-height:1.5;color:${SOFT};padding-bottom:28px;">We'll email you once, the day Plumi reaches Android.</td></tr>
        <tr><td align="left">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background:${CARD};border:3px solid ${LINE};border-bottom:7px solid ${LINE};border-radius:14px;">
              <a href="${discordUrl}" style="display:block;padding:13px 26px;font-family:${MONO};font-weight:bold;font-size:19px;color:${DISCORD};text-decoration:none;">Join the Plumi Discord</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="font-family:${BODY};font-size:15px;line-height:1.5;color:${SOFT};padding-top:16px;">While you wait, come and say hi.</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 6px 0;font-family:${BODY};font-size:13px;line-height:1.6;color:${SOFT};">You asked for this at ${site.domain.replace("https://", "")}/android. Reply to this email and we'll take you off the list.<br>Plumi, the GCSE and A-Level revision app that marks your handwriting. Made in the UK.</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function androidWelcomeText(): string {
  return [
    "You're on the list.",
    "",
    "We'll email you once, the day Plumi reaches Android.",
    "",
    `While you wait, come and say hi: ${discordUrl}`,
    "",
    `You asked for this at ${site.domain.replace("https://", "")}/android. Reply to this email and we'll take you off the list.`,
    "Plumi, the GCSE and A-Level revision app that marks your handwriting. Made in the UK.",
  ].join("\n");
}
