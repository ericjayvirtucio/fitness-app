import { PersonalProfileScreen } from '../../src/features/personal-profile/presentation/PersonalProfileScreen';
import { router } from 'expo-router';

export default function ProfileScreen() {
  return (
    <PersonalProfileScreen
      onOpenBodyMeasurements={() => router.push('/body-measurements')}
      onOpenDataExport={() => router.push('/data-export')}
      onOpenDataRestore={() => router.push('/data-restore')}
      onOpenGoals={() => router.push('/goals-energy')}
    />
  );
}
