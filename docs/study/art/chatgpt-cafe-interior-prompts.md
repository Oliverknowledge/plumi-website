# ChatGPT prompts for a better cafe interior

**Would a redraw materially improve the cafe?** Not for scale (the current picture is fine once resampled by 2.4: `docs/study/cafe.md`).
It would help for: (1) real doorways (the sunroom and the bar are sealed or unreachable in the picture), (2) chairs drawn with the
sitter in mind (side chairs where people sit left or right; no chair half under a table), (3) separate pieces so people can be
behind things (a walk-behind plant or counter is cut by hand today), (4) crisper pixels (the picture is softened). It would not be
worth it before a student has used the room.

The camera, style and palette are already right; keep them. Ask for the room twice, in two ways.

## A. The whole room, with doorways and sit-ready chairs

> A top-down 3/4 view pixel-art interior of a cosy cafe-library, the same camera, palette and drawing style as the attached picture
> (warm wood floor, green sofas and chairs, terracotta rugs, brick oven and fireplace, lots of plants, brass wall lanterns). Same
> rooms in the same places: coffee bar and bakery counter top middle, reading nook with two booths top left, bay-window sunroom
> bottom left, fireplace lounge on the right, two round tables and a long dining table in the middle, double doors at the bottom.
> Changes: **an open doorway (no wall, post or plant in it, about 40 pixels wide at this scale) from the central hall into the
> sunroom, one from the hall into the lounge, and one behind the counter into the kitchen;** every chair a plain wooden
> chair that faces its table with nothing in front of it; chairs around the long table on both long sides and both ends, around
> each round table on three sides; no furniture touching a wall except bookcases, so a person can walk behind chairs.
> **Crisp hard-edged pixels: no anti-aliasing, no blur, no gradients, flat shaded colours, one pixel dark outlines.** The pixel
> size is about 2.4 pixels of a 1536 x 1024 image, so the room is 640 x 427 pixels drawn at 2.4x. A person is 16 pixels wide and
> 24 tall at that scale, so a chair is about 16 pixels wide and a round table 32. Image size 1536 x 1024.

## B. The room in four overlapping quadrants (for more detail)

Four images, each 1536 x 1024, each showing one quarter of the cafe (top left, top right, bottom left, bottom right) **with a
quarter of overlap into its neighbours**, the same camera and scale (about 4.8 pixels of the image per pixel of the room: so a
chair is about 76 image pixels wide), the same style as picture A. State in each prompt which quarter, and repeat the rooms that
are in it. Keep the floor patterns continuous across the seams (rugs and plank rows cut off at the edge, not finished).

## C. A walk-behind layer (separate request)

> Using the same room, draw a **second picture on a flat magenta (#ff00ff) background containing only the things a person walking
> behind them would be hidden by**: every potted plant (pot and leaves), the counter front and glass pastry case, the two lantern
> pillars, every sofa back, every chair back, and the front edge of every table. Everything else magenta. Same position and scale as
> the room picture, pixel for pixel, so it can be laid over it.

## D. Sit-down frames (the characters, not the room)

The animals sit badly because they were drawn standing: `chatgpt-animal-sit-prompts.md`. Seats facing the camera and away from it
(this room has 17) need the front and back sit frames asked for there.
