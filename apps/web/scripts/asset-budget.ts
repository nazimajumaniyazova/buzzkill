import type { Plugin } from 'vite';

/**
 * The most the game's images and sounds may weigh together in a build, in bytes (#135,
 * `docs/performance.md`): the owner's choice of 2026-11-12. Raise it only in a pull request that
 * says why.
 */
export const ASSET_BUDGET = 1_000_000;

/**
 * The most the music may weigh, in bytes (ADR-0018): the owner's choice of 2026-11-17. It streams
 * during a run rather than loading before the first frame, so it has a budget of its own.
 */
export const MUSIC_BUDGET = 3_000_000;

/** Images and sounds; the code and the styles have budgets of their own (stage 9). */
const ASSET_FILE = /\.(avif|webp|png|jpe?g|gif|svg|ogg|opus|mp3|m4a|wav)$/i;

/** A music file: its name starts with `music-` (ADR-0018). */
const MUSIC_FILE = /(^|\/)music-[^/]*$/i;

/** The game's images and sounds, or its music. */
export type AssetKind = 'game' | 'music';

const TITLES: Record<AssetKind, string> = { game: 'Game assets', music: 'Music' };

interface BuiltFile {
  readonly fileName: string;
  readonly size: number;
}

export interface AssetReport {
  /** Bytes of every image and sound. */
  readonly total: number;
  readonly files: number;
  readonly budget: number;
  readonly over: boolean;
}

/**
 * Adds up the images and sounds of `kind` among the built files, the game's without the music by
 * default, and compares them with the budget.
 */
export function measureAssets(
  files: readonly BuiltFile[],
  budget: number,
  kind: AssetKind = 'game',
): AssetReport {
  let total = 0;
  let count = 0;
  for (const { fileName, size } of files) {
    if (ASSET_FILE.test(fileName) && MUSIC_FILE.test(fileName) === (kind === 'music')) {
      total += size;
      count += 1;
    }
  }
  return { total, files: count, budget, over: total > budget };
}

/** One line for the build log, in kilobytes of 1000 bytes like Vite's own report. */
export function formatAssetReport(report: AssetReport, kind: AssetKind = 'game'): string {
  const kilobytes = (bytes: number): string => `${(bytes / 1000).toFixed(1)} kB`;
  const share = Math.round((report.total / report.budget) * 100);
  return `${TITLES[kind]}: ${kilobytes(report.total)} of the ${kilobytes(report.budget)} budget (${String(share)}%), ${String(report.files)} files`;
}

/**
 * Reports the size of the game's assets after every build and fails the build above the budget,
 * so CI and the preview deploys stop a pull request that makes the game heavier than agreed. A
 * file under Vite's inline limit becomes part of the code and is not counted here.
 */
export function assetBudget(budget = ASSET_BUDGET, musicBudget = MUSIC_BUDGET): Plugin {
  const encoder = new TextEncoder();
  let log: (message: string) => void = () => undefined;
  return {
    name: 'buzzkill:asset-budget',
    apply: 'build',
    configResolved(config) {
      log = (message) => {
        config.logger.info(message);
      };
    },
    generateBundle(_options, bundle) {
      const files = Object.values(bundle).map((output) => ({
        fileName: output.fileName,
        size:
          output.type === 'asset'
            ? typeof output.source === 'string'
              ? encoder.encode(output.source).byteLength
              : output.source.byteLength
            : 0,
      }));
      const report = measureAssets(files, budget);
      const music = measureAssets(files, musicBudget, 'music');
      log(formatAssetReport(report));
      log(formatAssetReport(music, 'music'));
      if (report.over) {
        this.error(
          `The game's assets are over their budget by ${String(report.total - report.budget)} bytes; ` +
            'make them smaller, or raise ASSET_BUDGET in apps/web/scripts/asset-budget.ts with a reason.',
        );
      }
      if (music.over) {
        this.error(
          `The music is over its budget by ${String(music.total - music.budget)} bytes; ` +
            'make it smaller, or raise MUSIC_BUDGET in apps/web/scripts/asset-budget.ts with a reason.',
        );
      }
    },
  };
}
