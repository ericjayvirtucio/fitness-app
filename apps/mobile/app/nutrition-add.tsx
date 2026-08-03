import { router } from 'expo-router';
import { NutritionCatalogBrowserScreen } from '../src/features/nutrition-logging/presentation/NutritionCatalogBrowserScreen';

export default function NutritionAddRoute() {
  return (
    <NutritionCatalogBrowserScreen
      onCreate={() => router.push('/nutrition-catalog/new')}
      onEdit={(id) => router.push(`/nutrition-catalog/${id}/edit`)}
      onLog={(id) => router.push(`/nutrition-catalog/${id}/log`)}
      onManual={() => router.push('/nutrition-entry/new')}
    />
  );
}
