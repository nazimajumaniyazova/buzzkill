# Asset sources

The sources of the game's assets that are not drawn as code (ADR-0015). The art lives in
`packages/art`; this folder holds what comes from outside, exactly as downloaded, next to its
license. `pnpm assets` (ADR-0016) turns them into what the game loads: the game loads each Ogg file
as it is, and a WAV that the pipeline writes to `src/assets` for browsers that cannot decode Ogg.

## Sounds

From two CC0 packs by Kenney (<https://kenney.nl>), chosen by the owner on 2026-11-11 (#132). Each
pack's `License.txt` is the one that came with it.

| Game sound  | Plays when                | File                                                    | Length |
| ----------- | ------------------------- | ------------------------------------------------------- | ------ |
| `shot`      | The hero shoots           | `sounds/kenney-sci-fi-sounds/laserSmall_001.ogg`        | 0.25 s |
| `explosion` | An enemy is destroyed     | `sounds/kenney-sci-fi-sounds/explosionCrunch_000.ogg`   | 0.78 s |
| `hit`       | An enemy touches the hero | `sounds/kenney-impact-sounds/impactPunch_heavy_002.ogg` | 0.46 s |

| Pack          | Version, date   | Source                                   | License |
| ------------- | --------------- | ---------------------------------------- | ------- |
| Sci-Fi Sounds | 1.0, 2020-10-11 | <https://kenney.nl/assets/sci-fi-sounds> | CC0 1.0 |
| Impact Sounds | 1.0, 2019-12-19 | <https://kenney.nl/assets/impact-sounds> | CC0 1.0 |

Only the files the game uses are in the repository. To change a sound, download the pack from its
page and copy the new file here unchanged. Then point `SOUND_SOURCES` in `scripts/assets/plan.ts`
at it, run `pnpm assets`, and update the table and `docs/assets.md`.
