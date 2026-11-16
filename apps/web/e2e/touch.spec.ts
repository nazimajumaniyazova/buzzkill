import { expect, type Locator, type Page, test } from '@playwright/test';

/**
 * The game on a touch screen (#153), in the built app. Fingers are sent through the Chrome
 * DevTools Protocol: Playwright's own touch API taps, but cannot hold, drag or pinch.
 */

/** A Pixel 7 turned sideways. */
const LANDSCAPE = { width: 839, height: 412 };
/** The smallest control a finger hits reliably, from the WCAG target size guidance. */
const MIN_TARGET = 44;
const MAX_TAPS = 5;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

/** Fingers on the screen: each point of a call is one finger, in the same order every call. */
async function fingers(page: Page) {
  const client = await page.context().newCDPSession(page);
  const send = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: readonly Point[],
  ): Promise<void> => {
    await client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, id) => ({ ...point, id })),
    });
  };
  return {
    down: (...points: readonly Point[]) => send('touchStart', points),
    move: (...points: readonly Point[]) => send('touchMove', points),
    up: () => send('touchEnd', []),
  };
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('the element is not visible');
  }
  return box;
}

const centerOf = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** From the menu to a run, as a player gets there; collects the errors of the page meanwhile. */
async function startRun(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('region', { name: 'Game status' })).toBeVisible();
  return errors;
}

const hud = (page: Page) => page.getByRole('region', { name: 'Game status' });

/**
 * Records every value the ammo of the HUD shows from now on; `fell` tells whether it ever went
 * down. The game ticks in the page's animation frames, which a headless browser runs slowly, so
 * reading the HUD now and then would miss a round that comes back.
 */
async function watchAmmo(page: Page) {
  const seen = await hud(page)
    .getByRole('definition')
    .nth(2)
    .evaluateHandle((node) => {
      const values = [Number(node.textContent)];
      new MutationObserver(() => {
        values.push(Number(node.textContent));
      }).observe(node, { childList: true, characterData: true, subtree: true });
      return values;
    });
  return {
    fell: () =>
      seen.evaluate((values) => values.some((value, index) => value < (values[index - 1] ?? 0))),
  };
}

/** Waits for two animation frames: the game has sampled the input in between. */
const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
const knobShift = (page: Page) =>
  page.getByTestId('touch-stick-knob').evaluate((knob) => knob.style.transform);
/** How far the page has scrolled and how far it is zoomed. */
const viewport = (page: Page) =>
  page.evaluate(() => ({ scrollY: window.scrollY, scale: window.visualViewport?.scale ?? 1 }));

test.describe('on a touch screen', { tag: '@touch' }, () => {
  test('plays by touch: the fire button shoots and the stick steers', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    const errors = await startRun(page);
    const touch = await fingers(page);

    // Rounds come back on their own, five a second, so the ammo is watched rather than read: only a
    // shot makes it fall. A shot and a refill in the same frame cancel out, hence a few taps.
    const shots = await watchAmmo(page);
    const fire = centerOf(await boxOf(page.getByTestId('touch-fire')));
    for (let tap = 0; tap < MAX_TAPS && !(await shots.fell()); tap += 1) {
      await touch.down(fire);
      await nextFrames(page);
      await touch.up();
      await nextFrames(page);
    }
    expect(await shots.fell()).toBe(true);

    const stick = await boxOf(page.getByTestId('touch-stick'));
    const { x, y } = centerOf(stick);
    await touch.down({ x, y: y - stick.height / 4 });
    await expect.poll(() => knobShift(page)).toMatch(/^translateY\(-\d/);
    // The finger slides off the stick and keeps steering: its pointer is captured.
    await touch.move({ x, y: stick.y + stick.height + 40 });
    await expect.poll(() => knobShift(page)).toBe('translateY(50%)');
    await touch.up();
    await expect.poll(() => knobShift(page)).toBe('translateY(0%)');

    expect(errors).toEqual([]);
  });

  test('keeps the page still: no scroll, no pull-to-refresh, no zoom', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await startRun(page);
    const touch = await fingers(page);
    const middle = centerOf(await boxOf(page.locator('canvas')));

    expect(
      await page.evaluate(() => ({
        touchAction: getComputedStyle(document.querySelector('main') ?? document.body).touchAction,
        overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
      })),
    ).toEqual({ touchAction: 'none', overscroll: 'none' });

    // A swipe down from the top, which pulls to refresh on a page that allows it.
    await touch.down({ x: middle.x, y: 20 });
    for (let step = 1; step <= 10; step += 1) {
      await touch.move({ x: middle.x, y: 20 + step * 30 });
    }
    await touch.up();
    // A pinch outward, which zooms in.
    await touch.down({ x: middle.x - 20, y: middle.y }, { x: middle.x + 20, y: middle.y });
    for (let step = 1; step <= 10; step += 1) {
      await touch.move(
        { x: middle.x - 20 - step * 15, y: middle.y },
        { x: middle.x + 20 + step * 15, y: middle.y },
      );
    }
    await touch.up();
    // A double tap, which zooms in too.
    for (let tap = 0; tap < 2; tap += 1) {
      await touch.down(middle);
      await touch.up();
    }

    await page.waitForTimeout(300);
    expect(await viewport(page)).toEqual({ scrollY: 0, scale: 1 });
    await expect(page.getByRole('region', { name: 'Game status' })).toBeVisible();
  });

  for (const [orientation, size] of [
    ['upright', { width: 412, height: 839 }],
    ['sideways', LANDSCAPE],
  ] as const) {
    test(`fits the controls ${orientation}: big enough and never over the HUD`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await startRun(page);
      const status = await boxOf(hud(page));

      for (const control of [
        page.getByTestId('touch-stick'),
        page.getByTestId('touch-fire'),
        page.getByRole('button', { name: 'Pause' }),
      ]) {
        const box = await boxOf(control);
        expect(box.width).toBeGreaterThanOrEqual(MIN_TARGET);
        expect(box.height).toBeGreaterThanOrEqual(MIN_TARGET);
        expect(overlap(box, status)).toBe(false);
        expect(box.x >= 0 && box.x + box.width <= size.width).toBe(true);
        expect(box.y >= 0 && box.y + box.height <= size.height).toBe(true);
      }
    });
  }

  test('suggests turning the phone sideways while it is upright, until it turns', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 839 });
    await startRun(page);
    const hint = page.getByText('Turn your phone sideways for a bigger picture.');
    await expect(hint).toBeVisible();

    await page.setViewportSize(LANDSCAPE);

    await expect(hint).toHaveCount(0);
  });

  test('pauses by the pause button, and the menus scroll as before', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await startRun(page);

    await page.getByRole('button', { name: 'Pause' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Quit to menu' }).tap();

    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY),
    ).toBe('auto');
  });
});

test.describe('with a mouse', { tag: '@mouse' }, () => {
  test('shows no touch controls and no hint', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    const errors = await startRun(page);

    await expect(page.getByTestId('touch-stick')).toBeHidden();
    await expect(page.getByTestId('touch-fire')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeHidden();
    await expect(page.getByText(/sideways/)).toBeHidden();
    expect(errors).toEqual([]);
  });
});
