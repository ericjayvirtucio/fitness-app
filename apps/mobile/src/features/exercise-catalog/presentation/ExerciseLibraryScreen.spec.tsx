import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { StarterExerciseImportOutcome } from '../application/add-starter-exercises-use-case';
import { buildExerciseCatalogItem } from '../application/build-exercise-catalog-item';
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

type ImportResult = Promise<StarterExerciseImportOutcome>;

async function renderLibrary(
  options: Readonly<{
    execute?: () => ImportResult;
    items?: readonly ExerciseCatalogItem[];
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
            listAll: () => Promise.resolve(stored),
            listFavorites: () => Promise.resolve([]),
            listRecentlyPerformed: () => Promise.resolve([]),
            search: (query: string) =>
              Promise.resolve(
                stored.filter((candidate) =>
                  candidate.definition.name
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                ),
              ),
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
