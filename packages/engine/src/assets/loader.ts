/**
 * Loads every asset of a manifest up front, before the game starts, and reports progress for a
 * loading screen. Nothing is decoded during play, and no entity ever creates an `Image`.
 *
 * The loader itself is headless: decoding is passed in. The browser entry provides decoders built
 * on `fetch`, `createImageBitmap` and `decodeAudioData`; tests provide fakes.
 *
 * Failures are values, not exceptions: the result lists every asset that failed and why, so the
 * shell can show the player a message instead of a blank canvas.
 */

export type AssetKind = 'image' | 'audio';

export interface AssetEntry {
  readonly kind: AssetKind;
  readonly url: string;
  /**
   * The same asset in a format more browsers decode, tried only when `url` downloads but does not
   * decode. Safari decodes Ogg sounds unreliably, so each sound comes with a WAV (ADR-0016). A
   * failed download is reported at once: the fallback comes from the same server.
   */
  readonly fallbackUrl?: string;
  /**
   * The game can run without it, as with sound when Web Audio is unavailable. Its failure is
   * reported in `skipped` and its value is `undefined`; the load still succeeds.
   */
  readonly optional?: boolean;
}

export type AssetManifest = Readonly<Record<string, AssetEntry>>;

/** Turns a URL into a usable asset. Rejections should be `AssetLoadError`s to keep their reason. */
export interface AssetDecoders<TImage, TAudio> {
  image(url: string): Promise<TImage>;
  audio(url: string): Promise<TAudio>;
}

/**
 * Why an asset failed: the request failed (`network`), the server answered with an error
 * (`http`), the bytes were not a valid image or sound (`decode`), the platform cannot load this
 * kind at all (`unavailable`, for example no Web Audio), or anything else (`unknown`).
 */
export type AssetFailureReason = 'network' | 'http' | 'decode' | 'unavailable' | 'unknown';

/** The error decoders throw so that the loader can report a reason. */
export class AssetLoadError extends Error {
  readonly reason: AssetFailureReason;

  constructor(reason: AssetFailureReason, message: string) {
    super(message);
    this.name = 'AssetLoadError';
    this.reason = reason;
  }
}

export interface AssetFailure {
  readonly id: string;
  readonly kind: AssetKind;
  readonly url: string;
  readonly reason: AssetFailureReason;
  readonly message: string;
}

/** The loaded value of each manifest entry, typed by its kind; optional entries may be missing. */
export type LoadedAssets<M extends AssetManifest, TImage, TAudio> = {
  readonly [K in keyof M]:
    | (M[K] extends { readonly kind: 'image' } ? TImage : TAudio)
    | (M[K] extends { readonly optional: true } ? undefined : never);
};

export type AssetLoadResult<M extends AssetManifest, TImage, TAudio> =
  | {
      readonly ok: true;
      readonly assets: LoadedAssets<M, TImage, TAudio>;
      /** Optional assets that failed; the game runs without them. */
      readonly skipped: readonly AssetFailure[];
    }
  | { readonly ok: false; readonly failures: readonly AssetFailure[] };

export interface LoadProgress {
  readonly loaded: number;
  readonly total: number;
  /** `loaded / total`, from 0 to 1; 1 for an empty manifest. */
  readonly fraction: number;
}

export interface LoadAssetsOptions {
  /** Called once with 0 before loading and after every asset that finishes, failed or not. */
  readonly onProgress?: (progress: LoadProgress) => void;
}

/**
 * Loads all entries in parallel. Resolves when every entry has finished; never rejects.
 */
export async function loadAssets<const M extends AssetManifest, TImage, TAudio>(
  manifest: M,
  decoders: AssetDecoders<TImage, TAudio>,
  options: LoadAssetsOptions = {},
): Promise<AssetLoadResult<M, TImage, TAudio>> {
  const ids = Object.keys(manifest);
  const total = ids.length;
  let loaded = 0;
  const report = (): void => {
    options.onProgress?.({ loaded, total, fraction: total === 0 ? 1 : loaded / total });
  };
  report();

  const values: Record<string, unknown> = {};
  const failures: AssetFailure[] = [];
  const skipped: AssetFailure[] = [];

  const decode = (entry: AssetEntry, url: string): Promise<unknown> =>
    entry.kind === 'image' ? decoders.image(url) : decoders.audio(url);

  await Promise.all(
    ids.map(async (id) => {
      const entry = manifest[id] as AssetEntry;
      let url = entry.url;
      let message = '';
      try {
        try {
          values[id] = await decode(entry, url);
        } catch (error) {
          if (entry.fallbackUrl === undefined || reasonOf(error) !== 'decode') {
            throw error;
          }
          message = `${messageOf(error)}; then `;
          url = entry.fallbackUrl;
          values[id] = await decode(entry, url);
        }
      } catch (error) {
        const failure: AssetFailure = {
          id,
          kind: entry.kind,
          url,
          reason: reasonOf(error),
          message: message + messageOf(error),
        };
        if (entry.optional === true) {
          values[id] = undefined;
          skipped.push(failure);
        } else {
          failures.push(failure);
        }
      }
      loaded += 1;
      report();
    }),
  );

  // Failures arrive in completion order; sort them so the message does not depend on timing.
  const byManifestOrder = (a: AssetFailure, b: AssetFailure): number =>
    ids.indexOf(a.id) - ids.indexOf(b.id);
  if (failures.length > 0) {
    return { ok: false, failures: failures.sort(byManifestOrder) };
  }
  // Every key of the manifest now has its value, so the record has the mapped type.
  const assets = values as LoadedAssets<M, TImage, TAudio>;
  return { ok: true, assets, skipped: skipped.sort(byManifestOrder) };
}

function reasonOf(error: unknown): AssetFailureReason {
  return error instanceof AssetLoadError ? error.reason : 'unknown';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
