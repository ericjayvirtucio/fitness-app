import { router, useLocalSearchParams } from 'expo-router';
import { WorkoutHistoryScreen } from '../../src/features/workout-history/presentation/WorkoutHistoryScreen';

export default function WorkoutHistoryRoute() {
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  return (
    <WorkoutHistoryScreen
      hasDeletedWorkout={deleted === '1'}
      onOpenExercise={(id) => router.push(`/workout-history/exercise/${id}`)}
      onOpenSession={(id) => router.push(`/workout-history/${id}`)}
    />
  );
}
