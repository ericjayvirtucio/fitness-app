import { Energy } from '../nutrition/energy';
import type {
  ActivityLevel,
  BiologicalSex,
} from '../personal-profile/profile-options';
import { DomainError } from '../shared/domain-error';
import type { Length } from '../shared/measurement/length';
import type { Mass } from '../shared/measurement/mass';
import { err, isErr, ok, type Result } from '../shared/result';

export const energyCalculationAgeRange = Object.freeze({
  maximum: 78,
  minimum: 20,
});
export const activityMultipliers: Readonly<Record<ActivityLevel, number>> =
  Object.freeze({
    'extremely-active': 2.2,
    'lightly-active': 1.4,
    'moderately-active': 1.6,
    sedentary: 1.2,
    'very-active': 1.9,
  });

export type RestingEnergyInput = Readonly<{
  age: unknown;
  biologicalSex: unknown;
  height: Length;
  weight: Mass;
}>;

export function estimateRestingEnergy(
  input: RestingEnergyInput,
): Result<Energy, DomainError> {
  if (
    typeof input.age !== 'number' ||
    !Number.isInteger(input.age) ||
    input.age < energyCalculationAgeRange.minimum ||
    input.age > energyCalculationAgeRange.maximum
  ) {
    return err(
      DomainError.create(
        'out-of-range',
        'Resting energy is supported for adults aged 20 to 78.',
        'age',
      ),
    );
  }
  if (input.biologicalSex !== 'female' && input.biologicalSex !== 'male') {
    return err(
      DomainError.create(
        'unsupported-option',
        'The selected profile option is not supported by this energy equation.',
        'biologicalSex',
      ),
    );
  }

  const sexConstant: Readonly<
    Record<Extract<BiologicalSex, 'female' | 'male'>, number>
  > = {
    female: -161,
    male: 5,
  };
  const kilocalories =
    10 * input.weight.in('kilogram') +
    6.25 * input.height.in('centimeter') -
    5 * input.age +
    sexConstant[input.biologicalSex];
  const energy = Energy.create(kilocalories, 'kilocalorie');
  return isErr(energy) ? energy : ok(energy.value);
}

export function estimateMaintenanceEnergy(
  restingEnergy: Energy,
  activityLevel: unknown,
): Result<Energy, DomainError> {
  if (
    typeof activityLevel !== 'string' ||
    !Object.hasOwn(activityMultipliers, activityLevel)
  ) {
    return err(
      DomainError.create(
        'unsupported-option',
        'The selected activity level is not supported.',
        'activityLevel',
      ),
    );
  }
  const multiplier = activityMultipliers[activityLevel as ActivityLevel];
  const energy = Energy.create(
    restingEnergy.in('kilocalorie') * multiplier,
    'kilocalorie',
  );
  return isErr(energy) ? energy : ok(energy.value);
}
