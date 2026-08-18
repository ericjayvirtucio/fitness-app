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

  it('describes every logging mode the domain defines', () => {
    const unsupported = exerciseLoggingModes.filter(
      (mode) => !isPersonalRecordLoggingModeSupported(mode),
    );

    expect(unsupported).toEqual([]);
  });

  it('declares which end of its dimension every category orders on', () => {
    personalRecordDescriptors.forEach((descriptor) => {
      expect(['ascending', 'descending']).toContain(descriptor.direction);
    });
  });

  it('cannot decide a direction from the dimension alone', () => {
    const resistanceDirections = new Set(
      personalRecordDescriptors
        .filter((descriptor) => descriptor.dimension === 'resistance')
        .map((descriptor) => descriptor.direction),
    );

    expect(resistanceDirections).toEqual(new Set(['ascending', 'descending']));
  });

  it('leaves every category but assistance ordered descending', () => {
    const ascending = personalRecordDescriptors.filter(
      (descriptor) => descriptor.direction === 'ascending',
    );

    expect(ascending.map((descriptor) => descriptor.category)).toEqual([
      'least-assistance',
    ]);
  });

  it('claims the assistance an assisted set needed and nothing else', () => {
    const assisted = personalRecordDescriptorsFor('assistance-and-repetitions');

    expect(assisted).toEqual([
      {
        category: 'least-assistance',
        dimension: 'resistance',
        direction: 'ascending',
        eligibleLoggingModes: ['assistance-and-repetitions'],
        label: 'Least recorded assistance in a set',
      },
    ]);
  });

  it('describes the seven categories that preceded assistance unchanged', () => {
    expect(
      personalRecordDescriptors
        .filter((descriptor) => descriptor.category !== 'least-assistance')
        .map((descriptor) => [
          descriptor.category,
          descriptor.dimension,
          descriptor.direction,
          [...descriptor.eligibleLoggingModes].join(' '),
          descriptor.label,
        ]),
    ).toEqual([
      [
        'most-repetitions',
        'repetitions',
        'descending',
        'repetitions bodyweight-and-repetitions',
        'Most recorded repetitions in a set',
      ],
      [
        'heaviest-load',
        'resistance',
        'descending',
        'external-load-and-repetitions',
        'Heaviest recorded load in a set',
      ],
      [
        'heaviest-added-load',
        'resistance',
        'descending',
        'bodyweight-plus-load-and-repetitions',
        'Heaviest recorded added load in a set',
      ],
      [
        'longest-duration',
        'duration',
        'descending',
        'duration',
        'Longest recorded duration in a set',
      ],
      [
        'longest-distance',
        'distance',
        'descending',
        'distance',
        'Longest recorded distance in a set',
      ],
      [
        'longest-distance-with-duration',
        'distance',
        'descending',
        'distance-and-duration',
        'Longest recorded distance in a set',
      ],
      [
        'longest-duration-with-distance',
        'duration',
        'descending',
        'distance-and-duration',
        'Longest recorded duration in a set',
      ],
    ]);
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
