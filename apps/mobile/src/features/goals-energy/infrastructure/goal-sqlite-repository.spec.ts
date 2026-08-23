import { GoalConfiguration, isOk } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { GoalSqliteRepository } from './goal-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  row: unknown = null;
  runError: Error | undefined;
  revisionAfterWrite = 1;
  readonly runs: { parameters: DatabaseParameters; statement: string }[] = [];
  readonly getFirstStatements: string[] = [];
  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(statement: string): Promise<TResult | null> {
    this.getFirstStatements.push(statement);
    if (statement.includes('SELECT revision'))
      return Promise.resolve({ revision: this.revisionAfterWrite } as TResult);
    return Promise.resolve(this.row as TResult | null);
  }
  getAll<TResult>(): Promise<readonly TResult[]> {
    return Promise.resolve([]);
  }
  getVersion(): Promise<number> {
    return Promise.resolve(3);
  }
  run(statement: string, parameters: DatabaseParameters = []): Promise<void> {
    if (this.runError) return Promise.reject(this.runError);
    this.runs.push({ parameters, statement });
    return Promise.resolve();
  }
  runExclusive<TResult>(
    operation: (transaction: DatabaseConnection) => Promise<TResult>,
  ): Promise<TResult> {
    return operation(this);
  }
}

const deviceId = 'device-a';
const now = () => new Date('2026-08-02T00:00:00.000Z');

describe('GoalSqliteRepository', () => {
  it('returns null when no goal exists', async () => {
    await expect(
      new GoalSqliteRepository(new FakeDatabase(), deviceId, now).get(),
    ).resolves.toBeNull();
  });

  it('excludes a tombstoned goal from a plain read', async () => {
    const database = new FakeDatabase();
    await new GoalSqliteRepository(database, deviceId, now).get();
    expect(database.getFirstStatements[0]).toContain(
      'deleted_at_epoch_ms IS NULL',
    );
  });

  it('maps and validates a stored goal', async () => {
    const database = new FakeDatabase();
    database.row = { adjustment_kilocalories: 300, goal_type: 'lose-weight' };
    await expect(
      new GoalSqliteRepository(database, deviceId, now).get(),
    ).resolves.toMatchObject({
      adjustmentKilocalories: 300,
      type: 'lose-weight',
    });
  });

  it('rejects corrupt stored values safely', async () => {
    const database = new FakeDatabase();
    database.row = { adjustment_kilocalories: 900, goal_type: 'lose-weight' };
    await expect(
      new GoalSqliteRepository(database, deviceId, now).get(),
    ).rejects.toMatchObject({
      code: 'operation-failed',
    });
  });

  it('upserts with bound parameters, synchronization metadata, and translates failures', async () => {
    const database = new FakeDatabase();
    database.revisionAfterWrite = 2;
    const goal = GoalConfiguration.create('gain-weight', 250);
    if (!isOk(goal)) throw new Error('Invalid fixture.');
    const repository = new GoalSqliteRepository(database, deviceId, now);
    await repository.save(goal.value);
    expect(database.runs[0]?.parameters).toEqual([
      1,
      'gain-weight',
      250,
      now().getTime(),
      deviceId,
    ]);
    expect(database.runs[0]?.statement).toContain('ON CONFLICT');
    expect(database.runs[1]?.statement).toContain('sync_outbox');
    expect(database.runs[1]?.parameters).toEqual([
      'goal_configuration',
      '1',
      'upsert',
      2,
      now().getTime(),
    ]);

    database.runError = new Error('raw SQL with sensitive goal values');
    await expect(repository.save(goal.value)).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
  });
});
