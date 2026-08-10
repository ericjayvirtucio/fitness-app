import { router } from 'expo-router';
import { BodyMeasurementHistoryScreen } from '../../src/features/body-measurement-history/presentation/BodyMeasurementHistoryScreen';

export default function BodyMeasurementsRoute() {
  return (
    <BodyMeasurementHistoryScreen
      onAddCheckIn={() => router.push('/body-measurements/new')}
      onOpenEntry={(id) => router.push(`/body-measurements/${id}`)}
    />
  );
}
