# ChatGPT prompts for the town's interiors (bakery, bookshop, cottages, and the next buildings)

The cafe interior (`docs/study/art/source/cafe-interior-01.webp`, made into a room by `tools/art/room_from_image.py`, `docs/study/cafe.md`) is the
pattern: **one 1536 x 1024 picture of a room, a top-down 3/4 view, drawn in the same pixel style as the building's outside, which the engine turns into a
walkable room** (floor footprint, pieces to walk behind, lights, a door). The town's doors that still answer "Closed for now" are the bakery, the
bookshop and the 18 cottages. This file asks for them. Every prompt below ends with the same block of **technical asks** (it is what the room tool and the
engine need, learned from the cafe: `chatgpt-cafe-interior-prompts.md`); paste that block under each.

Attach the building's outside picture (`docs/study/art/source/bakery-01.webp`, `bookshop-01.webp`, `cottages-a-01.png`) and the cafe interior picture to every
request, and say "same palette, outline weight and lighting as these two".

## The technical asks (paste under every prompt)

> **Crisp hard-edged pixels: no anti-aliasing, no blur, no gradients, flat shaded colours, one pixel dark outlines**, the same pixel size as the attached
> cafe interior (about 2.4 pixels of the 1536 x 1024 image to one pixel of the room: a person is 16 pixels wide and 24 tall at that scale, so a chair is about
> 16 pixels wide, a table 32, a door 24 wide). Camera exactly as the cafe interior: top-down with the front wall cut away, the floor filling the picture,
> back wall and its shelves along the top. **A doorway at the bottom, centred, 40 pixels wide at the room's scale, with a doormat, nothing in the way for
> 60 pixels inside it** (the room's exit is the bottom edge). Clear walking aisles at least 32 pixels wide everywhere (two people must pass), no furniture
> touching a side wall except bookcases, shelves and counters, so a person can walk behind chairs. Seats: plain wooden chairs and stools, one chair per seat,
> **facing the table with nothing in front of them**; benches in a straight line; at least 8 seats in a bakery, 10 in a bookshop. No people and no animals
> in the picture. Lit windows throw soft lamplight patches on the floor (so the engine can add its own warm light layer). Image size 1536 x 1024.

## A. The bakery

> Pixel-art interior of **The Bakery** from the attached outside picture (terracotta roof, striped yellow and cream awning, bread in the window, the door at the
> left, chimney). The room is long and warm: **the shop at the front**, a wooden counter with a glass pastry case (loaves, croissants, jam tarts) running
> across the middle, brass till and scales on it, **the bread window** on the left wall with a display of loaves in baskets (matching the outside window);
> **the bakery behind the counter** at the top: a brick oven with a glowing mouth, flour sacks, a long floury work table, racks of baking trays, a hanging
> row of copper pans; **a seating corner** at the bottom right with three small round tables and eight stools where students can sit and work with a bun, a
> bread basket and a lantern on each table; a chalkboard menu on the wall; a rug; plants in terracotta pots; the same green shutters and cream plaster as outside.
> Two openings behind the counter so a person can walk from the front into the back (a gap in the counter, 40 pixels wide). Smells are not drawable, but make
> the oven mouth glow orange so the engine can flicker it.

## B. The bookshop

> Pixel-art interior of **The Bookshop** from the attached outside picture (slate roof, brick bay window with a reading seat, open-book sign, double door at
> the right, flower boxes). A tall, narrow, cosy bookshop: **floor-to-ceiling bookcases** on the back wall and along the left wall with a **rolling ladder**;
> three **freestanding bookcases** in the middle (aisles 32 pixels wide between them, each bookcase 56 pixels wide so a person can walk behind it); a
> **front counter** at the bottom left near the door with a till, a stack of paper bags, a cat bed (empty) and a small lamp; **the bay window seat** on the left
> (cushions, a low table, two armchairs, a lamp) where students can sit and read; a **reading corner** at the top right with a green sofa, a standard lamp and a
> low table; a spiral staircase up to a gallery along the top wall (a gallery railing, no second floor needed); a displays table of new books with
> bookmarks; rugs in the deep green and brick red of the outside; an ornate wall clock. **Ten seats** in all: two armchairs, a sofa for two, four stools at a
> long reading table under the gallery, and two bay window cushions. Spines of books in many colours but keep each shelf a flat pattern (no unique detail that is
> hard to cut: shelves are floor furniture, not decoration to be redrawn).

## C. The cottages (one prompt, six variations)

The town has 18 cottages in four colours (`cottage_terracotta`, `_terracotta_moss`, `_slate`, `_slate_plum`, one drawing). One interior picture can serve
all of them (a one-room cottage), plus two or three variations so a street is not 18 copies.

> Pixel-art interior of **a small cottage** for the attached cottage outside picture (cream plaster, timber frame, shuttered windows, wooden door in the
> front wall, a chimney on the right). One room, the whole picture: a **stone fireplace** on the right wall with a lit fire and a mantel, an armchair and a rug
> in front of it; a **kitchen corner** at the top left (a range, a sink, a shelf of jars, hanging herbs, a wooden table with two chairs); a **bed** at the top right
> with a patchwork quilt; a **writing desk under the front window** with a lamp, a stack of exercise books and a chair, where a student can sit and work (this is
> the seat that matters: draw it facing the window, with room behind the chair); a bookcase; a coat hook by the door; a round rug; a potted plant. **Four seats**:
> the desk chair, the armchair, and two kitchen chairs. Variations: (1) as above, (2) an attic-like room with a sloped ceiling and two dormer windows, (3) a
> study-cottage with bookcases on three walls and two desks, (4) a bakery-flat with a big table and a window seat.

## D. The next buildings (not in the town yet: the map reserves the space)

Each of these has a labelled placeholder box in the town's debug view (`?debug=1`), with a footpath already leading to it. Ask for the outside first, in the
style of the bakery and bookshop (`bakery-01.webp`: magenta background, one building, front on, the roof seen from above, a door about one person tall, 1500
pixels wide), then the interior with the technical asks above.

* **Post office** (7 x 5 tiles reserved): red-brick, a hanging letterbox sign, a pillar box beside the door. Inside: a long counter with pigeon holes, scales, a
  parcel shelf, a queue rope, a table with envelopes, a noticeboard. Gives the town a "send a message" place for later.
* **Florist** (5 x 4): glass-fronted, buckets of flowers outside on the pavement (draw them as part of the outside picture: the town has planters but not
  buckets). Inside: a work table, ribbon reels, hanging dried bouquets, a cold cabinet, a few stools.
* **Market stalls** (10 x 4): three to five striped-awning stalls in a row (apples, pumpkins, cheese, bread, flowers) as separate pictures on magenta so the
  town can place and sort them, plus crates, a scale and a chalkboard. No interior: they are outdoors, with a stool behind each counter for a seat.
* **Pavilion** (7 x 5): an open timber park pavilion on stone posts with a shingle roof, hanging lanterns, long benches inside facing outwards. Outdoors; the
  space under the roof is a walk-through with seats (draw the back half and the front posts as separate pieces so people can walk under it).
* **Pond and bridge** (11 x 6): a pond with reeds, lily pads and a small wooden bridge, a duck or two; as water tiles (a 32 x 32 tile set with a shore edge in
  the ground's palette: the path painter needs an edge piece set like the dirt's) and a bridge piece with railings. A bench and a fishing jetty.
* **Fountain** (3 x 2.5, on the Grand Library's plaza): a stone round fountain with a low basin, water in two frames. The plaza reserves the middle for it.

## E. Furniture the town still draws as boxes

Not interiors, but the founder is generating these, and every box in the town is a placeholder for one: park benches in four directions (a person sits left,
right, front, back: `docs/study/town.md`, "Sit spots"), a long bench, a tree-ring bench, picnic tables (side-on and end-on, with a bench each side), round cafe
table with stools, a long study desk, umbrella desks, a school-desk bench, a fountain, bins and lamp posts in one more style. Same technical asks: each on
magenta, one object a picture, the sitter's feet row marked, no shadow baked in (the engine draws the ground shadow).
