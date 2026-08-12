import type { StorageCompactor } from '../../../application/persistence/storage-compactor';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import {
  EraseLocalDataUseCase,
  type GeneratedExportCleanup,
} from './erase-local-data-use-case';
import { GetLocalDataPresenceUseCase } from './get-local-data-presence-use-case';
import {
  isLocalDataErasureError,
  LocalDataErasureError,
} from './local-data-erasure-error';
import type { LocalDataErasureTransactionContext } from './local-data-erasure-transaction-context';

type Capability =
  | 'bodyWeight'
  | 'exercise'
  | 'goal'
  | 'hydration'
  | 'nutrition'
  | 'planner'
  | 'profile'
  | 'session';

/** Composition order: a referencing capability is erased before its target. */
const erasureOrder: readonly Capability[] = [
  'session',
  'planner',
  'exercise',
  'nutrition',
  'hydration',
  'bodyWeight',
  'goal',
  'profile',
];

type FailureOptions = Readonly<{
  /** An eraser that fails outright, as a disk or lock failure would. */
  failingCapability?: Capability;
  /** An eraser that reports success while its records survive. */
  incompleteCapability?: Capability;
}>;

/**
 * A transaction that really rolls back.
 *
 * The erasers work against a copy of the installation that is only adopted when
 * the callback resolves, which is the property the use case depends on: a
 * failed verification has to leave the installation exactly as it was.
 */
class FakeTransactionRunner implements TransactionRunner<LocalDataErasureTransactionContext> {
  readonly erasedCapabilities: Capability[] = [];

  constructor(
    private stored: ReadonlySet<Capability>,
    private readonly failure: FailureOptions = {},
  ) {}

  async run<TResult>(
    operation: (
      context: LocalDataErasureTransactionContext,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    const working = new Set(this.stored);

    try {
      const result = await operation({
        erasers: erasureOrder.map((capability) => ({
          eraseStoredRecords: () => {
            this.erasedCapabilities.push(capability);
            if (capability === this.failure.failingCapability) {
              return Promise.reject(new Error('disk failure'));
            }
            if (capability !== this.failure.incompleteCapability) {
              working.delete(capability);
            }
            return Promise.resolve();
          },
        })),
        probes: erasureOrder.map((capability) => ({
          hasStoredRecords: () => Promise.resolve(working.has(capability)),
        })),
      });
      this.stored = working;
      return result;
    } catch (error: unknown) {
      // Mirrors SqliteTransactionRunner, which flattens anything thrown inside
      // the callback into one generic persistence error.
      throw toPersistenceError(error, 'transaction-failed');
    }
  }

  get remaining(): readonly Capability[] {
    return [...this.stored].sort();
  }
}

const cleanupSucceeds: GeneratedExportCleanup = {
  execute: () => Promise.resolve(),
};
const compactorSucceeds: StorageCompactor = {
  compact: () => Promise.resolve(),
};

function createUseCase(
  runner: FakeTransactionRunner,
  exportCleanup: GeneratedExportCleanup = cleanupSucceeds,
  compactor: StorageCompactor = compactorSucceeds,
) {
  return new EraseLocalDataUseCase(runner, exportCleanup, compactor);
}

const populated = new Set<Capability>(erasureOrder);

describe('EraseLocalDataUseCase', () => {
  it('succeeds on an installation that stores nothing', async () => {
    const runner = new FakeTransactionRunner(new Set());

    await expect(createUseCase(runner).execute()).resolves.toEqual({
      isCleanupComplete: true,
    });
    expect(runner.remaining).toEqual([]);
  });

  it.each(erasureOrder)(
    'erases an installation holding only %s records',
    async (capability) => {
      const runner = new FakeTransactionRunner(new Set([capability]));

      await createUseCase(runner).execute();

      expect(runner.remaining).toEqual([]);
    },
  );

  it('erases a fully populated installation', async () => {
    const runner = new FakeTransactionRunner(populated);

    await createUseCase(runner).execute();

    expect(runner.remaining).toEqual([]);
  });

  it('erases capabilities in a dependency-safe order', async () => {
    const runner = new FakeTransactionRunner(populated);

    await createUseCase(runner).execute();

    expect(runner.erasedCapabilities).toEqual(erasureOrder);
  });

  it.each(erasureOrder)(
    'rolls the whole deletion back when erasing %s fails',
    async (capability) => {
      const runner = new FakeTransactionRunner(populated, {
        failingCapability: capability,
      });

      await expect(createUseCase(runner).execute()).rejects.toThrow(
        LocalDataErasureError,
      );
      expect(runner.remaining).toEqual([...erasureOrder].sort());
    },
  );

  it('reports a failed deletion without claiming anything changed', async () => {
    const runner = new FakeTransactionRunner(populated, {
      failingCapability: 'nutrition',
    });

    await expect(createUseCase(runner).execute()).rejects.toMatchObject({
      code: 'erase-failed',
      message:
        'Your information could not be deleted. Nothing was changed, so you can try again.',
    });
  });

  it('fails verification rather than committing a partial deletion', async () => {
    const runner = new FakeTransactionRunner(populated, {
      incompleteCapability: 'hydration',
    });

    await expect(createUseCase(runner).execute()).rejects.toMatchObject({
      code: 'verification-failed',
    });
    expect(runner.remaining).toEqual([...erasureOrder].sort());
  });

  it('never lets a database failure reach the message', async () => {
    const runner = new FakeTransactionRunner(populated, {
      failingCapability: 'profile',
    });

    const error = await createUseCase(runner)
      .execute()
      .catch((caught: unknown) => caught);

    expect(isLocalDataErasureError(error)).toBe(true);
    expect((error as Error).message).not.toContain('disk failure');
    expect((error as Error).message).not.toContain('personal_profile');
  });

  it('removes the generated export after the records are gone', async () => {
    const order: string[] = [];
    const runner = new FakeTransactionRunner(populated);
    const exportCleanup: GeneratedExportCleanup = {
      execute: () => {
        order.push(`cleanup after ${runner.remaining.length} remaining`);
        return Promise.resolve();
      },
    };

    await createUseCase(runner, exportCleanup).execute();

    expect(order).toEqual(['cleanup after 0 remaining']);
  });

  it('reports a leftover export file without calling the deletion a failure', async () => {
    const runner = new FakeTransactionRunner(populated);
    const exportCleanup: GeneratedExportCleanup = {
      execute: () =>
        Promise.reject(new Error('/var/mobile/cache is read-only')),
    };

    await expect(
      createUseCase(runner, exportCleanup).execute(),
    ).resolves.toEqual({ isCleanupComplete: false });
    expect(runner.remaining).toEqual([]);
  });

  it('does not attempt cleanup or compaction when nothing was deleted', async () => {
    const exportCleanup = { execute: jest.fn(() => Promise.resolve()) };
    const compactor = { compact: jest.fn(() => Promise.resolve()) };
    const runner = new FakeTransactionRunner(populated, {
      failingCapability: 'session',
    });

    await expect(
      createUseCase(runner, exportCleanup, compactor).execute(),
    ).rejects.toThrow(LocalDataErasureError);
    expect(exportCleanup.execute).not.toHaveBeenCalled();
    expect(compactor.compact).not.toHaveBeenCalled();
  });

  it('compacts storage after a successful deletion', async () => {
    const compactor = { compact: jest.fn(() => Promise.resolve()) };
    const runner = new FakeTransactionRunner(populated);

    await createUseCase(runner, cleanupSucceeds, compactor).execute();

    expect(compactor.compact).toHaveBeenCalledTimes(1);
  });

  it('still reports success when storage could not be compacted', async () => {
    const compactor = {
      compact: () => Promise.reject(new Error('not enough space')),
    };
    const runner = new FakeTransactionRunner(populated);

    await expect(
      createUseCase(runner, cleanupSucceeds, compactor).execute(),
    ).resolves.toEqual({ isCleanupComplete: true });
  });

  it('treats a repeated request on an emptied installation as a valid no-op', async () => {
    const runner = new FakeTransactionRunner(populated);
    const useCase = createUseCase(runner);

    await useCase.execute();

    await expect(useCase.execute()).resolves.toEqual({
      isCleanupComplete: true,
    });
    expect(runner.remaining).toEqual([]);
  });
});

describe('GetLocalDataPresenceUseCase', () => {
  it('reports that an installation holds records', async () => {
    const runner = new FakeTransactionRunner(new Set(['bodyWeight']));

    await expect(
      new GetLocalDataPresenceUseCase(runner).execute(),
    ).resolves.toBe(true);
  });

  it('reports that an installation holds nothing', async () => {
    const runner = new FakeTransactionRunner(new Set());

    await expect(
      new GetLocalDataPresenceUseCase(runner).execute(),
    ).resolves.toBe(false);
  });

  it('reports an unreadable installation safely', async () => {
    const runner: TransactionRunner<LocalDataErasureTransactionContext> = {
      run: () => Promise.reject(new Error('database is locked')),
    };

    await expect(
      new GetLocalDataPresenceUseCase(runner).execute(),
    ).rejects.toMatchObject({
      code: 'storage-unavailable',
      message:
        'This app could not check its local storage, so nothing was deleted.',
    });
  });
});
