# Saved questions: bookmarks and notes

On every question in the website's bank: a bookmark on the paper's top corner and **+ Add a note** under it. A student's suggestion, November 2026.

| Feature | Who decides | How long it lasts | Job |
|---|---|---|---|
| Add to set | Student | Until cleared, 150 at most | Build a PDF today |
| Have another go | Plumi, from their marks | Until they get it right | Bring missed questions back |
| Bookmark | Student | Until they take it off | "Come back to this" |

## How it behaves

- **Saved** by the question count (`?saved=1`) lists the bank's bookmarks and shows only once there's one to show. It overrides "Hide the ones I've done", because a marked question has no other way back into the list. **+ Add all to set** puts them in the set, so they can be downloaded as a PDF.
- A note is kept per part. A new note bookmarks its question. Taking the bookmark off keeps the note, which stays on the question, and changing the note doesn't put the bookmark back. Emptying a note removes it.
- In the whole-question view the ribbon covers all the question's parts and shows on if any part is bookmarked. Each part has its own note.
- Not in the partner embed. The study app's Questions feed and the iPad don't have it yet: they keep their own stores.

## Storage

`src/lib/bankSaved.ts` keeps everything in this browser (`plumi-bank-saved:v1`), and no account is needed. `src/lib/bankSync.ts` copies a signed-in student's to `bank_saved` (`supabase/migrations/0005_bank_saved.sql`), and until that table exists it stays quiet and the browser copy carries on working.

- **Later change wins, whole, per part.** An emptied entry is kept with its time, or another device would bring it back on merging. The time comes from the student's device, so a badly wrong clock can lose to an older change.
- **Changes go up in a batch** 1.5 seconds after the last one. One that doesn't arrive is still newer here than in the account, so the next page load's full sync sends it.
- **Shared computers.** Once a browser's copy has synced with an account, it records that account as its owner. Signing out clears the copy, and so does another account signing in, before anything merges. One student's notes never go up into another's account. Anything written signed out, before any sync, has no owner, so it joins the first account to sign in.

## Measuring it

`bank_bookmarked`, `bank_note_started` (never the words) and `bank_saved_opened`. What matters is how many students who bookmark come back to open Saved.
