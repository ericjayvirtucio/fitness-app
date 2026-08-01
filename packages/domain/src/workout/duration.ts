import type { DomainError } from '../shared/domain-error';
import {
  areCanonicalMeasurementsEqual,
  canonicalizeMeasurement,
} from '../shared/measurement/measurement-validation';
import { isErr, ok, type Result } from '../shared/result';

export const durationUnits = Object.freeze([
  'second',
  'minute',
  'hour',
] as const);

export type DurationUnit = (typeof durationUnits)[number];

const secondsPerUnit: Readonly<Record<DurationUnit, number>> = Object.freeze({
  hour: 3_600,
  minute: 60,
  second: 1,
});

export class Duration {
  readonly seconds: number;

  private constructor(seconds: number) {
    this.seconds = seconds;
    Object.freeze(this);
  }

  static create(value: unknown, unit: unknown): Result<Duration, DomainError> {
    const result = canonicalizeMeasurement(value, unit, secondsPerUnit);
    if (isErr(result)) {
      return result;
    }

    return ok(new Duration(result.value));
  }

  equals(other: Duration): boolean {
    return areCanonicalMeasurementsEqual(this.seconds, other.seconds);
  }

  in(unit: DurationUnit): number {
    return this.seconds / secondsPerUnit[unit];
  }
}
