import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ProgressSummary } from '../application/progress-models';
import { ProgressScreen } from './ProgressScreen';

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

describe('ProgressScreen', () => {
  it('shows truthful summaries, incompleteness, and accessible period controls', async () => {
    const execute = jest.fn(() => Promise.resolve(summary));
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({ getSummary: { execute } } as never)
        }
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Energy, 1000 kcal')).toBeOnTheScreen(),
    );
    expect(screen.getAllByText('Incomplete')).toHaveLength(1);
    expect(screen.getByLabelText('Completed workouts, 1')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        /Sun, Aug 2: 1000 kcal nutrition, 500 mL fluid, 1 completed workouts/,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('progress-next-period')).toBeDisabled();
  });

  it('reloads a newly selected period and shows explicit empty states', async () => {
    const execute = jest.fn(() => Promise.resolve(emptySummary));
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({ getSummary: { execute } } as never)
        }
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText('No nutrition logged in this period.'),
      ).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('progress-period-day'));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    expect(
      screen.getByText('No hydration logged in this period.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('No completed workouts in this period.'),
    ).toBeOnTheScreen();
  });

  it('offers retry after a loading failure', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() => Promise.reject(new Error('storage failed'))}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Progress unavailable')).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('Try Again')).toBeOnTheScreen();
  });
});

const summary: ProgressSummary = {
  days: [
    {
      hydration: {
        entryCount: 1,
        localCalendarDate: '2026-08-02',
        otherFluidMilliliters: 0,
        plainWaterMilliliters: 500,
        totalFluidMilliliters: 500,
      },
      localCalendarDate: '2026-08-02',
      nutrition: {
        carbohydrate: { isComplete: true, totalGrams: 30 },
        energyKilojoules: 4_184,
        entryCount: 1,
        fat: { isComplete: true, totalGrams: 10 },
        localCalendarDate: '2026-08-02',
        protein: { isComplete: false, totalGrams: null },
      },
      workout: {
        actualSetCount: 1,
        completedWorkoutCount: 1,
        localCalendarDate: '2026-08-02',
        performedExerciseCount: 1,
      },
    },
  ],
  hydration: {
    averageFluidMillilitersPerLoggedDay: 500,
    averagePlainWaterMillilitersPerLoggedDay: 500,
    entryCount: 1,
    loggedDayCount: 1,
    otherFluidMilliliters: 0,
    plainWaterMilliliters: 500,
    totalFluidMilliliters: 500,
  },
  nutrition: {
    averageEnergyKilojoulesPerLoggedDay: 4_184,
    carbohydrate: {
      averageGramsPerLoggedDay: 30,
      isComplete: true,
      totalGrams: 30,
    },
    energyKilojoules: 4_184,
    entryCount: 1,
    fat: { averageGramsPerLoggedDay: 10, isComplete: true, totalGrams: 10 },
    loggedDayCount: 1,
    protein: {
      averageGramsPerLoggedDay: null,
      isComplete: false,
      totalGrams: null,
    },
  },
  range: {
    endLocalCalendarDate: '2026-08-08',
    startLocalCalendarDate: '2026-08-02',
  },
  workout: {
    actualSetCount: 1,
    completedWorkoutCount: 1,
    distanceMillimeters: null,
    durationSeconds: null,
    elapsedWorkoutSeconds: 300,
    performedExerciseCount: 1,
    recordedLoadVolumeGramRepetitions: null,
    repetitions: 12,
  },
};

const emptySummary: ProgressSummary = {
  days: [],
  hydration: {
    averageFluidMillilitersPerLoggedDay: null,
    averagePlainWaterMillilitersPerLoggedDay: null,
    entryCount: 0,
    loggedDayCount: 0,
    otherFluidMilliliters: 0,
    plainWaterMilliliters: 0,
    totalFluidMilliliters: 0,
  },
  nutrition: {
    averageEnergyKilojoulesPerLoggedDay: null,
    carbohydrate: {
      averageGramsPerLoggedDay: null,
      isComplete: true,
      totalGrams: 0,
    },
    energyKilojoules: 0,
    entryCount: 0,
    fat: { averageGramsPerLoggedDay: null, isComplete: true, totalGrams: 0 },
    loggedDayCount: 0,
    protein: {
      averageGramsPerLoggedDay: null,
      isComplete: true,
      totalGrams: 0,
    },
  },
  range: {
    endLocalCalendarDate: '2026-08-08',
    startLocalCalendarDate: '2026-08-02',
  },
  workout: {
    actualSetCount: 0,
    completedWorkoutCount: 0,
    distanceMillimeters: null,
    durationSeconds: null,
    elapsedWorkoutSeconds: 0,
    performedExerciseCount: 0,
    recordedLoadVolumeGramRepetitions: null,
    repetitions: null,
  },
};
