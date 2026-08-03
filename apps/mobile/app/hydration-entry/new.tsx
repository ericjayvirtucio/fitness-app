import { router } from 'expo-router';
import { HydrationEntryScreen } from '../../src/features/hydration-tracking/presentation/HydrationEntryScreen';

export default function NewHydrationEntryRoute() {
  return <HydrationEntryScreen onDone={() => router.back()} />;
}
