import type { PersonalProfileRepository } from './personal-profile-repository';

export class GetProfileUseCase {
  constructor(private readonly repository: PersonalProfileRepository) {}

  execute() {
    return this.repository.get();
  }
}
