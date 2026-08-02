export { DomainError, domainErrorCodes } from './shared/domain-error';
export type { DomainErrorCode } from './shared/domain-error';
export { DomainId } from './shared/domain-id';
export { isErr, isOk, err, ok } from './shared/result';
export type { Result } from './shared/result';

export {
  activityLevels,
  biologicalSexes,
  unitSystems,
} from './personal-profile/profile-options';
export type {
  ActivityLevel,
  BiologicalSex,
  UnitSystem,
} from './personal-profile/profile-options';
export { profileLimits, UserProfile } from './personal-profile/user-profile';
export type {
  UserProfileInput,
  UserProfileValidationErrors,
} from './personal-profile/user-profile';

export { Length, lengthUnits } from './shared/measurement/length';
export type { LengthUnit } from './shared/measurement/length';
export { Mass, massUnits } from './shared/measurement/mass';
export type { MassUnit } from './shared/measurement/mass';
export { Volume, volumeUnits } from './shared/measurement/volume';
export type { VolumeUnit } from './shared/measurement/volume';

export { Energy, energyUnits } from './nutrition/energy';
export type { EnergyUnit } from './nutrition/energy';
export { Duration, durationUnits } from './workout/duration';
export type { DurationUnit } from './workout/duration';
