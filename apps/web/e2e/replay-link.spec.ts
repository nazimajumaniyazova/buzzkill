import { expect, test } from '@playwright/test';

/**
 * The link of a stored run's replay (#219), in the built app: the server gives the page at
 * `/replay/:runId`, and the page opens the replay. The end-to-end build has no backend, so the
 * replay cannot be loaded, which the page says, and Back leads to the main menu.
 */
test.describe('the link of a replay', { tag: '@mouse' }, () => {
  test('opens at /replay/:runId, says why it cannot play here, and goes back to the menu', async ({
    page,
  }) => {
    const runId = '11111111-1111-4111-8111-111111111111';
    await page.goto(`/replay/${runId}`);

    await expect(page.getByRole('heading', { level: 1, name: 'Replay' })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText(
      'The replay cannot be loaded right now. Check the connection and try again.',
    );

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Buzzkill' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
