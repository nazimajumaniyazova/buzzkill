import type { AssetFailure } from '@buzzkill/engine';
import type { GameAction, GameMode, HeroId } from '@buzzkill/game';

import type { Difficulty } from '../state/settings/schema';
import type { ThemeChoice } from '../theme';
import type { Format } from './format';

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
      settings: 'Settings',
      help: 'Help',
    },
    heroSelect: {
      title: 'Choose your hero',
      hero: 'Hero',
      heroes: { male: 'Mike', female: 'Julie' } satisfies Record<HeroId, string>,
      timeOfDay: 'Time of day',
      modes: { day: 'Day', night: 'Night' } satisfies Record<GameMode, string>,
      start: 'Start',
    },
    settings: {
      title: 'Settings',
      sections: 'Settings sections',
      tabs: {
        sound: 'Sound',
        display: 'Display',
        gameplay: 'Gameplay',
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
      language: 'Language',
      difficulty: 'Difficulty',
      difficulties: {
        easy: 'Easy',
        normal: 'Normal',
        hard: 'Hard',
      } satisfies Record<Difficulty, string>,
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
      keyboard: 'Keyboard',
      gamepad: 'Gamepad',
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
    },
    hud: {
      label: 'Game status',
      score: 'Score',
      lives: 'Lives',
      ammo: 'Ammo',
      livesValue: (lives: number, max: number) =>
        `${format.number(lives)} of ${format.number(max)}`,
    },
    pause: {
      title: 'Paused',
      description: 'The run waits for you.',
      resume: 'Resume',
      quit: 'Quit to menu',
    },
    runOver: {
      titles: { levelComplete: 'Level complete', gameOver: 'Game over' },
      score: (score: number) => `Score: ${format.number(score)}`,
      playAgain: 'Play again',
      quit: 'Back to menu',
    },
  };
}

/** Every string of the shell and the HUD; another language is a function returning this. */
export type Messages = ReturnType<typeof english>;

/** The strings of a language, given the formatters of its locale. */
export type Dictionary = (format: Format) => Messages;

export const en: Dictionary = (format) => english(format);
