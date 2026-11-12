// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ASSET_BUDGET, formatAssetReport, measureAssets } from './asset-budget';

describe('measureAssets', () => {
  it("adds up the game's images and sounds and leaves the code and the styles out", () => {
    const report = measureAssets(
      [
        { fileName: 'assets/creatures-1a.webp', size: 300 },
        { fileName: 'assets/laser-2b.ogg', size: 50 },
        { fileName: 'assets/shot-3c.wav', size: 100 },
        { fileName: 'assets/index-4d.js', size: 9000 },
        { fileName: 'assets/index-5e.css', size: 700 },
      ],
      1000,
    );

    expect(report).toEqual({ total: 450, files: 3, budget: 1000, over: false });
  });

  it('is over budget only past it', () => {
    const files = [{ fileName: 'a.png', size: 1000 }];

    expect(measureAssets(files, 1000).over).toBe(false);
    expect(measureAssets(files, 999).over).toBe(true);
  });

  it('keeps the budget of #135, 1 MB', () => {
    expect(ASSET_BUDGET).toBe(1_000_000);
  });
});

describe('formatAssetReport', () => {
  it('says the total, the budget, the share used and the number of files', () => {
    expect(formatAssetReport({ total: 674_655, files: 17, budget: 1_000_000, over: false })).toBe(
      'Game assets: 674.7 kB of the 1000.0 kB budget (67%), 17 files',
    );
  });
});
