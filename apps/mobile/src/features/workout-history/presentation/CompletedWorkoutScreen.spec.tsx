import { render, screen, waitFor } from '@testing-library/react-native';
import {
  DomainId,
  RepetitionResult,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '@fitness/domain';
import { CompletedWorkoutScreen } from './CompletedWorkoutScreen';

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

const uuids = [
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
];

function requiredId(index: number) {
  const result = DomainId.create(uuids[index]);
  if (!result.isSuccess) throw new Error('Invalid fixture');
  return result.value;
}

function completedSession() {
  const set = WorkoutSet.create({
    id: requiredId(2),
    position: 0,
    result: RepetitionResult.valid(12),
  });
  if (!set.isSuccess) throw new Error('Invalid fixture');
  const exercise = WorkoutSessionExercise.create({
    exerciseNameSnapshot: 'Push-up',
    id: requiredId(1),
    loggingModeSnapshot: 'repetitions',
    plannedPrescriptionSnapshot: null,
    position: 0,
    sets: [set.value],
    sourceExerciseDefinitionId: requiredId(3),
    sourcePlannedExerciseId: null,
  });
  if (!exercise.isSuccess) throw new Error('Invalid fixture');
  const started = Date.UTC(2026, 7, 8, 4);
  const session = WorkoutSession.create({
    completedAtEpochMilliseconds: started + 600_000,
    exercises: [exercise.value],
    id: requiredId(0),
    name: 'Workout',
    sourcePlannedWorkoutId: null,
    sourceWeekday: null,
    startedAtEpochMilliseconds: started,
    startedLocalCalendarDate: '2026-08-08',
    startedUtcOffsetMinutes: 0,
    status: 'completed',
  });
  if (!session.isSuccess) throw new Error('Invalid fixture');
  return session.value;
}

describe('CompletedWorkoutScreen', () => {
  it('shows captured snapshot names and performed actual sets read-only', async () => {
    await render(
      <CompletedWorkoutScreen
        id={uuids[0] ?? ''}
        loadUseCases={() =>
          Promise.resolve({
            getCompleted: {
              execute: () => Promise.resolve(completedSession()),
            },
            getProfile: { execute: () => Promise.resolve(null) },
          } as never)
        }
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Push-up')).toBeOnTheScreen());
    expect(screen.getByText('Performed set 1: 12 reps')).toBeOnTheScreen();
    expect(screen.queryByText('Edit')).not.toBeOnTheScreen();
    expect(screen.queryByText('Delete')).not.toBeOnTheScreen();
  });
});
