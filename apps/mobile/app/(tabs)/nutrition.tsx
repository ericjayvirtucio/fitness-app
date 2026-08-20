import { router } from 'expo-router';
import { NutritionDiaryScreen } from '../../src/features/nutrition-logging/presentation/NutritionDiaryScreen';

export default function NutritionScreen() {
  return (
    <NutritionDiaryScreen
      onAdd={(date) =>
        router.push({ pathname: '/nutrition-add', params: { date } })
      }
      onEdit={(id) => router.push(`/nutrition-entry/${id}`)}
    />
  );
}
