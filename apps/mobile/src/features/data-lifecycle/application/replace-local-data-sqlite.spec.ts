import type { BodyWeightEntryRepository } from '../../body-measurement-history/application/body-weight-entry-repository';
import { BodyWeightEntrySqliteRepository } from '../../body-measurement-history/infrastructure/body-weight-entry-sqlite-repository';
import { BodyWeightDataEraser } from '../../body-measurement-history/infrastructure/body-weight-data-eraser';
import { BodyWeightStoredDataProbe } from '../../body-measurement-history/infrastructure/body-weight-stored-data-probe';
import { ExerciseCatalogDataEraser } from '../../exercise-catalog/infrastructure/exercise-catalog-data-eraser';
import { ExerciseCatalogSqliteRepository } from '../../exercise-catalog/infrastructure/exercise-catalog-sqlite-repository';
import { ExerciseCatalogStoredDataProbe } from '../../exercise-catalog/infrastructure/exercise-catalog-stored-data-probe';
import { GoalDataEraser } from '../../goals-energy/infrastructure/goal-data-eraser';
import { GoalSqliteRepository } from '../../goals-energy/infrastructure/goal-sqlite-repository';
import { GoalStoredDataProbe } from '../../goals-energy/infrastructure/goal-stored-data-probe';
import { HydrationDataEraser } from '../../hydration-tracking/infrastructure/hydration-data-eraser';
import { HydrationEntrySqliteRepository } from '../../hydration-tracking/infrastructure/hydration-entry-sqlite-repository';
import { HydrationStoredDataProbe } from '../../hydration-tracking/infrastructure/hydration-stored-data-probe';
import { HydrationTargetSqliteRepository } from '../../hydration-tracking/infrastructure/hydration-target-sqlite-repository';
import { ConsumptionEntrySqliteRepository } from '../../nutrition-logging/infrastructure/consumption-entry-sqlite-repository';
import { NutritionCatalogSqliteRepository } from '../../nutrition-logging/infrastructure/nutrition-catalog-sqlite-repository';
import { NutritionDataEraser } from '../../nutrition-logging/infrastructure/nutrition-data-eraser';
import { NutritionStoredDataProbe } from '../../nutrition-logging/infrastructure/nutrition-stored-data-probe';
import { PersonalProfileDataEraser } from '../../personal-profile/infrastructure/personal-profile-data-eraser';
import { PersonalProfileSqliteRepository } from '../../personal-profile/infrastructure/personal-profile-sqlite-repository';
import { PersonalProfileStoredDataProbe } from '../../personal-profile/infrastructure/personal-profile-stored-data-probe';
import { WorkoutPlannerDataEraser } from '../../workout-planner/infrastructure/workout-planner-data-eraser';
import { WorkoutPlannerSqliteRepository } from '../../workout-planner/infrastructure/workout-planner-sqlite-repository';
import { WorkoutPlannerStoredDataProbe } from '../../workout-planner/infrastructure/workout-planner-stored-data-probe';
import { WorkoutSessionDataEraser } from '../../workout-session/infrastructure/workout-session-data-eraser';
import { WorkoutSessionSqliteRepository } from '../../workout-session/infrastructure/workout-session-sqlite-repository';
import { WorkoutSessionStoredDataProbe } from '../../workout-session/infrastructure/workout-session-stored-data-probe';
import type { DatabaseConnection } from '../../../infrastructure/persistence/database';
import { initializeDatabase } from '../../../infrastructure/persistence/database-initializer';
import { migrations } from '../../../infrastructure/persistence/migrations';
import { SqliteTransactionRunner } from '../../../infrastructure/persistence/sqlite-transaction-runner';
import { clearOutbox } from '../../../infrastructure/persistence/sync-outbox';
import { NodeSqliteDatabase } from '../../../infrastructure/persistence/testing/node-sqlite-database';
import { parseDataExport } from '../../data-restore/application/parse-data-export';
import type { RestoreData } from '../../data-restore/application/restore-data';
import {
  buildCheckIn,
  buildExercise,
  buildExport,
  syntheticToday,
  type Json,
} from '../../data-restore/application/synthetic-data-export.spec-helper';
import type { LocalDataReplacementTransactionContext } from './local-data-replacement-transaction-context';
import { ReplaceLocalDataUseCase } from './replace-local-data-use-case';

const deviceId = 'device-a';
const now = () => new Date();

/**
 * The rollback guarantee replacement rests on is a property of the engine, not
 * of the orchestration, so these run against a real SQLite database with the
 * repository's own migrations and the repositories the application uses. Only
 * the failure is injected, and it is injected here rather than behind any
 * switch the shipped application could reach.
 */

type Options = Readonly<{ failBodyWeightInsert?: boolean }>;

/**
 * Delegates everything except the insertion, explicitly rather than by
 * spreading the repository: a spread would leave the prototype methods behind
 * and the failure would then depend on which method the write order happens to
 * call.
 */
function withFailingInsert(
  repository: BodyWeightEntryRepository,
): BodyWeightEntryRepository {
  return {
    delete: (id) => repository.delete(id),
    getById: (id) => repository.getById(id),
    getLatest: () => repository.getLatest(),
    insert: () => Promise.reject(new Error('the write failed')),
    listPage: (query) => repository.listPage(query),
    update: (entry) => repository.update(entry),
  };
}

const alternativeExerciseId = '123e4567-e89b-42d3-a456-4266141740b1';
const alternativeCheckInId = '123e4567-e89b-42d3-a456-4266141740b2';

function buildRunner(database: DatabaseConnection, options: Options = {}) {
  return new SqliteTransactionRunner<LocalDataReplacementTransactionContext>(
    database,
    (transaction) => {
      const probes = {
        bodyWeight: new BodyWeightStoredDataProbe(transaction),
        exerciseCatalog: new ExerciseCatalogStoredDataProbe(transaction),
        goal: new GoalStoredDataProbe(transaction),
        hydration: new HydrationStoredDataProbe(transaction),
        nutrition: new NutritionStoredDataProbe(transaction),
        personalProfile: new PersonalProfileStoredDataProbe(transaction),
        workoutPlanner: new WorkoutPlannerStoredDataProbe(transaction),
        workoutSession: new WorkoutSessionStoredDataProbe(transaction),
      };
      const bodyWeight = new BodyWeightEntrySqliteRepository(
        transaction,
        deviceId,
        now,
      );

      return {
        clearOutbox: () => clearOutbox(transaction),
        erasers: [
          new WorkoutSessionDataEraser(transaction),
          new WorkoutPlannerDataEraser(transaction),
          new ExerciseCatalogDataEraser(transaction),
          new NutritionDataEraser(transaction),
          new HydrationDataEraser(transaction),
          new BodyWeightDataEraser(transaction),
          new GoalDataEraser(transaction),
          new PersonalProfileDataEraser(transaction),
        ],
        presence: probes,
        target: {
          // Body-weight check-ins are written last, so failing there proves the
          // rollback covers every deletion and every earlier insertion.
          bodyWeight: options.failBodyWeightInsert
            ? withFailingInsert(bodyWeight)
            : bodyWeight,
          exerciseCatalog: new ExerciseCatalogSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          goals: new GoalSqliteRepository(transaction, deviceId, now),
          hydrationEntries: new HydrationEntrySqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          hydrationTarget: new HydrationTargetSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          nutritionCatalog: new NutritionCatalogSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          nutritionEntries: new ConsumptionEntrySqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          planner: new WorkoutPlannerSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          probes: [
            probes.personalProfile,
            probes.goal,
            probes.nutrition,
            probes.hydration,
            probes.exerciseCatalog,
            probes.workoutPlanner,
            probes.workoutSession,
            probes.bodyWeight,
          ],
          profile: new PersonalProfileSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
          sessions: new WorkoutSessionSqliteRepository(
            transaction,
            deviceId,
            now,
          ),
        },
      };
    },
  );
}

const silentCompactor = { compact: () => Promise.resolve() };

function parse(document: Json): RestoreData {
  const parsed = parseDataExport(JSON.stringify(document), syntheticToday);
  if (!parsed.isSuccess) throw new Error('the synthetic export must be valid');
  return parsed.value.data;
}

/** A second dataset with its own identifiers, so neither can be mistaken for the other. */
const replacementExport = (): Json =>
  buildExport({
    bodyMeasurements: {
      weightCheckIns: [buildCheckIn({ id: alternativeCheckInId })],
    },
    exerciseCatalog: {
      exercises: [
        buildExercise({
          id: alternativeExerciseId,
          name: 'E2E Replacement Press',
        }),
      ],
    },
    workoutPlanner: { plannedWorkouts: [] },
    workoutSessions: { activeSession: null, completedSessions: [] },
  });

type ExerciseRow = Readonly<{ display_name: string }>;

async function readExerciseNames(
  database: DatabaseConnection,
): Promise<readonly string[]> {
  const rows = await database.getAll<ExerciseRow>(
    'SELECT display_name FROM exercise_catalog_item ORDER BY display_name',
  );
  return rows.map((row) => row.display_name);
}

async function createPopulatedDatabase(): Promise<NodeSqliteDatabase> {
  const database = new NodeSqliteDatabase();
  await initializeDatabase(database, migrations);
  await new ReplaceLocalDataUseCase(
    buildRunner(database),
    silentCompactor,
  ).execute(parse(buildExport()));
  return database;
}

describe('replacing local data on a real SQLite database', () => {
  it('writes the replacement dataset into an installation that held another', async () => {
    const database = await createPopulatedDatabase();

    await new ReplaceLocalDataUseCase(
      buildRunner(database),
      silentCompactor,
    ).execute(parse(replacementExport()));

    await expect(readExerciseNames(database)).resolves.toEqual([
      'E2E Replacement Press',
    ]);
    await expect(
      database.getAll('SELECT id FROM body_weight_entry'),
    ).resolves.toEqual([{ id: alternativeCheckInId }]);
    await expect(
      database.getAll('SELECT id FROM planned_workout'),
    ).resolves.toEqual([]);

    database.close();
  });

  it('keeps the previous dataset when an insertion fails after the deletions', async () => {
    const database = await createPopulatedDatabase();
    const before = await readExerciseNames(database);

    const attempt = new ReplaceLocalDataUseCase(
      buildRunner(database, { failBodyWeightInsert: true }),
      silentCompactor,
    ).execute(parse(replacementExport()));

    await expect(attempt).rejects.toMatchObject({ code: 'replace-failed' });
    await expect(readExerciseNames(database)).resolves.toEqual(before);
    await expect(readExerciseNames(database)).resolves.not.toContain(
      'E2E Replacement Press',
    );

    database.close();
  });

  it('leaves no row of the incoming dataset behind after a rollback', async () => {
    const database = await createPopulatedDatabase();

    await new ReplaceLocalDataUseCase(
      buildRunner(database, { failBodyWeightInsert: true }),
      silentCompactor,
    )
      .execute(parse(replacementExport()))
      .catch(() => undefined);

    await expect(
      database.getAll('SELECT id FROM exercise_catalog_item WHERE id = ?', [
        alternativeExerciseId,
      ]),
    ).resolves.toEqual([]);
    await expect(
      database.getAll('SELECT id FROM body_weight_entry WHERE id = ?', [
        alternativeCheckInId,
      ]),
    ).resolves.toEqual([]);

    database.close();
  });

  it('keeps every capability of the previous dataset after a rollback', async () => {
    const database = await createPopulatedDatabase();

    await new ReplaceLocalDataUseCase(
      buildRunner(database, { failBodyWeightInsert: true }),
      silentCompactor,
    )
      .execute(parse(replacementExport()))
      .catch(() => undefined);

    for (const table of [
      'personal_profile',
      'goal_configuration',
      'nutrition_consumption_entry',
      'nutrition_catalog_item',
      'hydration_entry',
      'hydration_target',
      'exercise_catalog_item',
      'planned_workout',
      'planned_exercise',
      'workout_session',
      'workout_session_exercise',
      'workout_set',
      'body_weight_entry',
    ]) {
      await expect(
        database.getAll(`SELECT 1 AS present FROM ${table} LIMIT 1`),
      ).resolves.toHaveLength(1);
    }

    database.close();
  });

  it('leaves the schema and the migration version intact after a rollback', async () => {
    const database = await createPopulatedDatabase();

    await new ReplaceLocalDataUseCase(
      buildRunner(database, { failBodyWeightInsert: true }),
      silentCompactor,
    )
      .execute(parse(replacementExport()))
      .catch(() => undefined);

    await expect(database.getVersion()).resolves.toBe(migrations.length);
    await expect(
      database.getAll("SELECT name FROM sqlite_master WHERE type = 'trigger'"),
    ).resolves.toContainEqual({
      name: 'prevent_referenced_exercise_logging_mode_change',
    });

    database.close();
  });
});
