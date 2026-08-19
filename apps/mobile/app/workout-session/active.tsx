import { router } from 'expo-router';
import { WorkoutSessionScreen } from '../../src/features/workout-session/presentation/WorkoutSessionScreen';

export default function ActiveWorkoutRoute() {
  return (
    <WorkoutSessionScreen
      onClose={() => router.replace('/workout')}
      onRename={(sessionId) =>
        router.push(`/workout-session/${sessionId}/name`)
      }
    />
  );
}
