// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { atlasFile, renderManifest, wavFile } from './manifest';
import { MANIFEST_FILE, PATHS, readSound } from './paths';
import { planAssets } from './plan';

const plan = planAssets(readSound);

describe('the generated assets', () => {
  it('match the committed manifest; `pnpm assets` regenerates them', () => {
    const committed = readFileSync(join(PATHS.output, MANIFEST_FILE), 'utf8');

    expect(committed).toBe(renderManifest(plan));
  });

  it.each(plan.atlases.map((atlas) => [atlas.name, atlas] as const))(
    'include the %s atlas as a WebP image of the planned size',
    async (_name, atlas) => {
      const { format, width, height } = await sharp(
        join(PATHS.output, atlasFile(atlas.name)),
      ).metadata();

      expect({ format, width, height }).toEqual({
        format: 'webp',
        width: atlas.width,
        height: atlas.height,
      });
    },
  );

  it.each(plan.sounds.map((sound) => sound.id))('include the %s sound as a WAV file', (id) => {
    const bytes = readFileSync(join(PATHS.output, wavFile(id)));

    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('latin1')).toBe('WAVE');
  });
});
