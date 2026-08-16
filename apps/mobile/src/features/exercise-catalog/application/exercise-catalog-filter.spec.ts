import {
  createExerciseCatalogFilter,
  isExerciseCatalogFilterActive,
  noExerciseCatalogFilter,
  toEquipmentFilter,
  toMuscleGroupFilter,
} from './exercise-catalog-filter';

describe('exercise catalog filter', () => {
  it('accepts vocabulary members', () => {
    expect(toEquipmentFilter('dumbbell')).toBe('dumbbell');
    expect(toMuscleGroupFilter('chest')).toBe('chest');
  });

  it.each(['', 'DUMBBELL', 'kettleball', 'chest ', 1, null, undefined, {}])(
    'refuses to narrow on a value outside the vocabulary',
    (candidate) => {
      expect(toEquipmentFilter(candidate)).toBeNull();
      expect(toMuscleGroupFilter(candidate)).toBeNull();
    },
  );

  it('builds criteria from unvalidated input without throwing', () => {
    expect(
      createExerciseCatalogFilter({
        equipment: 'barbell',
        primaryMuscleGroup: 'not-a-muscle',
      }),
    ).toEqual({ equipment: 'barbell', primaryMuscleGroup: null });
  });

  it('reports whether anything is narrowed', () => {
    expect(isExerciseCatalogFilterActive(noExerciseCatalogFilter)).toBe(false);
    expect(
      isExerciseCatalogFilterActive({
        equipment: 'cable',
        primaryMuscleGroup: null,
      }),
    ).toBe(true);
    expect(
      isExerciseCatalogFilterActive({
        equipment: null,
        primaryMuscleGroup: 'core',
      }),
    ).toBe(true);
  });
});
