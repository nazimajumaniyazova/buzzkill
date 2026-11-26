// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Replay, RunResult } from '@buzzkill/game';
import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';

import {
  type AppEvent,
  type AppState,
  type GameAssets,
  initialState,
  initialStateFor,
  isRunState,
  type Run,
  transition,
} from './machine';

// The machine carries the assets and the result without reading into them, so empty objects do.
const assets = { sprites: {}, audio: {} } as GameAssets;
const otherAssets = { sprites: {}, audio: {} } as GameAssets;
/** A run of the boards (#219). */
const RUN_ID = '11111111-1111-4111-8111-111111111111';

const run: Run = {
  heroId: 'male',
  mode: 'day',
  seed: 1,
  speed: 1,
  difficulty: 'normal',
  daily: null,
};
const nextRun: Run = {
  heroId: 'female',
  mode: 'night',
  seed: 2,
  speed: 1,
  difficulty: 'normal',
  daily: null,
};
/** The daily run of 2026-11-17 (#165). */
const dailyRun: Run = { ...run, seed: 1917294966, daily: '2026-11-17' };

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

/** What the game recorded of the run (#219); the machine only carries it. */
const replay: Replay = {
  formatVersion: 3,
  gameVersion: 'test',
  seed: 1,
  heroId: 'male',
  mode: 'day',
  difficulty: 'normal',
  daily: null,
  inputs: [12, 4],
};

const gameOver = {
  name: 'gameOver',
  assets,
  run,
  time: 'day',
  result: resultWith('lost'),
  replay,
} as const;
// The sun set after the third level, so the run that began by day ends at night.
const victory = {
  name: 'victory',
  assets,
  run,
  time: 'night',
  result: resultWith('won'),
  replay,
} as const;

/** One example of every state; the `satisfies` keeps the list complete. */
const states = {
  menu: { name: 'menu', panel: 'main' },
  heroSelect: { name: 'heroSelect', daily: null },
  loading: { name: 'loading', run },
  playing: { name: 'playing', assets, run, time: 'day' },
  paused: { name: 'paused', assets, run, time: 'day', reason: 'player' },
  levelCleared: {
    name: 'levelCleared',
    assets,
    run,
    time: 'day',
    level: 3,
    score: 120,
    nextTime: 'night',
  },
  victory,
  gameOver,
  watching: { name: 'watching', assets, run, time: 'day', finished: gameOver },
  storedReplay: {
    name: 'storedReplay',
    runId: RUN_ID,
    from: 'boards',
    load: { status: 'fetching' },
  },
  failed: { name: 'failed' },
} satisfies Record<AppState['name'], AppState>;

/** The other panels of `menu`, for the rows that need them. */
const settingsMenu: AppState = { name: 'menu', panel: 'settings' };
const helpMenu: AppState = { name: 'menu', panel: 'help' };
const achievementsMenu: AppState = { name: 'menu', panel: 'achievements' };
const boardsMenu: AppState = { name: 'menu', panel: 'boards' };
/** The replay of a won run, which goes back to the victory. */
const watchingVictory: AppState = { ...states.watching, finished: victory };
/** A stored run of the boards, at each step of its loading (#219). */
const failedReplay: AppState = {
  name: 'storedReplay',
  runId: RUN_ID,
  from: 'boards',
  load: { status: 'failed', problem: 'offline' },
};
const fetchedReplay: AppState = {
  name: 'storedReplay',
  runId: RUN_ID,
  from: 'boards',
  load: { status: 'fetched', replay },
};
const readyReplay: AppState = {
  name: 'storedReplay',
  runId: RUN_ID,
  from: 'boards',
  load: { status: 'ready', replay, assets, time: 'day' },
};

/** One example of every event; the `satisfies` keeps the list complete. */
const events = {
  openSettings: { type: 'openSettings' },
  openHelp: { type: 'openHelp' },
  openAchievements: { type: 'openAchievements' },
  openBoards: { type: 'openBoards' },
  selectHero: { type: 'selectHero' },
  selectDaily: { type: 'selectDaily', date: '2026-11-17' },
  back: { type: 'back' },
  play: { type: 'play', run: nextRun },
  gameLoaded: { type: 'gameLoaded', assets: otherAssets },
  pause: { type: 'pause' },
  resume: { type: 'resume' },
  gamePaused: { type: 'gamePaused' },
  gameResumed: { type: 'gameResumed' },
  gamepadLost: { type: 'gamepadLost' },
  runEnded: { type: 'runEnded', result: resultWith('lost'), replay },
  levelCleared: { type: 'levelCleared', level: 3, score: 120, nextTime: 'night' },
  nextLevel: { type: 'nextLevel' },
  quit: { type: 'quit' },
  runFailed: { type: 'runFailed' },
  restart: { type: 'restart' },
  watchReplay: { type: 'watchReplay' },
  replayTime: { type: 'replayTime', time: 'night' },
  watchRun: { type: 'watchRun', runId: RUN_ID },
  replayFetched: { type: 'replayFetched', runId: RUN_ID, replay },
  replayFailed: { type: 'replayFailed', runId: RUN_ID, problem: 'offline' },
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
  { from: states.menu, event: events.openAchievements, to: 'menu' },
  { from: states.menu, event: events.openBoards, to: 'menu' },
  { from: states.menu, event: events.selectHero, to: 'heroSelect' },
  { from: states.menu, event: events.selectDaily, to: 'heroSelect' },
  { from: settingsMenu, event: events.back, to: 'menu' },
  { from: helpMenu, event: events.back, to: 'menu' },
  { from: achievementsMenu, event: events.back, to: 'menu' },
  { from: boardsMenu, event: events.back, to: 'menu' },
  { from: states.heroSelect, event: events.back, to: 'menu' },
  { from: states.heroSelect, event: events.play, to: 'loading' },
  { from: states.loading, event: events.gameLoaded, to: 'playing' },
  { from: states.loading, event: events.back, to: 'heroSelect' },
  { from: states.playing, event: events.pause, to: 'paused' },
  { from: states.playing, event: events.gamePaused, to: 'paused' },
  { from: states.playing, event: events.gamepadLost, to: 'paused' },
  { from: states.playing, event: events.levelCleared, to: 'levelCleared' },
  { from: states.levelCleared, event: events.nextLevel, to: 'playing' },
  { from: states.levelCleared, event: events.quit, to: 'menu' },
  {
    from: states.playing,
    event: { type: 'runEnded', result: resultWith('won'), replay },
    to: 'victory',
  },
  { from: states.playing, event: events.runEnded, to: 'gameOver' },
  { from: states.playing, event: events.quit, to: 'menu' },
  { from: states.paused, event: events.resume, to: 'playing' },
  { from: states.paused, event: events.gameResumed, to: 'playing' },
  { from: states.paused, event: events.quit, to: 'menu' },
  { from: states.victory, event: events.play, to: 'playing' },
  { from: states.victory, event: events.quit, to: 'menu' },
  { from: states.gameOver, event: events.play, to: 'playing' },
  { from: states.gameOver, event: events.quit, to: 'menu' },
  { from: states.victory, event: events.watchReplay, to: 'watching' },
  { from: states.gameOver, event: events.watchReplay, to: 'watching' },
  { from: states.watching, event: events.replayTime, to: 'watching' },
  { from: states.watching, event: events.back, to: 'gameOver' },
  { from: watchingVictory, event: events.back, to: 'victory' },
  { from: states.watching, event: events.quit, to: 'menu' },
  { from: states.playing, event: events.runFailed, to: 'failed' },
  { from: states.paused, event: events.runFailed, to: 'failed' },
  { from: states.levelCleared, event: events.runFailed, to: 'failed' },
  { from: states.victory, event: events.runFailed, to: 'failed' },
  { from: states.gameOver, event: events.runFailed, to: 'failed' },
  { from: states.watching, event: events.runFailed, to: 'failed' },
  { from: states.failed, event: events.restart, to: 'menu' },
  { from: boardsMenu, event: events.watchRun, to: 'storedReplay' },
  { from: states.storedReplay, event: events.replayFetched, to: 'storedReplay' },
  { from: states.storedReplay, event: events.replayFailed, to: 'storedReplay' },
  { from: failedReplay, event: events.watchRun, to: 'storedReplay' },
  { from: fetchedReplay, event: events.gameLoaded, to: 'storedReplay' },
  { from: readyReplay, event: events.replayTime, to: 'storedReplay' },
  { from: states.storedReplay, event: events.back, to: 'menu' },
  { from: readyReplay, event: events.runFailed, to: 'failed' },
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
      time: nextRun.mode,
    });
  });

  it('returns from the wait to the hero select, and ignores a load that ends elsewhere', () => {
    expect(transition(states.loading, events.back)).toEqual({ name: 'heroSelect', daily: null });
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

  it('opens the hero select of the daily run from the main menu, and keeps its day (#165)', () => {
    const daily = transition(states.menu, events.selectDaily);

    expect(daily).toEqual({ name: 'heroSelect', daily: '2026-11-17' });
    expect(transition(states.menu, events.selectHero)).toEqual({ name: 'heroSelect', daily: null });
    expect(transition(helpMenu, events.selectDaily)).toBe(helpMenu);
    // Back from the wait for the game returns to the hero select of the same day.
    const waiting = transition(daily, { type: 'play', run: dailyRun });
    expect(transition(waiting, events.back)).toEqual(daily);
  });

  it('opens the achievements from the main menu only, and back returns to it (#163)', () => {
    expect(transition(states.menu, events.openAchievements)).toEqual(achievementsMenu);
    expect(transition(achievementsMenu, events.back)).toEqual(states.menu);
    expect(transition(helpMenu, events.openAchievements)).toBe(helpMenu);
    expect(transition(achievementsMenu, events.openSettings)).toBe(achievementsMenu);
    expect(transition(states.playing, events.openAchievements)).toBe(states.playing);
  });

  it('opens the boards from the main menu only, and back returns to it (#220)', () => {
    expect(transition(states.menu, events.openBoards)).toEqual(boardsMenu);
    expect(transition(boardsMenu, events.back)).toEqual(states.menu);
    expect(transition(helpMenu, events.openBoards)).toBe(helpMenu);
    expect(transition(boardsMenu, events.openSettings)).toBe(boardsMenu);
    expect(transition(states.playing, events.openBoards)).toBe(states.playing);
  });

  it('starts the next run at once over a finished one, with the assets it has, at its time', () => {
    const next = { name: 'playing', assets, run: nextRun, time: nextRun.mode };

    expect(transition(states.victory, events.play)).toEqual(next);
    expect(transition(states.gameOver, events.play)).toEqual(next);
  });

  it('holds a cleared level, then goes on at the time of day of the next one', () => {
    const cleared = transition(states.playing, events.levelCleared);

    expect(cleared).toEqual(states.levelCleared);
    expect(transition(cleared, events.nextLevel)).toEqual({
      name: 'playing',
      assets,
      run,
      time: 'night',
    });
  });

  it('keeps the same run object through pause and resume', () => {
    const paused = transition(states.playing, events.gamePaused);

    expect(paused).toEqual({ name: 'paused', assets, run, time: 'day', reason: 'player' });
    expect(transition(paused, events.resume)).toEqual(states.playing);
    expect(transition(states.playing, events.pause)).toEqual(paused);
    expect(transition(paused, events.gameResumed)).toEqual(states.playing);
  });

  it('pauses a run whose gamepad disconnects, and keeps why until the run goes on', () => {
    const lost = transition(states.playing, events.gamepadLost);

    expect(lost).toEqual({ ...states.paused, reason: 'gamepadLost' });
    // Already paused by the player, the run stays paused as it was.
    expect(transition(states.paused, events.gamepadLost)).toBe(states.paused);
    expect(transition(lost, events.resume)).toEqual(states.playing);
  });

  it('ends a won run as a victory and a lost run as game over, with the result and the time', () => {
    const night = { ...states.playing, time: 'night' } as const;

    expect(transition(night, { type: 'runEnded', result: resultWith('won'), replay })).toEqual(
      victory,
    );
    expect(transition(states.playing, events.runEnded)).toEqual(gameOver);
  });

  it('ignores an end report whose result says the run goes on', () => {
    for (const status of ['playing', 'levelCleared'] as const) {
      const event: AppEvent = { type: 'runEnded', result: resultWith(status), replay };

      expect(transition(states.playing, event)).toBe(states.playing);
    }
  });

  it('drops a run that failed, whatever state it was in, and restarts on the main menu', () => {
    const runStates = [
      states.playing,
      states.paused,
      states.levelCleared,
      states.victory,
      states.gameOver,
      states.watching,
    ];
    const afterFailure = runStates.map((state) => transition(state, events.runFailed));

    expect(afterFailure).toEqual(Array<AppState>(6).fill({ name: 'failed' }));
    expect(transition(states.failed, events.restart)).toEqual({ name: 'menu', panel: 'main' });
    expect(transition(states.loading, events.runFailed)).toBe(states.loading);
    expect(transition(states.menu, events.restart)).toBe(states.menu);
  });

  it('drops the run and its assets on quit and returns to the main menu', () => {
    const runStates = [
      states.playing,
      states.paused,
      states.levelCleared,
      states.victory,
      states.gameOver,
      states.watching,
    ];
    const afterQuit = runStates.map((state) => transition(state, events.quit));

    expect(afterQuit).toEqual(Array<AppState>(6).fill({ name: 'menu', panel: 'main' }));
  });

  it('keeps the replay of a finished run, to watch it (#219)', () => {
    expect(transition(states.playing, events.runEnded)).toMatchObject({ replay });
  });

  it('watches the replay over the finished run, from the time of day it began', () => {
    const night = { ...gameOver, time: 'night' } as const;

    expect(transition(night, events.watchReplay)).toEqual({
      name: 'watching',
      assets,
      run,
      time: 'day',
      finished: night,
    });
    expect(transition(victory, events.watchReplay)).toEqual(watchingVictory);
  });

  it('follows the time of day of the replay, and goes back to the very same finished run', () => {
    const watching = transition(gameOver, events.watchReplay);
    const atNight = transition(watching, events.replayTime);

    expect(atNight).toEqual({ ...watching, time: 'night' });
    expect(transition(atNight, events.replayTime)).toBe(atNight);
    expect(transition(atNight, events.back)).toBe(gameOver);
    expect(transition(watchingVictory, events.back)).toBe(victory);
  });
});

describe('a stored run of the boards (#219)', () => {
  it('fetches its replay, waits for the game, then plays it at the time of day it began', () => {
    const fetching = transition(boardsMenu, events.watchRun);
    expect(fetching).toEqual(states.storedReplay);

    const fetched = transition(fetching, events.replayFetched);
    expect(fetched).toEqual(fetchedReplay);

    const ready = transition(fetched, events.gameLoaded);
    expect(ready).toEqual({
      name: 'storedReplay',
      runId: RUN_ID,
      from: 'boards',
      load: { status: 'ready', replay, assets: otherAssets, time: replay.mode },
    });

    const night = transition(ready, events.replayTime);
    expect(night).toMatchObject({ load: { status: 'ready', time: 'night' } });
    // The same time again changes nothing.
    expect(transition(night, events.replayTime)).toBe(night);

    expect(transition(night, events.back)).toEqual(boardsMenu);
  });

  it('opens from the boards only', () => {
    expect(transition(states.menu, events.watchRun)).toBe(states.menu);
    expect(transition(states.gameOver, events.watchRun)).toBe(states.gameOver);
  });

  it('says why a replay cannot be watched, tries again, and ignores news of another run', () => {
    const failed = transition(states.storedReplay, events.replayFailed);
    expect(failed).toEqual(failedReplay);

    expect(transition(failed, events.watchRun)).toEqual(states.storedReplay);
    expect(transition(failed, events.back)).toEqual(boardsMenu);

    const other = '22222222-2222-4222-8222-222222222222';
    expect(transition(states.storedReplay, { ...events.replayFetched, runId: other })).toBe(
      states.storedReplay,
    );
    expect(transition(states.storedReplay, { ...events.replayFailed, runId: other })).toBe(
      states.storedReplay,
    );
  });

  it('opens from its link at /replay/:runId, and goes back to the main menu', () => {
    const linked = initialStateFor(`/replay/${RUN_ID}`);
    expect(linked).toEqual({ ...states.storedReplay, from: 'link' });
    expect(initialStateFor(`/replay/${RUN_ID}/`)).toEqual(linked);

    // After a failure, trying again keeps where the replay came from.
    const failed = transition(linked, events.replayFailed);
    expect(transition(failed, events.watchRun)).toEqual(linked);

    expect(transition(linked, events.back)).toEqual(initialState);
  });

  it('starts on the main menu at any other address', () => {
    for (const path of ['/', '/replay', '/replay/', '/replay/not-a-run', `/replay/${RUN_ID}/x`]) {
      expect(initialStateFor(path)).toBe(initialState);
    }
  });

  it('waits for the replay before the game: a loaded game alone starts nothing', () => {
    expect(transition(states.storedReplay, events.gameLoaded)).toBe(states.storedReplay);
  });
});

describe('isRunState', () => {
  it('tells the six states of a run on screen from the other four', () => {
    const withRun = Object.values(states).filter(isRunState);

    expect(withRun.map((state) => state.name)).toEqual([
      'playing',
      'paused',
      'levelCleared',
      'victory',
      'gameOver',
      'watching',
    ]);
  });
});

describe('invariants of the flow', () => {
  const choice = fc.record({
    heroId: fc.constantFrom('male', 'female', 'sam', 'leo'),
    mode: fc.constantFrom('day', 'night'),
    seed: fc.nat(),
    speed: fc.constantFrom(1, 0.75, 0.5),
    difficulty: fc.constantFrom('easy', 'normal', 'hard'),
    daily: fc.constantFrom(null, '2026-11-17'),
  });
  const step: fc.Arbitrary<AppEvent> = fc.oneof(
    fc.constant(events.openSettings),
    fc.constant(events.openHelp),
    fc.constant(events.openAchievements),
    fc.constant(events.openBoards),
    fc.constant(events.selectHero),
    fc.constant(events.selectDaily),
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
    fc.constant(events.gamepadLost),
    fc.record({
      type: fc.constant('runEnded' as const),
      result: fc.constantFrom('playing', 'levelCleared', 'won', 'lost').map(resultWith),
      replay: fc.constant(replay),
    }),
    fc.record({
      type: fc.constant('levelCleared' as const),
      level: fc.integer({ min: 1, max: 5 }),
      score: fc.nat(),
      nextTime: fc.constantFrom('day' as const, 'night' as const),
    }),
    fc.constant(events.nextLevel),
    fc.constant(events.quit),
    fc.constant(events.runFailed),
    fc.constant(events.restart),
    fc.constant(events.watchReplay),
    fc.record({
      type: fc.constant('replayTime' as const),
      time: fc.constantFrom('day' as const, 'night' as const),
    }),
    fc.constant(events.watchRun),
    fc.constant(events.replayFetched),
    fc.constant(events.replayFailed),
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
          // Back from a stored replay returns to the boards it was opened from (#219).
          const fromReplay =
            previous.name === 'storedReplay' && event.type === 'back' && state.panel === 'boards';
          return (previous.name === 'menu' && previous.panel === 'main') || fromReplay
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
          return state.run === previousRun &&
            state.assets === previousAssets &&
            state.time === previous.time
            ? null
            : 'resume changed the run';
        }
        if (previous.name === 'levelCleared') {
          // The next level of the same run, at the time the cleared one announced.
          return event.type === 'nextLevel' &&
            state.run === previousRun &&
            state.assets === previousAssets &&
            state.time === previous.nextTime
            ? null
            : `the next level entered by ${event.type} or at the wrong time`;
        }
        if (previous.name === 'loading') {
          // The loaded assets join the run the player chose before the wait, at its first time.
          return event.type === 'gameLoaded' &&
            state.run === previousRun &&
            state.assets === event.assets &&
            state.time === state.run.mode
            ? null
            : `the wait ended by ${event.type} into another run`;
        }
        if (event.type !== 'play') {
          return `playing entered by ${event.type}`;
        }
        // Play again: the new run keeps the assets of the one that ended.
        return state.run === event.run &&
          state.assets === previousAssets &&
          state.time === event.run.mode
          ? null
          : 'play again changed the assets or started a different run';
      case 'paused':
      case 'levelCleared':
        if (previous.name !== 'playing') {
          return `${state.name} from ${previous.name}`;
        }
        return state.run === previousRun &&
          state.assets === previousAssets &&
          state.time === previous.time
          ? null
          : `${state.name} changed the run`;
      case 'failed':
        return (isRunState(previous) ||
          (previous.name === 'storedReplay' && previous.load.status === 'ready')) &&
          event.type === 'runFailed'
          ? null
          : `failed from ${previous.name} by ${event.type}`;
      case 'storedReplay':
        if (previous.name === 'menu') {
          return previous.panel === 'boards' && event.type === 'watchRun'
            ? null
            : `a stored replay from the ${previous.panel} menu by ${event.type}`;
        }
        return previous.name === 'storedReplay' && state.runId === previous.runId
          ? null
          : `a stored replay from ${previous.name}, or of another run`;
      case 'victory':
      case 'gameOver':
        if (previous.name === 'watching') {
          // Back from the replay to the run that was on screen before it.
          return event.type === 'back' && state === previous.finished
            ? null
            : `${state.name} from the replay by ${event.type}, or another run`;
        }
        if (previous.name !== 'playing' || event.type !== 'runEnded') {
          return `${state.name} from ${previous.name} by ${event.type}`;
        }
        return state.run === previousRun &&
          state.assets === previousAssets &&
          state.time === previous.time &&
          state.replay === event.replay
          ? null
          : 'the end changed the run';
      case 'watching':
        if (previous.name === 'watching') {
          return event.type === 'replayTime' &&
            state.finished === previous.finished &&
            state.run === previousRun &&
            state.assets === previousAssets
            ? null
            : `the replay changed by ${event.type}`;
        }
        if (previous.name !== 'victory' && previous.name !== 'gameOver') {
          return `watching from ${previous.name}`;
        }
        return event.type === 'watchReplay' &&
          state.finished === previous &&
          state.run === previousRun &&
          state.assets === previousAssets &&
          state.time === previous.replay.mode
          ? null
          : 'the replay is not the finished run';
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
