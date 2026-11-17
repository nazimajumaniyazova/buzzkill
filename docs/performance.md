# Performance

The budgets the project holds itself to and how each is checked. The size limits come first, with
the game's assets (#135). Stage 9 adds the rest: frame time, the JavaScript of the shell, the Core
Web Vitals, and the measurements before and after each optimization.

## Size limits

| What                                    | Limit                 | Today                                                | Checked by                                                                                |
| --------------------------------------- | --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Any file tracked by git                 | 1 MB, 1,000,000 bytes | 338 kB at most (`pnpm-lock.yaml`)                    | `scripts/check-file-sizes.mjs`, in `pnpm lint:repo` and the CI Quality job                |
| The game's images and sounds in a build | 1 MB, 1,000,000 bytes | 919 kB in 22 files; 637 kB without the WAV fallbacks | `assetBudget` in `apps/web/vite.config.ts`, in every build: the CI Build job and Vercel's |
| The music in a build (ADR-0018)         | 3 MB, 3,000,000 bytes | None yet                                             | The same plugin: the files whose name starts with `music-`                                |

The build prints the second and third lines every time, for example
`Game assets: 919.1 kB of the 1000.0 kB budget (92%), 22 files`, and fails above either budget.
The music streams during a run, so it does not wait for the first frame; each of its files is
still a file in git, and so stays under 1 MB.

### Why these numbers

- **One file.** Every clone downloads the whole history, so a large file stays in it for good. In
  2023 two backgrounds were over 1 MB (1.14 and 1.62 MB) and two sprite sheets over 400 kB; none
  of them is in the repository since #133.
- **The assets.** The game loads its images and sounds before the first frame, starting at the
  first hover of Play (#112). On slow 4G, about 200 kB/s, the 637 kB a browser downloads today
  take about 3.2 s; the budget keeps the worst case near 5 s.
- **The choice.** The owner chose 1 MB on 2026-11-12 over two other options:
  - 800 kB, 84% used at the time, which stage 7 would soon have to raise;
  - 600 kB for what a browser downloads, which is harder to check, since the WAV fallbacks would
    have to be told apart.

  1 MB leaves room for the sprites of stage 7: the boss and the power-ups. The power-ups and
  their pickup sound took 53 kB of it (#151). The queen, her rage, her sting and her phase sound
  took 191 kB (#152). Her rage is an overlay of what changes rather than a second set of frames,
  which would have taken about 50 kB more.

- **What is left.** 81 kB. The two heroes to unlock (#164) are estimated at about 66 kB. Music
  (#161) cannot fit; it needs a decision on the budget when it comes. The cheapest saving left is
  the WAV fallbacks at 22 kHz mono, about 150 kB, which would change the owner's choice of #133.

- **What it counts.** Every image and sound the build emits, the WAV fallbacks too, though most
  browsers download only the Ogg files. Code and styles get budgets of their own in stage 9. A
  file under Vite's 4 kB inline limit becomes part of the code.

### Raising a limit

Make the files smaller first: the WebP quality, the frame count, the sample rate. If that is not
enough, raise the limit in a pull request that says why, here and in the constant:
`LIMIT` in `scripts/check-file-sizes.mjs` or `ASSET_BUDGET` in `apps/web/scripts/asset-budget.ts`.
Music, if stage 7 adds it, is better streamed than loaded before the first frame.

## Particles

The particles of #156 add nothing to the asset budget: they are rectangles in the colors of the
design tokens. A run makes all of them when it starts, 384 behind the insects and 256 in front, and
reuses them, so a frame allocates nothing. A full layer skips new particles instead of growing.

The benchmark `update 640 particles and replace the dead`, in
`packages/engine/src/particles/particles.bench.ts`, measures a frame with both layers full. CodSpeed
runs it with the others (ADR-0012). Under Vitest on a laptop it took 9.6 µs a frame on 2026-11-16,
under 0.1 % of a frame at 60 Hz. Drawing them is part of frame time, which gets its budget in
stage 9.
