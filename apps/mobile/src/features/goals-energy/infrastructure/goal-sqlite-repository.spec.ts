import { GoalConfiguration, isOk } from '@fitness/domain';
import type {
  DatabaseConnection,
  DatabaseParameters,
} from '../../../infrastructure/persistence/database';
import { GoalSqliteRepository } from './goal-sqlite-repository';

class FakeDatabase implements DatabaseConnection {
  row: unknown = null;
  runError: Error | undefined;
  readonly runs: { parameters: DatabaseParameters; statement: string }[] = [];
  exec(): Promise<void> {
    return Promise.resolve();
  }
  getFirst<TResult>(): Promise<TResult | null> {
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

describe('GoalSqliteRepository', () => {
  it('returns null when no goal exists', async () => {
    await expect(
      new GoalSqliteRepository(new FakeDatabase()).get(),
    ).resolves.toBeNull();
  });

  it('maps and validates a stored goal', async () => {
    const database = new FakeDatabase();
    database.row = { adjustment_kilocalories: 300, goal_type: 'lose-weight' };
    await expect(
      new GoalSqliteRepository(database).get(),
    ).resolves.toMatchObject({
      adjustmentKilocalories: 300,
      type: 'lose-weight',
    });
  });

  it('rejects corrupt stored values safely', async () => {
    const database = new FakeDatabase();
    database.row = { adjustment_kilocalories: 900, goal_type: 'lose-weight' };
    await expect(
      new GoalSqliteRepository(database).get(),
    ).rejects.toMatchObject({
      code: 'operation-failed',
    });
  });

  it('upserts with bound parameters and translates failures', async () => {
    const database = new FakeDatabase();
    const goal = GoalConfiguration.create('gain-weight', 250);
    if (!isOk(goal)) throw new Error('Invalid fixture.');
    const repository = new GoalSqliteRepository(database);
    await repository.save(goal.value);
    expect(database.runs[0]?.parameters).toEqual([1, 'gain-weight', 250]);
    expect(database.runs[0]?.statement).toContain('ON CONFLICT');

    database.runError = new Error('raw SQL with sensitive goal values');
    await expect(repository.save(goal.value)).rejects.toMatchObject({
      code: 'operation-failed',
      message: 'The local storage operation failed.',
    });
  });
});
