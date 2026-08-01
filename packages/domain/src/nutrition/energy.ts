import type { DomainError } from '../shared/domain-error';
import {
  areCanonicalMeasurementsEqual,
  canonicalizeMeasurement,
} from '../shared/measurement/measurement-validation';
import { isErr, ok, type Result } from '../shared/result';

export const energyUnits = Object.freeze(['kilojoule', 'kilocalorie'] as const);

export type EnergyUnit = (typeof energyUnits)[number];

const kilojoulesPerUnit: Readonly<Record<EnergyUnit, number>> = Object.freeze({
  kilocalorie: 4.184,
  kilojoule: 1,
});

export class Energy {
  readonly kilojoules: number;

  private constructor(kilojoules: number) {
    this.kilojoules = kilojoules;
    Object.freeze(this);
  }

  static create(value: unknown, unit: unknown): Result<Energy, DomainError> {
    const result = canonicalizeMeasurement(value, unit, kilojoulesPerUnit);
    if (isErr(result)) {
      return result;
    }

    return ok(new Energy(result.value));
  }

  equals(other: Energy): boolean {
    return areCanonicalMeasurementsEqual(this.kilojoules, other.kilojoules);
  }

  in(unit: EnergyUnit): number {
    return this.kilojoules / kilojoulesPerUnit[unit];
  }
}
