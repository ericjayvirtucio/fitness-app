import { router } from 'expo-router';
import { ExerciseEditorScreen } from '../../src/features/exercise-catalog/presentation/ExerciseEditorScreen';

export default function NewExerciseRoute() {
  return <ExerciseEditorScreen onDone={() => router.back()} />;
}
