# Assets

Every file the game ships, with its source, its author and its license, so anyone can check that
the game may be published as it is (#134). [docs/assets.md](docs/assets.md) explains how the files
are made and what they replaced.

- **Images.** Drawn for this project as code in `packages/art` (ADR-0015) and rendered by
  `pnpm assets` (ADR-0016). They are part of the repository and under its MIT license.
- **Sounds.** From Kenney's CC0 packs, as downloaded. Each pack's license is next to its files in
  `apps/web/assets-src/sounds/`. The WAV files are the same sounds, decoded by `pnpm assets` for
  browsers that cannot decode Ogg.
- **Music.** One CC0 loop by Abstraction (Tallbeard Studios), re-encoded so each file stays under
  1 MB: Ogg Vorbis, and AAC for browsers that cannot play Ogg. The pack's license is next to it in
  `apps/web/assets-src/music/`.
- **Nothing else.** The game ships no font or icon; the 2023 files of unknown source left the
  repository in #133.

`apps/web/scripts/assets/assets-md.test.ts` fails when a file of the generated manifest or of the
music (`apps/web/src/game/music-track.ts`) has no row here, when a row names a file the game no longer ships, and when a pack has no license file.

## Images

In `apps/web/src/assets/`, generated from `packages/art`.

| File                   | Holds                                                                    | Source                                        | Author                     | License |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------- | -------------------------- | ------- |
| `creatures.webp`       | The heroes Mike, Julie, Sam and Leo and the six enemies, all frames      | `packages/art/src/heroes.ts`, `insects.ts`    | Buzzkill (this repository) | MIT     |
| `effects.webp`         | The fire and smoke explosions, the shot in flight and the four power-ups | `packages/art/src/effects.ts`, `power-ups.ts` | Buzzkill (this repository) | MIT     |
| `boss.webp`            | The queen wasp, her rage and her sting                                   | `packages/art/src/boss.ts`                    | Buzzkill (this repository) | MIT     |
| `city-day-sky.webp`    | The day sky and the sun                                                  | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-day-clouds.webp` | The clouds                                                               | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-day-far.webp`    | The far towers by day                                                    | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-day-mid.webp`    | The middle towers by day                                                 | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-day-near.webp`   | The near towers and the monorail by day                                  | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-night-sky.webp`  | The night sky, the stars and the moon                                    | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-night-far.webp`  | The far towers by night                                                  | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-night-mid.webp`  | The middle towers by night, with lit windows                             | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |
| `city-night-near.webp` | The near towers and the monorail by night                                | `packages/art/src/city.ts`                    | Buzzkill (this repository) | MIT     |

## Sounds

The Ogg files are in `apps/web/assets-src/sounds/`, in a folder per pack; the WAV files are in
`apps/web/src/assets/`.

| File                        | Plays when                                                        | Source                                                      | Author                                  | License                                                       |
| --------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `laserSmall_001.ogg`        | The hero shoots                                                   | [Sci-Fi Sounds 1.0](https://kenney.nl/assets/sci-fi-sounds) | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `explosionCrunch_000.ogg`   | An enemy is destroyed                                             | [Sci-Fi Sounds 1.0](https://kenney.nl/assets/sci-fi-sounds) | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `impactPunch_heavy_002.ogg` | An enemy touches the hero                                         | [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds) | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `laserRetro_000.ogg`        | The hero collects a power-up                                      | [Sci-Fi Sounds 1.0](https://kenney.nl/assets/sci-fi-sounds) | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `impactMetal_003.ogg`       | The queen arrives, and her rage begins                            | [Sci-Fi Sounds 1.0](https://kenney.nl/assets/sci-fi-sounds) | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `shot.wav`                  | The hero shoots, where Ogg does not decode                        | `laserSmall_001.ogg`, decoded by `pnpm assets`              | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `explosion.wav`             | An enemy is destroyed, where Ogg does not decode                  | `explosionCrunch_000.ogg`, decoded by `pnpm assets`         | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `hit.wav`                   | An enemy touches the hero, where Ogg does not decode              | `impactPunch_heavy_002.ogg`, decoded by `pnpm assets`       | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `pickup.wav`                | The hero collects a power-up, where Ogg does not decode           | `laserRetro_000.ogg`, decoded by `pnpm assets`              | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `bossPhase.wav`             | The queen arrives, and her rage begins, where Ogg does not decode | `impactMetal_003.ogg`, decoded by `pnpm assets`             | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## Music

In `apps/web/assets-src/music/abstraction-music-loop-bundle/`. It streams during a run (#161).

| File                    | Plays when                                  | Source                                                                                                                                            | Author                                                                                 | License                                                       |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `music-pixel-war-1.ogg` | A run plays, and between its levels         | `Three Red Hearts Pixel War 1.ogg` of the [Music Loop Bundle](https://tallbeard.itch.io/music-loop-bundle), chiptune pack 20261003-02, re-encoded | Abstraction, Tallbeard Studios ([abstractionmusic.com](https://abstractionmusic.com/)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `music-pixel-war-1.m4a` | The same, where the browser cannot play Ogg | The same file, encoded as AAC                                                                                                                     | Abstraction, Tallbeard Studios ([abstractionmusic.com](https://abstractionmusic.com/)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

## License texts

- **MIT**, for the images: [LICENSE](LICENSE).
- **CC0 1.0**, for the sounds, as each pack came with it:
  [Sci-Fi Sounds](apps/web/assets-src/sounds/kenney-sci-fi-sounds/License.txt) and
  [Impact Sounds](apps/web/assets-src/sounds/kenney-impact-sounds/License.txt). CC0 asks for no
  credit; Kenney welcomes it, and this file gives it.
- **CC0 1.0**, for the music: [Music Loop Bundle](apps/web/assets-src/music/abstraction-music-loop-bundle/License.txt),
  the `_LICENSE.txt` of the pack, renamed. Abstraction welcomes credit as "Abstraction" with a link
  to the bundle or to [abstractionmusic.com](https://abstractionmusic.com/); this file gives it.
