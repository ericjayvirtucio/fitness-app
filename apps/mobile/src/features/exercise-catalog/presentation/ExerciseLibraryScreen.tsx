import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { createExerciseCatalogUseCases } from '../../../composition/exercise-catalog';
import {
  AppButton,
  AppText,
  Card,
  EmptyState,
  LoadingIndicator,
  Screen,
  SectionHeader,
  TextField,
  spacing,
} from '../../../design-system';
import type { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import {
  equipmentOptions,
  labelFor,
  loggingModeOptions,
  muscleOptions,
} from './exercise-options';

type UseCases = Awaited<ReturnType<typeof createExerciseCatalogUseCases>>;
type State =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      useCases: UseCases;
      all: readonly ExerciseCatalogItem[];
      favorites: readonly ExerciseCatalogItem[];
      recents: readonly ExerciseCatalogItem[];
      search: readonly ExerciseCatalogItem[];
    };

export function ExerciseLibraryScreen({
  loadUseCases = createExerciseCatalogUseCases,
  onCreate,
  onEdit,
}: Readonly<{
  loadUseCases?: () => Promise<UseCases>;
  onCreate: () => void;
  onEdit: (id: string) => void;
}>) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(() => {
    setState({ status: 'loading' });
    void loadUseCases()
      .then(async (useCases) => {
        const [all, favorites, recents] = await Promise.all([
          useCases.browse.listAll(),
          useCases.browse.listFavorites(),
          useCases.browse.listRecentlyPerformed(),
        ]);
        setState({
          all,
          favorites,
          recents,
          search: [],
          status: 'ready',
          useCases,
        });
      })
      .catch(() => setState({ status: 'error' }));
  }, [loadUseCases]);
  useFocusEffect(load);
  useEffect(() => {
    if (state.status !== 'ready') return;
    const timeout = setTimeout(
      () =>
        void state.useCases.browse
          .search(query)
          .then((search) =>
            setState((current) =>
              current.status === 'ready' ? { ...current, search } : current,
            ),
          )
          .catch(() => setState({ status: 'error' })),
      200,
    );
    return () => clearTimeout(timeout);
  }, [query, state.status === 'ready' ? state.useCases : undefined]);

  if (state.status === 'loading')
    return (
      <Screen accessibilityLabel="Loading Exercise Library" isCentered>
        <LoadingIndicator label="Loading exercises" />
      </Screen>
    );
  if (state.status === 'error')
    return (
      <Screen accessibilityLabel="Exercise Library error" isCentered>
        <AppText accessibilityRole="header" variant="heading">
          Exercise Library unavailable
        </AppText>
        <AppText color="secondary" style={{ marginVertical: spacing.md }}>
          Your exercises could not be loaded. Nothing was changed.
        </AppText>
        <AppButton label="Try again" onPress={load} />
      </Screen>
    );
  const toggle = async (item: ExerciseCatalogItem) => {
    try {
      await state.useCases.setFavorite.execute(
        item.definition.id.value,
        !item.isFavorite,
      );
      load();
    } catch {
      setState({ status: 'error' });
    }
  };
  const results = query.trim() === '' ? state.all : state.search;
  return (
    <Screen
      accessibilityLabel="Exercise Library"
      contentContainerStyle={{ gap: spacing.xl }}
      isKeyboardAware
    >
      <View style={{ gap: spacing.sm }}>
        <AppText accessibilityRole="header" variant="display">
          Exercise Library
        </AppText>
        <AppText color="secondary">
          Reusable exercise definitions stored only on this device.
        </AppText>
      </View>
      <TextField
        label="Search exercises"
        onChangeText={setQuery}
        value={query}
      />
      {query.trim() === '' && state.all.length === 0 ? (
        <EmptyState
          actionLabel="Create first exercise"
          description="Add an exercise definition for future planning and workout logging."
          icon="barbell-outline"
          onAction={onCreate}
          title="No exercises yet"
        />
      ) : (
        <>
          {query.trim() === '' && state.favorites.length > 0 ? (
            <ExerciseSection
              items={state.favorites}
              onEdit={onEdit}
              onFavorite={(item) => void toggle(item)}
              title="Favorites"
            />
          ) : null}
          {query.trim() === '' && state.recents.length > 0 ? (
            <ExerciseSection
              items={state.recents}
              onEdit={onEdit}
              onFavorite={(item) => void toggle(item)}
              title="Recently performed"
            />
          ) : null}
          <ExerciseSection
            items={results}
            onEdit={onEdit}
            onFavorite={(item) => void toggle(item)}
            title={query.trim() === '' ? 'All exercises' : 'Search results'}
          />
        </>
      )}
      <AppButton label="Create exercise" onPress={onCreate} />
    </Screen>
  );
}

function ExerciseSection({
  items,
  onEdit,
  onFavorite,
  title,
}: Readonly<{
  items: readonly ExerciseCatalogItem[];
  onEdit: (id: string) => void;
  onFavorite: (item: ExerciseCatalogItem) => void;
  title: string;
}>) {
  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title={title} />
      {items.length === 0 ? (
        <AppText color="secondary">No {title.toLowerCase()}.</AppText>
      ) : (
        items.map((item) => {
          const exercise = item.definition;
          return (
            <Card key={exercise.id.value} variant="outlined">
              <AppText variant="heading">{exercise.name}</AppText>
              <AppText color="secondary">
                {labelFor(equipmentOptions, exercise.equipment)} ·{' '}
                {labelFor(muscleOptions, exercise.primaryMuscleGroup)} ·{' '}
                {labelFor(loggingModeOptions, exercise.loggingMode)}
              </AppText>
              <AppButton
                accessibilityLabel={`Edit ${exercise.name}`}
                label="Edit exercise"
                onPress={() => onEdit(exercise.id.value)}
                variant="outline"
              />
              <AppButton
                accessibilityLabel={`${item.isFavorite ? 'Remove' : 'Add'} ${exercise.name} ${item.isFavorite ? 'from' : 'to'} favorites`}
                label={item.isFavorite ? 'Remove favorite' : 'Add favorite'}
                onPress={() => onFavorite(item)}
                variant="outline"
              />
            </Card>
          );
        })
      )}
    </View>
  );
}
