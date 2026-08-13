import type { DomainId, ExerciseLoggingMode } from '@fitness/domain';

/**
 * The single definition of which personal-record claims this application is
 * willing to make.
 *
 * Everything downstream is generated from these descriptors: the statement the
 * reader builds, the categories presentation can render, and the units labels
 * speak. Comparison rules therefore exist once rather than in SQL and again in
 * TypeScript.
 *
 * Two logging modes may share one category only when they produce the identical
 * domain result variant and neither records a load value. `repetitions` and
 * `bodyweight-and-repetitions` are the only pair that qualifies; every other
 * mode keeps its own category so unlike work is never compared.
 */
export const personalRecordCategories = Object.freeze([
  'most-repetitions',
  'heaviest-load',
  'heaviest-added-load',
  'longest-duration',
  'longest-distance',
  'longest-distance-with-duration',
  'longest-duration-with-distance',
] as const);

export type PersonalRecordCategory = (typeof personalRecordCategories)[number];

/**
 * The measured dimension a category orders on. Infrastructure maps this to a
 * stored column; the application never names one.
 */
export type PersonalRecordDimension =
  'distance' | 'duration' | 'repetitions' | 'resistance';

export type PersonalRecordUnit =
  'grams' | 'millimeters' | 'repetitions' | 'seconds';

export type PersonalRecordDescriptor = Readonly<{
  category: PersonalRecordCategory;
  dimension: PersonalRecordDimension;
  eligibleLoggingModes: readonly ExerciseLoggingMode[];
  label: string;
}>;

export const personalRecordDescriptors: readonly PersonalRecordDescriptor[] =
  Object.freeze([
    Object.freeze({
      category: 'most-repetitions',
      dimension: 'repetitions',
      eligibleLoggingModes: Object.freeze([
        'repetitions',
        'bodyweight-and-repetitions',
      ] as const),
      label: 'Most recorded repetitions in a set',
    }),
    Object.freeze({
      category: 'heaviest-load',
      dimension: 'resistance',
      eligibleLoggingModes: Object.freeze([
        'external-load-and-repetitions',
      ] as const),
      label: 'Heaviest recorded load in a set',
    }),
    Object.freeze({
      category: 'heaviest-added-load',
      dimension: 'resistance',
      eligibleLoggingModes: Object.freeze([
        'bodyweight-plus-load-and-repetitions',
      ] as const),
      label: 'Heaviest recorded added load in a set',
    }),
    Object.freeze({
      category: 'longest-duration',
      dimension: 'duration',
      eligibleLoggingModes: Object.freeze(['duration'] as const),
      label: 'Longest recorded duration in a set',
    }),
    Object.freeze({
      category: 'longest-distance',
      dimension: 'distance',
      eligibleLoggingModes: Object.freeze(['distance'] as const),
      label: 'Longest recorded distance in a set',
    }),
    Object.freeze({
      category: 'longest-distance-with-duration',
      dimension: 'distance',
      eligibleLoggingModes: Object.freeze(['distance-and-duration'] as const),
      label: 'Longest recorded distance in a set',
    }),
    Object.freeze({
      category: 'longest-duration-with-distance',
      dimension: 'duration',
      eligibleLoggingModes: Object.freeze(['distance-and-duration'] as const),
      label: 'Longest recorded duration in a set',
    }),
  ] as const);

export type ExercisePersonalRecordOccurrence = Readonly<{
  exerciseNameSnapshot: string;
  sessionId: DomainId;
  sessionNameSnapshot: string;
  setPosition: number;
  startedLocalCalendarDate: string;
}>;

export type ExercisePersonalRecord = Readonly<{
  canonicalValue: number;
  category: PersonalRecordCategory;
  loggingMode: ExerciseLoggingMode;
  occurrence: ExercisePersonalRecordOccurrence;
}>;

export type ExercisePersonalRecords = Readonly<{
  latestExerciseNameSnapshot: string | null;
  records: readonly ExercisePersonalRecord[];
  unsupportedLoggingModes: readonly ExerciseLoggingMode[];
}>;

export const emptyExercisePersonalRecords: ExercisePersonalRecords =
  Object.freeze({
    latestExerciseNameSnapshot: null,
    records: Object.freeze([]),
    unsupportedLoggingModes: Object.freeze([]),
  });

export function personalRecordDescriptor(
  category: PersonalRecordCategory,
): PersonalRecordDescriptor {
  const descriptor = personalRecordDescriptors.find(
    (candidate) => candidate.category === category,
  );
  if (descriptor === undefined)
    throw new Error('Personal record category is not described.');
  return descriptor;
}

export function personalRecordDescriptorsFor(
  loggingMode: ExerciseLoggingMode,
): readonly PersonalRecordDescriptor[] {
  return personalRecordDescriptors.filter((descriptor) =>
    descriptor.eligibleLoggingModes.includes(loggingMode),
  );
}

/**
 * `assistance-and-repetitions` is deliberately absent. Less assistance and more
 * repetitions do not order together, so the screen explains that instead of
 * presenting a value, and an unsupported mode is never shown as a zero.
 */
export function isPersonalRecordLoggingModeSupported(
  loggingMode: ExerciseLoggingMode,
): boolean {
  return personalRecordDescriptorsFor(loggingMode).length > 0;
}

export function canonicalUnitFor(
  dimension: PersonalRecordDimension,
): PersonalRecordUnit {
  if (dimension === 'repetitions') return 'repetitions';
  if (dimension === 'resistance') return 'grams';
  if (dimension === 'duration') return 'seconds';
  return 'millimeters';
}
