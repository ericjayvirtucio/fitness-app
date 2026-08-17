/**
 * Every sentence the library says about a narrowed list, in one place, as the
 * starter import's messages already are. None of them interpolates a name, an
 * identifier, or anything stored: only the fixed labels of the values the person
 * chose.
 */

export const equipmentFilterLabel = 'Filter by equipment';
export const muscleFilterLabel = 'Filter by muscle group';
export const clearFiltersLabel = 'Clear filters';
export const filteredSectionTitle = 'Filtered exercises';

const noFilterMatchesMessage = 'No exercises match these filters.';
const noSearchAndFilterMatchesMessage =
  'No exercises match this search and these filters.';

/**
 * One line carries both what is narrowed and what came back, so a person who
 * cannot see the list hears the result of every change, and the empty case is a
 * statement about the filter rather than about the library.
 */
export function exerciseFilterSummaryMessage(
  labels: readonly string[],
  matchCount: number,
  hasQuery: boolean,
): string {
  const outcome =
    matchCount > 0
      ? matchCount === 1
        ? '1 exercise.'
        : `${matchCount} exercises.`
      : hasQuery
        ? noSearchAndFilterMatchesMessage
        : noFilterMatchesMessage;
  return `Filtered by ${joined(labels)}. ${outcome}`;
}

function joined(labels: readonly string[]): string {
  return labels.length > 1 ? labels.join(' and ') : (labels[0] ?? '');
}
