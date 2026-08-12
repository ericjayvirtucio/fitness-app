import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { RestoreData } from '../../data-restore/application/restore-data';

/**
 * The same eight stored-data probes restore and erasure use, keyed by
 * capability instead of listed.
 *
 * Erasure only ever asks "does anything remain", so an array is enough there.
 * Replacement has to compare what a capability holds afterwards with what the
 * validated file said it should hold, which needs each answer attached to the
 * capability it came from.
 */
export type CapabilityPresenceProbes = Readonly<{
  bodyWeight: StoredDataProbe;
  exerciseCatalog: StoredDataProbe;
  goal: StoredDataProbe;
  hydration: StoredDataProbe;
  nutrition: StoredDataProbe;
  personalProfile: StoredDataProbe;
  workoutPlanner: StoredDataProbe;
  workoutSession: StoredDataProbe;
}>;

export type CapabilityPresence = Readonly<
  Record<keyof CapabilityPresenceProbes, boolean>
>;

/**
 * What each capability must hold once the validated file has been written.
 *
 * Two capabilities answer for more than one table — Nutrition covers entries
 * and catalog items, Hydration covers entries and the current target — so their
 * expectation is the union. That makes verification coarser for those two than
 * for the rest, which is stated in the specification rather than implied away.
 */
export function toExpectedCapabilityPresence(
  data: RestoreData,
): CapabilityPresence {
  return Object.freeze({
    bodyWeight: data.bodyWeightCheckIns.length > 0,
    exerciseCatalog: data.exercises.length > 0,
    goal: data.goal !== null,
    hydration:
      data.hydrationEntries.length > 0 || data.hydrationTarget !== null,
    nutrition:
      data.nutritionEntries.length > 0 || data.nutritionCatalogItems.length > 0,
    personalProfile: data.profile !== null,
    workoutPlanner: data.plannedWorkouts.length > 0,
    workoutSession:
      data.completedSessions.length > 0 || data.activeSession !== null,
  });
}

export async function readCapabilityPresence(
  probes: CapabilityPresenceProbes,
): Promise<CapabilityPresence> {
  return Object.freeze({
    bodyWeight: await probes.bodyWeight.hasStoredRecords(),
    exerciseCatalog: await probes.exerciseCatalog.hasStoredRecords(),
    goal: await probes.goal.hasStoredRecords(),
    hydration: await probes.hydration.hasStoredRecords(),
    nutrition: await probes.nutrition.hasStoredRecords(),
    personalProfile: await probes.personalProfile.hasStoredRecords(),
    workoutPlanner: await probes.workoutPlanner.hasStoredRecords(),
    workoutSession: await probes.workoutSession.hasStoredRecords(),
  });
}

/**
 * True when no capability holds anything. A valid export can legitimately be
 * empty, and replacing populated information with one is the same outcome as
 * deleting it, so the workflow has to be able to say that out loud rather than
 * showing a preview of nothing.
 */
export function holdsNoRecords(presence: CapabilityPresence): boolean {
  return capabilityNames.every((name) => !presence[name]);
}

export function isSameCapabilityPresence(
  expected: CapabilityPresence,
  actual: CapabilityPresence,
): boolean {
  return capabilityNames.every((name) => expected[name] === actual[name]);
}

const capabilityNames: readonly (keyof CapabilityPresenceProbes)[] = [
  'bodyWeight',
  'exerciseCatalog',
  'goal',
  'hydration',
  'nutrition',
  'personalProfile',
  'workoutPlanner',
  'workoutSession',
];
