import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { reportError, reportWindowErrors } from './report-error';

describe('reportError', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the error to the console with where it was seen and its component stack', () => {
    const error = new Error('Boom');

    reportError(error, { source: 'game', componentStack: '\n    at GameView' });

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      '[buzzkill] Unexpected error (game)',
      error,
      '\n    at GameView',
    );
  });

  it('leaves the component stack out when React gave none', () => {
    reportError('not an Error', { source: 'window' });

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      '[buzzkill] Unexpected error (window)',
      'not an Error',
    );
  });
});

describe('reportWindowErrors', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** An event as the browser fires it for an error nobody caught. */
  const uncaught = (error: unknown): ErrorEvent =>
    new ErrorEvent('error', { error, message: 'Uncaught', cancelable: true });

  /** jsdom has no PromiseRejectionEvent: an event with the same fields. */
  const unhandled = (reason: unknown): Event =>
    Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason });

  it("reports the window's uncaught errors and rejections once, instead of the browser", () => {
    const stop = reportWindowErrors(window);
    const error = new Error('In a listener');
    const errorEvent = uncaught(error);
    const rejection = unhandled('Lost promise');

    window.dispatchEvent(errorEvent);
    window.dispatchEvent(rejection);
    stop();

    expect(consoleError.mock.calls).toEqual([
      ['[buzzkill] Unexpected error (window)', error],
      ['[buzzkill] Unexpected error (window)', 'Lost promise'],
    ]);
    expect(errorEvent.defaultPrevented).toBe(true);
    expect(rejection.defaultPrevented).toBe(true);
  });

  it('reports the message of an error event that carries no error', () => {
    const stop = reportWindowErrors(window);

    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.', cancelable: true }));
    stop();

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      '[buzzkill] Unexpected error (window)',
      'Script error.',
    );
  });

  it('stops listening when asked', () => {
    // The test's own listener cancels the event, as nobody else is there to.
    const cancel = (event: Event): void => {
      event.preventDefault();
    };
    window.addEventListener('error', cancel);
    reportWindowErrors(window)();

    window.dispatchEvent(uncaught(new Error('Late')));
    window.removeEventListener('error', cancel);

    expect(consoleError).not.toHaveBeenCalled();
  });
});
