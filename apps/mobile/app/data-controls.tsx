import { router } from 'expo-router';
import { DataControlsScreen } from '../src/features/data-lifecycle/presentation/DataControlsScreen';

export default function DataControlsRoute() {
  return (
    <DataControlsScreen
      onOpenDataExport={() => router.push('/data-export')}
      onOpenDataRestore={() => router.push('/data-restore')}
      onOpenLocalDataDeletion={() => router.push('/delete-local-data')}
    />
  );
}
