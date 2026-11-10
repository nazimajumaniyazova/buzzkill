/** The part of the page an error boundary guards: the whole shell, or a run of the game. */
export type ErrorArea = 'shell' | 'game';

/** Where an unexpected error was seen, and what React knows about it. */
export interface ErrorReport {
  /** The boundary that caught it, React's root for an error none caught, or the window. */
  readonly source: ErrorArea | 'react' | 'window';
  /** The components from the root down to the one that threw, when React knows them. */
  readonly componentStack?: string | undefined;
}

/**
 * The one way out for an unexpected error (#113): the console today, the error tracker of stage
 * 11 later, so that change touches this function alone. Expected failures, such as a file that did
 * not load, are results the player sees instead (CLAUDE.md).
 */
export function reportError(error: unknown, report: ErrorReport): void {
  const details = report.componentStack === undefined ? [] : [report.componentStack];
  console.error(`[buzzkill] Unexpected error (${report.source})`, error, ...details);
}

/**
 * Sends the errors that no boundary sees, from event listeners, timers and promises, through
 * `reportError`. Each event's own report is cancelled, so the console shows the error once.
 * Returns the function that stops listening.
 */
export function reportWindowErrors(target: Window = window): () => void {
  const onError = (event: ErrorEvent): void => {
    event.preventDefault();
    reportError(event.error ?? event.message, { source: 'window' });
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    event.preventDefault();
    reportError(event.reason, { source: 'window' });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
