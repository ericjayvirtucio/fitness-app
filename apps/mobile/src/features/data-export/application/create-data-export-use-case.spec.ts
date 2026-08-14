import {
  BodyWeightEntry,
  DomainId,
  Mass,
  type UserProfile,
} from '@fitness/domain';
import type {
  ExportPage,
  ExportPageQuery,
} from '../../../application/persistence/export-paging';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { PersistenceError } from '../../../infrastructure/persistence/persistence-error';
import {
  CreateDataExportUseCase,
  toFileName,
  type DataExportCancellation,
} from './create-data-export-use-case';
import { DataExportError } from './data-export-error';
import type { DataExportFile, DataExportFileWriter } from './data-export-file';
import type { DataExportTransactionContext } from './data-export-transaction-context';

const generatedAt = new Date('2026-08-11T09:15:04.123Z');

function emptyPage<TItem, TCursor>(): Promise<ExportPage<TItem, TCursor>> {
  return Promise.resolve({ items: [], nextCursor: null });
}

function checkIn(suffix: string): BodyWeightEntry {
  const identifier = DomainId.create(
    `${suffix}23e4567-e89b-42d3-a456-426614174000`,
  );
  const mass = Mass.create(82_400, 'gram');
  if (!identifier.isSuccess || !mass.isSuccess) throw new Error('bad fixture');
  const entry = BodyWeightEntry.create({
    id: identifier.value,
    localCalendarDate: '2026-08-04',
    mass: mass.value,
    note: null,
    occurredAtEpochMilliseconds: Date.UTC(2026, 7, 4, 4),
    utcOffsetMinutes: 480,
  });
  if (!entry.isSuccess) throw new Error('bad fixture');
  return entry.value;
}

function createContext(
  overrides: Partial<DataExportTransactionContext> = {},
): DataExportTransactionContext {
  return {
    bodyWeight: { listCheckInsPage: () => emptyPage() },
    exerciseCatalog: { listExercisesPage: () => emptyPage() },
    goals: { get: () => Promise.resolve(null), save: () => Promise.resolve() },
    hydrationEntries: { listEntriesPage: () => emptyPage() },
    hydrationTarget: {
      get: () => Promise.resolve(null),
      save: () => Promise.resolve(),
    },
    nutrition: {
      listCatalogItemsPage: () => emptyPage(),
      listEntriesPage: () => emptyPage(),
    },
    planner: {
      deleteByWeekday: () => Promise.resolve(false),
      getByWeekday: () => Promise.resolve(null),
      getWeeklyWorkouts: () => Promise.resolve([]),
      listUsages: () => Promise.resolve([]),
      replace: () => Promise.resolve(),
    },
    profile: {
      get: () => Promise.resolve(null),
      save: () => Promise.resolve(),
    },
    workoutHistory: { listCompletedSessionsPage: () => emptyPage() },
    workoutSessions: {
      complete: () => Promise.reject(new Error('unused')),
      correctCompleted: () => Promise.resolve(),
      deleteCompleted: () => Promise.resolve(),
      discard: () => Promise.resolve(false),
      getActive: () => Promise.resolve(null),
      getById: () => Promise.resolve(null),
      insert: () => Promise.resolve(),
      replace: () => Promise.resolve(),
    },
    ...overrides,
  };
}

class FakeTransactionRunner implements TransactionRunner<DataExportTransactionContext> {
  runCount = 0;

  constructor(private readonly context: DataExportTransactionContext) {}

  run<TResult>(
    operation: (context: DataExportTransactionContext) => Promise<TResult>,
  ): Promise<TResult> {
    this.runCount += 1;
    return operation(this.context);
  }
}

class FakeFileWriter implements DataExportFileWriter {
  prepareError: Error | undefined;
  writeError: Error | undefined;
  removeError: Error | undefined;
  prepareCount = 0;
  readonly removed: string[] = [];
  written: Readonly<{ content: string; fileName: string }> | undefined;

  prepareDirectory(): Promise<void> {
    this.prepareCount += 1;
    return this.prepareError
      ? Promise.reject(this.prepareError)
      : Promise.resolve();
  }

  write(fileName: string, content: string): Promise<DataExportFile> {
    if (this.writeError) return Promise.reject(this.writeError);
    this.written = { content, fileName };
    return Promise.resolve({
      byteSize: content.length,
      fileName,
      uri: `file:///cache/data-export/${fileName}`,
    });
  }

  remove(uri: string): Promise<void> {
    this.removed.push(uri);
    return this.removeError
      ? Promise.reject(this.removeError)
      : Promise.resolve();
  }
}

const neverCancelled: DataExportCancellation = { isCancelled: false };

function createUseCase(
  context = createContext(),
  fileWriter = new FakeFileWriter(),
  runner = new FakeTransactionRunner(context),
) {
  return {
    fileWriter,
    runner,
    useCase: new CreateDataExportUseCase(
      runner,
      fileWriter,
      () => '0.0.0',
      () => generatedAt,
    ),
  };
}

describe('CreateDataExportUseCase', () => {
  it('exports an empty repository as a complete document', async () => {
    const { fileWriter, useCase } = createUseCase();

    const result = await useCase.execute(neverCancelled);

    const document = JSON.parse(fileWriter.written?.content ?? '') as Record<
      string,
      unknown
    >;
    expect(document.format).toBe('fitness-app-data-export');
    expect(document.profile).toBeNull();
    expect(result.counts.bodyWeightCheckIns).toBe(0);
    expect(result.file.fileName).toBe(
      'fitness-app-export-20260811T091504Z.json',
    );
  });

  it('names the file from the same instant as the document', () => {
    expect(toFileName(generatedAt)).toBe(
      'fitness-app-export-20260811T091504Z.json',
    );
  });

  it('reads every capability inside one transaction', async () => {
    const { runner, useCase } = createUseCase();

    await useCase.execute(neverCancelled);

    expect(runner.runCount).toBe(1);
  });

  it('follows the cursor until a capability has no further page', async () => {
    const context = createContext({
      bodyWeight: {
        listCheckInsPage: (query) => {
          const isFirst = query.cursor === undefined;
          return Promise.resolve({
            items: [checkIn(isFirst ? '1' : '2')],
            nextCursor: isFirst
              ? {
                  id: 'cursor',
                  localCalendarDate: '2026-08-04',
                  occurredAtEpochMilliseconds: 1,
                }
              : null,
          });
        },
      },
    });
    const { useCase } = createUseCase(context);

    const result = await useCase.execute(neverCancelled);

    expect(result.counts.bodyWeightCheckIns).toBe(2);
  });

  it('requests bounded pages rather than lifetime history', async () => {
    const requested: ExportPageQuery<never>[] = [];
    const context = createContext({
      bodyWeight: {
        listCheckInsPage: (query) => {
          requested.push(query as ExportPageQuery<never>);
          return emptyPage();
        },
      },
    });
    const { useCase } = createUseCase(context);

    await useCase.execute(neverCancelled);

    expect(requested[0]?.limit).toBe(200);
  });

  it('reads sessions in smaller batches because they carry nested records', async () => {
    const requested: ExportPageQuery<never>[] = [];
    const context = createContext({
      workoutHistory: {
        listCompletedSessionsPage: (query) => {
          requested.push(query as ExportPageQuery<never>);
          return emptyPage();
        },
      },
    });
    const { useCase } = createUseCase(context);

    await useCase.execute(neverCancelled);

    expect(requested[0]?.limit).toBe(25);
  });

  it('fails the whole export when a capability read fails', async () => {
    const context = createContext({
      nutrition: {
        listCatalogItemsPage: () => emptyPage(),
        listEntriesPage: () =>
          Promise.reject(new PersistenceError('operation-failed')),
      },
    });
    const { fileWriter, useCase } = createUseCase(context);

    await expect(useCase.execute(neverCancelled)).rejects.toMatchObject({
      code: 'read-failed',
    });
    expect(fileWriter.written).toBeUndefined();
  });

  it('never reports a partial export as successful', async () => {
    const context = createContext({
      workoutHistory: {
        listCompletedSessionsPage: () =>
          Promise.reject(new PersistenceError('operation-failed')),
      },
    });
    const { fileWriter, useCase } = createUseCase(context);

    await expect(useCase.execute(neverCancelled)).rejects.toBeInstanceOf(
      DataExportError,
    );
    expect(fileWriter.written).toBeUndefined();
  });

  it('reports a serialization failure without creating a file', async () => {
    const context = createContext({
      profile: {
        get: () => Promise.resolve({} as unknown as UserProfile),
        save: () => Promise.resolve(),
      },
    });
    const { fileWriter, useCase } = createUseCase(context);

    await expect(useCase.execute(neverCancelled)).rejects.toMatchObject({
      code: 'serialization-failed',
    });
    expect(fileWriter.written).toBeUndefined();
  });

  it('reports a failure to prepare the working directory', async () => {
    const fileWriter = new FakeFileWriter();
    fileWriter.prepareError = new Error('no space');
    const { useCase } = createUseCase(createContext(), fileWriter);

    await expect(useCase.execute(neverCancelled)).rejects.toMatchObject({
      code: 'file-write-failed',
    });
  });

  it('reports a failure to write the export file', async () => {
    const fileWriter = new FakeFileWriter();
    fileWriter.writeError = new Error('no space');
    const { useCase } = createUseCase(createContext(), fileWriter);

    await expect(useCase.execute(neverCancelled)).rejects.toMatchObject({
      code: 'file-write-failed',
    });
  });

  it('clears any previous export before generating a new one', async () => {
    const { fileWriter, useCase } = createUseCase();

    await useCase.execute(neverCancelled);
    await useCase.execute(neverCancelled);

    expect(fileWriter.prepareCount).toBe(2);
  });

  it('stops and writes nothing when cancelled during collection', async () => {
    const cancellation = { isCancelled: true };
    const { fileWriter, useCase } = createUseCase();

    await expect(useCase.execute(cancellation)).rejects.toMatchObject({
      code: 'cancelled',
    });
    expect(fileWriter.written).toBeUndefined();
  });

  it('removes the file when cancelled after it was written', async () => {
    const cancellation = { isCancelled: false };
    const context = createContext({
      bodyWeight: {
        listCheckInsPage: () => {
          cancellation.isCancelled = true;
          return emptyPage();
        },
      },
    });
    const fileWriter = new FakeFileWriter();
    const { useCase } = createUseCase(context, fileWriter);

    await expect(useCase.execute(cancellation)).rejects.toMatchObject({
      code: 'cancelled',
    });
    expect(fileWriter.removed).toEqual([
      'file:///cache/data-export/fitness-app-export-20260811T091504Z.json',
    ]);
  });

  it('keeps a cleanup failure from changing the reported outcome', async () => {
    const cancellation = { isCancelled: false };
    const context = createContext({
      bodyWeight: {
        listCheckInsPage: () => {
          cancellation.isCancelled = true;
          return emptyPage();
        },
      },
    });
    const fileWriter = new FakeFileWriter();
    fileWriter.removeError = new Error('busy');
    const { useCase } = createUseCase(context, fileWriter);

    await expect(useCase.execute(cancellation)).rejects.toMatchObject({
      code: 'cancelled',
    });
  });

  it('exposes no stored value in a failure message', async () => {
    const context = createContext({
      bodyWeight: {
        listCheckInsPage: () =>
          Promise.reject(new PersistenceError('operation-failed')),
      },
    });
    const { useCase } = createUseCase(context);

    await expect(useCase.execute(neverCancelled)).rejects.toThrow(
      'Your information could not be read. No export file was created.',
    );
  });
});
