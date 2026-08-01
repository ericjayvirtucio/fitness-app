import { DomainError } from '../domain-error';
import { err, ok, type Result } from '../result';

export function canonicalizeMeasurement(
  value: unknown,
  unit: unknown,
  factors: Readonly<Record<string, number>>,
): Result<number, DomainError> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return err(
      DomainError.create(
        'invalid-number',
        'Measurement must be a finite number.',
        'value',
      ),
    );
  }

  if (value < 0) {
    return err(
      DomainError.create(
        'negative-measurement',
        'Measurement cannot be negative.',
        'value',
      ),
    );
  }

  if (typeof unit !== 'string' || !Object.hasOwn(factors, unit)) {
    return err(
      DomainError.create(
        'unsupported-unit',
        'Measurement unit is not supported.',
        'unit',
      ),
    );
  }

  const factor = factors[unit];
  if (factor === undefined) {
    return err(
      DomainError.create(
        'unsupported-unit',
        'Measurement unit is not supported.',
        'unit',
      ),
    );
  }
  const canonicalValue = value * factor;

  if (!Number.isFinite(canonicalValue) || (value > 0 && canonicalValue === 0)) {
    return err(
      DomainError.create(
        'invalid-number',
        'Measurement is outside the supported numeric range.',
        'value',
      ),
    );
  }

  return ok(Object.is(canonicalValue, -0) ? 0 : canonicalValue);
}

export function areCanonicalMeasurementsEqual(
  first: number,
  second: number,
): boolean {
  if (first === second) {
    return true;
  }

  const scale = Math.max(Math.abs(first), Math.abs(second));
  return Math.abs(first - second) <= Number.EPSILON * scale * 4;
}
