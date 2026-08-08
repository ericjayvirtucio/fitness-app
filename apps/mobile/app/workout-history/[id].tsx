import { router, useLocalSearchParams } from 'expo-router';
import { CompletedWorkoutScreen } from '../../src/features/workout-history/presentation/CompletedWorkoutScreen';

export default function CompletedWorkoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <CompletedWorkoutScreen
      id={id ?? ''}
      onClose={() => router.replace('/workout-history')}
    />
  );
}
