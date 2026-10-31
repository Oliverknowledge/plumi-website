# Plumi's sign-in emails

The app's Supabase project sends these for both the iPad app and the website. Supabase only lets
them be edited once the project sends through its own email sender (Authentication → Emails →
SMTP Settings, using Resend: host `smtp.resend.com`, port `465`, username `resend`, password a
Resend API key, sender `Plumi <hello@tryplumi.app>`).

Then paste each file into Authentication → Emails → Templates:

| Template | Subject | Body |
|---|---|---|
| Confirm sign up (a new address) | `Your Plumi code: {{ .Token }}` | `confirm-signup.html` |
| Magic link or OTP (an existing address) | `Your Plumi code: {{ .Token }}` | `magic-link.html` |
| Reset password ("Forgot password?") | `Your Plumi code: {{ .Token }}` | `reset-password.html` |

Both lead with the code, because a code works on any device: the app asks for it, and on the website
it works even if the email is opened on a phone. The link is kept for the website, where it signs
you in only in the browser that asked (PKCE).

The code's length is Authentication → Sign In / Providers → Email → Email OTP length. The app's
field says "6-digit code" and the website takes 6 to 10 digits, so 6 is the setting to use.
