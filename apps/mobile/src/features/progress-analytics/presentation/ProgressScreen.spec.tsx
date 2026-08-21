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
    // Protein is unknown in this fixture, so its total and its average both
    // read Incomplete for the same reason.
    expect(screen.getAllByText('Incomplete')).toHaveLength(2);
    expect(
      screen.getByLabelText('Average protein per logged day, Incomplete'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average carbohydrate per logged day, 30 g'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average fat per logged day, 10 g'),
    ).toBeOnTheScreen();
    // Four averages share one card, so each names the value it averages.
    expect(
      screen.getByLabelText('Average energy per logged day, 1000 kcal'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average fluid per logged day, 500 mL'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Other fluids, 0 mL')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average plain water per logged day, 500 mL'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Average per logged day/)).toBeNull();
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
    // A period with nothing logged states that in words and claims no average.
    expect(screen.queryByLabelText(/Average /)).toBeNull();
  });

  it('describes recorded body weight without claiming a trend', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: { execute: jest.fn(() => Promise.resolve(summary)) },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('First recorded, 83.0 kg'),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('Latest recorded, 81.8 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Recorded change, −1.2 kg')).toBeOnTheScreen();
    expect(screen.getByLabelText('Check-ins, 2')).toBeOnTheScreen();
    // The caption carries no name of its own, so it announces the sentence it
    // displays rather than restating the metrics above it.
    expect(
      screen.getByText(
        'This is the difference between your first and latest recorded check-ins, not a measured trend.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.queryByLabelText(/Body weight progress/),
    ).not.toBeOnTheScreen();
  });

  it('shows a single check-in without a recorded change', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  bodyWeight: {
                    changeGrams: null,
                    entryCount: 1,
                    firstGrams: 82_400,
                    firstLocalCalendarDate: '2026-08-04',
                    latestGrams: 82_400,
                    latestLocalCalendarDate: '2026-08-04',
                  },
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Check-ins, 1')).toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText(/Recorded change,/)).toBeNull();
    expect(screen.getByText(/at least two check-ins/)).toBeOnTheScreen();
  });

  it('renders recorded weight in the profile display unit', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  preferredUnitSystem: 'imperial' as const,
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('First recorded, 183.0 lb'),
      ).toBeOnTheScreen(),
    );
  });

  it('omits an unknown average rather than showing it as zero', async () => {
    // The read model permits an unknown average beside a logged day even
    // though the reader cannot produce one. The guard is what keeps that
    // combination unrenderable instead of rendering it as a false zero.
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  hydration: {
                    ...summary.hydration,
                    averageFluidMillilitersPerLoggedDay: null,
                  },
                  nutrition: {
                    ...summary.nutrition,
                    averageEnergyKilojoulesPerLoggedDay: null,
                  },
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Energy, 1000 kcal')).toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText(/Average energy per logged day/)).toBeNull();
    expect(screen.queryByLabelText(/Average fluid per logged day/)).toBeNull();
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
  bodyWeight: {
    changeGrams: -1_200,
    entryCount: 2,
    firstGrams: 83_000,
    firstLocalCalendarDate: '2026-08-02',
    latestGrams: 81_800,
    latestLocalCalendarDate: '2026-08-08',
  },
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
        carbohydrate: { total: 30 },
        energyKilojoules: 4_184,
        entryCount: 1,
        fat: { total: 10 },
        localCalendarDate: '2026-08-02',
        protein: { total: null },
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
    carbohydrate: { averagePerLoggedDay: 30, total: 30 },
    energyKilojoules: 4_184,
    entryCount: 1,
    fat: { averagePerLoggedDay: 10, total: 10 },
    loggedDayCount: 1,
    protein: { averagePerLoggedDay: null, total: null },
  },
  preferredUnitSystem: 'metric',
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
  bodyWeight: null,
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
    carbohydrate: { averagePerLoggedDay: null, total: 0 },
    energyKilojoules: 0,
    entryCount: 0,
    fat: { averagePerLoggedDay: null, total: 0 },
    loggedDayCount: 0,
    protein: { averagePerLoggedDay: null, total: 0 },
  },
  preferredUnitSystem: 'metric',
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
