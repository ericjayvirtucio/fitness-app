import {
  exerciseLoggingModes,
  type ExerciseLoggingMode,
} from '@fitness/domain';
import {
  canonicalUnitFor,
  isPersonalRecordLoggingModeSupported,
  personalRecordCategories,
  personalRecordDescriptor,
  personalRecordDescriptors,
  personalRecordDescriptorsFor,
} from './exercise-personal-records';

describe('personal record descriptors', () => {
  it('describes every category exactly once', () => {
    expect(personalRecordDescriptors).toHaveLength(
      personalRecordCategories.length,
    );
    personalRecordCategories.forEach((category) => {
      expect(personalRecordDescriptor(category).category).toBe(category);
    });
  });

  it('supports every logging mode except assistance', () => {
    const unsupported = exerciseLoggingModes.filter(
      (mode) => !isPersonalRecordLoggingModeSupported(mode),
    );

    expect(unsupported).toEqual(['assistance-and-repetitions']);
  });

  it('merges only the two repetition modes that record no load', () => {
    const merged = personalRecordDescriptors.filter(
      (descriptor) => descriptor.eligibleLoggingModes.length > 1,
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.category).toBe('most-repetitions');
    expect(merged[0]?.eligibleLoggingModes).toEqual([
      'repetitions',
      'bodyweight-and-repetitions',
    ]);
  });

  it('never compares one logging mode on the same dimension twice', () => {
    const pairs = personalRecordDescriptors.flatMap((descriptor) =>
      descriptor.eligibleLoggingModes.map(
        (mode) => `${mode}:${descriptor.dimension}`,
      ),
    );

    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('claims no load record for bodyweight-only repetitions', () => {
    const dimensions = personalRecordDescriptorsFor(
      'bodyweight-and-repetitions',
    ).map((descriptor) => descriptor.dimension);

    expect(dimensions).toEqual(['repetitions']);
  });

  it('separates external load from added bodyweight load', () => {
    const load = personalRecordDescriptorsFor('external-load-and-repetitions');
    const addedLoad = personalRecordDescriptorsFor(
      'bodyweight-plus-load-and-repetitions',
    );

    expect(load.map((descriptor) => descriptor.category)).toEqual([
      'heaviest-load',
    ]);
    expect(addedLoad.map((descriptor) => descriptor.category)).toEqual([
      'heaviest-added-load',
    ]);
  });

  it('claims no repetition record for loaded modes', () => {
    const loaded: readonly ExerciseLoggingMode[] = [
      'external-load-and-repetitions',
      'bodyweight-plus-load-and-repetitions',
    ];

    loaded.forEach((mode) => {
      expect(
        personalRecordDescriptorsFor(mode).some(
          (descriptor) => descriptor.dimension === 'repetitions',
        ),
      ).toBe(false);
    });
  });

  it('records both stored dimensions for distance and duration', () => {
    expect(
      personalRecordDescriptorsFor('distance-and-duration').map(
        (descriptor) => descriptor.dimension,
      ),
    ).toEqual(['distance', 'duration']);
  });

  it('maps every dimension to its canonical unit', () => {
    expect(canonicalUnitFor('repetitions')).toBe('repetitions');
    expect(canonicalUnitFor('resistance')).toBe('grams');
    expect(canonicalUnitFor('duration')).toBe('seconds');
    expect(canonicalUnitFor('distance')).toBe('millimeters');
  });

  it('labels every category as recorded data rather than a judgment', () => {
    personalRecordDescriptors.forEach((descriptor) => {
      expect(descriptor.label).toContain('recorded');
      expect(descriptor.label).not.toMatch(
        /best|strongest|maximum|score|elite|estimated/i,
      );
    });
  });
});
