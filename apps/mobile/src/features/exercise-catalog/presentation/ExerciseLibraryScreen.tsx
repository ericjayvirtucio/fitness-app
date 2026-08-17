import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  isExerciseCatalogFilterActive,
  noExerciseCatalogFilter,
  type ExerciseCatalogFilter,
} from '../application/exercise-catalog-filter';
import type { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import {
  exerciseBrowseLimit,
  exerciseSearchLimit,
} from '../application/exercise-catalog-use-cases';
import { ExerciseFilterControls } from './ExerciseFilterControls';
import {
  filteredSectionTitle,
  truncatedListMessage,
} from './exercise-filter-messages';
import {
  equipmentOptions,
  labelFor,
  loggingModeOptions,
  muscleOptions,
} from './exercise-options';
import {
  starterExerciseActionLabel,
  starterExerciseExplanation,
  starterExerciseImportedMessage,
  starterExerciseRefusalMessage,
  starterExerciseSectionTitle,
  starterExerciseUnchangedMessage,
} from './starter-exercise-messages';

type UseCases = Awaited<ReturnType<typeof createExerciseCatalogUseCases>>;
type Lists = Readonly<{
  all: readonly ExerciseCatalogItem[];
  favorites: readonly ExerciseCatalogItem[];
  recents: readonly ExerciseCatalogItem[];
  search: readonly ExerciseCatalogItem[];
}>;
type State =
  | { status: 'loading' }
  | { status: 'error' }
  | ({ status: 'ready'; useCases: UseCases } & Lists);

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
  const [filter, setFilter] = useState<ExerciseCatalogFilter>(
    noExerciseCatalogFilter,
  );
  const [state, setState] = useState<State>({ status: 'loading' });
  const [starterResult, setStarterResult] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  // A filter tap and a keystroke can both be in flight, and the catalog can be
  // read again by a focus reload while either is. Only the newest read may write
  // to the screen; an older one that resolves late is dropped rather than
  // allowed to replace what the person has since asked for.
  const requestRef = useRef(0);
  const criteriaRef = useRef({ filter, query });
  useEffect(() => {
    criteriaRef.current = { filter, query };
  }, [filter, query]);

  const readLists = useCallback(
    async (
      useCases: UseCases,
      activeFilter: ExerciseCatalogFilter,
      activeQuery: string,
    ): Promise<Lists> => {
      // Favorites and Recently performed are shortcuts to the whole catalog, so
      // they are not read while the person is narrowing it — exactly as they are
      // already left unread and unshown while a search is being typed.
      const isNarrowed = isExerciseCatalogFilterActive(activeFilter);
      const empty: readonly ExerciseCatalogItem[] = [];
      const [all, favorites, recents, search] = await Promise.all([
        useCases.browse.listAll(activeFilter),
        isNarrowed ? empty : useCases.browse.listFavorites(),
        isNarrowed ? empty : useCases.browse.listRecentlyPerformed(),
        activeQuery.trim() === ''
          ? empty
          : useCases.browse.search(activeQuery, activeFilter),
      ]);
      return { all, favorites, recents, search };
    },
    [],
  );

  // Deliberately depends on neither the filter nor the query: it is the reload a
  // focus or a retry performs, and it must not re-run — flashing the loading
  // state — every time either changes. It reads whichever criteria are current.
  const load = useCallback(() => {
    setState({ status: 'loading' });
    const requestId = (requestRef.current += 1);
    void loadUseCases()
      .then(async (useCases) => {
        const { filter: activeFilter, query: activeQuery } =
          criteriaRef.current;
        const lists = await readLists(useCases, activeFilter, activeQuery);
        if (requestId !== requestRef.current) return;
        setState({ ...lists, status: 'ready', useCases });
      })
      .catch(() => {
        if (requestId === requestRef.current) setState({ status: 'error' });
      });
  }, [loadUseCases, readLists]);
  // Returning to the library is a fresh visit, so a result from an earlier one
  // is cleared here rather than left to describe a catalog the person has since
  // changed. An import reloads through `load` directly and keeps its result.
  useFocusEffect(
    useCallback(() => {
      setStarterResult(null);
      load();
    }, [load]),
  );
  useEffect(() => {
    if (state.status !== 'ready') return;
    const { useCases } = state;
    const timeout = setTimeout(() => {
      const requestId = (requestRef.current += 1);
      void readLists(useCases, filter, query)
        .then((lists) =>
          setState((current) =>
            current.status === 'ready' && requestId === requestRef.current
              ? { ...current, ...lists }
              : current,
          ),
        )
        .catch(() => {
          if (requestId === requestRef.current) setState({ status: 'error' });
        });
    }, 200);
    return () => clearTimeout(timeout);
  }, [
    filter,
    query,
    readLists,
    state.status === 'ready' ? state.useCases : undefined,
  ]);

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
  /**
   * Refreshes the lists without returning the screen to its loading state, so
   * the result of an import stays on screen and announced while the library
   * behind it updates in place.
   */
  const refreshLists = async (useCases: UseCases) => {
    // Search and the active filter are applied here too. The narrowing effect
    // only re-runs when the query, the filter, or the use cases change, and an
    // import changes none of them, so lists read before the import would
    // otherwise keep describing the catalog as it was.
    const requestId = (requestRef.current += 1);
    const lists = await readLists(useCases, filter, query);
    setState((current) =>
      current.status === 'ready' && requestId === requestRef.current
        ? { ...current, ...lists }
        : current,
    );
  };
  const addStarterExercises = async () => {
    setIsImporting(true);
    setStarterResult(null);
    try {
      const outcome = await state.useCases.addStarterExercises.execute();
      if (outcome.status === 'imported') await refreshLists(state.useCases);
      setStarterResult(
        outcome.status === 'imported'
          ? starterExerciseImportedMessage(
              outcome.addedCount,
              outcome.skippedCount,
            )
          : outcome.status === 'unchanged'
            ? starterExerciseUnchangedMessage
            : starterExerciseRefusalMessage(outcome.reason),
      );
    } catch {
      setState({ status: 'error' });
    } finally {
      setIsImporting(false);
    }
  };
  const hasQuery = query.trim() !== '';
  const isNarrowed = isExerciseCatalogFilterActive(filter);
  const results = hasQuery ? state.search : state.all;
  // An empty library is only an empty library when nothing is narrowing it.
  // While a search or a filter is applied, an empty result is a statement about
  // the narrowing, never about the catalog.
  const isEmptyLibrary = !hasQuery && !isNarrowed && state.all.length === 0;
  const isTruncated =
    results.length === (hasQuery ? exerciseSearchLimit : exerciseBrowseLimit);
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
        testID="exercise-library-search"
        value={query}
      />
      {isEmptyLibrary ? (
        <EmptyState
          actionLabel="Create first exercise"
          description="Add an exercise definition for future planning and workout logging."
          icon="barbell-outline"
          onAction={onCreate}
          title="No exercises yet"
        />
      ) : null}
      {/*
       * Above the lists, not below them. The library updates in place, so an
       * import grows the catalog above whatever the person is looking at; with
       * this section beneath the list, the retained scroll offset left them
       * stranded in the middle of twenty-six new cards with both the control
       * they had just pressed and its result off screen. Authoring still comes
       * first on an empty library, and "Create exercise" still closes the page.
       */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={starterExerciseSectionTitle} />
        <AppText color="secondary">{starterExerciseExplanation}</AppText>
        <AppButton
          isLoading={isImporting}
          label={starterExerciseActionLabel}
          onPress={() => void addStarterExercises()}
          variant="outline"
        />
        {starterResult === null ? null : (
          <AppText accessibilityLiveRegion="polite" color="secondary">
            {starterResult}
          </AppText>
        )}
      </View>
      {/*
       * Directly above the lists they narrow, and deliberately below the starter
       * section rather than beside the search field. These controls appear the
       * moment the library stops being empty, so with them above that section an
       * import inserted most of a viewport above the control the person had just
       * pressed: the screen keeps its scroll offset, and both the button and its
       * result were carried off screen — the same stranding the starter section
       * was moved above the lists to prevent, one level higher. Device QA caught
       * it there and again here. Collapsing shrinks that insertion but does not
       * remove it, because expanding restores every one of those chips right
       * here. They are absent while the library is empty, because there is
       * nothing to narrow.
       */}
      {isEmptyLibrary ? null : (
        <ExerciseFilterControls
          filter={filter}
          hasQuery={hasQuery}
          matchCount={results.length}
          onChange={setFilter}
          testIDPrefix="exercise-library"
        />
      )}
      {isEmptyLibrary ? null : (
        <>
          {!hasQuery && !isNarrowed && state.favorites.length > 0 ? (
            <ExerciseSection
              items={state.favorites}
              onEdit={onEdit}
              onFavorite={(item) => void toggle(item)}
              title="Favorites"
            />
          ) : null}
          {!hasQuery && !isNarrowed && state.recents.length > 0 ? (
            <ExerciseSection
              items={state.recents}
              onEdit={onEdit}
              onFavorite={(item) => void toggle(item)}
              title="Recently performed"
            />
          ) : null}
          {/*
           * A narrowed list that matched nothing says so once, in the summary
           * above, rather than a second time under a heading that would promise
           * results it does not have.
           */}
          {isNarrowed && results.length === 0 ? null : (
            <ExerciseSection
              items={results}
              notice={
                isTruncated
                  ? truncatedListMessage(results.length, hasQuery)
                  : undefined
              }
              onEdit={onEdit}
              onFavorite={(item) => void toggle(item)}
              title={
                hasQuery
                  ? 'Search results'
                  : isNarrowed
                    ? filteredSectionTitle
                    : 'All exercises'
              }
            />
          )}
        </>
      )}
      <AppButton label="Create exercise" onPress={onCreate} />
    </Screen>
  );
}

function ExerciseSection({
  items,
  notice,
  onEdit,
  onFavorite,
  title,
}: Readonly<{
  items: readonly ExerciseCatalogItem[];
  notice?: string | undefined;
  onEdit: (id: string) => void;
  onFavorite: (item: ExerciseCatalogItem) => void;
  title: string;
}>) {
  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title={title} />
      {notice === undefined ? null : (
        <AppText color="secondary">{notice}</AppText>
      )}
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
