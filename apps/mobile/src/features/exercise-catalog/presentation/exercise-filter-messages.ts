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
export const filtersLabel = 'Filters';

const noFiltersAppliedMessage = 'No filters applied.';

/**
 * What the collapse control shows. The chosen values stay on it while the
 * options are put away, so a person never has to expand the control to find out
 * whether something is narrowing the list they are looking at.
 */
export function filtersControlLabel(labels: readonly string[]): string {
  return labels.length === 0
    ? filtersLabel
    : `${filtersLabel}: ${joined(labels)}`;
}

/**
 * What the collapse control is called to a screen reader: the act pressing it
 * performs, then the same sentence the summary states. A person who cannot see
 * the control hears both what it does and what is currently narrowed, and the
 * expanded state itself is carried by `accessibilityState` rather than by words.
 */
export function filtersControlAccessibilityLabel(
  isExpanded: boolean,
  labels: readonly string[],
  matchCount: number,
  hasQuery: boolean,
): string {
  const action = isExpanded ? 'Hide filters.' : 'Show filters.';
  return `${action} ${
    labels.length === 0
      ? noFiltersAppliedMessage
      : exerciseFilterSummaryMessage(labels, matchCount, hasQuery)
  }`;
}

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

/**
 * Said only when a list came back at the bound it is read under, so a truncated
 * catalog is stated rather than silently shown. The advice is to narrow further,
 * which stays true whether or not the person has already narrowed once.
 */
export function truncatedListMessage(
  shownCount: number,
  hasQuery: boolean,
): string {
  return hasQuery
    ? `Showing the first ${shownCount} matches. Narrow the list to see the rest.`
    : `Showing the first ${shownCount} exercises. Narrow the list to see the rest.`;
}

function joined(labels: readonly string[]): string {
  return labels.length > 1 ? labels.join(' and ') : (labels[0] ?? '');
}
