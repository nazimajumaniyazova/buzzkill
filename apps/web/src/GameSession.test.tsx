import { AssetLoadError } from '@buzzkill/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { GameSession } from './GameSession';

const decoding = vi.hoisted(() => ({
  /** The error a URL fails with, or undefined for success. */
  fail: (_url: string): Error | undefined => undefined,
  pending: [] as (() => void)[],
}));

vi.mock('@buzzkill/engine/browser', () => ({
  createBrowserAssetDecoders: () => {
    const decode = (url: string) =>
      new Promise((resolve, reject) => {
        decoding.pending.push(() => {
          const error = decoding.fail(url);
          if (error === undefined) {
            resolve({ url });
          } else {
            reject(error);
          }
        });
      });
    return { image: decode, audio: decode };
  },
}));

vi.mock('./GameView', () => ({
  GameView: ({ choice }: { choice: { heroId: string } }) => <p>Game view for {choice.heroId}</p>,
}));

const choice = { heroId: 'female', mode: 'night', volume: 0.4 } as const;

/** Settles `count` pending decodes, or all of them. */
async function settle(count = Infinity): Promise<void> {
  await act(async () => {
    for (let i = 0; i < count && decoding.pending.length > 0; i += 1) {
      decoding.pending.shift()?.();
      await Promise.resolve();
    }
  });
}

describe('GameSession', () => {
  beforeEach(() => {
    decoding.fail = () => undefined;
    decoding.pending.length = 0;
  });

  it('shows the loading progress, then the game', async () => {
    const { container } = render(
      <GameSession choice={choice} audioContext={null} onExit={vi.fn()} />,
    );
    const progress = screen.getByRole('progressbar', { name: 'Loading' });
    expect(progress).toHaveAttribute('value', '0');
    expect(await axe(container)).toHaveNoViolations();

    await settle(2);
    expect(Number(progress.getAttribute('value'))).toBeGreaterThan(0);

    await settle();
    expect(await screen.findByText('Game view for female')).toBeInTheDocument();
  });

  it('lists what failed to load and loads again on request', async () => {
    decoding.fail = (url) =>
      url.includes('projectile') ? new AssetLoadError('http', `${url}: HTTP 404`) : undefined;
    render(<GameSession choice={choice} audioContext={null} onExit={vi.fn()} />);
    await settle();

    expect(screen.getByRole('alert')).toHaveTextContent('The game could not load');
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'projectile.png: the server returned an error',
    );

    decoding.fail = () => undefined;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
    await settle();
    expect(await screen.findByText('Game view for female')).toBeInTheDocument();
  });

  it('goes back to the menu after a failed load', async () => {
    decoding.fail = () => new Error('offline');
    const onExit = vi.fn();
    render(<GameSession choice={choice} audioContext={null} onExit={onExit} />);
    await settle();

    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('an unexpected error');
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));

    expect(onExit).toHaveBeenCalledOnce();
  });

  it('runs without sound when the sounds cannot load', async () => {
    decoding.fail = (url) =>
      url.endsWith('.wav') ? new AssetLoadError('unavailable', 'no Web Audio') : undefined;
    render(<GameSession choice={choice} audioContext={null} onExit={vi.fn()} />);
    await settle();

    expect(await screen.findByText('Game view for female')).toBeInTheDocument();
  });
});
