import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from './event-bus';

interface GameEvents {
  hit: { target: number; damage: number };
  death: { target: number };
  pickup: { kind: 'ammo' | 'life' };
}

describe('createEventBus', () => {
  it('delivers a payload to the listeners of its type, in registration order', () => {
    const bus = createEventBus<GameEvents>();
    const calls: string[] = [];
    bus.on('hit', ({ damage }) => calls.push(`first ${String(damage)}`));
    bus.on('hit', ({ damage }) => calls.push(`second ${String(damage)}`));
    bus.on('death', ({ target }) => calls.push(`death ${String(target)}`));

    bus.emit('hit', { target: 1, damage: 7 });

    expect(calls).toEqual(['first 7', 'second 7']);
    expect(bus.listenerCount('hit')).toBe(2);
    expect(bus.listenerCount('death')).toBe(1);
    expect(bus.listenerCount('pickup')).toBe(0);
  });

  it('is a no-op to emit an event nobody listens to', () => {
    const bus = createEventBus<GameEvents>();

    expect(() => {
      bus.emit('pickup', { kind: 'ammo' });
    }).not.toThrow();
  });

  it('stops calling a listener after the returned unsubscribe or off', () => {
    const bus = createEventBus<GameEvents>();
    const viaReturn = vi.fn();
    const viaOff = vi.fn();
    const unsubscribe = bus.on('death', viaReturn);
    bus.on('death', viaOff);

    unsubscribe();
    bus.off('death', viaOff);
    bus.off('death', viaOff);
    bus.emit('death', { target: 3 });

    expect(viaReturn).not.toHaveBeenCalled();
    expect(viaOff).not.toHaveBeenCalled();
    expect(bus.listenerCount('death')).toBe(0);
  });

  it('allows the same listener twice and removes one registration per off', () => {
    const bus = createEventBus<GameEvents>();
    const listener = vi.fn();
    bus.on('death', listener);
    bus.on('death', listener);

    bus.emit('death', { target: 1 });
    expect(listener).toHaveBeenCalledTimes(2);

    bus.off('death', listener);
    bus.emit('death', { target: 1 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('runs a listener added during an emit from the next emit on', () => {
    const bus = createEventBus<GameEvents>();
    const late = vi.fn();
    bus.on('hit', () => {
      bus.on('hit', late);
    });

    bus.emit('hit', { target: 1, damage: 1 });
    expect(late).not.toHaveBeenCalled();

    bus.emit('hit', { target: 1, damage: 1 });
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('does not run a listener removed earlier in the same emit', () => {
    const bus = createEventBus<GameEvents>();
    const second = vi.fn();
    const third = vi.fn();
    bus.on('hit', () => {
      bus.off('hit', second);
    });
    bus.on('hit', second);
    bus.on('hit', third);

    bus.emit('hit', { target: 1, damage: 1 });

    expect(second).not.toHaveBeenCalled();
    expect(third).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount('hit')).toBe(2);
    bus.emit('hit', { target: 1, damage: 1 });
    expect(third).toHaveBeenCalledTimes(2);
  });

  it('lets a listener remove itself, including a one-shot pattern', () => {
    const bus = createEventBus<GameEvents>();
    const once = vi.fn();
    const unsubscribe = bus.on('pickup', (payload) => {
      once(payload);
      unsubscribe();
    });

    bus.emit('pickup', { kind: 'life' });
    bus.emit('pickup', { kind: 'life' });

    expect(once).toHaveBeenCalledExactlyOnceWith({ kind: 'life' });
    expect(bus.listenerCount('pickup')).toBe(0);
  });

  it('supports an emit from inside a listener', () => {
    const bus = createEventBus<GameEvents>();
    const deaths: number[] = [];
    bus.on('hit', ({ target, damage }) => {
      if (damage >= 10) {
        bus.emit('death', { target });
      }
    });
    bus.on('death', ({ target }) => deaths.push(target));

    bus.emit('hit', { target: 4, damage: 10 });
    bus.emit('hit', { target: 5, damage: 1 });

    expect(deaths).toEqual([4]);
  });

  it('keeps working after a listener throws', () => {
    const bus = createEventBus<GameEvents>();
    const after = vi.fn();
    const unsubscribe = bus.on('hit', () => {
      throw new Error('boom');
    });
    bus.on('hit', after);

    expect(() => {
      bus.emit('hit', { target: 1, damage: 1 });
    }).toThrow('boom');
    expect(after).not.toHaveBeenCalled();

    unsubscribe();
    bus.emit('hit', { target: 1, damage: 1 });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('clear removes every listener, also when called during an emit', () => {
    const bus = createEventBus<GameEvents>();
    const hit = vi.fn();
    const death = vi.fn();
    bus.on('hit', () => {
      bus.clear();
    });
    bus.on('hit', hit);
    bus.on('death', death);

    bus.emit('hit', { target: 1, damage: 1 });
    bus.emit('death', { target: 1 });

    expect(hit).not.toHaveBeenCalled();
    expect(death).not.toHaveBeenCalled();
    expect(bus.listenerCount('hit')).toBe(0);

    bus.on('death', death);
    bus.clear();
    expect(bus.listenerCount('death')).toBe(0);
  });
});
