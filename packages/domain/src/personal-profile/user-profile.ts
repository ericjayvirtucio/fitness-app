import { DomainError } from '../shared/domain-error';
import { Length } from '../shared/measurement/length';
import { Mass } from '../shared/measurement/mass';
import { err, isErr, ok, type Result } from '../shared/result';
import {
  activityLevels,
  biologicalSexes,
  unitSystems,
  type ActivityLevel,
  type BiologicalSex,
  type UnitSystem,
} from './profile-options';

export const profileLimits = Object.freeze({
  heightMillimeters: Object.freeze({ maximum: 3_000, minimum: 500 }),
  weightGrams: Object.freeze({ maximum: 500_000, minimum: 2_000 }),
});

export type UserProfileInput = Readonly<{
  activityLevel: unknown;
  biologicalSex: unknown;
  dateOfBirth: unknown;
  heightMillimeters: unknown;
  preferredUnitSystem: unknown;
  weightGrams: unknown;
}>;

export type UserProfileValidationErrors = readonly DomainError[];

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isSupportedOption<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

function validateDate(
  value: unknown,
  currentDate: string,
): Result<string, DomainError> {
  if (typeof value !== 'string' || value.length === 0) {
    return err(
      DomainError.create(
        'required-field',
        'Date of birth is required.',
        'dateOfBirth',
      ),
    );
  }

  const match = isoDatePattern.exec(value);
  if (!match) {
    return err(
      DomainError.create(
        'invalid-date',
        'Enter date of birth as YYYY-MM-DD.',
        'dateOfBirth',
      ),
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isRealDate) {
    return err(
      DomainError.create(
        'invalid-date',
        'Enter a valid date of birth.',
        'dateOfBirth',
      ),
    );
  }

  if (value > currentDate) {
    return err(
      DomainError.create(
        'invalid-date',
        'Date of birth cannot be in the future.',
        'dateOfBirth',
      ),
    );
  }

  return ok(value);
}

export class UserProfile {
  private constructor(
    readonly height: Length,
    readonly weight: Mass,
    readonly biologicalSex: BiologicalSex,
    readonly dateOfBirth: string,
    readonly activityLevel: ActivityLevel,
    readonly preferredUnitSystem: UnitSystem,
  ) {
    Object.freeze(this);
  }

  static create(
    input: UserProfileInput,
    currentDate: string,
  ): Result<UserProfile, UserProfileValidationErrors> {
    const errors: DomainError[] = [];
    const height = Length.create(input.heightMillimeters, 'millimeter');
    const weight = Mass.create(input.weightGrams, 'gram');
    const dateOfBirth = validateDate(input.dateOfBirth, currentDate);

    if (isErr(height)) {
      errors.push(
        DomainError.create(
          height.error.code,
          'Enter a valid height.',
          'height',
        ),
      );
    } else if (
      height.value.millimeters < profileLimits.heightMillimeters.minimum ||
      height.value.millimeters > profileLimits.heightMillimeters.maximum
    ) {
      errors.push(
        DomainError.create(
          'out-of-range',
          'Height must be between 50 and 300 centimeters.',
          'height',
        ),
      );
    }

    if (isErr(weight)) {
      errors.push(
        DomainError.create(
          weight.error.code,
          'Enter a valid weight.',
          'weight',
        ),
      );
    } else if (
      weight.value.grams < profileLimits.weightGrams.minimum ||
      weight.value.grams > profileLimits.weightGrams.maximum
    ) {
      errors.push(
        DomainError.create(
          'out-of-range',
          'Weight must be between 2 and 500 kilograms.',
          'weight',
        ),
      );
    }

    if (isErr(dateOfBirth)) errors.push(dateOfBirth.error);

    if (!isSupportedOption(input.biologicalSex, biologicalSexes)) {
      errors.push(
        DomainError.create(
          'unsupported-option',
          'Choose a supported biological sex option.',
          'biologicalSex',
        ),
      );
    }

    if (!isSupportedOption(input.activityLevel, activityLevels)) {
      errors.push(
        DomainError.create(
          'unsupported-option',
          'Choose a supported activity level.',
          'activityLevel',
        ),
      );
    }

    if (!isSupportedOption(input.preferredUnitSystem, unitSystems)) {
      errors.push(
        DomainError.create(
          'unsupported-option',
          'Choose metric or imperial units.',
          'preferredUnitSystem',
        ),
      );
    }

    if (errors.length > 0) return err(Object.freeze(errors));

    if (
      isErr(height) ||
      isErr(weight) ||
      isErr(dateOfBirth) ||
      !isSupportedOption(input.biologicalSex, biologicalSexes) ||
      !isSupportedOption(input.activityLevel, activityLevels) ||
      !isSupportedOption(input.preferredUnitSystem, unitSystems)
    ) {
      throw new Error('Profile validation did not collect an invalid field.');
    }

    return ok(
      new UserProfile(
        height.value,
        weight.value,
        input.biologicalSex,
        dateOfBirth.value,
        input.activityLevel,
        input.preferredUnitSystem,
      ),
    );
  }
}
