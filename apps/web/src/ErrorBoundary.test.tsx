import { render, screen } from '@testing-library/react';
import { type JSX, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';
import { reportError } from './errors/report-error';

vi.mock('./errors/report-error', () => ({ reportError: vi.fn() }));

/** The root of main.tsx leaves caught errors to the boundaries; so does every render here. */
const options = { onCaughtError: () => undefined };

function Thrower({ when }: { readonly when: 'render' | 'effect' | 'never' }): JSX.Element {
  useEffect(() => {
    if (when === 'effect') {
      throw new Error('Effect failed');
    }
  }, [when]);
  if (when === 'render') {
    throw new Error('Render failed');
  }
  return <p>Child</p>;
}

function guarded(when: 'render' | 'effect' | 'never', onError = vi.fn()) {
  return (
    <ErrorBoundary area="game" fallback={<p>Fallback</p>} onError={onError}>
      <Thrower when={when} />
    </ErrorBoundary>
  );
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.mocked(reportError).mockClear();
  });

  it('shows its children while none throws, and reports nothing', () => {
    const onError = vi.fn();
    render(guarded('never', onError), options);

    expect(screen.getByText('Child')).toBeInTheDocument();
    expect(reportError).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('shows the fallback when a child throws while rendering, and reports it once', () => {
    const onError = vi.fn();
    render(guarded('render', onError), options);

    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Child')).not.toBeInTheDocument();
    expect(reportError).toHaveBeenCalledExactlyOnceWith(new Error('Render failed'), {
      source: 'game',
      componentStack: expect.stringContaining('Thrower') as unknown,
    });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('catches an error thrown in an effect too', () => {
    render(guarded('effect'), options);

    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(new Error('Effect failed'), expect.anything());
  });

  it('stays failed until its owner replaces it', () => {
    const view = render(guarded('render'), options);

    view.rerender(guarded('never'));
    expect(screen.getByText('Fallback')).toBeInTheDocument();

    view.rerender(
      <ErrorBoundary key="new" area="game" fallback={<p>Fallback</p>}>
        <Thrower when="never" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Child')).toBeInTheDocument();
  });
});
