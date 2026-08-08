import { router } from 'expo-router';
import { WorkoutHistoryScreen } from '../../src/features/workout-history/presentation/WorkoutHistoryScreen';

export default function WorkoutHistoryRoute() {
  return (
    <WorkoutHistoryScreen
      onOpenExercise={(id) => router.push(`/workout-history/exercise/${id}`)}
      onOpenSession={(id) => router.push(`/workout-history/${id}`)}
    />
  );
}
