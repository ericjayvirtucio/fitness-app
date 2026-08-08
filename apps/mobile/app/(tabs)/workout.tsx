import { router } from 'expo-router';
import { WorkoutPlannerScreen } from '../../src/features/workout-planner/presentation/WorkoutPlannerScreen';

export default function WorkoutScreen() {
  return (
    <WorkoutPlannerScreen
      onEditDay={(weekday) => router.push(`/workout-plan/${weekday}`)}
      onOpenActive={() => router.push('/workout-session/active')}
      onOpenLibrary={() => router.push('/exercise-library')}
      onOpenHistory={() => router.push('/workout-history')}
    />
  );
}
