# ADR-0018: The music, its source and its budget

- **Status:** Accepted
- **Date:** 2026-11-17
- **Deciders:** Nazima Jumaniyazova

## Context

Plan stage 7, item 12 (#161) asks for music that explosions duck. The game had none: the 2023
music was of unknown source and was left behind (ADR-0015). Two questions needed the owner:

- **The track.** It must be free to ship, like the sounds, which come from Kenney's CC0 packs
  (ADR-0015).
- **Its weight.** The images and sounds may weigh 1 MB together (#135); they weighed 919 kB.
  A looping track of one or two minutes weighs a megabyte or more even as Ogg.

OpenGameArt, the largest source of CC0 music, refuses automated requests, so only pages that an
agent could read were checked for their license.

## Options

### The track

#### A. A loop from the Music Loop Bundle of Abstraction (Tallbeard Studios)

- **Pros.** The page states "CC-0 (Public Domain)", read on 2026-11-17. Over 200 songs made as
  loops, several of them chiptune that suits the art. Credit is welcome but not required.
- **Cons.** The packs are zip files of tens of megabytes, downloaded by hand from itch.io; the
  owner picks one track and listens to it first.

#### B. A CC0 shooter loop from OpenGameArt

- **Pros.** Several tracks are made for shooters.
- **Cons.** Their pages could not be read by an agent; the license rests on search listings until
  the owner checks each page in a browser.

#### C. No music for now

- **Pros.** Nothing to choose or to weigh.
- **Cons.** The ducking of #161 has nothing to duck, and the game stays silent between its sounds.

### The budget

#### A. A budget of its own for the music, 3 MB

The music streams during a run instead of loading before the first frame, so it does not delay the
start. Its own budget keeps the 1 MB of #135 for what the first frame needs.

#### B. One budget, raised to fit

Simpler, but a larger number would let the images and sounds grow without anyone noticing.

## Recommendation

The track A and the budget A.

## Decision

The owner accepted the recommendation on 2026-11-17: a track from the Music Loop Bundle, which
the owner picks, and a music budget of 3 MB.

## Consequences

- **The budget.** `MUSIC_BUDGET` in `apps/web/scripts/asset-budget.ts`. A built file whose name
  starts with `music-` counts against it and not against the 1 MB of #135; the build fails above
  either.
- **Streaming.** The mixer plays music from a media element through its music group
  (`streamMusic`), so the volume setting applies, and lowers it for a moment (`duck`).
- **The sounds' side.** Each explosion ducks the music: down to 40 % in 50 ms, held for 0.25 s,
  back in 0.5 s.
- **One file under 1 MB.** Every file tracked by git stays under 1 MB (`check-file-sizes`), the
  track too: a loop of about 60 to 80 s at 96 to 128 kilobits a second in Ogg. The 3 MB leave room for a
  second encoding for browsers without Ogg, as the sounds have WAV.
- **The track.** It goes into `apps/web/assets-src/music/` with the license of the pack beside it,
  and into `ASSETS.md`, as the sounds do. `MUSIC_TRACK` in `apps/web/src/game/music-track.ts`
  lists its encodings, best first; the browser plays the first it can.
- **When it plays.** During a run and between its levels. A pause holds its place, a hidden page
  silences it, since the loop runs no frames then, and the end of a run starts it over for the
  next. The menu downloads none of it: the `<audio>` element is made at the first play.
