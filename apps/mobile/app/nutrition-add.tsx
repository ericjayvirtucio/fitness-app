import { router, useLocalSearchParams } from 'expo-router';
import { NutritionCatalogBrowserScreen } from '../src/features/nutrition-logging/presentation/NutritionCatalogBrowserScreen';

export default function NutritionAddRoute() {
  const parameters = useLocalSearchParams<{ date?: string }>();
  const dayParameters = parameters.date ? { date: parameters.date } : {};
  return (
    <NutritionCatalogBrowserScreen
      onCreate={() => router.push('/nutrition-catalog/new')}
      onEdit={(id) => router.push(`/nutrition-catalog/${id}/edit`)}
      onLog={(id) => router.push(`/nutrition-catalog/${id}/log`)}
      onManual={() =>
        router.push({
          pathname: '/nutrition-entry/new',
          params: dayParameters,
        })
      }
    />
  );
}
