import { Component, type ErrorInfo, type ReactNode } from 'react';

import { type ErrorArea, reportError } from './errors/report-error';

interface ErrorBoundaryProps {
  /** The part of the page this boundary guards, named in the report. */
  readonly area: ErrorArea;
  /** What replaces the children once one of them has thrown. */
  readonly fallback: ReactNode;
  /** Called after the report, for the owner to move on: the game boundary ends the run. */
  readonly onError?: () => void;
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

/**
 * Catches what its children throw while rendering, in an effect or in a lifecycle method, reports
 * it through `reportError` and shows `fallback` instead (#113). A class, because React offers
 * error boundaries only as classes. It stays failed: the way out unmounts it, through the machine
 * for the game, or replaces it with a new key at the root.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    reportError(error, {
      source: this.props.area,
      componentStack: info.componentStack ?? undefined,
    });
    this.props.onError?.();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
