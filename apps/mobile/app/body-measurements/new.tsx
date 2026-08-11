import { router } from 'expo-router';
import { BodyWeightEntryScreen } from '../../src/features/body-measurement-history/presentation/BodyWeightEntryScreen';

export default function NewBodyWeightCheckInRoute() {
  return <BodyWeightEntryScreen onDone={() => router.back()} />;
}
