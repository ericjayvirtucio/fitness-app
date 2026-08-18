import {
  Duration,
  Length,
  Mass,
  createPlannedPrescription,
  createWorkoutResult,
  exerciseLoggingModes,
  type ExerciseLoggingMode,
  type Result,
  type UnitSystem,
} from '@fitness/domain';
import {
  formatDuration,
  formatPlannedWorkoutResult,
  formatWorkoutResult,
} from './workout-result-formatting';

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

/**
 * One recorded set per logging mode, with the same numbers in every mode that
 * carries a given measurement, so a difference in the rendered sentence can
 * only come from the mode itself.
 */
function recordedSet(loggingMode: ExerciseLoggingMode, unitSystem: UnitSystem) {
  return unwrap(
    createWorkoutResult({
      distance: unwrap(
        Length.create(5, unitSystem === 'metric' ? 'kilometer' : 'mile'),
      ),
      duration: unwrap(Duration.create(90, 'second')),
      loggingMode,
      repetitions: 8,
      resistance: unwrap(
        Mass.create(20, unitSystem === 'metric' ? 'kilogram' : 'pound'),
      ),
    }),
  );
}

function plannedTarget(
  loggingMode: ExerciseLoggingMode,
  unitSystem: UnitSystem,
) {
  return unwrap(
    createPlannedPrescription({
      distance: unwrap(
        Length.create(5, unitSystem === 'metric' ? 'kilometer' : 'mile'),
      ),
      duration: unwrap(Duration.create(90, 'second')),
      loggingMode,
      repetitions: 8,
      resistance: unwrap(
        Mass.create(20, unitSystem === 'metric' ? 'kilogram' : 'pound'),
      ),
      sets: 3,
    }),
  );
}

const recordedMetric: Readonly<Record<ExerciseLoggingMode, string>> = {
  'assistance-and-repetitions': 'Assistance 20 kg × 8',
  'bodyweight-and-repetitions': '8 reps',
  'bodyweight-plus-load-and-repetitions': 'Added 20 kg × 8',
  distance: '5 km',
  'distance-and-duration': '5 km in 1 min 30 sec',
  duration: '1 min 30 sec',
  'external-load-and-repetitions': '20 kg × 8',
  repetitions: '8 reps',
};

const recordedImperial: Readonly<Record<ExerciseLoggingMode, string>> = {
  'assistance-and-repetitions': 'Assistance 20 lb × 8',
  'bodyweight-and-repetitions': '8 reps',
  'bodyweight-plus-load-and-repetitions': 'Added 20 lb × 8',
  distance: '5 mi',
  'distance-and-duration': '5 mi in 1 min 30 sec',
  duration: '1 min 30 sec',
  'external-load-and-repetitions': '20 lb × 8',
  repetitions: '8 reps',
};

const plannedMetric: Readonly<Record<ExerciseLoggingMode, string>> = {
  'assistance-and-repetitions': '3 sets · 8 reps · Assistance 20 kg',
  'bodyweight-and-repetitions': '3 sets · 8 reps',
  'bodyweight-plus-load-and-repetitions': '3 sets · 8 reps · Added 20 kg',
  distance: '3 sets · 5 km',
  'distance-and-duration': '3 sets · 1 min 30 sec · 5 km',
  duration: '3 sets · 1 min 30 sec',
  'external-load-and-repetitions': '3 sets · 8 reps · 20 kg',
  repetitions: '3 sets · 8 reps',
};

const plannedImperial: Readonly<Record<ExerciseLoggingMode, string>> = {
  'assistance-and-repetitions': '3 sets · 8 reps · Assistance 20 lb',
  'bodyweight-and-repetitions': '3 sets · 8 reps',
  'bodyweight-plus-load-and-repetitions': '3 sets · 8 reps · Added 20 lb',
  distance: '3 sets · 5 mi',
  'distance-and-duration': '3 sets · 1 min 30 sec · 5 mi',
  duration: '3 sets · 1 min 30 sec',
  'external-load-and-repetitions': '3 sets · 8 reps · 20 lb',
  repetitions: '3 sets · 8 reps',
};

describe('formatWorkoutResult', () => {
  /**
   * Driven by the domain vocabulary rather than a hard-coded list, so a logging
   * mode added to `exerciseLoggingModes` fails here until it is worded.
   */
  it.each(exerciseLoggingModes)('words a recorded %s set in metric', (mode) => {
    expect(
      formatWorkoutResult(recordedSet(mode, 'metric'), 'metric', mode),
    ).toBe(recordedMetric[mode]);
  });

  it.each(exerciseLoggingModes)(
    'words a recorded %s set in imperial',
    (mode) => {
      expect(
        formatWorkoutResult(recordedSet(mode, 'imperial'), 'imperial', mode),
      ).toBe(recordedImperial[mode]);
    },
  );

  it('tells the three modes that share one result variant apart', () => {
    const sharedVariant = [
      'external-load-and-repetitions',
      'bodyweight-plus-load-and-repetitions',
      'assistance-and-repetitions',
    ] as const;
    const sentences = sharedVariant.map((mode) =>
      formatWorkoutResult(recordedSet(mode, 'metric'), 'metric', mode),
    );
    sentences.forEach((sentence) => {
      expect(sentence).toContain('20 kg × 8');
    });
    expect(new Set(sentences).size).toBe(sharedVariant.length);
  });

  it('states nothing false when a mode disagrees with the stored result', () => {
    const repetitionsOnly = recordedSet('repetitions', 'metric');
    expect(
      formatWorkoutResult(
        repetitionsOnly,
        'metric',
        'assistance-and-repetitions',
      ),
    ).toBe('8 reps');
  });

  it('falls back to the unmarked sentence for a mode it does not word', () => {
    const unworded = 'time-under-tension' as ExerciseLoggingMode;
    expect(
      formatWorkoutResult(
        recordedSet('external-load-and-repetitions', 'metric'),
        'metric',
        unworded,
      ),
    ).toBe('20 kg × 8');
  });
});

describe('formatPlannedWorkoutResult', () => {
  it.each(exerciseLoggingModes)(
    'words a planned %s target in metric',
    (mode) => {
      expect(
        formatPlannedWorkoutResult(
          plannedTarget(mode, 'metric'),
          'metric',
          mode,
        ),
      ).toBe(plannedMetric[mode]);
    },
  );

  it.each(exerciseLoggingModes)(
    'words a planned %s target in imperial',
    (mode) => {
      expect(
        formatPlannedWorkoutResult(
          plannedTarget(mode, 'imperial'),
          'imperial',
          mode,
        ),
      ).toBe(plannedImperial[mode]);
    },
  );

  it('renders nothing when an exercise carries no planned target', () => {
    expect(
      formatPlannedWorkoutResult(null, 'metric', 'assistance-and-repetitions'),
    ).toBe('');
  });

  it('omits an absent planned resistance rather than wording a qualifier alone', () => {
    const withoutResistance = unwrap(
      createPlannedPrescription({
        loggingMode: 'assistance-and-repetitions',
        repetitions: 8,
        sets: 3,
      }),
    );
    expect(
      formatPlannedWorkoutResult(
        withoutResistance,
        'metric',
        'assistance-and-repetitions',
      ),
    ).toBe('3 sets · 8 reps');
  });
});

describe('formatDuration', () => {
  it('reads whole hours as hours and minutes', () => {
    expect(formatDuration(3_720)).toBe('1 hr 2 min');
  });

  it('reads under an hour as minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1 min 30 sec');
  });

  it('reads under a minute as seconds', () => {
    expect(formatDuration(45)).toBe('45 sec');
  });
});
