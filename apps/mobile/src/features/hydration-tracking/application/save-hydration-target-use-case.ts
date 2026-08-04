import {
  DomainError,
  HydrationTarget,
  Volume,
  err,
  isErr,
  type Result,
} from '@fitness/domain';
import type { HydrationTargetRepository } from './hydration-target-repository';

export type SaveHydrationTargetInput = Readonly<{
  amount: unknown;
  unit: unknown;
}>;

export class SaveHydrationTargetUseCase {
  constructor(private readonly repository: HydrationTargetRepository) {}

  async execute(
    input: SaveHydrationTargetInput,
  ): Promise<Result<HydrationTarget, readonly DomainError[]>> {
    const amount = parseNumber(input.amount);
    const volume = Volume.create(amount, input.unit);
    if (isErr(volume)) {
      return err(
        Object.freeze([
          DomainError.create(volume.error.code, volume.error.message, 'amount'),
        ]),
      );
    }
    const target = HydrationTarget.create(volume.value);
    if (isErr(target)) return err(Object.freeze([target.error]));
    await this.repository.save(target.value);
    return target;
  }
}

function parseNumber(value: unknown): number {
  return typeof value === 'string' && value.trim() !== ''
    ? Number(value.trim())
    : typeof value === 'number'
      ? value
      : Number.NaN;
}
