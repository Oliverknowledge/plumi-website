# ChatGPT roster prompts: more animals, one family

The fox sheet came out well, so this is built on what worked: ChatGPT's own 1536 x 1024 sheet, 6 columns by 4 rows,
magenta background, rows DOWN / LEFT / UP / RIGHT, 6 walk frames each, 3/4 top-down camera.
What went wrong with the fox, and is fixed here: sprites drifting across the cells and slightly different sizes.

**The one rule that makes a roster work: every character fits the same envelope as the fox.** Same height, same
proportions, same pixel size, same outline weight, same camera. A T-Rex is a chunky chibi T-Rex that stands as tall
as the fox. That way they can share one room, the same animation code and the same chairs.

---

## How to use this

1. New ChatGPT chat per character. Attach to the FIRST message:
   - **the fox sheet** (`docs/study/art/source/fox-sheet-01.png`) as the reference for scale, camera angle, pixel size,
     outline and proportions. Say "match this exactly, but a different character".
   - optionally a crop of the Plumi library room.
2. Paste the SHEET PROMPT below, with the character brief for that character filled in (the roster is further down).
3. Reject and re-roll if: the camera is front-on, the pixels are smooth, the character is a different size from the fox,
   the sprites touch a cell edge, or the four rows are not the same character. Use the fix-it prompts from
   `chatgpt-character-prompts.md`.
4. Send me the PNGs (the files, not screenshots), plus the name of the character. I process them with the fox pipeline.

---

## SHEET PROMPT (paste this, fill in [CHARACTER BRIEF])

```
Create a pixel-art character sprite sheet in EXACTLY the same style, camera angle, pixel size, outline weight,
proportions and sheet layout as the attached fox sheet. The attached fox is the reference for how the camera sees
a character, how big it is in its cell, and how chunky the pixels are. Match it. The character below must be a
DIFFERENT, ORIGINAL character.

SHEET LAYOUT (same as the fox sheet):
- Canvas 1536 wide by 1024 tall. A grid of 6 columns by 4 rows, every cell 256 by 256.
- Row 1: DOWN (walking toward the camera). Row 2: LEFT (true side profile facing left). Row 3: UP (walking away,
  seen from behind). Row 4: RIGHT (true side profile facing right).
- 6 frames per row: a smooth 6-frame walk cycle (contact, down, passing, contact on the other foot, down, passing).
- Perfectly flat solid magenta #FF00FF background, nothing else. No shadows, no labels, no grid lines, no props on the
  floor.

POSITIONING (this fixes the problems with the first sheet):
- Each character is centred in its own cell, with at least 24 pixels of empty magenta on every side. Nothing touches a
  cell edge and nothing overlaps the next cell.
- The character is the SAME size in all 24 frames: from the feet to the top of the ears/crest/horns it is
  about 195 pixels tall, and at most 170 pixels wide including the tail. The feet touch the same baseline in every cell.
- The head stays in the same place on the walk cycle (it bobs by one art pixel at most). Only the legs, arms, tail,
  and ears/crest move.

STYLE (identical to the fox): 3/4 top-down camera about 40 degrees above the horizon (you can see the top of the
head and the base of the tail; NOT a flat front-on or side-on cartoon, NOT a straight bird's-eye view). True pixel art:
hard stair-step edges, no anti-aliasing, no blur, no gradients, chunky blocks of identical size, a 1 pixel dark warm brown
outline (#3B2A2E, never pure black), at most 16 colours, 3 tones per material, light from the top-left, plum-tinted
shadows, warm highlights. Cute chibi, about 2 heads tall, short legs, readable paws, same simple face language as the
fox (two small dark dot eyes, tiny nose, small rosy cheeks where it suits).

THE CHARACTER: [CHARACTER BRIEF]

HARD RULES:
- Original design only. Do not reproduce any existing character, mascot or franchise.
- Friendly and school-safe: no weapons, no blood, no scary faces, no logos or text on clothes.
- It must stay readable at tiny size: a clear silhouette, a distinctive main colour that is NOT cream (the fox is
  cream), and one outfit item that makes it recognisable.
- It must walk upright on two legs with the same body plan as the fox (head, body, two arms, two legs, a tail if it
  suits) so it uses the same animation.
Return one PNG, no text.
```

---

## THE ROSTER (creative, and every one fits the fox's envelope)

Each brief is the text to put in [CHARACTER BRIEF]. Colours are chosen so the characters are easy to tell apart.

1. **Rex, the studious T-Rex (the cool one).** A chunky chibi T-Rex, deep teal-green with a lighter cream belly, a big
   head with a wide friendly grin and two small teeth, tiny comic arms held up to a huge pair of red over-ear headphones,
   a sturdy tail that swishes and a row of small orange back spikes. Wearing a mustard-yellow varsity-style hoodie (no
   logo) with the hood down, and round tortoiseshell glasses balanced on the snout. It is exactly as tall as the
   fox: the head is big, the legs are strong, the arms stay tiny. Walks with a confident little stomp, tail swinging.
2. **Bruno, the bear.** A round sky-blue-and-honey two-tone bear (honey-brown fur, a pale muzzle), small round ears,
   a chunky orange knitted scarf wrapped twice, a green satchel across the chest, a contented sleepy face.
3. **Maple, the badger.** Charcoal-grey fur with the classic white face stripes, a sharp little snout, a mustard cardigan
   with big pockets, a stack of two small books under one arm, round gold glasses.
4. **Poppy, the red panda.** Rust-orange fur, white-ringed striped tail, cream face mask with dark tear marks, a teal
   puffer vest, a tiny bamboo-coloured pencil tucked behind one ear.
5. **Axel, the axolotl.** Soft coral-pink body, three feathery gill fronds on each side of the head (these are the
   "ears"), a wide gentle smile, a lilac raincoat with the hood down, small webbed hands.
6. **Cappy, the capybara.** A mellow brown capybara, boxy head, tiny ears, a calm half-closed-eyed face, a mint-green
   bucket hat, a cosy oatmeal sweater, a very relaxed waddling walk.
7. **Pip, the penguin.** Midnight-blue back, white belly, orange beak and feet, a red-and-cream striped beanie with a
   pompom, a tiny backpack, a happy waddle with flippers swinging.
8. **Olive, the owl.** Round warm-brown owl with big amber eyes, tuft ears, cream chest feathers, a forest-green coat,
   a lantern-like satchel; walks upright on small talon feet (keep it cute and chunky).
9. **Finn, the frog.** Bright moss-green frog, huge friendly eyes on top of the head, a pale yellow belly, a sunny
   yellow raincoat, red wellington boots; a bouncy walk.
10. **Sunny, the sloth.** Pale tan fur with the dark eye-patches, a long slow smile, a dusty-rose hoodie, long arms,
    an unhurried swaying walk, a tiny leaf tucked behind one ear.
11. **Ember, the mini dragon.** A small plum-purple dragon with cream belly scales, little round horns, tiny folded wings
    on the back, a tail with a flame-orange tip, a navy scarf. Friendly, not scary: no fire, no sharp teeth.
12. **Trix, the triceratops.** A chunky olive-green triceratops with a rounded frill in coral, three short rounded horns
    (no sharp points), a gentle smile, an indigo duffle coat, stubby legs, a heavy-footed happy stomp.
13. **Rusty, the raccoon.** Slate-grey fur, the masked eyes, a ringed tail, a burnt-orange hoodie, one fingerless glove,
    a mischievous but kind grin.
14. **Wren, the hedgehog.** Soft sand-brown with a cream face, a rounded coat of short quills on the back that read as a
    clean scalloped shape (no sharp spikes), a sage-green knit cardigan, a small lantern.

Start with 1, 2, 3 and 5: they are the most different from each other and from the fox, so they test the pipeline best.

---

## If ChatGPT gets the scale wrong

Paste:

```
The character is the wrong size. It must be the SAME height and width as the fox in my reference sheet: about 195 pixels
tall (feet to the top of the ears) and at most 170 wide inside a 256 by 256 cell, feet on the same baseline in
every cell, centred, with at least 24 pixels of margin. Redo the sheet with the same character at that exact size.
```

## If the dinosaurs or others look scary or too different

```
Make it cuter and rounder: a big head (about 40 percent of the height), short strong legs, a soft rounded snout, round
friendly eyes, no sharp teeth, no claws that look dangerous. Keep the same colours and outfit.
```

## What I do next

I run each sheet through the fox pipeline (remove the magenta, find the 24 frames, snap to one pixel grid and one palette,
align the feet and centre), build the same row format the room uses, add each animal as a "Character" in the wardrobe,
and make recolours (a different scarf or hoodie colour) in code so one drawing gives many students their own look.
