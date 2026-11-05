import { type AssetDecoders, AssetLoadError } from '../assets/loader';

export interface BrowserAssetDecoderOptions {
  /**
   * Decodes sounds. `null` when Web Audio is unavailable: every sound then fails with reason
   * `unavailable`, which an optional manifest entry turns into a silent game.
   */
  readonly audioContext: Pick<BaseAudioContext, 'decodeAudioData'> | null;
  /** Defaults to the global `fetch`; tests pass a fake. */
  readonly fetch?: (url: string) => Promise<Response>;
  /** Defaults to the global `createImageBitmap`; tests pass a fake. */
  readonly createImageBitmap?: (blob: Blob) => Promise<ImageBitmap>;
}

/**
 * Decoders for `loadAssets` in the browser. Images become `ImageBitmap`s, decoded off the main
 * thread and ready to draw without a decode stall on first use; sounds become `AudioBuffer`s.
 */
export function createBrowserAssetDecoders(
  options: BrowserAssetDecoderOptions,
): AssetDecoders<ImageBitmap, AudioBuffer> {
  const fetchUrl = options.fetch ?? ((url: string) => fetch(url));
  const toBitmap = options.createImageBitmap ?? ((blob: Blob) => createImageBitmap(blob));
  const { audioContext } = options;

  const request = async (url: string): Promise<Response> => {
    let response: Response;
    try {
      response = await fetchUrl(url);
    } catch (error) {
      throw new AssetLoadError('network', `${url}: ${messageOf(error)}`);
    }
    if (!response.ok) {
      throw new AssetLoadError('http', `${url}: HTTP ${String(response.status)}`);
    }
    return response;
  };

  return {
    async image(url) {
      const blob = await (await request(url)).blob();
      try {
        return await toBitmap(blob);
      } catch (error) {
        throw new AssetLoadError('decode', `${url}: ${messageOf(error)}`);
      }
    },
    async audio(url) {
      if (audioContext === null) {
        throw new AssetLoadError('unavailable', `${url}: Web Audio is not available`);
      }
      const bytes = await (await request(url)).arrayBuffer();
      try {
        return await audioContext.decodeAudioData(bytes);
      } catch (error) {
        throw new AssetLoadError('decode', `${url}: ${messageOf(error)}`);
      }
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
