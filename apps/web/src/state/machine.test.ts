// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { AssetFailure } from '@buzzkill/engine';
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

const failures: readonly AssetFailure[] = [
  { id: 'projectile', kind: 'image', url: '/projectile.png', reason: 'http', message: 'HTTP 404' },
];

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
  boot: { name: 'boot', attempt: 0, failures: null },
  menu: { name: 'menu', panel: 'main', assets },
  heroSelect: { name: 'heroSelect', assets },
  playing: { name: 'playing', assets, run },
  paused: { name: 'paused', assets, run },
  levelComplete: { name: 'levelComplete', assets, run, result: resultWith('won') },
  gameOver: { name: 'gameOver', assets, run, result: resultWith('lost') },
} satisfies Record<AppState['name'], AppState>;

/** The other flavours of `boot` and `menu`, for the rows that need them. */
const failedBoot: AppState = { name: 'boot', attempt: 0, failures };
const settingsMenu: AppState = { name: 'menu', panel: 'settings', assets };
const helpMenu: AppState = { name: 'menu', panel: 'help', assets };

/** One example of every event; the `satisfies` keeps the list complete. */
const events = {
  booted: { type: 'booted', assets },
  bootFailed: { type: 'bootFailed', failures },
  retry: { type: 'retry' },
  openSettings: { type: 'openSettings' },
  openHelp: { type: 'openHelp' },
  selectHero: { type: 'selectHero' },
  back: { type: 'back' },
  play: { type: 'play', run: nextRun },
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
  { from: states.boot, event: events.booted, to: 'menu' },
  { from: states.boot, event: events.bootFailed, to: 'boot' },
  { from: failedBoot, event: events.retry, to: 'boot' },
  { from: states.menu, event: events.openSettings, to: 'menu' },
  { from: states.menu, event: events.openHelp, to: 'menu' },
  { from: states.menu, event: events.selectHero, to: 'heroSelect' },
  { from: settingsMenu, event: events.back, to: 'menu' },
  { from: helpMenu, event: events.back, to: 'menu' },
  { from: states.heroSelect, event: events.back, to: 'menu' },
  { from: states.heroSelect, event: events.play, to: 'playing' },
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
  it('starts in boot, loading', () => {
    expect(initialState).toEqual({ name: 'boot', attempt: 0, failures: null });
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

  it('carries the loaded assets from boot into the main menu and keeps them from then on', () => {
    const menu = transition(states.boot, events.booted);

    expect(menu).toEqual({ name: 'menu', panel: 'main', assets });
    expect(transition(menu, events.selectHero)).toEqual({ name: 'heroSelect', assets });
    expect(transition(states.menu, { type: 'booted', assets: otherAssets })).toBe(states.menu);
  });

  it('records a failed boot and starts another attempt on retry', () => {
    const failed = transition(states.boot, events.bootFailed);

    expect(failed).toEqual({ name: 'boot', attempt: 0, failures });
    expect(transition(failed, events.retry)).toEqual({ name: 'boot', attempt: 1, failures: null });
  });

  it('ignores retry while the boot is still loading', () => {
    expect(transition(states.boot, events.retry)).toBe(states.boot);
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

  it('starts the run of the play event, also over a finished one', () => {
    expect(transition(states.heroSelect, events.play)).toEqual({
      name: 'playing',
      assets,
      run: nextRun,
    });
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

  it('drops the run on quit and returns to the main menu with the assets', () => {
    const afterQuit = [states.playing, states.paused, states.levelComplete, states.gameOver].map(
      (state) => transition(state, events.quit),
    );

    expect(afterQuit).toEqual(Array<AppState>(4).fill({ name: 'menu', panel: 'main', assets }));
  });
});

describe('isRunState', () => {
  it('tells the four states with a run from the three without', () => {
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
    fc.constant(events.booted),
    fc.constant(events.bootFailed),
    fc.constant(events.retry),
    fc.constant(events.openSettings),
    fc.constant(events.openHelp),
    fc.constant(events.selectHero),
    fc.constant(events.back),
    fc.record({ type: fc.constant('play' as const), run: choice }),
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
    const previousRun = isRunState(previous) ? previous.run : null;
    switch (state.name) {
      case 'boot':
        return previous.name === 'boot' ? null : `back to boot from ${previous.name}`;
      case 'menu':
        if (state.panel !== 'main') {
          return previous.name === 'menu' && previous.panel === 'main'
            ? null
            : `${state.panel} opened from ${previous.name}`;
        }
        return null;
      case 'heroSelect':
        return previous.name === 'menu' && previous.panel === 'main'
          ? null
          : `hero select from ${previous.name}`;
      case 'playing':
        if (previous.name === 'paused') {
          return state.run === previousRun ? null : 'resume changed the run';
        }
        if (event.type !== 'play') {
          return `playing entered by ${event.type}`;
        }
        return state.run === event.run ? null : 'play started a different run';
      case 'paused':
        if (previous.name !== 'playing') {
          return `paused from ${previous.name}`;
        }
        return state.run === previousRun ? null : 'pause changed the run';
      case 'levelComplete':
      case 'gameOver':
        if (previous.name !== 'playing' || event.type !== 'runEnded') {
          return `${state.name} from ${previous.name} by ${event.type}`;
        }
        return state.run === previousRun ? null : 'the end changed the run';
    }
  }

  test.prop([fc.array(step, { maxLength: 60 })])(
    'a run exists only in the run states, the assets never change, and each state has one way in',
    (sequence) => {
      const violations: string[] = [];
      let state: AppState = initialState;
      let bootAssets: GameAssets | null = null;
      for (const event of sequence) {
        const previous = state;
        state = transition(state, event);
        if ('run' in state !== isRunState(state)) {
          violations.push(`run present in ${state.name}`);
        }
        if (state.name !== 'boot') {
          bootAssets ??= state.assets;
          if (state.assets !== bootAssets) {
            violations.push(`assets changed in ${state.name}`);
          }
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
