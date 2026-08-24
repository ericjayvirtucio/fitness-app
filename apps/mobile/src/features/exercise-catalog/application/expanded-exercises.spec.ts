import {
  DomainId,
  exerciseEquipment,
  exerciseLoggingModes,
  exerciseMuscleGroups,
} from '@fitness/domain';
import { buildExerciseCatalogItem } from './build-exercise-catalog-item';
import { expandedExerciseCount, expandedExercises } from './expanded-exercises';
import { normalizeExerciseName } from './exercise-catalog-name';
import { starterExercises } from './starter-exercises';

/**
 * Verified the way Specification 0027 verifies the starter set: every promise
 * this content makes about its size, its validity, its identity, and its
 * disjointness from the starter set is asserted here, so a content change
 * that breaks one of them fails loudly rather than silently reaching a
 * device.
 */
describe('expanded exercises', () => {
  it('holds the reviewed number of definitions', () => {
    expect(expandedExerciseCount).toBe(189);
    expect(expandedExercises).toHaveLength(189);
  });

  it('builds a valid catalog item from every entry', () => {
    for (const entry of expandedExercises) {
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
    const identifiers = expandedExercises.map((entry) => entry.id);

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
    const names = expandedExercises.map((entry) =>
      normalizeExerciseName(entry.name),
    );

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).not.toBe('');
    for (const entry of expandedExercises)
      expect(entry.name.length).toBeLessThanOrEqual(80);
  });

  it('names only supported equipment, muscle groups, and logging modes', () => {
    for (const entry of expandedExercises) {
      expect(exerciseEquipment).toContain(entry.equipment);
      expect(exerciseMuscleGroups).toContain(entry.primaryMuscleGroup);
      expect(exerciseLoggingModes).toContain(entry.loggingMode);
    }
  });

  /**
   * `other` is a fallback for a definition a person writes, not curated
   * content: the starter set never uses it either, and this pack follows the
   * same rule so every entry is confidently classified rather than shrugged
   * into the catch-all.
   */
  it('never uses the fallback equipment or muscle group', () => {
    for (const entry of expandedExercises) {
      expect(entry.equipment).not.toBe('other');
      expect(entry.primaryMuscleGroup).not.toBe('other');
    }
  });

  it('reaches every equipment value the pack is meant to cover', () => {
    const equipment = new Set(
      expandedExercises.map((entry) => entry.equipment),
    );
    for (const value of exerciseEquipment) {
      if (value === 'other') continue;
      expect(equipment.has(value)).toBe(true);
    }
  });

  /**
   * `full-body` is excluded alongside `other`: the source dataset's target
   * classification has no full-body category, and the starter set already
   * covers it with Burpee, so nothing here is mischaracterized just to claim
   * the label. Combined, the starter set and this pack reach every muscle
   * group.
   */
  it('reaches every other muscle group the pack is meant to cover', () => {
    const muscles = new Set(
      expandedExercises.map((entry) => entry.primaryMuscleGroup),
    );
    for (const value of exerciseMuscleGroups) {
      if (value === 'other' || value === 'full-body') continue;
      expect(muscles.has(value)).toBe(true);
    }
  });

  it('carries no notes, so no entry can imply guidance', () => {
    for (const entry of expandedExercises) {
      expect(Object.hasOwn(entry, 'notes')).toBe(false);
    }
  });

  it("favorites nothing, because a favorite is the person's own statement", () => {
    for (const entry of expandedExercises) {
      expect(Object.hasOwn(entry, 'isFavorite')).toBe(false);
    }
  });

  /**
   * The whole reason this pack is additive rather than a replacement: a
   * person who has already added the starter set must be able to add this
   * pack too and get every entry from both, never a silent collision.
   */
  it('shares no identifier or normalized name with the starter set', () => {
    const starterIds = new Set(starterExercises.map((entry) => entry.id));
    const starterNames = new Set(
      starterExercises.map((entry) => normalizeExerciseName(entry.name)),
    );

    for (const entry of expandedExercises) {
      expect(starterIds.has(entry.id)).toBe(false);
      expect(starterNames.has(normalizeExerciseName(entry.name))).toBe(false);
    }
  });
});
