import { router } from 'expo-router';
import { HydrationTargetScreen } from '../src/features/hydration-tracking/presentation/HydrationTargetScreen';

export default function HydrationTargetRoute() {
  return <HydrationTargetScreen onDone={() => router.back()} />;
}
