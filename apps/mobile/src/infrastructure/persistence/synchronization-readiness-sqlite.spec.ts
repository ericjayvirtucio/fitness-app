import {
  DomainId,
  PlannedExercise,
  PlannedWorkout,
  Weekday,
  createPlannedPrescription,
} from '@fitness/domain';
import { initializeDatabase } from './database-initializer';
import { getOrCreateDeviceId } from './device-identity';
import { migrations } from './migrations';
import { clearOutbox, queueOutboxEntry } from './sync-outbox';
import { NodeSqliteDatabase } from './testing/node-sqlite-database';
import { BodyWeightEntrySqliteRepository } from '../../features/body-measurement-history/infrastructure/body-weight-entry-sqlite-repository';
import { WorkoutPlannerSqliteRepository } from '../../features/workout-planner/infrastructure/workout-planner-sqlite-repository';
import { ExerciseCatalogSqliteRepository } from '../../features/exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { ExerciseDefinition } from '@fitness/domain';
import { ExerciseCatalogItem } from '../../features/exercise-catalog/application/exercise-catalog-item';
import { BodyWeightEntry, Mass } from '@fitness/domain';

/**
 * End-to-end coverage of the synchronization-readiness schema against a real
 * SQLite engine: tombstone visibility, existence-probe behavior, device
 * identity, outbox collapsing, and the weekday-reuse-after-tombstone case a
 * fake connection cannot enforce a UNIQUE index for.
 */

const deviceId = 'device-a';
const now = () => new Date('2026-08-20T00:00:00.000Z');

function unwrap<T>(result: { isSuccess: boolean; value?: T }): T {
  if (!result.isSuccess || result.value === undefined)
    throw new Error('Invalid fixture');
  return result.value;
}

describe('Synchronization-readiness schema on a real database', () => {
  let database: NodeSqliteDatabase;

  beforeEach(async () => {
    database = new NodeSqliteDatabase();
    await initializeDatabase(database, migrations);
  });

  afterEach(() => database.close());

  it('generates a device id once and returns the same one on every subsequent call', async () => {
    const first = await getOrCreateDeviceId(database, () => 'generated-id');
    const second = await getOrCreateDeviceId(database, () => 'a-different-id');
    expect(first).toBe('generated-id');
    expect(second).toBe('generated-id');
  });

  it('excludes a tombstoned body-weight entry from reads but still counts it as stored data', async () => {
    const repository = new BodyWeightEntrySqliteRepository(
      database,
      deviceId,
      now,
    );
    const entry = unwrap(
      BodyWeightEntry.create({
        id: unwrap(DomainId.create('123e4567-e89b-42d3-a456-426614174000')),
        localCalendarDate: '2026-08-20',
        mass: unwrap(Mass.create(80_000, 'gram')),
        note: null,
        occurredAtEpochMilliseconds: Date.UTC(2026, 7, 20, 8),
        utcOffsetMinutes: 0,
      }),
    );
    await repository.insert(entry);

    await expect(repository.getById(entry.id)).resolves.not.toBeNull();
    await expect(repository.delete(entry.id)).resolves.toBe(true);
    await expect(repository.getById(entry.id)).resolves.toBeNull();

    // The row is a tombstone, not gone: existence probing (restore/erase
    // eligibility) must still see it as present.
    const stillPresent = await database.getFirst<{ present: number }>(
      'SELECT 1 AS present FROM body_weight_entry WHERE id = ?',
      [entry.id.value],
    );
    expect(stillPresent).not.toBeNull();
    const stored = await database.getFirst<{
      deleted_at_epoch_ms: number | null;
      revision: number;
    }>(
      'SELECT deleted_at_epoch_ms, revision FROM body_weight_entry WHERE id = ?',
      [entry.id.value],
    );
    expect(stored?.deleted_at_epoch_ms).not.toBeNull();
    expect(stored?.revision).toBe(2);
  });

  it('collapses repeated edits of the same record into one outbox row', async () => {
    const repository = new BodyWeightEntrySqliteRepository(
      database,
      deviceId,
      now,
    );
    const entry = unwrap(
      BodyWeightEntry.create({
        id: unwrap(DomainId.create('223e4567-e89b-42d3-a456-426614174000')),
        localCalendarDate: '2026-08-20',
        mass: unwrap(Mass.create(80_000, 'gram')),
        note: null,
        occurredAtEpochMilliseconds: Date.UTC(2026, 7, 20, 8),
        utcOffsetMinutes: 0,
      }),
    );
    await repository.insert(entry);
    await repository.update(entry);
    await repository.update(entry);

    const rows = await database.getAll<{ operation: string; revision: number }>(
      'SELECT operation, revision FROM sync_outbox WHERE table_name = ? AND row_id = ?',
      ['body_weight_entry', entry.id.value],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ operation: 'upsert', revision: 3 });
  });

  it('allows re-planning a weekday whose previous plan was tombstoned', async () => {
    const repository = new WorkoutPlannerSqliteRepository(
      database,
      deviceId,
      now,
    );
    const catalog = new ExerciseCatalogSqliteRepository(
      database,
      deviceId,
      now,
    );
    const exerciseId = unwrap(
      DomainId.create('323e4567-e89b-42d3-a456-426614174000'),
    );
    await catalog.insert(
      unwrap(
        ExerciseCatalogItem.create({
          definition: unwrap(
            ExerciseDefinition.create({
              equipment: 'bodyweight',
              id: exerciseId,
              loggingMode: 'bodyweight-and-repetitions',
              name: 'Push-up',
              notes: null,
              primaryMuscleGroup: 'chest',
            }),
          ),
          isFavorite: false,
        }),
      ),
    );

    const firstPlanId = unwrap(
      DomainId.create('423e4567-e89b-42d3-a456-426614174000'),
    );
    const monday = unwrap(Weekday.create(1));
    const firstExercise = unwrap(
      PlannedExercise.create({
        exerciseDefinitionId: exerciseId,
        id: unwrap(DomainId.create('523e4567-e89b-42d3-a456-426614174000')),
        position: 0,
        prescription: unwrap(
          createPlannedPrescription({
            loggingMode: 'bodyweight-and-repetitions',
            repetitions: 10,
            sets: 3,
          }),
        ),
      }),
    );
    const firstPlan = unwrap(
      PlannedWorkout.create({
        exercises: [firstExercise],
        id: firstPlanId,
        name: 'Old Monday',
        weekday: monday,
      }),
    );
    await repository.replace(firstPlan);
    await expect(repository.deleteByWeekday(monday)).resolves.toBe(true);

    const secondPlanId = unwrap(
      DomainId.create('623e4567-e89b-42d3-a456-426614174000'),
    );
    const secondExercise = unwrap(
      PlannedExercise.create({
        exerciseDefinitionId: exerciseId,
        id: unwrap(DomainId.create('723e4567-e89b-42d3-a456-426614174000')),
        position: 0,
        prescription: unwrap(
          createPlannedPrescription({
            loggingMode: 'bodyweight-and-repetitions',
            repetitions: 12,
            sets: 4,
          }),
        ),
      }),
    );
    const secondPlan = unwrap(
      PlannedWorkout.create({
        exercises: [secondExercise],
        id: secondPlanId,
        name: 'New Monday',
        weekday: monday,
      }),
    );

    await expect(repository.replace(secondPlan)).resolves.toBeUndefined();

    const live = await repository.getByWeekday(monday);
    expect(live?.workout.name).toBe('New Monday');
    const rows = await database.getAll<{ id: string }>(
      'SELECT id FROM planned_workout WHERE weekday = 1',
    );
    expect(rows.map((row) => row.id).sort()).toEqual(
      [firstPlanId.value, secondPlanId.value].sort(),
    );
  });

  it('wipes the outbox on erase-all but leaves device identity untouched', async () => {
    await getOrCreateDeviceId(database, () => 'kept-device-id');
    await queueOutboxEntry(
      database,
      'body_weight_entry',
      'some-row-id',
      'upsert',
      1,
      now().getTime(),
    );
    await expect(
      database.getAll('SELECT * FROM sync_outbox'),
    ).resolves.toHaveLength(1);

    await clearOutbox(database);

    await expect(
      database.getAll('SELECT * FROM sync_outbox'),
    ).resolves.toHaveLength(0);
    await expect(getOrCreateDeviceId(database, () => 'unused')).resolves.toBe(
      'kept-device-id',
    );
  });
});
