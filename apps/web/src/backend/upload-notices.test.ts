import { describe, expect, it } from 'vitest';

import { createUploadNews, MAX_UPLOAD_NOTICES, noticesOf } from './upload-notices';

describe('noticesOf', () => {
  it('says nothing when a finished run reaches the server: that is what runs do', () => {
    expect(noticesOf({ stored: ['run-1'], refused: 0, left: 0 }, 'finished')).toEqual([]);
  });

  it('says a finished run is kept on the device while it waits', () => {
    expect(noticesOf({ stored: [], refused: 0, left: 1 }, 'finished')).toEqual([{ kind: 'kept' }]);
    expect(noticesOf({ stored: [], refused: 0, left: 3, retryAfter: 60 }, 'finished')).toEqual([
      { kind: 'kept' },
    ]);
  });

  it('counts the runs that waited and went out', () => {
    expect(noticesOf({ stored: ['run-1', 'run-2'], refused: 0, left: 0 }, 'waiting')).toEqual([
      { kind: 'sent', count: 2 },
    ]);
    expect(noticesOf({ stored: [], refused: 0, left: 2 }, 'waiting')).toEqual([]);
    expect(noticesOf({ stored: [], refused: 0, left: 0 }, 'waiting')).toEqual([]);
  });

  it('tells of runs the server refused, after a run or not', () => {
    expect(noticesOf({ stored: [], refused: 1, left: 1 }, 'finished')).toEqual([
      { kind: 'refused', count: 1 },
      { kind: 'kept' },
    ]);
    expect(noticesOf({ stored: ['run-1'], refused: 2, left: 0 }, 'waiting')).toEqual([
      { kind: 'refused', count: 2 },
      { kind: 'sent', count: 1 },
    ]);
  });
});

describe('createUploadNews', () => {
  it('numbers what each sending has to say, and stays still when it has nothing', () => {
    const news = createUploadNews();
    const first = news.getState();

    news.report({ stored: [], refused: 0, left: 0 }, 'waiting');
    expect(news.getState()).toBe(first);

    news.report({ stored: [], refused: 1, left: 1 }, 'finished');
    expect(news.getState()).toEqual([
      { serial: 1, kind: 'refused', count: 1 },
      { serial: 2, kind: 'kept' },
    ]);
  });

  it('keeps the notices of sends that come before anyone reads them', () => {
    const news = createUploadNews();

    news.report({ stored: ['run-1'], refused: 0, left: 0 }, 'waiting');
    news.report({ stored: [], refused: 0, left: 1 }, 'finished');

    expect(news.getState()).toEqual([
      { serial: 1, kind: 'sent', count: 1 },
      { serial: 2, kind: 'kept' },
    ]);
  });

  it('keeps only the latest few', () => {
    const news = createUploadNews();
    for (let index = 0; index < MAX_UPLOAD_NOTICES + 2; index += 1) {
      news.report({ stored: [], refused: 0, left: 1 }, 'finished');
    }

    const notices = news.getState();
    expect(notices).toHaveLength(MAX_UPLOAD_NOTICES);
    expect(notices.at(-1)?.serial).toBe(MAX_UPLOAD_NOTICES + 2);
  });

  it('tells of one sending once, though two callers were given it', () => {
    const news = createUploadNews();
    const report = { stored: ['run-1'], refused: 0, left: 0 };

    news.report(report, 'waiting');
    news.report(report, 'waiting');

    expect(news.getState()).toHaveLength(1);
  });
});
