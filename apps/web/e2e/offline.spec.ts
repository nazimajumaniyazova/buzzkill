import { expect, type Page, test } from '@playwright/test';

/**
 * The game without its backend (#222), in the built app. The app serves itself from one origin,
 * so every request to another one goes to the backend: Supabase, or the analytics. The backend
 * adds to the game and must never be needed to play it.
 */

type Backend = 'fails' | 'never answers';

/**
 * Blocks every request that leaves `app`, the origin of the app, from now on: it fails as without
 * a network, or waits forever as on a network that has gone quiet. A request left unanswered is
 * one the app must not wait for.
 */
async function blockBackend(page: Page, app: string | undefined, backend: Backend): Promise<void> {
  const origin = new URL(app ?? '').origin;
  await page.context().route(
    (url) => url.origin !== origin,
    async (route) => {
      if (backend === 'fails') {
        await route.abort('internetdisconnected');
      }
    },
  );
}

/** Collects the errors of the page from now on: none may escape, offline or not. */
function errorsOf(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('the game without its backend', { tag: '@mouse' }, () => {
  test('plays the daily challenge, and keeps its achievements and settings, when every request to the backend fails', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const errors = errorsOf(page);
    await blockBackend(page, baseURL, 'fails');
    await page.goto('/');

    await page.getByRole('button', { name: 'Daily challenge' }).click();
    await expect(page.getByRole('heading', { name: 'Daily challenge' })).toBeVisible();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('region', { name: 'Game status' })).toBeVisible();

    // The hero never moves, so the run is lost in well under two minutes.
    const over = page.getByRole('dialog', { name: 'Game over' });
    await expect(over).toBeVisible({ timeout: 120_000 });
    await expect(over.getByText(/^Score: /)).toBeVisible();
    // No error screen; the empty alert region of the notifications is always in the page.
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);

    await page.goto('/');
    await expect(page.getByText(/^Today's best: /)).toBeVisible();
    await page.getByRole('button', { name: 'Achievements' }).click();
    await expect(page.getByRole('heading', { name: 'Achievements' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('opens the menu and starts a run while the backend never answers', async ({
    page,
    baseURL,
  }) => {
    const errors = errorsOf(page);
    await blockBackend(page, baseURL, 'never answers');
    await page.goto('/');

    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('region', { name: 'Game status' })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
