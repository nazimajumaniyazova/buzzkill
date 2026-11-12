import { statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { frameSvg } from '@buzzkill/art';
import { Resvg } from '@resvg/resvg-js';
import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';
import sharp from 'sharp';

import { atlasFile, renderManifest, wavFile } from './manifest';
import { MANIFEST_FILE, PATHS, readSound } from './paths';
import { type AtlasPlan, planAssets, SETTINGS, type SoundPlan } from './plan';
import { encodeWav } from './wav';

/**
 * Generates the files the game loads (ADR-0016): rasterizes every frame of the art with resvg,
 * packs the frames into WebP atlases with sharp, writes a WAV fallback for each Ogg sound and the
 * typed manifest. Run with `pnpm assets` after changing the art, a sound or a setting; the
 * manifest test fails until then.
 */
async function main(): Promise<void> {
  const plan = planAssets(readSound);
  for (const atlas of plan.atlases) {
    await writeAtlas(atlas);
  }
  for (const sound of plan.sounds) {
    await writeWav(sound);
  }
  writeFileSync(join(PATHS.output, MANIFEST_FILE), renderManifest(plan));

  const files = [
    ...plan.atlases.map((atlas) => atlasFile(atlas.name)),
    ...plan.sounds.map((sound) => wavFile(sound.id)),
    MANIFEST_FILE,
  ];
  for (const file of files) {
    const kilobytes = (statSync(join(PATHS.output, file)).size / 1024).toFixed(1);
    process.stdout.write(`${file.padEnd(16)}${kilobytes.padStart(8)} kB\n`);
  }
}

async function writeAtlas(atlas: AtlasPlan): Promise<void> {
  const frames = atlas.placements.map((placement) => ({
    input: new Resvg(frameSvg(placement.name, placement.frame), {
      // The art has no text, so no fonts are needed.
      font: { loadSystemFonts: false },
    })
      .render()
      .asPng(),
    left: placement.x,
    top: placement.y,
  }));
  await sharp({
    create: {
      width: atlas.width,
      height: atlas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(frames)
    .webp(SETTINGS.webp)
    .toFile(join(PATHS.output, atlasFile(atlas.name)));
}

async function writeWav(sound: SoundPlan): Promise<void> {
  const decoder = new OggVorbisDecoder();
  await decoder.ready;
  try {
    const { channelData, sampleRate } = await decoder.decodeFile(readSound(sound.source));
    writeFileSync(join(PATHS.output, wavFile(sound.id)), encodeWav(channelData, sampleRate));
  } finally {
    decoder.free();
  }
}

await main();
