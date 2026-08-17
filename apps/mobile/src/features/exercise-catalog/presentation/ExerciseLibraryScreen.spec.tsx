import type { ExerciseEquipment, ExerciseMuscleGroup } from '@fitness/domain';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { StarterExerciseImportOutcome } from '../application/add-starter-exercises-use-case';
import { buildExerciseCatalogItem } from '../application/build-exercise-catalog-item';
import type { ExerciseCatalogFilter } from '../application/exercise-catalog-filter';
import type { ExerciseCatalogItem } from '../application/exercise-catalog-item';
import { starterExerciseCount } from '../application/starter-exercises';
import { ExerciseLibraryScreen } from './ExerciseLibraryScreen';

jest.mock('expo-router', () => ({
  useFocusEffect: (() => {
    const invoked = new WeakSet<() => void>();
    return (callback: () => void) => {
      if (!invoked.has(callback)) {
        invoked.add(callback);
        queueMicrotask(callback);
      }
    };
  })(),
}));

function item(id: string, name: string): ExerciseCatalogItem {
  const built = buildExerciseCatalogItem(id, {
    equipment: 'bodyweight',
    isFavorite: false,
    loggingMode: 'bodyweight-and-repetitions',
    name,
    primaryMuscleGroup: 'chest',
  });
  if (!built.isSuccess) throw new Error('Invalid fixture');
  return built.value;
}

function classified(
  id: string,
  name: string,
  equipment: ExerciseEquipment,
  primaryMuscleGroup: ExerciseMuscleGroup,
  isFavorite = false,
): ExerciseCatalogItem {
  const built = buildExerciseCatalogItem(id, {
    equipment,
    isFavorite,
    loggingMode: 'external-load-and-repetitions',
    name,
    primaryMuscleGroup,
  });
  if (!built.isSuccess) throw new Error('Invalid fixture');
  return built.value;
}

function narrowed(
  items: readonly ExerciseCatalogItem[],
  filter?: ExerciseCatalogFilter,
): readonly ExerciseCatalogItem[] {
  return items.filter(
    (candidate) =>
      (filter?.equipment == null ||
        candidate.definition.equipment === filter.equipment) &&
      (filter?.primaryMuscleGroup == null ||
        candidate.definition.primaryMuscleGroup === filter.primaryMuscleGroup),
  );
}

type ImportResult = Promise<StarterExerciseImportOutcome>;

async function renderLibrary(
  options: Readonly<{
    execute?: () => ImportResult;
    favorites?: readonly ExerciseCatalogItem[];
    items?: readonly ExerciseCatalogItem[];
    onBrowse?: (filter?: ExerciseCatalogFilter) => Promise<void>;
    recents?: readonly ExerciseCatalogItem[];
    written?: readonly ExerciseCatalogItem[];
  }> = {},
) {
  const stored = [...(options.items ?? [])];
  const execute =
    options.execute ??
    (() =>
      Promise.resolve<StarterExerciseImportOutcome>({
        addedCount: starterExerciseCount,
        skippedCount: 0,
        status: 'imported',
      }));
  const addStarterExercises = jest.fn(async () => {
    const outcome = await execute();
    if (outcome.status === 'imported') stored.push(...(options.written ?? []));
    return outcome;
  });
  await render(
    <ExerciseLibraryScreen
      loadUseCases={() =>
        Promise.resolve({
          addStarterExercises: { execute: addStarterExercises },
          browse: {
            listAll: async (filter?: ExerciseCatalogFilter) => {
              await options.onBrowse?.(filter);
              return narrowed(stored, filter);
            },
            listFavorites: () => Promise.resolve(options.favorites ?? []),
            listRecentlyPerformed: () => Promise.resolve(options.recents ?? []),
            search: async (query: string, filter?: ExerciseCatalogFilter) => {
              await options.onBrowse?.(filter);
              return narrowed(stored, filter).filter((candidate) =>
                candidate.definition.name
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              );
            },
          },
          setFavorite: { execute: () => Promise.resolve(true) },
        } as never)
      }
      onCreate={jest.fn()}
      onEdit={jest.fn()}
    />,
  );
  return { addStarterExercises };
}

/**
 * Rendered text in document order, so the starter section's position relative to
 * the catalog it writes can be asserted rather than assumed.
 */
function renderedText(): readonly string[] {
  const collected: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      collected.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object' && 'children' in node) {
      walk(node.children);
    }
  };
  walk(screen.toJSON());
  return collected;
}

async function press(name: string) {
  await waitFor(() =>
    expect(screen.getByRole('button', { name })).toBeOnTheScreen(),
  );
  await fireEvent.press(screen.getByRole('button', { name }));
}

describe('ExerciseLibraryScreen starter exercises', () => {
  it('offers authoring and importing side by side on an empty library', async () => {
    await renderLibrary();

    await waitFor(() =>
      expect(screen.getByText('No exercises yet')).toBeOnTheScreen(),
    );
    expect(
      screen.getByRole('button', { name: 'Create first exercise' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add starter exercises' }),
    ).toBeOnTheScreen();
  });

  it('states the count and that the definitions are ordinary before the press', async () => {
    await renderLibrary();

    await waitFor(() =>
      expect(
        screen.getByText(
          new RegExp(
            `Add ${String(starterExerciseCount)} common exercises`,
            'u',
          ),
        ),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByText(/rename, change, favorite, or delete any of them/u),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/Exercises you already have are left alone/u),
    ).toBeOnTheScreen();
  });

  it('stays available once the library holds definitions', async () => {
    await renderLibrary({
      items: [item('11111111-1111-4111-8111-111111111111', 'Authored')],
    });

    await waitFor(() => expect(screen.getByText('Authored')).toBeOnTheScreen());
    expect(
      screen.getByRole('button', { name: 'Add starter exercises' }),
    ).toBeOnTheScreen();
  });

  it('states what was added', async () => {
    await renderLibrary();

    await press('Add starter exercises');

    await waitFor(() =>
      expect(
        screen.getByText(
          `Added ${String(starterExerciseCount)} exercises to your library.`,
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('states what was skipped and never counts it as added', async () => {
    await renderLibrary({
      execute: () =>
        Promise.resolve<StarterExerciseImportOutcome>({
          addedCount: starterExerciseCount - 2,
          skippedCount: 2,
          status: 'imported',
        }),
    });

    await press('Add starter exercises');

    await waitFor(() =>
      expect(
        screen.getByText(
          `Added ${String(starterExerciseCount - 2)} exercises to your library. 2 were already in your library and were left unchanged.`,
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('says nothing was added when the library already holds them all', async () => {
    await renderLibrary({
      execute: () =>
        Promise.resolve<StarterExerciseImportOutcome>({
          skippedCount: starterExerciseCount,
          status: 'unchanged',
        }),
    });

    await press('Add starter exercises');

    await waitFor(() =>
      expect(
        screen.getByText(
          `Your library already has all ${String(starterExerciseCount)} starter exercises. Nothing was added.`,
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('states that nothing changed when the import is refused', async () => {
    await renderLibrary({
      execute: () =>
        Promise.resolve<StarterExerciseImportOutcome>({
          reason: 'write-failed',
          status: 'refused',
        }),
    });

    await press('Add starter exercises');

    await waitFor(() =>
      expect(
        screen.getByText(
          'Starter exercises could not be added. Nothing was changed.',
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('announces the result politely', async () => {
    await renderLibrary();

    await press('Add starter exercises');

    await waitFor(() =>
      expect(
        screen.getByText(
          `Added ${String(starterExerciseCount)} exercises to your library.`,
        ).props.accessibilityLiveRegion,
      ).toBe('polite'),
    );
  });

  it('refuses a repeated submission while the import is running', async () => {
    let release = (): void => {};
    const pending = new Promise<StarterExerciseImportOutcome>((resolve) => {
      release = () =>
        resolve({
          addedCount: starterExerciseCount,
          skippedCount: 0,
          status: 'imported',
        });
    });
    const { addStarterExercises } = await renderLibrary({
      execute: () => pending,
    });

    await press('Add starter exercises');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add starter exercises' }),
    );

    expect(addStarterExercises).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(screen.getByText(/^Added /u)).toBeOnTheScreen());
  });

  it('lists what it added without any special case', async () => {
    const imported = [item('c335a500-2af1-5c5f-bb9c-cb3eb2aca115', 'Push-up')];
    await renderLibrary({ items: imported });

    await waitFor(() => expect(screen.getByText('Push-up')).toBeOnTheScreen());
    expect(
      screen.getByRole('button', { name: 'Edit Push-up' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add Push-up to favorites' }),
    ).toBeOnTheScreen();
  });

  it('keeps the offer and its result above the catalog it writes', async () => {
    await renderLibrary({
      items: [item('c335a500-2af1-5c5f-bb9c-cb3eb2aca115', 'Push-up')],
    });
    await waitFor(() => expect(screen.getByText('Push-up')).toBeOnTheScreen());

    await press('Add starter exercises');
    await waitFor(() => expect(screen.getByText(/^Added /u)).toBeOnTheScreen());

    // The library updates in place, so a section below the list would leave the
    // person stranded mid-catalog with the control they just pressed and its
    // result scrolled off. Order is asserted, not assumed.
    const order = renderedText();
    const section = order.indexOf('Starter exercises');
    const result = order.findIndex((text) => text.startsWith('Added '));
    const catalog = order.indexOf('All exercises');
    expect(section).toBeGreaterThan(-1);
    expect(result).toBeGreaterThan(section);
    expect(catalog).toBeGreaterThan(result);
  });

  it('refreshes an active search with what the import wrote', async () => {
    const burpee = item('1f84c6f7-9d3a-5864-adcf-52603afb15ce', 'Burpee');
    await renderLibrary({ written: [burpee] });
    await waitFor(() =>
      expect(screen.getByText('No exercises yet')).toBeOnTheScreen(),
    );
    await fireEvent.changeText(
      screen.getByLabelText('Search exercises'),
      'Burpee',
    );
    await waitFor(() =>
      expect(screen.getByText('No search results.')).toBeOnTheScreen(),
    );

    await press('Add starter exercises');

    // Search has its own effect, which an import does not re-trigger, so a stale
    // result would otherwise keep describing the catalog as it was.
    await waitFor(() => expect(screen.getByText('Burpee')).toBeOnTheScreen());
  });
});

describe('ExerciseLibraryScreen filtering', () => {
  const dumbbellChest = classified(
    '11111111-1111-4111-8111-111111111111',
    'Dumbbell Bench Press',
    'dumbbell',
    'chest',
  );
  const dumbbellBiceps = classified(
    '22222222-2222-4222-8222-222222222222',
    'Dumbbell Curl',
    'dumbbell',
    'biceps',
  );
  const barbellChest = classified(
    '33333333-3333-4333-8333-333333333333',
    'Barbell Bench Press',
    'barbell',
    'chest',
  );
  const catalog = [dumbbellChest, dumbbellBiceps, barbellChest];

  async function renderPopulated(
    options: Parameters<typeof renderLibrary>[0] = {},
  ) {
    const rendered = await renderLibrary({ items: catalog, ...options });
    await waitFor(() =>
      expect(screen.getByText('All exercises')).toBeOnTheScreen(),
    );
    return rendered;
  }

  async function choose(name: string) {
    await fireEvent.press(screen.getByRole('radio', { name }));
    await act(() => jest.advanceTimersByTime(250));
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers both filters as named groups with a selected state', async () => {
    await renderPopulated();

    expect(screen.getByLabelText('Filter by equipment')).toBeOnTheScreen();
    expect(screen.getByLabelText('Filter by muscle group')).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: true, name: 'Any equipment' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: false, name: 'Dumbbell' }),
    ).toBeOnTheScreen();
  });

  it('hides the filters while the library is empty', async () => {
    await renderLibrary();

    await waitFor(() =>
      expect(screen.getByText('No exercises yet')).toBeOnTheScreen(),
    );
    expect(
      screen.queryByLabelText('Filter by equipment'),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Filter by muscle group'),
    ).not.toBeOnTheScreen();
  });

  it('re-queries and re-renders when an equipment filter is chosen', async () => {
    await renderPopulated();

    await choose('Dumbbell');

    expect(screen.getByText('Filtered exercises')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell Curl')).toBeOnTheScreen();
    expect(screen.queryByText('Barbell Bench Press')).not.toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: true, name: 'Dumbbell' }),
    ).toBeOnTheScreen();
  });

  it('combines both filters and announces what is narrowed', async () => {
    await renderPopulated();

    await choose('Dumbbell');
    await choose('Chest');

    expect(
      screen.getByTestId('exercise-library-filter-summary'),
    ).toHaveTextContent('Filtered by Dumbbell and Chest. 1 exercise.');
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Dumbbell Curl')).not.toBeOnTheScreen();
  });

  it('applies a filter and a search together', async () => {
    await renderPopulated();

    await choose('Chest');
    await fireEvent.changeText(
      screen.getByLabelText('Search exercises'),
      'dumbbell',
    );
    await act(() => jest.advanceTimersByTime(250));

    expect(screen.getByText('Search results')).toBeOnTheScreen();
    expect(screen.getByText('Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Barbell Bench Press')).not.toBeOnTheScreen();
  });

  it('says nothing matched without claiming the library is empty', async () => {
    await renderPopulated();

    await choose('Dumbbell');
    await choose('Calves');

    expect(
      screen.getByTestId('exercise-library-filter-summary'),
    ).toHaveTextContent(
      'Filtered by Dumbbell and Calves. No exercises match these filters.',
    );
    expect(screen.queryByText('No exercises yet')).not.toBeOnTheScreen();
    expect(screen.queryByText('Filtered exercises')).not.toBeOnTheScreen();
    expect(screen.queryByText('No filtered exercises.')).not.toBeOnTheScreen();
  });

  it('distinguishes an empty filtered search from an empty filtered browse', async () => {
    await renderPopulated();

    await choose('Dumbbell');
    await fireEvent.changeText(
      screen.getByLabelText('Search exercises'),
      'barbell',
    );
    await act(() => jest.advanceTimersByTime(250));

    expect(
      screen.getByTestId('exercise-library-filter-summary'),
    ).toHaveTextContent(
      'Filtered by Dumbbell. No exercises match this search and these filters.',
    );
  });

  it('hides Favorites and Recently performed while narrowing, and restores them when cleared', async () => {
    await renderPopulated({
      favorites: [barbellChest],
      recents: [dumbbellCurlRecent()],
    });
    expect(screen.getByText('Favorites')).toBeOnTheScreen();
    expect(screen.getByText('Recently performed')).toBeOnTheScreen();

    await choose('Dumbbell');
    expect(screen.queryByText('Favorites')).not.toBeOnTheScreen();
    expect(screen.queryByText('Recently performed')).not.toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    await act(() => jest.advanceTimersByTime(250));

    expect(screen.getByText('Favorites')).toBeOnTheScreen();
    expect(screen.getByText('Recently performed')).toBeOnTheScreen();
    expect(screen.getByText('All exercises')).toBeOnTheScreen();
    // Once under Favorites and once under the restored catalog list.
    expect(screen.getAllByText('Barbell Bench Press')).toHaveLength(2);
  });

  it('clears both filters in one action', async () => {
    await renderPopulated();

    await choose('Dumbbell');
    await choose('Chest');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    await act(() => jest.advanceTimersByTime(250));

    expect(
      screen.queryByTestId('exercise-library-filter-summary'),
    ).not.toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: true, name: 'Any equipment' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: true, name: 'Any muscle group' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('All exercises')).toBeOnTheScreen();
  });

  it('never lets a superseded read overwrite a newer one', async () => {
    const pending: (() => void)[] = [];
    await renderPopulated({
      onBrowse: (filter) =>
        filter?.equipment === 'dumbbell'
          ? new Promise<void>((resolve) => pending.push(resolve))
          : Promise.resolve(),
    });

    await choose('Dumbbell');
    await choose('Any equipment');
    // The slower dumbbell read lands after the person has already gone back to
    // the whole catalog; it must not put its list back on screen.
    pending.forEach((resolve) => {
      resolve();
    });
    await act(() => jest.advanceTimersByTime(250));

    expect(screen.getByText('All exercises')).toBeOnTheScreen();
    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(
      screen.queryByTestId('exercise-library-filter-summary'),
    ).not.toBeOnTheScreen();
  });
});

function dumbbellCurlRecent(): ExerciseCatalogItem {
  return classified(
    '55555555-5555-4555-8555-555555555555',
    'Recent Exercise',
    'cable',
    'back',
  );
}
