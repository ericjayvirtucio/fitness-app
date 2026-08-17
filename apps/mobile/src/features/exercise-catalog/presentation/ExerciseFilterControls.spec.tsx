import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  noExerciseCatalogFilter,
  type ExerciseCatalogFilter,
} from '../application/exercise-catalog-filter';
import { ExerciseFilterControls } from './ExerciseFilterControls';

async function renderControls(
  options: Readonly<{
    filter?: ExerciseCatalogFilter;
    hasQuery?: boolean;
    matchCount?: number;
  }> = {},
) {
  const onChange = jest.fn();
  await render(
    <ExerciseFilterControls
      filter={options.filter ?? noExerciseCatalogFilter}
      hasQuery={options.hasQuery ?? false}
      matchCount={options.matchCount ?? 0}
      onChange={onChange}
      testIDPrefix="exercise-library"
    />,
  );
  return { onChange };
}

function toggle() {
  return screen.getByTestId('exercise-library-filters-toggle');
}

async function expand() {
  await fireEvent.press(toggle());
}

const dumbbellChest: ExerciseCatalogFilter = Object.freeze({
  equipment: 'dumbbell',
  primaryMuscleGroup: 'chest',
});

describe('ExerciseFilterControls', () => {
  it('puts the options away by default', async () => {
    await renderControls();

    expect(toggle()).toHaveTextContent('Filters');
    expect(toggle()).toHaveProp('accessibilityState', {
      busy: false,
      disabled: false,
      expanded: false,
    });
    expect(
      screen.queryByLabelText('Filter by equipment'),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByLabelText('Filter by muscle group'),
    ).not.toBeOnTheScreen();
  });

  it('reveals both groups with their roles, names, and selected state', async () => {
    await renderControls();

    await expand();

    expect(toggle()).toHaveProp('accessibilityState', {
      busy: false,
      disabled: false,
      expanded: true,
    });
    expect(screen.getByLabelText('Filter by equipment')).toBeOnTheScreen();
    expect(screen.getByLabelText('Filter by muscle group')).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: true, name: 'Any equipment' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: true, name: 'Any muscle group' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { checked: false, name: 'Dumbbell' }),
    ).toBeOnTheScreen();
  });

  it('reports its own state and the active filter to a screen reader', async () => {
    await renderControls({ filter: dumbbellChest, matchCount: 1 });

    expect(toggle()).toHaveProp(
      'accessibilityLabel',
      'Show filters. Filtered by Dumbbell and Chest. 1 exercise.',
    );
  });

  it('says nothing is applied when nothing is', async () => {
    await renderControls();

    expect(toggle()).toHaveProp(
      'accessibilityLabel',
      'Show filters. No filters applied.',
    );
  });

  it('keeps an active filter visible and stated while the options are away', async () => {
    await renderControls({ filter: dumbbellChest, matchCount: 3 });

    // The summary and the clear action sit outside the collapsed region on
    // purpose: putting the choosing away must never put away the fact that
    // something is narrowing the list.
    expect(toggle()).toHaveTextContent('Filters: Dumbbell and Chest');
    expect(
      screen.getByTestId('exercise-library-filter-summary'),
    ).toHaveTextContent('Filtered by Dumbbell and Chest. 3 exercises.');
    expect(
      screen.getByRole('button', { name: 'Clear filters' }),
    ).toBeOnTheScreen();
  });

  it('states a narrowed miss rather than an empty list', async () => {
    await renderControls({ filter: dumbbellChest, matchCount: 0 });

    expect(
      screen.getByTestId('exercise-library-filter-summary'),
    ).toHaveTextContent(
      'Filtered by Dumbbell and Chest. No exercises match these filters.',
    );
  });

  it('names the search when one is narrowing the list too', async () => {
    await renderControls({
      filter: dumbbellChest,
      hasQuery: true,
      matchCount: 0,
    });

    expect(
      screen.getByTestId('exercise-library-filter-summary'),
    ).toHaveTextContent(
      'Filtered by Dumbbell and Chest. No exercises match this search and these filters.',
    );
  });

  it('offers no summary and no clear action while nothing is narrowed', async () => {
    await renderControls();

    expect(
      screen.queryByTestId('exercise-library-filter-summary'),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeOnTheScreen();
  });

  it('reports each chosen value and clears both in one action', async () => {
    const { onChange } = await renderControls({ filter: dumbbellChest });

    await expand();
    await fireEvent.press(screen.getByRole('radio', { name: 'Barbell' }));
    expect(onChange).toHaveBeenCalledWith({
      equipment: 'barbell',
      primaryMuscleGroup: 'chest',
    });

    await fireEvent.press(
      screen.getByRole('radio', { name: 'Any muscle group' }),
    );
    expect(onChange).toHaveBeenCalledWith({
      equipment: 'dumbbell',
      primaryMuscleGroup: null,
    });

    await fireEvent.press(
      screen.getByRole('button', { name: 'Clear filters' }),
    );
    expect(onChange).toHaveBeenCalledWith(noExerciseCatalogFilter);
  });

  it('keeps the same control across expanding and collapsing so focus is not lost', async () => {
    await renderControls();
    const before = toggle();

    await expand();
    const expanded = toggle();
    await fireEvent.press(expanded);
    const after = toggle();

    // The control is rendered outside the region it opens, so pressing it never
    // unmounts the element that has focus.
    expect(expanded).toBe(before);
    expect(after).toBe(before);
    expect(
      screen.queryByLabelText('Filter by equipment'),
    ).not.toBeOnTheScreen();
  });
});
