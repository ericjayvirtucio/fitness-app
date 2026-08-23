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
    // Protein is the only unknown nutrient in this fixture, so its total and
    // its average both read Incomplete for the same reason and nothing else
    // does. This count was two while the card carried three nutrients.
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
    // The three nutrients a period could not previously state.
    expect(screen.getByLabelText('Fiber, 6 g')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average fiber per logged day, 6 g'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Sugar, 9 g')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average sugar per logged day, 9 g'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Sodium, 450 mg')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average sodium per logged day, 450 mg'),
    ).toBeOnTheScreen();
    // Sodium is stored and displayed in milligrams. A gram rendering of the
    // same number would be a different quantity by three orders of magnitude.
    expect(screen.queryByLabelText('Sodium, 450 g')).toBeNull();
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
    // Nor does it account for a dimension. The empty sentence already says
    // there was nothing to account for.
    expect(
      screen.queryByText(/recorded load volume from weighted sets/),
    ).toBeNull();
    expect(screen.queryByLabelText(/^Performed duration,/)).toBeNull();
    expect(screen.queryByLabelText(/^Performed distance,/)).toBeNull();
  });

  it('states an unknown fiber, sugar, and sodium exactly as an unknown macronutrient', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  nutrition: {
                    ...summary.nutrition,
                    fiber: { averagePerLoggedDay: null, total: null },
                    sodium: { averagePerLoggedDay: null, total: null },
                    sugar: { averagePerLoggedDay: null, total: null },
                  },
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Fiber, Incomplete')).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Average fiber per logged day, Incomplete'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Sugar, Incomplete')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average sugar per logged day, Incomplete'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Sodium, Incomplete')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Average sodium per logged day, Incomplete'),
    ).toBeOnTheScreen();
    // The card keeps one height whatever the period contains: a nutrient's
    // total and its average are unknown together, so this is still sixteen
    // metrics and the three exact nutrients are untouched.
    expect(screen.getByLabelText('Carbohydrate, 30 g')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Incomplete means one or more entries did not include that nutrient.',
      ),
    ).toBeOnTheScreen();
  });

  it('explains the word Incomplete when only a newly counted nutrient is unknown', async () => {
    // The sentence defines a word, and the word is now put on screen by six
    // nutrients rather than three. A period whose only gap is sodium must still
    // carry the explanation.
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  nutrition: {
                    ...summary.nutrition,
                    protein: { averagePerLoggedDay: 30, total: 30 },
                    sodium: { averagePerLoggedDay: null, total: null },
                  },
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Sodium, Incomplete')).toBeOnTheScreen(),
    );
    expect(screen.getByLabelText('Protein, 30 g')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Incomplete means one or more entries did not include that nutrient.',
      ),
    ).toBeOnTheScreen();
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

  it('states every dimension a period recorded, once each', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({ ...summary, workout: everyDimension }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Performed duration, 45 min 0 sec'),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByLabelText('Performed distance, 12.5 km'),
    ).toBeOnTheScreen();
    // Recorded load volume is the one total here that excludes recorded work,
    // so its coverage travels in the sentence carrying the number rather than
    // in a caption beside it.
    expect(
      screen.getByText('160 kg-reps recorded load volume from weighted sets'),
    ).toBeOnTheScreen();
    // Seven metrics and one sentence. Counted rather than listed, so an
    // accidental eighth line fails here instead of on a device.
    expect(screen.getAllByLabelText(workoutMetricPattern)).toHaveLength(7);
    // The counts and the elapsed time the card already stated are untouched.
    expect(screen.getByLabelText('Completed workouts, 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Actual sets, 9')).toBeOnTheScreen();
    expect(screen.getByLabelText('Performed exercises, 4')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Workout time, 2 hr 15 min'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Repetitions, 96')).toBeOnTheScreen();
  });

  it('writes a recorded distance and load volume in the profile display unit', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  preferredUnitSystem: 'imperial' as const,
                  workout: everyDimension,
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Performed distance, 7.77 mi'),
      ).toBeOnTheScreen(),
    );
    expect(
      screen.getByText(
        '352.74 lb-reps recorded load volume from weighted sets',
      ),
    ).toBeOnTheScreen();
    // A duration carries no unit system, so it reads identically in both.
    expect(
      screen.getByLabelText('Performed duration, 45 min 0 sec'),
    ).toBeOnTheScreen();
  });

  it('states an absent load volume when a period recorded sets and none of them counted', async () => {
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  workout: {
                    ...everyDimension,
                    recordedLoadVolumeGramRepetitions: null,
                  },
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('No recorded load volume from weighted sets'),
      ).toBeOnTheScreen(),
    );
    // The absent sentence is the covered one with the number removed, never a
    // zero: zero would be a false claim about the work that was recorded.
    expect(screen.queryByText(/0 kg-reps/)).toBeNull();
    expect(screen.queryByLabelText(/Recorded load volume/)).toBeNull();
  });

  it('omits a dimension a period did not record rather than showing it as zero', async () => {
    // The two negatives below are pins: nothing rendered those lines before
    // this card stated them, so they pass against the previous commit too and
    // exist to keep the omission deliberate. The absent-load sentence at the
    // end is real evidence and is what makes this case red without the change.
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
      expect(screen.getByLabelText('Completed workouts, 1')).toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText(/^Performed duration,/)).toBeNull();
    expect(screen.queryByLabelText(/^Performed distance,/)).toBeNull();
    expect(screen.queryByText(/0 km/)).toBeNull();
    // The fixture records one set and no eligible load, so the dimension is
    // accounted for in the direction that has a sentence.
    expect(
      screen.getByText('No recorded load volume from weighted sets'),
    ).toBeOnTheScreen();
  });

  it('says nothing about load volume when a completed workout recorded no set', async () => {
    // A completed workout can hold no performed set, which is history without
    // being performed work. The counts above already say so, so the dimension
    // stays silent rather than claiming an absence about nothing.
    await render(
      <ProgressScreen
        loadUseCases={() =>
          Promise.resolve({
            getSummary: {
              execute: jest.fn(() =>
                Promise.resolve({
                  ...summary,
                  workout: {
                    actualSetCount: 0,
                    completedWorkoutCount: 1,
                    distanceMillimeters: null,
                    durationSeconds: null,
                    elapsedWorkoutSeconds: 300,
                    performedExerciseCount: 0,
                    recordedLoadVolumeGramRepetitions: null,
                    repetitions: null,
                  },
                }),
              ),
            },
          } as never)
        }
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Actual sets, 0')).toBeOnTheScreen(),
    );
    expect(screen.getAllByLabelText(workoutMetricPattern)).toHaveLength(4);
    expect(
      screen.queryByText('No recorded load volume from weighted sets'),
    ).toBeNull();
    expect(
      screen.queryByText(/recorded load volume from weighted sets/),
    ).toBeNull();
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

/**
 * Every line the Workouts card can render as a metric, and nothing else on the
 * screen. Matching by accessible name is the only way to count them, because
 * `Metric` composes `label, value` into one element whose two texts are
 * unreachable individually.
 */
const workoutMetricPattern =
  /^(Completed workouts|Actual sets|Performed exercises|Workout time|Repetitions|Performed duration|Performed distance), /;

/** One period recording all four dimensions of work at once. */
const everyDimension: ProgressSummary['workout'] = {
  actualSetCount: 9,
  completedWorkoutCount: 3,
  distanceMillimeters: 12_500_000,
  durationSeconds: 2_700,
  elapsedWorkoutSeconds: 8_100,
  performedExerciseCount: 4,
  recordedLoadVolumeGramRepetitions: 160_000,
  repetitions: 96,
};

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
        fiber: { total: 6 },
        localCalendarDate: '2026-08-02',
        protein: { total: null },
        sodium: { total: 450 },
        sugar: { total: 9 },
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
    fiber: { averagePerLoggedDay: 6, total: 6 },
    loggedDayCount: 1,
    protein: { averagePerLoggedDay: null, total: null },
    sodium: { averagePerLoggedDay: 450, total: 450 },
    sugar: { averagePerLoggedDay: 9, total: 9 },
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
    fiber: { averagePerLoggedDay: null, total: 0 },
    loggedDayCount: 0,
    protein: { averagePerLoggedDay: null, total: 0 },
    sodium: { averagePerLoggedDay: null, total: 0 },
    sugar: { averagePerLoggedDay: null, total: 0 },
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
