import type {
  ExerciseEquipment,
  ExerciseLoggingMode,
  ExerciseMuscleGroup,
} from '@fitness/domain';

/**
 * The starter Exercise Definitions a person may add to an empty library in one
 * deliberate act.
 *
 * This is content, not a seed. Nothing here reaches the database until the
 * person presses the control that says it will, which is what keeps the restore
 * precondition, erasure, and replacement exactly as Specification 0027 found
 * them. It lives in the application layer rather than in `packages/domain`
 * because the domain owns the vocabularies and this is one valid arrangement of
 * them, with no invariant of its own.
 *
 * Identifiers are UUID version 5 literals derived offline from the URL namespace
 * `6ba7b812-9dad-11d1-80b4-00c04fd430c8` and the entry's normalized name, so the
 * same starter exercise means the same thing on every installation and across a
 * restore. Nothing is hashed at run time, so no dependency is needed. They
 * cannot collide with a definition the person creates: `expo-crypto` emits
 * version 4 identifiers and these are version 5.
 *
 * No entry carries notes, because notes are where technique, physiological, or
 * programming guidance would creep in, and none is favorited, because a favorite
 * is the person's own statement. Both are asserted by the accompanying tests
 * rather than left to a reviewer's judgement, as is the coverage this set
 * promises: every logging mode, nine of ten equipment values, twelve of thirteen
 * muscle groups, and ten definitions that need no equipment at all.
 */
export type StarterExercise = Readonly<{
  equipment: ExerciseEquipment;
  id: string;
  loggingMode: ExerciseLoggingMode;
  name: string;
  primaryMuscleGroup: ExerciseMuscleGroup;
}>;

export const starterExercises: readonly StarterExercise[] = Object.freeze([
  {
    equipment: 'bodyweight',
    id: 'c335a500-2af1-5c5f-bb9c-cb3eb2aca115',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Push-up',
    primaryMuscleGroup: 'chest',
  },
  {
    equipment: 'bodyweight',
    id: 'f1ef0068-056d-5e26-bd20-3ac5c0c60ca2',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Pull-up',
    primaryMuscleGroup: 'back',
  },
  {
    equipment: 'bodyweight',
    id: '08ecf395-7a08-59d8-9ced-92cb88aa3ce2',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Chin-up',
    primaryMuscleGroup: 'biceps',
  },
  {
    equipment: 'bodyweight',
    id: 'c9324ab0-e11e-501d-b94c-dfdfc90d1cf6',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Dip',
    primaryMuscleGroup: 'triceps',
  },
  {
    equipment: 'bodyweight',
    id: '2d6e2a9a-b7a3-5279-b770-abeabb287114',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Bodyweight Squat',
    primaryMuscleGroup: 'quadriceps',
  },
  {
    equipment: 'bodyweight',
    id: '749dd9fc-f17e-53bd-bd7b-3c3fa9524147',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Lunge',
    primaryMuscleGroup: 'glutes',
  },
  {
    equipment: 'bodyweight',
    id: '99e8305c-db80-5819-9f31-035f843941b8',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Calf Raise',
    primaryMuscleGroup: 'calves',
  },
  {
    equipment: 'bodyweight',
    id: '98f6e7b6-1098-5c88-a5ca-3ea69c9bfc99',
    loggingMode: 'bodyweight-and-repetitions',
    name: 'Sit-up',
    primaryMuscleGroup: 'core',
  },
  {
    equipment: 'bodyweight',
    id: '7079dfe9-9fc2-5b87-a839-2d177ec9c8a8',
    loggingMode: 'bodyweight-plus-load-and-repetitions',
    name: 'Weighted Pull-up',
    primaryMuscleGroup: 'back',
  },
  {
    equipment: 'machine',
    id: '87fffbf2-ce36-5934-a716-896bc5499861',
    loggingMode: 'assistance-and-repetitions',
    name: 'Assisted Pull-up',
    primaryMuscleGroup: 'back',
  },
  {
    equipment: 'barbell',
    id: 'b19d95f2-b2d8-5d51-a1ad-34cbb2cc72fd',
    loggingMode: 'external-load-and-repetitions',
    name: 'Barbell Back Squat',
    primaryMuscleGroup: 'quadriceps',
  },
  {
    equipment: 'barbell',
    id: '735fae41-9f78-5087-8adc-a063b3043757',
    loggingMode: 'external-load-and-repetitions',
    name: 'Barbell Deadlift',
    primaryMuscleGroup: 'hamstrings',
  },
  {
    equipment: 'barbell',
    id: 'ddfa1ed6-ee99-51b4-966b-180d61786713',
    loggingMode: 'external-load-and-repetitions',
    name: 'Barbell Bench Press',
    primaryMuscleGroup: 'chest',
  },
  {
    equipment: 'barbell',
    id: '7601ce45-9fd7-5c7a-9cef-51821d338941',
    loggingMode: 'external-load-and-repetitions',
    name: 'Barbell Overhead Press',
    primaryMuscleGroup: 'shoulders',
  },
  {
    equipment: 'barbell',
    id: 'b1855800-86bb-537f-a14c-0c7af5c4a021',
    loggingMode: 'external-load-and-repetitions',
    name: 'Barbell Row',
    primaryMuscleGroup: 'back',
  },
  {
    equipment: 'dumbbell',
    id: 'd3248f29-2cf8-534a-9bbf-c31176812773',
    loggingMode: 'external-load-and-repetitions',
    name: 'Dumbbell Lateral Raise',
    primaryMuscleGroup: 'shoulders',
  },
  {
    equipment: 'dumbbell',
    id: '46383f38-bf82-5a87-adb9-4808ce658aea',
    loggingMode: 'external-load-and-repetitions',
    name: 'Dumbbell Biceps Curl',
    primaryMuscleGroup: 'biceps',
  },
  {
    equipment: 'dumbbell',
    id: '855960d3-78e8-595b-9933-52b793df4079',
    loggingMode: 'external-load-and-repetitions',
    name: 'Dumbbell Romanian Deadlift',
    primaryMuscleGroup: 'hamstrings',
  },
  {
    equipment: 'kettlebell',
    id: '476bfcfc-0cf2-53ef-a2ca-3cabc24123fe',
    loggingMode: 'external-load-and-repetitions',
    name: 'Kettlebell Swing',
    primaryMuscleGroup: 'glutes',
  },
  {
    equipment: 'cable',
    id: '82a6ee9f-9c73-5f83-83ce-0a82f4cae4bd',
    loggingMode: 'external-load-and-repetitions',
    name: 'Cable Triceps Pushdown',
    primaryMuscleGroup: 'triceps',
  },
  {
    equipment: 'machine',
    id: 'db6aa066-ea51-59d3-b7e4-2cdccf9c1248',
    loggingMode: 'external-load-and-repetitions',
    name: 'Machine Leg Press',
    primaryMuscleGroup: 'quadriceps',
  },
  {
    equipment: 'resistance-band',
    id: 'd1ed1378-0513-599b-8ce2-1fb554226064',
    loggingMode: 'external-load-and-repetitions',
    name: 'Resistance Band Row',
    primaryMuscleGroup: 'back',
  },
  {
    equipment: 'none',
    id: '1f84c6f7-9d3a-5864-adcf-52603afb15ce',
    loggingMode: 'repetitions',
    name: 'Burpee',
    primaryMuscleGroup: 'full-body',
  },
  {
    equipment: 'bodyweight',
    id: '9c1c50f4-c8e4-509c-91d8-77c8d36f0a0c',
    loggingMode: 'duration',
    name: 'Plank',
    primaryMuscleGroup: 'core',
  },
  {
    equipment: 'cardio-machine',
    id: 'ecff738b-00af-5561-a959-d9d94632b3ec',
    loggingMode: 'distance',
    name: 'Stationary Bike',
    primaryMuscleGroup: 'conditioning',
  },
  {
    equipment: 'none',
    id: 'bdfdcd04-809f-51d1-af67-eef88eb20adb',
    loggingMode: 'distance-and-duration',
    name: 'Run',
    primaryMuscleGroup: 'conditioning',
  },
] as const satisfies readonly StarterExercise[]);

/**
 * Stated once so the interface, the result sentences, and the tests all count
 * the same set, and so a content change that forgets one of them fails loudly.
 */
export const starterExerciseCount = starterExercises.length;
