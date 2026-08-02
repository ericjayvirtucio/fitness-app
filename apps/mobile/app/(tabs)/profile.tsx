import { PersonalProfileScreen } from '../../src/features/personal-profile/presentation/PersonalProfileScreen';
import { router } from 'expo-router';

export default function ProfileScreen() {
  return (
    <PersonalProfileScreen onOpenGoals={() => router.push('/goals-energy')} />
  );
}
