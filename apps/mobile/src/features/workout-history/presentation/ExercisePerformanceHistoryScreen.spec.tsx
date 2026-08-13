import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { DomainId, type UnitSystem } from '@fitness/domain';
import type {
  ExercisePersonalRecord,
  ExercisePersonalRecords,
} from '../application/exercise-personal-records';
import { ExercisePerformanceHistoryScreen } from './ExercisePerformanceHistoryScreen';

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

const exerciseId = '550e8400-e29b-41d4-a716-446655440001';

function sessionId() {
  const result = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

const performanceItem = {
  actualSetCount: 2,
  distanceMillimeters: null,
  durationSeconds: null,
  exerciseNameSnapshot: 'Bench Press',
  loggingModeSnapshot: 'external-load-and-repetitions',
  maximumResistanceGrams: 60_000,
  recordedLoadVolumeGramRepetitions: 960_000,
  repetitions: 16,
  sessionId: sessionId(),
  sessionNameSnapshot: 'Push Day',
  startedAtEpochMilliseconds: 0,
  startedLocalCalendarDate: '2026-08-08',
};

const heaviestLoad: ExercisePersonalRecord = {
  canonicalValue: 60_000,
  category: 'heaviest-load',
  loggingMode: 'external-load-and-repetitions',
  occurrence: {
    exerciseNameSnapshot: 'Bench Press',
    sessionId: sessionId(),
    sessionNameSnapshot: 'Push Day',
    setPosition: 2,
    startedLocalCalendarDate: '2026-08-08',
  },
};

function useCasesFor(
  options: Readonly<{
    onOpenRecords?: () => Promise<ExercisePersonalRecords | null>;
    records?: ExercisePersonalRecords;
    unitSystem?: UnitSystem;
  }> = {},
) {
  return () =>
    Promise.resolve({
      getPersonalRecords: {
        execute: () =>
          options.onOpenRecords
            ? options.onOpenRecords()
            : Promise.resolve(
                options.records ?? {
                  latestExerciseNameSnapshot: 'Bench Press',
                  records: [],
                  unsupportedLoggingModes: [],
                },
              ),
      },
      getProfile: {
        execute: () =>
          Promise.resolve(
            options.unitSystem
              ? { preferredUnitSystem: options.unitSystem }
              : null,
          ),
      },
      listExercisePerformance: {
        execute: () =>
          Promise.resolve({ items: [performanceItem], nextCursor: null }),
      },
    } as never);
}

describe('ExercisePerformanceHistoryScreen', () => {
  it('shows mode-specific actual performance below its records', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor()}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Performed sessions')).toBeOnTheScreen(),
    );
    expect(
      screen.getByText(
        '2 actual sets · 16 repetitions · 60 kg maximum resistance · 960 kg-reps recorded load volume',
      ),
    ).toBeOnTheScreen();
  });

  it('says so plainly when history has established no record', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor()}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'No completed set has established a record for this exercise yet.',
        ),
      ).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId('personal-record-card')).not.toBeOnTheScreen();
  });

  it('states a record with its units, date, workout, and set', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor({
          records: {
            latestExerciseNameSnapshot: 'Bench Press',
            records: [heaviestLoad],
            unsupportedLoggingModes: [],
          },
        })}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('Heaviest recorded load in a set'),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByText('60 kg')).toBeOnTheScreen();
    expect(screen.getByText('Push Day · Set 3')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        /Heaviest recorded load in a set, 60 kilograms, first recorded on .+, in Push Day, set 3/,
      ),
    ).toBeOnTheScreen();
  });

  it('writes record values in the preferred unit system', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor({
          records: {
            latestExerciseNameSnapshot: 'Bench Press',
            records: [heaviestLoad],
            unsupportedLoggingModes: [],
          },
          unitSystem: 'imperial',
        })}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('132.28 lb')).toBeOnTheScreen(),
    );
  });

  it('opens the completed workout that proves a record', async () => {
    const onOpenSession = jest.fn();
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor({
          records: {
            latestExerciseNameSnapshot: 'Bench Press',
            records: [heaviestLoad],
            unsupportedLoggingModes: [],
          },
        })}
        onClose={jest.fn()}
        onOpenSession={onOpenSession}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('personal-record-card')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByTestId('personal-record-card'));
    expect(onOpenSession).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('names the snapshot a record was set under when it has since changed', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor({
          records: {
            latestExerciseNameSnapshot: 'Barbell Bench Press',
            records: [heaviestLoad],
            unsupportedLoggingModes: [],
          },
        })}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen(),
    );
    expect(screen.getByText('Recorded as Bench Press')).toBeOnTheScreen();
  });

  it('explains an unsupported way of recording instead of showing a zero', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor({
          records: {
            latestExerciseNameSnapshot: 'Assisted Pull-up',
            records: [],
            unsupportedLoggingModes: ['assistance-and-repetitions'],
          },
        })}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'Personal records are not available for assisted work, because less assistance and more repetitions cannot be compared as one value.',
        ),
      ).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId('personal-record-card')).not.toBeOnTheScreen();
  });

  it('separates records recorded under different logging modes', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor({
          records: {
            latestExerciseNameSnapshot: 'Bench Press',
            records: [
              heaviestLoad,
              {
                ...heaviestLoad,
                canonicalValue: 12,
                category: 'most-repetitions',
                loggingMode: 'repetitions',
              },
            ],
            unsupportedLoggingModes: [],
          },
        })}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Recorded as Weight + reps')).toBeOnTheScreen(),
    );
    expect(screen.getByText('Recorded as Reps only')).toBeOnTheScreen();
  });

  it('keeps performed history visible when records cannot be read', async () => {
    let attempts = 0;
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={useCasesFor({
          onOpenRecords: () => {
            attempts += 1;
            return attempts === 1
              ? Promise.reject(new Error('unavailable'))
              : Promise.resolve({
                  latestExerciseNameSnapshot: 'Bench Press',
                  records: [heaviestLoad],
                  unsupportedLoggingModes: [],
                });
          },
        })}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText('Personal records could not be loaded.'),
      ).toBeOnTheScreen(),
    );
    expect(screen.getByText('Performed sessions')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Try Again'));

    await waitFor(() =>
      expect(
        screen.getByText('Heaviest recorded load in a set'),
      ).toBeOnTheScreen(),
    );
  });

  it('ignores a record response that a newer request replaced', async () => {
    let resolveFirst: ((value: ExercisePersonalRecords) => void) | undefined;
    const first = new Promise<ExercisePersonalRecords>((resolve) => {
      resolveFirst = resolve;
    });
    const pending = useCasesFor({ onOpenRecords: () => first });
    const answered = useCasesFor({
      records: {
        latestExerciseNameSnapshot: 'Bench Press',
        records: [heaviestLoad],
        unsupportedLoggingModes: [],
      },
    });
    const view = await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={pending}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText('Loading personal records'),
      ).toBeOnTheScreen(),
    );
    await view.rerender(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId={exerciseId}
        loadUseCases={answered}
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText('Heaviest recorded load in a set'),
      ).toBeOnTheScreen(),
    );
    resolveFirst?.({
      latestExerciseNameSnapshot: 'Stale Bench Press',
      records: [],
      unsupportedLoggingModes: ['assistance-and-repetitions'],
    });

    await waitFor(() =>
      expect(
        screen.getByText('Heaviest recorded load in a set'),
      ).toBeOnTheScreen(),
    );
    expect(screen.queryByText('Stale Bench Press')).not.toBeOnTheScreen();
  });
});
