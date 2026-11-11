// @vitest-environment jsdom
import { DAY_ENEMIES, HEROES, NIGHT_ENEMIES, RULES, WORLD } from '@buzzkill/game';
import { describe, expect, it } from 'vitest';

import {
  CITY_LAYERS,
  cityLayerSvg,
  frameSvg,
  type SpriteName,
  SPRITES,
  type TimeOfDay,
  WORLD_SIZE,
} from './index';

const NAMES = Object.keys(SPRITES) as SpriteName[];
const TIMES: readonly TimeOfDay[] = ['day', 'night'];

/** Every frame of every sprite, then every layer of both cities. */
const DOCUMENTS = [
  ...NAMES.flatMap((name) =>
    Array.from({ length: SPRITES[name].frames }, (_, frame) => ({
      label: `${name} ${String(frame)}`,
      svg: frameSvg(name, frame),
    })),
  ),
  ...TIMES.flatMap((time) =>
    CITY_LAYERS.map((layer) => ({ label: `${time} ${layer}`, svg: cityLayerSvg(time, layer) })),
  ),
];

/** The part of jsdom's XML parser the tests use; the package itself has no DOM types. */
interface ParsedRoot {
  readonly nodeName: string;
  getAttribute(name: string): string | null;
  getElementsByTagName(name: string): { readonly length: number };
}
interface XmlParser {
  parseFromString(text: string, type: string): { readonly documentElement: ParsedRoot };
}
const { DOMParser } = globalThis as unknown as { DOMParser: new () => XmlParser };

function parse(svg: string): ParsedRoot {
  return new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
}

/** The art that replaces each enemy of the game configuration, by enemy id. */
const ENEMY_ART: Readonly<Record<string, SpriteName>> = {
  'day-1': 'beetle',
  'day-2': 'wasp',
  'day-3': 'dragonfly',
  'night-bat': 'moth',
  'night-raven': 'firefly',
  'night-ghost': 'mosquito',
};

describe('the art', () => {
  it.each(DOCUMENTS.map((d) => [d.label, d.svg]))(
    '%s is a well-formed SVG document',
    (_label, svg) => {
      const root = parse(svg);

      expect(root.nodeName).toBe('svg');
      expect(root.getElementsByTagName('parsererror')).toHaveLength(0);
    },
  );

  it('declares each frame at its sprite size', () => {
    const wrong = NAMES.filter((name) => {
      const root = parse(frameSvg(name, 0));
      const { width, height } = SPRITES[name];
      return (
        root.getAttribute('viewBox') !== `0 0 ${String(width)} ${String(height)}` ||
        root.getAttribute('width') !== String(width) ||
        root.getAttribute('height') !== String(height)
      );
    });

    expect(wrong).toEqual([]);
  });

  it("draws each enemy in its frame size, so the game's hitboxes do not change", () => {
    const sizes = [...DAY_ENEMIES, ...NIGHT_ENEMIES].map((enemy) => {
      const art = SPRITES[ENEMY_ART[enemy.id] ?? 'shot'];
      return [
        enemy.id,
        [art.width, art.height],
        [enemy.sprite.frameWidth, enemy.sprite.frameHeight],
      ];
    });

    for (const [id, art, game] of sizes) {
      expect([id, art]).toEqual([id, game]);
    }
  });

  it("draws the heroes at twice their boxes, the explosions in the game's 9 frames and the shot at twice its size", () => {
    expect([SPRITES.mike.width, SPRITES.mike.height]).toEqual([
      Math.round(HEROES.male.width * 2),
      Math.round(HEROES.male.height * 2),
    ]);
    expect([SPRITES.julie.width, SPRITES.julie.height]).toEqual([
      Math.round(HEROES.female.width * 2),
      Math.round(HEROES.female.height * 2),
    ]);
    for (const name of ['explosion-fire', 'explosion-smoke'] as const) {
      expect(SPRITES[name]).toMatchObject({
        width: RULES.explosion.size * 2,
        height: RULES.explosion.size * 2,
        frames: RULES.explosion.frames,
        frameTicks: RULES.explosion.frameTicks,
      });
    }
    expect([SPRITES.shot.width, SPRITES.shot.height]).toEqual([
      RULES.projectile.width * 2,
      RULES.projectile.height * 2,
    ]);
  });

  it("draws the city in the world's size", () => {
    expect(WORLD_SIZE).toEqual({ width: WORLD.width, height: WORLD.height });
  });

  it('gives every id one owner across all the art, so frames can share one atlas document', () => {
    const ids = DOCUMENTS.flatMap((d) => [...d.svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refers to nothing outside the document', () => {
    const external = DOCUMENTS.filter((d) =>
      /(?:href|url\()\s*=?\s*["']?(?:https?:|\/\/)/.test(d.svg),
    );

    expect(external.map((d) => d.label)).toEqual([]);
  });

  it('draws the same frame the same way every time', () => {
    for (const name of NAMES) {
      expect(frameSvg(name, 0)).toBe(frameSvg(name, 0));
    }
    expect(cityLayerSvg('night', 'sky')).toBe(cityLayerSvg('night', 'sky'));
  });

  it('moves between frames: no two frames of an animated sprite are the same', () => {
    const still = NAMES.filter((name) => {
      const { frames } = SPRITES[name];
      const all = Array.from({ length: frames }, (_, i) => frameSvg(name, i));
      return new Set(all).size !== frames;
    });

    expect(still).toEqual([]);
  });

  it('refuses a frame the sprite does not have', () => {
    expect(() => frameSvg('wasp', 6)).toThrow(RangeError);
    expect(() => frameSvg('wasp', -1)).toThrow(RangeError);
    expect(() => frameSvg('wasp', 1.5)).toThrow(RangeError);
  });

  it('has no clouds at night', () => {
    expect(cityLayerSvg('night', 'clouds')).not.toContain('<circle');
    expect(cityLayerSvg('day', 'clouds')).toContain('<circle');
  });
});
