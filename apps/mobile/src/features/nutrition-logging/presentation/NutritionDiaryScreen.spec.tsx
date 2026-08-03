import { Energy, isOk } from '@fitness/domain';
import { render, screen, waitFor } from '@testing-library/react-native';
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
});
