import type { DataRestoreTransactionContext } from './data-restore-transaction-context';
import type { RestoreData } from './restore-data';

/**
 * Writes a validated export through each capability's own repository.
 *
 * Insertion order follows the schema: exercise definitions precede the planner
 * that references them. Sessions carry no foreign key to the catalog by design,
 * so completed history is written whether or not its definitions still exist.
 *
 * This lives on its own because two workflows write the same validated model —
 * restoring into an empty installation, and replacing an existing dataset — and
 * an order shaped by the schema must have exactly one definition. A capability
 * added later is added here once.
 *
 * It interprets nothing. Everything it receives has already passed structural
 * validation, domain reconstruction, and referential checks.
 */
export async function writeRestoreData(
  context: DataRestoreTransactionContext,
  data: RestoreData,
): Promise<void> {
  if (data.profile !== null) await context.profile.save(data.profile);
  if (data.goal !== null) await context.goals.save(data.goal);

  for (const item of data.nutritionCatalogItems)
    await context.nutritionCatalog.insert(item);
  for (const entry of data.nutritionEntries)
    await context.nutritionEntries.insert(entry);

  for (const entry of data.hydrationEntries)
    await context.hydrationEntries.insert(entry);
  if (data.hydrationTarget !== null)
    await context.hydrationTarget.save(data.hydrationTarget);

  for (const item of data.exercises) await context.exerciseCatalog.insert(item);
  for (const workout of data.plannedWorkouts)
    await context.planner.replace(workout);

  for (const session of data.completedSessions)
    await context.sessions.insert(session);
  if (data.activeSession !== null)
    await context.sessions.insert(data.activeSession);

  for (const entry of data.bodyWeightCheckIns)
    await context.bodyWeight.insert(entry);
}
