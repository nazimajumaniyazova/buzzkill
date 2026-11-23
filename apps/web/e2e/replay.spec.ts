import { expect, test } from '@playwright/test';

/**
 * The replay of a run (#219), in the built app: the run ends, its replay plays again on the canvas
 * to the same score, and Escape goes back to the dialog of the end. The hero never moves, so the
 * run is lost in about 25 seconds of game time.
 */
test.describe('the replay of a run', { tag: '@mouse' }, () => {
  test('plays the finished run again to the same score, at the speed chosen', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?seed=7');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Start' }).click();

    const over = page.getByRole('dialog', { name: 'Game over' });
    await expect(over).toBeVisible({ timeout: 120_000 });
    const description = await over.getByText(/^Score: /).textContent();

    await over.getByRole('button', { name: 'Watch the replay' }).click();

    const replay = page.getByRole('main', { name: 'Replay' });
    await expect(replay).toBeVisible();
    await expect(page.getByRole('main', { name: 'Game' })).toBeHidden();
    await replay.getByRole('button', { name: 'Pause' }).click();
    await expect(replay.getByRole('button', { name: 'Play' })).toBeVisible();
    await replay.getByRole('button', { name: 'Play' }).click();
    await replay.getByRole('radio', { name: '4×' }).check();

    await expect(replay.getByText('The replay is over.')).toBeVisible({ timeout: 60_000 });
    const hudScore = await replay
      .getByRole('region', { name: 'Game status' })
      .getByRole('definition')
      .first()
      .textContent();
    expect(description).toBe(`Score: ${hudScore ?? ''}`);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
