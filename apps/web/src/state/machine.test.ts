// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { RunResult } from '@buzzkill/game';
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import {
  type AppEvent,
  type AppState,
  type GameAssets,
  initialState,
  isRunState,
  type Run,
  transition,
} from './machine';

// The machine carries the assets and the result without reading into them, so empty objects do.
const assets = { sprites: {}, audio: {} } as GameAssets;
const otherAssets = { sprites: {}, audio: {} } as GameAssets;

const run: Run = { heroId: 'male', mode: 'day', seed: 1 };
const nextRun: Run = { heroId: 'female', mode: 'night', seed: 2 };

function resultWith(status: RunResult['status']): RunResult {
  return {
    score: 42,
    level: 1,
    ticks: 600,
    livesLeft: status === 'lost' ? 0 : 3,
    status,
    hash: '0badf00d',
  };
}

/** One example of every state; the `satisfies` keeps the list complete. */
const states = {
  menu: { name: 'menu', panel: 'main' },
  heroSelect: { name: 'heroSelect' },
  loading: { name: 'loading', run },
  playing: { name: 'playing', assets, run },
  paused: { name: 'paused', assets, run },
  levelComplete: { name: 'levelComplete', assets, run, result: resultWith('won') },
  gameOver: { name: 'gameOver', assets, run, result: resultWith('lost') },
} satisfies Record<AppState['name'], AppState>;

/** The other panels of `menu`, for the rows that need them. */
const settingsMenu: AppState = { name: 'menu', panel: 'settings' };
const helpMenu: AppState = { name: 'menu', panel: 'help' };

/** One example of every event; the `satisfies` keeps the list complete. */
const events = {
  openSettings: { type: 'openSettings' },
  openHelp: { type: 'openHelp' },
  selectHero: { type: 'selectHero' },
  back: { type: 'back' },
  play: { type: 'play', run: nextRun },
  gameLoaded: { type: 'gameLoaded', assets: otherAssets },
  pause: { type: 'pause' },
  resume: { type: 'resume' },
  gamePaused: { type: 'gamePaused' },
  gameResumed: { type: 'gameResumed' },
  runEnded: { type: 'runEnded', result: resultWith('lost') },
  quit: { type: 'quit' },
} satisfies Record<AppEvent['type'], AppEvent>;

interface Row {
  readonly from: AppState;
  readonly event: AppEvent;
  readonly to: AppState['name'];
}

/** The transition table: every pair of state and event that changes the state. */
const TRANSITIONS: readonly Row[] = [
  { from: states.menu, event: events.openSettings, to: 'menu' },
  { from: states.menu, event: events.openHelp, to: 'menu' },
  { from: states.menu, event: events.selectHero, to: 'heroSelect' },
  { from: settingsMenu, event: events.back, to: 'menu' },
  { from: helpMenu, event: events.back, to: 'menu' },
  { from: states.heroSelect, event: events.back, to: 'menu' },
  { from: states.heroSelect, event: events.play, to: 'loading' },
  { from: states.loading, event: events.gameLoaded, to: 'playing' },
  { from: states.loading, event: events.back, to: 'heroSelect' },
  { from: states.playing, event: events.pause, to: 'paused' },
  { from: states.playing, event: events.gamePaused, to: 'paused' },
  {
    from: states.playing,
    event: { type: 'runEnded', result: resultWith('won') },
    to: 'levelComplete',
  },
  { from: states.playing, event: events.runEnded, to: 'gameOver' },
  { from: states.playing, event: events.quit, to: 'menu' },
  { from: states.paused, event: events.resume, to: 'playing' },
  { from: states.paused, event: events.gameResumed, to: 'playing' },
  { from: states.paused, event: events.quit, to: 'menu' },
  { from: states.levelComplete, event: events.play, to: 'playing' },
  { from: states.levelComplete, event: events.quit, to: 'menu' },
  { from: states.gameOver, event: events.play, to: 'playing' },
  { from: states.gameOver, event: events.quit, to: 'menu' },
];

const allowed = new Set(TRANSITIONS.map(({ from, event }) => `${from.name} ${event.type}`));

/** Every other pair of state and event: the ones that must change nothing. */
const forbidden = Object.values(states).flatMap((state) =>
  Object.values(events)
    .filter((event) => !allowed.has(`${state.name} ${event.type}`))
    .map((event) => [`${state.name} ignores ${event.type}`, state, event] as const),
);

describe('transition', () => {
  it('starts on the main menu, before the game has loaded', () => {
    expect(initialState).toEqual({ name: 'menu', panel: 'main' });
  });

  it.each(TRANSITIONS.map((row) => [`${row.from.name} + ${row.event.type} -> ${row.to}`, row]))(
    '%s',
    (_title, { from, event, to }) => {
      expect(transition(from, event).name).toBe(to);
    },
  );

  it.each(forbidden)('%s', (_title, state, event) => {
    expect(transition(state, event)).toBe(state);
  });

  it('waits for the game with the chosen run, then starts that run with the loaded assets', () => {
    const loading = transition(states.heroSelect, events.play);

    expect(loading).toEqual({ name: 'loading', run: nextRun });
    expect(transition(loading, events.gameLoaded)).toEqual({
      name: 'playing',
      assets: otherAssets,
      run: nextRun,
    });
  });

  it('returns from the wait to the hero select, and ignores a load that ends elsewhere', () => {
    expect(transition(states.loading, events.back)).toEqual({ name: 'heroSelect' });
    expect(transition(states.heroSelect, events.gameLoaded)).toBe(states.heroSelect);
    expect(transition(states.playing, events.gameLoaded)).toBe(states.playing);
  });

  it('opens the settings and the help from the main menu only, and back returns to it', () => {
    expect(transition(states.menu, events.openSettings)).toEqual(settingsMenu);
    expect(transition(states.menu, events.openHelp)).toEqual(helpMenu);
    expect(transition(settingsMenu, events.back)).toEqual(states.menu);
    expect(transition(helpMenu, events.back)).toEqual(states.menu);
    expect(transition(states.heroSelect, events.back)).toEqual(states.menu);

    expect(transition(states.menu, events.back)).toBe(states.menu);
    expect(transition(settingsMenu, events.openHelp)).toBe(settingsMenu);
    expect(transition(helpMenu, events.openSettings)).toBe(helpMenu);
    expect(transition(settingsMenu, events.selectHero)).toBe(settingsMenu);
  });

  it('starts the next run at once over a finished one, with the assets it has', () => {
    expect(transition(states.levelComplete, events.play)).toEqual({
      name: 'playing',
      assets,
      run: nextRun,
    });
    expect(transition(states.gameOver, events.play)).toEqual({
      name: 'playing',
      assets,
      run: nextRun,
    });
  });

  it('keeps the same run object through pause and resume', () => {
    const paused = transition(states.playing, events.gamePaused);

    expect(paused).toEqual({ name: 'paused', assets, run });
    expect(transition(paused, events.resume)).toEqual(states.playing);
    expect(transition(states.playing, events.pause)).toEqual(paused);
    expect(transition(paused, events.gameResumed)).toEqual(states.playing);
  });

  it('ends a won run as level complete and a lost run as game over, with the result', () => {
    expect(transition(states.playing, { type: 'runEnded', result: resultWith('won') })).toEqual({
      name: 'levelComplete',
      assets,
      run,
      result: resultWith('won'),
    });
    expect(transition(states.playing, events.runEnded)).toEqual({
      name: 'gameOver',
      assets,
      run,
      result: resultWith('lost'),
    });
  });

  it('ignores an end report whose result says the run still plays', () => {
    const event: AppEvent = { type: 'runEnded', result: resultWith('playing') };

    expect(transition(states.playing, event)).toBe(states.playing);
  });

  it('drops the run and its assets on quit and returns to the main menu', () => {
    const afterQuit = [states.playing, states.paused, states.levelComplete, states.gameOver].map(
      (state) => transition(state, events.quit),
    );

    expect(afterQuit).toEqual(Array<AppState>(4).fill({ name: 'menu', panel: 'main' }));
  });
});

describe('isRunState', () => {
  it('tells the four states of a run on screen from the other three', () => {
    const withRun = Object.values(states).filter(isRunState);

    expect(withRun.map((state) => state.name)).toEqual([
      'playing',
      'paused',
      'levelComplete',
      'gameOver',
    ]);
  });
});

describe('invariants of the flow', () => {
  const choice = fc.record({
    heroId: fc.constantFrom('male', 'female'),
    mode: fc.constantFrom('day', 'night'),
    seed: fc.nat(),
  });
  const step: fc.Arbitrary<AppEvent> = fc.oneof(
    fc.constant(events.openSettings),
    fc.constant(events.openHelp),
    fc.constant(events.selectHero),
    fc.constant(events.back),
    fc.record({ type: fc.constant('play' as const), run: choice }),
    fc.record({
      type: fc.constant('gameLoaded' as const),
      assets: fc.constantFrom(assets, otherAssets),
    }),
    fc.constant(events.pause),
    fc.constant(events.resume),
    fc.constant(events.gamePaused),
    fc.constant(events.gameResumed),
    fc.record({
      type: fc.constant('runEnded' as const),
      result: fc.constantFrom('playing', 'won', 'lost').map(resultWith),
    }),
    fc.constant(events.quit),
  );

  /** What a step broke, or `null`. */
  function violation(previous: AppState, event: AppEvent, state: AppState): string | null {
    if (state === previous) {
      return null;
    }
    const previousRun = 'run' in previous ? previous.run : null;
    const previousAssets = isRunState(previous) ? previous.assets : null;
    switch (state.name) {
      case 'menu':
        if (state.panel !== 'main') {
          return previous.name === 'menu' && previous.panel === 'main'
            ? null
            : `${state.panel} opened from ${previous.name}`;
        }
        return null;
      case 'heroSelect':
        return (previous.name === 'menu' && previous.panel === 'main') ||
          previous.name === 'loading'
          ? null
          : `hero select from ${previous.name}`;
      case 'loading':
        if (previous.name !== 'heroSelect' || event.type !== 'play') {
          return `loading from ${previous.name} by ${event.type}`;
        }
        return state.run === event.run ? null : 'the wait holds a different run';
      case 'playing':
        if (previous.name === 'paused') {
          return state.run === previousRun && state.assets === previousAssets
            ? null
            : 'resume changed the run';
        }
        if (previous.name === 'loading') {
          // The loaded assets join the run the player chose before the wait.
          return event.type === 'gameLoaded' &&
            state.run === previousRun &&
            state.assets === event.assets
            ? null
            : `the wait ended by ${event.type} into another run`;
        }
        if (event.type !== 'play') {
          return `playing entered by ${event.type}`;
        }
        // Play again: the new run keeps the assets of the one that ended.
        return state.run === event.run && state.assets === previousAssets
          ? null
          : 'play again changed the assets or started a different run';
      case 'paused':
        if (previous.name !== 'playing') {
          return `paused from ${previous.name}`;
        }
        return state.run === previousRun && state.assets === previousAssets
          ? null
          : 'pause changed the run';
      case 'levelComplete':
      case 'gameOver':
        if (previous.name !== 'playing' || event.type !== 'runEnded') {
          return `${state.name} from ${previous.name} by ${event.type}`;
        }
        return state.run === previousRun && state.assets === previousAssets
          ? null
          : 'the end changed the run';
    }
  }

  test.prop([fc.array(step, { maxLength: 60 })])(
    'assets exist only with a run on screen, a run keeps them, and each state has its ways in',
    (sequence) => {
      const violations: string[] = [];
      let state: AppState = initialState;
      for (const event of sequence) {
        const previous = state;
        state = transition(state, event);
        if ('assets' in state !== isRunState(state)) {
          violations.push(`assets present in ${state.name}`);
        }
        if ('run' in state !== (isRunState(state) || state.name === 'loading')) {
          violations.push(`run present in ${state.name}`);
        }
        const found = violation(previous, event, state);
        if (found !== null) {
          violations.push(found);
        }
      }

      expect(violations).toEqual([]);
    },
  );
});

describe('the state diagram in docs/architecture.md', () => {
  const doc = readFileSync(
    fileURLToPath(new URL('../../../../docs/architecture.md', import.meta.url)),
    'utf8',
  );
  const diagram = /```mermaid\s+stateDiagram-v2([\s\S]*?)```/.exec(doc)?.[1] ?? '';
  /** Every `from --> to: event` of the diagram; a label lists several events with commas. */
  const arrows = [...diagram.matchAll(/^\s*(\w+) --> (\w+): (.+)$/gm)].flatMap(
    ([, from = '', to = '', label = '']) =>
      label.split(',').map((event) => `${from} ${event.trim().replace(/ \(.*\)$/, '')} ${to}`),
  );

  it('names every state', () => {
    const missing = Object.keys(states).filter(
      (name) => !new RegExp(`\\b${name}\\b`).test(diagram),
    );

    expect(missing).toEqual([]);
  });

  it('draws exactly the transitions of the table', () => {
    const table = TRANSITIONS.map(({ from, event, to }) => `${from.name} ${event.type} ${to}`);

    expect([...new Set(arrows)].sort()).toEqual([...new Set(table)].sort());
  });
});
