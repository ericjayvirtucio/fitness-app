import type { UserProfile } from '@fitness/domain';

export interface PersonalProfileRepository {
  get(): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
}

export type PersonalProfileTransactionContext = Readonly<{
  personalProfileRepository: PersonalProfileRepository;
}>;
