import { router, useLocalSearchParams } from 'expo-router';
import { CompletedWorkoutExerciseAdditionScreen } from '../../../src/features/workout-history/presentation/CompletedWorkoutExerciseAdditionScreen';

export default function AddCompletedWorkoutExerciseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ?? '';
  return (
    <CompletedWorkoutExerciseAdditionScreen
      id={sessionId}
      onAdded={() =>
        // Replaced rather than pushed, so Back cannot reopen a screen that
        // would add a second exercise. The flag carries no identifier and only
        // asks the detail to announce what happened.
        router.replace({
          params: { added: '1', id: sessionId },
          pathname: '/workout-history/[id]',
        })
      }
      onDone={() => router.replace(`/workout-history/${sessionId}`)}
    />
  );
}
