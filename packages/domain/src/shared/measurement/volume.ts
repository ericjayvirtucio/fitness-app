import {
  areCanonicalMeasurementsEqual,
  canonicalizeMeasurement,
} from './measurement-validation';
import type { DomainError } from '../domain-error';
import { isErr, ok, type Result } from '../result';

export const volumeUnits = Object.freeze([
  'milliliter',
  'liter',
  'us-fluid-ounce',
] as const);

export type VolumeUnit = (typeof volumeUnits)[number];

const millilitersPerUnit: Readonly<Record<VolumeUnit, number>> = Object.freeze({
  liter: 1_000,
  milliliter: 1,
  'us-fluid-ounce': 29.5735295625,
});

export class Volume {
  readonly milliliters: number;

  private constructor(milliliters: number) {
    this.milliliters = milliliters;
    Object.freeze(this);
  }

  static create(value: unknown, unit: unknown): Result<Volume, DomainError> {
    const result = canonicalizeMeasurement(value, unit, millilitersPerUnit);
    if (isErr(result)) {
      return result;
    }

    return ok(new Volume(result.value));
  }

  equals(other: Volume): boolean {
    return areCanonicalMeasurementsEqual(this.milliliters, other.milliliters);
  }

  in(unit: VolumeUnit): number {
    return this.milliliters / millilitersPerUnit[unit];
  }
}
