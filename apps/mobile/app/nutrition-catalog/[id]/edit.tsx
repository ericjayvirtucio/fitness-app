import { router, useLocalSearchParams } from 'expo-router';
import { NutritionCatalogEditorScreen } from '../../../src/features/nutrition-logging/presentation/NutritionCatalogEditorScreen';

export default function EditNutritionCatalogItemRoute() {
  const parameters = useLocalSearchParams<{ id?: string }>();
  return (
    <NutritionCatalogEditorScreen
      catalogItemId={parameters.id ?? ''}
      onDone={() => router.back()}
    />
  );
}
