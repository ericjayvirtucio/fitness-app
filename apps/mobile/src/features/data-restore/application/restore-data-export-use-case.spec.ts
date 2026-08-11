import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { isDataRestoreError } from './data-restore-error';
import type { DataRestoreTransactionContext } from './data-restore-transaction-context';
import { GetRestoreTargetUseCase } from './get-restore-target-use-case';
import { parseDataExport } from './parse-data-export';
import { RestoreDataExportUseCase } from './restore-data-export-use-case';
import type { RestoreData } from './restore-data';
import {
  buildExport,
  syntheticToday,
} from './synthetic-data-export.spec-helper';

const unsupported = (): never => {
  throw new Error('the restore called a repository method it should not use');
};

class ScriptedProbe implements StoredDataProbe {
  private index = 0;

  constructor(private readonly answers: readonly boolean[]) {}

  hasStoredRecords(): Promise<boolean> {
    const answer = this.answers[this.index] ?? this.answers.at(-1) ?? false;
    this.index += 1;
    return Promise.resolve(answer);
  }
}

class FakeTransactionRunner implements TransactionRunner<DataRestoreTransactionContext> {
  runCount = 0;

  constructor(private readonly context: DataRestoreTransactionContext) {}

  async run<TResult>(
    operation: (context: DataRestoreTransactionContext) => Promise<TResult>,
  ): Promise<TResult> {
    this.runCount += 1;
    try {
      return await operation(this.context);
    } catch (error: unknown) {
      // The real runner translates before rethrowing, so a use case must not
      // depend on its own error surviving the transaction boundary.
      throw toPersistenceError(error, 'transaction-failed');
    }
  }
}

class UnavailableTransactionRunner implements TransactionRunner<DataRestoreTransactionContext> {
  run<TResult>(): Promise<TResult> {
    return Promise.reject(new Error('database unavailable'));
  }
}

const writeOrder = [
  'profile',
  'goal',
  'nutritionCatalogItem',
  'nutritionEntry',
  'hydrationEntry',
  'hydrationTarget',
  'exercise',
  'plannedWorkout',
  'completedSession',
  'bodyWeightCheckIn',
];

function buildContext(
  calls: string[],
  probes: readonly StoredDataProbe[],
  failOn?: string,
): DataRestoreTransactionContext {
  const write = (name: string) => (): Promise<void> => {
    calls.push(name);
    return name === failOn
      ? Promise.reject(new Error('the write failed'))
      : Promise.resolve();
  };

  return {
    bodyWeight: {
      delete: unsupported,
      getById: unsupported,
      getLatest: unsupported,
      insert: write('bodyWeightCheckIn'),
      listPage: unsupported,
      update: unsupported,
    },
    exerciseCatalog: {
      delete: unsupported,
      findByNormalizedName: unsupported,
      getById: unsupported,
      getByIds: unsupported,
      insert: write('exercise'),
      listAll: unsupported,
      listFavorites: unsupported,
      search: unsupported,
      setFavorite: unsupported,
      update: unsupported,
    },
    goals: { get: unsupported, save: write('goal') },
    hydrationEntries: {
      delete: unsupported,
      getById: unsupported,
      insert: write('hydrationEntry'),
      listByLocalDate: unsupported,
      update: unsupported,
    },
    hydrationTarget: { get: unsupported, save: write('hydrationTarget') },
    nutritionCatalog: {
      delete: unsupported,
      findByNormalizedName: unsupported,
      getById: unsupported,
      insert: write('nutritionCatalogItem'),
      listFavorites: unsupported,
      listRecent: unsupported,
      recordUsage: unsupported,
      search: unsupported,
      setFavorite: unsupported,
      update: unsupported,
    },
    nutritionEntries: {
      delete: unsupported,
      getById: unsupported,
      insert: write('nutritionEntry'),
      listByLocalDate: unsupported,
      update: unsupported,
    },
    planner: {
      deleteByWeekday: unsupported,
      getByWeekday: unsupported,
      getWeeklyWorkouts: unsupported,
      listUsages: unsupported,
      replace: write('plannedWorkout'),
    },
    probes,
    profile: { get: unsupported, save: write('profile') },
    sessions: {
      complete: unsupported,
      discard: unsupported,
      getActive: unsupported,
      getById: unsupported,
      insert: write('completedSession'),
      replace: unsupported,
    },
  };
}

function restoreData(): RestoreData {
  const parsed = parseDataExport(JSON.stringify(buildExport()), syntheticToday);
  if (!parsed.isSuccess) throw new Error('the synthetic export must be valid');
  return parsed.value.data;
}

async function expectFailure(
  work: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(work).rejects.toThrow();
  await work.catch((error: unknown) => {
    expect(isDataRestoreError(error) && error.code).toBe(code);
  });
}

describe('RestoreDataExportUseCase', () => {
  it('writes every capability in a dependency-safe order', async () => {
    const calls: string[] = [];
    const runner = new FakeTransactionRunner(
      buildContext(calls, [new ScriptedProbe([false])]),
    );

    await new RestoreDataExportUseCase(runner).execute(restoreData());

    expect(calls).toEqual(writeOrder);
  });

  it('restores inside a single transaction', async () => {
    const runner = new FakeTransactionRunner(
      buildContext([], [new ScriptedProbe([false])]),
    );

    await new RestoreDataExportUseCase(runner).execute(restoreData());

    expect(runner.runCount).toBe(1);
  });

  it('refuses and writes nothing when the installation already holds data', async () => {
    const calls: string[] = [];
    const runner = new FakeTransactionRunner(
      buildContext(calls, [
        new ScriptedProbe([false]),
        new ScriptedProbe([true]),
      ]),
    );

    await expectFailure(
      new RestoreDataExportUseCase(runner).execute(restoreData()),
      'target-not-empty',
    );
    expect(calls).toEqual([]);
  });

  it('refuses when the target stops being empty after the preview', async () => {
    const calls: string[] = [];
    const probe = new ScriptedProbe([false, true]);
    const runner = new FakeTransactionRunner(buildContext(calls, [probe]));

    await expect(new GetRestoreTargetUseCase(runner).execute()).resolves.toBe(
      true,
    );
    await expectFailure(
      new RestoreDataExportUseCase(runner).execute(restoreData()),
      'target-not-empty',
    );
    expect(calls).toEqual([]);
  });

  it.each(writeOrder)('rolls back when %s fails', async (phase) => {
    const calls: string[] = [];
    const runner = new FakeTransactionRunner(
      buildContext(calls, [new ScriptedProbe([false])], phase),
    );

    await expectFailure(
      new RestoreDataExportUseCase(runner).execute(restoreData()),
      'write-failed',
    );
    expect(calls).toEqual(writeOrder.slice(0, writeOrder.indexOf(phase) + 1));
  });

  it('reports a persistence failure without exposing its cause', async () => {
    const runner = new UnavailableTransactionRunner();

    await expectFailure(
      new RestoreDataExportUseCase(runner).execute(restoreData()),
      'write-failed',
    );
  });
});

describe('GetRestoreTargetUseCase', () => {
  it('reports an empty installation when no capability holds a record', async () => {
    const runner = new FakeTransactionRunner(
      buildContext(
        [],
        [new ScriptedProbe([false]), new ScriptedProbe([false])],
      ),
    );

    await expect(new GetRestoreTargetUseCase(runner).execute()).resolves.toBe(
      true,
    );
  });

  it('reports a populated installation when any capability holds a record', async () => {
    const runner = new FakeTransactionRunner(
      buildContext([], [new ScriptedProbe([false]), new ScriptedProbe([true])]),
    );

    await expect(new GetRestoreTargetUseCase(runner).execute()).resolves.toBe(
      false,
    );
  });

  it('reports a storage failure separately from a restore failure', async () => {
    await expectFailure(
      new GetRestoreTargetUseCase(new UnavailableTransactionRunner()).execute(),
      'storage-unavailable',
    );
  });
});
