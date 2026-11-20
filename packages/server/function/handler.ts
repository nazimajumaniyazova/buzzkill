import {
  createSubmitRun,
  createSupabaseStore,
  type Fetch,
  type HttpRequest,
  type HttpResponse,
  supabaseConfigFromEnv,
} from '../src';

export interface HandlerOptions {
  /** The version the bundle was built with (`__GAME_VERSION__`). */
  readonly gameVersion: string;
  /** The function's environment: `Deno.env.get`. */
  readonly env: (name: string) => string | undefined;
  readonly fetch: Fetch;
  readonly now: () => Date;
}

function toHttpRequest(request: Request): HttpRequest {
  return {
    method: request.method,
    header: (name) => request.headers.get(name),
    text: () => request.text(),
  };
}

function toResponse({ status, headers, body }: HttpResponse): Response {
  return new Response(body, { status, headers });
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The submit-run function on the platform's Request and Response, which Deno shares with the
 * browser and Node. It reads the project from the environment when it starts, so a function
 * deployed without its key fails at once instead of on the first run.
 */
export function createHandler({
  gameVersion,
  env,
  fetch,
  now,
}: HandlerOptions): (request: Request) => Promise<Response> {
  const submitRun = createSubmitRun({
    gameVersion,
    now,
    gzip,
    store: createSupabaseStore({ ...supabaseConfigFromEnv(env), fetch }),
    report: (message, error) => {
      console.error(message, error);
    },
  });
  return async (request) => toResponse(await submitRun(toHttpRequest(request)));
}
