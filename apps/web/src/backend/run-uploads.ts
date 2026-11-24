import type { SettingsStorage } from '../state/settings/storage';
import { type Backend, createBackend } from './client';
import { type BackendConfig, backendConfig } from './config';
import { createRunQueue, PENDING_RUNS_KEY, type RunQueue } from './run-queue';
import { createSendRun } from './send-run';

/** The Web Locks API, as `navigator.locks` gives it, where the browser has it. */
interface Locks {
  request<T>(name: string, work: () => Promise<T>): Promise<T>;
}

interface RunUploadsOptions {
  /** The environment of the build: `import.meta.env`. */
  readonly env: Readonly<Record<string, unknown>>;
  readonly storage: SettingsStorage | null;
  readonly fetch: Parameters<typeof createSendRun>[0]['fetch'];
  /** `navigator.locks`, which older browsers lack. */
  readonly locks: Locks | undefined;
  /** `GAME_VERSION`: the version every run of this build is played with. */
  readonly gameVersion: string;
  readonly makeBackend?: (config: BackendConfig) => Backend;
}

/**
 * The queue of finished runs of this build (#220), sending them to the submit-run function as the
 * player of this browser, or `null` in a build without a backend: development, previews and tests,
 * where the game plays as before and nothing is sent anywhere.
 *
 * The tabs of the game share the queue in `localStorage` and take turns to send it through a lock
 * of the same name, so that two tabs never send one run twice.
 */
export function createRunUploads({
  env,
  storage,
  fetch,
  locks,
  gameVersion,
  makeBackend = createBackend,
}: RunUploadsOptions): RunQueue | null {
  const config = backendConfig(env);
  if (config === null) {
    return null;
  }
  const { player } = makeBackend(config);
  return createRunQueue({
    storage,
    gameVersion,
    send: createSendRun({ config, player, fetch }),
    ...(locks === undefined ? {} : { lock: (work) => locks.request(PENDING_RUNS_KEY, work) }),
  });
}
