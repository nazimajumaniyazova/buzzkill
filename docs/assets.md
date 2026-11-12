# Assets

Every image and sound the game uses: the file, where the code uses it, what it is for, and where it
came from (#131). Stage 6 replaces what cannot stay (#132), builds the files through a pipeline
(#133) and lists what ships with its source and license in `ASSETS.md` (#134).

## Summary

- `apps/web/src/assets` holds 11 files, 1,500,478 bytes: 8 images (1,094,216 bytes) and 3 sounds
  (406,262 bytes). Two sprite sheets are over 400 kB each.
- **Their source is unknown.** The owner downloaded all 11 for the 2023 team project and did not
  record where from, so their license is unknown. They stay in the game until the replacements of
  #132 and are not the owner's work.
- Three kinds of art are drawn as placeholders, because the 2023 files were drawn by other members
  of the team or were over 1 MB: the heroes, the background and the first day enemy.
- The game plays no music. The 2023 repository held a music file that its code never used.

## Files

Images. Every sheet is one row of frames of the size the game configuration gives
(`packages/game/src/config`); `createGameSprites` in `apps/web/src/game/sprites.ts` cuts them into
atlases.

| File                 | Format       | Bytes   | Pixels   | Frames used                    | Used for                                          |
| -------------------- | ------------ | ------- | -------- | ------------------------------ | ------------------------------------------------- |
| `enemy-2.png`        | PNG, RGBA    | 429,237 | 3794×207 | 13 of 15, 253×207              | Day enemy `day-2`                                 |
| `enemy-3.png`        | PNG, RGBA    | 436,538 | 3990×207 | 13 of 15, 266×207              | Day enemy `day-3`                                 |
| `enemy_bat_3.png`    | PNG, RGBA    | 69,265  | 1596×188 | 6 of 6, 266×188                | Night enemy `night-bat`                           |
| `enemy_raven.png`    | PNG, RGBA    | 36,479  | 1626×194 | 6 of 6, 271×194                | Night enemy `night-raven`                         |
| `enemy_bat_2.png`    | PNG, RGBA    | 75,622  | 1904×167 | 7 of 8, 238×167                | Night enemy `night-ghost`                         |
| `smokeExplosion.png` | PNG, palette | 18,671  | 1600×200 | 9 configured, 8 drawn, 200×200 | Explosion of a destroyed enemy, variant 0 (smoke) |
| `fireExplosion.png`  | PNG, palette | 28,069  | 1600×200 | 9 configured, 8 drawn, 200×200 | Explosion of a destroyed enemy, variant 1 (fire)  |
| `projectile.png`     | PNG, palette | 335     | 28×10    | 1, cut at 10×3                 | The hero's shot                                   |

Sounds. The game's events play them through the mixer (`packages/game/src/game/create-game.ts`);
they are optional, so a browser without Web Audio runs silent.

| File               | Format                       | Bytes   | Length | Sound       | Plays when                |
| ------------------ | ---------------------------- | ------- | ------ | ----------- | ------------------------- |
| `bullet-sound.wav` | WAV, 16-bit stereo, 24 kHz   | 182,094 | 1.90 s | `shot`      | The hero shoots           |
| `smoke-bomb.wav`   | WAV, 16-bit stereo, 24 kHz   | 138,318 | 1.44 s | `explosion` | An enemy is destroyed     |
| `pain-sound.wav`   | WAV, 16-bit stereo, 44.1 kHz | 85,850  | 0.49 s | `hit`       | An enemy touches the hero |

Origin, from the history of the 2023 repository: the owner added the files between 2023-02-16 and
2023-02-28 (`projectile.png` first; `enemy-2.png`, `enemy_bat_2.png`, `enemy_raven.png` and
`pain-sound.wav` last). The owner confirmed on 2026-11-10 that all of them were downloaded and the
source is not known.

## Placeholders

| Stands for                    | In the 2023 game                                                            | Why it is not here                                | Drawn now as                                                |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| The heroes, Mike and Julie    | `male.png` and `female.png` sprite sheets                                   | Drawn by another member of the team               | A rectangle in each hero's color (`COLORS.hero`)            |
| The background, day and night | `bg-day.jpg` (1.14 MB) and `bg-night-4.jpg` (1.62 MB), scrolled as parallax | Over 1 MB, and downloaded with no recorded source | The sky color of the theme, without parallax (`COLORS.sky`) |
| The first day enemy, `day-1`  | `enemy-1.png`                                                               | Drawn by another member of the team               | A red box with its health bar (`MISSING_SHEETS`)            |

`apps/web/src/game/draw-game.ts` draws every placeholder from the design tokens. `parallaxOffset`
in `packages/game` already computes the scroll of background layers; nothing draws them yet.

## Observations

Found while taking the inventory; the pipeline of #133, which generates the frame data from the
images, removes all three.

- **Explosions.** The rules give 9 frames of 200×200 (`RULES.explosion`), but both sheets are
  1600 px wide, 8 frames. The ninth frame is read past the right edge and draws nothing for its 4
  ticks.
- **Projectile.** The atlas cuts one frame of the shot's size, 10×3 (`RULES.projectile`), from an
  image of 28×10, so only its top-left corner is drawn.
- **Unused frames.** `enemy-2.png` and `enemy-3.png` hold 15 frames and the game uses 13;
  `enemy_bat_2.png` holds 8 and the game uses 7.

## What must be replaced

Everything above: the 11 files of unknown source and the three placeholders. The sounds included,
since their source is unknown too.

## Replacements

The owner chose on 2026-11-11 to draw the art for the project and to take the sounds from CC0 packs
(ADR-0015). The art lives in `packages/art` as code, in the frame sizes of the game configuration,
so every enemy keeps its hitbox. The game draws it once the pipeline of #133 has turned it into
atlases.

| Now                                       | Replaced by (`@buzzkill/art`)                                       | Frame                  | Frames |
| ----------------------------------------- | ------------------------------------------------------------------- | ---------------------- | ------ |
| `day-1`, a placeholder box                | `beetle`: a horned beetle in a teal shell                           | 273×273                | 6      |
| `day-2`, `enemy-2.png`                    | `wasp`: a striped wasp with glowing eyes                            | 253×207                | 6      |
| `day-3`, `enemy-3.png`                    | `dragonfly`: a blue dragonfly, two pairs of wings                   | 266×207                | 4      |
| `night-bat`, `enemy_bat_3.png`            | `moth`: a moth with glowing eye spots                               | 266×188                | 8      |
| `night-raven`, `enemy_raven.png`          | `firefly`: a firefly with a pulsing lamp                            | 271×194                | 6      |
| `night-ghost`, `enemy_bat_2.png`          | `mosquito`: a mosquito with red eyes                                | 238×167                | 4      |
| The heroes, rectangles                    | `mike` and `julie`: a jetpack and a blaster                         | 321×316, 275×297       | 4      |
| `smokeExplosion.png`, `fireExplosion.png` | `explosion-smoke`, `explosion-fire`                                 | 400×400                | 9      |
| `projectile.png`                          | `shot`, and `shot-trail` for drawing it in flight                   | 20×6, 60×12            | 1      |
| The sky color                             | The city by day and by night: sky, clouds, far, mid and near layers | 1280×720, world pixels | —      |

The sounds come from Kenney's Sci-fi Sounds and Impact Sounds (CC0). The owner downloaded the packs,
since kenney.nl refuses automated downloads, and approved one file for each sound on 2026-11-11,
from candidates listened to on the review page. The files and both licenses are in `apps/web/assets-src/sounds/`, listed in
`apps/web/assets-src/README.md`.

| Now                            | Replaced by                                | Length (2023 file) |
| ------------------------------ | ------------------------------------------ | ------------------ |
| `bullet-sound.wav` (`shot`)    | `laserSmall_001.ogg`, Sci-Fi Sounds        | 0.25 s (1.90 s)    |
| `smoke-bomb.wav` (`explosion`) | `explosionCrunch_000.ogg`, Sci-Fi Sounds   | 0.78 s (1.44 s)    |
| `pain-sound.wav` (`hit`)       | `impactPunch_heavy_002.ogg`, Impact Sounds | 0.46 s (0.49 s)    |

The new sounds are Ogg Vorbis, 44.1 kHz, 7 to 28 kB each, against 86 to 182 kB of WAV. The game
plays them once the pipeline of #133 adds a fallback for browsers without Ogg.
