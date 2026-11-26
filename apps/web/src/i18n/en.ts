import type { AssetFailure } from '@buzzkill/engine';
import {
  ACHIEVEMENT_SCORE,
  type AchievementId,
  type Difficulty,
  type GameAction,
  type GameMode,
  type HeroId,
} from '@buzzkill/game';

import { NICKNAME_LENGTH, type NicknameProblem } from '../backend/nickname';
import type { ErrorArea } from '../errors/report-error';
import type { MotionChoice } from '../motion';
import type { ThemeChoice } from '../theme';
import type { Format } from './format';

/** What the sun does between two levels: nothing, or it sets or rises (ADR-0017). */
export type TimeChange = 'none' | 'nightFalls' | 'dayBreaks';

/**
 * The English strings, the source of truth of the dictionary (ADR-0013): their shape is the
 * `Messages` type every other language must fill in full. A string with a value in it is a
 * function; numbers, plurals and dates go through `format`, never through string concatenation.
 */
function english(format: Format) {
  return {
    common: {
      back: 'Back',
      close: 'Close',
      notifications: 'Notifications',
    },
    actions: {
      moveUp: 'Move up',
      moveDown: 'Move down',
      fire: 'Shoot',
      pause: 'Pause',
    } satisfies Record<GameAction, string>,
    /** Names of the keys whose `KeyboardEvent.code` is not a name; the rest print as the code. */
    keys: {
      ArrowUp: 'Arrow up',
      ArrowDown: 'Arrow down',
      ArrowLeft: 'Arrow left',
      ArrowRight: 'Arrow right',
      Escape: 'Escape',
      Space: 'Space',
      Enter: 'Enter',
      Tab: 'Tab',
      Backspace: 'Backspace',
      ShiftLeft: 'Left Shift',
      ShiftRight: 'Right Shift',
      ControlLeft: 'Left Ctrl',
      ControlRight: 'Right Ctrl',
      AltLeft: 'Left Alt',
      AltRight: 'Right Alt',
    },
    loading: {
      progress: 'Loading',
      failed: 'The game could not load',
      codeFailed: 'Its code did not download. Reloading the page gets the latest version.',
      reload: 'Reload the page',
      failure: ({ file, reason }: { readonly file: string; readonly reason: string }) =>
        `${file}: ${reason}`,
      reasons: {
        network: 'the network request failed',
        http: 'the server returned an error',
        decode: 'the file is damaged',
        unavailable: 'this browser cannot play it',
        unknown: 'an unexpected error',
      } satisfies Record<AssetFailure['reason'], string>,
      retry: 'Try again',
    },
    menu: {
      title: 'Buzzkill',
      tagline: 'The year is 3023. Giant insects from outer space attack the city. Shoot them down.',
      navigation: 'Main menu',
      play: 'Play',
      daily: 'Daily challenge',
      /** The best score of this device in today's daily challenge (#165), under its button. */
      dailyBest: (score: number) => `Today's best: ${format.number(score)}`,
      dailyNotPlayed: 'Not played today yet',
      boards: 'Boards',
      settings: 'Settings',
      help: 'Help',
      achievements: 'Achievements',
    },
    /** The achievements (#163): their list in the menu and the toast that says one was earned. */
    achievements: {
      title: 'Achievements',
      intro: 'Kept on this device. Each run counts toward them.',
      progress: (count: number, goal: number) =>
        `${format.number(count)} of ${format.number(goal)}`,
      earned: 'Earned',
      unlocked: 'Achievement unlocked',
      items: {
        firstSwat: { name: 'First swat', description: () => 'Destroy an insect.' },
        swatter: {
          name: 'Swatter',
          description: (goal: number) => `Destroy ${format.number(goal)} insects.`,
        },
        nightShift: {
          name: 'Night shift',
          description: (goal: number) => `Destroy ${format.number(goal)} insects at night.`,
        },
        untouched: { name: 'Untouched', description: () => 'Clear a level without losing a life.' },
        collector: {
          name: 'Collector',
          description: (goal: number) => `Collect ${format.number(goal)} power-ups.`,
        },
        regicide: { name: 'Regicide', description: () => 'Defeat the queen.' },
        champion: { name: 'Champion', description: () => 'Win the campaign.' },
        flawless: {
          name: 'Flawless',
          description: () => 'Win the campaign without losing a life.',
        },
        highScore: {
          name: 'High scorer',
          description: () => `Score ${format.number(ACHIEVEMENT_SCORE)} in one run.`,
        },
      } satisfies Record<
        AchievementId,
        { readonly name: string; readonly description: (goal: number) => string }
      >,
    },
    heroSelect: {
      title: 'Choose your hero',
      hero: 'Hero',
      heroes: { male: 'Mike', female: 'Julie', sam: 'Sam', leo: 'Leo' } satisfies Record<
        HeroId,
        string
      >,
      /** Under a hero not unlocked yet (#164): the achievement that unlocks it and what it asks. */
      locked: (achievement: string, description: string) =>
        `Locked: earn the achievement “${achievement}”. ${description}`,
      timeOfDay: 'Time of day',
      modes: { day: 'Day', night: 'Night' } satisfies Record<GameMode, string>,
      start: 'Start',
      dailyTitle: 'Daily challenge',
      /** What the daily run of `date` is (#165); the date as the language writes it. */
      dailyAbout: (date: Date) =>
        `${format.date(date)}: the same run for everyone today, by day at the normal difficulty.`,
    },
    settings: {
      title: 'Settings',
      sections: 'Settings sections',
      tabs: {
        sound: 'Sound',
        display: 'Display',
        gameplay: 'Gameplay',
        effects: 'Effects',
        controls: 'Controls',
      },
      sound: 'Sound',
      effectsVolume: 'Effects volume',
      musicVolume: 'Music volume',
      theme: 'Theme',
      themes: {
        system: 'Match the system',
        day: 'Always day',
        night: 'Always night',
      } satisfies Record<ThemeChoice, string>,
      motion: 'Motion',
      motions: {
        system: 'Match the system',
        reduced: 'Reduced',
        full: 'Full',
      } satisfies Record<MotionChoice, string>,
      language: 'Language',
      difficulty: 'Difficulty',
      difficulties: {
        easy: 'Easy',
        normal: 'Normal',
        hard: 'Hard',
      } satisfies Record<Difficulty, string>,
      gameSpeed: 'Game speed',
      gameSpeedHint: `A slower game leaves more time to react. Only games at ${format.percent(1)} enter the leaderboard.`,
      particles: 'Particles',
      particlesHint:
        'Sparks where shots hit, debris and dust where insects break, and trails behind shots. With reduced motion, fewer and shorter.',
      screenShake: 'Screen shake',
      screenShakeHint:
        'The screen shakes when the hero is hit, when insects explode, and when the queen arrives, rages and falls. Never while motion is reduced.',
      hitFlash: 'Hit flash',
      hitFlashHint:
        'An insect, the queen or the hero flashes white when hit: softer while motion is reduced, and never more than three times a second.',
      squashStretch: 'Squash and stretch',
      squashStretchHint:
        'The hero squashes a little when firing, and insects stretch as they bob. Never while motion is reduced.',
      hitStop: 'Hit-stop',
      hitStopHint:
        'The picture holds for a moment when the hero is hit, when the queen rages and when she falls; the game itself goes on. Never while motion is reduced.',
      vibration: 'Vibration',
      vibrationHint: 'The phone buzzes and the gamepad rumbles briefly when the hero is hit.',
    },
    keyEditor: {
      caption: 'Keyboard',
      action: 'Action',
      slot: (slot: number) => `Key ${format.number(slot)}`,
      /** The accessible name of a slot's button: the action, the slot and the key or the wait. */
      button: ({
        action,
        slot,
        key,
      }: {
        readonly action: string;
        readonly slot: number;
        readonly key: string;
      }) => `${action}, key ${format.number(slot)}: ${key}`,
      waiting: 'Press a key…',
      waitingName: 'waiting for a key',
      prompt: (action: string) => `Press a key for ${action}, or Escape to cancel.`,
      cancelled: 'No change.',
      bound: ({ action, key }: { readonly action: string; readonly key: string }) =>
        `${action} now uses ${key}.`,
      displaced: ({
        key,
        action,
        newKey,
      }: {
        readonly key: string;
        readonly action: string;
        readonly newKey: string;
      }) => `${key} was taken from ${action}, which now uses ${newKey}.`,
      reset: 'Reset keys',
      resetDone: 'The default keys are back.',
    },
    help: {
      title: 'Help',
      intro: (lives: number) =>
        `Shoot the insects before they reach the city. ${format.number(lives)} ${format.plural(lives, { one: 'hit', other: 'hits' })} and the run is over.`,
      powerUps:
        'Destroyed insects sometimes drop power-ups. Touch one to collect it: rounds, a life, or a shield or rapid fire for a few seconds.',
      boss: 'The third and the sixth level end with the Wasp Queen. Dodge her stings and shoot her while she glides. Once her bar turns red, she charges: red lines mark her path first, so leave it.',
      keyboard: 'Keyboard',
      gamepad: 'Gamepad',
      touch: 'Touch screen',
      /** Where each action is on a touch screen (#153). */
      touchControls: {
        moveUp: 'Push the stick at the bottom left up',
        moveDown: 'Push the stick at the bottom left down',
        fire: 'Hold the button at the bottom right',
        pause: 'Tap the button at the top right',
      } satisfies Record<GameAction, string>,
      menus: 'In the menus',
      or: 'or',
      move: 'Move',
      select: 'Select',
      goBack: 'Go back or close a dialog',
      arrowKeys: 'Arrow keys',
      dpad: 'D-pad',
      leftStick: 'Left stick',
      /** The buttons of the W3C standard gamepad mapping that the game and the menus use. */
      padButtons: {
        a: 'A',
        b: 'B',
        start: 'Start',
        dpadUp: 'D-pad up',
        dpadDown: 'D-pad down',
        dpadLeft: 'D-pad left',
        dpadRight: 'D-pad right',
      },
      padButton: (button: number) => `Button ${format.number(button)}`,
    },
    game: {
      label: 'Game',
      canvas: 'Buzzkill game screen',
      unsupported: 'Your browser does not support the canvas element, so the game cannot run.',
      turnSideways: 'Turn your phone sideways for a bigger picture.',
    },
    hud: {
      label: 'Game status',
      score: 'Score',
      lives: 'Lives',
      ammo: 'Ammo',
      level: 'Level',
      livesValue: (lives: number, max: number) =>
        `${format.number(lives)} of ${format.number(max)}`,
      levelValue: (level: number, last: number) =>
        `${format.number(level)} of ${format.number(last)}`,
      shield: 'Shield',
      rapidFire: 'Rapid fire',
      secondsLeft: (seconds: number) => `${format.number(seconds)} s`,
      boss: 'Wasp Queen',
      bossHealth: (health: number, max: number) =>
        `${format.number(health)} of ${format.number(max)}`,
    },
    pause: {
      title: 'Paused',
      description: 'The run waits for you.',
      gamepadLost:
        'The gamepad was disconnected. Connect it again and resume, or play on with the keyboard.',
      resume: 'Resume',
      quit: 'Quit to menu',
    },
    levelCleared: {
      title: (level: number) => `Level ${format.number(level)} cleared`,
      description: (score: number, change: TimeChange) =>
        `Score: ${format.number(score)}.${
          {
            none: '',
            nightFalls: ' Night falls over the city.',
            dayBreaks: ' Day breaks over the city.',
          }[change]
        }`,
      next: 'Next level',
      quit: 'Quit to menu',
    },
    runOver: {
      titles: { victory: 'Victory', gameOver: 'Game over' },
      score: (score: number) => `Score: ${format.number(score)}`,
      playAgain: 'Play again',
      watch: 'Watch the replay',
      quit: 'Back to menu',
    },
    replay: {
      label: 'Replay',
      controls: 'Replay controls',
      pause: 'Pause',
      play: 'Play',
      rewind: 'Watch from the start',
      speed: 'Speed',
      speedOption: (speed: number) => `${format.number(speed)}×`,
      over: 'The replay is over.',
      loading: 'Loading the replay…',
      problems: {
        'not-found': 'This run is no longer on the boards.',
        offline: 'The replay cannot be loaded right now. Check the connection and try again.',
        unreadable: 'This replay cannot be read.',
        'other-version':
          'This run was played on another version of the game, which plays differently, so it cannot be watched.',
      },
      retry: 'Try again',
    },
    boards: {
      title: 'Boards',
      intro: `Each player's best run at ${format.percent(1)} speed. A slower run is only your own record.`,
      tabs: 'Board',
      today: 'Today',
      caption: (size: number, difficulty: string) => `Top ${format.number(size)}, ${difficulty}`,
      dailyCaption: (size: number, date: Date) =>
        `Top ${format.number(size)} of ${format.date(date)}`,
      columns: {
        place: 'Place',
        player: 'Player',
        score: 'Score',
        level: 'Level',
        replay: 'Replay',
      },
      watch: 'Watch',
      watchRun: (name: string) => `Watch the run of ${name}`,
      noNickname: 'A player without a nickname',
      you: (name: string) => `${name} (you)`,
      loading: 'Loading the board…',
      offline:
        'The board cannot be loaded right now. Your runs are kept and go out when the network is back.',
      retry: 'Try again',
      empty: 'No runs on this board yet.',
      personalBest: (score: number, level: number) =>
        `Your best: ${format.number(score)}, level ${format.number(level)}.`,
      slower: (speed: number) => `Played at ${format.percent(speed)} speed, so only you see it.`,
      noRecord: 'Your best run of this board appears here once one is stored.',
    },
    uploads: {
      kept: 'Run kept on this device',
      keptDetail: 'It goes to the boards once the game reaches the server.',
      sent: (count: number) =>
        `Sent ${format.number(count)} ${format.plural(count, { one: 'run', other: 'runs' })} that waited for the network.`,
      refused: (count: number) =>
        format.plural(count, {
          one: 'The server could not confirm a run, so it is not on the boards.',
          other: `The server could not confirm ${format.number(count)} runs, so they are not on the boards.`,
        }),
    },
    nickname: {
      title: 'Your nickname',
      description: 'Other players see it next to your scores.',
      label: 'Nickname',
      rules: `${format.number(NICKNAME_LENGTH.min)} to ${format.number(NICKNAME_LENGTH.max)} letters, digits, dots, dashes or underscores, with one space between words.`,
      problems: {
        'too-short': `A nickname has at least ${format.number(NICKNAME_LENGTH.min)} characters.`,
        'too-long': `A nickname has at most ${format.number(NICKNAME_LENGTH.max)} characters.`,
        characters:
          'Use only letters, digits, dots, dashes and underscores, with one space between words.',
      } satisfies Record<NicknameProblem, string>,
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      failures: {
        offline: 'No connection, so the nickname is not saved. Try again later.',
        unavailable: 'The server did not save the nickname. Try again later.',
      },
    },
    announce: {
      levelStart: (level: number) => `Level ${format.number(level)}. Go!`,
      lifeLost: (lives: number) =>
        `Hit! ${format.number(lives)} ${format.plural(lives, { one: 'life', other: 'lives' })} left.`,
      levelCleared: (level: number, score: number) =>
        `Level ${format.number(level)} cleared. Score: ${format.number(score)}.`,
      lifeGained: (lives: number) =>
        `Extra life! ${format.number(lives)} ${format.plural(lives, { one: 'life', other: 'lives' })} now.`,
      shieldOn: (seconds: number) =>
        `Shield on for ${format.number(seconds)} ${format.plural(seconds, { one: 'second', other: 'seconds' })}.`,
      rapidFireOn: (seconds: number) =>
        `Rapid fire for ${format.number(seconds)} ${format.plural(seconds, { one: 'second', other: 'seconds' })}.`,
      bossArrived: 'The Wasp Queen is here! Dodge her stings.',
      bossEnraged: 'The queen is enraged! Watch out for her charge.',
      bossDefeated: (score: number) => `The queen is defeated! Plus ${format.number(score)}.`,
      victory: (score: number) => `Victory! Every level cleared. Score: ${format.number(score)}.`,
      gameOver: (score: number) => `Game over. Score: ${format.number(score)}.`,
    },
    error: {
      title: 'Something went wrong',
      areas: {
        shell:
          'Buzzkill stopped on an error we did not expect. Restart opens the menu again; your settings are safe.',
        game: 'The run stopped on an error we did not expect. Restart takes you back to the menu; your settings are safe.',
      } satisfies Record<ErrorArea, string>,
      restart: 'Restart',
    },
  };
}

/** Every string of the shell and the HUD; another language is a function returning this. */
export type Messages = ReturnType<typeof english>;

/** The strings of a language, given the formatters of its locale. */
export type Dictionary = (format: Format) => Messages;

export const en: Dictionary = (format) => english(format);
