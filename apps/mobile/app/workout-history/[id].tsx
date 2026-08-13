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
    />
  );
}
