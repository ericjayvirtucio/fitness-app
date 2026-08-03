import { router, useLocalSearchParams } from 'expo-router';
import { ConsumptionEntryScreen } from '../../src/features/nutrition-logging/presentation/ConsumptionEntryScreen';

export default function EditNutritionEntryRoute() {
  const parameters = useLocalSearchParams<{ id?: string }>();
  return (
    <ConsumptionEntryScreen
      entryId={parameters.id ?? ''}
      onDone={() => router.back()}
    />
  );
}
