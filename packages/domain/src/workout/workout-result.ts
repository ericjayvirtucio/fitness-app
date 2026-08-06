import { DomainError } from '../shared/domain-error';
import { Length } from '../shared/measurement/length';
import { Mass } from '../shared/measurement/mass';
import { err, ok, type Result } from '../shared/result';
import { Duration } from './duration';
import type { ExerciseLoggingMode } from './exercise-definition';

export const workoutResultPolicy = Object.freeze({
  maximumDistanceMillimeters: 1_000_000_000,
  maximumDurationSeconds: 604_800,
  maximumRepetitions: 10_000,
  maximumResistanceGrams: 1_000_000,
});

export class RepetitionResult {
  readonly kind = 'repetitions' as const;
  private constructor(readonly repetitions: number) {
    Object.freeze(this);
  }
  static valid(repetitions: number) {
    return new RepetitionResult(repetitions);
  }
}

export class ResistanceRepetitionResult {
  readonly kind = 'resistance-and-repetitions' as const;
  private constructor(
    readonly resistance: Mass,
    readonly repetitions: number,
  ) {
    Object.freeze(this);
  }
  static valid(resistance: Mass, repetitions: number) {
    return new ResistanceRepetitionResult(resistance, repetitions);
  }
}

export class DurationResult {
  readonly kind = 'duration' as const;
  private constructor(readonly duration: Duration) {
    Object.freeze(this);
  }
  static valid(duration: Duration) {
    return new DurationResult(duration);
  }
}

export class DistanceResult {
  readonly kind = 'distance' as const;
  private constructor(readonly distance: Length) {
    Object.freeze(this);
  }
  static valid(distance: Length) {
    return new DistanceResult(distance);
  }
}

export class DistanceDurationResult {
  readonly kind = 'distance-and-duration' as const;
  private constructor(
    readonly distance: Length,
    readonly duration: Duration,
  ) {
    Object.freeze(this);
  }
  static valid(distance: Length, duration: Duration) {
    return new DistanceDurationResult(distance, duration);
  }
}

export type WorkoutResult =
  | RepetitionResult
  | ResistanceRepetitionResult
  | DurationResult
  | DistanceResult
  | DistanceDurationResult;

export function createWorkoutResult(
  input: Readonly<{
    distance?: unknown;
    duration?: unknown;
    loggingMode: ExerciseLoggingMode;
    repetitions?: unknown;
    resistance?: unknown;
  }>,
): Result<WorkoutResult, DomainError> {
  if (
    input.loggingMode === 'repetitions' ||
    input.loggingMode === 'bodyweight-and-repetitions'
  ) {
    const repetitions = validRepetitions(input.repetitions);
    return repetitions.isSuccess
      ? ok(RepetitionResult.valid(repetitions.value))
      : repetitions;
  }
  if (
    input.loggingMode === 'external-load-and-repetitions' ||
    input.loggingMode === 'bodyweight-plus-load-and-repetitions' ||
    input.loggingMode === 'assistance-and-repetitions'
  ) {
    const repetitions = validRepetitions(input.repetitions);
    if (!repetitions.isSuccess) return repetitions;
    const resistance = validResistance(input.resistance);
    return resistance.isSuccess
      ? ok(
          ResistanceRepetitionResult.valid(resistance.value, repetitions.value),
        )
      : resistance;
  }
  if (input.loggingMode === 'duration') {
    const duration = validDuration(input.duration);
    return duration.isSuccess
      ? ok(DurationResult.valid(duration.value))
      : duration;
  }
  if (input.loggingMode === 'distance') {
    const distance = validDistance(input.distance);
    return distance.isSuccess
      ? ok(DistanceResult.valid(distance.value))
      : distance;
  }
  const distance = validDistance(input.distance);
  if (!distance.isSuccess) return distance;
  const duration = validDuration(input.duration);
  return duration.isSuccess
    ? ok(DistanceDurationResult.valid(distance.value, duration.value))
    : duration;
}

export function isWorkoutResult(value: unknown): value is WorkoutResult {
  return (
    value instanceof RepetitionResult ||
    value instanceof ResistanceRepetitionResult ||
    value instanceof DurationResult ||
    value instanceof DistanceResult ||
    value instanceof DistanceDurationResult
  );
}

function validRepetitions(value: unknown): Result<number, DomainError> {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= workoutResultPolicy.maximumRepetitions
    ? ok(value)
    : invalid('repetitions');
}

function validResistance(value: unknown): Result<Mass, DomainError> {
  return value instanceof Mass &&
    value.grams > 0 &&
    value.grams <= workoutResultPolicy.maximumResistanceGrams
    ? ok(value)
    : invalid('resistance');
}

function validDuration(value: unknown): Result<Duration, DomainError> {
  return value instanceof Duration &&
    value.seconds > 0 &&
    value.seconds <= workoutResultPolicy.maximumDurationSeconds
    ? ok(value)
    : invalid('duration');
}

function validDistance(value: unknown): Result<Length, DomainError> {
  return value instanceof Length &&
    value.millimeters > 0 &&
    value.millimeters <= workoutResultPolicy.maximumDistanceMillimeters
    ? ok(value)
    : invalid('distance');
}

function invalid(field: string): Result<never, DomainError> {
  return err(
    DomainError.create(
      'out-of-range',
      `Workout ${field} is out of range.`,
      field,
    ),
  );
}
