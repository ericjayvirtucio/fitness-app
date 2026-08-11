import type { StoredDataProbe } from '../../../application/persistence/stored-data-probe';
import type { TransactionRunner } from '../../../application/persistence/transaction-runner';
import { DataRestoreError } from './data-restore-error';
import type { DataRestoreTransactionContext } from './data-restore-transaction-context';
import type { RestoreData } from './restore-data';

type TransactionOutcome = 'restored' | 'target-not-empty';

/**
 * Writes a validated export inside one exclusive transaction.
 *
 * Emptiness is rechecked here rather than trusted from the preview, because a
 * record can be created between the two. The check returns an outcome instead
 * of throwing so a refusal commits an empty transaction rather than travelling
 * out through the transaction runner's error translation, where its meaning
 * would be flattened into a generic persistence failure.
 *
 * Insertion order follows the schema: exercise definitions precede the planner
 * that references them. Sessions carry no foreign key to the catalog by design,
 * so completed history restores whether or not its definitions still exist.
 */
export class RestoreDataExportUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunner<DataRestoreTransactionContext>,
  ) {}

  async execute(data: RestoreData): Promise<void> {
    const outcome = await this.run(data);
    if (outcome === 'target-not-empty')
      throw new DataRestoreError('target-not-empty');
  }

  private async run(data: RestoreData): Promise<TransactionOutcome> {
    try {
      return await this.transactionRunner.run(async (context) => {
        if (await holdsStoredData(context.probes)) return 'target-not-empty';
        await write(context, data);
        return 'restored';
      });
    } catch (error: unknown) {
      throw new DataRestoreError('write-failed', { cause: error });
    }
  }
}

export async function holdsStoredData(
  probes: readonly StoredDataProbe[],
): Promise<boolean> {
  for (const probe of probes) {
    if (await probe.hasStoredRecords()) return true;
  }
  return false;
}

async function write(
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
