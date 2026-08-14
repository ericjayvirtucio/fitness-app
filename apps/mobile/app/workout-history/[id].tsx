import { router, useLocalSearchParams } from 'expo-router';
import { CompletedWorkoutScreen } from '../../src/features/workout-history/presentation/CompletedWorkoutScreen';

export default function CompletedWorkoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ?? '';
  return (
    <CompletedWorkoutScreen
      id={sessionId}
      onAddSet={(exerciseId) =>
        router.push(`/workout-history/${sessionId}/add-set/${exerciseId}`)
      }
      onClose={() => router.replace('/workout-history')}
      onCorrectSet={(exerciseId, setId) =>
        router.push(
          `/workout-history/${sessionId}/correct-set/${exerciseId}/${setId}`,
        )
      }
      // Replaced rather than pushed, so Back cannot reopen a workout that no
      // longer exists. The flag carries no identifier and only asks history to
      // announce what happened.
      onDeleted={() =>
        router.replace({
          params: { deleted: '1' },
          pathname: '/workout-history',
        })
      }
    />
  );
}
