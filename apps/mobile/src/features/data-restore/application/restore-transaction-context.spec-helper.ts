import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { DataRestoreTransactionContext } from './data-restore-transaction-context';

/**
 * A transaction context whose every repository records the call it received.
 *
 * Two workflows write the same validated model through the same repositories —
 * restoring into an empty installation, and replacing an existing dataset — so
 * both need the same fake to assert the same schema-shaped order. Keeping one
 * copy means a capability added later is added to one place.
 */
export const unsupported = (): never => {
  throw new Error('the restore called a repository method it should not use');
};

export class ScriptedProbe implements StoredDataProbe {
  private index = 0;

  constructor(private readonly answers: readonly boolean[]) {}

  hasStoredRecords(): Promise<boolean> {
    const answer = this.answers[this.index] ?? this.answers.at(-1) ?? false;
    this.index += 1;
    return Promise.resolve(answer);
  }
}

export const restoreWriteOrder = [
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

export function buildRestoreTransactionContext(
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
      correctCompleted: unsupported,
      discard: unsupported,
      getActive: unsupported,
      getById: unsupported,
      insert: write('completedSession'),
      replace: unsupported,
    },
  };
}
