import { router, useLocalSearchParams } from 'expo-router';
import { CompletedWorkoutSetCorrectionScreen } from '../../../../src/features/workout-history/presentation/CompletedWorkoutSetCorrectionScreen';

export default function AddMissingCompletedSetRoute() {
  const { exerciseId, id } = useLocalSearchParams<{
    exerciseId: string;
    id: string;
  }>();
  return (
    <CompletedWorkoutSetCorrectionScreen
      exerciseId={exerciseId ?? ''}
      onDone={() => router.replace(`/workout-history/${id ?? ''}`)}
      sessionId={id ?? ''}
    />
  );
}
