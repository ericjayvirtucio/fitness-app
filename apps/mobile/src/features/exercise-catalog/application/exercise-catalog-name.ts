export function normalizeExerciseName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function escapeExerciseSearch(value: string): string {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}
