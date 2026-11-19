# Asset sources

The sources of the game's assets that are not drawn as code (ADR-0015). The art lives in
`packages/art`; this folder holds what comes from outside, exactly as downloaded, next to its
license. `pnpm assets` (ADR-0016) turns them into what the game loads: the game loads each Ogg file
as it is, and a WAV that the pipeline writes to `src/assets` for browsers that cannot decode Ogg.

## Sounds

From two CC0 packs by Kenney (<https://kenney.nl>), chosen by the owner on 2026-11-11 (#132), and
the pickup sound and the boss's phase sound on 2026-11-13 (#151, #152). Each pack's `License.txt` is the one that came with it.

| Game sound  | Plays when                             | File                                                    | Length |
| ----------- | -------------------------------------- | ------------------------------------------------------- | ------ |
| `shot`      | The hero shoots                        | `sounds/kenney-sci-fi-sounds/laserSmall_001.ogg`        | 0.25 s |
| `explosion` | An enemy is destroyed                  | `sounds/kenney-sci-fi-sounds/explosionCrunch_000.ogg`   | 0.78 s |
| `hit`       | An enemy touches the hero              | `sounds/kenney-impact-sounds/impactPunch_heavy_002.ogg` | 0.46 s |
| `pickup`    | The hero collects a power-up           | `sounds/kenney-sci-fi-sounds/laserRetro_000.ogg`        | 0.24 s |
| `bossPhase` | The queen arrives, and her rage begins | `sounds/kenney-sci-fi-sounds/impactMetal_003.ogg`       | 0.78 s |

| Pack          | Version, date   | Source                                   | License |
| ------------- | --------------- | ---------------------------------------- | ------- |
| Sci-Fi Sounds | 1.0, 2020-10-11 | <https://kenney.nl/assets/sci-fi-sounds> | CC0 1.0 |
| Impact Sounds | 1.0, 2019-12-19 | <https://kenney.nl/assets/impact-sounds> | CC0 1.0 |

Only the files the game uses are in the repository. To change a sound, download the pack from its
page and copy the new file here unchanged. Then point `SOUND_SOURCES` in `scripts/assets/plan.ts`
at it, run `pnpm assets`, and update the table, `docs/assets.md` and the row in `ASSETS.md`.

## Music

"Pixel War 1" from the chiptune pack of the Music Loop Bundle by Abstraction (Tallbeard Studios,
<https://tallbeard.itch.io/music-loop-bundle>), chosen by the owner on 2026-11-19 (#161). The pack
is CC0; its `_LICENSE.txt` is `music/abstraction-music-loop-bundle/License.txt`, renamed so the
ASSETS.md test finds it beside the other packs' licenses.

| File                    | Length                    | Size    | Made from                                               |
| ----------------------- | ------------------------- | ------- | ------------------------------------------------------- |
| `music-pixel-war-1.ogg` | 2,352,154 samples, 53.3 s | 0.79 MB | `Three Red Hearts Pixel War 1.ogg`, Vorbis at quality 5 |
| `music-pixel-war-1.m4a` | the same                  | 0.87 MB | the same file, AAC at 128 kbit/s                        |

Unlike the sounds, the music is not here as downloaded: the pack's file weighs 1.42 MB, and every
file tracked by git stays under 1 MB. Both files were encoded with FFmpeg 9.0.2 from the pack's
file (chiptune pack, version 20261003-02):

```sh
ffmpeg -i "Three Red Hearts Pixel War 1.ogg" -map_metadata -1 -c:a libvorbis -q:a 5 music-pixel-war-1.ogg
ffmpeg -i "Three Red Hearts Pixel War 1.ogg" -map_metadata -1 -c:a aac -b:a 128k -movflags +faststart music-pixel-war-1.m4a
```

The Ogg decodes to exactly as many samples as the pack's file, so the loop keeps its length. The
music does not go through `pnpm assets`: the game imports both files as they are, from
`src/game/music-track.ts`. To change the track, encode the new one the same way, keep the `music-`
at the start of each name, point `MUSIC_TRACK` at it and update this section and `ASSETS.md`.
