import { router, useLocalSearchParams } from 'expo-router';
import { BodyWeightEntryScreen } from '../../src/features/body-measurement-history/presentation/BodyWeightEntryScreen';

export default function EditBodyWeightCheckInRoute() {
  const parameters = useLocalSearchParams<{ id?: string }>();
  return (
    <BodyWeightEntryScreen
      entryId={parameters.id ?? ''}
      onDone={() => router.back()}
    />
  );
}
