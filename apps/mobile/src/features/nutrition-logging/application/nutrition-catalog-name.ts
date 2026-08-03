export function normalizeNutritionCatalogName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}
