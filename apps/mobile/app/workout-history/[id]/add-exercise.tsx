import { router, useLocalSearchParams } from 'expo-router';
import { CompletedWorkoutExerciseAdditionScreen } from '../../../src/features/workout-history/presentation/CompletedWorkoutExerciseAdditionScreen';

export default function AddCompletedWorkoutExerciseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ?? '';
  return (
    <CompletedWorkoutExerciseAdditionScreen
      id={sessionId}
      onDone={() => router.replace(`/workout-history/${sessionId}`)}
    />
  );
}
