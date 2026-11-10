import { DEFAULT_KEY_BINDINGS, type Game, type GameHud as Hud } from '@buzzkill/game';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KEY_SYMBOLS } from '../controls';
import { ErrorScreen } from '../ErrorScreen';
import { GameHud } from '../GameHud';
import { GameView } from '../GameView';
import { HelpScreen } from '../HelpScreen';
import { HeroSelectScreen } from '../HeroSelectScreen';
import { LoadingScreen } from '../LoadingScreen';
import { MenuScreen } from '../MenuScreen';
import { PauseDialog } from '../PauseDialog';
import { RunOverDialog } from '../RunOverDialog';
import { SettingsScreen } from '../SettingsScreen';
import type { GameLoad } from '../state/game-loader';
import type { GameAssets } from '../state/machine';
import { DEFAULT_SETTINGS } from '../state/settings/schema';
import { en, type Messages } from './en';
import { createI18n, I18nProvider, LANGUAGE_NAMES } from './i18n';

/**
 * A pseudo-language: English with every string of the dictionary, and every result of its
 * messages, marked as ⟦…⟧. A text on screen that keeps a letter outside the marks did not come
 * from the dictionary. Marks nest when a message takes another message ("⟦⟦Shoot⟧ now uses…⟧").
 */
function mark(value: unknown): unknown {
  if (typeof value === 'string') {
    return `⟦${value}⟧`;
  }
  if (typeof value === 'function') {
    const message = value as (...args: readonly unknown[]) => string;
    return (...args: readonly unknown[]) => `⟦${message(...args)}⟧`;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, mark(inner)]));
  }
  return value;
}

const marked = createI18n('en', (format) => mark(en(format)) as Messages);

/**
 * Text that is not the dictionary's on purpose: each language's own name, the symbols printed on
 * key caps, and a single character, which is a key's own label ("W", "1").
 */
const OWN_TEXT = new Set<string>([
  ...Object.values(LANGUAGE_NAMES),
  ...Object.values(KEY_SYMBOLS).filter((symbol) => symbol !== undefined),
]);

/** The attributes that assistive technology reads out. */
const READ_ATTRIBUTES = ['aria-label', 'aria-valuetext', 'alt', 'placeholder', 'title'];

/** What is left of a text once every marked part is taken out, innermost first. */
function unmarked(text: string): string {
  let rest = text;
  for (;;) {
    const next = rest.replace(/⟦[^⟦⟧]*⟧/gu, '');
    if (next === rest) {
      return rest.trim();
    }
    rest = next;
  }
}

/** Every text and read-out attribute on the page with a letter outside the dictionary. */
function foreignText(): string[] {
  const found: string[] = [];
  const check = (text: string): void => {
    const rest = unmarked(text);
    if (/\p{L}/u.test(rest) && !/^.$/u.test(rest) && !OWN_TEXT.has(rest)) {
      found.push(rest);
    }
  };
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node instanceof Element) {
      for (const name of READ_ATTRIBUTES) {
        check(node.getAttribute(name) ?? '');
      }
    } else {
      check(node.nodeValue ?? '');
    }
  }
  return found;
}

function renderMarked(ui: ReactNode) {
  return render(<I18nProvider i18n={marked}>{ui}</I18nProvider>);
}

/** A game whose HUD never changes: enough for the HUD to render. */
function createStillGame(): Game {
  const hud: Hud = { score: 1234, lives: 3, ammo: 20, status: 'playing', paused: false };
  return {
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    subscribe: () => () => undefined,
    getHud: () => hud,
    replay: vi.fn(),
    result: vi.fn(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('every text on screen comes from the dictionary', () => {
  it('catches a text that does not', () => {
    function HardCoded(): JSX.Element {
      return <p aria-label="Status">Hard-coded</p>;
    }
    renderMarked(<HardCoded />);

    expect(foreignText()).toEqual(['Status', 'Hard-coded']);
  });

  it('in the loading screen, loading and after either failure', () => {
    const loading = (load: GameLoad) => (
      <I18nProvider i18n={marked}>
        <LoadingScreen load={load} onRetry={vi.fn()} onReload={vi.fn()} onBack={vi.fn()} />
      </I18nProvider>
    );
    const view = render(loading({ status: 'loading', fraction: 0.5 }));
    expect(foreignText()).toEqual([]);

    view.rerender(
      loading({
        status: 'assetsFailed',
        failures: [
          { id: 'shot', kind: 'audio', url: '/a/shot.wav', reason: 'decode', message: 'Bad' },
          { id: 'bat', kind: 'image', url: '/a/bat.png', reason: 'network', message: 'Lost' },
        ],
      }),
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(foreignText()).toEqual([]);

    view.rerender(loading({ status: 'codeFailed' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(foreignText()).toEqual([]);
  });

  it('in the menu', () => {
    renderMarked(
      <MenuScreen onPlay={vi.fn()} onPreload={vi.fn()} onSettings={vi.fn()} onHelp={vi.fn()} />,
    );

    expect(foreignText()).toEqual([]);
  });

  it('in the hero select', () => {
    renderMarked(<HeroSelectScreen onStart={vi.fn()} onBack={vi.fn()} />);

    expect(foreignText()).toEqual([]);
  });

  it('in the help', () => {
    renderMarked(<HelpScreen keyBindings={DEFAULT_KEY_BINDINGS} onBack={vi.fn()} />);

    expect(foreignText()).toEqual([]);
  });

  it('in every tab of the settings', () => {
    renderMarked(
      <SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onBack={vi.fn()} />,
    );

    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.click(tab);
      expect(foreignText()).toEqual([]);
    }
  });

  it('in every message of the key editor', () => {
    renderMarked(
      <SettingsScreen settings={DEFAULT_SETTINGS} onChange={vi.fn()} onBack={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '⟦Controls⟧' }));
    const [first, second] = screen.getAllByRole('button', { name: /^⟦⟦Move up⟧/ });
    const press = (code: string): void => {
      fireEvent.keyDown(window, { code });
    };

    fireEvent.click(first as HTMLElement);
    expect(foreignText()).toEqual([]);
    // J belongs to Shoot, so the message names the action that lost it too.
    press('KeyJ');
    expect(screen.getByRole('status')).toHaveTextContent(
      /^⟦⟦Move up⟧ now uses J\.⟧ ⟦J was taken from ⟦Shoot⟧, which now uses ⟦Arrow up⟧\.⟧$/,
    );
    expect(foreignText()).toEqual([]);
    fireEvent.click(second as HTMLElement);
    press('Escape');
    expect(foreignText()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: '⟦Reset keys⟧' }));
    expect(foreignText()).toEqual([]);
  });

  it('in the pause dialog', () => {
    renderMarked(<PauseDialog onResume={vi.fn()} onQuit={vi.fn()} />);

    expect(foreignText()).toEqual([]);
  });

  it('in the dialog at the end of a run', () => {
    renderMarked(
      <RunOverDialog
        title={marked.t.runOver.titles.gameOver}
        result={{ score: 1234, level: 1, ticks: 10, livesLeft: 0, status: 'lost', hash: '0' }}
        onPlayAgain={vi.fn()}
        onQuit={vi.fn()}
      />,
    );

    expect(foreignText()).toEqual([]);
  });

  it('in the HUD', () => {
    renderMarked(<GameHud game={createStillGame()} />);

    expect(foreignText()).toEqual([]);
  });

  it('in the error screens of the shell and of a run', () => {
    const view = renderMarked(<ErrorScreen area="shell" onRestart={vi.fn()} />);
    expect(foreignText()).toEqual([]);

    view.rerender(
      <I18nProvider i18n={marked}>
        <ErrorScreen area="game" onRestart={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(foreignText()).toEqual([]);
  });

  it('in the game view of a browser without canvas', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    renderMarked(
      <GameView
        run={{ heroId: 'male', mode: 'day', seed: 1 }}
        assets={{} as GameAssets}
        paused={false}
        keyBindings={DEFAULT_KEY_BINDINGS}
        onEvent={vi.fn()}
      />,
    );
    act(() => undefined);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(foreignText()).toEqual([]);
  });
});
