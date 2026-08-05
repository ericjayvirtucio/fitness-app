import { router } from 'expo-router';
import { ExerciseLibraryScreen } from '../src/features/exercise-catalog/presentation/ExerciseLibraryScreen';

export default function ExerciseLibraryRoute() {
  return (
    <ExerciseLibraryScreen
      onCreate={() => router.push('/exercise-library/new')}
      onEdit={(id) => router.push(`/exercise-library/${id}/edit`)}
    />
  );
}
