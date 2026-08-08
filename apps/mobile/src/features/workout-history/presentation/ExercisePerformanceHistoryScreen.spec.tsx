import { render, screen, waitFor } from '@testing-library/react-native';
import { DomainId } from '@fitness/domain';
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

function sessionId() {
  const result = DomainId.create('550e8400-e29b-41d4-a716-446655440000');
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

describe('ExercisePerformanceHistoryScreen', () => {
  it('shows mode-specific actual performance without a record claim', async () => {
    await render(
      <ExercisePerformanceHistoryScreen
        exerciseDefinitionId="550e8400-e29b-41d4-a716-446655440001"
        loadUseCases={() =>
          Promise.resolve({
            getProfile: { execute: () => Promise.resolve(null) },
            listExercisePerformance: {
              execute: () =>
                Promise.resolve({
                  items: [
                    {
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
                    },
                  ],
                  nextCursor: null,
                }),
            },
          } as never)
        }
        onClose={jest.fn()}
        onOpenSession={jest.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Bench Press')).toBeOnTheScreen(),
    );
    expect(
      screen.getByText(
        '2 actual sets · 16 repetitions · 60 kg maximum resistance · 960 kg-reps recorded load volume',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/personal record/i)).not.toBeOnTheScreen();
  });
});
