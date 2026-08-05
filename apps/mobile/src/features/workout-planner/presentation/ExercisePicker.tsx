import { useEffect, useState } from 'react';
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

export function ExercisePicker({
  browse,
  onCancel,
  onSelect,
}: Readonly<{
  browse: BrowseExercisesUseCase;
  onCancel: () => void;
  onSelect: (item: ExerciseCatalogItem) => void;
}>) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<readonly ExerciseCatalogItem[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const timeout = setTimeout(() => {
      const result =
        query.trim() === '' ? browse.listAll() : browse.search(query);
      void result.then(setItems).catch(() => {
        setError('Exercises could not be loaded.');
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [browse, query]);

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText accessibilityRole="header" variant="heading">
        Add exercise
      </AppText>
      <TextField
        label="Search exercises"
        onChangeText={setQuery}
        value={query}
      />
      {error ? (
        <AppText accessibilityLiveRegion="polite" color="danger">
          {error}
        </AppText>
      ) : items.length === 0 ? (
        <EmptyState
          description="Create exercises in the Exercise Library before adding them to a plan."
          icon="barbell-outline"
          title="No exercises found"
        />
      ) : (
        items.map((item) => (
          <Card
            accessibilityLabel={`Add ${item.definition.name}`}
            key={item.definition.id.value}
            onPress={() => onSelect(item)}
            variant="outlined"
          >
            <AppText variant="heading">{item.definition.name}</AppText>
            <AppText color="secondary">
              Configure its planned target after adding it.
            </AppText>
          </Card>
        ))
      )}
      <AppButton
        label="Cancel adding exercise"
        onPress={onCancel}
        variant="ghost"
      />
    </View>
  );
}
