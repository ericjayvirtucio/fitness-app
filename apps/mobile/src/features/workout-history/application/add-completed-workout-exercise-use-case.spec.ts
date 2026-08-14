import {
  DomainId,
  Duration,
  DurationResult,
  ExerciseDefinition,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
  type ExerciseLoggingMode,
  type Result,
  type WorkoutResult,
} from '@fitness/domain';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { ExerciseCatalogRepository } from '../../exercise-catalog/application/exercise-catalog-repository';
import type {
  CompletedWorkoutLifecycle,
  WorkoutSessionRepository,
} from '../../workout-session/application/workout-session-repository';
import {
  AddCompletedWorkoutExerciseUseCase,
  type CompletedExerciseAdditionContext,
  type CompletedExerciseAdditionOutcome,
} from './add-completed-workout-exercise-use-case';

const sessionId = '550e8400-e29b-41d4-a716-446655440000';
const firstExerciseId = '550e8400-e29b-41d4-a716-446655440001';
const secondExerciseId = '550e8400-e29b-41d4-a716-446655440002';
const definitionId = '550e8400-e29b-41d4-a716-4466554400c0';
const durationDefinitionId = '550e8400-e29b-41d4-a716-4466554400c1';
const startedAt = 1_700_000_000_000;
const completedAt = startedAt + 3_600_000;

function unwrap<TValue>(result: Result<TValue, unknown>): TValue {
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function id(value: string) {
  return unwrap(DomainId.create(value));
}

function recordedSet(value: string, repetitions: number) {
  return unwrap(
    WorkoutSet.create({
      id: id(value),
      position: 0,
      result: RepetitionResult.valid(repetitions),
    }),
  );
}

function exercise(
  value: string,
  position: number,
  name: string,
  sets: readonly WorkoutSet[],
) {
  return unwrap(
    WorkoutSessionExercise.create({
      exerciseNameSnapshot: name,
      id: id(value),
      loggingModeSnapshot: 'repetitions',
      plannedPrescriptionSnapshot: null,
      position,
      sets,
      sourceExerciseDefinitionId: id('550e8400-e29b-41d4-a716-4466554400a0'),
      sourcePlannedExerciseId: null,
    }),
  );
}

function session(
  exercises: readonly WorkoutSessionExercise[],
  status: 'active' | 'completed' = 'completed',
  completed: number | null = completedAt,
) {
  return unwrap(
    WorkoutSession.create({
      completedAtEpochMilliseconds: completed,
      exercises,
      id: id(sessionId),
      name: 'Push day',
      sourcePlannedWorkoutId: null,
      sourceWeekday: null,
      startedAtEpochMilliseconds: startedAt,
      startedLocalCalendarDate: '2023-11-14',
      startedUtcOffsetMinutes: -480,
      status,
    }),
  );
}

function catalogItem(
  value: string,
  name: string,
  loggingMode: ExerciseLoggingMode,
) {
  return unwrap(
    ExerciseCatalogItem.create({
      definition: unwrap(
        ExerciseDefinition.create({
          equipment: 'none',
          id: id(value),
          loggingMode,
          name,
          primaryMuscleGroup: 'chest',
        }),
      ),
      isFavorite: false,
    }),
  );
}

const performed = () => [
  exercise(firstExerciseId, 0, 'Bench press', [
    recordedSet('550e8400-e29b-41d4-a716-4466554400b0', 8),
  ]),
  exercise(secondExerciseId, 1, 'Overhead press', [
    recordedSet('550e8400-e29b-41d4-a716-4466554400b1', 5),
  ]),
];

class Sessions implements WorkoutSessionRepository {
  corrections: WorkoutSession[] = [];
  failOnCorrect = false;
  constructor(public stored: WorkoutSession | null) {}
  complete(value: WorkoutSession) {
    return Promise.resolve(value);
  }
  correctCompleted(value: WorkoutSession) {
    if (this.failOnCorrect) return Promise.reject(new Error('write failed'));
    this.corrections.push(value);
    this.stored = value;
    return Promise.resolve();
  }
  deleteCompleted() {
    return Promise.resolve();
  }
  discard() {
    return Promise.resolve(true);
  }
  getActive() {
    return Promise.resolve(null);
  }
  getById() {
    return Promise.resolve(this.stored);
  }
  insert() {
    return Promise.resolve();
  }
  replace() {
    return Promise.resolve();
  }
}

/**
 * Answers only `getById`, because capturing a snapshot is the one reason the
 * addition may read the catalog at all. Every other member throws so a reach for
 * current catalog state through some other door fails the test.
 */
class Catalog implements ExerciseCatalogRepository {
  readonly requested: string[] = [];
  constructor(private readonly items: readonly ExerciseCatalogItem[]) {}
  delete(): Promise<boolean> {
    throw new Error('The addition must not delete catalog definitions.');
  }
  findByNormalizedName(): Promise<readonly ExerciseCatalogItem[]> {
    throw new Error('The addition must not search the catalog by name.');
  }
  getById(value: DomainId) {
    this.requested.push(value.value);
    return Promise.resolve(
      this.items.find((item) => item.definition.id.equals(value)) ?? null,
    );
  }
  getByIds(): Promise<readonly ExerciseCatalogItem[]> {
    throw new Error('The addition must not read the catalog in bulk.');
  }
  insert(): Promise<void> {
    throw new Error('The addition must not create catalog definitions.');
  }
  listAll(): Promise<readonly ExerciseCatalogItem[]> {
    throw new Error('The addition must not list the catalog.');
  }
  listFavorites(): Promise<readonly ExerciseCatalogItem[]> {
    throw new Error('The addition must not list catalog favorites.');
  }
  search(): Promise<readonly ExerciseCatalogItem[]> {
    throw new Error('The addition must not search the catalog.');
  }
  setFavorite(): Promise<boolean> {
    throw new Error('The addition must not change catalog favorites.');
  }
  update(): Promise<boolean> {
    throw new Error('The addition must not change catalog definitions.');
  }
}

function fixture(
  stored: WorkoutSession | null = session(performed()),
  items: readonly ExerciseCatalogItem[] = [
    catalogItem(definitionId, 'Incline press', 'repetitions'),
    catalogItem(durationDefinitionId, 'Plank', 'duration'),
  ],
) {
  const sessions = new Sessions(stored);
  const catalog = new Catalog(items);
  const runner: TransactionRunner<CompletedExerciseAdditionContext> = {
    run: (operation) => operation({ catalog, sessions }),
  };
  let generated = 0;
  return {
    catalog,
    sessions,
    useCase: new AddCompletedWorkoutExerciseUseCase(runner, () => {
      generated += 1;
      return `550e8400-e29b-41d4-a716-44665544f0${String(generated).padStart(2, '0')}`;
    }),
  };
}

const expected: CompletedWorkoutLifecycle = {
  completedAtEpochMilliseconds: completedAt,
  startedAtEpochMilliseconds: startedAt,
};

function addition(
  overrides: Partial<{
    definitionId: unknown;
    expected: CompletedWorkoutLifecycle;
    result: WorkoutResult;
    sessionId: unknown;
  }> = {},
) {
  return {
    definitionId,
    expected,
    result: RepetitionResult.valid(10) as WorkoutResult,
    sessionId,
    ...overrides,
  };
}

function refusal(outcome: CompletedExerciseAdditionOutcome) {
  if (outcome.status !== 'refused')
    throw new Error('Expected the addition to be refused');
  return outcome.reason;
}

function written(sessions: Sessions) {
  const last = sessions.corrections.at(-1);
  if (last === undefined) throw new Error('Expected a written aggregate');
  return last;
}

describe('AddCompletedWorkoutExerciseUseCase', () => {
  it('appends the added exercise at the end of the stored order', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute(addition());

    expect(outcome.status).toBe('added');
    const stored = written(sessions);
    expect(stored.exercises).toHaveLength(3);
    expect(stored.exercises.map((entry) => entry.position)).toEqual([0, 1, 2]);
    expect(stored.exercises.at(-1)?.exerciseNameSnapshot).toBe('Incline press');
  });

  it('leaves every existing exercise identifier, position, and snapshot alone', async () => {
    const { sessions, useCase } = fixture();

    await useCase.execute(addition());

    const stored = written(sessions);
    expect(stored.exercises.slice(0, 2).map((entry) => entry.id.value)).toEqual(
      [firstExerciseId, secondExerciseId],
    );
    expect(
      stored.exercises.slice(0, 2).map((entry) => entry.exerciseNameSnapshot),
    ).toEqual(['Bench press', 'Overhead press']);
    expect(
      stored.exercises
        .slice(0, 2)
        .flatMap((entry) => entry.sets.map((s) => s.id.value)),
    ).toEqual([
      '550e8400-e29b-41d4-a716-4466554400b0',
      '550e8400-e29b-41d4-a716-4466554400b1',
    ]);
  });

  it('captures the snapshot from the definition selected at that moment', async () => {
    const { catalog, sessions, useCase } = fixture();

    await useCase.execute(addition());

    const added = written(sessions).exercises.at(-1);
    expect(catalog.requested).toEqual([definitionId]);
    expect(added?.exerciseNameSnapshot).toBe('Incline press');
    expect(added?.loggingModeSnapshot).toBe('repetitions');
    expect(added?.sourceExerciseDefinitionId.value).toBe(definitionId);
  });

  it('captures no planned prescription, because no plan prescribed it', async () => {
    const { sessions, useCase } = fixture();

    await useCase.execute(addition());

    const added = written(sessions).exercises.at(-1);
    expect(added?.plannedPrescriptionSnapshot).toBeNull();
    expect(added?.sourcePlannedExerciseId).toBeNull();
  });

  it('records the first set with the added exercise', async () => {
    const { sessions, useCase } = fixture();

    await useCase.execute(addition());

    const added = written(sessions).exercises.at(-1);
    expect(added?.sets).toHaveLength(1);
    expect(added?.sets[0]?.position).toBe(0);
    expect(added?.sets[0]?.result).toEqual(RepetitionResult.valid(10));
  });

  it('leaves the parent lifecycle untouched', async () => {
    const { sessions, useCase } = fixture();

    await useCase.execute(addition());

    const stored = written(sessions);
    expect(stored.status).toBe('completed');
    expect(stored.name).toBe('Push day');
    expect(stored.startedAtEpochMilliseconds).toBe(startedAt);
    expect(stored.completedAtEpochMilliseconds).toBe(completedAt);
    expect(stored.startedLocalCalendarDate).toBe('2023-11-14');
  });

  it('refuses a result that does not match the captured logging mode', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute(
      addition({ definitionId: durationDefinitionId }),
    );

    expect(refusal(outcome)).toBe('invalid-result');
    expect(sessions.corrections).toEqual([]);
  });

  it('accepts a result that matches a non-repetition logging mode', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute(
      addition({
        definitionId: durationDefinitionId,
        result: DurationResult.valid(unwrap(Duration.create(90, 'second'))),
      }),
    );

    expect(outcome.status).toBe('added');
    expect(written(sessions).exercises.at(-1)?.loggingModeSnapshot).toBe(
      'duration',
    );
  });

  it('refuses an addition beyond the maximum number of exercises', async () => {
    const full = Array.from({ length: 100 }, (_, position) =>
      exercise(
        `550e8400-e29b-41d4-a716-44665544${String(position).padStart(4, '0')}`,
        position,
        `Exercise ${position + 1}`,
        position === 0
          ? [recordedSet('550e8400-e29b-41d4-a716-4466554400b0', 8)]
          : [],
      ),
    );
    const { catalog, sessions, useCase } = fixture(session(full));

    const outcome = await useCase.execute(addition());

    expect(refusal(outcome)).toBe('workout-full');
    expect(sessions.corrections).toEqual([]);
    expect(catalog.requested).toEqual([]);
  });

  it('reports a missing workout as no longer available', async () => {
    const { sessions, useCase } = fixture(null);

    const outcome = await useCase.execute(addition());

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses an active session so addition cannot reach a live workout', async () => {
    const { sessions, useCase } = fixture(session(performed(), 'active', null));

    const outcome = await useCase.execute(addition());

    expect(refusal(outcome)).toBe('not-completed');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses a definition that is no longer in the catalog', async () => {
    const { sessions, useCase } = fixture(session(performed()), []);

    const outcome = await useCase.execute(addition());

    expect(refusal(outcome)).toBe('definition-not-found');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses an invalid workout identifier without reaching storage', async () => {
    const { catalog, sessions, useCase } = fixture();

    const outcome = await useCase.execute(
      addition({ sessionId: 'not-a-uuid' }),
    );

    expect(refusal(outcome)).toBe('not-found');
    expect(sessions.corrections).toEqual([]);
    expect(catalog.requested).toEqual([]);
  });

  it('refuses an invalid definition identifier without reaching storage', async () => {
    const { catalog, sessions, useCase } = fixture();

    const outcome = await useCase.execute(
      addition({ definitionId: 'not-a-uuid' }),
    );

    expect(refusal(outcome)).toBe('definition-not-found');
    expect(sessions.corrections).toEqual([]);
    expect(catalog.requested).toEqual([]);
  });

  it('refuses when the stored completion instant differs from the loaded one', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute(
      addition({
        expected: {
          completedAtEpochMilliseconds: completedAt + 1,
          startedAtEpochMilliseconds: startedAt,
        },
      }),
    );

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.corrections).toEqual([]);
  });

  it('refuses when the stored start instant differs from the loaded one', async () => {
    const { sessions, useCase } = fixture();

    const outcome = await useCase.execute(
      addition({
        expected: {
          completedAtEpochMilliseconds: completedAt,
          startedAtEpochMilliseconds: startedAt - 1,
        },
      }),
    );

    expect(refusal(outcome)).toBe('changed');
    expect(sessions.corrections).toEqual([]);
  });

  it('appends a second exercise rather than replacing the first when submitted twice', async () => {
    const { sessions, useCase } = fixture();

    const first = await useCase.execute(addition());
    const second = await useCase.execute(addition());

    expect(first.status).toBe('added');
    expect(second.status).toBe('added');
    expect(written(sessions).exercises).toHaveLength(4);
    expect(written(sessions).exercises.map((entry) => entry.position)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('preserves the stored workout when the write fails', async () => {
    const { sessions, useCase } = fixture();
    sessions.failOnCorrect = true;

    await expect(useCase.execute(addition())).rejects.toThrow();

    expect(sessions.stored?.exercises).toHaveLength(2);
    expect(sessions.corrections).toEqual([]);
  });
});
