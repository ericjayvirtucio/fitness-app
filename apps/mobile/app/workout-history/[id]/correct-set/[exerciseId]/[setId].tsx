import { router, useLocalSearchParams } from 'expo-router';
import { CompletedWorkoutSetCorrectionScreen } from '../../../../../src/features/workout-history/presentation/CompletedWorkoutSetCorrectionScreen';

export default function CorrectCompletedSetRoute() {
  const { exerciseId, id, setId } = useLocalSearchParams<{
    exerciseId: string;
    id: string;
    setId: string;
  }>();
  return (
    <CompletedWorkoutSetCorrectionScreen
      exerciseId={exerciseId ?? ''}
      onDone={() => router.replace(`/workout-history/${id ?? ''}`)}
      sessionId={id ?? ''}
      setId={setId ?? ''}
    />
  );
}
