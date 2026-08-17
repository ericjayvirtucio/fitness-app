import type { ExerciseEquipment, ExerciseMuscleGroup } from '@fitness/domain';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { buildExerciseCatalogItem } from '../../exercise-catalog/application/build-exercise-catalog-item';
import type { ExerciseCatalogFilter } from '../../exercise-catalog/application/exercise-catalog-filter';
import type { ExerciseCatalogItem } from '../../exercise-catalog/application/exercise-catalog-item';
import type { BrowseExercisesUseCase } from '../../exercise-catalog/application/exercise-catalog-use-cases';
import { ExercisePicker } from './ExercisePicker';

function classified(
  id: string,
  name: string,
  equipment: ExerciseEquipment,
  primaryMuscleGroup: ExerciseMuscleGroup,
): ExerciseCatalogItem {
  const built = buildExerciseCatalogItem(id, {
    equipment,
    isFavorite: false,
    loggingMode: 'external-load-and-repetitions',
    name,
    primaryMuscleGroup,
  });
  if (!built.isSuccess) throw new Error('Invalid fixture');
  return built.value;
}

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
const catalog = [barbellChest, dumbbellChest, dumbbellBiceps];

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

type Browse = Readonly<{
  listAll: jest.Mock;
  listRecentlyPerformed: jest.Mock;
  search: jest.Mock;
}>;

function browsing(
  options: Readonly<{
    items?: readonly ExerciseCatalogItem[];
    onListAll?: (filter?: ExerciseCatalogFilter) => Promise<void>;
    recents?: readonly ExerciseCatalogItem[];
  }> = {},
): Browse {
  const items = options.items ?? catalog;
  return {
    listAll: jest.fn(async (filter?: ExerciseCatalogFilter) => {
      await options.onListAll?.(filter);
      return narrowed(items, filter);
    }),
    listRecentlyPerformed: jest.fn(() =>
      Promise.resolve(options.recents ?? []),
    ),
    search: jest.fn((query: string, filter?: ExerciseCatalogFilter) =>
      Promise.resolve(
        narrowed(items, filter).filter((candidate) =>
          candidate.definition.name.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    ),
  };
}

async function renderPicker(browse: Browse) {
  await render(
    <ExercisePicker
      browse={browse as unknown as BrowseExercisesUseCase}
      onCancel={jest.fn()}
      onSelect={jest.fn()}
    />,
  );
  await act(() => jest.advanceTimersByTime(250));
}

async function type(query: string) {
  await fireEvent.changeText(
    screen.getByTestId('exercise-picker-search'),
    query,
  );
  await act(() => jest.advanceTimersByTime(250));
}

describe('ExercisePicker reads', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('browses recents first and falls back to the whole catalog', async () => {
    const browse = browsing({ recents: [dumbbellBiceps] });
    await renderPicker(browse);

    await waitFor(() =>
      expect(screen.getByText('Recently performed')).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('Add Dumbbell Curl')).toBeOnTheScreen();
    expect(browse.listAll).not.toHaveBeenCalled();
  });

  it('falls back to the whole catalog when nothing has been performed', async () => {
    const browse = browsing();
    await renderPicker(browse);

    await waitFor(() =>
      expect(
        screen.getByLabelText('Add Barbell Bench Press'),
      ).toBeOnTheScreen(),
    );
    expect(screen.queryByText('Recently performed')).not.toBeOnTheScreen();
    expect(browse.listAll).toHaveBeenCalled();
  });

  it('never lets a superseded read overwrite a newer one', async () => {
    // The opening browse is held open while a search issued after it resolves.
    // Debouncing keeps a burst of keystrokes to one read; it does not order the
    // reads it does issue, so the slow first response must be discarded rather
    // than allowed to replace the list the person is now looking at.
    let release = () => {};
    const browse = browsing({
      onListAll: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    await renderPicker(browse);

    await type('Barbell');
    await waitFor(() =>
      expect(
        screen.getByLabelText('Add Barbell Bench Press'),
      ).toBeOnTheScreen(),
    );
    await act(() => {
      release();
      return Promise.resolve();
    });

    expect(screen.getByLabelText('Add Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Add Dumbbell Curl')).not.toBeOnTheScreen();
  });

  it('clears a read failure once a newer read succeeds', async () => {
    const browse = browsing();
    browse.search.mockRejectedValueOnce(new Error('unavailable'));
    await renderPicker(browse);

    await type('Curl');
    await waitFor(() =>
      expect(
        screen.getByText('Exercises could not be loaded.'),
      ).toBeOnTheScreen(),
    );

    await type('Dumbbell Curl');

    await waitFor(() =>
      expect(
        screen.queryByText('Exercises could not be loaded.'),
      ).not.toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('Add Dumbbell Curl')).toBeOnTheScreen();
  });
});
