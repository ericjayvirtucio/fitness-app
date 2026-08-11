import { router } from 'expo-router';
import { DataRestoreScreen } from '../src/features/data-restore/presentation/DataRestoreScreen';

export default function DataRestoreRoute() {
  return <DataRestoreScreen onFinish={() => router.replace('/profile')} />;
}
