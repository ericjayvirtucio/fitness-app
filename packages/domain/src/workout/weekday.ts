import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

export const weekdayValues = Object.freeze([0, 1, 2, 3, 4, 5, 6] as const);
export type WeekdayValue = (typeof weekdayValues)[number];

export class Weekday {
  private constructor(readonly value: WeekdayValue) {
    Object.freeze(this);
  }

  static create(value: unknown): Result<Weekday, DomainError> {
    if (!weekdayValues.some((candidate) => candidate === value)) {
      return err(
        DomainError.create(
          'unsupported-option',
          'Choose a valid day of the week.',
          'weekday',
        ),
      );
    }
    return ok(new Weekday(value as WeekdayValue));
  }

  equals(other: Weekday): boolean {
    return this.value === other.value;
  }
}
