import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppButton, AppText, Card, spacing } from '../../../design-system';
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
  type RestCountdownDurationSeconds,
  type RestCountdownState,
} from './rest-countdown';

const tickIntervalMs = 250;
const stopLabel = 'Stop rest timer';

/**
 * A foreground-only rest countdown. See Specification 0045.
 *
 * Holds no session or repository reference — only its own state — so it
 * cannot read or write anything about a recorded set. Rendered by
 * `WorkoutSessionScreen` only after a set has already saved successfully.
 */
export function RestCountdown() {
  const [state, setState] = useState<RestCountdownState>(
    initialRestCountdownState,
  );
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());

  // Ticking updates displayed remaining time; completion is derived from the
  // fixed deadline each tick, not from how many ticks have run, so a delayed
  // or skipped tick still reports true elapsed time instead of drifting.
  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const interval = setInterval(() => {
      const now = Date.now();
      setNowEpochMs(now);
      setState((current) =>
        hasRestCountdownElapsed(current, now)
          ? completeRestCountdown(current)
          : current,
      );
    }, tickIntervalMs);
    return () => clearInterval(interval);
  }, [state.status]);

  const start = (duration: RestCountdownDurationSeconds) => {
    const now = Date.now();
    setNowEpochMs(now);
    setState(startRestCountdown(duration, now));
  };
  const stop = () => setState((current) => dismissRestCountdown(current));

  return (
    <Card
      style={{ gap: spacing.sm }}
      testID="rest-countdown"
      variant="outlined"
    >
      <AppText accessibilityRole="header" variant="heading">
        Rest
      </AppText>
      {state.status === 'running' ? (
        <View style={{ gap: spacing.sm }}>
          <AppText isSingleLine variant="hero">
            {formatRestCountdownRemaining(
              remainingRestMilliseconds(state, nowEpochMs),
            )}
          </AppText>
          <AppButton
            accessibilityLabel={stopLabel}
            label="Stop"
            onPress={stop}
            variant="outline"
          />
        </View>
      ) : state.status === 'completed' ? (
        <View style={{ gap: spacing.sm }}>
          <AppText accessibilityLiveRegion="polite">Rest complete</AppText>
          <AppButton
            accessibilityLabel={stopLabel}
            label="Dismiss"
            onPress={stop}
            variant="outline"
          />
        </View>
      ) : (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
        >
          {restCountdownPresetDurationsSeconds.map((duration) => (
            <AppButton
              accessibilityLabel={`Start rest timer, ${duration} seconds`}
              key={duration}
              label={formatRestCountdownRemaining(duration * 1000)}
              onPress={() => start(duration)}
              variant={
                duration === defaultRestCountdownDurationSeconds
                  ? 'primary'
                  : 'outline'
              }
            />
          ))}
        </View>
      )}
    </Card>
  );
}
