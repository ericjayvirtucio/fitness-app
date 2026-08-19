import { router, useLocalSearchParams } from 'expo-router';
import { WorkoutNameScreen } from '../../../src/features/workout-session/presentation/WorkoutNameScreen';

export default function WorkoutNameRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <WorkoutNameScreen
      id={id ?? ''}
      onCancel={() => router.back()}
      onRenamed={() => router.back()}
    />
  );
}
