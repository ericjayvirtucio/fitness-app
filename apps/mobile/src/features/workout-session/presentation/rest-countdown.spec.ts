import {
  completeRestCountdown,
  defaultRestCountdownDurationSeconds,
  dismissRestCountdown,
  formatRestCountdownRemaining,
  hasRestCountdownElapsed,
  initialRestCountdownState,
  remainingRestMilliseconds,
  restCountdownPresetDurationsSeconds,
  startRestCountdown,
  type RestCountdownState,
} from './rest-countdown';

describe('rest countdown state', () => {
  it('starts idle', () => {
    expect(initialRestCountdownState).toEqual({ status: 'idle' });
  });

  it('exposes the four presets and a 90-second default', () => {
    expect(restCountdownPresetDurationsSeconds).toEqual([60, 90, 120, 180]);
    expect(defaultRestCountdownDurationSeconds).toBe(90);
  });

  it('start computes a deadline from the injected clock and the chosen duration', () => {
    const state = startRestCountdown(90, 1_000);
    expect(state).toEqual({ deadlineEpochMs: 91_000, status: 'running' });
  });

  it('start is a pure function of duration and clock, independent of the prior state', () => {
    const fromIdle = startRestCountdown(60, 5_000);
    const fromCompleted = startRestCountdown(60, 5_000);
    expect(fromIdle).toEqual({ deadlineEpochMs: 65_000, status: 'running' });
    expect(fromIdle).toEqual(fromCompleted);
  });
});

describe('remainingRestMilliseconds', () => {
  it('is zero before a countdown has started', () => {
    expect(remainingRestMilliseconds(initialRestCountdownState, 1_000)).toBe(0);
  });

  it('derives remaining time from the deadline, not from elapsed ticks', () => {
    const state = startRestCountdown(90, 1_000);
    expect(remainingRestMilliseconds(state, 1_000)).toBe(90_000);
    expect(remainingRestMilliseconds(state, 50_000)).toBe(41_000);
    expect(remainingRestMilliseconds(state, 91_000)).toBe(0);
  });

  it('clamps at zero rather than going negative past the deadline', () => {
    const state = startRestCountdown(60, 0);
    expect(remainingRestMilliseconds(state, 120_000)).toBe(0);
  });

  it('is zero once completed or dismissed', () => {
    const running = startRestCountdown(60, 0);
    const completed = completeRestCountdown(running);
    const dismissed = dismissRestCountdown(completed);
    expect(remainingRestMilliseconds(completed, 0)).toBe(0);
    expect(remainingRestMilliseconds(dismissed, 0)).toBe(0);
  });
});

describe('hasRestCountdownElapsed', () => {
  it('is false while time remains', () => {
    const state = startRestCountdown(90, 1_000);
    expect(hasRestCountdownElapsed(state, 50_000)).toBe(false);
  });

  it('is true exactly at and past the deadline', () => {
    const state = startRestCountdown(90, 1_000);
    expect(hasRestCountdownElapsed(state, 91_000)).toBe(true);
    expect(hasRestCountdownElapsed(state, 200_000)).toBe(true);
  });

  it('is false when not running', () => {
    expect(hasRestCountdownElapsed(initialRestCountdownState, 91_000)).toBe(
      false,
    );
    expect(hasRestCountdownElapsed({ status: 'completed' }, 91_000)).toBe(
      false,
    );
  });
});

describe('completeRestCountdown', () => {
  it('transitions running to completed exactly once', () => {
    const running = startRestCountdown(60, 0);
    const completed = completeRestCountdown(running);
    expect(completed).toEqual({ status: 'completed' });
  });

  it('is a no-op unless running', () => {
    expect(completeRestCountdown(initialRestCountdownState)).toEqual(
      initialRestCountdownState,
    );
    const completed: RestCountdownState = { status: 'completed' };
    expect(completeRestCountdown(completed)).toBe(completed);
    const dismissed: RestCountdownState = { status: 'dismissed' };
    expect(completeRestCountdown(dismissed)).toBe(dismissed);
  });
});

describe('dismissRestCountdown', () => {
  it('dismisses from running', () => {
    const running = startRestCountdown(60, 0);
    expect(dismissRestCountdown(running)).toEqual({ status: 'dismissed' });
  });

  it('dismisses from completed', () => {
    const completed: RestCountdownState = { status: 'completed' };
    expect(dismissRestCountdown(completed)).toEqual({ status: 'dismissed' });
  });

  it('is a no-op from idle', () => {
    expect(dismissRestCountdown(initialRestCountdownState)).toBe(
      initialRestCountdownState,
    );
  });

  it('restarting after dismissal produces a fresh running state', () => {
    const running = startRestCountdown(60, 0);
    const dismissed = dismissRestCountdown(running);
    const restarted = startRestCountdown(90, 10_000);
    expect(dismissed).toEqual({ status: 'dismissed' });
    expect(restarted).toEqual({ deadlineEpochMs: 100_000, status: 'running' });
  });
});

describe('formatRestCountdownRemaining', () => {
  it('formats minutes and seconds as M:SS', () => {
    expect(formatRestCountdownRemaining(90_000)).toBe('1:30');
    expect(formatRestCountdownRemaining(45_000)).toBe('0:45');
    expect(formatRestCountdownRemaining(0)).toBe('0:00');
  });

  it('rounds up so a fractional second remaining is never shown as elapsed', () => {
    expect(formatRestCountdownRemaining(500)).toBe('0:01');
    expect(formatRestCountdownRemaining(60_500)).toBe('1:01');
  });

  it('pads single-digit seconds', () => {
    expect(formatRestCountdownRemaining(65_000)).toBe('1:05');
  });
});
