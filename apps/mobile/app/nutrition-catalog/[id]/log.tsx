import { router, useLocalSearchParams } from 'expo-router';
import { LogNutritionCatalogItemScreen } from '../../../src/features/nutrition-logging/presentation/LogNutritionCatalogItemScreen';

export default function LogNutritionCatalogItemRoute() {
  const parameters = useLocalSearchParams<{ date?: string; id?: string }>();
  return (
    <LogNutritionCatalogItemScreen
      catalogItemId={parameters.id ?? ''}
      onDone={() => router.dismissTo('/nutrition')}
      {...(parameters.date
        ? { selectedLocalCalendarDate: parameters.date }
        : {})}
    />
  );
}
