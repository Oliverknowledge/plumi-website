# ChatGPT prompt pack: SEATED sheets for the animals whose sitting does not work from the walk art

The nine animals are built from their walk sheets (`docs/study/art/source/animal-sheet-<id>.png`): the sitting pose is the head and torso
of the standing drawing, the tail tucked away and the near leg folded forward (`tools/art/animal_rig.py`). That works when the head,
torso and arms read clearly in the standing drawing (fox, raccoon, red panda, hedgehog, axolotl, in the room next to a person at a desk).
It does NOT work for these, and a drawn seated sheet is the only real fix:

| Animal | Why the standing art cannot be made to sit |
|---|---|
| **dragon** | The wings and the long tail ARE the body outline from the side: tucking the tail removes the wings too, and what is left is a plum blob with a scarf. The four limbs are one or two art pixels wide, so there is no arm to put on a desk. |
| **badger** | The face (the glasses, the cheek stripes, the cream muzzle) is a mush of 8 colours in 12 pixels, and the book it carries is a red stripe that covers the near arm: a seated badger has no hands, no face and a book that cannot be put down. |
| **triceratops** | The frill is wider than the head and hangs on the rear side below the shoulders, exactly where the tail tuck cuts, so the seated frill is clipped flat. The arms are hidden in the jumper. |
| **capybara** | The body is 18 pixels wide, so seated it overhangs the chair; the half closed eyes have gone to one dark pixel and the front view has no face at all (a reading capybara should be seen from the front with its eyes down on the page). |

Everything else in this file is the same drill as `chatgpt-character-prompts.md`: read its sections 0 (before you start) and 1 (the style
bible) first, and paste the STYLE BIBLE at the top of every message. Two things differ from that pack, because the sheets that actually came
back were 1536 x 1024 with the figure about 200 pixels tall and 5 source pixels to a drawn pixel, not 8:

- **Canvas:** 1536 wide by 1024 tall, a grid of **4 columns by 2 rows** (cells 384 by 512), magenta `#FF00FF` background, nothing else.
- **Scale:** the head, the jumper and the pixel size must be exactly what they are in the walk sheet of the same animal. Attach that
  walk sheet to the message as the character reference, and say so.

## The prompt (one message per animal, in the chat that drew the walk sheet if you still have it)

```
[PASTE THE STYLE BIBLE HERE]

Using EXACTLY the character on the attached walk sheet (same colours, same jumper, same proportions, same size of head and of
pixel), draw a SEATED sheet: the animal sitting on a library chair at a desk, as it will be seen in a top-down RPG library.

Canvas 1536 wide by 1024 tall, a 4 columns by 2 rows grid of equal cells (each 384 by 512). Magenta #FF00FF background. Nothing
else in the image: no desk, no chair, no book on the desk, no floor, no shadow, no labels, no grid lines.

ROW 1 (top): SEEN FROM THE SIDE, FACING RIGHT (a true profile, seen from slightly above), sitting up straight on a chair. The
chair and the desk are NOT drawn; the desk edge will cover everything below the belly, so draw the head, the torso and the
arms, and below the belly just a folded knee and a foot pointing right. NO tail anywhere (it is tucked behind the chair). Both
hands are visible in front of the body, resting where a desk top would be, about at the belly.
ROW 2: SEEN FROM THE FRONT (facing the camera), sitting behind the desk edge: the head, the torso and both arms resting forward;
nothing below the belly. Tail not visible.

COLUMNS, the same four beats in both rows:
  1 STILL: looking at the page, hands resting.
  2 PAGE TURN: one hand lifts a little and moves across (the page turning).
  3 HEAD NOD: the whole head one pixel lower, eyes down (reading hard); the body does not move.
  4 WRITING: the writing hand moves 2 pixels with a pen; the head one pixel lower.

RULES: the animal is the same size in all eight cells; the BOTTOM of the figure (the belly line or the foot) is on the same
height in all eight cells; the head is in the same place in all four frames of a row except where a beat says it moves by one
pixel; the face is clearly drawn (both eyes, the nose or muzzle), because this is the picture that must carry the character.
Hard pixel stair-steps, 1 pixel dark outline, 16 colours max, the colours of the walk sheet. Return one PNG, no text.
```

## Per animal, what to add to the CHARACTER line

- **dragon**: "a small round plum-purple dragon kit, cream horns, cream belly, navy scarf, tiny cream wings, orange tail tip. Seated:
  the wings are folded flat on its back and NOT visible in the front view; the arms are chunky (3 pixels wide) with cream hands, and
  they hold a pen and a book. No tail."
- **badger**: "a small round badger, grey with cream face stripes, round gold glasses, mustard jumper. Seated: the book it carries
  is OPEN on the desk in front of it (do not draw the desk: draw only its hands on the open book's edges); the eyes are two clear
  dark pixels behind the glasses, the muzzle cream. No tail."
- **triceratops**: "a small round moss-green triceratops, orange frill, three cream horns, navy jumper. Seated: the frill sits
  BEHIND the head as a round collar no wider than the shoulders, the horns point forward, two chunky green arms are visible in front
  of the jumper. No tail."
- **capybara**: "a small round capybara, orange-brown with a dark brown snout, cream hoodie with the hood down. Seated: the body is
  narrow (no wider than the head, the hoodie tucked in), the eyes are two clear dark half-moons, both hands visible. Front view:
  head tilted down at a page so the eyes are looking down."

## What to check before you send it back

- Eight cells, four beats in each row, the SAME size in every cell; the side row faces right.
- No tail in any cell. No desk, chair or book on a desk. Hands visible in every cell.
- Zoom in: stair-steps, one pixel outline, no blur, 16 colours or fewer, magenta everywhere else.
- If a sheet comes back with a different head size from the walk sheet, re-roll it: the pipeline uses the walk sheet's scale, so a
  bigger head is a bigger animal in the room.

## Dropping it in

```bash
python3 tools/art/animal_sheet.py --ingest-sit dragon ~/Downloads/dragon-sit.png   # saves docs/study/art/source/animal-sit-dragon.png
python3 tools/art/animal_sheet.py --id dragon                                    # the rig now uses the drawn frames as they are
python3 tools/art/check_animals.py -v                                            # the seated checks: nothing below the lap line, one piece
```

`animal_sheet.py` finds `animal-sit-<id>.png` by name. It cuts exactly 8 sprites (4 columns by 2 rows), snaps them with the animal's
palette and scale, puts the torso on column 12 and the bottom of the figure on the lap line (the hip row + 3), mirrors the side row
for sitting LEFT, plays the four beats as still, page turn, still, nod, still, writing (one frame every 0.8 s, like a person's
sit) and uses the front row for the phone and read poses. The walk and idle frames are not touched.
