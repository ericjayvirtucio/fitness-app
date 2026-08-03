import { router, useLocalSearchParams } from 'expo-router';
import { NutritionCatalogEditorScreen } from '../../src/features/nutrition-logging/presentation/NutritionCatalogEditorScreen';

export default function NewNutritionCatalogItemRoute() {
  const parameters = useLocalSearchParams<{ fromEntryId?: string }>();
  return (
    <NutritionCatalogEditorScreen
      onDone={() => router.back()}
      {...(parameters.fromEntryId
        ? { consumptionEntryId: parameters.fromEntryId }
        : {})}
    />
  );
}
