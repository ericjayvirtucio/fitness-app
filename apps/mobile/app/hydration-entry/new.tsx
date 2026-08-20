import { router, useLocalSearchParams } from 'expo-router';
import { HydrationEntryScreen } from '../../src/features/hydration-tracking/presentation/HydrationEntryScreen';

export default function NewHydrationEntryRoute() {
  const parameters = useLocalSearchParams<{ date?: string }>();
  return (
    <HydrationEntryScreen
      onDone={() => router.back()}
      {...(parameters.date
        ? { selectedLocalCalendarDate: parameters.date }
        : {})}
    />
  );
}
