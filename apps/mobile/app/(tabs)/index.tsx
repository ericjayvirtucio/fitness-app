import { router } from 'expo-router';
import { HydrationDailyScreen } from '../../src/features/hydration-tracking/presentation/HydrationDailyScreen';

export default function TodayScreen() {
  return (
    <HydrationDailyScreen
      onAdd={() => router.push('/hydration-entry/new')}
      onEdit={(id) => router.push(`/hydration-entry/${id}`)}
      onSetTarget={() => router.push('/hydration-target')}
    />
  );
}
