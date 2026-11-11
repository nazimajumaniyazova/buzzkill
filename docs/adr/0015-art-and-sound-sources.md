# ADR-0015: Where the game's art and sounds come from

- **Status:** Accepted
- **Date:** 2026-11-11
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 6 (#131, #132): every image and sound the game ships must have a known source and a
license that lets the game be published. The inventory (`docs/assets.md`) found that none does:

- The 11 files of `apps/web/src/assets` were downloaded for the 2023 team project from sources
  nobody recorded, so their license is unknown.
- The heroes, the background and the first day enemy are drawn as placeholders, because their 2023
  art was drawn by other members of the team or was over 1 MB.

The plan proposed CC0 packs from Kenney.nl and OpenGameArt. The owner asked whether the art could be
drawn for the project instead. A sample answered that: the six kinds of sprite the game needs, drawn
as vector code in the game's own frame sizes and rendered in a browser, with a live day and night
scene next to the best CC0 candidates.

What a search of the CC0 sources found (2026-11-11):

- Sounds, laser bolts and explosions are well covered: Kenney's Sci-fi Sounds and Impact Sounds,
  Space Shooter Redux, and Sinestesia's explosion animations.
- Nothing covers the rest: no hero with a jetpack and a blaster, no night insect with a flying
  animation, and no vector city of the future, by day or by night.
- The packs that come close mix styles. Kenney's characters are flat and unlined, bevouliin's
  insects are glossy and outlined, and the best city is pixel art. Pixel and vector art clash on
  one screen.
- Kenney's pages state CC0. OpenGameArt refused automated reads, so the licenses there were only
  seen in search results.

Fixed by the game:

- An enemy's hitbox is half its frame size (`halfFrame` in `packages/game/src/config/enemies.ts`),
  and an explosion lives 9 frames of 4 ticks (`RULES.explosion`). Art that changed either would
  change the simulation and its golden replays; the frame counts and pace of the enemies' wings are
  drawing only.
- The heroes' boxes and the muzzle at (105, 90) are part of the rules.

## Options

### A. CC0 packs, as the plan proposed

- Pros: finished art, more detailed in places; no art to maintain.
- Cons: the heroes, the night insects and the city do not exist in CC0 and would still have to be
  drawn or bent from unrelated packs; the packs differ in style and scale; every frame size must be
  fitted to the game's hitboxes.

### B. Art drawn for the project, sounds synthesized in code

- Pros: one style for the whole game, made to the game's frame sizes, with day and night palettes
  that match the interface; no license question; files of a few kilobytes; a frame, a color or a
  count changes in code.
- Cons: flat vector art rather than an illustrator's; synthesized sounds are noticeably weaker than
  recorded ones.

### C. Art drawn for the project, sounds from CC0 packs

The sprites and the backgrounds of B, with the shot, the explosion and the hit taken from Kenney's
CC0 sound packs.

- Pros: the visual consistency of B and the sound quality of A; the sounds are the part where CC0
  is strongest and has no style to clash.
- Cons: the art is the project's to maintain.

## Recommendation

C.

## Decision

C, chosen by the owner on 2026-11-11.

## Consequences

- A new workspace package, `@buzzkill/art`, holds the art as TypeScript: each sprite is a pure
  function from its frame to an SVG document, in the frame sizes of the game configuration (twice
  the world's pixels, sharp at a device pixel ratio of 2). The backgrounds are layers of the
  1280×720 world that tile horizontally for parallax. The package imports nothing; its tests check
  every frame against the game's sizes.
- The set: three day enemies (beetle, wasp, dragonfly) and three night ones (moth, firefly,
  mosquito) in the frame sizes of the enemies they replace, Mike and Julie with a jetpack and a
  blaster in the heroes' boxes, the fire and smoke explosions in 9 frames, the shot, and the city by
  day and by night in three layers.
- The pipeline of #133 turns the SVG into the atlases the game loads and moves the drawing code to
  the new art; until then the game keeps the 2023 files.
- The sounds come from Kenney's Sci-fi Sounds and Impact Sounds (CC0). The owner downloads the packs,
  since kenney.nl refuses automated downloads; only the chosen files and the license go into the
  repository, under `apps/web/assets-src/`.
- `ASSETS.md` (#134) lists the art as the project's own and the sounds with their pack, author and
  license.
