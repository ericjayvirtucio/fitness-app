import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
type CalendarDate = Readonly<{ day: number; month: number; year: number }>;

function parseCalendarDate(
  value: unknown,
  field: string,
): Result<CalendarDate, DomainError> {
  if (typeof value !== 'string') {
    return err(
      DomainError.create(
        'invalid-date',
        'A valid calendar date is required.',
        field,
      ),
    );
  }
  const match = isoDatePattern.exec(value);
  if (!match) {
    return err(
      DomainError.create(
        'invalid-date',
        'A valid calendar date is required.',
        field,
      ),
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return err(
      DomainError.create(
        'invalid-date',
        'A valid calendar date is required.',
        field,
      ),
    );
  }
  return ok(Object.freeze({ day, month, year }));
}

export function calculateAge(
  dateOfBirth: unknown,
  asOfDate: unknown,
): Result<number, DomainError> {
  const birthDate = parseCalendarDate(dateOfBirth, 'dateOfBirth');
  if (!birthDate.isSuccess) return birthDate;
  const currentDate = parseCalendarDate(asOfDate, 'asOfDate');
  if (!currentDate.isSuccess) return currentDate;

  const birthdayHasOccurred =
    currentDate.value.month > birthDate.value.month ||
    (currentDate.value.month === birthDate.value.month &&
      currentDate.value.day >= birthDate.value.day);
  const age =
    currentDate.value.year -
    birthDate.value.year -
    (birthdayHasOccurred ? 0 : 1);
  if (age < 0) {
    return err(
      DomainError.create(
        'invalid-date',
        'Date of birth cannot be after the calculation date.',
        'dateOfBirth',
      ),
    );
  }
  return ok(age);
}
