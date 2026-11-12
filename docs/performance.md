# Performance

The budgets the project holds itself to and how each is checked. The size limits come first, with
the game's assets (#135). Stage 9 adds the rest: frame time, the JavaScript of the shell, the Core
Web Vitals, and the measurements before and after each optimization.

## Size limits

| What                                    | Limit                 | Today                                                | Checked by                                                                                |
| --------------------------------------- | --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Any file tracked by git                 | 1 MB, 1,000,000 bytes | 338 kB at most (`pnpm-lock.yaml`)                    | `scripts/check-file-sizes.mjs`, in `pnpm lint:repo` and the CI Quality job                |
| The game's images and sounds in a build | 1 MB, 1,000,000 bytes | 675 kB in 17 files; 482 kB without the WAV fallbacks | `assetBudget` in `apps/web/vite.config.ts`, in every build: the CI Build job and Vercel's |

The build prints the second line every time, for example
`Game assets: 674.7 kB of the 1000.0 kB budget (67%), 17 files`, and fails above the budget.

### Why these numbers

- **One file.** Every clone downloads the whole history, so a large file stays in it for good. In
  2023 two backgrounds were over 1 MB (1.14 and 1.62 MB) and two sprite sheets over 400 kB; none
  of them is in the repository since #133.
- **The assets.** The game loads its images and sounds before the first frame, starting at the
  first hover of Play (#112). On slow 4G, about 200 kB/s, the 482 kB a browser downloads today
  take about 2.4 s; the budget keeps the worst case near 5 s.
- **The choice.** The owner chose 1 MB on 2026-11-12 over two other options:
  - 800 kB, 84% used today, which stage 7 would soon have to raise;
  - 600 kB for what a browser downloads, which is harder to check, since the WAV fallbacks would
    have to be told apart.

  1 MB leaves room for the sprites of stage 7: the boss and the bonuses.

- **What it counts.** Every image and sound the build emits, the WAV fallbacks too, though most
  browsers download only the Ogg files. Code and styles get budgets of their own in stage 9. A
  file under Vite's 4 kB inline limit becomes part of the code.

### Raising a limit

Make the files smaller first: the WebP quality, the frame count, the sample rate. If that is not
enough, raise the limit in a pull request that says why, here and in the constant:
`LIMIT` in `scripts/check-file-sizes.mjs` or `ASSET_BUDGET` in `apps/web/scripts/asset-budget.ts`.
Music, if stage 7 adds it, is better streamed than loaded before the first frame.
