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
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { BrowseExercisesUseCase } from '../../exercise-catalog/application/exercise-catalog-use-cases';

/**
 * Wording is overridable because choosing an exercise for a plan, for an active
 * workout, and for a completed workout are different acts, while the catalog it
 * browses and the way it is searched must stay identical between them.
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
      const result = isEmptyQuery
        ? browse.listRecentlyPerformed().then(async (recents) => ({
            items: recents.length > 0 ? recents : await browse.listAll(),
            isRecent: recents.length > 0,
          }))
        : browse.search(query).then((items) => ({ items, isRecent: false }));
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
  }, [browse, query]);

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
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : items.length === 0 ? (
        <EmptyState
          description={emptyDescription}
          icon="barbell-outline"
          title="No exercises found"
        />
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
