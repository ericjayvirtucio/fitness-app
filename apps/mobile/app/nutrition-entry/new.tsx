import { router, useLocalSearchParams } from 'expo-router';
import { ConsumptionEntryScreen } from '../../src/features/nutrition-logging/presentation/ConsumptionEntryScreen';

export default function NewNutritionEntryRoute() {
  const parameters = useLocalSearchParams<{ date?: string }>();
  return (
    <ConsumptionEntryScreen
      onDone={() => router.back()}
      {...(parameters.date
        ? { selectedLocalCalendarDate: parameters.date }
        : {})}
    />
  );
}
