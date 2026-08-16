import {
  DomainId,
  exerciseEquipment,
  exerciseLoggingModes,
  exerciseMuscleGroups,
} from '@fitness/domain';
import { buildExerciseCatalogItem } from './build-exercise-catalog-item';
import { normalizeExerciseName } from './exercise-catalog-name';
import { starterExercises, starterExerciseCount } from './starter-exercises';

/**
 * The starter set is a product surface, so it is verified the way a schema is
 * rather than the way a fixture is. Every promise Specification 0027 makes about
 * the content — its size, its coverage, its identity, and what it deliberately
 * omits — is asserted here, so changing the file without changing the
 * specification fails.
 */
describe('starter exercises', () => {
  it('holds exactly the reviewed number of definitions', () => {
    expect(starterExerciseCount).toBe(26);
    expect(starterExercises).toHaveLength(26);
  });

  it('builds a valid catalog item from every entry', () => {
    for (const entry of starterExercises) {
      const item = buildExerciseCatalogItem(entry.id, {
        equipment: entry.equipment,
        isFavorite: false,
        loggingMode: entry.loggingMode,
        name: entry.name,
        primaryMuscleGroup: entry.primaryMuscleGroup,
      });

      expect(item.isSuccess).toBe(true);
    }
  });

  it('carries unique, well-formed, stable identifiers', () => {
    const identifiers = starterExercises.map((entry) => entry.id);

    for (const identifier of identifiers) {
      expect(DomainId.create(identifier).isSuccess).toBe(true);
      // Version 5 keeps the set disjoint from the version 4 identifiers
      // `expo-crypto` generates for a definition the person creates.
      expect(identifier[14]).toBe('5');
      expect(identifier).toBe(identifier.toLowerCase());
    }

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it('carries names that stay distinct after normalization', () => {
    const names = starterExercises.map((entry) =>
      normalizeExerciseName(entry.name),
    );

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).not.toBe('');
  });

  it('reaches every logging mode', () => {
    const modes = new Set(starterExercises.map((entry) => entry.loggingMode));

    expect(modes.size).toBe(exerciseLoggingModes.length);
    for (const mode of exerciseLoggingModes) expect(modes.has(mode)).toBe(true);
  });

  it('names only supported equipment and muscle groups', () => {
    for (const entry of starterExercises) {
      expect(exerciseEquipment).toContain(entry.equipment);
      expect(exerciseMuscleGroups).toContain(entry.primaryMuscleGroup);
    }
  });

  it('covers every equipment value and muscle group except the fallbacks', () => {
    const equipment = new Set(starterExercises.map((entry) => entry.equipment));
    const muscles = new Set(
      starterExercises.map((entry) => entry.primaryMuscleGroup),
    );

    for (const value of exerciseEquipment) {
      expect(equipment.has(value)).toBe(value !== 'other');
    }
    for (const value of exerciseMuscleGroups) {
      expect(muscles.has(value)).toBe(value !== 'other');
    }
  });

  it('stays usable for a person who owns no equipment', () => {
    const withoutEquipment = starterExercises.filter(
      (entry) => entry.equipment === 'bodyweight' || entry.equipment === 'none',
    );

    expect(withoutEquipment.length).toBeGreaterThanOrEqual(10);
    expect(
      new Set(withoutEquipment.map((entry) => entry.primaryMuscleGroup)).size,
    ).toBeGreaterThanOrEqual(8);
  });

  it('carries no notes, so no entry can imply guidance', () => {
    for (const entry of starterExercises) {
      expect(Object.hasOwn(entry, 'notes')).toBe(false);
    }
  });
});
