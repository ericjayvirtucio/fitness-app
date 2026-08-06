import { router, useLocalSearchParams } from 'expo-router';
import { PlannedWorkoutEditorScreen } from '../../src/features/workout-planner/presentation/PlannedWorkoutEditorScreen';

export default function PlannedWorkoutRoute() {
  const parameters = useLocalSearchParams<{ weekday?: string }>();
  return (
    <PlannedWorkoutEditorScreen
      onDone={() => router.back()}
      weekdayValue={
        parameters.weekday === undefined
          ? undefined
          : Number(parameters.weekday)
      }
    />
  );
}
