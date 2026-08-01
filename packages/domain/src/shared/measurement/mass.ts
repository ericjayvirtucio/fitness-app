import {
  areCanonicalMeasurementsEqual,
  canonicalizeMeasurement,
} from './measurement-validation';
import type { DomainError } from '../domain-error';
import { isErr, ok, type Result } from '../result';

export const massUnits = Object.freeze([
  'milligram',
  'gram',
  'kilogram',
  'ounce',
  'pound',
] as const);

export type MassUnit = (typeof massUnits)[number];

const gramsPerUnit: Readonly<Record<MassUnit, number>> = Object.freeze({
  gram: 1,
  kilogram: 1_000,
  milligram: 0.001,
  ounce: 28.349523125,
  pound: 453.59237,
});

export class Mass {
  readonly grams: number;

  private constructor(grams: number) {
    this.grams = grams;
    Object.freeze(this);
  }

  static create(value: unknown, unit: unknown): Result<Mass, DomainError> {
    const result = canonicalizeMeasurement(value, unit, gramsPerUnit);
    if (isErr(result)) {
      return result;
    }

    return ok(new Mass(result.value));
  }

  equals(other: Mass): boolean {
    return areCanonicalMeasurementsEqual(this.grams, other.grams);
  }

  in(unit: MassUnit): number {
    return this.grams / gramsPerUnit[unit];
  }
}
