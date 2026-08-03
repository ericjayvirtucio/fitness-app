import { router } from 'expo-router';
import { NutritionDiaryScreen } from '../../src/features/nutrition-logging/presentation/NutritionDiaryScreen';

export default function NutritionScreen() {
  return (
    <NutritionDiaryScreen
      onAdd={() => router.push('/nutrition-entry/new')}
      onEdit={(id) => router.push(`/nutrition-entry/${id}`)}
    />
  );
}
