import type { StorageCompactor } from '../../../application/persistence/storage-compactor';
import type { StoredDataEraser } from '../../../application/persistence/stored-data-eraser';
import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { parseDataExport } from '../../data-restore/application/parse-data-export';
import type { RestoreData } from '../../data-restore/application/restore-data';
import {
  buildRestoreTransactionContext,
  restoreWriteOrder,
  ScriptedProbe,
} from '../../data-restore/application/restore-transaction-context.spec-helper';
import {
  buildEmptyExport,
  buildExport,
  syntheticToday,
} from '../../data-restore/application/synthetic-data-export.spec-helper';
import type { CapabilityPresenceProbes } from './capability-presence';
import { isLocalDataReplacementError } from './local-data-replacement-error';
import type { LocalDataReplacementTransactionContext } from './local-data-replacement-transaction-context';
import { ReplaceLocalDataUseCase } from './replace-local-data-use-case';

const eraserOrder = [
  'workoutSession',
  'workoutPlanner',
  'exerciseCatalog',
  'nutrition',
  'hydration',
  'bodyWeight',
  'goal',
  'personalProfile',
];

class RecordingEraser implements StoredDataEraser {
  constructor(
    private readonly name: string,
    private readonly calls: string[],
    private readonly failing?: string,
  ) {}

  eraseStoredRecords(): Promise<void> {
    this.calls.push(this.name);
    return this.name === this.failing
      ? Promise.reject(new Error('the deletion failed'))
      : Promise.resolve();
  }
}

class FakeTransactionRunner implements TransactionRunner<LocalDataReplacementTransactionContext> {
  runCount = 0;

  constructor(
    private readonly context: LocalDataReplacementTransactionContext,
  ) {}

  async run<TResult>(
    operation: (
      context: LocalDataReplacementTransactionContext,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    this.runCount += 1;
    try {
      return await operation(this.context);
    } catch (error: unknown) {
      // The real runner translates before rethrowing, so the use case must not
      // depend on its own error surviving the transaction boundary.
      throw toPersistenceError(error, 'transaction-failed');
    }
  }
}

class UnavailableTransactionRunner implements TransactionRunner<LocalDataReplacementTransactionContext> {
  run<TResult>(): Promise<TResult> {
    return Promise.reject(new Error('database unavailable'));
  }
}

const silentCompactor: StorageCompactor = { compact: () => Promise.resolve() };

/**
 * Presence answers are scripted per capability, and are read only by the
 * verification that runs after the writes. The emptiness gate that runs between
 * erasure and the writes uses the shared probe list on `target`, so nothing
 * here is consumed before the replacement has been written.
 */
function buildPresence(
  answers: Partial<Record<keyof CapabilityPresenceProbes, readonly boolean[]>>,
  fallback: readonly boolean[],
): CapabilityPresenceProbes {
  const probe = (name: keyof CapabilityPresenceProbes): StoredDataProbe =>
    new ScriptedProbe(answers[name] ?? fallback);

  return {
    bodyWeight: probe('bodyWeight'),
    exerciseCatalog: probe('exerciseCatalog'),
    goal: probe('goal'),
    hydration: probe('hydration'),
    nutrition: probe('nutrition'),
    personalProfile: probe('personalProfile'),
    workoutPlanner: probe('workoutPlanner'),
    workoutSession: probe('workoutSession'),
  };
}

type ContextOptions = Readonly<{
  erasureCalls?: string[];
  failingEraser?: string;
  failingWrite?: string;
  presence?: CapabilityPresenceProbes;
  /** The shared emptiness gate the erasers must satisfy before any write. */
  remainsPopulated?: boolean;
  writeCalls?: string[];
}>;

function buildContext(
  options: ContextOptions = {},
): LocalDataReplacementTransactionContext {
  const erasureCalls = options.erasureCalls ?? [];
  const writeCalls = options.writeCalls ?? [];

  return {
    erasers: eraserOrder.map(
      (name) => new RecordingEraser(name, erasureCalls, options.failingEraser),
    ),
    presence: options.presence ?? buildPresence({}, [true]),
    target: buildRestoreTransactionContext(
      writeCalls,
      [new ScriptedProbe([options.remainsPopulated ?? false])],
      options.failingWrite,
    ),
  };
}

function restoreData(isEmpty = false): RestoreData {
  const document = isEmpty ? buildEmptyExport() : buildExport();
  const parsed = parseDataExport(JSON.stringify(document), syntheticToday);
  if (!parsed.isSuccess) throw new Error('the synthetic export must be valid');
  return parsed.value.data;
}

async function expectFailure(
  work: Promise<unknown>,
  code: string,
): Promise<void> {
  await expect(work).rejects.toThrow();
  await work.catch((error: unknown) => {
    expect(isLocalDataReplacementError(error) && error.code).toBe(code);
  });
}

describe('ReplaceLocalDataUseCase', () => {
  it('erases every capability before writing anything', async () => {
    const order: string[] = [];
    const runner = new FakeTransactionRunner(
      buildContext({ erasureCalls: order, writeCalls: order }),
    );

    await new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
      restoreData(),
    );

    expect(order).toEqual([...eraserOrder, ...restoreWriteOrder]);
  });

  it('erases capabilities children first', async () => {
    const erasureCalls: string[] = [];
    const runner = new FakeTransactionRunner(buildContext({ erasureCalls }));

    await new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
      restoreData(),
    );

    expect(erasureCalls).toEqual(eraserOrder);
  });

  it('replaces inside a single transaction', async () => {
    const runner = new FakeTransactionRunner(buildContext());

    await new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
      restoreData(),
    );

    expect(runner.runCount).toBe(1);
  });

  it('replaces a populated installation with an empty export', async () => {
    const writeCalls: string[] = [];
    const runner = new FakeTransactionRunner(
      buildContext({ presence: buildPresence({}, [false]), writeCalls }),
    );

    await new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
      restoreData(true),
    );

    expect(writeCalls).toEqual([]);
  });

  it.each(eraserOrder)(
    'preserves the previous dataset when the %s eraser fails',
    async (capability) => {
      const writeCalls: string[] = [];
      const runner = new FakeTransactionRunner(
        buildContext({ failingEraser: capability, writeCalls }),
      );

      await expectFailure(
        new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
          restoreData(),
        ),
        'replace-failed',
      );
      expect(writeCalls).toEqual([]);
    },
  );

  it('writes nothing when a capability still holds records after erasure', async () => {
    const writeCalls: string[] = [];
    const runner = new FakeTransactionRunner(
      buildContext({ remainsPopulated: true, writeCalls }),
    );

    await expectFailure(
      new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
        restoreData(),
      ),
      'verification-failed',
    );
    expect(writeCalls).toEqual([]);
  });

  it.each(restoreWriteOrder)(
    'preserves the previous dataset when the %s write fails',
    async (phase) => {
      const writeCalls: string[] = [];
      const runner = new FakeTransactionRunner(
        buildContext({ failingWrite: phase, writeCalls }),
      );

      await expectFailure(
        new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
          restoreData(),
        ),
        'replace-failed',
      );
      expect(writeCalls).toEqual(
        restoreWriteOrder.slice(0, restoreWriteOrder.indexOf(phase) + 1),
      );
    },
  );

  it('fails when a capability the export populates reports nothing afterwards', async () => {
    const runner = new FakeTransactionRunner(
      buildContext({
        presence: buildPresence({ bodyWeight: [false] }, [true]),
      }),
    );

    await expectFailure(
      new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
        restoreData(),
      ),
      'verification-failed',
    );
  });

  it('fails when a capability the export leaves empty reports records afterwards', async () => {
    const runner = new FakeTransactionRunner(
      buildContext({
        presence: buildPresence({ nutrition: [true] }, [false]),
      }),
    );

    await expectFailure(
      new ReplaceLocalDataUseCase(runner, silentCompactor).execute(
        restoreData(true),
      ),
      'verification-failed',
    );
  });

  it('reports a storage failure without exposing its cause', async () => {
    await expectFailure(
      new ReplaceLocalDataUseCase(
        new UnavailableTransactionRunner(),
        silentCompactor,
      ).execute(restoreData()),
      'replace-failed',
    );
  });

  it('succeeds when reclaiming storage fails after the commit', async () => {
    const runner = new FakeTransactionRunner(buildContext());
    const failingCompactor: StorageCompactor = {
      compact: () => Promise.reject(new Error('no space to rebuild')),
    };

    await expect(
      new ReplaceLocalDataUseCase(runner, failingCompactor).execute(
        restoreData(),
      ),
    ).resolves.toBeUndefined();
  });

  it('does not reclaim storage when the replacement was rolled back', async () => {
    let compactCount = 0;
    const runner = new FakeTransactionRunner(
      buildContext({ failingEraser: 'nutrition' }),
    );

    await expectFailure(
      new ReplaceLocalDataUseCase(runner, {
        compact: () => {
          compactCount += 1;
          return Promise.resolve();
        },
      }).execute(restoreData()),
      'replace-failed',
    );
    expect(compactCount).toBe(0);
  });
});
