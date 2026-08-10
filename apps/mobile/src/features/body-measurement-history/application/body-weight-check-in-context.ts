import type { PersonalProfileRepository } from '../../personal-profile/application/personal-profile-repository';
import type { BodyWeightEntryRepository } from './body-weight-entry-repository';

/**
 * A weight check-in may also update the single current profile weight. Both
 * writes belong to one deliberate user action, so they share one exclusive
 * transaction rather than two independent capability writes that a failure
 * could leave disagreeing.
 */
export type BodyWeightCheckInTransactionContext = Readonly<{
  bodyWeightEntryRepository: BodyWeightEntryRepository;
  personalProfileRepository: PersonalProfileRepository;
}>;
