import type {
  DomainId,
  HydrationEntry,
  HydrationTarget,
} from '@fitness/domain';
import { CreateHydrationEntryUseCase } from './create-hydration-entry-use-case';
import { DeleteHydrationEntryUseCase } from './delete-hydration-entry-use-case';
import { GetDailyHydrationUseCase } from './get-daily-hydration-use-case';
import { GetHydrationEntryUseCase } from './get-hydration-entry-use-case';
import { GetHydrationTargetUseCase } from './get-hydration-target-use-case';
import type { HydrationEntryRepository } from './hydration-entry-repository';
import type { HydrationTargetRepository } from './hydration-target-repository';
import { SaveHydrationTargetUseCase } from './save-hydration-target-use-case';
import { UpdateHydrationEntryUseCase } from './update-hydration-entry-use-case';

const now = Date.UTC(2026, 7, 4, 4);
const validInput = {
  description: '',
  fluidType: 'plain-water',
  localCalendarDate: '2026-08-04',
  occurredAtEpochMilliseconds: now,
  utcOffsetMinutes: 480,
  volumeMilliliters: '500',
} as const;

class FakeEntryRepository implements HydrationEntryRepository {
  entries: HydrationEntry[] = [];
  delete(id: DomainId): Promise<boolean> {
    const index = this.entries.findIndex((entry) => entry.id.equals(id));
    if (index < 0) return Promise.resolve(false);
    this.entries.splice(index, 1);
    return Promise.resolve(true);
  }
  getById(id: DomainId): Promise<HydrationEntry | null> {
    return Promise.resolve(
      this.entries.find((entry) => entry.id.equals(id)) ?? null,
    );
  }
  insert(entry: HydrationEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
  listByLocalDate(date: string): Promise<readonly HydrationEntry[]> {
    return Promise.resolve(
      this.entries.filter((entry) => entry.localCalendarDate === date),
    );
  }
  update(entry: HydrationEntry): Promise<boolean> {
    const index = this.entries.findIndex((item) => item.id.equals(entry.id));
    if (index < 0) return Promise.resolve(false);
    this.entries[index] = entry;
    return Promise.resolve(true);
  }
}

class FakeTargetRepository implements HydrationTargetRepository {
  target: HydrationTarget | null = null;
  get(): Promise<HydrationTarget | null> {
    return Promise.resolve(this.target);
  }
  save(target: HydrationTarget): Promise<void> {
    this.target = target;
    return Promise.resolve();
  }
}

describe('hydration application use cases', () => {
  it('creates, retrieves, updates, summarizes, and deletes an entry', async () => {
    const entries = new FakeEntryRepository();
    const targets = new FakeTargetRepository();
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const created = await new CreateHydrationEntryUseCase(
      entries,
      () => id,
      () => now,
    ).execute(validInput);
    expect(created.isSuccess).toBe(true);
    await expect(
      new GetHydrationEntryUseCase(entries).execute(id),
    ).resolves.toMatchObject({ fluidType: 'plain-water' });

    const updated = await new UpdateHydrationEntryUseCase(
      entries,
      () => now,
    ).execute(id, { ...validInput, volumeMilliliters: '750' });
    expect(updated.isSuccess).toBe(true);
    const daily = await new GetDailyHydrationUseCase(entries, targets).execute(
      '2026-08-04',
    );
    expect(daily.summary.totalFluidVolume.milliliters).toBe(750);
    expect(daily.summary.targetVolume).toBeNull();

    await expect(
      new DeleteHydrationEntryUseCase(entries).execute(id),
    ).resolves.toBe(true);
    expect(entries.entries).toHaveLength(0);
  });

  it('rejects future and invalid entries without writing', async () => {
    const entries = new FakeEntryRepository();
    const useCase = new CreateHydrationEntryUseCase(
      entries,
      () => '550e8400-e29b-41d4-a716-446655440000',
      () => now - 1,
    );
    expect((await useCase.execute(validInput)).isSuccess).toBe(false);
    expect(
      (await useCase.execute({ ...validInput, volumeMilliliters: '0' }))
        .isSuccess,
    ).toBe(false);
    expect(entries.entries).toHaveLength(0);
  });

  it('returns safe missing outcomes', async () => {
    const entries = new FakeEntryRepository();
    await expect(
      new GetHydrationEntryUseCase(entries).execute('invalid'),
    ).resolves.toBeNull();
    await expect(
      new DeleteHydrationEntryUseCase(entries).execute('invalid'),
    ).resolves.toBe(false);
    const result = await new UpdateHydrationEntryUseCase(
      entries,
      () => now,
    ).execute('550e8400-e29b-41d4-a716-446655440000', validInput);
    expect(result.isSuccess).toBe(false);
  });

  it('saves targets in milliliters or liters and exposes progress', async () => {
    const entries = new FakeEntryRepository();
    const targets = new FakeTargetRepository();
    const save = new SaveHydrationTargetUseCase(targets);
    const saved = await save.execute({ amount: '3', unit: 'liter' });
    expect(saved.isSuccess).toBe(true);
    expect(targets.target?.volume.milliliters).toBe(3_000);
    await expect(
      new GetHydrationTargetUseCase(targets).execute(),
    ).resolves.toBe(targets.target);

    await new CreateHydrationEntryUseCase(
      entries,
      () => '550e8400-e29b-41d4-a716-446655440000',
      () => now,
    ).execute(validInput);
    const daily = await new GetDailyHydrationUseCase(entries, targets).execute(
      '2026-08-04',
    );
    expect(daily.summary.remainingVolume?.milliliters).toBe(2_500);
    expect(daily.summary.completionPercentage).toBeCloseTo(16.6667);
  });

  it('rejects unsupported or out-of-range target input', async () => {
    const targets = new FakeTargetRepository();
    const save = new SaveHydrationTargetUseCase(targets);
    expect((await save.execute({ amount: '3', unit: 'cup' })).isSuccess).toBe(
      false,
    );
    expect(
      (await save.execute({ amount: '21000', unit: 'milliliter' })).isSuccess,
    ).toBe(false);
    expect(targets.target).toBeNull();
  });
});
