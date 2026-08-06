import {
  areCanonicalMeasurementsEqual,
  canonicalizeMeasurement,
} from './measurement-validation';
import type { DomainError } from '../domain-error';
import { isErr, ok, type Result } from '../result';

export const lengthUnits = Object.freeze([
  'millimeter',
  'centimeter',
  'meter',
  'kilometer',
  'inch',
  'foot',
  'mile',
] as const);

export type LengthUnit = (typeof lengthUnits)[number];

const millimetersPerUnit: Readonly<Record<LengthUnit, number>> = Object.freeze({
  centimeter: 10,
  foot: 304.8,
  inch: 25.4,
  kilometer: 1_000_000,
  meter: 1_000,
  mile: 1_609_344,
  millimeter: 1,
});

export class Length {
  readonly millimeters: number;

  private constructor(millimeters: number) {
    this.millimeters = millimeters;
    Object.freeze(this);
  }

  static create(value: unknown, unit: unknown): Result<Length, DomainError> {
    const result = canonicalizeMeasurement(value, unit, millimetersPerUnit);
    if (isErr(result)) {
      return result;
    }

    return ok(new Length(result.value));
  }

  equals(other: Length): boolean {
    return areCanonicalMeasurementsEqual(this.millimeters, other.millimeters);
  }

  in(unit: LengthUnit): number {
    return this.millimeters / millimetersPerUnit[unit];
  }
}
