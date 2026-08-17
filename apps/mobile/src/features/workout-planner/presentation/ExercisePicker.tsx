import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  AppButton,
  AppText,
  Card,
  EmptyState,
  TextField,
  spacing,
} from '../../../design-system';
import {
  isExerciseCatalogFilterActive,
  noExerciseCatalogFilter,
  type ExerciseCatalogFilter,
} from '../../exercise-catalog/application/exercise-catalog-filter';
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { BrowseExercisesUseCase } from '../../exercise-catalog/application/exercise-catalog-use-cases';
import { ExerciseFilterControls } from '../../exercise-catalog/presentation/ExerciseFilterControls';

/**
 * Wording is overridable because choosing an exercise for a plan, for an active
 * workout, and for a completed workout are different acts, while the catalog it
 * browses and the way it is searched must stay identical between them.
 *
 * Filtering is therefore composed here rather than offered as a prop. No
 * consumer can switch it on or off, so all three narrow the catalog the same
 * way, with the same control the Exercise Library uses.
 *
 * The criteria live with the picker, exactly as the query already does: every
 * consumer unmounts the picker when it is dismissed, so reopening one is a fresh
 * choice rather than a resumed one.
 */
export function ExercisePicker({
  browse,
  emptyDescription = 'Create exercises in the Exercise Library before adding them to a plan.',
  heading = 'Add exercise',
  itemDescription = 'Configure its planned target after adding it.',
  onCancel,
  onSelect,
}: Readonly<{
  browse: BrowseExercisesUseCase;
  emptyDescription?: string;
  heading?: string;
  itemDescription?: string;
  onCancel: () => void;
  onSelect: (item: ExerciseCatalogItem) => void;
}>) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExerciseCatalogFilter>(
    noExerciseCatalogFilter,
  );
  const [items, setItems] = useState<readonly ExerciseCatalogItem[]>([]);
  const [isShowingRecents, setIsShowingRecents] = useState(false);
  const [error, setError] = useState<string>();
  // Debouncing keeps a burst of keystrokes to one read, but it does not order
  // the reads it does issue: a slow one can still resolve after a newer one and
  // replace what the person has since asked for. Every read is numbered, and a
  // response whose number is no longer current is discarded — including its
  // failure, so a stale error cannot outlive the read that caused it.
  const requestRef = useRef(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const requestId = (requestRef.current += 1);
      const isEmptyQuery = query.trim() === '';
      // Recently performed is a shortcut to the whole catalog, so it is neither
      // read nor shown while the person is narrowing that catalog — the rule the
      // Exercise Library already applies to Favorites and Recently performed.
      // Narrowing them instead would mean filtering identifiers resolved from
      // history in presentation, which is the fetch-then-filter this capability
      // refuses. A narrowed picker therefore issues one read rather than two.
      const result =
        isEmptyQuery && !isExerciseCatalogFilterActive(filter)
          ? browse.listRecentlyPerformed().then(async (recents) => ({
              items: recents.length > 0 ? recents : await browse.listAll(),
              isRecent: recents.length > 0,
            }))
          : isEmptyQuery
            ? browse
                .listAll(filter)
                .then((items) => ({ items, isRecent: false }))
            : browse
                .search(query, filter)
                .then((items) => ({ items, isRecent: false }));
      void result
        .then((loaded) => {
          if (requestId !== requestRef.current) return;
          setItems(loaded.items);
          setIsShowingRecents(loaded.isRecent);
          setError(undefined);
        })
        .catch(() => {
          if (requestId === requestRef.current)
            setError('Exercises could not be loaded.');
        });
    }, 200);
    return () => clearTimeout(timeout);
  }, [browse, filter, query]);

  const isNarrowed = isExerciseCatalogFilterActive(filter);
  // An empty catalog has nothing to narrow, so the control is absent exactly as
  // it is on an empty Exercise Library, and the picker is as tall as it was.
  const isEmptyCatalog =
    !isNarrowed && query.trim() === '' && items.length === 0;

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText accessibilityRole="header" variant="heading">
        {heading}
      </AppText>
      <TextField
        label="Search exercises"
        onChangeText={setQuery}
        testID="exercise-picker-search"
        value={query}
      />
      {isEmptyCatalog ? null : (
        <ExerciseFilterControls
          filter={filter}
          hasQuery={query.trim() !== ''}
          matchCount={items.length}
          onChange={setFilter}
          testIDPrefix="exercise-picker"
        />
      )}
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : items.length === 0 ? (
        /*
         * A narrowed list that matched nothing already says so in the summary
         * above, and it is not the empty catalog this state describes. Saying
         * "create exercises in the Exercise Library" to somebody who has plenty
         * of them and one filter too many would simply be untrue.
         */
        isNarrowed ? null : (
          <EmptyState
            description={emptyDescription}
            icon="barbell-outline"
            title="No exercises found"
          />
        )
      ) : (
        <>
          {isShowingRecents ? (
            <AppText color="secondary">Recently performed</AppText>
          ) : null}
          {items.map((item) => (
            <Card
              accessibilityLabel={`Add ${item.definition.name}`}
              key={item.definition.id.value}
              onPress={() => onSelect(item)}
              variant="outlined"
            >
              <AppText variant="heading">{item.definition.name}</AppText>
              <AppText color="secondary">{itemDescription}</AppText>
            </Card>
          ))}
        </>
      )}
      <AppButton
        label="Cancel adding exercise"
        onPress={onCancel}
        variant="ghost"
      />
    </View>
  );
}
