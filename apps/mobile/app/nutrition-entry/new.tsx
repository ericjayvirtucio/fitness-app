import { router } from 'expo-router';
import { ConsumptionEntryScreen } from '../../src/features/nutrition-logging/presentation/ConsumptionEntryScreen';

export default function NewNutritionEntryRoute() {
  return <ConsumptionEntryScreen onDone={() => router.back()} />;
}
