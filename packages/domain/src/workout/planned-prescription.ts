import { DomainError } from '../shared/domain-error';
import { Length } from '../shared/measurement/length';
import { Mass } from '../shared/measurement/mass';
import { err, ok, type Result } from '../shared/result';
import { Duration } from './duration';
import type { ExerciseLoggingMode } from './exercise-definition';

export const plannedPrescriptionPolicy = Object.freeze({
  maximumDistanceMillimeters: 1_000_000_000,
  maximumDurationSeconds: 604_800,
  maximumRepetitions: 10_000,
  maximumResistanceGrams: 1_000_000,
  maximumSets: 100,
});

export class RepetitionPrescription {
  readonly kind = 'repetitions' as const;
  private constructor(
    readonly sets: number,
    readonly repetitions: number,
  ) {
    Object.freeze(this);
  }
  static valid(sets: number, repetitions: number) {
    return new RepetitionPrescription(sets, repetitions);
  }
}

export class ResistanceRepetitionPrescription {
  readonly kind = 'resistance-and-repetitions' as const;
  private constructor(
    readonly sets: number,
    readonly repetitions: number,
    readonly resistance: Mass | null,
  ) {
    Object.freeze(this);
  }
  static valid(sets: number, repetitions: number, resistance: Mass | null) {
    return new ResistanceRepetitionPrescription(sets, repetitions, resistance);
  }
}

export class DurationPrescription {
  readonly kind = 'duration' as const;
  private constructor(
    readonly sets: number,
    readonly duration: Duration,
  ) {
    Object.freeze(this);
  }
  static valid(sets: number, duration: Duration) {
    return new DurationPrescription(sets, duration);
  }
}

export class DistancePrescription {
  readonly kind = 'distance' as const;
  private constructor(
    readonly sets: number,
    readonly distance: Length,
  ) {
    Object.freeze(this);
  }
  static valid(sets: number, distance: Length) {
    return new DistancePrescription(sets, distance);
  }
}

export class DistanceDurationPrescription {
  readonly kind = 'distance-and-duration' as const;
  private constructor(
    readonly sets: number,
    readonly distance: Length,
    readonly duration: Duration,
  ) {
    Object.freeze(this);
  }
  static valid(sets: number, distance: Length, duration: Duration) {
    return new DistanceDurationPrescription(sets, distance, duration);
  }
}

export type PlannedPrescription =
  | RepetitionPrescription
  | ResistanceRepetitionPrescription
  | DurationPrescription
  | DistancePrescription
  | DistanceDurationPrescription;

export type PlannedPrescriptionInput = Readonly<{
  distance?: unknown;
  duration?: unknown;
  loggingMode: ExerciseLoggingMode;
  repetitions?: unknown;
  resistance?: unknown;
  sets: unknown;
}>;

export function createPlannedPrescription(
  input: PlannedPrescriptionInput,
): Result<PlannedPrescription, DomainError> {
  const sets = positiveInteger(
    input.sets,
    plannedPrescriptionPolicy.maximumSets,
    'sets',
  );
  if (!sets.isSuccess) return sets;

  if (
    input.loggingMode === 'repetitions' ||
    input.loggingMode === 'bodyweight-and-repetitions'
  ) {
    const repetitions = validRepetitions(input.repetitions);
    return repetitions.isSuccess
      ? ok(RepetitionPrescription.valid(sets.value, repetitions.value))
      : repetitions;
  }

  if (
    input.loggingMode === 'external-load-and-repetitions' ||
    input.loggingMode === 'bodyweight-plus-load-and-repetitions' ||
    input.loggingMode === 'assistance-and-repetitions'
  ) {
    const repetitions = validRepetitions(input.repetitions);
    if (!repetitions.isSuccess) return repetitions;
    if (input.resistance !== undefined && input.resistance !== null) {
      if (!(input.resistance instanceof Mass))
        return invalidMeasurement('resistance');
      if (
        input.resistance.grams <= 0 ||
        input.resistance.grams >
          plannedPrescriptionPolicy.maximumResistanceGrams
      )
        return outOfRange('resistance');
    }
    return ok(
      ResistanceRepetitionPrescription.valid(
        sets.value,
        repetitions.value,
        input.resistance instanceof Mass ? input.resistance : null,
      ),
    );
  }

  if (input.loggingMode === 'duration') {
    const duration = validDuration(input.duration);
    return duration.isSuccess
      ? ok(DurationPrescription.valid(sets.value, duration.value))
      : duration;
  }

  if (input.loggingMode === 'distance') {
    const distance = validDistance(input.distance);
    return distance.isSuccess
      ? ok(DistancePrescription.valid(sets.value, distance.value))
      : distance;
  }

  const distance = validDistance(input.distance);
  if (!distance.isSuccess) return distance;
  const duration = validDuration(input.duration);
  return duration.isSuccess
    ? ok(
        DistanceDurationPrescription.valid(
          sets.value,
          distance.value,
          duration.value,
        ),
      )
    : duration;
}

export function isPlannedPrescription(
  value: unknown,
): value is PlannedPrescription {
  return (
    value instanceof RepetitionPrescription ||
    value instanceof ResistanceRepetitionPrescription ||
    value instanceof DurationPrescription ||
    value instanceof DistancePrescription ||
    value instanceof DistanceDurationPrescription
  );
}

function validRepetitions(value: unknown) {
  return positiveInteger(
    value,
    plannedPrescriptionPolicy.maximumRepetitions,
    'repetitions',
  );
}

function positiveInteger(value: unknown, maximum: number, field: string) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= maximum
    ? ok(value)
    : outOfRange(field);
}

function validDuration(value: unknown): Result<Duration, DomainError> {
  if (!(value instanceof Duration)) return invalidMeasurement('duration');
  return value.seconds > 0 &&
    value.seconds <= plannedPrescriptionPolicy.maximumDurationSeconds
    ? ok(value)
    : outOfRange('duration');
}

function validDistance(value: unknown): Result<Length, DomainError> {
  if (!(value instanceof Length)) return invalidMeasurement('distance');
  return value.millimeters > 0 &&
    value.millimeters <= plannedPrescriptionPolicy.maximumDistanceMillimeters
    ? ok(value)
    : outOfRange('distance');
}

function invalidMeasurement(field: string): Result<never, DomainError> {
  return err(
    DomainError.create('invalid-number', `Planned ${field} is invalid.`, field),
  );
}

function outOfRange(field: string): Result<never, DomainError> {
  return err(
    DomainError.create(
      'out-of-range',
      `Planned ${field} is out of range.`,
      field,
    ),
  );
}
