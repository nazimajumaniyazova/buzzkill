import type { BackendConfig } from './config';
import type { Player } from './player';
import { outcomeOf, type SendOutcome } from './run-queue';

/** The request the sender makes, as `window.fetch` takes it. */
interface SendRequest {
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal;
}

/** `window.fetch`, or a fake in a test. */
type SendFetch = (url: string, init: SendRequest) => Promise<Response>;

interface SendRunOptions {
  readonly config: BackendConfig;
  /** Signs the player in, anonymously the first time (#217): only a run to send does it. */
  readonly player: Pick<Player, 'signIn'>;
  readonly fetch: SendFetch;
  /**
   * How long an answer may take. The server plays the whole replay again, which takes a few
   * seconds for a long campaign; a request with no answer after that is for later, so that it does
   * not hold the queue's lock forever.
   */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Sends one finished run to the submit-run function (#218) as the signed-in player. Every failure
 * of the network, of the player's sign-in or of the server is an outcome for later, never a throw:
 * the run waits in the queue (#220) and the game goes on (#222).
 */
export function createSendRun({
  config,
  player,
  fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: SendRunOptions): (body: string) => Promise<SendOutcome> {
  const endpoint = `${config.url}/functions/v1/submit-run`;

  return async (body) => {
    const signedIn = await player.signIn();
    if (!signedIn.ok) {
      return { kind: 'later' };
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      abort.abort(new DOMException('submit-run did not answer in time', 'TimeoutError'));
    }, timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${signedIn.token}`,
          apikey: config.key,
          'content-type': 'application/json',
        },
        body,
        signal: abort.signal,
      });
      let answer: unknown;
      try {
        answer = await response.json();
      } catch {
        // A gateway's page of HTML, or no body: `outcomeOf` decides from the status alone.
        answer = undefined;
      }
      return outcomeOf(response.status, answer, response.headers.get('retry-after'));
    } catch {
      return { kind: 'later' };
    } finally {
      clearTimeout(timer);
    }
  };
}
