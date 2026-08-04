import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseEditorScreen } from '../../../src/features/exercise-catalog/presentation/ExerciseEditorScreen';

export default function EditExerciseRoute() {
  const parameters = useLocalSearchParams<{ id?: string }>();
  return (
    <ExerciseEditorScreen
      {...(parameters.id ? { exerciseId: parameters.id } : {})}
      onDone={() => router.back()}
    />
  );
}
