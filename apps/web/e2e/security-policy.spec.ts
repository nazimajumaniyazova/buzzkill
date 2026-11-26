import { expect, type Page, test } from '@playwright/test';

/**
 * The content security policy of the built app (ADR-0019, amendment of 2026-11-25). A build
 * without a backend or analytics may connect only to its own origin, and a run needs nothing
 * else: every image, sound and chunk of the game comes from the app.
 */

/** Collects the policy's refusals from the first script of the page on, as "directive URL". */
async function violationsOf(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('reportViolation', (violation: string) => {
    violations.push(violation);
  });
  await page.addInitScript(
    "document.addEventListener('securitypolicyviolation', (event) => " +
      "window.reportViolation(event.effectiveDirective + ' ' + event.blockedURI));",
  );
  return violations;
}

test.describe('the content security policy', { tag: '@mouse' }, () => {
  test('lets a run load everything it needs from the app, and nothing from elsewhere', async ({
    page,
    baseURL,
  }) => {
    const violations = await violationsOf(page);
    // Should the policy be missing, the probe below still never leaves the machine.
    const origin = new URL(baseURL ?? '').origin;
    await page.context().route(
      (url) => url.origin !== origin,
      (route) => route.abort('internetdisconnected'),
    );
    await page.goto('/');

    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      "connect-src 'self'",
    );

    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('region', { name: 'Game status' })).toBeVisible();
    expect(violations).toEqual([]);

    const probe = await page.evaluate(() =>
      fetch('https://analytics.invalid/api/send').then(
        () => 'sent',
        () => 'refused',
      ),
    );
    expect(probe).toBe('refused');
    await expect.poll(() => violations).toEqual(['connect-src https://analytics.invalid/api/send']);
  });
});
