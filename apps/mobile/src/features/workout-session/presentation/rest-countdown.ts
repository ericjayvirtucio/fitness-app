/**
 * Foreground-only rest countdown: a pure state machine plus deadline-derived
 * time calculation. See Specification 0045. Remaining time is always derived
 * from a fixed deadline and the current time, never accumulated from ticks,
 * so a delayed or skipped tick still reports true elapsed time instead of
 * compounding drift.
 */

export type RestCountdownDurationSeconds = 60 | 90 | 120 | 180;

export const restCountdownPresetDurationsSeconds: readonly RestCountdownDurationSeconds[] =
  Object.freeze([60, 90, 120, 180]);

export const defaultRestCountdownDurationSeconds: RestCountdownDurationSeconds = 90;

export type RestCountdownState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ deadlineEpochMs: number; status: 'running' }>
  | Readonly<{ status: 'completed' }>
  | Readonly<{ status: 'dismissed' }>;

export const initialRestCountdownState: RestCountdownState = Object.freeze({
  status: 'idle',
});

export function startRestCountdown(
  durationSeconds: RestCountdownDurationSeconds,
  nowEpochMs: number,
): RestCountdownState {
  return {
    deadlineEpochMs: nowEpochMs + durationSeconds * 1000,
    status: 'running',
  };
}

/** No-op unless the countdown is running, so a stale or duplicate completion is safely ignored. */
export function completeRestCountdown(
  state: RestCountdownState,
): RestCountdownState {
  return state.status === 'running' ? { status: 'completed' } : state;
}

/** No-op from `idle`, so dismissing before a countdown ever started changes nothing. */
export function dismissRestCountdown(
  state: RestCountdownState,
): RestCountdownState {
  return state.status === 'running' || state.status === 'completed'
    ? { status: 'dismissed' }
    : state;
}

export function remainingRestMilliseconds(
  state: RestCountdownState,
  nowEpochMs: number,
): number {
  return state.status === 'running'
    ? Math.max(0, state.deadlineEpochMs - nowEpochMs)
    : 0;
}

export function hasRestCountdownElapsed(
  state: RestCountdownState,
  nowEpochMs: number,
): boolean {
  return (
    state.status === 'running' &&
    remainingRestMilliseconds(state, nowEpochMs) === 0
  );
}

/** `M:SS`, e.g. `1:30`, `0:45`, `0:00`. Rounds up so a whole second remaining never displays as elapsed. */
export function formatRestCountdownRemaining(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
