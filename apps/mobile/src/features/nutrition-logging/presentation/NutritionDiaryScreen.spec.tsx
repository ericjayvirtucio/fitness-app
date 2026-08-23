import { Energy, isOk, type DailyNutritionSummary } from '@fitness/domain';
import { typography } from '../../../design-system';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { formatLocalCalendarDate } from '../../../application/date/local-calendar-date';
import { NutritionDiaryScreen } from './NutritionDiaryScreen';

jest.mock('expo-router', () => {
  const invokedCallbacks = new WeakSet<() => void>();
  return {
    useFocusEffect: (callback: () => void) => {
      if (!invokedCallbacks.has(callback)) {
        invokedCallbacks.add(callback);
        queueMicrotask(callback);
      }
    },
  };
});

function loader(nutrients: DailyNutritionSummary['nutrients']) {
  const energy = Energy.create(89, 'kilocalorie');
  if (!isOk(energy)) throw new Error('Invalid fixture.');
  return () =>
    Promise.resolve({
      getDailyNutrition: {
        execute: () =>
          Promise.resolve({
            entries: [],
            summary: { energy: energy.value, entryCount: 1, nutrients },
          }),
      },
    });
}

describe('NutritionDiaryScreen', () => {
  it('shows an accessible empty daily diary', async () => {
    const energy = Energy.create(0, 'kilocalorie');
    if (!isOk(energy)) throw new Error('Invalid fixture.');
    await render(
      <NutritionDiaryScreen
        loadUseCases={() =>
          Promise.resolve({
            getDailyNutrition: {
              execute: () =>
                Promise.resolve({
                  entries: [],
                  summary: {
                    energy: energy.value,
                    entryCount: 0,
                    nutrients: {
                      carbohydrateGrams: 0,
                      fatGrams: 0,
                      fiberGrams: 0,
                      proteinGrams: 0,
                      sodiumMilligrams: 0,
                      sugarGrams: 0,
                    },
                  },
                }),
            },
          })
        }
        onAdd={jest.fn()}
        onEdit={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Nothing logged for this day')).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Add food or beverage' }),
    ).toBeTruthy();
  });

  it('announces the daily totals it displays', async () => {
    await render(
      <NutritionDiaryScreen
        loadUseCases={loader({
          carbohydrateGrams: 22.8,
          fatGrams: 0.3,
          fiberGrams: 2.6,
          proteinGrams: 1.1,
          sodiumMilligrams: 1,
          sugarGrams: 12.2,
        })}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('89 kcal')).toBeTruthy());
    // The day's energy is the diary's subject, so it is stated as the screen's
    // one hero numeral and shrinks rather than wrapping at large text sizes.
    expect(screen.getByText('89 kcal')).toHaveStyle({
      fontSize: typography.hero.fontSize,
    });
    expect(screen.getByText('89 kcal')).toHaveProp(
      'adjustsFontSizeToFit',
      true,
    );
    expect(screen.getByText('1 entry')).toBeTruthy();
    expect(screen.getByText('Protein: 1.1 g')).toBeTruthy();
    expect(screen.getByText('Sodium: 1 mg')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Daily nutrition totals, 89 kcal, 1 entry, Protein: 1.1 g, Carbohydrate: 22.8 g, Fat: 0.3 g, Fiber: 2.6 g, Sugar: 12.2 g, Sodium: 1 mg',
      ),
    ).toBeTruthy();
  });

  it('announces the shorter totals when a nutrient is unknown', async () => {
    await render(
      <NutritionDiaryScreen
        loadUseCases={loader({
          carbohydrateGrams: 22.8,
          fatGrams: 0.3,
          fiberGrams: null,
          proteinGrams: 1.1,
          sodiumMilligrams: 1,
          sugarGrams: 12.2,
        })}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Fiber: Incomplete')).toBeTruthy(),
    );
    expect(
      screen.getByLabelText(
        'Daily nutrition totals, 89 kcal, 1 entry, Protein: 1.1 g, Carbohydrate: 22.8 g, Fat: 0.3 g, Fiber: Incomplete, Sugar: 12.2 g, Sodium: 1 mg, Incomplete means at least one entry has unknown information for that nutrient.',
      ),
    ).toBeTruthy();
  });

  it('adds to the day it is showing, before and after moving a day', async () => {
    const onAdd = jest.fn();
    const view = await render(
      <NutritionDiaryScreen
        loadUseCases={loader({
          carbohydrateGrams: 0,
          fatGrams: 0,
          fiberGrams: 0,
          proteinGrams: 0,
          sodiumMilligrams: 0,
          sugarGrams: 0,
        })}
        onAdd={onAdd}
        onEdit={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add food or beverage' }),
      ).toBeTruthy(),
    );

    const today = new Date();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add food or beverage' }),
    );
    expect(onAdd).toHaveBeenLastCalledWith(formatLocalCalendarDate(today));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add first entry' }),
    );
    expect(onAdd).toHaveBeenLastCalledWith(formatLocalCalendarDate(today));

    await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add food or beverage' }),
      ).toBeTruthy(),
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add food or beverage' }),
    );
    expect(onAdd).toHaveBeenLastCalledWith(formatLocalCalendarDate(yesterday));
    /*
     * Unmounted explicitly. Moving a day starts another read, and leaving it to
     * automatic cleanup lets that update land inside the next test's render.
     */
    await view.unmount();
  });

  it('stops the day navigator at today and moves again once a day is past', async () => {
    const view = await render(
      <NutritionDiaryScreen
        loadUseCases={loader({
          carbohydrateGrams: 0,
          fatGrams: 0,
          fiberGrams: 0,
          proteinGrams: 0,
          sodiumMilligrams: 0,
          sugarGrams: 0,
        })}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next day' })).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Previous day' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled(),
    );
    /*
     * Unmounted explicitly. Moving a day starts another read, and leaving it to
     * automatic cleanup lets that update land inside the next test's render.
     */
    await view.unmount();
  });

  it('announces the error rather than stale totals', async () => {
    await render(
      <NutritionDiaryScreen
        loadUseCases={() => Promise.reject(new Error('unavailable'))}
        onAdd={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Nutrition diary error')).toBeTruthy(),
    );
    expect(screen.queryByText(/Daily nutrition totals/)).toBeNull();
  });
});
