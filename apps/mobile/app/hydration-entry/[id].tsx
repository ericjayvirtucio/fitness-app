import { router, useLocalSearchParams } from 'expo-router';
import { HydrationEntryScreen } from '../../src/features/hydration-tracking/presentation/HydrationEntryScreen';

export default function EditHydrationEntryRoute() {
  const parameters = useLocalSearchParams<{ id?: string }>();
  return (
    <HydrationEntryScreen
      entryId={parameters.id ?? ''}
      onDone={() => router.back()}
    />
  );
}
