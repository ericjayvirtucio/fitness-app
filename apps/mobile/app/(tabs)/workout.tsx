import { router } from 'expo-router';
import { WorkoutScreen as WorkoutLandingScreen } from '../../src/features/exercise-catalog/presentation/WorkoutScreen';

export default function WorkoutScreen() {
  return (
    <WorkoutLandingScreen
      onOpenLibrary={() => router.push('/exercise-library')}
    />
  );
}
