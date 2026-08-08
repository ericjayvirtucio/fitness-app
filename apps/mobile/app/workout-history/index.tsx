import { router } from 'expo-router';
import { WorkoutHistoryScreen } from '../../src/features/workout-history/presentation/WorkoutHistoryScreen';

export default function WorkoutHistoryRoute() {
  return (
    <WorkoutHistoryScreen
      onOpenSession={(id) => router.push(`/workout-history/${id}`)}
    />
  );
}
