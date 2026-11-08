import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTokensCss } from '../src/tokens/css';

/**
 * Writes `src/tokens/tokens.css` from the token source (#74). Run with
 * `pnpm --filter @buzzkill/ui tokens` after changing a token; `css.test.ts` fails while the
 * committed stylesheet is stale.
 */
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/tokens/tokens.css');
writeFileSync(target, renderTokensCss());
