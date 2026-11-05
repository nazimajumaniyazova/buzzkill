import { describe, expect, it } from 'vitest';

import { createGridAtlas } from './atlas';
import { type Context2DLike, createCanvas2DRenderer } from './renderer';

type Call = readonly [string, ...unknown[]];

/** A context that records calls; `drawImage` also records the opacity it drew with. */
function createFakeContext() {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push([name, ...args]);
    };
  const context: Context2DLike<string> = {
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    fillText: record('fillText'),
    drawImage(...args) {
      calls.push(['drawImage', ...args, { alpha: context.globalAlpha }]);
    },
    fillStyle: '',
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };
  return { context, calls };
}

const ATLAS = createGridAtlas('sheet', { frameWidth: 50, frameHeight: 40, frames: 4 });

describe('createCanvas2DRenderer', () => {
  it('starts a frame with the scale transform and a clear of the play area', () => {
    const { context, calls } = createFakeContext();
    const renderer = createCanvas2DRenderer(context, { width: 1280, height: 720, scale: 2 });

    renderer.beginFrame();

    expect(calls).toEqual([
      ['setTransform', 2, 0, 0, 2, 0, 0],
      ['clearRect', 0, 0, 1280, 720],
    ]);
    expect([renderer.width, renderer.height]).toEqual([1280, 720]);
  });

  it('draws a frame of an atlas at its own size or at the given size', () => {
    const { context, calls } = createFakeContext();
    const renderer = createCanvas2DRenderer(context, { width: 1280, height: 720 });
    renderer.beginFrame();

    renderer.drawSprite(ATLAS, 2, 100, 200);
    renderer.drawSprite(ATLAS, 0, 10, 20, { width: 25, height: 20 });

    expect(calls.slice(2)).toEqual([
      ['drawImage', 'sheet', 100, 0, 50, 40, 100, 200, 50, 40, { alpha: 1 }],
      ['drawImage', 'sheet', 0, 0, 50, 40, 10, 20, 25, 20, { alpha: 1 }],
    ]);
    expect(renderer.endFrame()).toEqual({ sprites: 2, culled: 0 });
  });

  it('snaps positions to whole device pixels', () => {
    const { context, calls } = createFakeContext();
    const renderer = createCanvas2DRenderer(context, { width: 1280, height: 720, scale: 2 });
    renderer.beginFrame();

    renderer.drawSprite(ATLAS, 0, 10.3, 20.8);

    // At scale 2 a logical pixel has two device pixels: 10.3 -> 10.5 and 20.8 -> 21.
    expect(calls.at(-1)?.slice(6, 8)).toEqual([10.5, 21]);
  });

  it('culls sprites entirely outside the play area and counts them', () => {
    const { context, calls } = createFakeContext();
    const renderer = createCanvas2DRenderer(context, { width: 100, height: 100 });
    renderer.beginFrame();

    renderer.drawSprite(ATLAS, 0, 100, 0);
    renderer.drawSprite(ATLAS, 0, -50, 0);
    renderer.drawSprite(ATLAS, 0, 0, 100);
    renderer.drawSprite(ATLAS, 0, 0, -40);
    renderer.drawSprite(ATLAS, 0, -49, -39);

    expect(calls.filter(([name]) => name === 'drawImage')).toHaveLength(1);
    expect(renderer.endFrame()).toEqual({ sprites: 1, culled: 4 });
    renderer.beginFrame();
    expect(renderer.endFrame()).toEqual({ sprites: 0, culled: 0 });
  });

  it('draws with the given opacity and restores full opacity afterwards', () => {
    const { context, calls } = createFakeContext();
    const renderer = createCanvas2DRenderer(context, { width: 1280, height: 720 });
    renderer.beginFrame();

    renderer.drawSprite(ATLAS, 1, 0, 0, { alpha: 0.5 });

    expect(calls.at(-1)?.at(-1)).toEqual({ alpha: 0.5 });
    expect(context.globalAlpha).toBe(1);
  });

  it('rejects a frame the atlas does not have', () => {
    const renderer = createCanvas2DRenderer(createFakeContext().context, {
      width: 10,
      height: 10,
    });

    expect(() => {
      renderer.drawSprite(ATLAS, 4, 0, 0);
    }).toThrow(/frame 4 is outside an atlas of 4/);
  });

  it('fills rectangles and draws text with a style', () => {
    const { context, calls } = createFakeContext();
    const renderer = createCanvas2DRenderer(context, { width: 1280, height: 720 });

    renderer.fillRect(1, 2, 3, 4, '#c0392b');
    expect(context.fillStyle).toBe('#c0392b');
    renderer.drawText('Score 5', 20, 30, { font: '24px system-ui', color: 'white' });
    expect(context).toMatchObject({
      fillStyle: 'white',
      font: '24px system-ui',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    });
    renderer.drawText('Paused', 640, 360, {
      font: '48px system-ui',
      color: 'white',
      align: 'center',
      baseline: 'middle',
    });

    expect(calls).toEqual([
      ['fillRect', 1, 2, 3, 4],
      ['fillText', 'Score 5', 20, 30],
      ['fillText', 'Paused', 640, 360],
    ]);
    expect([context.textAlign, context.textBaseline]).toEqual(['center', 'middle']);
  });

  it('uses a new scale from the next frame and rejects invalid scales', () => {
    const { context, calls } = createFakeContext();
    const renderer = createCanvas2DRenderer(context, { width: 10, height: 10 });

    renderer.setScale(1.5);
    renderer.beginFrame();

    expect(calls[0]).toEqual(['setTransform', 1.5, 0, 0, 1.5, 0, 0]);
    expect(() => {
      renderer.setScale(0);
    }).toThrow(RangeError);
    expect(() =>
      createCanvas2DRenderer(context, { width: 10, height: 10, scale: Infinity }),
    ).toThrow(RangeError);
  });
});
