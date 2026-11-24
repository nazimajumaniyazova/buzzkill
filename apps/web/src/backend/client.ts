import type * as Supabase from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { BackendConfig } from './config';
import type { Database } from './database.gen';
import { createPlayer, type Player } from './player';

/** The module of supabase-js, which downloads as a chunk of its own. */
export type SupabaseModule = typeof Supabase;

type Client = SupabaseClient<Database>;

export interface Backend {
  /** The client, downloaded and made on the first call; a failed download is tried again. */
  client(): Promise<Client>;
  /** The player of this browser, through the client's auth. */
  readonly player: Player;
}

/**
 * The backend of a build with one (ADR-0007). Nothing downloads before something asks for it:
 * the menu and a run never wait for the backend (#222), and supabase-js stays out of the main
 * chunk; dependency-cruiser rejects a static import of it.
 *
 * The session lives in `localStorage` under its own key and refreshes itself. A session in the
 * URL is not read on its own: linking GitHub (#217) will exchange its code explicitly.
 */
export function createBackend(
  { url, key }: BackendConfig,
  load: () => Promise<SupabaseModule> = () => import('@supabase/supabase-js'),
): Backend {
  let making: Promise<Client> | null = null;

  const client = (): Promise<Client> => {
    making ??= load().then(
      ({ createClient }) =>
        createClient<Database>(url, key, {
          auth: {
            storageKey: 'buzzkill.auth',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        }),
      (error: unknown) => {
        making = null;
        throw error;
      },
    );
    return making;
  };

  return {
    client,
    player: createPlayer(async () => (await client()).auth),
  };
}
