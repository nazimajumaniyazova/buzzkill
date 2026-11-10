import type { AssetFailure } from '@buzzkill/engine';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { LoadingScreen } from './LoadingScreen';
import type { GameLoad } from './state/game-loader';
import type { GameAssets } from './state/machine';

const failures: readonly AssetFailure[] = [
  { id: 'projectile', kind: 'image', url: '/a/projectile.png', reason: 'http', message: '404' },
  { id: 'shot', kind: 'audio', url: '/a/shot.wav', reason: 'decode', message: 'Bad data' },
];

function setup(load: GameLoad) {
  const handlers = { onRetry: vi.fn(), onReload: vi.fn(), onBack: vi.fn() };
  const view = render(<LoadingScreen load={load} {...handlers} />);
  return { ...handlers, ...view };
}

const progress = (): HTMLElement => screen.getByRole('progressbar', { name: 'Loading' });

describe('LoadingScreen', () => {
  it('shows the progress of the files with a way back, and passes the accessibility check', async () => {
    const { container, onBack } = setup({ status: 'loading', fraction: 0.25 });

    expect(progress()).toHaveAttribute('value', '0.25');
    expect(progress()).toHaveTextContent('25%');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows an empty bar before the loading starts and a full one once it is done', () => {
    const { rerender } = setup({ status: 'idle' });
    expect(progress()).toHaveAttribute('value', '0');

    rerender(
      <LoadingScreen
        load={{ status: 'ready', assets: {} as GameAssets }}
        onRetry={vi.fn()}
        onReload={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(progress()).toHaveAttribute('value', '1');
  });

  it('lists the files that failed and why, and loads them again on Try again', async () => {
    const { container, onRetry, onReload, onBack } = setup({ status: 'assetsFailed', failures });

    expect(screen.getByRole('alert')).toHaveTextContent('The game could not load');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'projectile.png: the server returned an error',
      'shot.wav: the file is damaged',
    ]);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
    expect(onReload).not.toHaveBeenCalled();
  });

  it('offers a reload of the page when the code itself did not download', async () => {
    const { container, onRetry, onReload } = setup({ status: 'codeFailed' });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The game could not load');
    expect(alert).toHaveTextContent(
      'Its code did not download. Reloading the page gets the latest version.',
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Reload the page' }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});
