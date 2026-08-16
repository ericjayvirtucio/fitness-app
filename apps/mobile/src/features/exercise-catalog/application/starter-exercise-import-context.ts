import type { ExerciseCatalogRepository } from './exercise-catalog-repository';

/**
 * What the starter import needs inside its exclusive transaction, which is the
 * catalog and nothing else.
 *
 * `ExerciseCatalogMutationContext` also carries the planner reference reader,
 * because updating or deleting a definition has to know whether a plan points at
 * it. An import only ever adds, so no plan can reference what it writes, and
 * declaring a dependency the workflow cannot use would misstate its reach.
 */
export type StarterExerciseImportContext = Readonly<{
  catalog: ExerciseCatalogRepository;
}>;
