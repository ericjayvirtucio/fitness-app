import { DomainError } from '../shared/domain-error';
import { Volume } from '../shared/measurement/volume';
import { err, ok, type Result } from '../shared/result';

export const hydrationTargetPolicy = Object.freeze({
  maximumVolumeMilliliters: 20_000,
});

export class HydrationTarget {
  private constructor(readonly volume: Volume) {
    Object.freeze(this);
  }

  static create(volume: unknown): Result<HydrationTarget, DomainError> {
    if (!(volume instanceof Volume)) {
      return err(
        DomainError.create(
          'required-field',
          'Daily fluid target is required.',
          'targetVolume',
        ),
      );
    }
    if (
      volume.milliliters <= 0 ||
      volume.milliliters > hydrationTargetPolicy.maximumVolumeMilliliters
    ) {
      return err(
        DomainError.create(
          'out-of-range',
          `Daily fluid target must be greater than 0 and no more than ${hydrationTargetPolicy.maximumVolumeMilliliters} mL.`,
          'targetVolume',
        ),
      );
    }
    return ok(new HydrationTarget(volume));
  }
}
