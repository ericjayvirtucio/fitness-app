import { router, useLocalSearchParams } from 'expo-router';
import { ExercisePerformanceHistoryScreen } from '../../../src/features/workout-history/presentation/ExercisePerformanceHistoryScreen';

export default function ExercisePerformanceHistoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ExercisePerformanceHistoryScreen
      exerciseDefinitionId={id ?? ''}
      onClose={() => router.replace('/workout-history')}
      onOpenSession={(sessionId) =>
        router.push(`/workout-history/${sessionId}`)
      }
    />
  );
}
