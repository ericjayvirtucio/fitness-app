import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { toPersistenceError } from '../../../infrastructure/persistence/persistence-error';
import { isDataRestoreError } from './data-restore-error';
import type { DataRestoreTransactionContext } from './data-restore-transaction-context';
import { GetRestoreTargetUseCase } from './get-restore-target-use-case';
import { parseDataExport } from './parse-data-export';
import { RestoreDataExportUseCase } from './restore-data-export-use-case';
import type { RestoreData } from './restore-data';
import {
  buildRestoreTransactionContext,
  restoreWriteOrder,
  ScriptedProbe,
} from './restore-transaction-context.spec-helper';
import {
  buildExport,
  syntheticToday,
} from './synthetic-data-export.spec-helper';

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

const writeOrder = restoreWriteOrder;
const buildContext = buildRestoreTransactionContext;

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
