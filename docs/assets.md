# Assets

Every image and sound the game uses: what it loads, where each file comes from, and the 2023 files
it replaced (#131). Stage 6 replaced what could not stay (#132), builds the files through a
pipeline (#133) and lists what ships with its source and license in `ASSETS.md` (#134).

## What the game loads

`pnpm assets` generates every file below from the art in `packages/art` and the sounds in
`apps/web/assets-src` (ADR-0016), together with the typed manifest
`apps/web/src/assets/manifest.gen.ts`. `apps/web/src/game/assets.ts` loads them, and
`apps/web/src/game/sprites.ts` cuts the atlases with the frames of the manifest.

| File                                              | Format                 | Size   | Holds                                                  |
| ------------------------------------------------- | ---------------------- | ------ | ------------------------------------------------------ |
| `src/assets/creatures.webp`                       | WebP, lossy, 2030×1485 | 233 kB | The heroes and the six enemies, every frame            |
| `src/assets/effects.webp`                         | WebP, lossy, 2008×1606 | 125 kB | Both explosions, 9 frames each, and the shot in flight |
| `assets-src/sounds/…/laserSmall_001.ogg`          | Ogg Vorbis             | 7 kB   | `shot`                                                 |
| `assets-src/sounds/…/explosionCrunch_000.ogg`     | Ogg Vorbis             | 28 kB  | `explosion`                                            |
| `assets-src/sounds/…/impactPunch_heavy_002.ogg`   | Ogg Vorbis             | 9 kB   | `hit`                                                  |
| `src/assets/shot.wav`, `explosion.wav`, `hit.wav` | WAV, 16-bit PCM        | 189 kB | The same sounds, for browsers that cannot decode Ogg   |

- The frames are drawn at twice the world's pixels, so they stay sharp at a device pixel ratio of 2.
  Each atlas is at most 2048 px on a side, with 2 px between frames.
- A browser downloads a WAV only when it cannot decode the Ogg file, as Safari before 18.4.
- WebP quality 80 was chosen on crops at twice the size: it looks the same as the lossless master,
  which is 1.8 times larger.
- `apps/web/scripts/assets/manifest.test.ts` fails when the art, a sound or a setting changes and
  the files have not been regenerated.
- The background is still the sky color of the theme; the city layers come next in #133.

## The 2023 files

The game used these until #133 removed them. They are listed here as a record of what was replaced.

- `apps/web/src/assets` held 11 files, 1,500,478 bytes: 8 images (1,094,216 bytes) and 3 sounds
  (406,262 bytes). Two sprite sheets were over 400 kB each.
- **Their source is unknown.** The owner downloaded all 11 for the 2023 team project and did not
  record where from, so their license is unknown, and they are not the owner's work.
- Three kinds of art were drawn as placeholders, because the 2023 files were drawn by other members
  of the team or were over 1 MB: the heroes, the background and the first day enemy.
- The game plays no music. The 2023 repository held a music file that its code never used.

### Files

Images. Every sheet was one row of frames of the size the game configuration gave
(`packages/game/src/config`), cut into atlases by `createGameSprites`.

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

Sounds. The game's events played them through the mixer (`packages/game/src/game/create-game.ts`);
they were optional, so a browser without Web Audio ran silent.

| File               | Format                       | Bytes   | Length | Sound       | Plays when                |
| ------------------ | ---------------------------- | ------- | ------ | ----------- | ------------------------- |
| `bullet-sound.wav` | WAV, 16-bit stereo, 24 kHz   | 182,094 | 1.90 s | `shot`      | The hero shoots           |
| `smoke-bomb.wav`   | WAV, 16-bit stereo, 24 kHz   | 138,318 | 1.44 s | `explosion` | An enemy is destroyed     |
| `pain-sound.wav`   | WAV, 16-bit stereo, 44.1 kHz | 85,850  | 0.49 s | `hit`       | An enemy touches the hero |

Origin, from the history of the 2023 repository: the owner added the files between 2023-02-16 and
2023-02-28 (`projectile.png` first; `enemy-2.png`, `enemy_bat_2.png`, `enemy_raven.png` and
`pain-sound.wav` last). The owner confirmed on 2026-11-10 that all of them were downloaded and the
source is not known.

### Placeholders

| Stands for                    | In the 2023 game                                                            | Why it is not here                                | Drawn now as                                                |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| The heroes, Mike and Julie    | `male.png` and `female.png` sprite sheets                                   | Drawn by another member of the team               | A rectangle in each hero's color (`COLORS.hero`)            |
| The background, day and night | `bg-day.jpg` (1.14 MB) and `bg-night-4.jpg` (1.62 MB), scrolled as parallax | Over 1 MB, and downloaded with no recorded source | The sky color of the theme, without parallax (`COLORS.sky`) |
| The first day enemy, `day-1`  | `enemy-1.png`                                                               | Drawn by another member of the team               | A red box with its health bar (`MISSING_SHEETS`)            |

Since #133 the heroes and the first day enemy are drawn from the new art. The background stays the
sky color until the city layers are drawn with `parallaxOffset`.

### Observations

Found while taking the inventory. The pipeline of #133 generates the frame data from the art, so
none of them can happen again.

- **Explosions.** The rules give 9 frames of 200×200 (`RULES.explosion`), but both sheets are
  1600 px wide, 8 frames. The ninth frame is read past the right edge and draws nothing for its 4
  ticks.
- **Projectile.** The atlas cuts one frame of the shot's size, 10×3 (`RULES.projectile`), from an
  image of 28×10, so only its top-left corner is drawn.
- **Unused frames.** `enemy-2.png` and `enemy-3.png` hold 15 frames and the game uses 13;
  `enemy_bat_2.png` holds 8 and the game uses 7.

### What had to be replaced

Everything above: the 11 files of unknown source and the three placeholders. The sounds included,
since their source is unknown too.

## Replacements

The owner chose on 2026-11-11 to draw the art for the project and to take the sounds from CC0 packs
(ADR-0015). The art lives in `packages/art` as code, in the frame sizes of the game configuration,
so every enemy keeps its hitbox. The game draws it from the atlases of the pipeline (#133).

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
| `projectile.png`                          | `shot-trail`: the shot in flight, its head the 10×3 hitbox          | 60×12                  | 1      |
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
plays them since #133, with a WAV for browsers that cannot decode Ogg.
