import { DomainError, DomainId, err, isErr } from '@fitness/domain';
import type { BodyWeightEntryRepository } from './body-weight-entry-repository';
import {
  bodyWeightHistoryPagePolicy,
  type BodyWeightHistoryPage,
  type BodyWeightHistoryPageQuery,
} from './body-weight-history-models';
import {
  buildBodyWeightEntry,
  type SaveBodyWeightEntryInput,
  type SaveBodyWeightEntryResult,
} from './build-body-weight-entry';

export class GetBodyWeightEntryUseCase {
  constructor(private readonly repository: BodyWeightEntryRepository) {}

  execute(idValue: unknown) {
    const id = DomainId.create(idValue);
    return isErr(id)
      ? Promise.resolve(null)
      : this.repository.getById(id.value);
  }
}

export class ListBodyWeightHistoryUseCase {
  constructor(private readonly repository: BodyWeightEntryRepository) {}

  execute(
    query: BodyWeightHistoryPageQuery = {},
  ): Promise<BodyWeightHistoryPage> {
    return this.repository.listPage({
      ...query,
      limit: normalizeLimit(query.limit),
    });
  }
}

/**
 * Editing a check-in never writes the current profile weight. Correcting a
 * mistyped historical value must not silently change Goals & Energy inputs.
 */
export class UpdateBodyWeightEntryUseCase {
  constructor(
    private readonly repository: BodyWeightEntryRepository,
    private readonly getCurrentTime: () => number,
  ) {}

  async execute(
    id: unknown,
    input: SaveBodyWeightEntryInput,
  ): Promise<SaveBodyWeightEntryResult> {
    const result = buildBodyWeightEntry(id, input, this.getCurrentTime());
    if (!result.isSuccess) return result;
    return (await this.repository.update(result.value))
      ? result
      : err(
          Object.freeze([
            DomainError.create(
              'invalid-identifier',
              'Weight check-in no longer exists.',
              'id',
            ),
          ]),
        );
  }
}

export class DeleteBodyWeightEntryUseCase {
  constructor(private readonly repository: BodyWeightEntryRepository) {}

  execute(idValue: unknown): Promise<boolean> {
    const id = DomainId.create(idValue);
    return isErr(id)
      ? Promise.resolve(false)
      : this.repository.delete(id.value);
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit) || limit < 1)
    return bodyWeightHistoryPagePolicy.defaultLimit;
  return Math.min(limit, bodyWeightHistoryPagePolicy.maximumLimit);
}
