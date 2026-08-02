export const biologicalSexes = Object.freeze([
  'female',
  'male',
  'intersex',
  'prefer-not-to-say',
] as const);

export type BiologicalSex = (typeof biologicalSexes)[number];

export const activityLevels = Object.freeze([
  'sedentary',
  'lightly-active',
  'moderately-active',
  'very-active',
  'extremely-active',
] as const);

export type ActivityLevel = (typeof activityLevels)[number];

export const unitSystems = Object.freeze(['metric', 'imperial'] as const);

export type UnitSystem = (typeof unitSystems)[number];
